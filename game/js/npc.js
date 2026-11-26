// Passerelle AI: avatar Eric che camminano per la città e ogni tanto si fermano.
// Se un'auto gli passa addosso veloce, volano in ragdoll alla cartoon, restano
// a terra 3 secondi e poi si rialzano con la clip "Getting Up".
import * as THREE from 'three';
import { resolveCollisions, resolveCircles, CITY_SIZE, MINI_TOWNS } from './city.js';
import { randomAvatarConfig, applyAvatar, applyBody, animateRig } from './avatar.js';

// i passanti restano in città e sulla spiaggia: sulle colline non hanno
// nulla da fare (e il terreno lì non seguirebbe le loro gambe)
const NPC_LIM = CITY_SIZE / 2 + 12;

export function createNPCs (scene, count, colliders, pois, ericFactory) {
  const npcs = [];
  for (let i = 0; i < count; i++) {
    const rig = ericFactory();
    scene.add(rig.group);

    const cfg = randomAvatarConfig();
    applyAvatar(rig, cfg, scene);
    applyBody(rig, cfg);

    const poi = pois[Math.floor(Math.random() * pois.length)];
    const p = { x: poi.x + (Math.random() - 0.5) * 6, z: poi.z + (Math.random() - 0.5) * 6 };
    resolveCollisions(p, 0.5, colliders);

    npcs.push({
      rig,
      pos: new THREE.Vector3(p.x, 0, p.z),
      yaw: Math.random() * Math.PI * 2,
      timer: 2 + Math.random() * 4,
      speed: 1.0 + Math.random() * 1.4,
      rd: null // dati del ragdoll (vx, vz, vy, spin, timer) o null
    });
  }
  return npcs;
}

// Gli abitanti dei tre paesini di montagna: vivono sulla terrazza in quota,
// passeggiano tra le casette e l'incrocio. `town` è il paese di casa: da lì
// arrivano la quota della terrazza (piatta) e il raggio dentro cui restano.
export function createTownsfolk (scene, colliders, ericFactory, perTown = 4) {
  const folks = [];
  for (const town of MINI_TOWNS) {
    for (let i = 0; i < perTown; i++) {
      const rig = ericFactory();
      scene.add(rig.group);

      const cfg = randomAvatarConfig();
      applyAvatar(rig, cfg, scene);
      applyBody(rig, cfg);

      // un punto a caso sulla terrazza, poi fuori dalle casette
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * town.r * 0.7;
      const p = { x: town.x + Math.cos(a) * rr, z: town.z + Math.sin(a) * rr };
      resolveCollisions(p, 0.5, colliders);

      folks.push({
        rig,
        pos: new THREE.Vector3(p.x, town.h, p.z),
        yaw: Math.random() * Math.PI * 2,
        timer: 2 + Math.random() * 4,
        speed: 1.0 + Math.random() * 1.4,
        town, // il paese di casa: quota e confini della terrazza
        rd: null
      });
    }
  }
  return folks;
}

// ----- ragdoll (condiviso anche con i pedoni sulle strisce) -----
export { startRagdoll, updateRagdoll, hitByCars };

const GETUP_WAIT = 3; // secondi a terra prima di rialzarsi

// vx, vz: velocità dell'auto; radialX/Z: la spinta perpendicolare (di lato)
function startRagdoll (n, vx, vz, radialX, radialZ, onHit) {
  const sp = Math.hypot(vx, vz) || 1;
  const v = Math.min(2 + sp * 0.55, 11); // la botta dell'auto, con un tetto
  n.rd = {
    vx: (vx / sp) * v + radialX * 1.5,
    vz: (vz / sp) * v + radialZ * 1.5,
    vy: 3.4 + Math.random() * 1.2, // spicca sempre un po' in aria
    spin: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 4),
    timer: GETUP_WAIT
  };
  n.rig.ragdollPhase = 'fly';
  // congela la posa di camminata: da qui è un corpo rigido che volteggia
  if (n.rig.currentAction) n.rig.currentAction.paused = true;
  if (onHit) onHit();
}

function updateRagdoll (n, dt, colliders) {
  const rd = n.rd;
  const rig = n.rig;
  // la terra sotto i piedi: in paese è la terrazza in quota, non lo zero
  const ground = n.town ? n.town.h : 0;
  if (rig.ragdollPhase === 'fly') {
    rd.vy -= 12 * dt;
    n.pos.x += rd.vx * dt;
    n.pos.z += rd.vz * dt;
    n.pos.y = Math.max(ground, n.pos.y + rd.vy * dt);
    rig.model.rotation.x += rd.spin * dt; // la capriola
    resolveCollisions(n.pos, 0.5, colliders); // niente voli attraverso i muri
    if (n.pos.y <= ground && rd.vy < -2.5) {
      n.pos.y = ground;
      rd.vy *= -0.35; // rimbalzino
      rd.vx *= 0.55; rd.vz *= 0.55; rd.spin *= 0.5;
    } else if (n.pos.y <= ground) {
      // atterrato: si stende a terra (la posa la dà il primo fotogramma
      // di "Getting Up"), con i piedi verso la direzione del volo
      n.pos.y = ground;
      rig.model.rotation.x = 0;
      rig.ragdollPhase = 'lie';
      n.yaw = Math.atan2(rd.vx, rd.vz);
    }
  } else if (rig.ragdollPhase === 'lie') {
    rd.timer -= dt;
    if (rd.timer <= 0) rig.ragdollPhase = 'getup'; // si rialza
  } else if (!rig.ragdollPhase) {
    // "Getting Up" finita: si rimette a passeggiare tra un attimo
    n.rd = null;
    n.speed = 0;
    n.timer = 1 + Math.random() * 2;
  }
}

// carCircles: le auto del traffico (con vx, vz: le auto veloci fanno volare
// i pedoni); playerCarCircles: l'auto del giocatore quando guida;
// playerPos: il giocatore, che i personaggi evitano spostandosi di lato.
export function updateNPCs (npcs, dt, colliders, carCircles, playerPos, playerCarCircles, onHit) {
  for (const n of npcs) {
    if (n.rd) {
      updateRagdoll(n, dt, colliders);
    } else {
      n.timer -= dt;
      if (n.timer <= 0) {
        n.timer = 2 + Math.random() * 5;
        n.yaw += (Math.random() - 0.5) * Math.PI;
        n.speed = Math.random() < 0.25 ? 0 : 1.0 + Math.random() * 1.4;
      }
      n.pos.x += Math.sin(n.yaw) * n.speed * dt;
      n.pos.z += Math.cos(n.yaw) * n.speed * dt;
      resolveCollisions(n.pos, 0.5, colliders);
      if (n.town) {
        // in paese si cammina sulla terrazza in quota, senza scenderla:
        // se il passo porta verso la scarpata, ci si ripensa la rotta
        n.pos.y = n.town.h;
        const dxT = n.pos.x - n.town.x, dzT = n.pos.z - n.town.z;
        const lim = n.town.r - 2;
        if (Math.hypot(dxT, dzT) > lim) {
          const dT = Math.hypot(dxT, dzT) || 1e-4;
          n.pos.x = n.town.x + (dxT / dT) * lim;
          n.pos.z = n.town.z + (dzT / dT) * lim;
          n.yaw = Math.atan2(-dxT, -dzT) + (Math.random() - 0.5); // verso il centro
        }
      } else if (Math.abs(n.pos.x) > NPC_LIM || Math.abs(n.pos.z) > NPC_LIM) {
        // se il passo ci porta fuori dalla spiaggia, ci si ripensa la rotta
        n.pos.x = Math.max(-NPC_LIM, Math.min(NPC_LIM, n.pos.x));
        n.pos.z = Math.max(-NPC_LIM, Math.min(NPC_LIM, n.pos.z));
        n.yaw += Math.PI;
      }
      // il giocatore spinge i personaggi di lato (niente compenetrazioni)
      if (playerPos) resolveCircles(n.pos, 0.45, [{ x: playerPos.x, z: playerPos.z, r: 0.5 }]);
      // le auto: piano le spingono, veloci li fanno volare in ragdoll
      hitByCars(n, carCircles, false, null);
      hitByCars(n, playerCarCircles, true, onHit);
    }

    animateRig(n.rig, dt, n.speed > 0 && !n.rd, false);
    n.rig.group.position.copy(n.pos);
    n.rig.group.rotation.y = n.yaw;
    n.rig.updateDecos();
  }

  // i personaggi tra loro: si spingono a vicenda e non si sovrappongono
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      if (npcs[i].rd || npcs[j].rd) continue; // chi è a terra non spinge
      const a = npcs[i].pos, b = npcs[j].pos;
      const dx = b.x - a.x, dz = b.z - a.z;
      const min = 0.9;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1e-4;
      const push = (min - d) / 2;
      const nx = dx / d, nz = dz / d;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
    }
  }
}

// Urto pedone-auto: sotto i 2.5 m/s una spintarella, sopra… si vola.
function hitByCars (n, circles, isPlayerCar, onHit) {
  if (!circles || !circles.length) return;
  for (const c of circles) {
    const dx = n.pos.x - c.x, dz = n.pos.z - c.z;
    const rr = 0.45 + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) continue;
    const sp = Math.hypot(c.vx || 0, c.vz || 0);
    const d = Math.sqrt(d2) || 1e-4;
    if (sp > 2.5) {
      if (n.rig.ragdollPhase !== 'fly') {
        startRagdoll(n, c.vx || 0, c.vz || 0, dx / d, dz / d, isPlayerCar ? onHit : null);
      }
      continue;
    }
    const push = rr - d;
    n.pos.x += (dx / d) * push;
    n.pos.z += (dz / d) * push;
  }
}
