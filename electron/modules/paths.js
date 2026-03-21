'use strict';

const path = require('path');
const fs   = require('fs');

// ── Constants ──────────────────────────────────────────────────────────────────
const MOD_URL             = 'https://launcher.ouiweb.eu/mod';
const FORGE_BUILD         = '1.20.1-47.4.13';
const FORGE_VERSION_ID    = '1.20.1-forge-47.4.13';
const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE_BUILD}/forge-${FORGE_BUILD}-installer.jar`;
const SERVER_HOST         = 'gm53-dc02.ouiheberg.com';
const SERVER_PORT         = 25632;
const DISCORD_CLIENT_ID   = '1458808505380376810';

// ── Utilities ──────────────────────────────────────────────────────────────────
function getGameDir() {
  const { app } = require('electron');
  return path.join(app.getPath('appData'), '.VartacraftGame');
}
function mkdirp(dir)  { fs.mkdirSync(dir, { recursive: true }); }

module.exports = {
  MOD_URL,
  FORGE_BUILD,
  FORGE_VERSION_ID,
  FORGE_INSTALLER_URL,
  SERVER_HOST,
  SERVER_PORT,
  DISCORD_CLIENT_ID,
  getGameDir,
  mkdirp,
};