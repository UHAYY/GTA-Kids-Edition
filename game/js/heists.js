// Rapine: banca, gioielleria e supermarket. Ogni negozio ha una porta dove
// si preme E per rapinarlo (serve il sangue freddo: restare fermi 4 secondi).
// (I nascondigli "P" ora sono i garage sotterranei, vedi garage.js.)
import * as THREE from 'three';
import { tn } from './i18n.js';

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
  function addSpot (icon, name, bx, bz, faceDir, stars, reward, color, h) {
    const w = 16, d = 12;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    );
    body.position.set(bx, h / 2, bz);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
      new THREE.MeshLambertMaterial({ color: 0x5b636b })
    );
    roof.position.set(bx, h + 0.25, bz);
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
    door.position.set(doorX, 1.4, doorZ);
    scene.add(door);

    // insegna grande sopra la porta
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.2),
      makeSign(icon + ' ' + name, '#ffffff')
    );
    sign.position.set(
      doorX + dx * 0.1 + (horiz ? 0 : dz * 0),
      4.6,
      doorZ + dz * 0.1
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

  return { spots };
}
