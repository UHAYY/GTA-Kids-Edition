// -------------------------------------------------------------
// Genera build/icon.ico dall'immagine build/icon-src.png.
// Usa Electron (nativeImage) per ridimensionare alle varie misure,
// poi assembla l'ICO a mano: intestazione + directory + PNG grezzi
// (formato PNG-in-ICO, supportato da Windows 10).
// Si lancia con: npx electron scripts/make-icon.js
// -------------------------------------------------------------
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'build', 'icon-src.png');
const OUT = path.join(ROOT, 'build', 'icon.ico');
const FAVICON = path.join(ROOT, 'game', 'icon.png');
const SIZES = [16, 32, 48, 64, 128, 256]; // le misure che Windows cerca

app.whenReady().then(() => {
  const img = nativeImage.createFromPath(SRC);
  if (img.isEmpty()) {
    console.error('Immagine sorgente non leggibile:', SRC);
    app.exit(1);
    return;
  }

  const pngs = SIZES.map(s => ({
    s,
    png: img.resize({ width: s, height: s, quality: 'best' }).toPNG()
  }));

  // intestazione ICO: riservato, tipo 1 (icona), numero di immagini
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  // directory: una voce da 16 byte per immagine
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + 16 * pngs.length;
  pngs.forEach((p, i) => {
    const e = dir.subarray(i * 16, i * 16 + 16);
    e.writeUInt8(p.s >= 256 ? 0 : p.s, 0); // 0 = 256
    e.writeUInt8(p.s >= 256 ? 0 : p.s, 1);
    e.writeUInt8(0, 2); // colori in tavolozza (0 = vero colore)
    e.writeUInt8(0, 3); // riservato
    e.writeUInt16LE(1, 4); // piano colore
    e.writeUInt16LE(32, 6); // bit per pixel
    e.writeUInt32LE(p.png.length, 8); // dimensione dei dati
    e.writeUInt32LE(offset, 12); // dove iniziano
    offset += p.png.length;
  });

  fs.writeFileSync(OUT, Buffer.concat([header, dir, ...pngs.map(p => p.png)]));
  console.log('ICO scritta:', OUT, fs.statSync(OUT).size, 'byte');

  // il PNG a 256 serve anche da favicon nella versione browser
  fs.writeFileSync(FAVICON, img.resize({ width: 256, height: 256, quality: 'best' }).toPNG());
  console.log('Favicon scritta:', FAVICON);

  app.quit();
});
