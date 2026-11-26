// Il giocatore: avatar rigged (FBX) a piedi + guida dell'auto (fisica arcade)
import * as THREE from 'three';
import { resolveCollisions, resolveCircles, terrainHeight } from './city.js';
import { surfaceY } from './garage.js';
import { pressed, consumePress } from './input.js';
import { applyAvatar, applyBody, animateRig } from './avatar.js';

const WALK_SPEED = 4.2;
const RUN_SPEED = 7.5;

// salto (gioco per bambini: niente danni cadendo, la città è pianissima).
// La spinta è moderata perché la clip del salto già stende le gambe.
const JUMP_SPEED = 3.6;
const GRAVITY = 14;

const ACCEL = 13;
const BRAKE = 30;
const MAX_SPEED = 21;
const MAX_REVERSE = -7;

export function createPlayer (scene, startPos, ericFactory, cfg) {
  const rig = ericFactory();
  rig.group.position.copy(startPos);
  scene.add(rig.group);
  applyAvatar(rig, cfg, scene);
  applyBody(rig, cfg);

  const player = {
    rig,
    pos: startPos.clone(),
    yaw: 0,
    mode: 'walk', // 'walk' | 'drive'
    car: null,
    carPos: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    bumpCooldown: 0,
    maxSpeed: MAX_SPEED, // ogni auto comprata alla concessionaria ha la sua
    carDamage: 0, // 0 = integra, 0.6 = molto rovinata: ogni scontro la rallenta
    under: 0, // 1 = sei dentro un garage sotterraneo (per la quota del pavimento)
    vy: 0, // velocità verticale del salto
    grade: 0, // pendenza sotto le ruote (≈ seno dell'angolo, + in salita)
    vyCar: 0, // velocità verticale dell'auto (cadute dai salti/dissesti)
    carAir: false, // l'auto è in volo (caduta da un bordo/salto)
    bench: null // la panchina su cui si è seduti (se c'è)
  };
  // finita l'animazione di alzata: scendi davanti alla panchina
  rig.onSitEnd = () => {
    const b = player.bench;
    if (b) {
      player.pos.set(b.x + Math.sin(b.yaw) * 1.3, 0, b.z + Math.cos(b.yaw) * 1.3);
      player.bench = null;
    }
  };
  return player;
}

export function attachCar (player, carGroup, startPos, heading) {
  player.car = carGroup;
  player.carPos = startPos.clone();
  player.heading = heading;
  player.speed = 0;
  player.grade = 0; // la nuova auto parte dritta, senza inclinazioni ereditate
  player.vyCar = 0; // e appoggiata a terra, senza cadute ereditate
  player.carAir = false;
  player.carDamage = 0; // un'auto appena presa (o comprata) è integra
  carGroup.position.copy(startPos);
  carGroup.rotation.y = heading;
}

// Movimento a piedi (W avanti, S indietro, A/D girano, Shift corre,
// Space salta). carCircles: i cerchi delle auto (propria + traffico):
// non si attraversano. Mentre ci si siede/si è seduti non ci si muove.
export function updateWalk (player, dt, colliders, carCircles) {
  const rig = player.rig;

  if (rig.sitPhase) {
    // seduto (o in transizione): solo animazione, niente input né collisioni
    animateRig(rig, dt, false, false);
    rig.group.position.copy(player.pos);
    rig.group.rotation.y = player.yaw;
    rig.updateDecos();
    return;
  }

  const fwd = (pressed('KeyW') || pressed('ArrowUp') ? 1 : 0) - (pressed('KeyS') || pressed('ArrowDown') ? 1 : 0);
  const turn = (pressed('KeyA') || pressed('ArrowLeft') ? 1 : 0) - (pressed('KeyD') || pressed('ArrowRight') ? 1 : 0);
  const run = pressed('ShiftLeft') || pressed('ShiftRight');
  const speed = run ? RUN_SPEED : WALK_SPEED;

  // salto con la barra spaziatrice (anche correndo). Il pavimento può
  // essere la strada (0) o la sala del garage sotterraneo
  const ground = surfaceY(player, player.pos.x, player.pos.z);
  if (player.pos.y < ground) player.pos.y = ground; // risali la rampa camminando
  if (player.pos.y <= ground + 0.01 && player.vy <= 0 && consumePress('Space')) player.vy = JUMP_SPEED;
  if (player.pos.y > ground || player.vy > 0) {
    player.vy -= GRAVITY * dt;
    player.pos.y = Math.max(ground, player.pos.y + player.vy * dt);
    if (player.pos.y <= ground) player.vy = 0;
  }
  rig.airborne = player.pos.y > ground + 0.02;

  player.yaw += turn * 2.6 * dt;
  if (fwd !== 0) {
    player.pos.x += Math.sin(player.yaw) * speed * fwd * dt;
    player.pos.z += Math.cos(player.yaw) * speed * fwd * dt;
  }

  resolveCollisions(player.pos, 0.5, colliders);
  if (carCircles && carCircles.length) resolveCircles(player.pos, 0.5, carCircles);

  const moving = fwd !== 0;
  animateRig(rig, dt, moving, run);
  rig.group.position.copy(player.pos);
  rig.group.rotation.y = player.yaw;
  rig.updateDecos();
}

// Sedersi su una panchina con E (e alzarsi con un'altra E).
// benches: [{ x, z, yaw }] prodotti da buildCity.
export function trySit (player, benches) {
  if (player.mode !== 'walk') return null;
  if (player.rig.sitPhase) {
    // secondo E: ci si alza
    if (player.rig.sitPhase === 'sat') player.rig.sitPhase = 'up';
    return 'rising';
  }
  for (const b of benches) {
    if (Math.hypot(player.pos.x - b.x, player.pos.z - b.z) < 1.7) {
      player.pos.set(b.x, 0, b.z);
      player.yaw = b.yaw;
      player.bench = b;
      player.rig.sitPhase = 'down';
      return 'sitting';
    }
  }
  return null;
}

// Fisica di guida in stile arcade. Ritorna { bumped }.
// trafficCircles: i cerchi delle auto del traffico (non della propria).
export function updateDrive (player, dt, colliders, trafficCircles) {
  const throttle = (pressed('KeyW') || pressed('ArrowUp') ? 1 : 0) - (pressed('KeyS') || pressed('ArrowDown') ? 1 : 0);
  const steer = (pressed('KeyA') || pressed('ArrowLeft') ? 1 : 0) - (pressed('KeyD') || pressed('ArrowRight') ? 1 : 0);

  // le bici: piccole, senza danni, con retromarcia corta (mezzo passo)
  const isBike = !!(player.car && player.car.userData.bike);
  const backOff = isBike ? 0.5 : 1.3;      // sporgenza dei cerchi di collisione
  const carRad = isBike ? 0.55 : 1.15;
  const maxRev = isBike ? -2.2 : MAX_REVERSE;

  // i danni da scontro rendono l'auto più lenta e meno reattiva
  const dmg = player.carDamage || 0;
  const acc = ACCEL * (isBike ? 0.6 : 1) * (1 - dmg * 0.5);
  const cap = (player.maxSpeed || MAX_SPEED) * (1 - dmg);

  // pendenza sotto le ruote: quota del terreno davanti e dietro (campione
  // a 2,2 m, come un asse tra le due coppie di ruote). Le rampe dei garage
  // non contano: lì l'auto resta dritta, la pendenza è quella del colle
  const ax = Math.sin(player.heading), az = Math.cos(player.heading);
  const yF = terrainHeight(player.carPos.x + ax * 2.2, player.carPos.z + az * 2.2);
  const yB = terrainHeight(player.carPos.x - ax * 2.2, player.carPos.z - az * 2.2);
  const grade = (yF - yB) / 4.4; // ≈ seno della pendenza, + in salita
  player.grade += (grade - player.grade) * Math.min(1, dt * 8); // niente salti

  // fisica della pendenza: in salita la gravità toglie velocità (l'auto
  // "fatica"), in discesa ne regala e scende da sola col motore a spillo
  player.speed -= player.grade * 9 * dt;

  if (throttle > 0) player.speed += acc * dt;
  else if (throttle < 0) player.speed -= (player.speed > 0 ? BRAKE : acc * 0.7) * dt;
  else player.speed -= player.speed * 1.2 * dt; // attrito

  player.speed = Math.max(maxRev, Math.min(cap, player.speed));
  if (Math.abs(player.speed) < 0.02 && throttle === 0) player.speed = 0;

  // sterzo più efficace in movimento
  const steerFactor = Math.min(Math.abs(player.speed) / 9, 1) * Math.sign(player.speed || 1);
  player.heading += steer * 2.2 * dt * (steerFactor === 0 ? 1 : steerFactor);

  player.carPos.x += Math.sin(player.heading) * player.speed * dt;
  player.carPos.z += Math.cos(player.heading) * player.speed * dt;

  // quota: strada e rampe dei garage si seguono da attaccate alle ruote,
  // ma se il terreno scende di colpo (bordò da una discesa ripida!)
  // l'auto si stacca e cade: più alta la caduta, più danno all'atterraggio
  let bumped = false;
  const groundY = surfaceY(player, player.carPos.x, player.carPos.z);
  // in volo se il terreno è crollato sotto le ruote, o se stiamo già
  // cadendo e non abbiamo ancora toccato terra (il distacco si restringe
  // prima dell'impatto: senza il ricordo del volo l'atterraggio salterebbe!)
  if (player.carPos.y - groundY > 0.45 || (player.carAir && player.carPos.y > groundY)) {
    player.carAir = true;
    // in volo: la gravità tira giù
    player.vyCar -= GRAVITY * dt;
    player.carPos.y += player.vyCar * dt;
    if (player.carPos.y <= groundY) {
      // sbam! all'atterraggio conta la velocità verticale
      const impact = -player.vyCar;
      player.carPos.y = groundY;
      player.vyCar = 0;
      if (impact > 5 && !isBike) { // sotto i ~5 m/s è solo un saltello
        player.carDamage = Math.min(0.6, (player.carDamage || 0) + (impact - 5) * 0.035);
        player.bumpCooldown = 0.4;
        bumped = true;
      }
    }
  } else {
    player.carAir = false;
    player.carPos.y = groundY; // ruote a terra: sale e scende col colle
    player.vyCar = 0;
  }

  // collisioni con due cerchi (davanti e dietro): edifici e altre auto
  let hit = null;
  for (const off of [backOff, -backOff]) {
    const bx = player.carPos.x + Math.sin(player.heading) * off;
    const bz = player.carPos.z + Math.cos(player.heading) * off;
    const p = { x: bx, z: bz, y: player.carPos.y || 0 }; // la quota serve ai muri del garage
    const n = resolveCollisions(p, carRad, colliders);
    if (n) {
      player.carPos.x += p.x - bx;
      player.carPos.z += p.z - bz;
      hit = n;
    }
    if (trafficCircles && trafficCircles.length &&
        resolveCircles(p, carRad, trafficCircles)) {
      player.carPos.x += p.x - bx;
      player.carPos.z += p.z - bz;
      hit = hit || { x: (p.x - bx), z: (p.z - bz) };
    }
  }

  if (player.bumpCooldown > 0) player.bumpCooldown -= dt;
  if (hit && Math.abs(player.speed) > 1.5 && player.bumpCooldown <= 0) {
    const impact = Math.abs(player.speed);
    // ad alta velocità l'auto si ferma di brutto, a passo d'uomo si smorza
    player.speed *= impact > 8 ? 0.4 : 0.75;
    // e il danno è proporzionale: un botta piano toglie pochissima vita,
    // a tutta velocità l'auto si rovina sul serio (le bici mai!)
    if (!isBike) player.carDamage = Math.min(0.6, (player.carDamage || 0) + impact * 0.01);
    player.bumpCooldown = 0.4;
    bumped = true;
  }
  return { bumped };
}

// L'officina rimette a nuovo l'auto: i danni tornano a zero
export function repairCar (player) {
  player.carDamage = 0;
}

// Salire/scendere dalla macchina con E
export function tryEnterExit (player, carGroup) {
  if (player.mode === 'walk') {
    if (player.pos.distanceTo(carGroup.position) < 3.6) {
      player.mode = 'drive';
      if (carGroup.userData.bike) {
        // in bici il rider si vede: niente rig nascosto, subito in sella
        // (la posa "seduto" la tiene in equilibrio sulla sella)
        player.rig.group.visible = true;
        player.rig.sitPhase = 'sat';
      } else {
        player.rig.group.visible = false;
        player.rig.decosVisible = false; // nascondi anche capelli/mani (sono fuori dal gruppo)
        for (const d of player.rig.decos) d.obj.visible = false;
      }
      return 'entered';
    }
  } else {
    // scendi a lato della macchina
    player.pos.copy(player.carPos).add(new THREE.Vector3(Math.cos(player.heading), 0, -Math.sin(player.heading)).multiplyScalar(2.4));
    player.yaw = player.heading;
    player.mode = 'walk';
    player.rig.group.visible = true;
    player.rig.decosVisible = true;
    if (player.car && player.car.userData.bike) player.rig.sitPhase = null; // dal sellino si rialzano le gambe
    return 'exited';
  }
  return null;
}

// In bici il rig resta visibile ed è il rider: seduto in sella, ruotato
// come la bici, con l'animazione "seduto" al posto delle gambe che pedaleranno
// in una futura versione. Da chiamare ogni frame di guida in bici.
const SIT_BUTT = 0.52; // altezza del sederone nella posa "seduto" (come le panchine)
export function syncBikeRider (player, dt) {
  const rig = player.rig;
  if (rig.sitPhase !== 'sat') rig.sitPhase = 'sat'; // resta seduto
  const s = player.car.userData.saddle || { y: 0.88, z: -0.45 };
  const sin = Math.sin(player.heading);
  const cos = Math.cos(player.heading);
  rig.group.position.set(
    player.carPos.x + sin * s.z,                      // la sella è un po' indietro
    (player.carPos.y || 0) + s.y - SIT_BUTT,          // il sederone finisce sulla sella
    player.carPos.z + cos * s.z
  );
  rig.group.rotation.y = player.heading; // guarda dove guarda la bici
  animateRig(rig, dt, false, false);
  rig.updateDecos();
}

// Sincronizza la mesh dell'auto con la fisica (anche la quota: garage!)
export function syncCarVisual (player, dt) {
  const car = player.car;
  car.position.set(player.carPos.x, player.carPos.y || 0, player.carPos.z);
  // prima guarda dove va (yaw), poi si inclina (pitch): serve l'ordine YXZ
  if (car.rotation.order !== 'YXZ') car.rotation.order = 'YXZ';
  car.rotation.y = player.heading;
  // in pendenza l'auto si inclina come le montagne russe: in salita il
  // muso sale (gradi positivi → pitch negativo), in discesa affonda
  const target = -Math.atan(player.grade || 0);
  car.rotation.x += (target - car.rotation.x) * Math.min(1, (dt || 0.016) * 7);
}
