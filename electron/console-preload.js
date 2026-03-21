'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('consoleApi', {
  onGameLog: (cb) => ipcRenderer.on('game-log', (_, d) => cb(d)),
  onGameClosed: (cb) => ipcRenderer.on('game-closed', (_, d) => cb(d)),
});