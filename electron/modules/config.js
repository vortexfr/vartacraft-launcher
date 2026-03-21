'use strict';

const path = require('path');
const fs   = require('fs');

const { getGameDir, mkdirp } = require('./paths');

// ── Username validation ────────────────────────────────────────────────────────
function isValidUsername(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_]{1,16}$/.test(name.trim());
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

// ── Launcher config (custom JDK path, etc.) ────────────────────────────────────
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

module.exports = {
  isValidUsername,
  getProfilesPath,
  loadProfiles,
  saveProfiles,
  getLauncherConfig,
  saveLauncherConfig,
};