'use strict';
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const viteScript   = path.resolve('./node_modules/vite/bin/vite.js');
const electronPath = require('./node_modules/electron');
const nodePath     = process.execPath;

console.log('[dev] node    :', nodePath);
console.log('[dev] electron:', electronPath);

// ── Start Vite ─────────────────────────────────────────────────
console.log('[dev] Starting Vite...');
const vite = spawn(nodePath, [viteScript], { stdio: 'inherit' });
vite.on('error', err => { console.error('[dev] Vite spawn error:', err.message); });

// ── Start Electron after a fixed delay (5s) ────────────────────
setTimeout(() => {
  console.log('[dev] Launching Electron...');
  const electron = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });

  electron.on('error', err => console.error('[dev] Electron error:', err.message));
  electron.on('close', code => {
    console.log('[dev] Electron closed (code', code, ') — stopping Vite...');
    vite.kill();
    process.exit(0);
  });
}, 5000);

process.on('SIGINT', () => { vite.kill(); process.exit(0); });