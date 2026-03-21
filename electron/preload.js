'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  // Install
  installJdk:      ()        => ipcRenderer.invoke('install-jdk'),
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

  // JDK
  getJdkInfo:        ()    => ipcRenderer.invoke('get-jdk-info'),
  resetJdk:          ()    => ipcRenderer.invoke('reset-jdk'),
  chooseJdk:         ()    => ipcRenderer.invoke('choose-jdk'),
  clearJdkPath:      ()    => ipcRenderer.invoke('clear-jdk-path'),
  // News
  getNews:           ()    => ipcRenderer.invoke('get-news'),
  // Announcement
  getAnnouncement:   ()    => ipcRenderer.invoke('get-announcement'),
  // Packs (resource packs + shaders)
  getPacks:          (opts) => ipcRenderer.invoke('get-packs', opts),
  togglePack:        (opts) => ipcRenderer.invoke('toggle-pack', opts),
  deletePack:        (opts) => ipcRenderer.invoke('delete-pack', opts),
  importPack:        (opts) => ipcRenderer.invoke('import-pack', opts),
  openPackFolder:    (opts) => ipcRenderer.send('open-pack-folder', opts),
  // Screenshots
  getScreenshots:        ()        => ipcRenderer.invoke('get-screenshots'),
  readImageB64:          (opts)    => ipcRenderer.invoke('read-image-b64', opts),
  openScreenshot:        (fp)      => ipcRenderer.send('open-screenshot', fp),
  openScreenshotsFolder: ()        => ipcRenderer.send('open-screenshots-folder'),
  getIsLaunching:       ()      => ipcRenderer.invoke('get-is-launching'),
  repairInstall:        ()      => ipcRenderer.invoke('repair-install'),
  getLauncherConfig:    ()      => ipcRenderer.invoke('get-launcher-config'),
  updateLauncherConfig: (patch) => ipcRenderer.invoke('update-launcher-config', patch),
  getPlaytime:          ()      => ipcRenderer.invoke('get-playtime'),
  getSystemRam:         ()      => ipcRenderer.invoke('get-system-ram'),
  // Console window
  openConsoleWindow: ()    => ipcRenderer.invoke('open-console-window'),

  // Events — each returns a cleanup function to remove the listener
  onInstallStatus:   (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('install-status',   h); return () => ipcRenderer.removeListener('install-status',   h); },
  onGameLog:         (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('game-log',         h); return () => ipcRenderer.removeListener('game-log',         h); },
  onGameClosed:      (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('game-closed',      h); return () => ipcRenderer.removeListener('game-closed',      h); },
  onCrashReport:     (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('crash-report',     h); return () => ipcRenderer.removeListener('crash-report',     h); },
  onUpdateAvailable: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update-available', h); return () => ipcRenderer.removeListener('update-available', h); },
  onUpdateProgress:  (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update-progress',  h); return () => ipcRenderer.removeListener('update-progress',  h); },
  onPackProgress:    (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('pack-progress',    h); return () => ipcRenderer.removeListener('pack-progress',    h); },
  onCloseRequest:    (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('close-request',    h); return () => ipcRenderer.removeListener('close-request',    h); },
  confirmClose:      ()     => ipcRenderer.send('confirm-close'),
});