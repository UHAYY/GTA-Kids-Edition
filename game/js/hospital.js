// L'ospedale della città: fabbricato bianco con croce rossa, ingresso con
// tenda, ambulanza parcheggiata davanti. Qui riappare il giocatore quando
// viene messo K.O. o arrestato (e qui resta la sua auto, davanti all'ingresso).
import * as THREE from 'three';
import { tn } from './i18n.js';

export function createHospital (scene, colliders) {
  const bx = -115, bz = 115;           // isoletto riservato (1,6)
  const w = 18, d = 14, h = 10;

  // fabbricato bianco
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: 0xf2f4f5 })
  );
  body.position.set(bx, h / 2, bz);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd8dde0 })
  );
  roof.position.set(bx, h + 0.25, bz);
  scene.add(roof);

  // banda rossa lungo la facciata (lato sud, verso la strada)
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.8, 0.06),
    new THREE.MeshLambertMaterial({ color: 0xd32f2f })
  );
  stripe.position.set(bx, h - 1.6, bz - d / 2 - 0.02);
  scene.add(stripe);

  // insegna: croce rossa grande + scritta OSPEDALE
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 160);
  g.fillStyle = '#d32f2f';
  // croce rossa a sinistra
  g.fillRect(16, 20, 120, 120);
  g.fillRect(-20, 58, 196, 44);
  g.fillStyle = '#222222';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const signText = tn('OSPEDALE');
  let size = 80;
  do {
    g.font = `bold ${size}px "Comic Sans MS", "Chalkboard SE", sans-serif`;
    size -= 4;
  } while (g.measureText(signText).width > 380 && size > 30);
  g.fillText(signText, 310, 84);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 3.1),
    new THREE.MeshLambertMaterial({ map: tex })
  );
  sign.position.set(bx, 6.6, bz - d / 2 - 0.1);
  sign.rotation.y = Math.PI; // guarda la strada (l'ingresso è sul lato -z)
  scene.add(sign);

  // portoncini vetrati (due ante azzurre)
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8f0 });
  for (const off of [-0.9, 0.9]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 0.12), glassMat);
    panel.position.set(bx + off, 1.6, bz - d / 2 - 0.05);
    scene.add(panel);
  }

  // tenda dell'ingresso (il "prafo" del pronto soccorso) su due pilastri
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.3, 3),
    new THREE.MeshLambertMaterial({ color: 0xd32f2f })
  );
  canopy.position.set(bx, 4.4, bz - d / 2 - 1.6);
  canopy.castShadow = true;
  scene.add(canopy);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x9aa2a8 });
  for (const off of [-3.1, 3.1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 8), poleMat);
    pole.position.set(bx + off, 2.2, bz - d / 2 - 2.9);
    scene.add(pole);
  }

  // ambulanza in primissimo piano: bianca con croce rossa e girofaro
  const amb = new THREE.Group();
  const vanBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.9, 4.6),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  vanBody.position.y = 1.25;
  vanBody.castShadow = true;
  amb.add(vanBody);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.2, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  cab.position.set(0, 1.0, 2.7);
  amb.add(cab);
  const wind = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.7, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x9fd8f0 })
  );
  wind.position.set(0, 1.15, 3.4);
  amb.add(wind);
  // croce rossa sui lati
  const redMat = new THREE.MeshLambertMaterial({ color: 0xd32f2f });
  for (const side of [-1.11, 1.11]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.28), redMat);
    a.position.set(side, 1.35, -0.6);
    amb.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.9), redMat);
    b.position.set(side, 1.35, -0.6);
    amb.add(b);
  }
  const lightBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.16, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  );
  lightBar.position.set(0, 2.3, 1.2);
  amb.add(lightBar);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const wz of [1.6, -1.6]) {
    for (const wx of [-1.05, 1.05]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      amb.add(wheel);
    }
  }
  amb.position.set(bx + 6.5, 0, bz - d / 2 - 3.2);
  amb.rotation.y = Math.PI / 2; // rivolta verso la strada
  scene.add(amb);
  // niente attraversamenti: l'ambulanza è solida
  colliders.push({
    minX: amb.position.x - 2.4, maxX: amb.position.x + 2.4,
    minZ: amb.position.z - 1.2, maxZ: amb.position.z + 1.2
  });

  // punti di ritorno: davanti alla porta (giocatore) e sulla strada (auto,
  // sul lato destro così non blocca il traffico)
  const spawn = new THREE.Vector3(bx, 0, bz - d / 2 - 3.4);
  const carSpot = new THREE.Vector3(bx, 0, 88.5);
  return { spawn, carSpot, carHeading: 0 };
}
