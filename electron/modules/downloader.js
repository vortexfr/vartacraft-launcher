'use strict';

const path   = require('path');
const fs     = require('fs');
const https  = require('https');
const http   = require('http');
const crypto = require('crypto');
const net    = require('net');
const sevenBin    = require('7zip-bin');
const { extractFull } = require('node-7z');

const { MOD_URL, mkdirp } = require('./paths');

// ── File hash ──────────────────────────────────────────────────────────────────
function getFileSha1(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const s = fs.createReadStream(filePath);
    s.on('data', d => hash.update(d));
    s.on('end',  () => resolve(hash.digest('hex')));
    s.on('error', reject);
  });
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────
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

module.exports = {
  getFileSha1,
  fetchText,
  fetchJson,
  getRemoteSize,
  downloadFile,
  extractZip,
  fetchModList,
  downloadAssets,
  pingMinecraftServer,
};