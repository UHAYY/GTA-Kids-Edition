// Pedoni sulle strisce: aspettano all'orlo del marciapiede, attraversano
// quando il semaforo diventa rosso (le auto sono ferme) o, dove manca il
// semaforo, quando non arriva nessuna auto. Se il verde torna mentre sono
// ancora sulla strada, mettono una scatto per finire di attraversare.
// Se li prendi con l'auto… volano come tutti gli altri (ragdoll da npc.js).
import * as THREE from 'three';
import { resolveCircles } from './city.js';
import { randomAvatarConfig, applyAvatar, applyBody, animateRig } from './avatar.js';
import { startRagdoll, updateRagdoll, hitByCars } from './npc.js';

// velocità sulle strisce: il rosso dura 7 s e la strada è lunga 14 m
const WALK = 2.4;

export function createCrossers (scene, roadCenters, lights, lightPhase, colliders, ericFactory, count = 14) {
  // ----- l'elenco delle strisce (stesso schema di city.js) -----
  // per ogni incrocio: due strisce attraversano la strada orizzontale
  // camminando lungo z (ai lati est/ovest), due attraversano la verticale
  // camminando lungo x (ai lati nord/sud). Niente strisce verso il mare.
  const n = roadCenters.length;
  const OFF = 7.1; // distanza delle strisce dal centro dell'incrocio
  const list = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = roadCenters[i], cz = roadCenters[j];
      const light = lights.has(cx + '|' + cz);
      if (i > 0) list.push({ x: cx - OFF, axis: 'z', z0: cz - 7, z1: cz + 7, light });
      if (i < n - 1) list.push({ x: cx + OFF, axis: 'z', z0: cz - 7, z1: cz + 7, light });
      if (j > 0) list.push({ z: cz - OFF, axis: 'x', x0: cx - 7, x1: cx + 7, light });
      if (j < n - 1) list.push({ z: cz + OFF, axis: 'x', x0: cx - 7, x1: cx + 7, light });
    }
  }

  // ----- i pedoni -----
  const crossers = [];
  for (let k = 0; k < count; k++) {
    const cr = list[Math.floor(Math.random() * list.length)];
    const rig = ericFactory();
    scene.add(rig.group);
    const cfg = randomAvatarConfig();
    applyAvatar(rig, cfg, scene);
    applyBody(rig, cfg);

    const secondSide = Math.random() < 0.5; // da che sponda parte
    const from = secondSide ? 0 : 1; // indice della sponda di partenza
    const ends = cr.axis === 'z' ? [cr.z0, cr.z1] : [cr.x0, cr.x1];
    const pos = cr.axis === 'z'
      ? new THREE.Vector3(cr.x, 0, ends[from])
      : new THREE.Vector3(ends[from], 0, cr.z);

    crossers.push({
      rig, cr, ends, from,
      pos,
      yaw: 0, // impostato sotto
      state: 'wait', // 'wait' (sulla sponda) | 'cross' | 'rest' (arrivato)
      timer: 1 + Math.random() * 5,
      speed: WALK * (0.9 + Math.random() * 0.25),
      go: false, // via libera (il rosso è appena scattato)
      rd: null
    });
    setYaw(crossers[crossers.length - 1]);
  }

  // guarda verso l'altra sponda
  function setYaw (c) {
    const to = c.ends[1 - c.from];
    const cur = c.cr.axis === 'z' ? c.pos.z : c.pos.x;
    const positivo = to > cur;
    c.yaw = c.cr.axis === 'z'
      ? (positivo ? 0 : Math.PI)
      : (positivo ? Math.PI / 2 : -Math.PI / 2);
  }

  // senza semaforo: attraversa solo se nessuna auto è vicina all'incrocio
  function autoVicino (cr, carCircles) {
    if (!carCircles) return true; // senza dati (es. nei menu) non si fermano
    const mx = cr.axis === 'z' ? cr.x : (cr.x0 + cr.x1) / 2;
    const mz = cr.axis === 'z' ? (cr.z0 + cr.z1) / 2 : cr.z;
    for (const c of carCircles) {
      if (Math.hypot(c.x - mx, c.z - mz) < 17) return true;
    }
    return false;
  }

  // ----- aggiornamento -----
  // carCircles: auto del traffico (le veloci fanno volare i pedoni);
  // playerCarCircles: l'auto del giocatore; playerPos: per spingersi di lato.
  let prevPhase = 0;
  function updateCrossers (dt, carCircles, playerCarCircles, playerPos, onHit) {
    const phase = lightPhase ? lightPhase() : 0;
    const rossoAppenaScattato = phase === 2 && prevPhase !== 2;
    prevPhase = phase;

    for (const c of crossers) {
      if (c.rd) {
        updateRagdoll(c, dt, colliders);
      } else if (c.state === 'wait') {
        c.timer -= dt;
        // con semaforo: via libera quando scatta il rosso (le auto fermano);
        // senza semaforo: quando non c'è nessuna auto in arrivo
        if (c.cr.light) {
          if (rossoAppenaScattato) {
            c.go = true;
            c.timer = Math.min(c.timer, 0.8); // si parte quasi subito: il
                                              // rosso dura solo 7 secondi
          }
        } else if (!autoVicino(c.cr, carCircles)) {
          c.go = true;
        }
        if (c.go && c.timer <= 0) {
          c.state = 'cross';
          c.speed = WALK * (0.95 + Math.random() * 0.2);
        }
      } else if (c.state === 'cross') {
        // il verde tornato mentre sei sulla strada? SCATTO!
        const scatto = c.cr.light && phase !== 2;
        const v = c.speed * (scatto ? 1.9 : 1);
        const to = c.ends[1 - c.from];
        if (c.cr.axis === 'z') {
          const d = to - c.pos.z;
          const step = Math.sign(d) * Math.min(Math.abs(d), v * dt);
          c.pos.z += step;
          if (Math.abs(d) < 0.05) { c.state = 'rest'; c.timer = 2 + Math.random() * 6; }
        } else {
          const d = to - c.pos.x;
          const step = Math.sign(d) * Math.min(Math.abs(d), v * dt);
          c.pos.x += step;
          if (Math.abs(d) < 0.05) { c.state = 'rest'; c.timer = 2 + Math.random() * 6; }
        }
      } else {
        // arrivato dall'altra parte: si guarda un po' in giro, poi ricrossa
        c.timer -= dt;
        if (c.timer <= 0) {
          c.from = 1 - c.from;
          setYaw(c);
          c.state = 'wait';
          c.timer = 0.5 + Math.random() * 3;
          c.go = false;
        }
      }

      // le auto e il giocatore (stessa fisica dei passanti normali)
      if (!c.rd) {
        hitByCars(c, carCircles, false, null);
        hitByCars(c, playerCarCircles, true, onHit);
        if (playerPos) resolveCircles(c.pos, 0.45, [{ x: playerPos.x, z: playerPos.z, r: 0.5 }]);
      }

      animateRig(c.rig, dt, c.state === 'cross' && !c.rd, false);
      c.rig.group.position.copy(c.pos);
      c.rig.group.rotation.y = c.yaw;
      c.rig.updateDecos();
    }
  }

  return { crossers, updateCrossers };
}
