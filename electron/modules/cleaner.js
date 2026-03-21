'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');

const { getGameDir, mkdirp } = require('./paths');

// ── Preserved items ────────────────────────────────────────────────────────────
const PRESERVED = ['profiles.json', 'launcher-config.json', 'runtime', 'screenshots', 'resourcepacks', 'shaderpacks', 'config'];

// ── Runtime backup/restore ─────────────────────────────────────────────────────
function backupRuntime(gameDir) {
  const runtimeBak = path.join(os.tmpdir(), 'vc_runtime_bak');
  const rt = path.join(gameDir, 'runtime');
  if (fs.existsSync(rt)) fs.renameSync(rt, runtimeBak);
  return { runtimeBak, rt };
}

function restoreRuntime({ runtimeBak, rt }) {
  if (fs.existsSync(runtimeBak)) fs.renameSync(runtimeBak, rt);
}

// ── Data file backup/restore ───────────────────────────────────────────────────
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

// ── Full repair logic ──────────────────────────────────────────────────────────
function repairInstall(isLaunching) {
  if (isLaunching) return { success: false, error: 'Une installation est déjà en cours.' };
  try {
    const gameDir = getGameDir();
    if (!fs.existsSync(gameDir)) { mkdirp(gameDir); return { success: true }; }

    // Use a sibling folder on the same drive → renameSync is instant
    const bakDir = path.join(gameDir, '..', 'vc_repair_bak');
    if (fs.existsSync(bakDir)) fs.rmSync(bakDir, { recursive: true, force: true });
    mkdirp(bakDir);

    for (const item of PRESERVED) {
      const src = path.join(gameDir, item);
      if (fs.existsSync(src)) fs.renameSync(src, path.join(bakDir, item));
    }

    fs.rmSync(gameDir, { recursive: true, force: true });
    mkdirp(gameDir);

    // Restore preserved items
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

module.exports = {
  PRESERVED,
  backupRuntime,
  restoreRuntime,
  readDataFiles,
  writeDataFiles,
  repairInstall,
};