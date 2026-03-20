'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  // Install
  startInstall:    ()        => ipcRenderer.invoke('start-install'),
  // Game
  launch:          (opts)    => ipcRenderer.invoke('launch-game', opts),
  // Info
  getGameDir:      ()        => ipcRenderer.invoke('get-game-dir'),
  pingServer:      ()        => ipcRenderer.invoke('ping-server'),
  // Profiles
  getProfiles:     ()        => ipcRenderer.invoke('get-profiles'),
  saveProfiles:    (data)    => ipcRenderer.invoke('save-profiles', data),
  // Window
  openGameDir:     ()        => ipcRenderer.send('open-game-dir'),
  minimize:        ()        => ipcRenderer.send('minimize-window'),
  close:           ()        => ipcRenderer.send('close-window'),
  // Discord RPC
  setRPC:          (d, s)    => ipcRenderer.send('set-rpc', { details: d, state: s }),
  // External URL
  openUrl:         (url)     => ipcRenderer.send('open-url', url),

  // Update
  startUpdate:       (url) => ipcRenderer.invoke('start-update', { url }),

  // Events
  onInstallStatus:   (cb) => ipcRenderer.on('install-status',   (_, d) => cb(d)),
  onGameLog:         (cb) => ipcRenderer.on('game-log',         (_, d) => cb(d)),
  onGameClosed:      (cb) => ipcRenderer.on('game-closed',      (_, d) => cb(d)),
  onCrashReport:     (cb) => ipcRenderer.on('crash-report',     (_, d) => cb(d)),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, d) => cb(d)),
  onUpdateProgress:  (cb) => ipcRenderer.on('update-progress',  (_, d) => cb(d)),
});