// Rapine: banca, gioielleria e supermarket. Ogni negozio ha una porta dove
// si preme E per rapinarlo (serve il sangue freddo: restare fermi 4 secondi).
// (I nascondigli "P" ora sono i garage sotterranei, vedi garage.js.)
import * as THREE from 'three';
import { tn } from './i18n.js';
import { MINI_TOWNS, MOUNT_ROADS, terrainHeight } from './city.js';

const SIGN_NAMES = ['🏦 BANCA', '💎 GIOIELLERIA', '🛒 SUPERMARKET'].map(n => tn(n));

function makeSign (text, bg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 12);
  g.fillRect(0, 116, 512, 12);
  g.fillStyle = '#222222';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 54;
  do {
    g.font = `bold ${size}px "Comic Sans MS", "Chalkboard SE", sans-serif`;
    size -= 4;
  } while (g.measureText(text).width > 470 && size > 26);
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: tex });
}

export function createHeists (scene, colliders) {
  const spots = [];

  // costruisce un negozio rapinabile: fabbricato, insegna, porta e punto rapina
  // opts: { y } quota del pavimento (i paesini sono sulle terrazze in quota),
  // { w, d } misure del fabbricato, { small } insegna ridotta
  function addSpot (icon, name, bx, bz, faceDir, stars, reward, color, h, opts = {}) {
    const w = opts.w || 16, d = opts.d || 12;
    const y = opts.y || 0;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    );
    body.position.set(bx, y + h / 2, bz);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
      new THREE.MeshLambertMaterial({ color: 0x5b636b })
    );
    roof.position.set(bx, y + h + 0.25, bz);
    roof.castShadow = true;
    scene.add(roof);

    // porta sul lato che guarda il centro della città
    const dx = faceDir.x, dz = faceDir.z; // (±1, 0) o (0, ±1)
    const doorX = bx + dx * (w / 2 - 0.1);
    const doorZ = bz + dz * (d / 2 - 0.1);
    const horiz = dx !== 0;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? 0.14 : 2.2, 2.8, horiz ? 2.2 : 0.14),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    door.position.set(doorX, y + 1.4, doorZ);
    scene.add(door);

    // insegna grande sopra la porta (piccola sui negozi piccoli)
    const sw = opts.small ? 6 : 9, sh = opts.small ? 1.5 : 2.2;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sh),
      makeSign(icon + ' ' + name, '#ffffff')
    );
    sign.position.set(
      doorX + dx * (opts.small ? 0.35 : 0.1),
      y + (opts.small ? h + 0.3 : Math.min(4.6, h - 1.1)),
      doorZ + dz * (opts.small ? 0.35 : 0.1)
    );
    sign.rotation.y = horiz ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
    scene.add(sign);

    colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });

    // punto dove fermarsi a rapinare (davanti alla porta)
    spots.push({
      icon, name,
      x: doorX + dx * 2.4,
      z: doorZ + dz * 2.4,
      stars, reward
    });
  }

  // banche, gioiellerie e supermarket: stelle e bottino crescono col rischio
  // (bottini realistici: la cassa di un super, i gioielli, la banca)
  // I negozi stanno al centro dei loro isolotti (i blocchi sono a
  // -161 + 46·i, vedi i SKIP di main.js che li riserva).
  addSpot('🏦', 'BANCA', 69, 69, { x: -1, z: 0 }, 3, 50000, 0xcfd8dc, 9);
  addSpot('💎', 'GIOIELLERIA', -69, 69, { x: 1, z: 0 }, 2, 15000, 0xe1bee7, 7);
  addSpot('🛒', 'SUPERMARKET', 115, -69, { x: -1, z: 0 }, 1, 2500, 0xffcc80, 6);
  // seconda fila di negozi, sparsi per la città
  addSpot('🏦', 'BANCA', -115, -115, { x: 1, z: 0 }, 3, 50000, 0xcfd8dc, 9);
  addSpot('🏦', 'BANCA', 115, 115, { x: -1, z: 0 }, 3, 50000, 0xcfd8dc, 9);
  addSpot('💎', 'GIOIELLERIA', 115, -23, { x: -1, z: 0 }, 2, 15000, 0xe1bee7, 7);
  addSpot('💎', 'GIOIELLERIA', -115, 23, { x: 1, z: 0 }, 2, 15000, 0xe1bee7, 7);
  addSpot('🛒', 'SUPERMARKET', -23, -115, { x: 0, z: 1 }, 1, 2500, 0xffcc80, 6);
  addSpot('🛒', 'SUPERMARKET', 23, 115, { x: 0, z: -1 }, 1, 2500, 0xffcc80, 6);
  // terza fila: un altro di ogni tipo, sparsi ai bordi della città
  addSpot('🏦', 'BANCA', 69, -115, { x: -1, z: 0 }, 3, 50000, 0xcfd8dc, 9);
  addSpot('💎', 'GIOIELLERIA', -69, -23, { x: 1, z: 0 }, 2, 15000, 0xe1bee7, 7);
  addSpot('🛒', 'SUPERMARKET', -23, 69, { x: 0, z: -1 }, 1, 2500, 0xffcc80, 6);

  // i tre paesini di montagna hanno il loro mini-supermarket: piccolo, sulla
  // terrazza in quota, con la porta verso il centro del paese. Il posticino
  // di nota è quello della casetta riservata in city.js (angolo interno
  // sud-ovest); se non andesse bene si ripiega sugli angoli della terrazza
  const faceToward = (town, bx, bz) => {
    const ddx = town.x - bx, ddz = town.z - bz;
    return Math.abs(ddx) > Math.abs(ddz)
      ? { x: Math.sign(ddx) || 1, z: 0 }
      : { x: 0, z: Math.sign(ddz) || 1 };
  };
  MINI_TOWNS.forEach((town, ti) => {
    const w = 8, d = 6, hh = 3.5;
    const road = MOUNT_ROADS[ti]; // la strada che sale a questo paese
    const away = Math.atan2(town.z, town.x); // direzione "verso fuori"
    // il posticino riservato + i quattro angoli diagonali come riserva
    const posti = [[town.x - town.r * 0.32, town.z - town.r * 0.62]];
    [45, 135, 225, 315]
      .map(deg => deg * Math.PI / 180)
      .sort((a, b) =>
        Math.abs(Math.atan2(Math.sin(a - away), Math.cos(a - away))) -
        Math.abs(Math.atan2(Math.sin(b - away), Math.cos(b - away))))
      .forEach(a => posti.push([town.x + Math.cos(a) * town.r * 0.9, town.z + Math.sin(a) * town.r * 0.9]));
    for (const [bx, bz] of posti) {
      // sulle strade a croce (8 m di asfalto) non si costruisce
      if (Math.abs(bx - town.x) < 4 + w / 2 || Math.abs(bz - town.z) < 4 + d / 2) continue;
      // e nemmeno sull'asfalto della strada di montagna
      let onRoad = false;
      for (let s = 0; s < road.xs.length; s++) {
        if (Math.hypot(road.xs[s] - bx, road.zs[s] - bz) < 9) { onRoad = true; break; }
      }
      if (onRoad) continue;
      // niente soprelevazioni sulle casette esistenti
      const minX = bx - w / 2, maxX = bx + w / 2;
      const minZ = bz - d / 2, maxZ = bz + d / 2;
      if (colliders.some(c => minX < c.maxX && maxX > c.minX && minZ < c.maxZ && maxZ > c.minZ)) continue;
      // e il terreno sotto il fabbricato non deve fare salti brutti: il
      // negozio si appoggia al punto più basso (mai sospeso nel vuoto,
      // qualche angolo si interra un poco e amen)
      const angoli = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
      const quote = angoli.map(([ox, oz]) => terrainHeight(bx + ox, bz + oz) - town.h);
      const minQ = Math.min(...quote);
      if (minQ < -1.5 || Math.max(...quote) - minQ > 2.5) continue;
      addSpot('🛒', 'SUPERMARKET', bx, bz, faceToward(town, bx, bz), 1, 2500, 0xffcc80, hh,
        { y: town.h + minQ, w, d, small: true });
      break;
    }
  });

  return { spots };
}
