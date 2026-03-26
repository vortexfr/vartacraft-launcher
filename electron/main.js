'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } = require('electron');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const crypto  = require('crypto');
const https   = require('https');
const http    = require('http');
const net     = require('net');
const { spawn } = require('child_process');
const extractZipLib = require('extract-zip');

let DiscordRPC;
try { DiscordRPC = require('discord-rpc'); } catch (_) {}

const isDev = process.env.NODE_ENV === 'development';

// ── Constants ──────────────────────────────────────────────────────────────────
const MOD_URL             = 'https://launcher.ouiweb.eu/mod';
const FORGE_BUILD         = '1.20.1-47.4.13';
const FORGE_VERSION_ID    = '1.20.1-forge-47.4.13';
const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE_BUILD}/forge-${FORGE_BUILD}-installer.jar`;
const SERVER_HOST         = 'gm53-dc02.ouiheberg.com';
const SERVER_PORT         = 25632;
const DISCORD_CLIENT_ID   = '1458808505380376810';
const UPDATE_URL          = 'https://launcher.ouiweb.eu/launcher/version.json';
const PRESERVED           = ['profiles.json', 'launcher-config.json', 'auth.json', 'runtime', 'screenshots', 'resourcepacks', 'shaderpacks', 'config'];

// ── Paths ──────────────────────────────────────────────────────────────────────
function getGameDir() { return path.join(app.getPath('appData'), '.VartacraftGame'); }
function mkdirp(dir)  { fs.mkdirSync(dir, { recursive: true }); }

// ── Config ─────────────────────────────────────────────────────────────────────
function isValidUsername(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_]{1,16}$/.test(name.trim());
}

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

// ── Auth ───────────────────────────────────────────────────────────────────────
function getAuthPath() { return path.join(getGameDir(), 'auth.json'); }

function loadAuth() {
  try {
    const p = getAuthPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) {}
  return null;
}

function saveAuth(data) {
  try {
    mkdirp(getGameDir());
    fs.writeFileSync(getAuthPath(), JSON.stringify(data, null, 2));
  } catch (_) {}
}

function clearAuth() {
  try { fs.unlinkSync(getAuthPath()); } catch (_) {}
}

function getLauncherConfig() {
  try {
    const p = path.join(getGameDir(), 'launcher-config.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) {}
  return {};
}

function saveLauncherConfig(data) {
  try {
    mkdirp(getGameDir());
    fs.writeFileSync(path.join(getGameDir(), 'launcher-config.json'), JSON.stringify(data, null, 2));
  } catch (_) {}
}

// ── Downloader ─────────────────────────────────────────────────────────────────
function getFileSha1(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const s = fs.createReadStream(filePath);
    s.on('data', d => hash.update(d));
    s.on('end',  () => resolve(hash.digest('hex')));
    s.on('error', reject);
  });
}

function fetchText(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchText(res.headers.location, timeoutMs).then(resolve).catch(reject);
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout: ${url}`)));
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
      file.on('finish', () => file.close(() => { try { fs.renameSync(tmp, dest); resolve(); } catch (e) { reject(e); } }));
    });
    req.on('error', err => { file.close(); if (fs.existsSync(tmp)) fs.unlinkSync(tmp); reject(err); });
    req.setTimeout(120000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function extractZip(zipPath, destDir) {
  mkdirp(destDir);
  return extractZipLib(zipPath, { dir: destDir });
}

async function fetchModList() {
  const html = await fetchText(`${MOD_URL}/`);
  return [...html.matchAll(/href="([^"/?][^"]*\.jar)"/gi)].map(m => ({
    name: decodeURIComponent(m[1].replace(/^.*\//, '')),
    url:  `${MOD_URL}/${m[1]}`,
  }));
}

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

function writeVarInt(val) {
  const out = [];
  do {
    let b = val & 0x7F; val >>>= 7;
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
      const portBuf = Buffer.alloc(2); portBuf.writeUInt16BE(port);
      const payload = Buffer.concat([
        Buffer.from([0x00]), writeVarInt(765), writeVarInt(hostBuf.length),
        hostBuf, portBuf, Buffer.from([0x01]),
      ]);
      socket.write(Buffer.concat([writeVarInt(payload.length), payload]));
      socket.write(Buffer.from([0x01, 0x00]));
    });
    let buf = Buffer.alloc(0);
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      try {
        let off = 0, pktLen = 0, shift = 0;
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

// ── Installer ──────────────────────────────────────────────────────────────────
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
  try { return mergeVersionJsons(loadVersionJson(gameDir, json.inheritsFrom), json); }
  catch (_) { return json; }
}

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

async function installAll(gameDir, send) {
  // 1. JDK 17
  const runtimeDir = path.join(gameDir, 'runtime');
  const cfg = getLauncherConfig();
  let javaExe = (cfg.jdkPath && fs.existsSync(cfg.jdkPath)) ? cfg.jdkPath : findJava(runtimeDir);
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

  // 3. Vanilla 1.20.1.json
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

  // 4. Bibliothèques
  send({ text: 'Vérification des bibliothèques...', pct: 53 });
  await ensureAllLibraries(gameDir, send);

  // 5. Natives
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

  // 6. Mods
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
  try {
    for (const f of fs.readdirSync(gameDir)) {
      if (/^forge-installer.*\.(log|txt)$/i.test(f))
        try { fs.unlinkSync(path.join(gameDir, f)); } catch (_) {}
    }
  } catch (_) {}

  // 9. Manifest
  send({ text: 'Finalisation...', pct: 98 });
  await buildManifest(gameDir, modList.map(m => `mods/${m.name}`));
  send({ text: 'Prêt !', pct: 100 });
}

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

async function buildLaunchArgs(username, ram, gameDir) {
  const config  = getLauncherConfig();
  const javaExe = (config.jdkPath && fs.existsSync(config.jdkPath))
    ? config.jdkPath
    : findJava(path.join(gameDir, 'runtime'));
  if (!javaExe) throw new Error('Java introuvable — lancez le jeu une fois pour télécharger Java 17');

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

  const sep = process.platform === 'win32' ? ';' : ':';
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
    launcher_name:  'VartacraftLauncher',
    launcher_version:  '1.1.1',
    clientid:   '0',
    auth_xuid:  '0',
  };

  const jvmArgs  = [`-Xmx${ram}G`, `-Xms${Math.min(ram, 2)}G`, ...resolveArgs(vJson.arguments?.jvm  || [], vars)];
  const gameArgs = resolveArgs(vJson.arguments?.game || [], vars);
  if (!jvmArgs.some(a => a === '-cp' || a === '-classpath')) {
    jvmArgs.push('-cp', classpath);
  }
  return { javaExe, jvmArgs, gameArgs, mainClass: vJson.mainClass };
}

// ── Cleaner ────────────────────────────────────────────────────────────────────

function readDataFiles(gameDir) {
  const profilesBak = fs.existsSync(path.join(gameDir, 'profiles.json'))
    ? fs.readFileSync(path.join(gameDir, 'profiles.json'), 'utf-8') : null;
  const configBak = fs.existsSync(path.join(gameDir, 'launcher-config.json'))
    ? fs.readFileSync(path.join(gameDir, 'launcher-config.json'), 'utf-8') : null;
  return { profilesBak, configBak };
}

function writeDataFiles(gameDir, { profilesBak, configBak }) {
  if (profilesBak) fs.writeFileSync(path.join(gameDir, 'profiles.json'), profilesBak);
  if (configBak)   fs.writeFileSync(path.join(gameDir, 'launcher-config.json'), configBak);
}

function repairInstall(isLaunching) {
  if (isLaunching) return { success: false, error: 'Une installation est déjà en cours.' };
  try {
    const gameDir = getGameDir();
    if (!fs.existsSync(gameDir)) { mkdirp(gameDir); return { success: true }; }
    const bakDir = path.join(gameDir, '..', 'vc_repair_bak');
    if (fs.existsSync(bakDir)) fs.rmSync(bakDir, { recursive: true, force: true });
    mkdirp(bakDir);
    for (const item of PRESERVED) {
      const src = path.join(gameDir, item);
      if (fs.existsSync(src)) fs.renameSync(src, path.join(bakDir, item));
    }
    fs.rmSync(gameDir, { recursive: true, force: true });
    mkdirp(gameDir);
    for (const item of PRESERVED) {
      const src = path.join(bakDir, item);
      if (fs.existsSync(src)) fs.renameSync(src, path.join(gameDir, item));
    }
    fs.rmSync(bakDir, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Single instance ────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ── Global mutable state ───────────────────────────────────────────────────────
let win;
let tray          = null;
let consoleWin    = null;
let gameProcess   = null;
let isLaunching   = false;
let gameStartTime = null;
let rpc           = null;
let rpcReady      = false;

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
      { label: 'Quitter', click: () => { if (gameProcess) gameProcess.kill(); win?.removeAllListeners('close'); app.quit(); } },
    ]));
    tray.on('click', () => { win?.show(); win?.focus(); });
  } catch (_) {}
}

function destroyTray() {
  if (tray) { tray.destroy(); tray = null; }
}

// ── Discord RPC ────────────────────────────────────────────────────────────────
function initDiscordRPC() {
  if (!DiscordRPC) return;
  try {
    rpc = new DiscordRPC.Client({ transport: 'ipc' });
    rpc.on('ready', () => { rpcReady = true; setRPCActivity('Au menu principal', null); });
    rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(() => {});
  } catch (_) {}
}

function setRPCActivity(details, state) {
  if (!rpcReady || !rpc) return;
  try {
    const activity = { details, largeImageKey: 'logo', largeImageText: 'Vartacraft — Empire Faction', instance: false };
    if (state) activity.state = state;
    rpc.setActivity(activity).catch(() => {});
  } catch (_) {}
}

// ── Auto-update ────────────────────────────────────────────────────────────────
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
    let url;
    if (process.platform === 'darwin') {
      if (process.arch === 'arm64') 
        url = data.url_mac_arm || data.url_mac || data.url;
      else  
        url = data.url_mac_x64 || data.url_mac || data.url;
    } else if (process.platform === 'linux') 
       url = data.url_linux || data.url;
    else                                     
       url = data.url_win   || data.url;
    if (!url) return;
    win?.webContents.send('update-available', { current, latest: data.version, url, notes: data.notes || '' });
  } catch (_) {}
}

// ── IPC ────────────────────────────────────────────────────────────────────────
ipcMain.handle('start-update', async (_, { url }) => {
  try {
    const ext   = url.endsWith('.exe') ? '.exe' : path.extname(url) || '.exe';
    const dest  = path.join(os.tmpdir(), `VartacraftLauncher-Update${ext}`);
    const total = await getRemoteSize(url);
    let done = 0;
    await new Promise((resolve, reject) => {
      mkdirp(path.dirname(dest));
      const tmp  = dest + '.tmp';
      const file = fs.createWriteStream(tmp);
      const proto = url.startsWith('https') ? https : http;
      const req = proto.get(url, res => {
        if (res.statusCode !== 200) { file.close(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
        res.on('data', chunk => {
          done += chunk.length;
          win?.webContents.send('update-progress', total > 0 ? Math.round((done / total) * 100) : 0);
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => { try { fs.renameSync(tmp, dest); resolve(); } catch (e) { reject(e); } }));
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

ipcMain.handle('install-jdk', async () => {
  const gameDir    = getGameDir();
  const config     = getLauncherConfig();
  const runtimeDir = path.join(gameDir, 'runtime');
  let javaExe      = (config.jdkPath && fs.existsSync(config.jdkPath)) ? config.jdkPath : findJava(runtimeDir);
  if (javaExe) return { success: true, alreadyInstalled: true };
  mkdirp(gameDir);
  try {
    const zipPath = path.join(gameDir, 'jdk17.zip');
    win.webContents.send('install-status', { text: 'Téléchargement de Java 17...', pct: 2 });
    await downloadFile(`${MOD_URL}/jdk17.zip`, zipPath, p =>
      win.webContents.send('install-status', { text: `Java 17 : ${p}%`, pct: 2 + p * 0.85 })
    );
    win.webContents.send('install-status', { text: 'Extraction de Java 17...', pct: 90 });
    await extractZip(zipPath, runtimeDir);
    fs.unlinkSync(zipPath);
    javaExe = findJava(runtimeDir);
    if (!javaExe) throw new Error('java.exe introuvable après extraction');
    if (process.platform !== 'win32') fs.chmodSync(javaExe, '755');
    win.webContents.send('install-status', { text: 'Java 17 prêt !', pct: 100 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('start-install', async () => {
  const gameDir = getGameDir();
  const ok = await verifyManifest(gameDir).catch(() => false);
  if (!ok && fs.existsSync(gameDir)) {
    win.webContents.send('install-status', { text: '⚠ Fichiers modifiés — réinstallation...', pct: 0 });
    const dataFiles = readDataFiles(gameDir);
    for (const entry of fs.readdirSync(gameDir)) {
      if (entry === 'runtime') continue;
      fs.rmSync(path.join(gameDir, entry), { recursive: true, force: true });
    }
    writeDataFiles(gameDir, dataFiles);
  }
  mkdirp(gameDir);
  try {
    await installAll(gameDir, prog => win.webContents.send('install-status', prog));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-is-launching',     () => isLaunching);
ipcMain.handle('get-launcher-config',  () => getLauncherConfig());
ipcMain.handle('update-launcher-config', (_, patch) => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return false;
  const cfg = getLauncherConfig();
  saveLauncherConfig({ ...cfg, ...patch });
  return true;
});
ipcMain.handle('get-playtime', () => {
  const c = getLauncherConfig();
  return {
    totalSeconds:       c.totalPlaySeconds   || 0,
    lastSessionSeconds: c.lastSessionSeconds || 0,
    sessionCount:       c.sessionCount       || 0,
    lastPlayed:         c.lastPlayed         || null,
  };
});
ipcMain.handle('get-system-ram', () => {
  const totalBytes = os.totalmem();
  return { totalGb: Math.round((totalBytes / (1024 ** 3)) * 10) / 10 };
});

ipcMain.handle('launch-game', async (_, { username, ram }) => {
  if (!isValidUsername(username)) return { success: false, error: 'Pseudo invalide (1-16 caractères, lettres/chiffres/_).' };
  if (typeof ram !== 'number' || ram < 1 || ram > 64) return { success: false, error: 'RAM invalide.' };
  if (isLaunching) return { success: false, error: 'Une installation est déjà en cours — veuillez patienter.' };
  // Vérification du ban avant lancement
  try {
    const banCheck = await fetchJson(`https://vartacraft.fr/api/check-ban?pseudo=${encodeURIComponent(username)}`);
    if (banCheck?.banned) return { success: false, error: banCheck.error || 'Ton compte est banni.' };
  } catch (_) { return { success: false, error: 'Impossible de contacter le serveur. Vérifie ta connexion.' }; }
  isLaunching = true;
  try {
    const gameDir = getGameDir();
    const manifestExists = fs.existsSync(path.join(gameDir, '.manifest.json'));
    const ok = !manifestExists || await verifyManifest(gameDir).catch(() => false);
    if (!ok && fs.existsSync(gameDir)) {
      win.webContents.send('install-status', { text: '⚠ Fichiers modifiés — réinstallation...', pct: 0 });
      const dataFiles = readDataFiles(gameDir);
      for (const entry of fs.readdirSync(gameDir)) {
        if (entry === 'runtime') continue;
        fs.rmSync(path.join(gameDir, entry), { recursive: true, force: true });
      }
      writeDataFiles(gameDir, dataFiles);
    }
    mkdirp(gameDir);
    await installAll(gameDir, prog => win.webContents.send('install-status', prog));

    const { javaExe, jvmArgs, gameArgs, mainClass } = await buildLaunchArgs(username, ram, gameDir);
    const cfg = getLauncherConfig();
    if (cfg.fullscreen) gameArgs.push('--fullscreen');
    let stderrLog = '';
    gameStartTime = Date.now();
    gameProcess = spawn(javaExe, [...jvmArgs, mainClass, ...gameArgs], { cwd: gameDir });
    const fwdLog = s => {
      win?.webContents.send('game-log', s);
      if (consoleWin && !consoleWin.isDestroyed()) consoleWin.webContents.send('game-log', s);
    };
    gameProcess.stdout?.on('data', d => { const s = d.toString(); stderrLog += s; fwdLog(s); });
    gameProcess.stderr?.on('data', d => { const s = d.toString(); stderrLog += s; fwdLog(s); });

    cleanExtraMods(gameDir);
    if (cfg.autoMinimize !== false) { win?.hide(); createTray(); }
    setRPCActivity(`En jeu sur Vartacraft`, username);

    gameProcess.on('close', code => {
      gameProcess = null;
      destroyTray();
      win?.show(); win?.focus();
      setRPCActivity('Au menu principal', null);
      const sessionSeconds = gameStartTime ? Math.round((Date.now() - gameStartTime) / 1000) : 0;
      gameStartTime = null;
      try {
        const c = getLauncherConfig();
        c.totalPlaySeconds   = (c.totalPlaySeconds   || 0) + sessionSeconds;
        c.sessionCount       = (c.sessionCount       || 0) + 1;
        c.lastSessionSeconds = sessionSeconds;
        c.lastPlayed         = new Date().toISOString();
        saveLauncherConfig(c);
      } catch (_) {}
      win?.webContents.send('game-closed', { code, sessionSeconds });
      if (consoleWin && !consoleWin.isDestroyed()) consoleWin.webContents.send('game-closed', { code });
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
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    isLaunching = false;
  }
});

ipcMain.handle('get-game-dir',   () => getGameDir());
ipcMain.handle('ping-server',    () => pingMinecraftServer(SERVER_HOST, SERVER_PORT));
ipcMain.handle('get-profiles',   () => loadProfiles());
ipcMain.handle('save-profiles',  (_, data) => { saveProfiles(data); return true; });

// ── Auth IPC ───────────────────────────────────────────────────────────────────
ipcMain.handle('get-auth', () => loadAuth());
ipcMain.handle('launcher-logout', () => { clearAuth(); return true; });

ipcMain.handle('launcher-login', async (_, { pseudo, password }) => {
  return new Promise((resolve) => {
    const body = `pseudo=${encodeURIComponent(pseudo)}&password=${encodeURIComponent(password)}`;
    const req = https.request({
      hostname: 'vartacraft.fr',
      path: '/api/launcher-auth',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.success) saveAuth({ pseudo: json.pseudo, grade: json.grade });
          resolve(json);
        } catch (_) {
          resolve({ success: false, error: 'Réponse invalide du serveur.' });
        }
      });
    });
    req.on('error', () => resolve({ success: false, error: 'Impossible de contacter le serveur.' }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ success: false, error: 'Délai dépassé.' }); });
    req.write(body);
    req.end();
  });
});

ipcMain.handle('get-jdk-info', async () => {
  const gameDir = getGameDir();
  const config  = getLauncherConfig();
  const custom  = config.jdkPath && fs.existsSync(config.jdkPath) ? config.jdkPath : null;
  const bundled = findJava(path.join(gameDir, 'runtime'));
  const javaExe = custom || bundled;
  if (!javaExe) return { installed: false };
  try {
    const version = await new Promise(resolve => {
      const proc = spawn(javaExe, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      proc.stderr?.on('data', d => out += d.toString());
      proc.stdout?.on('data', d => out += d.toString());
      proc.on('close', () => resolve(out.split('\n')[0].trim()));
      proc.on('error', () => resolve('Inconnu'));
    });
    return { installed: true, version, path: javaExe, custom: !!custom };
  } catch (_) {
    return { installed: true, version: 'Inconnu', path: javaExe, custom: !!custom };
  }
});

ipcMain.handle('repair-install', async () => repairInstall(isLaunching));

ipcMain.handle('reset-jdk', async () => {
  try {
    const runtimeDir = path.join(getGameDir(), 'runtime');
    if (fs.existsSync(runtimeDir)) fs.rmSync(runtimeDir, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('choose-jdk', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Sélectionner le dossier JDK',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const javaExe = findJava(result.filePaths[0]);
  if (!javaExe) return { error: 'java.exe introuvable dans ce dossier — sélectionnez un dossier JDK valide.' };
  const config = getLauncherConfig();
  config.jdkPath = javaExe;
  saveLauncherConfig(config);
  return { path: javaExe };
});

ipcMain.handle('clear-jdk-path', async () => {
  const config = getLauncherConfig();
  delete config.jdkPath;
  saveLauncherConfig(config);
  return { success: true };
});

ipcMain.handle('get-news', async () => {
  try {
    const res = await fetchJson('https://vartacraft.fr/api/launcher-news.php?limit=50');
    return { success: res.success !== false, data: res.data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-console-window', () => {
  if (consoleWin && !consoleWin.isDestroyed()) { consoleWin.focus(); return; }
  consoleWin = new BrowserWindow({
    width: 860, height: 520,
    title: 'Console Java — Vartacraft',
    autoHideMenuBar: true,
    backgroundColor: '#040604',
    webPreferences: {
      preload: path.join(__dirname, 'console-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  consoleWin.loadFile(path.join(__dirname, 'console.html'));
  consoleWin.on('closed', () => { consoleWin = null; });
});

ipcMain.handle('get-announcement', async () => {
  try {
    const data  = await fetchJson('https://launcher.ouiweb.eu/launcher/news.json');
    const items = Array.isArray(data) ? data : (data.items || data.news || []);
    return items.find(i => i.urgent === true || i.type === 'urgent') || null;
  } catch (_) { return null; }
});

// ── Packs (resource packs + shaders) ──────────────────────────────────────────
ipcMain.handle('get-packs', async (_, { type }) => {
  const gameDir = getGameDir();
  const folder  = type === 'shader' ? 'shaderpacks' : 'resourcepacks';
  const packDir = path.join(gameDir, folder);
  mkdirp(packDir);
  const url = type === 'shader'
    ? 'https://launcher.ouiweb.eu/launcher/shaders-pack/'
    : 'https://launcher.ouiweb.eu/launcher/resource-pack/';
  let official = [];
  try {
    const raw    = await fetchText(url + 'manifest.json');
    const parsed = JSON.parse(raw);
    official = Array.isArray(parsed) ? parsed : (parsed.packs || []);
  } catch (_) {
    try {
      const html = await fetchText(url);
      const re   = /href="([^"?#]+\.zip)"/gi;
      let m;
      while ((m = re.exec(html)) !== null) {
        const encoded  = m[1];
        const filename = decodeURIComponent(encoded);
        official.push({
          name: filename.replace(/\.zip$/i, '').replace(/[_-]+/g, ' ').trim(),
          filename,
          url:  url + encoded,
        });
      }
    } catch (_) {}
  }
  const localFiles    = fs.readdirSync(packDir).filter(f => /\.zip$/i.test(f));
  const officialNames = new Set(official.map(p => p.filename));
  return {
    official:  official.map(p => ({ ...p, installed: localFiles.includes(p.filename) })),
    userFiles: localFiles.filter(f => !officialNames.has(f)),
    packDir,
  };
});

ipcMain.handle('toggle-pack', async (_, { type, pack }) => {
  const gameDir = getGameDir();
  const folder  = type === 'shader' ? 'shaderpacks' : 'resourcepacks';
  const dest    = path.join(gameDir, folder, pack.filename);
  if (fs.existsSync(dest)) { fs.unlinkSync(dest); return { installed: false }; }
  try {
    await downloadFile(pack.url, dest, pct =>
      win.webContents.send('pack-progress', { filename: pack.filename, pct })
    );
    return { installed: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('delete-pack', async (_, { type, filename }) => {
  try {
    const fp = path.join(getGameDir(), type === 'shader' ? 'shaderpacks' : 'resourcepacks', filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('import-pack', async (_, { type }) => {
  const folder  = type === 'shader' ? 'shaderpacks' : 'resourcepacks';
  const packDir = path.join(getGameDir(), folder);
  mkdirp(packDir);
  const result = await dialog.showOpenDialog(win, {
    title:      type === 'shader' ? 'Importer un shader' : 'Importer un resource pack',
    filters:    [{ name: 'Pack (.zip)', extensions: ['zip'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const imported = [];
  for (const src of result.filePaths) {
    const name = path.basename(src);
    fs.copyFileSync(src, path.join(packDir, name));
    imported.push(name);
  }
  return { success: true, imported };
});

ipcMain.on('open-pack-folder', (_, { type }) => {
  const folder = type === 'shader' ? 'shaderpacks' : 'resourcepacks';
  const dir    = path.join(getGameDir(), folder);
  mkdirp(dir);
  shell.openPath(dir);
});

// ── Screenshots ────────────────────────────────────────────────────────────────
ipcMain.handle('get-screenshots', async () => {
  const dir = path.join(getGameDir(), 'screenshots');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
    .map(f => {
      const fp = path.join(dir, f);
      return { name: f, path: fp, mtime: fs.statSync(fp).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
});

ipcMain.handle('read-image-b64', (_, { filePath }) => {
  try {
    const buf  = fs.readFileSync(filePath);
    const ext  = path.extname(filePath).slice(1).toLowerCase();
    const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (_) { return null; }
});

ipcMain.on('open-screenshots-folder', () => {
  const dir = path.join(getGameDir(), 'screenshots');
  mkdirp(dir);
  shell.openPath(dir);
});

ipcMain.on('open-screenshot',  (_, filePath) => shell.openPath(filePath));
ipcMain.on('open-game-dir',    () => shell.openPath(getGameDir()));
ipcMain.on('minimize-window',  () => win?.minimize());
ipcMain.on('close-window',     () => { win?.webContents.send('close-request'); });
ipcMain.on('confirm-close',    () => { if (gameProcess) gameProcess.kill(); win?.removeAllListeners('close'); app.quit(); });
ipcMain.on('set-rpc',          (_, { details, state }) => setRPCActivity(details, state));
ipcMain.on('open-url',         (_, url) => shell.openExternal(url));

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
  win.on('close', (e) => {
    e.preventDefault();
    win.webContents.send('close-request');
  });
  win.once('ready-to-show', () => { win.show(); checkForUpdates(); });
}

app.whenReady().then(() => {
  createWindow();
  initDiscordRPC();
});
app.on('before-quit', () => {
  win?.removeAllListeners('close');
  if (gameProcess) { try { gameProcess.kill(); } catch (_) {} gameProcess = null; }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });