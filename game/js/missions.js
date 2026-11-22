// Le missioni: tutti compiti di buon vicinato, zero violenza!
// Ritira e consegna pizze, pacchi, regali e altro seguendo il faro luminoso.
import * as THREE from 'three';
import { t as tr, locale } from './i18n.js';

// ogni missione ha le sue frasi per lingua (m_<key>_pickup / m_<key>_deliver)
const TYPES = [
  { icon: '🍕', key: 'pizza' },
  { icon: '📦', key: 'pacco' },
  { icon: '🎁', key: 'regalo' },
  { icon: '🧁', key: 'dolci' },
  { icon: '🩹', key: 'nonno' }
];

function randPOI (pois) { return pois[Math.floor(Math.random() * pois.length)]; }

// Faro luminoso con icona emoji fluttuante
function makeBeacon (color, icon) {
  const group = new THREE.Group();

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.4, 7, 20, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 3.5;
  group.add(beam);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.3, 0.18, 10, 32),
    new THREE.MeshBasicMaterial({ color })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  group.add(ring);

  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '96px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(icon, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(2.6, 2.6, 1);
  sprite.position.y = 8.2;
  group.add(sprite);

  group.userData.sprite = sprite;
  return group;
}

// Freccia gialla che galleggia sopra il giocatore indicando l'obiettivo
function makePointer () {
  const geo = new THREE.ConeGeometry(0.5, 1.2, 6);
  geo.rotateX(Math.PI / 2); // punta verso +Z, poi la ruotiamo verso l'obiettivo
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd600 }));
}

export function createMissions (scene, pois) {
  const pointer = makePointer();
  pointer.visible = false;
  scene.add(pointer);

  return {
    scene, pois, pointer,
    coins: 0,
    completed: 0,
    phase: 'idle', // 'idle' | 'pickup' | 'deliver'
    type: null,
    pickupPos: null,
    targetPos: null,
    beacon: null,
    nextTimer: 0
  };
}

function setBeacon (m, pos, color) {
  if (m.beacon) m.scene.remove(m.beacon);
  m.beacon = makeBeacon(color, m.type.icon);
  m.beacon.position.set(pos.x, 0, pos.z);
  m.scene.add(m.beacon);
  m.pointer.visible = true;
}

export function startMission (m) {
  m.type = TYPES[Math.floor(Math.random() * TYPES.length)];
  const a = randPOI(m.pois);
  let b = randPOI(m.pois);
  let guard = 0;
  while (Math.hypot(a.x - b.x, a.z - b.z) < 70 && guard++ < 50) b = randPOI(m.pois);
  m.pickupPos = a;
  m.targetPos = b;
  m.phase = 'pickup';
  setBeacon(m, a, 0xffc107);
}

export function updateMissions (m, dt, playerPos, hud, sfx) {
  const t = performance.now() / 1000;

  // anima il faro attivo
  if (m.beacon) {
    m.beacon.userData.sprite.position.y = 8.2 + Math.sin(t * 2.5) * 0.35;
    m.beacon.userData.sprite.material.rotation = Math.sin(t * 1.5) * 0.15;
    m.beacon.rotation.y = t * 0.8;
  }

  if (m.phase !== 'idle') {
    const target = m.phase === 'pickup' ? m.pickupPos : m.targetPos;
    const dx = target.x - playerPos.x;
    const dz = target.z - playerPos.z;
    const dist = Math.hypot(dx, dz);

    // freccia sopra la testa del giocatore (o il tetto dell'auto), che
    // punta verso l'obiettivo
    m.pointer.position.set(
      playerPos.x,
      5.4 + Math.sin(t * 3) * 0.25,
      playerPos.z
    );
    m.pointer.rotation.y = Math.atan2(dx, dz);

    hud.missionText.textContent = m.phase === 'pickup'
      ? tr('m_' + m.type.key + '_pickup', { d: Math.round(dist) })
      : tr('m_' + m.type.key + '_deliver', { d: Math.round(dist) });

    // arrivo al faro
    if (dist < 4.5) {
      if (m.phase === 'pickup') {
        m.phase = 'deliver';
        setBeacon(m, m.targetPos, 0x66bb6a);
        sfx.pickup();
        hud.toast(tr('m_pickup_ok'));
      } else {
        m.phase = 'idle';
        m.completed++;
        m.coins += 60; // la mancia per una consegna
        hud.missions.textContent = m.completed;
        hud.coins.textContent = m.coins.toLocaleString(locale());
        m.pointer.visible = false;
        if (m.beacon) { m.scene.remove(m.beacon); m.beacon = null; }
        sfx.complete();
        hud.toast(tr('m_done'));
        hud.missionText.textContent = tr('m_next');
        m.nextTimer = 3;
      }
    }
  } else if (m.nextTimer > 0) {
    m.nextTimer -= dt;
    if (m.nextTimer <= 0) startMission(m);
  }
}
