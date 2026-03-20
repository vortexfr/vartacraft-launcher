'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path   = require('path');
const fs     = require('fs');
const https  = require('https');
const http   = require('http');
const crypto = require('crypto');
const os     = require('os');
const net    = require('net');
const { spawn } = require('child_process');
const sevenBin  = require('7zip-bin');
const { extractFull } = require('node-7z');

let DiscordRPC;
try { DiscordRPC = require('discord-rpc'); } catch (_) {}

const isDev = process.env.NODE_ENV === 'development';

// ── Constants ──────────────────────────────────────────────────────────────────
const MOD_URL           = 'https://launcher.ouiweb.eu/mod';
const FORGE_BUILD       = '1.20.1-47.4.13';
const FORGE_VERSION_ID  = '1.20.1-forge-47.4.13';
const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE_BUILD}/forge-${FORGE_BUILD}-installer.jar`;
const SERVER_HOST       = 'gm53-dc02.ouiheberg.com';
const SERVER_PORT       = 25632;
const DISCORD_CLIENT_ID = '1458808505380376810';

// ── Single instance ────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win;
let tray = null;
let gameProcess = null;
let rpc = null;
let rpcReady = false;

// ── Utilities ──────────────────────────────────────────────────────────────────
function getGameDir() { return path.join(app.getPath('appData'), '.VartacraftGame'); }
function mkdirp(dir)  { fs.mkdirSync(dir, { recursive: true }); }

function getFileSha1(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const s = fs.createReadStream(filePath);
    s.on('data', d => hash.update(d));
    s.on('end',  () => resolve(hash.digest('hex')));
    s.on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchText(res.headers.location).then(resolve).catch(reject);
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
      res.on('error', reject);
    }).on('error', reject);
  });
}
const fetchJson = url => fetchText(url).then(t => JSON.parse(t));

function getRemoteSize(url) {
  return new Promise(resolve => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.request(url, { method: 'HEAD' }, res =>
      resolve(parseInt(res.headers['content-length'] || '0'))
    );
    req.on('error', () => resolve(0)); req.end();
  });
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    mkdirp(path.dirname(dest));
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0');
      let done = 0;
      res.on('data', chunk => { done += chunk.length; if (onProgress && total > 0) onProgress(Math.round((done / total) * 100)); });
      res.pipe(file);
      file.on('finish', () => file.close(() => { fs.renameSync(tmp, dest); resolve(); }));
    });
    req.on('error', err => { file.close(); if (fs.existsSync(tmp)) fs.unlinkSync(tmp); reject(err); });
    req.setTimeout(120000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function extractZip(zipPath, destDir) {
  mkdirp(destDir);
  return new Promise((resolve, reject) => {
    const stream = extractFull(zipPath, destDir, { $bin: sevenBin.path7za });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

function findJava(dir) {
  if (!fs.existsSync(dir)) return null;
  const name = process.platform === 'win32' ? 'java.exe' : 'java';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { const f = findJava(full); if (f) return f; }
    else if (e.name === name) return full;
  }
  return null;
}

// ── Tray ───────────────────────────────────────────────────────────────────────
function createTray() {
  if (tray) return;
  try {
    const iconPath = isDev
      ? path.join(__dirname, '../src/assets/icon.ico')
      : path.join(process.resourcesPath, 'assets', 'icon.ico');
    const img = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty();
    tray = new Tray(img);
    tray.setToolTip('Vartacraft Launcher');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Vartacraft Launcher', enabled: false },
      { type: 'separator' },
      { label: 'Ouvrir', click: () => { win?.show(); win?.focus(); } },
      { type: 'separator' },
      { label: 'Quitter', click: () => { if (gameProcess) gameProcess.kill(); app.quit(); } },
    ]));
    tray.on('click', () => { win?.show(); win?.focus(); });
  } catch (_) {}
}

function destroyTray() {
  if (tray) { tray.destroy(); tray = null; }
}

// ── Mod cleanup (launch-time) ──────────────────────────────────────────────────
function cleanExtraMods(gameDir) {
  try {
    const listPath = path.join(gameDir, '.modlist.json');
    if (!fs.existsSync(listPath)) return;
    const allowed = new Set(JSON.parse(fs.readFileSync(listPath, 'utf-8')));
    const modsDir = path.join(gameDir, 'mods');
    if (!fs.existsSync(modsDir)) return;
    for (const file of fs.readdirSync(modsDir)) {
      if (file.endsWith('.jar') && !allowed.has(file)) {
        try { fs.unlinkSync(path.join(modsDir, file)); } catch (_) {}
      }
    }
  } catch (_) {}
}

// ── Discord RPC ────────────────────────────────────────────────────────────────
function initDiscordRPC() {
  if (!DiscordRPC) return;
  try {
    rpc = new DiscordRPC.Client({ transport: 'ipc' });
    rpc.on('ready', () => {
      rpcReady = true;
      setRPCActivity('Au menu principal', null);
    });
    rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(() => {});
  } catch (_) {}
}

function setRPCActivity(details, state) {
  if (!rpcReady || !rpc) return;
  try {
    const activity = {
      details,
      largeImageKey: 'logo',
      largeImageText: 'Vartacraft — Empire Faction',
      instance: false,
    };
    if (state) activity.state = state;
    rpc.setActivity(activity).catch(() => {});
  } catch (_) {}
}

// ── Minecraft server ping ──────────────────────────────────────────────────────
function writeVarInt(val) {
  const out = [];
  do {
    let b = val & 0x7F;
    val >>>= 7;
    if (val) b |= 0x80;
    out.push(b);
  } while (val);
  return Buffer.from(out);
}

function pingMinecraftServer(host, port) {
  return new Promise(resolve => {
    const fail = { online: false, players: { online: 0, max: 0 } };
    let done = false;
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      if (!done) { done = true; socket.destroy(); resolve(fail); }
    }, 5000);

    socket.on('connect', () => {
      const hostBuf = Buffer.from(host, 'utf8');
      const portBuf = Buffer.alloc(2);
      portBuf.writeUInt16BE(port);
      const payload = Buffer.concat([
        Buffer.from([0x00]),
        writeVarInt(765),
        writeVarInt(hostBuf.length),
        hostBuf,
        portBuf,
        Buffer.from([0x01]),
      ]);
      socket.write(Buffer.concat([writeVarInt(payload.length), payload]));
      socket.write(Buffer.from([0x01, 0x00]));
    });

    let buf = Buffer.alloc(0);
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      try {
        let off = 0;
        let pktLen = 0, shift = 0;
        while (true) { const b = buf[off++]; pktLen |= (b & 0x7F) << shift; if (!(b & 0x80)) break; shift += 7; }
        if (buf.length < off + pktLen) return;
        while (buf[off++] & 0x80) {}
        let strLen = 0; shift = 0;
        while (true) { const b = buf[off++]; strLen |= (b & 0x7F) << shift; if (!(b & 0x80)) break; shift += 7; }
        const json = JSON.parse(buf.slice(off, off + strLen).toString('utf8'));
        if (!done) {
          done = true; clearTimeout(timer); socket.destroy();
          resolve({ online: true, players: { online: json.players?.online ?? 0, max: json.players?.max ?? 0 } });
        }
      } catch (_) {}
    });

    socket.on('error', () => { if (!done) { done = true; clearTimeout(timer); resolve(fail); } });
    socket.on('timeout', () => { if (!done) { done = true; socket.destroy(); resolve(fail); } });
    socket.setTimeout(5000);
  });
}

// ── Profiles ──────────────────────────────────────────────────────────────────
function getProfilesPath() { return path.join(getGameDir(), 'profiles.json'); }

function loadProfiles() {
  try {
    const p = getProfilesPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) {}
  return { profiles: [], selected: '' };
}

function saveProfiles(data) {
  try {
    mkdirp(getGameDir());
    fs.writeFileSync(getProfilesPath(), JSON.stringify(data, null, 2));
  } catch (_) {}
}

// ── Forge installer ────────────────────────────────────────────────────────────
function runForgeInstaller(javaExe, installerPath, gameDir, onLog) {
  return new Promise((resolve, reject) => {
    const profiles = path.join(gameDir, 'launcher_profiles.json');
    if (!fs.existsSync(profiles)) {
      fs.writeFileSync(profiles, JSON.stringify({
        profiles: {}, clientToken: 'VartacraftLauncher',
        launcherVersion: { name: '2.2.2234', format: 21 },
      }, null, 2));
    }
    const proc = spawn(javaExe, ['-jar', installerPath, '--installClient', gameDir], { cwd: gameDir });
    proc.stdout?.on('data', d => onLog(d.toString()));
    proc.stderr?.on('data', d => onLog(d.toString()));
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Forge installer: code ${code}`)));
    proc.on('error', reject);
  });
}

// ── Mod list ───────────────────────────────────────────────────────────────────
async function fetchModList() {
  const html = await fetchText(`${MOD_URL}/`);
  return [...html.matchAll(/href="([^"/?][^"]*\.jar)"/gi)].map(m => ({
    name: decodeURIComponent(m[1].replace(/^.*\//, '')),
    url:  `${MOD_URL}/${m[1]}`,
  }));
}

// ── Assets ─────────────────────────────────────────────────────────────────────
async function downloadAssets(gameDir, send) {
  const manifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  const v = manifest.versions.find(v => v.id === '1.20.1');
  if (!v) throw new Error('1.20.1 introuvable dans le manifest Mojang');
  const vData = await fetchJson(v.url);
  const ai    = vData.assetIndex;
  const idxPath = path.join(gameDir, 'assets', 'indexes', `${ai.id}.json`);
  mkdirp(path.dirname(idxPath));
  if (!fs.existsSync(idxPath) || (await getFileSha1(idxPath)) !== ai.sha1) {
    send('Téléchargement index assets...');
    await downloadFile(ai.url, idxPath);
  }
  const objects = Object.values(JSON.parse(fs.readFileSync(idxPath)).objects);
  const missing = objects.filter(({ hash }) =>
    !fs.existsSync(path.join(gameDir, 'assets', 'objects', hash.slice(0, 2), hash))
  );
  if (!missing.length) { send('Assets à jour'); return; }
  send(`Assets: 0 / ${missing.length}`);
  let done = 0, idx = 0;
  async function worker() {
    while (idx < missing.length) {
      const { hash } = missing[idx++];
      const dest = path.join(gameDir, 'assets', 'objects', hash.slice(0, 2), hash);
      try { await downloadFile(`https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`, dest); } catch (_) {}
      done++;
      if (done % 150 === 0 || done === missing.length) send(`Assets: ${done} / ${missing.length}`);
    }
  }
  await Promise.all(Array.from({ length: 20 }, worker));
}

// ── Integrity manifest ─────────────────────────────────────────────────────────
async function buildManifest(gameDir, files) {
  const m = {};
  for (const rel of files) {
    const abs = path.join(gameDir, rel);
    if (fs.existsSync(abs)) m[rel] = await getFileSha1(abs);
  }
  fs.writeFileSync(path.join(gameDir, '.manifest.json'), JSON.stringify(m, null, 2));
}

async function verifyManifest(gameDir) {
  const mp = path.join(gameDir, '.manifest.json');
  if (!fs.existsSync(mp)) return false;
  const manifest = JSON.parse(fs.readFileSync(mp));
  for (const [rel, expected] of Object.entries(manifest)) {
    const abs = path.join(gameDir, rel);
    if (!fs.existsSync(abs) || (await getFileSha1(abs)) !== expected) return false;
  }
  return true;
}

// ── Version JSON (inheritsFrom) ────────────────────────────────────────────────
function mergeVersionJsons(parent, child) {
  const merged = { ...parent };
  for (const [key, val] of Object.entries(child)) {
    if (key === 'inheritsFrom') continue;
    if (key === 'libraries') {
      const map = new Map();
      for (const lib of parent.libraries || []) map.set(lib.name, lib);
      for (const lib of val         || []) map.set(lib.name, lib);
      merged.libraries = [...map.values()];
    } else if (key === 'arguments') {
      merged.arguments = {
        jvm:  [...(parent.arguments?.jvm  || []), ...(val?.jvm  || [])],
        game: [...(parent.arguments?.game || []), ...(val?.game || [])],
      };
    } else {
      merged[key] = val;
    }
  }
  return merged;
}

function loadVersionJson(gameDir, versionId) {
  const p = path.join(gameDir, 'versions', versionId, `${versionId}.json`);
  if (!fs.existsSync(p)) throw new Error(`Version JSON introuvable: ${versionId}`);
  const json = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (!json.inheritsFrom) return json;
  try {
    return mergeVersionJsons(loadVersionJson(gameDir, json.inheritsFrom), json);
  } catch (_) {
    return json;
  }
}

// ── Ensure libraries ───────────────────────────────────────────────────────────
function matchesRules(rules) {
  if (!rules || !rules.length) return true;
  let result = false;
  for (const rule of rules) {
    const osName  = rule.os?.name;
    const osMatch = !osName
      || (osName === 'windows' && process.platform === 'win32')
      || (osName === 'osx'     && process.platform === 'darwin')
      || (osName === 'linux'   && process.platform === 'linux');
    const noFeatures = !rule.features || !Object.keys(rule.features).length;
    if (rule.action === 'allow'    && osMatch && noFeatures) result = true;
    if (rule.action === 'disallow' && osMatch && noFeatures) result = false;
  }
  return result;
}

async function ensureAllLibraries(gameDir, send) {
  let vJson;
  try { vJson = loadVersionJson(gameDir, FORGE_VERSION_ID); } catch (_) { return; }
  const libs = (vJson.libraries || []).filter(l => matchesRules(l.rules || []));
  let missing = 0;
  for (const lib of libs) {
    const art = lib.downloads?.artifact;
    if (!art?.url || !art?.path) continue;
    const dest = path.join(gameDir, 'libraries', art.path);
    if (fs.existsSync(dest)) continue;
    missing++;
    send({ text: `Lib: ${path.basename(art.path)}`, pct: 55 });
    try { await downloadFile(art.url, dest); } catch (_) {}
  }
  if (missing) send({ text: `${missing} bibliothèque(s) récupérée(s)`, pct: 57 });
}

// ── Main install ───────────────────────────────────────────────────────────────
async function installAll(gameDir, send) {

  // 1. JDK 17
  const runtimeDir = path.join(gameDir, 'runtime');
  let javaExe = findJava(runtimeDir);
  if (!javaExe) {
    send({ text: 'Téléchargement de Java 17...', pct: 2 });
    const zipPath = path.join(gameDir, 'jdk17.zip');
    await downloadFile(`${MOD_URL}/jdk17.zip`, zipPath, p =>
      send({ text: `Java 17 : ${p}%`, pct: 2 + p * 0.18 })
    );
    send({ text: 'Extraction de Java 17...', pct: 20 });
    await extractZip(zipPath, runtimeDir);
    fs.unlinkSync(zipPath);
    javaExe = findJava(runtimeDir);
    if (!javaExe) throw new Error('java.exe introuvable après extraction du JDK');
    if (process.platform !== 'win32') fs.chmodSync(javaExe, '755');
  }

  // 2. Forge installer
  const forgeMarker = path.join(gameDir, 'libraries', 'net', 'minecraftforge', 'fmlloader', FORGE_BUILD, `fmlloader-${FORGE_BUILD}.jar`);
  if (!fs.existsSync(forgeMarker)) {
    send({ text: `Téléchargement de l'installeur Forge...`, pct: 22 });
    const installerPath = path.join(gameDir, 'forge-installer.jar');
    await downloadFile(FORGE_INSTALLER_URL, installerPath, p =>
      send({ text: `Installeur Forge : ${p}%`, pct: 22 + p * 0.1 })
    );
    send({ text: 'Installation de Forge (peut prendre quelques minutes)...', pct: 32 });
    await runForgeInstaller(javaExe, installerPath, gameDir, msg => {
      const line = msg.trim().split('\n').pop() || '';
      if (line) send({ text: line.slice(0, 90), pct: 45 });
    });
    if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
  }

  // 3. Vanilla 1.20.1.json (fournit -cp, args JVM)
  const vanillaJsonPath = path.join(gameDir, 'versions', '1.20.1', '1.20.1.json');
  if (!fs.existsSync(vanillaJsonPath)) {
    send({ text: 'Profil vanilla 1.20.1...', pct: 51 });
    mkdirp(path.dirname(vanillaJsonPath));
    try {
      const manifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      const v = manifest.versions.find(v => v.id === '1.20.1');
      if (v) await downloadFile(v.url, vanillaJsonPath);
    } catch (_) {}
  }

  // 4. Vérification des bibliothèques
  send({ text: 'Vérification des bibliothèques...', pct: 53 });
  await ensureAllLibraries(gameDir, send);

  // 5. Natives depuis le serveur
  const nativesDir = path.join(gameDir, 'natives');
  if (!fs.existsSync(nativesDir) || fs.readdirSync(nativesDir).filter(f => f.endsWith('.dll')).length === 0) {
    send({ text: 'Téléchargement des natifs...', pct: 62 });
    const nativesZip = path.join(gameDir, 'natives.zip');
    await downloadFile(`${MOD_URL}/natives.zip`, nativesZip, p =>
      send({ text: `Natifs : ${p}%`, pct: 62 + p * 0.03 })
    );
    send({ text: 'Extraction des natifs...', pct: 65 });
    await extractZip(nativesZip, nativesDir);
    fs.unlinkSync(nativesZip);
  }

  // 6. Mods — suppression des extras + mise à jour
  send({ text: 'Mise à jour des mods...', pct: 67 });
  const modsDir = path.join(gameDir, 'mods');
  mkdirp(modsDir);
  const modList = await fetchModList();
  const serverModNames = new Set(modList.map(m => m.name));
  fs.writeFileSync(path.join(gameDir, '.modlist.json'), JSON.stringify([...serverModNames]));

  for (const file of fs.readdirSync(modsDir)) {
    if (file.endsWith('.jar') && !serverModNames.has(file)) {
      try { fs.unlinkSync(path.join(modsDir, file)); } catch (_) {}
    }
  }

  let modsDone = 0;
  for (const mod of modList) {
    const localMod   = path.join(modsDir, mod.name);
    const serverSize = await getRemoteSize(mod.url);
    const localSize  = fs.existsSync(localMod) ? fs.statSync(localMod).size : 0;
    if (localSize !== serverSize || localSize === 0) {
      await downloadFile(mod.url, localMod, p =>
        send({ text: `Mod : ${mod.name} (${p}%)`, pct: 70 + (modsDone / Math.max(modList.length, 1)) * 16 })
      );
    }
    modsDone++;
    send({ text: `Mods : ${modsDone} / ${modList.length}`, pct: 70 + (modsDone / Math.max(modList.length, 1)) * 16 });
  }

  // 7. Assets
  send({ text: 'Vérification des assets...', pct: 86 });
  const officialAssets = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    '.minecraft', 'assets'
  );
  if (!fs.existsSync(officialAssets)) {
    await downloadAssets(gameDir, msg => send({ text: msg, pct: 90 }));
  }

  // 8. Nettoyage
  for (const f of ['forge-installer.jar.txt']) {
    const fp = path.join(gameDir, f);
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) {}
  }

  // 9. Manifest
  send({ text: 'Finalisation...', pct: 98 });
  await buildManifest(gameDir, modList.map(m => `mods/${m.name}`));
  send({ text: 'Prêt !', pct: 100 });
}

// ── Launch ─────────────────────────────────────────────────────────────────────
function generateOfflineUUID(username) {
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex');
  return [hash.slice(0,8), hash.slice(8,12), '3'+hash.slice(13,16),
    ((parseInt(hash.slice(16,18),16)&0x3f)|0x80).toString(16)+hash.slice(18,20), hash.slice(20,32)].join('-');
}

function resolveArgs(argList, vars) {
  const result = [];
  for (const arg of argList) {
    if (typeof arg === 'string') {
      result.push(arg.replace(/\$\{([^}]+)\}/g, (_, k) => vars[k] ?? ''));
    } else if (matchesRules(arg.rules || [])) {
      for (const v of arg.values || [])
        result.push(v.replace(/\$\{([^}]+)\}/g, (_, k) => vars[k] ?? ''));
    }
  }
  return result.filter(Boolean);
}

async function launchGame(username, ram) {
  const gameDir = getGameDir();
  const javaExe = findJava(path.join(gameDir, 'runtime'));
  if (!javaExe) throw new Error('Java introuvable dans le dossier runtime');

  const vJson = loadVersionJson(gameDir, FORGE_VERSION_ID);

  const libs = (vJson.libraries || [])
    .filter(l => matchesRules(l.rules || []) && (l.downloads?.artifact || l.artifact))
    .map(l => {
      const art = l.downloads?.artifact || l.artifact;
      const p   = art.path || '';
      return p.startsWith('libraries/') ? path.join(gameDir, p) : path.join(gameDir, 'libraries', p);
    });

  const mainJar = (() => {
    const forge = path.join(gameDir, 'versions', FORGE_VERSION_ID, `${FORGE_VERSION_ID}.jar`);
    if (fs.existsSync(forge)) return forge;
    return path.join(gameDir, 'versions', FORGE_VERSION_ID, `${FORGE_VERSION_ID}.jar`);
  })();

  const sep       = process.platform === 'win32' ? ';' : ':';
  const classpath = [...libs, mainJar].join(sep);

  const officialAssets = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    '.minecraft', 'assets'
  );
  const assetsRoot = fs.existsSync(officialAssets) ? officialAssets : path.join(gameDir, 'assets');

  const vars = {
    auth_player_name:    username,
    auth_uuid:           generateOfflineUUID(username),
    auth_access_token:   '0',
    user_type:           'legacy',
    version_name:        vJson.id || FORGE_VERSION_ID,
    game_directory:      gameDir,
    assets_root:         assetsRoot,
    assets_index_name:   vJson.assets || '5',
    version_type:        vJson.type   || 'modified',
    natives_directory:   path.join(gameDir, 'natives'),
    library_directory:   path.join(gameDir, 'libraries'),
    classpath_separator: sep,
    classpath,
    launcher_name:       'VartacraftLauncher',
    launcher_version:    '2.0.0',
    clientid:   '0',
    auth_xuid:  '0',
  };

  const jvmArgs  = [`-Xmx${ram}G`, `-Xms${Math.min(ram, 2)}G`, ...resolveArgs(vJson.arguments?.jvm  || [], vars)];
  const gameArgs = resolveArgs(vJson.arguments?.game || [], vars);

  if (!jvmArgs.some(a => a === '-cp' || a === '-classpath')) {
    jvmArgs.push('-cp', classpath);
  }

  let stderrLog = '';
  gameProcess = spawn(javaExe, [...jvmArgs, vJson.mainClass, ...gameArgs], { cwd: gameDir });
  gameProcess.stdout?.on('data', d => { const s = d.toString(); stderrLog += s; win?.webContents.send('game-log', s); });
  gameProcess.stderr?.on('data', d => { const s = d.toString(); stderrLog += s; win?.webContents.send('game-log', s); });

  cleanExtraMods(gameDir);
  win?.hide();
  createTray();
  setRPCActivity(`En jeu sur Vartacraft`, username);

  gameProcess.on('close', code => {
    gameProcess = null;
    destroyTray();
    win?.show();
    win?.focus();
    setRPCActivity('Au menu principal', null);
    win?.webContents.send('game-closed', { code });
    if (code === 0) return;

    const crashDir = path.join(gameDir, 'crash-reports');
    if (fs.existsSync(crashDir)) {
      const reports = fs.readdirSync(crashDir).filter(f => f.endsWith('.txt')).sort().reverse();
      if (reports.length > 0) {
        win?.webContents.send('crash-report', {
          file: reports[0],
          content: fs.readFileSync(path.join(crashDir, reports[0]), 'utf-8'),
        });
        return;
      }
    }
    if (stderrLog.trim()) {
      win?.webContents.send('crash-report', { file: `jvm-error-${code}.log`, content: stderrLog });
    }
  });
}

// ── Auto-update ────────────────────────────────────────────────────────────────
const UPDATE_URL = 'https://launcher.ouiweb.eu/launcher/version.json';

function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

async function checkForUpdates() {
  try {
    const data = await fetchJson(UPDATE_URL);
    if (!data?.version) return;
    const current = app.getVersion();
    if (!semverGt(data.version, current)) return;

    // Choisir l'URL selon la plateforme
    let url;
    if (process.platform === 'darwin') {
      url = data.url_mac || data.url;
    } else if (process.platform === 'linux') {
      url = data.url_linux || data.url;
    } else {
      url = data.url_win || data.url;
    }
    if (!url) return;

    win?.webContents.send('update-available', {
      current,
      latest: data.version,
      url,
      notes:  data.notes || '',
    });
  } catch (_) {}
}

ipcMain.handle('start-update', async (_, { url }) => {
  try {
    const ext      = url.endsWith('.exe') ? '.exe' : path.extname(url) || '.exe';
    const dest     = path.join(os.tmpdir(), `VartacraftLauncher-Update${ext}`);
    const total    = await getRemoteSize(url);
    let done = 0;
    await new Promise((resolve, reject) => {
      mkdirp(path.dirname(dest));
      const tmp  = dest + '.tmp';
      const file = fs.createWriteStream(tmp);
      const proto = url.startsWith('https') ? https : http;
      const req = proto.get(url, res => {
        if (res.statusCode !== 200) {
          file.close(); reject(new Error(`HTTP ${res.statusCode}`)); return;
        }
        res.on('data', chunk => {
          done += chunk.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          win?.webContents.send('update-progress', pct);
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => { fs.renameSync(tmp, dest); resolve(); }));
      });
      req.on('error', err => { file.close(); reject(err); });
      req.setTimeout(120000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
    win?.webContents.send('update-progress', 100);
    await new Promise(r => setTimeout(r, 500));
    shell.openPath(dest);
    setTimeout(() => app.quit(), 1000);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC ────────────────────────────────────────────────────────────────────────
ipcMain.handle('start-install', async () => {
  const gameDir = getGameDir();
  const ok = await verifyManifest(gameDir).catch(() => false);
  if (!ok && fs.existsSync(gameDir)) {
    win.webContents.send('install-status', { text: '⚠ Fichiers modifiés — réinstallation...', pct: 0 });
    const runtimeBackup = path.join(os.tmpdir(), 'vc_runtime_bak');
    const rt = path.join(gameDir, 'runtime');
    if (fs.existsSync(rt)) fs.renameSync(rt, runtimeBackup);
    fs.rmSync(gameDir, { recursive: true, force: true });
    mkdirp(gameDir);
    if (fs.existsSync(runtimeBackup)) fs.renameSync(runtimeBackup, rt);
  }
  mkdirp(gameDir);
  try {
    await installAll(gameDir, prog => win.webContents.send('install-status', prog));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('launch-game',    async (_, { username, ram }) => {
  try   { await launchGame(username, ram); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('get-game-dir',   () => getGameDir());
ipcMain.handle('ping-server',    () => pingMinecraftServer(SERVER_HOST, SERVER_PORT));
ipcMain.handle('get-profiles',   () => loadProfiles());
ipcMain.handle('save-profiles',  (_, data) => { saveProfiles(data); return true; });

ipcMain.on('open-game-dir',   () => shell.openPath(getGameDir()));
ipcMain.on('minimize-window', () => win?.minimize());
ipcMain.on('close-window',    () => { if (gameProcess) gameProcess.kill(); app.quit(); });
ipcMain.on('set-rpc',         (_, { details, state }) => setRPCActivity(details, state));
ipcMain.on('open-url',        (_, url) => shell.openExternal(url));

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

// ── Window ─────────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 960, height: 600,
    frame: false, resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#080810',
    show: false,
  });

  isDev ? win.loadURL('http://localhost:5173')
        : win.loadFile(path.join(__dirname, '../dist/index.html'));

  win.once('ready-to-show', () => { win.show(); checkForUpdates(); });
}

app.whenReady().then(() => {
  createWindow();
  initDiscordRPC();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });