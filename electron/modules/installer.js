'use strict';

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const os     = require('os');
const { spawn } = require('child_process');

const { MOD_URL, FORGE_BUILD, FORGE_VERSION_ID, FORGE_INSTALLER_URL, mkdirp } = require('./paths');
const { getLauncherConfig }                                                      = require('./config');
const { downloadFile, extractZip, fetchJson, fetchModList, downloadAssets,
        getFileSha1, getRemoteSize }                                             = require('./downloader');

// ── Find Java ──────────────────────────────────────────────────────────────────
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

// ── Rules matching ─────────────────────────────────────────────────────────────
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

// ── Ensure libraries ───────────────────────────────────────────────────────────
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
  const assetIndexFile = path.join(officialAssets, 'indexes', '5.json');
  const mcDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '.minecraft');
  const assetTargetDir = fs.existsSync(mcDir) ? mcDir : gameDir;
  if (!fs.existsSync(officialAssets) || !fs.existsSync(assetIndexFile)) {
    await downloadAssets(assetTargetDir, msg => send({ text: msg, pct: 90 }));
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

// ── Launch args helpers ────────────────────────────────────────────────────────
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

// ── Build launch args (pure computation — no spawn) ───────────────────────────
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

  return { javaExe, jvmArgs, gameArgs, mainClass: vJson.mainClass };
}

module.exports = {
  findJava,
  cleanExtraMods,
  runForgeInstaller,
  buildManifest,
  verifyManifest,
  mergeVersionJsons,
  loadVersionJson,
  matchesRules,
  ensureAllLibraries,
  installAll,
  generateOfflineUUID,
  resolveArgs,
  buildLaunchArgs,
};