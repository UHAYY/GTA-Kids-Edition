// L'officina della città, nello stesso isolotto della concessionaria (di
// fronte al suo piazzale): qui rimetti a nuovo l'auto rovinata dagli
// scontri. Porta sezionale da garage, insegna dipinta, il meccanico davanti
// e una piazzola scura dove portare la macchina ("Premi E" per riparare).
import * as THREE from 'three';
import { animateRig, applyAvatar, applyBody, randomAvatarConfig } from './avatar.js';
import { tn } from './i18n.js';

function makeSignTexture () {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#eef1f4';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#455a64';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 86);
  g.fillStyle = '#455a64';
  g.font = 'bold 52px "Comic Sans MS", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(tn('🔧 OFFICINA 🔧'), 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorkshop (scene, ericFactory, colliders) {
  // angolo est dell'isolotto della concessionaria (che copre da -40 a -6):
  // di fronte al suo piazzale, lontano dalle strade
  const bx = -11, bz = -31;
  const w = 10, d = 8, h = 5;
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

  // capannone grigio-blu
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat('#78909c'));
  body.position.set(bx, h / 2, bz);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.4, d + 0.5), mat('#546e7a'));
  roof.position.set(bx, h + 0.2, bz);
  scene.add(roof);

  // porta sezionale arancione con listelli orizzontali (lato +z, verso il
  // piazzale della concessionaria: la facciata guarda l'ingresso del negozio)
  const frontZ = bz + d / 2;
  for (let i = 0; i < 6; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(6, 0.52, 0.14), mat('#f5a623'));
    slat.position.set(bx, 0.3 + i * 0.55, frontZ + 0.05);
    scene.add(slat);
  }

  // insegna sopra la porta (le plane guardano +z di default: ok così)
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.5),
    new THREE.MeshBasicMaterial({ map: makeSignTexture() })
  );
  sign.position.set(bx, h - 0.8, frontZ + 0.1);
  scene.add(sign);

  // pneumatici in pila ai lati della porta (restando dentro l'isolotto)
  for (const dx of [-(w / 2 - 0.4), w / 2 - 0.4]) {
    for (let i = 0; i < 3; i++) {
      const tyre = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14),
        mat('#263238')
      );
      tyre.position.set(bx + dx, 0.15 + i * 0.3, frontZ + 0.6);
      tyre.castShadow = true;
      scene.add(tyre);
    }
  }

  // il capannone è solido
  colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });

  // piazzola di riparazione: rettangolo di asfalto davanti alla porta
  // (quota un pelo più alta del piazzale, per evitare sfarfallio)
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5), mat('#3c4043'));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(bx, 0.05, frontZ + 2.5);
  scene.add(pad);

  // il meccanico aspetta accanto alla porta
  const mechRig = ericFactory();
  mechRig.group.position.set(bx + 4, 0, frontZ + 1.6);
  mechRig.group.rotation.y = Math.PI / 2; // guarda la piazzola
  scene.add(mechRig.group);
  const cfg = randomAvatarConfig();
  cfg.hair = 2;       // corti castani, da lavoratore
  cfg.beard = 4;      // barba piena
  cfg.shirt = 5;      // tuta azzurra da meccanico
  cfg.pants = 1;      // pantaloni neri
  cfg.shoes = 1;
  cfg.hands = 4;      // guanti neri
  cfg.heightCm = 180;
  cfg.weightKg = 88;
  applyAvatar(mechRig, cfg, scene);
  applyBody(mechRig, cfg);

  // dove portare l'auto per ripararla (davanti alla porta)
  const repairPos = new THREE.Vector3(bx, 0, frontZ + 2.5);

  return {
    repairPos,
    pos: new THREE.Vector3(bx, 0, bz), // per il marker sulla minimappa
    update (dt, t) {
      animateRig(mechRig, dt, false, false);
      mechRig.updateDecos();
    }
  };
}
