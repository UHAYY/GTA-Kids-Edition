// I parcheggi sotterranei della città (al posto dei parcheggi "P" sulla
// strada): un ingresso in superficie come quello dei veri garage — cornice
// in cemento, sbarra rossa e bianca, cartello "2 m" e "P" blu — una rampa
// che scende, e sotto il livello della strada la sala con i posti dipinti,
// i pilastri e le luci al soffitto.
// La fisica resta 2D: l'altezza segue la posizione sulla rampa (surfaceY),
// e i muri del garage sono collider attivi solo sottoterra (minY).
import * as THREE from 'three';
import { terrainHeight } from './city.js';

export const GARAGE_DEPTH = 8;
const RAMP_START = 12;  // z relativa dove inizia la discesa (quota 0)
const RAMP_END = -2;    // z relativa del fondo rampa (quota -DEPTH)
const RAMP_LEN = RAMP_START - RAMP_END;
const ROOM_HALF_W = 9;  // mezza larghezza della sala
const ROOM_BACK = -16;  // z relativa del fondo sala
const ROOM_FRONT = -2;

const garages = []; // registri di tutti i garage creati (per surfaceY)

// il buco nel prato arriva fin qui: dietro l'ingresso c'è ancora l'erba
// (così girando per l'isolotto non si cade nella rampa)
const OPEN_BACK = 7.5;

// i 4 siti dei garage (stessi numeri usati in main.js per i SKIP):
// servono anche a city.js per ritagliare il prato sopra le rampe
export const GARAGE_SITES = [[-69, -69], [69, -23], [-69, 115], [115, 23]];

// il rettangolo di prato da ritagliare sopra la rampa: solo il tratto
// vicino all'ingresso, così si vede la discesa ma dietro c'è l'erba
export function groundHoleFor (gx, gz) {
  // appena più larga della rampa coi cordoli: niente fessure ai lati
  return { minX: gx - 3.3, maxX: gx + 3.3, minZ: gz + OPEN_BACK, maxZ: gz + RAMP_START + 0.5 };
}

// Quota del pavimento sotto i piedi/le ruote in un punto: 0 in strada,
// la discesa lungo la rampa, -GARAGE_DEPTH dentro la sala.
// who tiene lo stato (under: sei dentro un garage; onRamp: sei già in
// discesa). Il tratto di rampa coperto dall'erba vale come pavimento
// solo per chi è già in discesa: chi cammina sul prato ci resta sopra.
export function surfaceY (who, x, z) {
  who.under = who.under || 0;
  for (const g of garages) {
    const dx = x - g.gx;
    const dz = z - g.gz;
    if (Math.abs(dx) <= 3 && dz >= RAMP_END && dz <= RAMP_START) {
      if (dz < OPEN_BACK && !who.under && !who.onRamp) return 0; // prato
      who.onRamp = true;
      // sulla rampa: la quota segue la posizione lungo la discesa
      const y = -GARAGE_DEPTH * ((RAMP_START - dz) / RAMP_LEN);
      who.under = y < -GARAGE_DEPTH / 2 ? 1 : 0;
      return y;
    }
    if (who.under && Math.abs(dx) <= ROOM_HALF_W && dz >= ROOM_BACK && dz <= ROOM_FRONT) {
      who.onRamp = false;
      return -GARAGE_DEPTH; // dentro il garage
    }
  }
  who.onRamp = false;
  who.under = 0;
  // fuori dai garage la quota è quella del terreno: pianura in città,
  // colline e montagne oltre la spiaggia
  return terrainHeight(x, z);
}

function canvasTex (w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const P_TEX = () => canvasTex(128, 128, (g) => {
  g.fillStyle = '#1565c0';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  g.strokeRect(8, 8, 112, 112);
  g.fillStyle = '#ffffff';
  g.font = 'bold 84px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('P', 64, 70);
});

const STRIPE_TEX = () => canvasTex(256, 32, (g) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#d32f2f';
    g.fillRect(i * 32, 0, 32, 32);
  }
});

export function createGarage (scene, colliders, gx, gz, carPrefabs) {
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

  // ---------------- struttura in superficie ----------------
  // cornice in cemento: due pilastri, trave e lastrico solido sopra
  const pillarGeo = new THREE.BoxGeometry(1.2, 4.2, 5);
  for (const sx of [-4.6, 4.6]) {
    const pillar = new THREE.Mesh(pillarGeo, mat('#b8b0a4'));
    pillar.position.set(gx + sx, 2.1, gz + 14);
    pillar.castShadow = true;
    scene.add(pillar);
    // i pilastri sono solidi: si entra in mezzo
    colliders.push({ minX: gx + sx - 0.6, maxX: gx + sx + 0.6, minZ: gz + 11.5, maxZ: gz + 16.5 });
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.2, 5), mat('#a8a094'));
  beam.position.set(gx, 4.8, gz + 14);
  beam.castShadow = true;
  scene.add(beam);
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.4, 7.5), mat('#8f887c'));
  roofSlab.position.set(gx, 5.6, gz + 13.7);
  roofSlab.castShadow = true;
  scene.add(roofSlab);

  // sbarra rossa e bianca sotto la trave (come nel garage vero)
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.55, 0.2),
    new THREE.MeshLambertMaterial({ map: STRIPE_TEX() })
  );
  bar.position.set(gx, 3.6, gz + 16.4);
  scene.add(bar);

  // cartello P blu su palo, accanto all'ingresso
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), mat('#546e7a'));
  pole.position.set(gx + 6.2, 1.6, gz + 15.5);
  pole.castShadow = true;
  scene.add(pole);
  const pSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: P_TEX() })
  );
  pSign.position.set(gx + 6.2, 3.6, gz + 15.4);
  pSign.rotation.y = Math.PI / 2; // di lato, si vede sia da chi arriva che da chi passa
  scene.add(pSign);

  // ---------------- rampa di discesa ----------------
  // piano inclinato (visuale: la quota vera la dà surfaceY)
  const hyp = Math.sqrt(RAMP_LEN * RAMP_LEN + GARAGE_DEPTH * GARAGE_DEPTH);
  const slope = Math.atan2(GARAGE_DEPTH, RAMP_LEN);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, hyp), mat('#5d6266'));
  ramp.rotation.x = -slope;
  ramp.position.set(gx, -GARAGE_DEPTH / 2 - 0.25, gz + (RAMP_START + RAMP_END) / 2);
  ramp.receiveShadow = true;
  scene.add(ramp);
  // cordoli della rampa
  for (const sx of [-3.1, 3.1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, hyp), mat('#9aa2a8'));
    curb.rotation.x = -slope;
    curb.position.set(gx + sx, -GARAGE_DEPTH / 2 + 0.15, gz + (RAMP_START + RAMP_END) / 2);
    scene.add(curb);
  }
  // muretti guida invisibili: tengono l'auto sulla rampa appena scesa
  for (const sx of [-3.2, 3.2]) {
    colliders.push({ minX: gx + sx - 0.3, maxX: gx + sx + 0.3, minZ: gz + RAMP_END, maxZ: gz + RAMP_START, minY: -0.5 });
  }

  // architrave scuro sopra il varco d'ingresso (bordo del "buco" nel prato)
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.5, 2.6), mat('#6d685f'));
  lintel.position.set(gx, 1.4, gz + 11.3);
  scene.add(lintel);
  // e il suo sottoscalino: chiude la fessura col soffitto della rampa
  // (bordo a 0.675: l'auto che entra ha il tetto a 0.7, non lo tocca)
  const soffit = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.9, 2.6), mat('#5d584f'));
  soffit.position.set(gx, 0.225, gz + 11.3);
  scene.add(soffit);

  // asfaltato in cemento davanti al varco (la discesa parte da qui)
  const apron = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 5.4), mat('#8d9196'));
  apron.position.set(gx, 0.03, gz + 14.2);
  apron.receiveShadow = true;
  scene.add(apron);

  // ---------------- sala sotterranea ----------------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_HALF_W * 2 + 2, -(ROOM_BACK) + 2),
    mat('#61666b')
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(gx, -GARAGE_DEPTH + 0.02, gz + (ROOM_BACK + ROOM_FRONT) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // muri in cemento (con l'apertura dove arriva la rampa)
  const wallH = GARAGE_DEPTH;
  const addWall = (w, d, x, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), mat('#cfc8ba'));
    wall.position.set(x, -GARAGE_DEPTH / 2, z);
    wall.receiveShadow = true;
    scene.add(wall);
  };
  // fondo e lati
  addWall(ROOM_HALF_W * 2 + 1, 0.5, gx, gz + ROOM_BACK - 0.25);
  addWall(0.5, -(ROOM_BACK) , gx - ROOM_HALF_W - 0.25, gz + (ROOM_BACK + ROOM_FRONT) / 2);
  addWall(0.5, -(ROOM_BACK), gx + ROOM_HALF_W + 0.25, gz + (ROOM_BACK + ROOM_FRONT) / 2);
  // lato strada: due tronconi con il varco in mezzo (larghezza rampa)
  const segW = ROOM_HALF_W - 3;
  addWall(segW, 0.5, gx - (3 + segW / 2), gz + ROOM_FRONT + 0.25);
  addWall(segW, 0.5, gx + (3 + segW / 2), gz + ROOM_FRONT + 0.25);
  // collider dei muri: attivi solo quando sei sottoterra
  colliders.push({ minX: gx - ROOM_HALF_W - 0.5, maxX: gx + ROOM_HALF_W + 0.5, minZ: gz + ROOM_BACK - 0.5, maxZ: gz + ROOM_BACK, minY: -5 });
  colliders.push({ minX: gx - ROOM_HALF_W - 0.5, maxX: gx - ROOM_HALF_W, minZ: gz + ROOM_BACK - 0.5, maxZ: gz + ROOM_FRONT, minY: -5 });
  colliders.push({ minX: gx + ROOM_HALF_W, maxX: gx + ROOM_HALF_W + 0.5, minZ: gz + ROOM_BACK - 0.5, maxZ: gz + ROOM_FRONT, minY: -5 });
  colliders.push({ minX: gx - ROOM_HALF_W - 0.5, maxX: gx - 3, minZ: gz + ROOM_FRONT, maxZ: gz + ROOM_FRONT + 0.5, minY: -5 });
  colliders.push({ minX: gx + 3, maxX: gx + ROOM_HALF_W + 0.5, minZ: gz + ROOM_FRONT, maxZ: gz + ROOM_FRONT + 0.5, minY: -5 });

  // soffitto: copre la sala e il tratto di rampa nascosto dall'erba
  // (il buco nel prato resta scoperto: dal fuori si vede la discesa)
  const ceil1 = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF_W * 2 + 2, 0.4, OPEN_BACK - ROOM_BACK + 1), mat('#3a3f44'));
  ceil1.position.set(gx, -0.4, gz + (ROOM_BACK + OPEN_BACK) / 2);
  ceil1.castShadow = true;
  scene.add(ceil1);

  // pareti di cemento a mestolo lungo la rampa: chiudono il sottoterra
  // ai lati (dal buco si vede il cemento, non il vuoto oltre il mondo)
  const trenchGeo = new THREE.BoxGeometry(0.3, 8.5, RAMP_LEN + 1);
  for (const sx of [-3.45, 3.45]) {
    const w = new THREE.Mesh(trenchGeo, mat('#8a9096'));
    w.position.set(gx + sx, -0.01 - 8.5 / 2, gz + (RAMP_START + RAMP_END) / 2);
    scene.add(w);
  }

  // cordoli attorno al buco aperto: dal prato non si cade dentro, l'unica
  // via è l'ingresso. Sono ostacoli a livello del PRATO (maxY -0.5): l'auto
  // che scende lungo la rampa li ha già sotto i piedi e li attraversa
  // (il suo muso sporge 2,4 m: senza maxY il cordolo del fondo la blocca
  // a metà rampa come un muro invisibile)
  const curbMat = mat('#9aa2a8');
  const backCurb = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 0.4), curbMat);
  backCurb.position.set(gx, 0.25, gz + OPEN_BACK - 0.2);
  scene.add(backCurb);
  const sideLen = RAMP_START + 0.4 - (OPEN_BACK - 0.2);
  for (const sx of [-3.8, 3.8]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, sideLen), curbMat);
    c.position.set(gx + sx, 0.25, gz + (OPEN_BACK - 0.2 + RAMP_START + 0.4) / 2);
    scene.add(c);
  }
  colliders.push({ minX: gx - 4, maxX: gx + 4, minZ: gz + OPEN_BACK - 0.4, maxZ: gz + OPEN_BACK, maxY: -0.5 });
  colliders.push({ minX: gx - 4, maxX: gx - 3.6, minZ: gz + OPEN_BACK - 0.4, maxZ: gz + RAMP_START + 0.5, maxY: -0.5 });
  colliders.push({ minX: gx + 3.6, maxX: gx + 4, minZ: gz + OPEN_BACK - 0.4, maxZ: gz + RAMP_START + 0.5, maxY: -0.5 });

  // pilastri in mezzo alla sala (lascia libere le file dei posti laterali)
  for (const px of [-3.8, 3.8]) {
    for (const pz of [ROOM_BACK + 5, ROOM_FRONT - 5]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, wallH, 10), mat('#b8b0a4'));
      pillar.position.set(gx + px, -GARAGE_DEPTH / 2, gz + pz);
      scene.add(pillar);
      colliders.push({ minX: gx + px - 0.6, maxX: gx + px + 0.6, minZ: gz + pz - 0.6, maxZ: gz + pz + 0.6, minY: -5 });
    }
  }

  // luci al soffitto (barre luminose)
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3c9 });
  for (const px of [-4.5, 0, 4.5]) {
    for (const pz of [ROOM_BACK + 4, ROOM_FRONT - 4]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.45), lampMat);
      lamp.position.set(gx + px, -1.05, gz + pz);
      scene.add(lamp);
    }
  }

  // posti auto dipinti a terra, lungo i due muri laterali
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.18), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(gx + side * (ROOM_HALF_W - 2.3), -GARAGE_DEPTH + 0.04, gz + ROOM_FRONT - 1.4 - k * 2.45);
      scene.add(line);
    }
  }

  // qualche auto già parcheggiata (cloni di modelli civili medi)
  const civili = (carPrefabs || []).filter(p => {
    const [L, H] = p.userData.size;
    return L >= 3.6 && L <= 5.2 && H <= 2;
  });
  const slots = [
    [gx - ROOM_HALF_W + 2.3, gz + ROOM_FRONT - 3.4, Math.PI / 2],
    [gx - ROOM_HALF_W + 2.3, gz + ROOM_FRONT - 8.3, Math.PI / 2],
    [gx + ROOM_HALF_W - 2.3, gz + ROOM_FRONT - 5.8, -Math.PI / 2]
  ];
  for (const [px, pz, rot] of slots) {
    if (!civili.length) break;
    const model = civili[Math.floor(Math.random() * civili.length)].clone();
    model.position.set(px, -GARAGE_DEPTH, pz);
    model.rotation.y = rot;
    scene.add(model);
    // solida (sottoterra): la lunghezza ora è lungo x (ruotata di 90°)
    const [L, H, W] = model.userData.size;
    colliders.push({ minX: px - L / 2 - 0.1, maxX: px + L / 2 + 0.1, minZ: pz - W / 2 - 0.1, maxZ: pz + W / 2 + 0.1, minY: -5 });
  }

  garages.push({ gx, gz });
  return { pad: { x: gx, z: gz, r: 22 } }; // per la polizia (ti nascondi qui) e la minimappa
}
