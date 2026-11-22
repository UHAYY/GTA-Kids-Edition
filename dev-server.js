// Mini web server per l'anteprima del gioco nel browser (solo sviluppo).
// Uso: node dev-server.js  ->  http://localhost:8080/game/index.html
// Supporta le richieste Range (necessarie per i video, es. per rivedere
// i gameplay registrati) e serve i file in streaming senza caricarli in RAM.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript',
  css: 'text/css',
  jpg: 'image/jpeg',
  png: 'image/png',
  fbx: 'application/octet-stream',
  glb: 'model/gltf-binary',
  json: 'application/json',
  mp4: 'video/mp4',
  mkv: 'video/x-matroska',
  webm: 'video/webm'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/game/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }

  const type = MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream';
  let stat;
  try { stat = fs.statSync(file); } catch { res.writeHead(404); res.end('not found'); return; }
  if (!stat.isFile()) { res.writeHead(404); res.end('not found'); return; }

  const range = req.headers.range;
  // niente cache: in sviluppo si vede sempre l'ultima versione dei file
  const HEADERS = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) { res.writeHead(416); res.end(); return; }
    let start = m[1] === '' ? 0 : +m[1];
    let end = m[2] === '' ? stat.size - 1 : Math.min(+m[2], stat.size - 1);
    if (m[1] === '' && m[2] !== '') { start = stat.size - +m[2]; end = stat.size - 1; } // suffisso "-N"
    if (start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(file).pipe(res);
  }
}).listen(8080, () => console.log('dev server: http://localhost:8080/game/index.html'));
