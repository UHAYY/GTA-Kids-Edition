// Costruzione della città: griglia di strade, isolotti con edifici colorati,
// parchi, alberi, lampioni e nuvole. Esporta anche la logica delle collisioni.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';
import { tn } from './i18n.js';

export const CELL = 46;   // isolotto + strada
export const ROAD = 12;   // larghezza strada
export const BLOCK = 34;  // lato isolotto
export const GRID = 8;    // isolotti per lato (città grande!)

export const CITY_SIZE = GRID * CELL + ROAD; // c'è strada anche sul bordo
const HALF = CITY_SIZE / 2;
const HPI = Math.PI / 2;

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

// texture da casetta: muro pastello con due file di finestrine (una faccia =
// una texture, senza ripetizioni: le case sono piccole)
function makeHouseTexture (baseColor) {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 96, 64);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) {
      g.fillStyle = Math.random() < 0.3 ? '#fff3b0' : '#bfdff5';
      g.fillRect(11 + x * 30, 11 + y * 26, 15, 15);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: tex });
}

// Moltiplica gli UV di una geometria: serve per "scrivere nelle coordinate"
// quello che prima era texture.repeat, così geometrie con ripetizioni diverse
// possono condividere lo stesso materiale e fondersi in una mesh unica.
function scaleUV (geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

// ---------- quota del terreno fuori città ----------
// L'isola continua oltre la spiaggia: prima colline verdi dolci, poi
// montagne rocciose con le cime innevate, infine un anello di montagne
// tampone e la discesa sotto il mare. Una sola funzione per tutti: la
// usano la mesh del terreno, la fisica (surfaceY) e la minimappa.
// Nota: dentro la città (r < 218) vale -0.06, un pelo sotto il prato e
// la sabbia che lo coprono: così non si vede né sfrega (z-fighting).
function rawHeight (x, z) {
  const r = Math.max(Math.abs(x), Math.abs(z)); // distanza "a quadri", come la città
  if (r < 218) return -0.06;
  // salita dolce dal livello del mare: tutte le quote crescono con t,
  // così alla frontina (r = 218) il terreno parte da zero senza scarpate
  const t = Math.min(1, (r - 218) / 60);
  let h = t * 9;
  // colline: due ottave di "rumore" liscio fatto con seni e coseni
  const n1 = Math.sin(x * 0.023 + Math.sin(z * 0.031) * 2) *
             Math.cos(z * 0.026 + Math.sin(x * 0.019) * 2.3);
  h += (0.5 + 0.5 * n1) * (8 + 14 * t) * t;
  // montagne: creste alongate che spuntano oltre i 340 m dal centro
  const m = Math.max(0, Math.min(1, (r - 340) / 130));
  const ridge = 1 - Math.abs(Math.sin(x * 0.011 + 2 * Math.sin(z * 0.008)));
  const n2 = 0.5 + 0.5 * Math.sin(x * 0.043 + Math.sin(z * 0.037) * 1.8) *
                     Math.cos(z * 0.041 + Math.sin(x * 0.033) * 1.6);
  h += Math.pow(ridge, 2.6) * (40 + 38 * n2) * m;
  // anello finale di montagne-tampone: l'isola finisce in muraglia…
  const rim = Math.max(0, Math.min(1, (r - 460) / 100));
  h += rim * rim * 30;
  // …che poi crolla nel mare oltre i 560 m dal centro
  const edge = Math.max(0, (r - 560) / 50);
  h -= edge * edge * 80;
  return h;
}

// ---------- i paesini sui rilievi ----------
// Tre paesini di montagna: il terreno intorno si appiattisce in una
// terrazza in erba (con una transizione dolce), così le casette stanno
// in piano e ci si arriva guidando su per i colli. La terrazza è parte
// di terrainHeight: la vedono uguale la mesh, l'auto e la minimappa.
export const TOWN_ROAD = 8; // larghezza della strada del paesino
export const MINI_TOWNS = [
  { x: 295, z: -150, r: 30, name: '🏘️ Collinetta Fiorita' },   // collina a est
  { x: -250, z: 270, r: 28, name: '🏘️ Villaggio del Sole' },   // collina a sud-ovest
  { x: -210, z: -330, r: 30, name: '🏘️ Rifugio della Neve' }   // tra le montagne a nord
];
for (const t of MINI_TOWNS) t.h = rawHeight(t.x, t.z); // quota della terrazza
const TOWN_FADE = 24; // larghezza della scarpata dolce intorno alla terrazza

// mescola del paese in un punto: 1 sulla terrazza, 0 oltre la scarpata
export function townMix (x, z) {
  let m = 0;
  for (const t of MINI_TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < t.r + TOWN_FADE) m = Math.max(m, Math.min(1, (t.r + TOWN_FADE - d) / TOWN_FADE));
  }
  return m;
}

export function terrainHeight (x, z) {
  let h = rawHeight(x, z);
  // le terrazze dei paesini: dentro il paese il terreno vale t.h,
  // lungo la scarpata si unisce al colle con una curva morbida
  for (const t of MINI_TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d >= t.r + TOWN_FADE) continue;
    const k = Math.min(1, (t.r + TOWN_FADE - d) / TOWN_FADE);
    const s = k * k * (3 - 2 * k); // smoothstep: pendenza zero ai bordi
    h += (t.h - h) * s;
  }
  return h;
}

// colore del terreno a una certa quota (sabbia → prato → roccia → neve),
// con un po' di variazione a seconda del posto: lo usano i vertici della
// mesh e i pixel della mappa della minimappa
const TER_SAND = new THREE.Color(0xede2ae);
const TER_GRASS = new THREE.Color(0x8fce7a);
const TER_GRASS2 = new THREE.Color(0x6fae5a);
const TER_ROCK = new THREE.Color(0x9a8f7d);
const TER_SNOW = new THREE.Color(0xf4f8fb);
const _tc = new THREE.Color();
export function terrainColorAt (h, x, z, out = _tc) {
  if (h < 0.4) return out.copy(TER_SAND);
  const varz = 0.5 + 0.5 * Math.sin(x * 0.09) * Math.cos(z * 0.083); // chiazze
  out.copy(TER_GRASS).lerp(TER_GRASS2, varz * 0.7);
  if (h > 20) out.lerp(TER_ROCK, Math.min(1, (h - 20) / 14));
  if (h > 48) out.lerp(TER_SNOW, Math.min(1, (h - 48) / 14));
  // i paesini restano in erba anche in quota (sono in una radura)
  const tm = townMix(x, z);
  if (tm > 0) out.lerp(TER_GRASS, tm * 0.85);
  return out;
}

export function buildCity (scene, skipBlocks = new Set(), groundHoles = []) {
  const colliders = []; // { minX, maxX, minZ, maxZ }
  const pois = [];      // punti dove nascono missioni e monete

  // ---------- batch delle mesh statiche ----------
  // La città è fatta di migliaia di piccole mesh ferme: ogni mesh è un draw
  // call e la GPU dei notebook meno potenti soffoca. Ogni mesh statica finisce
  // in coda (raggruppata per materiale) e alla fine le geometrie di ogni
  // materiale si fondono in un'unica mesh: resa identica, draw call pochi.
  const batches = new Map(); // materiale -> { geos: [], cast, receive }
  function batch (mesh) {
    mesh.updateWorldMatrix(true, false);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    let b = batches.get(mesh.material);
    if (!b) {
      b = { geos: [], cast: false, receive: false };
      batches.set(mesh.material, b);
    }
    b.geos.push(geo);
    if (mesh.castShadow) b.cast = true;
    if (mesh.receiveShadow) b.receive = true;
  }
  // scorciatoia: crea la mesh, imposta posa/ombra e la mette in coda
  const put = (geo, mat, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    if (opts.rx) m.rotation.x = opts.rx;
    if (opts.ry) m.rotation.y = opts.ry;
    m.position.set(x, y, z);
    m.castShadow = !!opts.cast;
    m.receiveShadow = !!opts.receive;
    batch(m);
    return m;
  };
  function flushBatches () {
    for (const [mat, b] of batches) {
      const merged = mergeGeometries(b.geos);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = b.cast;
      m.receiveShadow = b.receive;
      scene.add(m);
    }
    batches.clear();
  }

  // prato di base (con i buchi dove stanno gli ingressi dei garage
  // sotterranei: così dalla strada si vede la discesa). Basta un pelo di
  // più della spiaggia: oltre, c'è il terreno a rilievi che si alza
  const G = HALF + 30;
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
  ground.rotation.x = -HPI;
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
  // Nota sulle quote: i piani quasi sovrapposti (prato, sabbia, marciapiedi,
  // asfalto, marcature) sono distanziati di almeno 2 cm — a vista basterebbe
  // di meno, ma così la profondità del buffer non li fa "tremare"
  // (z-fighting) in lontananza.
  sand.rotation.x = -HPI;
  sand.position.y = 0.03;
  sand.receiveShadow = true;
  scene.add(sand);

  // ombrelloni e asciugamani sulla spiaggia (tutti guardano il mare)
  const UMB_COLORS = ['#e53935', '#fdd835', '#ec407a', '#29b6f6', '#ff9800'];
  const poleMatB = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
  // un materiale condiviso per colore (canopi e asciugamani)
  const umbMats = UMB_COLORS.map(c => new THREE.MeshLambertMaterial({ color: c }));
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
      umbMats[u % umbMats.length]
    );
    canopy.position.y = 2.3;
    canopy.castShadow = true;
    g.add(canopy);
    // asciugamano colorato accanto all'ombrellone
    const towel = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1.8),
      umbMats[(u + 2) % umbMats.length]
    );
    towel.rotation.x = -HPI;
    towel.position.set(1.9, 0.06, 0.3);
    g.add(towel);
    g.position.set(ux, 0, uz);
    batch(pole);
    batch(canopy);
    batch(towel);
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
    m.rotation.x = -HPI;
    m.position.set(x, 0.3, z);
    scene.add(m);
    seaMats.push(mat);
  };
  addSea(FAR_SEA * 2, DEEP, seaTexNS, 0, seaEdge + DEEP / 2);   // nord
  addSea(FAR_SEA * 2, DEEP, seaTexNS, 0, -seaEdge - DEEP / 2);  // sud
  addSea(DEEP, seaEdge * 2, seaTexEW, seaEdge + DEEP / 2, 0);   // est
  addSea(DEEP, seaEdge * 2, seaTexEW, -seaEdge - DEEP / 2, 0);  // ovest

  // ---------- la mesh del terreno (colline e montagne) ----------
  // Un grande piano sconnesso dai vertici colorati secondo la quota:
  // un'unica mesh per tutta l'isola, un solo draw call.
  const TER_SIZE = 1240;
  // 168 suddivisioni (non 124): le terrazze dei paesini hanno bisogno di
  // vertici più fitti per seguire le scarpate dolci senza spigoli
  const terGeo = new THREE.PlaneGeometry(TER_SIZE, TER_SIZE, 168, 168);
  terGeo.rotateX(-HPI);
  {
    const p = terGeo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const h = terrainHeight(p.getX(i), p.getZ(i));
      p.setY(i, h);
      terrainColorAt(h, p.getX(i), p.getZ(i), c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    terGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terGeo.computeVertexNormals();
  }
  const terrain = new THREE.Mesh(terGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);


  // centri delle strade (verticali e orizzontali)
  const roadCenters = [];
  for (let i = 0; i <= GRID; i++) roadCenters.push(-HALF + ROAD / 2 + i * CELL);

  for (const c of roadCenters) {
    // marciapiedi (leggermente più larghi, sotto le strade)
    put(new THREE.PlaneGeometry(ROAD + 4, CITY_SIZE), sidewalkMat, c, 0.02, 0, { rx: -HPI, receive: true });
    put(new THREE.PlaneGeometry(CITY_SIZE, ROAD + 4), sidewalkMat, 0, 0.025, c, { rx: -HPI, receive: true });
    // asfalto
    put(new THREE.PlaneGeometry(ROAD, CITY_SIZE), roadMat, c, 0.045, 0, { rx: -HPI, receive: true });
    put(new THREE.PlaneGeometry(CITY_SIZE, ROAD), roadMat, 0, 0.05, c, { rx: -HPI, receive: true });
  }

  // ---------- dettagli della strada ----------
  // linee tratteggiate al centro (tra un incrocio e l'altro). Prima ogni
  // linea clonava la texture per cambiare il repeat: adesso la ripetizione
  // sta negli UV e tutte le linee condividono due soli materiali.
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
  const dashMatV = new THREE.MeshBasicMaterial({ map: dashV, transparent: true });
  const dashMatH = new THREE.MeshBasicMaterial({ map: dashH, transparent: true });
  for (let k = 0; k < GRID; k++) {
    const a = roadCenters[k] + ROAD / 2 + 2;
    const b = roadCenters[k + 1] - ROAD / 2 - 2;
    const len = b - a;
    for (const c of roadCenters) {
      const gv = new THREE.PlaneGeometry(0.3, len);
      scaleUV(gv, 1, len / 4);
      put(gv, dashMatV, c, 0.07, (a + b) / 2, { rx: -HPI });
      const gh = new THREE.PlaneGeometry(len, 0.3);
      scaleUV(gh, len / 4, 1);
      put(gh, dashMatH, (a + b) / 2, 0.07, c, { rx: -HPI });
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
      if (x > roadCenters[0]) put(new THREE.PlaneGeometry(2.2, 10), zebraMatNS, x - off, 0.075, z, { rx: -HPI, receive: true });
      if (x < roadCenters[roadCenters.length - 1]) put(new THREE.PlaneGeometry(2.2, 10), zebraMatNS, x + off, 0.075, z, { rx: -HPI, receive: true });
      if (z > roadCenters[0]) put(new THREE.PlaneGeometry(10, 2.2), zebraMatEW, x, 0.075, z - off, { rx: -HPI, receive: true });
      if (z < roadCenters[roadCenters.length - 1]) put(new THREE.PlaneGeometry(10, 2.2), zebraMatEW, x, 0.075, z + off, { rx: -HPI, receive: true });
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

  function addTree (x, z, y = 0) {
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
    g.position.set(x, y, z);
    batch(trunk);
    batch(leaves);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }

  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8f9aa3 });
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const roofPropMat = new THREE.MeshLambertMaterial({ color: 0x9aa5ad });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0xc9b29b });
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a1 });
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x64b5f6 });
  const FLOWER_COLORS = ['#e53935', '#fdd835', '#ec407a', '#ab47bc', '#ff9800', '#fafafa'];
  // materiali condivisi anche per tende da sole e fiori (prima: uno a mesh)
  const awningMats = BUILDING_COLORS.map(c => new THREE.MeshLambertMaterial({ color: c }));
  const flowerMats = FLOWER_COLORS.map(c => new THREE.MeshLambertMaterial({ color: c }));

  // Edifici: una texture per colore con due varianti di finestre, condivisa
  // da tutti gli edifici dello stesso colore (prima ogni edificio aveva la
  // sua texture e il suo materiale: un draw call ciascuno). Il numero di
  // "piani" di finestre sta negli UV della geometria, non in texture.repeat.
  const buildingMats = [];
  for (let ci = 0; ci < BUILDING_COLORS.length; ci++) {
    for (let v = 0; v < 2; v++) {
      buildingMats.push(new THREE.MeshLambertMaterial({ map: makeBuildingTexture(BUILDING_COLORS[ci]) }));
    }
  }
  // e quelle da casetta per i paesini sui rilievi
  const houseMats = BUILDING_COLORS.map(c => makeHouseTexture(c));
  // tetti di terracotta e legno per le casette (i grigi stanno bene in città,
  // ma un paesino di montagna vuole i tetti caldi)
  const townRoofMats = ['#c94f3d', '#a8623c', '#8a6d54'].map(c => new THREE.MeshLambertMaterial({ color: c }));

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
    for (const child of g.children) batch(child);
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

  // materiali condivisi dei parchi (prima: un materiale per parco)
  const lawnMat = new THREE.MeshLambertMaterial({ color: 0x7ec850 });
  const pathMat = new THREE.MeshLambertMaterial({ color: 0xd9cfa8 });

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x0 = -HALF + ROAD + i * CELL;
      const z0 = -HALF + ROAD + j * CELL;

      // isolotto riservato (es. il barbiere): niente edifici generati
      if (skipBlocks.has(i * GRID + j)) continue;

      if (parks.has(i * GRID + j)) {
        // parco: prato, un laghetto O una fontana, viale anulare, fiori, alberi
        put(new THREE.PlaneGeometry(BLOCK - 4, BLOCK - 4), lawnMat,
          x0 + BLOCK / 2, 0.05, z0 + BLOCK / 2, { rx: -HPI, receive: true });

        const cx = x0 + BLOCK / 2;
        const cz = z0 + BLOCK / 2;

        // viale anulare di ghiaia chiara
        put(new THREE.RingGeometry(6.2, 7.6, 28), pathMat, cx, 0.065, cz, { rx: -HPI });

        if (Math.random() < 0.5) {
          // laghetto
          put(new THREE.CircleGeometry(5, 24), waterMat, cx, 0.085, cz, { rx: -HPI });
        } else {
          // fontana: vasca di pietra, acqua e gettone centrale
          put(new THREE.CylinderGeometry(2.8, 3.1, 0.7, 20), stoneMat, cx, 0.35, cz, { cast: true });
          put(new THREE.CircleGeometry(2.5, 20), waterMat, cx, 0.72, cz, { rx: -HPI });
          put(new THREE.CylinderGeometry(0.35, 0.5, 1.3, 12), stoneMat, cx, 1, cz, { cast: true });
          put(new THREE.SphereGeometry(0.5, 12, 10), waterMat, cx, 1.75, cz);
        }

        // fiori colorati lungo il viale
        for (let f = 0; f < 8; f++) {
          const a = f * (Math.PI * 2 / 8) + 0.3;
          put(new THREE.SphereGeometry(0.22, 8, 6), flowerMats[(f + i + j) % flowerMats.length],
            cx + Math.cos(a) * 7, 0.3, cz + Math.sin(a) * 7, { cast: true });
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

          const ci = Math.floor(Math.random() * BUILDING_COLORS.length);
          const geo = new THREE.BoxGeometry(w, h, d);
          scaleUV(geo, Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 8)));
          const mesh = new THREE.Mesh(geo, buildingMats[ci * 2 + Math.floor(Math.random() * 2)]);
          mesh.position.set(cx, h / 2, cz);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          batch(mesh);

          // tetto piatto leggermente più scuro
          put(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), roofMat, cx, h + 0.2, cz, { cast: true });

          // porta d'ingresso su un lato a caso, con tenda da sole a colori
          const side = Math.floor(Math.random() * 4);
          const px = side === 0 ? cx - w / 2 : side === 1 ? cx + w / 2 : cx;
          const pz = side === 2 ? cz - d / 2 : side === 3 ? cz + d / 2 : cz;
          const horiz = side < 2; // la facciata guarda lungo x
          put(new THREE.BoxGeometry(horiz ? 0.12 : 1.6, 2.6, horiz ? 1.6 : 0.12), doorMat,
            px + (horiz ? (side === 0 ? 0.07 : -0.07) : 0), 1.3,
            pz + (horiz ? 0 : (side === 2 ? 0.07 : -0.07)));
          if (Math.random() < 0.5) {
            put(new THREE.BoxGeometry(horiz ? 0.9 : 2.6, 0.09, horiz ? 2.6 : 0.9), awningMats[ci],
              px + (horiz ? (side === 0 ? 0.5 : -0.5) : 0), 2.9,
              pz + (horiz ? 0 : (side === 2 ? 0.5 : -0.5)), { cast: true });
          }

          // insegna del negozio sopra la porta (la maggior parte degli edifici
          // ne ha una; la texture è una per nome, già pronta in signMats)
          if (Math.random() < 0.7) {
            put(new THREE.PlaneGeometry(4.6, 1.15), signMats[Math.floor(Math.random() * signMats.length)],
              px + (horiz ? (side === 0 ? -0.1 : 0.1) : 0), 3.6,
              pz + (horiz ? 0 : (side === 2 ? -0.1 : 0.1)),
              { ry: side === 0 ? -HPI : side === 1 ? HPI : side === 2 ? Math.PI : 0 });
          }

          // sui tetti: condizionatori e, ogni tanto, un serbatoio d'acqua
          if (Math.random() < 0.55) {
            put(new THREE.BoxGeometry(0.9, 0.6, 0.9), roofPropMat,
              cx + (Math.random() - 0.5) * (w - 3), h + 0.7, cz + (Math.random() - 0.5) * (d - 3), { cast: true });
            if (Math.random() < 0.4) {
              put(new THREE.BoxGeometry(0.9, 0.6, 0.9), roofPropMat,
                cx + (Math.random() - 0.5) * (w - 3), h + 0.7, cz + (Math.random() - 0.5) * (d - 3), { cast: true });
            }
          }
          if (Math.random() < 0.3) {
            put(new THREE.CylinderGeometry(0.7, 0.7, 1.5, 10), tankMat,
              cx + (Math.random() - 0.5) * (w - 4), h + 1.15, cz + (Math.random() - 0.5) * (d - 4), { cast: true });
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
        put(new THREE.CylinderGeometry(0.12, 0.15, 5, 6), poleMat, x + sx, 2.5, z + sz);
        put(new THREE.SphereGeometry(0.4, 10, 10), lampMat, x + sx, 5.2, z + sz);
      }
    }
  }

  // ---------- i paesini sui rilievi ----------
  // Ogni paese ha la sua terrazza in erba (scavata in terrainHeight): due
  // strade che si incrociano, otto casette col tetto a punta, lampioni,
  // un cartello di benvenuto col nome e gli alberi tutto intorno. Niente
  // traffico né semafori: laggiù si va piano. I POI portano su per i colli
  // monete e missioni, così c'è un motivo per salire.
  const townSignMat = (name) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fff8e1';
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#8d6e63';
    g.lineWidth = 16;
    g.strokeRect(8, 8, 496, 112);
    g.fillStyle = '#4a3b28';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 52;
    do {
      g.font = `bold ${size}px "Comic Sans MS", "Chalkboard SE", sans-serif`;
      size -= 4;
    } while (g.measureText(name).width > 460 && size > 24);
    g.fillText(name, 256, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map: tex });
  };

  for (const t of MINI_TOWNS) {
    const y = t.h;
    const R = t.r;

    // le due strade che si incrociano (un pelo di quota diverso: niente
    // z-fighting dove si sovrappongono)
    put(new THREE.PlaneGeometry(R * 2, TOWN_ROAD), roadMat,
      t.x, y + 0.05, t.z, { rx: -HPI, receive: true });
    put(new THREE.PlaneGeometry(TOWN_ROAD, R * 2), roadMat,
      t.x, y + 0.065, t.z, { rx: -HPI, receive: true });

    // otto casette: due per quadrante, con tetto a punta e porta verso il paese
    for (const [qx, qz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      for (const [fx, fz] of [[0.62, 0.32], [0.32, 0.62]]) {
        const cx = t.x + qx * R * fx + (Math.random() - 0.5) * 2.4;
        const cz = t.z + qz * R * fz + (Math.random() - 0.5) * 2.4;
        const w = 7 + Math.random() * 3;
        const d = 6 + Math.random() * 3;
        const hh = 3.5 + Math.random() * 2.5;
        const ci = Math.floor(Math.random() * BUILDING_COLORS.length);

        const geo = new THREE.BoxGeometry(w, hh, d);
        const mesh = new THREE.Mesh(geo, houseMats[ci]);
        mesh.position.set(cx, y + hh / 2, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        batch(mesh);

        // tetto a punta: piramide a 4 spigoli, stirata sul rettangolo della casa
        const roofG = new THREE.ConeGeometry((Math.max(w, d) / 2 + 0.7) * Math.SQRT2, 2.2, 4, 1);
        roofG.rotateY(HPI / 2);
        roofG.scale(1, 1, d / w);
        put(roofG, townRoofMats[Math.floor(Math.random() * townRoofMats.length)], cx, y + hh + 1.1, cz, { cast: true });

        // porta sul lato che guarda il centro del paese
        const horiz = Math.abs(t.x - cx) > Math.abs(t.z - cz);
        const px = horiz ? cx + Math.sign(t.x - cx) * (w / 2 + 0.07) : cx;
        const pz = horiz ? cz : cz + Math.sign(t.z - cz) * (d / 2 + 0.07);
        put(new THREE.BoxGeometry(horiz ? 0.12 : 1.4, 2.3, horiz ? 1.4 : 0.12), doorMat,
          px, y + 1.15, pz);

        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        mapBuildings.push({ x: cx, z: cz, w, d });
      }
    }

    // lampioni ai quattro angoli dell'incrocio
    for (const [sx, sz] of [[5.6, 5.6], [-5.6, -5.6], [5.6, -5.6], [-5.6, 5.6]]) {
      put(new THREE.CylinderGeometry(0.12, 0.15, 4.4, 6), poleMat, t.x + sx, y + 2.2, t.z + sz);
      put(new THREE.SphereGeometry(0.36, 10, 10), lampMat, t.x + sx, y + 4.6, t.z + sz);
    }

    // cartello di benvenuto all'ingresso (dal lato della città)
    const signMat = townSignMat(tn(t.name));
    const sxg = t.x + TOWN_ROAD / 2 + 3.2, szg = t.z + R - 5;
    put(new THREE.BoxGeometry(0.16, 2.6, 0.16), trunkMat, sxg - 2.1, y + 1.3, szg, { cast: true });
    put(new THREE.BoxGeometry(0.16, 2.6, 0.16), trunkMat, sxg + 2.1, y + 1.3, szg, { cast: true });
    put(new THREE.BoxGeometry(4.8, 1.2, 0.14), signMat, sxg, y + 2.6, szg, { cast: true });

    // alberi attorno alla radura (in piedi sul terreno, che lì pende)
    for (let k = 0; k < 8; k++) {
      const a = k * (Math.PI * 2 / 8) + 0.35 + (k % 2) * 0.2;
      const tx = t.x + Math.cos(a) * (R + 5 + (k % 3) * 4);
      const tz = t.z + Math.sin(a) * (R + 5 + (k % 3) * 4);
      addTree(tx, tz, terrainHeight(tx, tz));
    }

    // punti di interesse: qui nascono monete e missioni (in quota!)
    pois.push({ x: t.x + 8, z: t.z + 8 }, { x: t.x - R * 0.55, z: t.z - R * 0.55 });
  }

  // semafori che ciclano da soli (verde → giallo → rosso) a due terzi degli
  // incroci. Le luci condividono tre materiali animati in updateCity: anche
  // fuse in una mesh per colore, il ciclo funziona uguale.
  const tlRed = new THREE.MeshLambertMaterial({ color: 0x5a1a1a, emissive: 0x111111 });
  const tlYellow = new THREE.MeshLambertMaterial({ color: 0x5a4a1a, emissive: 0x111111 });
  const tlGreen = new THREE.MeshLambertMaterial({ color: 0x1a5a2a, emissive: 0x111111 });
  // incroci con le luci: chiavi "x|z" del centro dell'incrocio (le usa il
  // traffico per sapere dove fermarsi)
  const lights = new Set();
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
    g.rotation.y = HPI / 2; // l'angolo è (+7.4, +7.4): guarda l'incrocio
    for (const child of g.children) batch(child);
  }
  for (const x of roadCenters) {
    for (const z of roadCenters) {
      if (Math.random() < 0.4) continue;
      addTrafficLight(x + 7.4, z + 7.4);
      lights.add(x + '|' + z);
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

  // fase del semaforo per il traffico: 0 = verde, 1 = giallo, 2 = rosso
  // (tutte le luci della città sono sincronizzate: materiali in comune)
  const lightPhase = () => (tlTime < 7.5 ? 0 : tlTime < 9 ? 1 : 2);

  // punti di interesse: incroci con un po' di variazione
  for (const x of roadCenters) {
    for (const z of roadCenters) {
      pois.push({ x: x + (Math.random() * 8 - 4), z: z + (Math.random() * 8 - 4) });
    }
  }

  // qui tutte le mesh statiche sono in coda: una mesh fusa per materiale
  flushBatches();

  // ---------- mappa statica per la minimappa ----------
  // una sola immagine grande con mare, rilievi, spiaggia, prato, strade,
  // parchi ed edifici: la minimappa ne mostra ogni frame solo la parte
  // attorno al giocatore (drawImage), così costa pochissimo. La mappa
  // copre tutta l'isola (anche le colline e le montagne).
  const mapS = 1.5;           // pixel di mappa per metro
  const mapOff = 620;         // mezzo lato coperto dalla mappa
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = mapCanvas.height = mapOff * 2 * mapS;
  {
    const g = mapCanvas.getContext('2d');
    const M = (v) => (v + mapOff) * mapS; // metro -> pixel di mappa
    // mare
    g.fillStyle = '#3f97e8';
    g.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    // rilievi: una griglia di quadretti colorati secondo la quota
    // (la funzione è liscia: a passi da 4 metri la mappa resta fedele)
    const step = 4;
    const c = new THREE.Color();
    for (let wx = -mapOff; wx < mapOff; wx += step) {
      for (let wz = -mapOff; wz < mapOff; wz += step) {
        const h = terrainHeight(wx, wz);
        if (h < 0.1) continue; // sotto il livello del mare: resta mare
        terrainColorAt(h, wx, wz, c);
        g.fillStyle = c.getStyle();
        g.fillRect(M(wx), M(wz), step * mapS + 1, step * mapS + 1);
      }
    }
    // spiaggia, prato
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
    // strade dei paesini sui rilievi
    for (const t of MINI_TOWNS) {
      g.fillRect(M(t.x - t.r), M(t.z - TOWN_ROAD / 2), t.r * 2 * mapS, TOWN_ROAD * mapS);
      g.fillRect(M(t.x - TOWN_ROAD / 2), M(t.z - t.r), TOWN_ROAD * mapS, t.r * 2 * mapS);
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

  // nuvole: i "fiocchi" di ogni nuvola sono fusi in una mesh sola (la nuvola
  // si muove tutta insieme, quindi le sue parti restano insieme)
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i < 12; i++) {
    const puffs = 3 + Math.floor(Math.random() * 3);
    const geos = [];
    for (let k = 0; k < puffs; k++) {
      const s = new THREE.SphereGeometry(3 + Math.random() * 3, 10, 10);
      s.translate(k * 4 - 4, Math.random() * 2, Math.random() * 4 - 2);
      geos.push(s);
    }
    const g = new THREE.Mesh(mergeGeometries(geos), cloudMat);
    g.position.set(
      (Math.random() - 0.5) * CITY_SIZE * 1.2,
      55 + Math.random() * 25,
      (Math.random() - 0.5) * CITY_SIZE * 1.2
    );
    scene.add(g);
    clouds.push({ g, speed: 0.8 + Math.random() * 1.2 });
  }

  return { colliders, pois, clouds, roadCenters, benches, updateCity, lightPhase, lights, CITY_SIZE, HALF, map: { canvas: mapCanvas, S: mapS, off: mapOff } };
}

// Spinge un cerchio (pos, radius) fuori da tutti gli ostacoli.
// Ritorna la normale dell'ultimo urto, o null se non c'è stata collisione.
// Ostacoli a quote diverse: quelli con minY valgono solo sottoterra (i muri
// del garage), quelli con maxY solo al livello della strada o sopra (cordoli
// sul prato: chi scende in garage gli passa sotto), quelli di superficie
// solo sopra il livello della strada.
export function resolveCollisions (pos, radius, colliders) {
  const y = pos.y || 0;
  let normal = null;
  for (const c of colliders) {
    if (c.minY !== undefined) {
      if (y > c.minY) continue; // sei più in alto del muro interrato
    } else {
      // ostacolo a pelo della strada (cordoli sul prato): chi sta scendendo
      // sottoterra gli passa sotto
      if (c.maxY !== undefined && y < c.maxY) continue;
      if (y < -2) continue; // sei sotto il livello della strada: ignora gli edifici
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

  // bordi dell'isola: la città e la spiaggia sono aperte, ma oltre le
  // colline e le montagne arriva il mare: questo muro invisibile ferma
  // chi cerca di andarsene a nuoto (il terreno lì è già ripido e verde)
  const lim = 520;
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
