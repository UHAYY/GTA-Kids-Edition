// -------------------------------------------------------------
// Il barbiere da Tony: negozio fisso nella città, palo a strisce
// rotante e barbiere davanti alla porta. Da qui si personalizza
// l'avatar ("Premi E").
// -------------------------------------------------------------
import * as THREE from 'three';
import { animateRig, applyAvatar, applyBody, randomAvatarConfig } from './avatar.js';
import { tn } from './i18n.js';

const BLOCK_X = 23; // centro del negozio (isolotto vicino allo spawn)
const BLOCK_Z = 15;

function makeSignTexture () {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#eef7ff';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#1e5aa8';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 86);
  g.fillStyle = '#1e5aa8';
  g.font = 'bold 52px "Comic Sans MS", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(tn('✂ BARBIERE DA TONY ✂'), 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePoleTexture () {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#d32f2f';
  g.lineWidth = 12;
  for (let i = -64; i < 128; i += 32) {
    g.beginPath();
    g.moveTo(i, 0); g.lineTo(i + 64, 64);
    g.stroke();
  }
  g.strokeStyle = '#1e5aa8';
  g.lineWidth = 12;
  for (let i = -48; i < 128; i += 32) {
    g.beginPath();
    g.moveTo(i, 0); g.lineTo(i + 64, 64);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

export function createBarbershop (scene, ericFactory, colliders) {
  const shopMat = (c) => new THREE.MeshLambertMaterial({ color: c });

  // corpo del negozio
  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 12), shopMat('#eef7ff'));
  body.position.set(BLOCK_X, 3, BLOCK_Z);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);

  // banda a strisce sotto il tetto
  const band = new THREE.Mesh(new THREE.BoxGeometry(14.1, 1.1, 0.12), shopMat('#d32f2f'));
  band.position.set(BLOCK_X, 5.3, BLOCK_Z - 6.02);
  scene.add(band);

  // insegna (il piano di default guarda +z, cioè dentro il negozio:
  // va girata verso la strada altrimenti da davanti è invisibile)
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.6),
    new THREE.MeshBasicMaterial({ map: makeSignTexture() })
  );
  sign.position.set(BLOCK_X, 4.3, BLOCK_Z - 6.04);
  sign.rotation.y = Math.PI;
  scene.add(sign);

  // porta e vetrine
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.12), shopMat('#4a6fa5'));
  door.position.set(BLOCK_X, 1.4, BLOCK_Z - 6.03);
  scene.add(door);
  for (const dx of [-3.6, 3.6]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 0.1), shopMat('#a7d3f5'));
    win.position.set(BLOCK_X + dx, 1.8, BLOCK_Z - 6.03);
    scene.add(win);
  }

  // palo del barbiere rotante (sul marciapiede)
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 1.8, 16),
    new THREE.MeshLambertMaterial({ map: makePoleTexture() })
  );
  pole.position.set(BLOCK_X - 5.5, 0.9, BLOCK_Z - 7.4);
  pole.castShadow = true;
  scene.add(pole);
  const poleCap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), shopMat('#f3f3f3'));
  poleCap.position.set(BLOCK_X - 5.5, 1.9, BLOCK_Z - 7.4);
  scene.add(poleCap);
  const poleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.2, 16), shopMat('#555555'));
  poleBase.position.set(BLOCK_X - 5.5, 0.1, BLOCK_Z - 7.4);
  scene.add(poleBase);

  // collider del negozio (la facciata è a z = 9)
  colliders.push({ minX: BLOCK_X - 7, maxX: BLOCK_X + 7, minZ: BLOCK_Z - 6, maxZ: BLOCK_Z + 6 });

  // il barbiere davanti alla porta
  const barberRig = ericFactory();
  barberRig.group.position.set(BLOCK_X - 1.2, 0, BLOCK_Z - 8.4);
  barberRig.group.rotation.y = Math.PI; // guarda la strada
  scene.add(barberRig.group);
  const barberCfg = randomAvatarConfig();
  barberCfg.hair = 15;      // treccia grigia: da esperto
  barberCfg.beard = 4;      // barba piena
  barberCfg.shirt = 9;      // maglia nera da lavoro
  barberCfg.pants = 1;      // pantaloni neri
  barberCfg.shoes = 1;      // scarpe nere
  barberCfg.skin = 3;       // pelle mediterranea
  barberCfg.heightCm = 172;
  barberCfg.weightKg = 78;
  applyAvatar(barberRig, barberCfg, scene);
  applyBody(barberRig, barberCfg);

  const barberPos = barberRig.group.position.clone();

  return {
    barberRig,
    barberPos,
    update (dt, t) {
      pole.rotation.y = t * 2.5;
      animateRig(barberRig, dt, false, false);
      barberRig.updateDecos();
    }
  };
}
