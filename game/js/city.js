// Costruzione della città: griglia di strade, isolotti con edifici colorati,
// parchi, alberi, lampioni e nuvole. Esporta anche la logica delle collisioni.
import * as THREE from 'three';
import { tn } from './i18n.js';

export const CELL = 46;   // isolotto + strada
export const ROAD = 12;   // larghezza strada
export const BLOCK = 34;  // lato isolotto
export const GRID = 8;    // isolotti per lato (città grande!)

export const CITY_SIZE = GRID * CELL + ROAD; // c'è strada anche sul bordo
const HALF = CITY_SIZE / 2;

const BUILDING_COLORS = ['#f6b26b', '#a2c4c9', '#d5a6bd', '#b6d7a8', '#ffe599', '#9fc5e8', '#f4cccc', '#c9a7eb'];

// Texture con finestre generata al volo su una canvas
function makeBuildingTexture (baseColor) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      g.fillStyle = Math.random() < 0.25 ? '#fff3b0' : '#bfdff5';
      g.fillRect(6 + x * 15, 8 + y * 15, 9, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildCity (scene, skipBlocks = new Set(), groundHoles = []) {
  const colliders = []; // { minX, maxX, minZ, maxZ }
  const pois = [];      // punti dove nascono missioni e monete

  // prato di base (con i buchi dove stanno gli ingressi dei garage
  // sotterranei: così dalla strada si vede la discesa)
  const G = (CITY_SIZE + 160) / 2;
  const groundShape = new THREE.Shape();
  groundShape.moveTo(-G, -G);
  groundShape.lineTo(G, -G);
  groundShape.lineTo(G, G);
  groundShape.lineTo(-G, G);
  groundShape.closePath();
  for (const h of groundHoles) {
    // in coordinate della forma la z del mondo è -y (il prato è un piano
    // ruotato di -90° sull'asse x); i buchi girano in senso opposto
    const y0 = -h.maxZ, y1 = -h.minZ;
    const hole = new THREE.Path();
    hole.moveTo(h.minX, y0);
    hole.lineTo(h.minX, y1);
    hole.lineTo(h.maxX, y1);
    hole.lineTo(h.maxX, y0);
    hole.closePath();
    groundShape.holes.push(hole);
  }
  const ground = new THREE.Mesh(
    new THREE.ShapeGeometry(groundShape),
    new THREE.MeshLambertMaterial({ color: 0x8fce7a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xd7dde2 });
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x5f6a72 });

  // ---------- mare e spiaggia intorno alla città ----------
  const BEACH = 26;      // larghezza della spiaggia di sabbia
  const seaEdge = HALF + BEACH;

  // anello di sabbia: un quadrato grande con un buco quadrato al centro (la città)
  const ring = new THREE.Shape();
  ring.moveTo(-seaEdge - 60, -seaEdge - 60);
  ring.lineTo(seaEdge + 60, -seaEdge - 60);
  ring.lineTo(seaEdge + 60, seaEdge + 60);
  ring.lineTo(-seaEdge - 60, seaEdge + 60);
  const hole = new THREE.Path();
  hole.moveTo(-HALF, -HALF);
  hole.lineTo(HALF, -HALF);
  hole.lineTo(HALF, HALF);
  hole.lineTo(-HALF, HALF);
  ring.holes.push(hole);
  const sand = new THREE.Mesh(
    new THREE.ShapeGeometry(ring),
    new THREE.MeshLambertMaterial({ color: 0xede2ae })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.015;
  sand.receiveShadow = true;
  scene.add(sand);

  // ombrelloni e asciugamani sulla spiaggia (tutti guardano il mare)
  const UMB_COLORS = ['#e53935', '#fdd835', '#ec407a', '#29b6f6', '#ff9800'];
  const poleMatB = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
  for (let u = 0; u < 18; u++) {
    // punto a caso sull'anello di sabbia, lontano dal bordo strada
    const side = Math.floor(Math.random() * 4);
    const along = (Math.random() - 0.5) * (seaEdge * 1.7);
    const out = HALF + 5 + Math.random() * (BEACH - 9);
    const ux = side === 0 ? along : side === 1 ? along : side === 2 ? -out : out;
    const uz = side === 0 ? -out : side === 1 ? out : along;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 6), poleMatB);
    pole.position.y = 1.15;
    g.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 0.7, 10),
      new THREE.MeshLambertMaterial({ color: UMB_COLORS[u % UMB_COLORS.length] })
    );
    canopy.position.y = 2.3;
    canopy.castShadow = true;
    g.add(canopy);
    // asciugamano colorato accanto all'ombrellone
    const towel = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.8),
      new THREE.MeshLambertMaterial({ color: UMB_COLORS[(u + 2) % UMB_COLORS.length] })
    );
    towel.rotation.x = -Math.PI / 2;
    towel.position.set(1.9, 0.02, 0.3);
    g.add(towel);
    g.position.set(ux, 0, uz);
    scene.add(g);
  }

  // il mare: quattro strisce attorno alla città (non la copre!), con una
  // texture di onde che scorre piano (animata in updateCity)
  const mkSeaTex = (ru, rv) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#3f97e8';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,.45)';
    g.lineWidth = 5;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      const y0 = 22 + k * 42;
      for (let x = 0; x <= 256; x += 8) {
        const y = y0 + Math.sin((x / 256) * Math.PI * 4 + k * 1.7) * 7;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(ru, rv);
    return tex;
  };
  const FAR_SEA = 1500;                    // dove finisce il mare (oltre la nebbia)
  const DEEP = FAR_SEA - seaEdge;          // larghezza del mare oltre la spiaggia
  const seaTexNS = mkSeaTex(50, 21);       // strisce nord e sud (largo lungo x)
  const seaTexEW = mkSeaTex(21, 7);        // strisce est e ovest
  const seaMats = [];
  const addSea = (w, l, tex, x, z) => {
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.3, z);
    scene.add(m);
    seaMats.push(mat);
  };
  addSea(FAR_SEA * 2, DEEP, seaTexNS, 0, seaEdge + DEEP / 2);   // nord
  addSea(FAR_SEA * 2, DEEP, seaTexNS, 0, -seaEdge - DEEP / 2);  // sud
  addSea(DEEP, seaEdge * 2, seaTexEW, seaEdge + DEEP / 2, 0);   // est
  addSea(DEEP, seaEdge * 2, seaTexEW, -seaEdge - DEEP / 2, 0);  // ovest

  // centri delle strade (verticali e orizzontali)
  const roadCenters = [];
  for (let i = 0; i <= GRID; i++) roadCenters.push(-HALF + ROAD / 2 + i * CELL);

  for (const c of roadCenters) {
    const mk = (w, l, mat, y, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      scene.add(m);
    };
    // marciapiedi (leggermente più larghi, sotto le strade)
    mk(ROAD + 4, CITY_SIZE, sidewalkMat, 0.005, c, 0);
    mk(CITY_SIZE, ROAD + 4, sidewalkMat, 0.008, 0, c);
    // asfalto
    mk(ROAD, CITY_SIZE, roadMat, 0.02, c, 0);
    mk(CITY_SIZE, ROAD, roadMat, 0.025, 0, c);
  }

  // ---------- dettagli della strada ----------
  // linee tratteggiate al centro (tra un incrocio e l'altro)
  const mkTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  };
  const dashV = mkTex(16, 64, (g) => {
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillRect(5, 6, 6, 42);
  });
  const dashH = mkTex(64, 16, (g) => {
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillRect(6, 5, 42, 6);
  });
  for (let k = 0; k < GRID; k++) {
    const a = roadCenters[k] + ROAD / 2 + 2;
    const b = roadCenters[k + 1] - ROAD / 2 - 2;
    const len = b - a;
    for (const c of roadCenters) {
      const texV = dashV.clone(); texV.needsUpdate = true;
      texV.repeat.set(1, len / 4);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.3, len),
        new THREE.MeshBasicMaterial({ map: texV, transparent: true }));
      v.rotation.x = -Math.PI / 2;
      v.position.set(c, 0.033, (a + b) / 2);
      scene.add(v);
      const texH = dashH.clone(); texH.needsUpdate = true;
      texH.repeat.set(len / 4, 1);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.3),
        new THREE.MeshBasicMaterial({ map: texH, transparent: true }));
      h.rotation.x = -Math.PI / 2;
      h.position.set((a + b) / 2, 0.033, c);
      scene.add(h);
    }
  }

  // strisce pedonali sugli incroci (un piano con le zebre, per lato)
  const zebraV = mkTex(256, 64, (g) => { // zebre lungo x: chi cammina va lungo z
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let x = 8; x < 256; x += 34) g.fillRect(x, 4, 20, 56);
  });
  const zebraH = mkTex(64, 256, (g) => { // zebre lungo z: chi cammina va lungo x
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let y = 8; y < 256; y += 34) g.fillRect(4, y, 56, 20);
  });
  const zebraMatEW = new THREE.MeshBasicMaterial({ map: zebraV, transparent: true });
  const zebraMatNS = new THREE.MeshBasicMaterial({ map: zebraH, transparent: true });
  for (const x of roadCenters) {
    for (const z of roadCenters) {
      const off = ROAD / 2 + 1.1;
      const put = (dx, dz, w, l, material) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), material);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x + dx, 0.034, z + dz);
        m.receiveShadow = true;
        scene.add(m);
      };
      if (x > roadCenters[0]) put(-off, 0, 2.2, 10, zebraMatNS);
      if (x < roadCenters[roadCenters.length - 1]) put(off, 0, 2.2, 10, zebraMatNS);
      if (z > roadCenters[0]) put(0, -off, 10, 2.2, zebraMatEW);
      if (z < roadCenters[roadCenters.length - 1]) put(0, off, 10, 2.2, zebraMatEW);
    }
  }


  // scegli 5 isolotti che saranno parchi (mai sugli isolotti riservati:
  // barbiere, concessionaria, banca, gioielleria, supermarket)
  const parks = new Set();
  while (parks.size < 5) {
    const idx = Math.floor(Math.random() * GRID * GRID);
    if (!skipBlocks.has(idx)) parks.add(idx);
  }

  // rettangoli degli edifici, per disegnare la mappa della minimappa
  const mapBuildings = [];

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
  const leavesMat = new THREE.MeshLambertMaterial({ color: 0x66bb6a });

  function addTree (x, z) {
    // niente alberi che sbucano dagli edifici
    for (const c of colliders) {
      if (x > c.minX - 1.5 && x < c.maxX + 1.5 && z > c.minZ - 1.5 && z < c.maxZ + 1.5) return;
    }
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8), trunkMat);
    trunk.position.y = 0.8;
    trunk.castShadow = true;
    g.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 8), leavesMat);
    leaves.position.y = 2.8;
    leaves.castShadow = true;
    g.add(leaves);
    g.position.set(x, 0, z);
    scene.add(g);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }

  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8f9aa3 });
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const roofPropMat = new THREE.MeshLambertMaterial({ color: 0x9aa5ad });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0xc9b29b });
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a1 });
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x64b5f6 });
  const FLOWER_COLORS = ['#e53935', '#fdd835', '#ec407a', '#ab47bc', '#ff9800', '#fafafa'];

  // insegne dei negozi: una texture per nome, disegnata su canvas e riusata
  // su tutti gli edifici (così restano poche texture in memoria)
  const SHOP_NAMES = [
    '🍕 Pizzeria da Luigi', '🍦 Gelateria Polo Nord', '🧁 Dolcetto in Cima',
    '🦖 Dino Store', '⚽ Supersport', '📚 Libri Magici',
    '🎮 Pixel Videogiochi', '🧸 Orsetto e Soci', '🥐 Forno Birba',
    '🛒 Iperbimbo', '🎨 TuttoColori', '💊 Farmacia Felice',
    '☕ Caffè dei Nonni', '🎸 Scuola di Musica', '🍞 Pane del Mattino',
    '🎈 Festa & Palloncini', '💐 Fiori Felici', '✈️ Volare Toys',
    '🚲 Due Ruote', '🐠 Acquario Blu'
  ];
  const signMats = SHOP_NAMES.map((name0, si) => {
    const name = tn(name0); // l'insegna nella lingua scelta
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = si % 2 ? '#fff8e1' : '#ffffff';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = BUILDING_COLORS[si % BUILDING_COLORS.length];
    g.fillRect(0, 0, 512, 14);
    g.fillRect(0, 114, 512, 14);
    g.fillStyle = '#333333';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 56;
    do {
      g.font = `bold ${size}px "Comic Sans MS", "Chalkboard SE", sans-serif`;
      size -= 4;
    } while (g.measureText(name).width > 470 && size > 26);
    g.fillText(name, 256, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map: tex });
  });

  // ---------- panchine (ci si siede con E) ----------
  const benches = [];
  const woodMat = new THREE.MeshLambertMaterial({ color: 0xb0713a });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });

  function benchOverlaps (x, z, hx, hz) {
    for (const c of colliders) {
      if (x + hx > c.minX - 0.7 && x - hx < c.maxX + 0.7 &&
          z + hz > c.minZ - 0.7 && z - hz < c.maxZ + 0.7) return true;
    }
    return false;
  }

  // La panchina guarda +z quando yaw=0 (lo schienale è dietro, a -z):
  // stessa convenzione del personaggio, così sedersi è solo ruotarlo.
  function addBench (x, z, yaw) {
    const hx = Math.abs(Math.cos(yaw)) * 0.95 + Math.abs(Math.sin(yaw)) * 0.45;
    const hz = Math.abs(Math.sin(yaw)) * 0.95 + Math.abs(Math.cos(yaw)) * 0.45;
    if (benchOverlaps(x, z, hx, hz)) return; // dentro un albero/edificio
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), woodMat);
    seat.position.y = 0.5;
    seat.castShadow = true;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.07), woodMat);
    back.position.set(0, 0.85, -0.26);
    back.castShadow = true;
    g.add(back);
    for (const lx of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.45), metalMat);
      leg.position.set(lx, 0.25, 0);
      leg.castShadow = true;
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    scene.add(g);
    colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
    benches.push({ x, z, yaw });
  }

  // panchine intorno ai laghetti dei parchi, guardando lo stagno
  for (const idx of parks) {
    const i = Math.floor(idx / GRID);
    const j = idx % GRID;
    const cx = -HALF + ROAD + i * CELL + BLOCK / 2;
    const cz = -HALF + ROAD + j * CELL + BLOCK / 2;
    for (let k = 0; k < 3; k++) {
      const a = k * (Math.PI * 2 / 3) + 0.5;
      const bx = cx + Math.cos(a) * 7.5;
      const bz = cz + Math.sin(a) * 7.5;
      addBench(bx, bz, Math.atan2(cx - bx, cz - bz)); // guarda il laghetto
    }
  }

  // le panchine agli incroci si piazzano dopo gli edifici (qui sotto),
  // così nessun edificio può nascere dentro una panchina

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x0 = -HALF + ROAD + i * CELL;
      const z0 = -HALF + ROAD + j * CELL;

      // isolotto riservato (es. il barbiere): niente edifici generati
      if (skipBlocks.has(i * GRID + j)) continue;

      if (parks.has(i * GRID + j)) {
        // parco: prato, un laghetto O una fontana, viale anulare, fiori, alberi
        const lawn = new THREE.Mesh(
          new THREE.PlaneGeometry(BLOCK - 4, BLOCK - 4),
          new THREE.MeshLambertMaterial({ color: 0x7ec850 })
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(x0 + BLOCK / 2, 0.03, z0 + BLOCK / 2);
        lawn.receiveShadow = true;
        scene.add(lawn);

        const cx = x0 + BLOCK / 2;
        const cz = z0 + BLOCK / 2;

        // viale anulare di ghiaia chiara
        const path = new THREE.Mesh(
          new THREE.RingGeometry(6.2, 7.6, 28),
          new THREE.MeshLambertMaterial({ color: 0xd9cfa8 })
        );
        path.rotation.x = -Math.PI / 2;
        path.position.set(cx, 0.04, cz);
        scene.add(path);

        if (Math.random() < 0.5) {
          // laghetto
          const pond = new THREE.Mesh(
            new THREE.CircleGeometry(5, 24),
            new THREE.MeshLambertMaterial({ color: 0x64b5f6 })
          );
          pond.rotation.x = -Math.PI / 2;
          pond.position.set(cx, 0.05, cz);
          scene.add(pond);
        } else {
          // fontana: vasca di pietra, acqua e gettone centrale
          const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 0.7, 20), stoneMat);
          basin.position.set(cx, 0.35, cz);
          basin.castShadow = true;
          scene.add(basin);
          const water = new THREE.Mesh(new THREE.CircleGeometry(2.5, 20), waterMat);
          water.rotation.x = -Math.PI / 2;
          water.position.set(cx, 0.72, cz);
          scene.add(water);
          const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.3, 12), stoneMat);
          jet.position.set(cx, 1, cz);
          jet.castShadow = true;
          scene.add(jet);
          const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), waterMat);
          top.position.set(cx, 1.75, cz);
          scene.add(top);
        }

        // fiori colorati lungo il viale
        for (let f = 0; f < 8; f++) {
          const a = f * (Math.PI * 2 / 8) + 0.3;
          const flower = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 8, 6),
            new THREE.MeshLambertMaterial({ color: FLOWER_COLORS[(f + i + j) % FLOWER_COLORS.length] })
          );
          flower.position.set(cx + Math.cos(a) * 7, 0.3, cz + Math.sin(a) * 7);
          flower.castShadow = true;
          scene.add(flower);
        }

        for (let t = 0; t < 9; t++) {
          const tx = x0 + 3 + Math.random() * (BLOCK - 6);
          const tz = z0 + 3 + Math.random() * (BLOCK - 6);
          if (Math.hypot(tx - cx, tz - cz) < 9) continue;
          addTree(tx, tz);
        }
        pois.push({ x: cx, z: cz });
        continue;
      }

      // isolotto normale: 2x2 lotti con edifici pastello
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          if (Math.random() < 0.15) continue; // lotto vuoto
          const w = 10 + Math.random() * 5;
          const d = 10 + Math.random() * 5;
          const h = 6 + Math.random() * 16;
          const cx = x0 + a * (BLOCK / 2) + BLOCK / 4;
          const cz = z0 + b * (BLOCK / 2) + BLOCK / 4;
          mapBuildings.push({ x: cx, z: cz, w, d }); // per la minimappa

          const tex = makeBuildingTexture(BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)]);
          tex.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 8)));
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: tex }));
          mesh.position.set(cx, h / 2, cz);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);

          // tetto piatto leggermente più scuro
          const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), roofMat);
          roof.position.set(cx, h + 0.2, cz);
          roof.castShadow = true;
          scene.add(roof);

          // porta d'ingresso su un lato a caso, con tenda da sole a colori
          const side = Math.floor(Math.random() * 4);
          const px = side === 0 ? cx - w / 2 : side === 1 ? cx + w / 2 : cx;
          const pz = side === 2 ? cz - d / 2 : side === 3 ? cz + d / 2 : cz;
          const horiz = side < 2; // la facciata guarda lungo x
          const door = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.12 : 1.6, 2.6, horiz ? 1.6 : 0.12), doorMat);
          door.position.set(px + (horiz ? (side === 0 ? 0.07 : -0.07) : 0), 1.3, pz + (horiz ? 0 : (side === 2 ? 0.07 : -0.07)));
          scene.add(door);
          if (Math.random() < 0.5) {
            const awning = new THREE.Mesh(
              new THREE.BoxGeometry(horiz ? 0.9 : 2.6, 0.09, horiz ? 2.6 : 0.9),
              new THREE.MeshLambertMaterial({ color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)] })
            );
            awning.position.set(px + (horiz ? (side === 0 ? 0.5 : -0.5) : 0), 2.9, pz + (horiz ? 0 : (side === 2 ? 0.5 : -0.5)));
            awning.castShadow = true;
            scene.add(awning);
          }

          // insegna del negozio sopra la porta (la maggior parte degli edifici
          // ne ha una; la texture è una per nome, già pronta in signMats)
          if (Math.random() < 0.7) {
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(4.6, 1.15),
              signMats[Math.floor(Math.random() * signMats.length)]
            );
            sign.position.set(
              px + (horiz ? (side === 0 ? -0.1 : 0.1) : 0),
              3.6,
              pz + (horiz ? 0 : (side === 2 ? -0.1 : 0.1))
            );
            sign.rotation.y = side === 0 ? -Math.PI / 2 : side === 1 ? Math.PI / 2 : side === 2 ? Math.PI : 0;
            scene.add(sign);
          }

          // sui tetti: condizionatori e, ogni tanto, un serbatoio d'acqua
          if (Math.random() < 0.55) {
            const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), roofPropMat);
            ac.position.set(cx + (Math.random() - 0.5) * (w - 3), h + 0.7, cz + (Math.random() - 0.5) * (d - 3));
            ac.castShadow = true;
            scene.add(ac);
            if (Math.random() < 0.4) {
              const ac2 = ac.clone();
              ac2.position.set(cx + (Math.random() - 0.5) * (w - 3), h + 0.7, cz + (Math.random() - 0.5) * (d - 3));
              scene.add(ac2);
            }
          }
          if (Math.random() < 0.3) {
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.5, 10), tankMat);
            tank.position.set(cx + (Math.random() - 0.5) * (w - 4), h + 1.15, cz + (Math.random() - 0.5) * (d - 4));
            tank.castShadow = true;
            scene.add(tank);
          }

          colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        }
      }
    }
  }

  // alberi agli angoli degli incroci (sul marciapiede)
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const x = roadCenters[i], z = roadCenters[j];
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        if (Math.random() < 0.3) addTree(x + sx * 7, z + sz * 7);
      }
    }
  }

  // panchine agli angoli degli incroci (sul marciapiede), guardando l'incrocio
  for (const x of roadCenters) {
    for (const z of roadCenters) {
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        if (Math.random() < 0.55) continue;
        const bx = x + sx * 9;
        const bz = z + sz * 9;
        addBench(bx, bz, Math.atan2(x - bx, z - bz));
      }
    }
  }

  // lampioni agli incroci (due angoli opposti)
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff59f, emissive: 0xfff176 });
  for (const x of roadCenters) {
    for (const z of roadCenters) {
      for (const [sx, sz] of [[6.5, 6.5], [-6.5, -6.5]]) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 5, 6), poleMat);
        pole.position.y = 2.5;
        g.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), lampMat);
        bulb.position.y = 5.2;
        g.add(bulb);
        g.position.set(x + sx, 0, z + sz);
        scene.add(g);
      }
    }
  }

  // semafori che ciclano da soli (verde → giallo → rosso) a due terzi degli incroci
  const tlRed = new THREE.MeshLambertMaterial({ color: 0x5a1a1a, emissive: 0x111111 });
  const tlYellow = new THREE.MeshLambertMaterial({ color: 0x5a4a1a, emissive: 0x111111 });
  const tlGreen = new THREE.MeshLambertMaterial({ color: 0x1a5a2a, emissive: 0x111111 });
  function addTrafficLight (x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.2, 6), poleMat);
    pole.position.y = 1.6;
    pole.castShadow = true;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.3), doorMat);
    head.position.y = 3.4;
    head.castShadow = true;
    g.add(head);
    // le luci guardano il centro dell'incrocio (faccia -z del gruppo)
    [[0.45, tlRed], [0, tlYellow], [-0.45, tlGreen]].forEach(([dy, m]) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), m);
      lamp.position.set(0, 3.4 + dy, -0.18);
      g.add(lamp);
    });
    g.position.set(x, 0, z);
    g.rotation.y = Math.PI / 4; // l'angolo è (+7.4, +7.4): guarda l'incrocio
    scene.add(g);
  }
  for (const x of roadCenters) {
    for (const z of roadCenters) {
      if (Math.random() < 0.4) continue;
      addTrafficLight(x + 7.4, z + 7.4);
    }
  }

  // ciclo dei semafori: verde 7,5s, giallo 1,5s, rosso 7s (materiali in comune
  // a tutti i semafori: li accende e li spegne questa funzione)
  let tlTime = 0;
  const cycleLight = (m, lit, hex) => m.emissive.setHex(lit ? hex : 0x111111);

  // onde del mare: la texture scorre piano, in due direzioni diverse
  let seaTime = 0;
  const updateSea = (dt) => {
    seaTime += dt;
    seaTexNS.offset.set(seaTime * 0.02, seaTime * 0.013);
    seaTexEW.offset.set(-seaTime * 0.013, seaTime * 0.02);
  };

  const updateCity = (dt) => {
    tlTime = (tlTime + dt) % 16;
    cycleLight(tlGreen, tlTime < 7.5, 0x22ff44);
    cycleLight(tlYellow, tlTime >= 7.5 && tlTime < 9, 0xffcc22);
    cycleLight(tlRed, tlTime >= 9, 0xff2222);
    updateSea(dt);
  };

  // punti di interesse: incroci con un po' di variazione
  for (const x of roadCenters) {
    for (const z of roadCenters) {
      pois.push({ x: x + (Math.random() * 8 - 4), z: z + (Math.random() * 8 - 4) });
    }
  }

  // ---------- mappa statica per la minimappa ----------
  // una sola immagine grande con mare, spiaggia, prato, strade, parchi ed
  // edifici: la minimappa ne mostra ogni frame solo la parte attorno al
  // giocatore (drawImage), così costa pochissimo
  const mapS = 2;                 // pixel di mappa per metro
  const mapOff = HALF + 80;       // margine di mare oltre il bordo città
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = mapCanvas.height = mapOff * 2 * mapS;
  {
    const g = mapCanvas.getContext('2d');
    const M = (v) => (v + mapOff) * mapS; // metro -> pixel di mappa
    // mare, spiaggia, prato
    g.fillStyle = '#3f97e8';
    g.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    g.fillStyle = '#ede2ae';
    g.fillRect(M(-HALF - 26), M(-HALF - 26), (HALF + 26) * 2 * mapS, (HALF + 26) * 2 * mapS);
    g.fillStyle = '#8fce7a';
    g.fillRect(M(-HALF), M(-HALF), CITY_SIZE * mapS, CITY_SIZE * mapS);
    // strade
    g.fillStyle = '#5f6a72';
    for (const c of roadCenters) {
      g.fillRect(M(c - ROAD / 2), M(-HALF), ROAD * mapS, CITY_SIZE * mapS);
      g.fillRect(M(-HALF), M(c - ROAD / 2), CITY_SIZE * mapS, ROAD * mapS);
    }
    // parchi
    g.fillStyle = '#7ec850';
    for (const idx of parks) {
      const i = Math.floor(idx / GRID);
      const j = idx % GRID;
      const cx = -HALF + ROAD + i * CELL + BLOCK / 2;
      const cz = -HALF + ROAD + j * CELL + BLOCK / 2;
      g.fillRect(M(cx - (BLOCK - 4) / 2), M(cz - (BLOCK - 4) / 2), (BLOCK - 4) * mapS, (BLOCK - 4) * mapS);
    }
    // edifici
    g.fillStyle = '#646e78';
    for (const b of mapBuildings) {
      g.fillRect(M(b.x - b.w / 2), M(b.z - b.d / 2), b.w * mapS, b.d * mapS);
    }
  }

  // nuvole
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < puffs; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 3, 10, 10), cloudMat);
      s.position.set(k * 4 - 4, Math.random() * 2, Math.random() * 4 - 2);
      g.add(s);
    }
    g.position.set(
      (Math.random() - 0.5) * CITY_SIZE * 1.2,
      55 + Math.random() * 25,
      (Math.random() - 0.5) * CITY_SIZE * 1.2
    );
    scene.add(g);
    clouds.push({ g, speed: 0.8 + Math.random() * 1.2 });
  }

  return { colliders, pois, clouds, roadCenters, benches, updateCity, CITY_SIZE, HALF, map: { canvas: mapCanvas, S: mapS, off: mapOff } };
}

// Spinge un cerchio (pos, radius) fuori da tutti gli ostacoli.
// Ritorna la normale dell'ultimo urto, o null se non c'è stata collisione.
// Ostacoli a quote diverse: quelli con minY valgono solo sottoterra (i muri
// del garage), quelli di superficie solo sopra il livello della strada.
export function resolveCollisions (pos, radius, colliders) {
  const y = pos.y || 0;
  let normal = null;
  for (const c of colliders) {
    if (c.minY !== undefined) {
      if (y > c.minY) continue; // sei più in alto del muro interrato
    } else if (y < -2) {
      continue; // sei sotto il livello della strada: ignora gli edifici
    }
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;

    const d = Math.sqrt(d2);
    if (d > 1e-5) {
      // urto laterale: scivola lungo la parete
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
      normal = { x: dx / d, z: dz / d };
    } else {
      // centro dentro l'ostacolo: spingi lungo l'asse con penetrazione minima
      const pushLeft = pos.x - (c.minX - radius);
      const pushRight = (c.maxX + radius) - pos.x;
      const pushUp = pos.z - (c.minZ - radius);
      const pushDown = (c.maxZ + radius) - pos.z;
      const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (m === pushLeft) { pos.x = c.minX - radius; normal = { x: -1, z: 0 }; }
      else if (m === pushRight) { pos.x = c.maxX + radius; normal = { x: 1, z: 0 }; }
      else if (m === pushUp) { pos.z = c.minZ - radius; normal = { x: 0, z: -1 }; }
      else { pos.z = c.maxZ + radius; normal = { x: 0, z: 1 }; }
    }
  }

  // bordi della città: si può camminare sulla spiaggia (26 m) e fare
  // due passi nell'acqua bassa, ma non arrivare in mezzo al mare
  const lim = HALF + 28;
  if (pos.x < -lim) { pos.x = -lim; normal = { x: 1, z: 0 }; }
  if (pos.x > lim) { pos.x = lim; normal = { x: -1, z: 0 }; }
  if (pos.z < -lim) { pos.z = -lim; normal = { x: 0, z: 1 }; }
  if (pos.z > lim) { pos.z = lim; normal = { x: 0, z: -1 }; }
  return normal;
}

// Spinge un cerchio (pos, radius) fuori da una lista di cerchi (auto,
// personaggi). Ritorna true se c'è stato almeno un urto. I cerchi a quote
// troppo diverse (es. auto in garage e traffico in superficie) non si toccano.
export function resolveCircles (pos, radius, circles) {
  const y = pos.y || 0;
  let hit = false;
  for (const c of circles) {
    if (c.y !== undefined && Math.abs(c.y - y) > 5) continue;
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const rr = radius + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 1e-4;
    pos.x = c.x + (dx / d) * rr;
    pos.z = c.z + (dz / d) * rr;
    hit = true;
  }
  return hit;
}
