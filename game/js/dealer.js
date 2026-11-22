// -------------------------------------------------------------
// La concessionaria di Stella: negozio fisso nella città con un
// autosalone vetrinato, le auto in vendita che girano sui podi e
// una commessa davanti alla porta ("Premi E" per aprire il negozio).
// Il negozio in sé (prezzi, acquisti) vive in main.js.
// -------------------------------------------------------------
import * as THREE from 'three';
import { animateRig, applyAvatar, applyBody, randomAvatarConfig } from './avatar.js';
import { tn } from './i18n.js';

// centro dell'isolotto riservato (block 3*GRID+3, vedi SKIP in main.js)
const BLOCK_X = -23;
const BLOCK_Z = -23;

function makeSignTexture () {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#fff8f0';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#e65100';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 86);
  g.fillStyle = '#e65100';
  g.font = 'bold 50px "Comic Sans MS", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(tn('🚗 CONCESSIONARIA 🚗'), 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDealership (scene, ericFactory, colliders, shopCars) {
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

  // piazzale pavimentato davanti all'officina
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat('#cfd5da'));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(BLOCK_X, 0.02, BLOCK_Z);
  lot.receiveShadow = true;
  scene.add(lot);

  // corpo dell'officina (vetrata arancione e bianca)
  const body = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 10), mat('#fff3e6'));
  body.position.set(BLOCK_X, 3, BLOCK_Z + 11);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);

  const band = new THREE.Mesh(new THREE.BoxGeometry(16.1, 1.1, 0.12), mat('#e65100'));
  band.position.set(BLOCK_X, 5.3, BLOCK_Z + 6.02);
  scene.add(band);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 1.6),
    new THREE.MeshBasicMaterial({ map: makeSignTexture() })
  );
  sign.position.set(BLOCK_X, 4.3, BLOCK_Z + 6.04); // guarda la strada (-z)
  scene.add(sign);

  // vetrata tutta in vetro (si vede l'interno… quasi!)
  const glass = new THREE.Mesh(new THREE.BoxGeometry(14, 3.4, 0.12), mat('#a7d3f5'));
  glass.position.set(BLOCK_X, 1.9, BLOCK_Z + 6.03);
  scene.add(glass);
  for (const dx of [-4.6, 0, 4.6]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 0.16), mat('#8d5a2b'));
    frame.position.set(BLOCK_X + dx, 1.9, BLOCK_Z + 6.03);
    scene.add(frame);
  }

  colliders.push({ minX: BLOCK_X - 8, maxX: BLOCK_X + 8, minZ: BLOCK_Z + 6, maxZ: BLOCK_Z + 16 });

  // niente più auto esposte fuori: con 10 modelli il piazzale sporgeva sulle
  // due strade laterali e le bloccava. Si compra dal pannello di Stella.

  // la commessa Stella davanti alla vetrata
  const dealerRig = ericFactory();
  dealerRig.group.position.set(BLOCK_X + 2.2, 0, BLOCK_Z + 3.2);
  dealerRig.group.rotation.y = Math.PI; // guarda il piazzale
  scene.add(dealerRig.group);
  const cfg = randomAvatarConfig();
  cfg.hair = 8;       // mohawk: stile da pilota
  cfg.beard = 0;
  cfg.shirt = 2;      // maglia gialla del negozio
  cfg.pants = 1;
  cfg.shoes = 3;
  cfg.heightCm = 168;
  cfg.weightKg = 58;
  applyAvatar(dealerRig, cfg, scene);
  applyBody(dealerRig, cfg);

  const dealerPos = dealerRig.group.position.clone();

  return {
    dealerRig,
    dealerPos,
    update (dt, t) {
      animateRig(dealerRig, dt, false, false);
      dealerRig.updateDecos();
    }
  };
}
