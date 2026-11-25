// Elicottero della polizia: da 4 stelle in su ti sorvola e ti segue
// dappertutto con il riflettore acceso. L'unico scampo: le montagne —
// se ti nascondi in quota abbastanza a lungo, ti perde di vista e torna
// verso la città (e la polizia si segna le stelle indietro).
// È tutto cartoon: niente spara, ti tiene solo d'occhio!
import * as THREE from 'three';
import { terrainHeight } from './city.js';

const HEIGHT = 20;     // quota di crociera sopra il giocatore
const SPEED = 15;      // m/s orizzontali: una macchina veloce gli sta davanti
const LOSE_TIME = 2.5; // secondi in montagna perché ti perda di vista

export function createHelicopter (scene) {
  let h = null;        // l'elicottero in servizio (modello + rotori)
  let leaving = null;  // se ne sta andando: { t }
  let mountainT = 0;   // da quanto sei in montagna
  let t = 0;           // tempo totale, per il dondolio

  function build () {
    const g = new THREE.Group();
    const blue = new THREE.MeshLambertMaterial({ color: 0x1a3a8c });
    const dark = new THREE.MeshLambertMaterial({ color: 0x263238 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 3.6), blue);
    body.position.y = 0.2;
    body.castShadow = true;
    g.add(body);
    // muso vetrato
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.2),
      new THREE.MeshLambertMaterial({ color: 0xbfe3ff }));
    glass.position.set(0, 0.15, 2.1);
    g.add(glass);
    // coda con pinna
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 3.4), blue);
    tail.position.set(0, 0.5, -3.2);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.7), blue);
    fin.position.set(0, 1.1, -4.6);
    g.add(fin);
    // rotore principale: due pale incrociate che girano
    const rotor = new THREE.Group();
    for (const a of [0, Math.PI / 2]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(9, 0.07, 0.45), dark);
      b.rotation.y = a;
      rotor.add(b);
    }
    rotor.position.y = 1.35;
    g.add(rotor);
    const trotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.28), dark);
    trotor.position.set(0.35, 1.1, -4.6);
    g.add(trotor);
    // pattini d'atterraggio
    for (const sx of [-0.9, 0.9]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.2), dark);
      skid.position.set(sx, -1.15, 0.2);
      g.add(skid);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), dark);
      strut.position.set(sx, -0.9, 0.2);
      g.add(strut);
    }
    // riflettore: cono di luce che punta a terra
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(5.5, HEIGHT, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff59f, transparent: true,
        opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    cone.position.y = -HEIGHT / 2 - 0.9;
    g.add(cone);

    g.rotation.order = 'YXZ'; // prima guarda dove va, poi si inclina
    return { g, rotor, trotor };
  }

  function spawn (p) {
    const m = build();
    // arriva dal mare, da una direzione a caso, un po' in alto
    const a = Math.random() * Math.PI * 2;
    m.g.position.set(p.x + Math.cos(a) * 90, HEIGHT + 8, p.z + Math.sin(a) * 90);
    scene.add(m.g);
    h = { ...m, yaw: a + Math.PI };
  }

  function despawn () {
    if (h) h.g.removeFromParent();
    h = null;
    leaving = null;
    mountainT = 0;
  }

  // p: posizione del giocatore, stars: stelle della polizia.
  // onLost viene chiamato quando ti perde tra le montagne.
  // Ritorna 'spawned' al momento del arrivo (per il messaggio in HUD).
  function update (dt, p, stars, onLost) {
    t += dt;
    const inMountains = terrainHeight(p.x, p.z) > 10;

    if (!h) {
      if (stars >= 4) { spawn(p); return 'spawned'; }
      return null;
    }

    if (leaving || stars < 4) {
      // rientro verso il centro città, in quota: quando è lontano sparisce
      leaving = leaving || { t: 0 };
      leaving.t += dt;
      const g = h.g;
      const dx = -g.position.x, dz = -g.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      g.position.x += dx / dist * 24 * dt;
      g.position.z += dz / dist * 24 * dt;
      g.position.y += (HEIGHT + 14 - g.position.y) * Math.min(1, dt);
      const want = Math.atan2(dx, dz);
      let diff = want - h.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      h.yaw += Math.max(-2 * dt, Math.min(2 * dt, diff));
      g.rotation.y = h.yaw;
      g.rotation.x = -0.12; // punta in avanti, leggermente in salita
      h.rotor.rotation.y += 22 * dt;
      h.trotor.rotation.x += 30 * dt;
      if (leaving.t > 6 || dist < 30) despawn();
      return null;
    }

    // --- ti insegue: si porta sopra di te e ti segue col riflettore ---
    const g = h.g;
    const dx = p.x - g.position.x;
    const dz = p.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    const sp = Math.min(SPEED + stars, dist);
    if (dist > 0.01) {
      g.position.x += dx / dist * sp * dt;
      g.position.z += dz / dist * sp * dt;
    }
    // quota: dondola un po' su se stessa, come veri elicotteri
    g.position.y += (p.y + HEIGHT - g.position.y) * Math.min(1, dt * 1.2);
    g.position.y += Math.sin(t * 2.6) * 0.35 * dt;

    const want = Math.atan2(dx, dz);
    let diff = want - h.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    h.yaw += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
    g.rotation.y = h.yaw;
    g.rotation.x = Math.min(0.22, sp * 0.012); // si piega in avanti quando corre
    h.rotor.rotation.y += 22 * dt;
    h.trotor.rotation.x += 30 * dt;

    // scampo: stai in montagna un attimo e ti perde di vista
    if (inMountains) {
      mountainT += dt;
      if (mountainT > LOSE_TIME) {
        leaving = { t: 0 };
        if (onLost) onLost();
      }
    } else {
      mountainT = 0;
    }
    return 'chasing';
  }

  return { update };
}
