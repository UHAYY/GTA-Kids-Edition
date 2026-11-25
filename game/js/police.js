// Polizia e stelle: dopo una rapina le stelle salgono e arrivano auto della
// polizia con i poliziotti che ti inseguono, provano ad arrestarti e, se ti
// prendono o ti mettono K.O., lo schermo annuncia MORTO (o ARRESTATO).
// Le stelle si perdono fermandoti nei parcheggi "P" senza farti vedere.
import * as THREE from 'three';
import { resolveCollisions, terrainHeight } from './city.js';
import { animateRig } from './avatar.js';
import { t } from './i18n.js';

const MAX_STARS = 5;
const COP_SPEED = 3.1;        // un pelo più lento del giocatore che corre
const CAR_SPEED = 13;         // le auto della polizia
const ARREST_TIME = 1.3;      // secondi di contatto per l'arresto
const HEARTS = 3;

// pistola giocattolo a tappi (solo per le rapine!)
function makeGun (color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.3),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.z = 0.12;
  g.add(body);
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.16, 0.09),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );
  handle.position.set(0, -0.12, -0.02);
  g.add(handle);
  return g;
}

export function createPolice (scene, assets, world) {
  const { colliders, roadCenters } = world;
  let stars = 0;
  let hearts = HEARTS;
  let noDamageTime = 0;
  let arrestTimer = 0;
  let shootCooldown = 0;
  let gun = null;

  const cars = [];   // auto della polizia
  const cops = [];   // poliziotti a piedi (come i NPC: rig, pos, yaw, rd…)
  const darts = [];  // proiettili del giocatore
  const copDarts = []; // proiettili della polizia

  const gunProto = makeGun(0x222222);
  const copGunProto = makeGun(0x1a3a8c);

  // ---------- creazione auto e poliziotti ----------
  function lightBar () {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.12, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    g.add(base);
    const red = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x550000 })
    );
    red.position.set(-0.3, 0.18, 0);
    const blue = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x2255ff, emissive: 0x001a55 })
    );
    blue.position.set(0.3, 0.18, 0);
    g.add(red); g.add(blue);
    g.userData = { red, blue };
    return g;
  }

  function spawnCar (playerPos) {
    // punto della strada a 90–150 m dal giocatore
    let x = 0, z = 0;
    for (let tries = 0; tries < 30; tries++) {
      const rx = roadCenters[Math.floor(Math.random() * roadCenters.length)];
      const rz = roadCenters[Math.floor(Math.random() * roadCenters.length)];
      const d = Math.hypot(rx - playerPos.x, rz - playerPos.z);
      if (d > 80 && d < 160) { x = rx; z = rz; break; }
    }
    const prefab = assets.carPrefabs.find(p => {
      const [L, H] = p.userData.size;
      return L >= 3.6 && L <= 5.2 && H <= 2;
    }) || assets.carPrefabs[0];
    const car = prefab.clone();
    car.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
    const bar = lightBar();
    bar.position.y = (prefab.userData.size[1] || 1.7) + 0.1;
    car.add(bar);
    car.position.set(x, 0, z);
    scene.add(car);
    cars.push({
      car, bar,
      x, z, heading: Math.random() * Math.PI * 2,
      speed: 0, deployed: false, stuck: 0
    });
  }

  function spawnCop (x, z) {
    const rig = assets.createEric();
    scene.add(rig.group);
    rig.setColors({
      skin: 0xd7a583, shirt: 0x1a3a8c, pants: 0x14245c, shoes: 0x222222
    });
    // pistola in mano (la volta della scala dello scheletro)
    if (rig.bones.handR) {
      const wrap = new THREE.Group();
      wrap.add(makeGun(0x1a3a8c));
      wrap.scale.setScalar(1 / rig.baseScale);
      wrap.position.set(0, -0.1, 0.05);
      rig.bones.handR.add(wrap);
    }
    const cop = {
      rig,
      pos: new THREE.Vector3(x, 0, z),
      yaw: Math.random() * Math.PI * 2,
      speed: 0, timer: 0,
      shootCd: 1 + Math.random(),
      rd: null, downTime: 0
    };
    cops.push(cop);
    return cop;
  }

  function spawnWave (playerPos) {
    const nCars = Math.min(stars, 4);
    while (cars.length < nCars) spawnCar(playerPos);
    // rinforzi a piedi, uno per stella almeno
    while (cops.filter(c => !c.rd).length < stars) {
      const a = Math.random() * Math.PI * 2;
      const d = 55 + Math.random() * 25;
      spawnCop(playerPos.x + Math.cos(a) * d, playerPos.z + Math.sin(a) * d);
    }
  }

  // ---------- API ----------
  function clearAll () {
    for (const c of cars) scene.remove(c.car);
    for (const c of cops) c.rig.group.removeFromParent();
    for (const d of darts) d.mesh.removeFromParent();
    for (const d of copDarts) d.mesh.removeFromParent();
    cars.length = 0; cops.length = 0; darts.length = 0; copDarts.length = 0;
    stars = 0; hearts = HEARTS; arrestTimer = 0;
    if (gun) gun.visible = false;
  }

  function ensureGun (player) {
    if (!gun) {
      gun = makeGun(0xffd54f);
      const wrap = new THREE.Group();
      wrap.add(gun);
      wrap.scale.setScalar(1 / player.rig.baseScale);
      wrap.position.set(0, -0.1, 0.05);
      if (player.rig.bones.handR) player.rig.bones.handR.add(wrap);
    }
    gun.visible = true;
  }

  // nuova stella (furto d'auto, rapina, rapina con l'auto rubata…)
  function addStars (n, player) {
    ensureGun(player);
    stars = Math.min(MAX_STARS, stars + n);
    spawnWave(player.mode === 'drive' ? player.carPos : player.pos);
  }

  // stelle in meno (es. l'elicottero ti ha perso tra le montagne)
  function loseStars (n) {
    stars = Math.max(0, stars - n);
  }

  function startRobbery (spot, player) {
    addStars(spot.stars, player);
    hearts = HEARTS;
  }

  function playerShoot (player) {
    if (stars === 0 || shootCooldown > 0) return false;
    shootCooldown = 0.45;
    const driving = player.mode === 'drive';
    const yaw = driving ? player.heading : player.yaw;
    const p = driving ? player.carPos : player.pos;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x554400 })
    );
    mesh.position.set(p.x + Math.sin(yaw) * 0.8, 1.35, p.z + Math.cos(yaw) * 0.8);
    scene.add(mesh);
    darts.push({ mesh, vx: Math.sin(yaw) * 26, vz: Math.cos(yaw) * 26, life: 1.1 });
    return true;
  }

  // riscontro per main.js: quante stelle/cuori (per l'HUD)
  function getState () {
    return { stars, hearts, arrest: arrestTimer > 0 };
  }

  // ---------- aggiornamento ----------
  // ctx: { player, playerPos, carCircles, pads, hud, onDeath, police: se stessa }
  function update (dt, ctx) {
    const { player, playerPos, pads, hud } = ctx;
    shootCooldown -= dt;
    noDamageTime += dt;
    if (noDamageTime > 9 && hearts < HEARTS) { hearts++; noDamageTime = 0; }
    const carActive = player.mode === 'drive';

    // --- proiettili del giocatore ---
    for (let i = darts.length - 1; i >= 0; i--) {
      const d = darts[i];
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.z += d.vz * dt;
      d.life -= dt;
      let dead = d.life <= 0;
      for (const cop of cops) {
        if (cop.rd) continue;
        const dx = cop.pos.x - d.mesh.position.x;
        const dz = cop.pos.z - d.mesh.position.z;
        if (dx * dx + dz * dz < 1.2 * 1.2) {
          dead = true;
          // poliziotto K.O. alla cartoon (come i pedoni con le auto)
          cop.rd = {
            vx: d.vx * 0.12, vz: d.vz * 0.12, vy: 2.6,
            spin: (Math.random() < 0.5 ? -1 : 1) * 7, timer: 4
          };
          cop.rig.ragdollPhase = 'fly';
          if (cop.rig.currentAction) cop.rig.currentAction.paused = true;
          sfxLike(ctx, 'bump');
          break;
        }
      }
      if (dead) { d.mesh.removeFromParent(); darts.splice(i, 1); }
    }

    // --- proiettili della polizia ---
    for (let i = copDarts.length - 1; i >= 0; i--) {
      const d = copDarts[i];
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.z += d.vz * dt;
      d.life -= dt;
      const dx = playerPos.x - d.mesh.position.x;
      const dz = playerPos.z - d.mesh.position.z;
      if (dx * dx + dz * dz < 0.9 * 0.9) {
        hearts--; noDamageTime = 0;
        sfxLike(ctx, 'bump');
        if (hearts <= 0) { ctx.onDeath('morto'); }
        d.mesh.removeFromParent(); copDarts.splice(i, 1);
        continue;
      }
      if (d.life <= 0) { d.mesh.removeFromParent(); copDarts.splice(i, 1); }
    }

    // --- auto della polizia ---
    for (const c of cars) {
      const dx = playerPos.x - c.x;
      const dz = playerPos.z - c.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const target = dist > 20 ? CAR_SPEED + stars : 0;
      c.speed += (target - c.speed) * Math.min(1, 2 * dt);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const pos = { x: nx, z: nz };
      const hit = resolveCollisions(pos, 1.6, colliders);
      c.x = pos.x; c.z = pos.z;
      if (hit) c.speed *= 0.6; // urto contro un edificio: rallenta e riprova
      c.car.position.set(c.x, terrainHeight(c.x, c.z), c.z);
      c.car.rotation.y = c.heading;
      // girofarfallio della sirena
      const blink = Math.sin(Date.now() * 0.02) > 0;
      c.bar.userData.red.material.emissive.setHex(blink ? 0xff0000 : 0x330000);
      c.bar.userData.blue.material.emissive.setHex(blink ? 0x002266 : 0x0044ff);

      // fermata: scendono i poliziotti
      if (dist < 24 && !c.deployed && c.speed < 3) {
        c.deployed = true;
        const n = stars >= 3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const cop = spawnCop(c.x + (Math.random() - 0.5) * 4, c.z + (Math.random() - 0.5) * 4);
          resolveCollisions(cop.pos, 0.5, colliders);
        }
      }
    }

    // --- poliziotti a piedi ---
    arrestTimer = 0;
    for (let i = cops.length - 1; i >= 0; i--) {
      const cop = cops[i];
      if (cop.rd) {
        // fisica del ragdoll (semplificata da npc.js): vola, cade, sparisce
        const rd = cop.rd;
        if (cop.rig.ragdollPhase === 'fly') {
          rd.vy -= 12 * dt;
          cop.pos.x += rd.vx * dt;
          cop.pos.z += rd.vz * dt;
          cop.pos.y = Math.max(0, cop.pos.y + rd.vy * dt);
          cop.rig.model.rotation.x += rd.spin * dt;
          resolveCollisions(cop.pos, 0.5, colliders);
          if (cop.pos.y <= 0 && rd.vy < -2.5) {
            cop.pos.y = 0; rd.vy *= -0.3; rd.vx *= 0.5; rd.spin *= 0.4;
          } else if (cop.pos.y <= 0) {
            cop.pos.y = 0;
            cop.rig.model.rotation.x = 0;
            cop.rig.ragdollPhase = 'lie';
            cop.yaw = Math.atan2(rd.vx, rd.vz);
          }
        } else if (cop.rig.ragdollPhase === 'lie') {
          rd.timer -= dt;
          if (rd.timer <= 0) {
            // si è fatto riprendere: si alza e torna in servizio
            cop.rig.ragdollPhase = null;
            cop.rd = null;
            cop.speed = 0; cop.timer = 0.5;
          }
        }
      } else {
        const dx = playerPos.x - cop.pos.x;
        const dz = playerPos.z - cop.pos.z;
        const dist = Math.hypot(dx, dz);
        cop.yaw = Math.atan2(dx, dz);
        // corre verso di te; a ranged lancia i tappi
        cop.speed = dist > 1.1 ? COP_SPEED + stars * 0.12 : 0;
        if (cop.speed > 0) {
          cop.pos.x += Math.sin(cop.yaw) * cop.speed * dt;
          cop.pos.z += Math.cos(cop.yaw) * cop.speed * dt;
          resolveCollisions(cop.pos, 0.5, colliders);
        }
        cop.pos.y = terrainHeight(cop.pos.x, cop.pos.z); // anche in salita
        cop.shootCd -= dt;
        if (dist < 22 && dist > 2 && cop.shootCd <= 0) {
          cop.shootCd = 1.6 + Math.random() * 0.8 - stars * 0.08;
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 8, 6),
            new THREE.MeshLambertMaterial({ color: 0xff5252, emissive: 0x551111 })
          );
          mesh.position.set(cop.pos.x + Math.sin(cop.yaw) * 0.7, 1.3, cop.pos.z + Math.cos(cop.yaw) * 0.7);
          scene.add(mesh);
          const sp = 17;
          copDarts.push({ mesh, vx: dx / dist * sp, vz: dz / dist * sp, life: 1.4 });
        }
        // ti ha preso: barra dell'arresto
        if (dist < 1.35 && !carActive) {
          arrestTimer += dt;
          if (arrestTimer >= ARREST_TIME) { ctx.onDeath('arrestato'); arrestTimer = ARREST_TIME; }
        }
      }
      animateRig(cop.rig, dt, cop.speed > 0 && !cop.rd, false);
      cop.rig.group.position.copy(cop.pos);
      cop.rig.group.rotation.y = cop.yaw;
      cop.rig.updateDecos();
    }

    // --- nascondersi nei garage sotterranei ("P" blu) ---
    if (stars > 0) {
      let inPad = false;
      for (const pad of pads) {
        if (Math.hypot(playerPos.x - pad.x, playerPos.z - pad.z) < (pad.r || 7)) { inPad = true; break; }
      }
      if (inPad) {
        let seen = false;
        for (const cop of cops) {
          if (!cop.rd && cop.pos.distanceTo(playerPos) < 40) { seen = true; break; }
        }
        // le auto della polizia non ti vedono quando sei sottoterra
        for (const c of cars) {
          if (playerPos.y < -4) break;
          if (Math.hypot(c.x - playerPos.x, c.z - playerPos.z) < 45) { seen = true; break; }
        }
        ctx.evade = (ctx.evade || 0) + dt;
        if (ctx.evade > 3 && !seen) {
          clearCops(true);
          stars = 0;
          if (gun) gun.visible = false;
          hud.toast(t('hidden_ok'));
          sfxLike(ctx, 'pickup');
          ctx.evade = 0;
        }
      } else {
        ctx.evade = 0;
      }
    }

    if (gun) gun.visible = stars > 0;
  }

  function clearCops (driveAway) {
    for (const c of cars) {
      if (driveAway) scene.remove(c.car); // per i bambini spariscono gentilmente
    }
    if (driveAway) {
      for (const cop of cops) cop.rig.group.removeFromParent();
      cars.length = 0; cops.length = 0;
    }
  }

  // piccoli suoni tramite il ctx (così non importo audio.js due volte)
  function sfxLike (ctx, name) {
    if (ctx.sfx && ctx.sfx[name]) ctx.sfx[name]();
  }

  return {
    update, startRobbery, playerShoot, clearAll, clearCops, addStars, loseStars, getState,
    get stars () { return stars; },
    get hearts () { return hearts; },
    get arrestTimer () { return arrestTimer; },
    spots: []
  };
}
