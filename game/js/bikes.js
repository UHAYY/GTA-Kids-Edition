// -------------------------------------------------------------
// Le bici: modelli low-poly costruiti a mano (niente file da caricare).
// Si trovano parcheggiate in giro per la città e si "prendono" con E
// (la polizia le considera rubate!) oppure si comprano dalla
// concessionaria. Una volta in mano si guidano come le auto, ma più
// agili: niente danni, retromarcia corta e collisioni più strette.
// -------------------------------------------------------------
import * as THREE from 'three';

// materiali in comune a tutte le bici (creati una sola volta)
const tireMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
const metalMat = new THREE.MeshLambertMaterial({ color: 0x9aa5ad });
const saddleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
const frameMats = new Map(); // colore -> materiale (una tinta = un materiale)

const HPI = Math.PI / 2;

export const BIKE_KINDS = [
  { nome: '🚲 Citybike', color: '#2e7dd1', kind: 'city', topSpeed: 8, price: 1500 },
  { nome: '🚲 BMX', color: '#e53935', kind: 'bmx', topSpeed: 9.5, price: 3000 },
  { nome: '🚴 Bici da corsa', color: '#ffb300', kind: 'corsa', topSpeed: 12, price: 5500 }
];

// Costruisce una bici. kind: 'city' | 'bmx' | 'corsa'.
// La bici guarda +z (come le auto): il manubrio davanti a +z.
export function createBike (color = '#e53935', kind = 'city') {
  const g = new THREE.Group();
  const params = {
    city: { wheel: 0.32, tube: 0.05, base: 0.36 },
    bmx: { wheel: 0.27, tube: 0.055, base: 0.42 },
    corsa: { wheel: 0.36, tube: 0.04, base: 0.32 }
  }[kind] || { wheel: 0.32, tube: 0.05, base: 0.36 };
  const R = params.wheel;

  let frameMat = frameMats.get(color);
  if (!frameMat) { frameMat = new THREE.MeshLambertMaterial({ color }); frameMats.set(color, frameMat); }

  const part = (geo, mat2, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(geo, mat2);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
    return m;
  };

  // due ruote (tori in piedi, girati per rotolare lungo z)
  for (const wz of [-R * 2.1, R * 2.1]) {
    part(new THREE.TorusGeometry(R, params.tube, 8, 20), tireMat, 0, R, wz, 0)
      .rotation.y = HPI;
  }
  // razze: un disco sottile dentro ogni ruota, così la ruota si vede piena
  for (const wz of [-R * 2.1, R * 2.1]) {
    part(new THREE.CylinderGeometry(R * 0.82, R * 0.82, 0.02, 12), metalMat, 0, R, wz)
      .rotation.z = HPI; // disco in piedi, nel piano della ruota
  }

  // telaio: tubo obliquo da sotto il sellino al derivante della forcella
  const frame = part(new THREE.CylinderGeometry(params.tube, params.tube, R * 3.4, 6), frameMat, 0, R * 1.9, 0);
  frame.rotation.x = 0.32;
  // tubo del sellino
  part(new THREE.CylinderGeometry(params.tube * 0.8, params.tube * 0.8, R * 1.7, 6), frameMat, 0, R * 1.9, -R * 1.35);
  // forcella davanti (leggermente inclinata)
  const fork = part(new THREE.CylinderGeometry(params.tube * 0.8, params.tube * 0.8, R * 1.9, 6), frameMat, 0, R * 1.75, R * 1.85);
  fork.rotation.x = -0.18;
  // manubrio: barra trasversale + impugnature
  part(new THREE.CylinderGeometry(0.028, 0.028, kind === 'bmx' ? 0.62 : 0.52, 6), metalMat, 0, R * 2.6, R * 1.78)
    .rotation.z = HPI; // la barra sta lungo x (trasversale)
  // sellino
  part(new THREE.BoxGeometry(0.16, 0.06, kind === 'corsa' ? 0.34 : 0.28), saddleMat, 0, R * 2.75, -R * 1.4);
  // pedali con la catena (un disco e due pedallette)
  part(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), metalMat, 0, R, R * 0.1)
    .rotation.z = HPI;

  g.userData = { bike: true, size: [R * 4.2 + 0.4, R * 3.4], kind };
  return g;
}
