// -------------------------------------------------------------
// Auto Avventure — Kids City
// Modulo principale: caricamento asset, scena, ciclo di gioco,
// barbiere e personalizzazione dell'avatar.
// -------------------------------------------------------------
import * as THREE from 'three';
import { initInput, consumePress, endFrame } from './input.js';
import { buildCity, resolveCollisions, CITY_SIZE, GRID, terrainHeight, MINI_TOWNS } from './city.js';
import { loadAssets } from './assets.js';
import { createPlayer, attachCar, updateWalk, updateDrive, tryEnterExit, trySit, syncCarVisual, syncBikeRider, repairCar } from './player.js';
import { createNPCs, updateNPCs } from './npc.js';
import { createCrossers } from './crossers.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createHUD } from './hud.js';
import { createMinimap } from './minimap.js';
import { createBigMap } from './bigmap.js';
import { initAudio, sfx } from './audio.js';
import {
  applyAvatar, applyBody, animateRig,
  loadAvatarConfig, saveAvatarConfig, randomAvatarConfig,
  HAIRCUTS, EYES, MOUTHS, FUZZ, BEARDS, HANDS,
  SHIRTS, PANTS, SHOES, SKINS
} from './avatar.js';
import { createBarbershop } from './barber.js';
import { createDealership } from './dealer.js';
import { createHeists } from './heists.js';
import { createPolice } from './police.js';
import { createHospital } from './hospital.js';
import { createWorkshop } from './workshop.js';
import { createSmoke } from './smoke.js';
import { createGarage, GARAGE_SITES, groundHoleFor } from './garage.js';
import { createBike, BIKE_KINDS } from './bikes.js';
import { createTalk } from './talk.js';
import { t as tr, tn, locale, applyStatic, buildLangSwitch } from './i18n.js';

// testi statici della pagina (menu, hud, pannelli) nella lingua salvata
applyStatic();

// ---------- renderer, scena, camera ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// 1.5 basta visivamente e sui portatili 4K dimezza il carico rispetto a 2
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3f0);
scene.fog = new THREE.Fog(0x9fd8f5, 170, 560);

// near a 0.3 (e non 0.1): con far a 900 migliora molto la precisione della
// profondità e le strade/marciapiedi lontani tremitano molto meno (z-fighting)
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 900);

// ---------- luci ----------
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x9c8f6b, 1.05));
const sun = new THREE.DirectionalLight(0xfff3d6, 1.8);
sun.position.set(70, 110, 40);
sun.castShadow = true;
// la mappa ombre segue il giocatore (vedi updateCamera): copre solo i
// dintorni, cosi' copre piu' bene i dettagli e costa molto meno che
// disegnare le ombre di tutta la citta' a ogni fotogramma
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -85;
sun.shadow.camera.right = 85;
sun.shadow.camera.top = 85;
sun.shadow.camera.bottom = -85;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

// ---------- riferimenti UI ----------
const el = (id) => document.getElementById(id);
const loadingEl = el('loading');
const loadFill = el('loadfill');
const loadErr = el('loaderr');
const menuEl = el('menu');
const bubbleEl = el('bubble');
const customizerEl = el('customizer');
const dealerEl = el('dealer');

let uiState = 'loading'; // 'loading' | 'menu' | 'playing' | 'customizer' | 'dealer'
let assets = null;

// stato avatar (persistente)
const cfg = loadAvatarConfig();
const tmpV = new THREE.Vector3();

init().catch((e) => {
  console.error(e);
  loadErr.textContent = tr('load_error', { msg: e.message });
  loadErr.classList.remove('hidden');
});

async function init () {
  // ---------- asset ----------
  assets = await loadAssets((p) => { loadFill.style.width = p + '%'; });

  // ---------- mondo ----------
  // isolotti riservati, in indici i*GRID+j (i lungo x, j lungo z) per la
  // griglia a 8 isolotti per lato: barbiere (4,4), concessionaria (3,3),
  // banca (5,5), gioielleria (2,5), supermarket (6,2), ospedale (1,6),
  // e i 4 garage sotterranei (2,2), (5,3), (2,6), (6,4)
  const SKIP = new Set([
    4 * GRID + 4, 3 * GRID + 3, 5 * GRID + 5, 2 * GRID + 5, 6 * GRID + 2, 1 * GRID + 6,
    2 * GRID + 2, 5 * GRID + 3, 2 * GRID + 6, 6 * GRID + 4
  ]);
  // sopra le rampe dei garage il prato è ritagliato: dall'esterno si vede
  // la discesa, come negli ingressi dei garage veri
  const city = buildCity(scene, SKIP, GARAGE_SITES.map(([gx, gz]) => groundHoleFor(gx, gz)));
  const { colliders, pois, clouds, roadCenters, benches, updateCity, lightPhase, lights } = city;
  const hospital = createHospital(scene, colliders);

  const barber = createBarbershop(scene, assets.createEric, colliders);

  // ---------- giocatore e auto ----------
  // spawner sul prato dell'isolotto riservato del barbiere (zona senza edifici)
  const player = createPlayer(scene, new THREE.Vector3(30, 0, 28), assets.createEric, cfg);

  // scegli un'auto per il giocatore (una berlina, non un camion)
  const playerCarPrefab = assets.carPrefabs.find(p => {
    const [L, H] = p.userData.size;
    return L >= 3.6 && L <= 5.4 && H <= 2.1;
  }) || assets.carPrefabs[0];
  const car = playerCarPrefab.clone();
  scene.add(car);
  attachCar(player, car, new THREE.Vector3(24, 0, 30), 0);

  // ---------- concessionaria: 10 tipi di auto ----------
  // dai 26 modelli del pacchetto scegliamo, in base alle dimensioni
  // (lunghezza e altezza), quello che somiglia di più a ogni tipo: una
  // citycar è corta, una coupé è bassa, un SUV alto, un van lungo e boxoso…
  const civili = assets.carPrefabs.filter(p => {
    const [L, H] = p.userData.size;
    return L >= 3.2 && L <= 6.2 && H >= 1.2 && H <= 2.3;
  });
  const usate = new Set();
  function pick (L, H) {
    let best = null, bestD = Infinity;
    for (const p of civili) {
      if (usate.has(p)) continue;
      const [pl, ph] = p.userData.size;
      const dist = Math.pow(pl - L, 2) * 2 + Math.pow(ph - H, 2);
      if (dist < bestD) { bestD = dist; best = p; }
    }
    usate.add(best);
    return best || civili[0] || assets.carPrefabs[0];
  }
  const SHOP = [
    { prefab: pick(3.5, 1.45), nome: 'Citycar',       price: 11000, topSpeed: 19 },
    { prefab: pick(4.0, 1.5),  nome: 'Utilitaria',    price: 16000, topSpeed: 22 },
    { prefab: pick(4.6, 1.5),  nome: 'Berlina',       price: 28000, topSpeed: 25 },
    { prefab: pick(4.8, 1.55), nome: 'Station wagon', price: 31000, topSpeed: 26 },
    { prefab: pick(4.3, 1.7),  nome: 'Crossover',     price: 27000, topSpeed: 26 },
    { prefab: pick(4.6, 1.75), nome: 'Monovolume',    price: 33000, topSpeed: 27 },
    { prefab: pick(4.9, 1.85), nome: 'SUV',           price: 45000, topSpeed: 29 },
    { prefab: pick(5.4, 2.05), nome: 'Van',           price: 38000, topSpeed: 23 },
    { prefab: pick(4.4, 1.38), nome: 'Coupé',         price: 58000, topSpeed: 32 },
    { prefab: pick(4.6, 1.42), nome: 'Cabriolet',     price: 65000, topSpeed: 34 }
  ];
  // in dote anche le bici: costano poco, vanno piano ma non si rovinano mai
  for (const k of BIKE_KINDS) {
    SHOP.push({ prefab: createBike(k.color, k.kind), nome: k.nome, price: k.price, topSpeed: k.topSpeed });
  }
  const garage = { owned: SHOP.map((s, i) => i === 0), current: 0 };
  const dealer = createDealership(scene, assets.createEric, colliders, SHOP);
  // l'officina accanto: qui si ripara l'auto rovinata dagli scontri
  const workshop = createWorkshop(scene, assets.createEric, colliders);
  // costo della riparazione: 50 monete per ogni botta che ha rovinato l'auto
  function repairCost () {
    return Math.ceil((player.carDamage || 0) / 0.12) * 50;
  }
  // fumo nero dal cofano delle auto molto rovinate
  const smoke = createSmoke(scene);

  // ---------- auto e bici parcheggiate ----------
  // i veicoli che lasci in giro restano qui: riprendili con E quando ci
  // passi accanto. Anche le auto e le bici rubate finiscono in questa lista
  // quando ne cambi di nuovo.
  const parkedCars = [];

  // cambia (o compra) un veicolo: il modello si sostituisce dove sei
  function switchCar (i) {
    const model = SHOP[i].prefab.clone();
    model.userData.shopIndex = i; // per riconoscere i veicoli del negozio
    scene.add(model);
    // il veicolo di prima: se era del negozio si ritira (il negozio se
    // ricrea il modello), se era rubata/parcheggiata resta in giro dov'è,
    // pronto per essere ripreso con E
    if (player.car) {
      if (player.car.userData.shopIndex !== undefined) scene.remove(player.car);
      else parkedCars.push(player.car);
    }
    model.userData.topSpeed = SHOP[i].topSpeed; // serve anche alle auto rubate
    player.car = model;
    player.maxSpeed = SHOP[i].topSpeed;
    player.carDamage = 0; // un'auto appena comprata è integra, non eredita
                          // i danni della vecchia
    garage.current = i;
    // compri a piedi? il veicolo nuovo arriva proprio davanti a te
    if (player.mode === 'walk') {
      player.carPos.copy(player.pos).add(new THREE.Vector3(
        Math.sin(player.yaw + Math.PI) * 2.5, 0, Math.cos(player.yaw + Math.PI) * 2.5));
      player.carPos.y = 0;
    }
    syncCarVisual(player, 0);
  }
  // all'inizio guidi la Citycar del negozio (l'unica già tua)
  switchCar(0);

  // velocità massima di un'auto del traffico: le basse e corte sono sportive,
  // i van e gli SUV sono più lenti (misura in metri del modello)
  function topSpeedOf (model) {
    const [L, H] = model.userData?.size || [4, 1.5];
    return Math.max(17, Math.min(28, Math.round(30 - H * 3.5 - L * 0.4)));
  }

  // prendi un'auto (rubata al traffico o parcheggiata): la tua auto di ora
  // resta in scena dove sta, pronta per essere ripresa dopo
  function takeCar (model, stolen) {
    parkedCars.push(player.car);
    model.userData.carDamage = model.userData.carDamage || 0;
    attachCar(player, model, model.position.clone(), model.rotation.y);
    player.maxSpeed = model.userData.topSpeed || topSpeedOf(model);
    player.carDamage = model.userData.carDamage;
    tryEnterExit(player, player.car); // metti in guida (nasconde il rig)
    if (stolen) {
      model.userData.stolen = true; // se ci farai una rapina, stelle extra!
      police.addStars(1, player);
      hud.toast(tr(model.userData.bike ? 'bike_stolen' : 'car_stolen'));
    }
    sfx.door();
    hud.speed.classList.remove('hidden');
    hud.prompt.classList.add('hidden');
  }

  // ruba un'auto del traffico: esce dal traffico e al suo posto ne riparte
  // un'altra, così la città resta viva
  function stealTrafficCar (c) {
    traffic.splice(traffic.indexOf(c), 1);
    // quella che riparte nasce lontana da te e dalle altre auto:
    // niente auto che sbucano addosso a qualcuno
    const avoid = [{ x: player.pos.x, z: player.pos.z }];
    for (const t of traffic) avoid.push({ x: t.car.position.x, z: t.car.position.z });
    for (const nc of createTraffic(scene, roadCenters, assets.carPrefabs, playerCarPrefab, 1, avoid)) {
      traffic.push(nc);
    }
    takeCar(c.car, true);
  }

  // torna in un'auto tua lasciata parcheggiata
  function swapToParked (model) {
    parkedCars.splice(parkedCars.indexOf(model), 1);
    takeCar(model, false);
  }

  // prendi una delle bici lasciate in giro (per il proprietario è un furto!)
  function takeFreeBike (model) {
    freeBikes.splice(freeBikes.indexOf(model), 1);
    takeCar(model, true);
  }

  // ---------- bici parcheggiate per la città ----------
  // sugli angoli dei marciapiedi, come le bici di quartiere lasciate lì:
  // ne nascono 8, mescolando i tre modelli. Si prendono con E (furto!).
  const freeBikes = [];
  {
    const spots = [];
    for (let s = 0; s < 200 && spots.length < 8; s++) {
      const x = roadCenters[Math.floor(Math.random() * roadCenters.length)] +
        (Math.random() < 0.5 ? -9 : 9);
      const z = roadCenters[Math.floor(Math.random() * roadCenters.length)] +
        (Math.random() < 0.5 ? -9 : 9);
      // niente bici dentro alberi, edifici o panchine
      if (colliders.some(c =>
        x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1)) continue;
      // e nemmeno tutte ammassate sullo stesso incrocio
      if (spots.some(p => Math.hypot(p.x - x, p.z - z) < 40)) continue;
      spots.push({ x, z });
    }
    for (const p of spots) {
      const k = BIKE_KINDS[Math.floor(Math.random() * BIKE_KINDS.length)];
      const bike = createBike(k.color, k.kind);
      bike.position.set(p.x, 0, p.z);
      bike.rotation.y = Math.random() * Math.PI * 2;
      bike.userData.topSpeed = k.topSpeed;
      scene.add(bike);
      freeBikes.push(bike);
    }
    // e una bici parcheggiata in ogni paesino sui colli: chi sale a piedi
    // o in macchina la trova all'angolo dell'incrocio
    for (const t of MINI_TOWNS) {
      const k = BIKE_KINDS[Math.floor(Math.random() * BIKE_KINDS.length)];
      const bike = createBike(k.color, k.kind);
      bike.position.set(t.x + 6.5, terrainHeight(t.x + 6.5, t.z + 6.5), t.z + 6.5);
      bike.rotation.y = Math.random() * Math.PI * 2;
      bike.userData.topSpeed = k.topSpeed;
      scene.add(bike);
      freeBikes.push(bike);
    }
  }

  const npcs = createNPCs(scene, 20, colliders, pois, assets.createEric);
  // pedoni sulle strisce: aspettano il rosso e attraversano
  const crossers = createCrossers(scene, roadCenters, lights, lightPhase, colliders, assets.createEric, 14);
  // con loro si può parlare anche T: sono passanti come gli altri
  const talkers = npcs.concat(crossers.crossers);
  const talk = createTalk({ npcs: talkers, player, camera, promptEl: null });
  // le auto del traffico nascono lontane dal giocatore e dalla sua auto
  const traffic = createTraffic(scene, roadCenters, assets.carPrefabs, playerCarPrefab, 10,
    [{ x: player.pos.x, z: player.pos.z }, { x: 24, z: 30 }]);
  const missions = createMissions(scene, pois);
  const hud = createHUD();
  const minimap = createMinimap(el('minimap'), city.map);

  // ---------- mappa completa e navigatore ----------
  // Clic sulla minimappa: si apre la mappa di tutta l'isola. Clic su un
  // punto della mappa: quello diventa la destinazione e sulla minimappa
  // compare la bandierina 📍 con la distanza (il navigatore).
  const nav = { x: 0, z: 0, on: false };
  const bigmap = createBigMap(city.map, () => ({
    player, missions, barber, dealer, traffic, bikes: freeBikes, nav, pads: garagePads,
    marks: heists.spots.concat([
      { x: hospital.spawn.x, z: hospital.spawn.z, icon: '🏥' },
      { x: workshop.pos.x, z: workshop.pos.z, icon: '🔧' }
    ]).concat(MINI_TOWNS.map(t => ({ x: t.x, z: t.z, icon: '🏘️' })))
  }), (wx, wz) => {
    if (wx === null) { // dal pulsante "togli il navigatore"
      if (nav.on) { nav.on = false; hud.toast(tr('nav_clear')); }
      bigmap.draw();
      return;
    }
    nav.x = wx; nav.z = wz; nav.on = true;
    bigmap.close();
    hud.toast(tr('nav_set'));
    sfx.pickup();
  });
  el('minimap').addEventListener('click', () => {
    if (uiState === 'playing') bigmap.open();
  });

  // ---------- rapine e polizia ----------
  const heists = createHeists(scene, colliders);
  const police = createPolice(scene, assets, { colliders, roadCenters });
  let robbery = null;   // { spot, t } mentre stai rapinando
  let deadTimer = 0;    // countdown dello schermo MORTO / ARRESTATO
  const HEARTS_MAX = 3;
  const policeCtx = { evade: 0 }; // memoria del timer di fuga nei parcheggi

  // ---------- parcheggi sotterranei (al posto dei "P" sulla strada) ----------
  // ingresso sul bordo dell'isolotto, sala con i posti sotto il prato
  const garagePads = [];
  for (const [gx, gz] of GARAGE_SITES) {
    garagePads.push(createGarage(scene, colliders, gx, gz, assets.carPrefabs).pad);
  }

  // ---------- monete ----------
  const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x8d6e00 });
  const coins = [];
  for (let i = 0; i < 50; i++) {
    const poi = pois[Math.floor(Math.random() * pois.length)];
    const p = { x: poi.x + (Math.random() - 0.5) * 8, z: poi.z + (Math.random() - 0.5) * 8 };
    resolveCollisions(p, 1, colliders);
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.castShadow = true;
    mesh.position.set(p.x, terrainHeight(p.x, p.z) + 1.2, p.z); // anche sui colli
    scene.add(mesh);
    coins.push({ mesh, taken: false, spin: Math.random() * Math.PI * 2 });
  }
  let coinsRespawnTimer = 0;

  function updateCoins (dt, t, playerPos) {
    const radius = player.mode === 'drive' ? 2.6 : 1.6;
    let allTaken = true;
    for (const c of coins) {
      if (c.taken) continue;
      allTaken = false;
      c.mesh.rotation.y += dt * 3;
      c.mesh.position.y = terrainHeight(c.mesh.position.x, c.mesh.position.z) +
        1.2 + Math.sin(t * 2 + c.spin) * 0.15;
      const dx = c.mesh.position.x - playerPos.x;
      const dz = c.mesh.position.z - playerPos.z;
      if (dx * dx + dz * dz < radius * radius) {
        c.taken = true;
        c.mesh.visible = false;
        missions.coins++;
        hud.coins.textContent = missions.coins.toLocaleString(locale());
        sfx.coin();
      }
    }
    if (allTaken) {
      coinsRespawnTimer += dt;
      if (coinsRespawnTimer > 4) {
        coinsRespawnTimer = 0;
        for (const c of coins) { c.taken = false; c.mesh.visible = true; }
        hud.toast(tr('coins_back'));
      }
    } else {
      coinsRespawnTimer = 0;
    }
  }

  // ---------- telecamera in terza persona ----------
  const camTarget = new THREE.Vector3();

  // visuale libera col tasto destro: tenendolo premuto giri la camera
  // (trascinando il mouse); dopo 2 secondi che non la muovi rientra
  // morbida dietro al personaggio
  let camOrbit = 0;     // angolo rispetto alla vista "dietro le spalle"
  let camOrbitIdle = 0; // secondi da quando l'hai mossa l'ultima volta
  let rmbDown = false;
  window.addEventListener('mousedown', (e) => { if (e.button === 2) rmbDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 2) rmbDown = false; });
  window.addEventListener('mousemove', (e) => {
    if (rmbDown && uiState === 'playing') {
      const dx = Math.max(-40, Math.min(40, e.movementX || 0));
      camOrbit -= dx * 0.0045;
      camOrbitIdle = 0;
    }
  });
  window.addEventListener('contextmenu', (e) => {
    if (uiState === 'playing') e.preventDefault();
  });

  // se il segmento giocatore->camera attraversa un edificio, avvicina la
  // camera al giocatore così la vista non finisce dentro i muri
  function clipCamera (from, to) {
    let tOut = 1;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    for (const c of colliders) {
      if (c.minY !== undefined) continue; // i muri del garage non tagliano la vista
      let t0 = 0;
      let t1 = 1;
      let dentro = true;
      for (const [f, d, mn, mx] of [[from.x, dx, c.minX, c.maxX], [from.z, dz, c.minZ, c.maxZ]]) {
        if (Math.abs(d) < 1e-9) {
          if (f < mn || f > mx) { dentro = false; break; }
        } else {
          let ta = (mn - f) / d;
          let tb = (mx - f) / d;
          if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) { dentro = false; break; }
        }
      }
      if (dentro && t0 > 0.05 && t0 < tOut) tOut = t0;
    }
    return tOut;
  }

  function updateCamera (dt, pos, yaw, driving) {
    // il sole segue il giocatore: la mappa ombre copre solo i dintorni
    sun.target.position.set(pos.x, 0, pos.z);
    sun.position.set(pos.x + 70, 110, pos.z + 40);

    // orbita col tasto destro: dopo 2 secondi fermi, torna dietro al
    // personaggio con un rientro morbido
    if (rmbDown) {
      camOrbitIdle = 0;
    } else {
      camOrbitIdle += dt;
      if (camOrbitIdle > 2) camOrbit *= Math.exp(-4 * dt);
    }
    const yaw2 = yaw + camOrbit;
    const dist = driving ? 11 : 7;
    const height = driving ? 5.5 : 3.4;
    const py = pos.y || 0; // anche sottoterra la camera ti segue in giù
    const desired = new THREE.Vector3(
      pos.x - Math.sin(yaw2) * dist,
      py + height,
      pos.z - Math.cos(yaw2) * dist
    );
    const t = clipCamera(pos, desired);
    if (t < 1) {
      // avvicina la camera e alzala un po', vista "dall'alto" davanti al muro
      desired.x = pos.x + (desired.x - pos.x) * (t - 0.03);
      desired.z = pos.z + (desired.z - pos.z) * (t - 0.03);
      desired.y = py + height + (1 - t) * 2.5;
    }
    camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    camTarget.set(pos.x, py + (driving ? 1.6 : 1.5), pos.z);
    camera.lookAt(camTarget);
  }
  updateCamera(1, player.pos, player.yaw, false);

  // ---------- menu ----------
  el('btn-play').addEventListener('click', () => {
    initAudio();
    uiState = 'playing';
    menuEl.classList.add('hidden');
    hud.show();
    startMission(missions);
    sfx.pickup();
  });

  // ---------- menu di personalizzazione (stile creazione giocatore) ----------
  const CATS = [
    { key: 'shirt', nome: '👕 Magliette', items: SHIRTS },
    { key: 'pants', nome: '👖 Pantaloni', items: PANTS },
    { key: 'shoes', nome: '👟 Scarpe', items: SHOES },
    { key: 'skin', nome: '🎨 Pelle', items: SKINS },
    { key: 'hair', nome: '💇 Capelli', items: HAIRCUTS },
    { key: 'eyes', nome: '👁 Occhi', items: EYES },
    { key: 'mouth', nome: '👄 Bocca', items: MOUTHS },
    { key: 'beard', nome: '🧔 Barba', items: BEARDS },
    { key: 'fuzz', nome: '🌱 Peluria', items: FUZZ },
    { key: 'hands', nome: '✋ Mani', items: HANDS }
  ];
  let activeCat = 'body';
  const tabsEl = el('ctabs');
  const gridEl = el('cgrid');
  const bodyEl = el('cbody');

  function buildLabel () {
    const bmi = cfg.weightKg / Math.pow(cfg.heightCm / 100, 2);
    el('c-build').textContent = tr('build_prefix') +
      (bmi < 18 ? tr('build_thin') : bmi < 25 ? tr('build_athletic') : bmi < 30 ? tr('build_strong') : tr('build_heavy'));
    el('h-val').textContent = cfg.heightCm;
    el('w-val').textContent = cfg.weightKg;
  }

  function renderTabs () {
    tabsEl.innerHTML = '';
    const mk = (id, label) => {
      const b = document.createElement('button');
      b.className = 'ctab' + (activeCat === id ? ' sel' : '');
      b.textContent = label;
      b.onclick = () => { activeCat = id; renderTabs(); renderGrid(); };
      tabsEl.appendChild(b);
    };
    mk('body', tr('tab_body'));
    CATS.forEach(c => mk(c.key, tr('cat_' + c.key)));
  }

  function renderGrid () {
    if (activeCat === 'body') {
      bodyEl.classList.remove('hidden');
      gridEl.innerHTML = '';
      buildLabel();
      return;
    }
    bodyEl.classList.add('hidden');
    const cat = CATS.find(c => c.key === activeCat);
    gridEl.innerHTML = '';
    cat.items.forEach((item, i) => {
      const b = document.createElement('button');
      b.className = 'card' + (cfg[activeCat] === i ? ' sel' : '');
      if (item.color) {
        const dot = document.createElement('span');
        dot.style.cssText = 'display:inline-block;width:14px;height:14px;border-radius:50%;background:' + item.color + ';vertical-align:-2px;margin-right:6px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.08)';
        b.appendChild(dot);
      }
      b.appendChild(document.createTextNode(tn(item.nome)));
      b.onclick = () => {
        cfg[activeCat] = i;
        applyAvatar(player.rig, cfg, scene);
        saveAvatarConfig(cfg);
        renderGrid();
        sfx.coin();
      };
      gridEl.appendChild(b);
    });
  }

  el('c-height').addEventListener('input', (e) => {
    cfg.heightCm = +e.target.value;
    applyBody(player.rig, cfg);
    saveAvatarConfig(cfg);
    buildLabel();
  });
  el('c-weight').addEventListener('input', (e) => {
    cfg.weightKg = +e.target.value;
    applyBody(player.rig, cfg);
    saveAvatarConfig(cfg);
    buildLabel();
  });
  el('c-done').addEventListener('click', closeCustomizer);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && uiState === 'customizer') closeCustomizer();
  });

  function openCustomizer () {
    uiState = 'customizer';
    customizerEl.classList.remove('hidden');
    bubbleEl.classList.add('hidden');
    renderTabs();
    renderGrid();
    sfx.pickup();
  }
  function closeCustomizer () {
    uiState = 'playing';
    customizerEl.classList.add('hidden');
  }

  // ---------- negozio della concessionaria ----------
  const dGrid = el('dgrid');
  const dCoins = el('d-coins');

  function renderDealer () {
    dCoins.textContent = tr('coins_n', { n: missions.coins.toLocaleString(locale()) });
    dGrid.innerHTML = '';
    SHOP.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'card' + (garage.current === i ? ' sel' : '');
      if (!garage.owned[i]) {
        b.innerHTML = '<b>' + tn(c.nome) + '</b><br>' + tr('car_until', { v: Math.round(c.topSpeed * 3.6) }) +
          '<br>🪙 <b>' + c.price.toLocaleString(locale()) + '</b>';
      } else {
        b.innerHTML = '<b>' + tn(c.nome) + '</b><br>' + tr('car_until', { v: Math.round(c.topSpeed * 3.6) }) +
          '<br>' + (garage.current === i ? tr('car_yours') : tr('car_use'));
      }
      b.onclick = () => {
        if (!garage.owned[i]) {
          if (missions.coins < c.price) {
            hud.toast(tr('need_coins', { n: (c.price - missions.coins).toLocaleString(locale()) }));
            sfx.bump();
            return;
          }
          missions.coins -= c.price;
          hud.coins.textContent = missions.coins.toLocaleString(locale());
          garage.owned[i] = true;
          hud.toast(tr('bought', { name: tn(c.nome) }));
          sfx.coin();
        } else {
          sfx.pickup();
        }
        switchCar(i);
        renderDealer();
      };
      dGrid.appendChild(b);
    });
  }
  function openDealer () {
    uiState = 'dealer';
    dealerEl.classList.remove('hidden');
    bubbleEl.classList.add('hidden');
    renderDealer();
    sfx.pickup();
  }
  function closeDealer () {
    uiState = 'playing';
    dealerEl.classList.add('hidden');
  }
  el('d-done').addEventListener('click', closeDealer);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && bigmap.isOpen()) bigmap.close();
    if (e.code === 'Escape' && uiState === 'dealer') closeDealer();
    if (e.code === 'Escape' && uiState === 'talking') talk.close();
  });

  // ---------- bolla del barbiere ----------
  function updateBarberBubble () {
    if (uiState !== 'playing' || player.mode !== 'walk' ||
        player.pos.distanceTo(barber.barberPos) > 3.4) {
      bubbleEl.classList.add('hidden');
      return false;
    }
    // la testa segue l'osso del cranio (figlio dell'osso Head): la bolla va
    // un po' sopra
    const bone = barber.barberRig.bones.ossoCapelli ||
      barber.barberRig.bones.head || barber.barberRig.bones.spine2;
    const hp = bone
      ? bone.getWorldPosition(tmpV)
      : tmpV.copy(barber.barberPos).setY(1.7);
    hp.y += bone === barber.barberRig.bones.ossoCapelli ? 0.45 : 0.85;
    const proj = hp.project(camera);
    if (proj.z > 1) { bubbleEl.classList.add('hidden'); return false; }
    bubbleEl.style.left = ((proj.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    bubbleEl.style.top = ((-proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    bubbleEl.classList.remove('hidden');
    return true;
  }

  // ---------- resize ----------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- pronto ----------
  loadingEl.classList.add('hidden');
  buildLangSwitch(el('langs')); // bandierine per cambiare lingua nel menu
  menuEl.classList.remove('hidden');
  uiState = 'menu';
  window.__game = { scene, camera, player, barber, dealer, workshop, smoke, assets, npcs, traffic, benches, missions, police, heists, crossers,
    lights, lightPhase, city, // debug semafori e mondo
    // debug: forzare lo stato (es. test del conto dell'ospedale)
    __debug: { setUiState: s => { uiState = s; } } };
  window.__game.renderer = renderer; // per diagnosticare le prestazioni

  // ---------- ciclo di gioco ----------
  initInput();
  const clock = new THREE.Clock();
  let fpsN = 0;          // fotogrammi dall'ultimo tick
  let fpsT0 = performance.now(); // inizio del tick (tempo reale, non il dt limitato)

  // cerchi di collisione delle auto (ogni auto = due cerchi lungo il corpo):
  // usati dal giocatore a piedi, dai personaggi e dall'auto del giocatore.
  // Con vx, vz: la velocità dell'auto serve per il ragdoll dei pedoni.
  const carCircles = [];
  const playerCarCircles = []; // l'auto del giocatore mentre guida
  let lastPrompt = ''; // per non riscrivere il testo del prompt ogni frame
  function addCarCircle (x, z, heading, vx, vz, arr, y = 0) {
    for (const off of [1.1, -1.1]) {
      arr.push({ x: x + Math.sin(heading) * off, z: z + Math.cos(heading) * off, r: 1.0, vx, vz, y });
    }
  }
  // i veicoli in scena: le bici sono strette (un cerchietto solo)
  function addVehicleCircles (model, x, z, heading, vx, vz, arr, y = 0) {
    if (model.userData && model.userData.bike) {
      arr.push({ x, z, r: 0.6, vx, vz, y });
      return;
    }
    addCarCircle(x, z, heading, vx, vz, arr, y);
  }
  function updateCarCircles (excludePlayerCar) {
    carCircles.length = 0;
    playerCarCircles.length = 0;
    if (excludePlayerCar) {
      // in guida: il veicolo del giocatore va nei suoi cerchi (per i pedoni)
      const vx = Math.sin(player.heading) * player.speed;
      const vz = Math.cos(player.heading) * player.speed;
      addVehicleCircles(player.car, player.carPos.x, player.carPos.z, player.heading, vx, vz, playerCarCircles, player.carPos.y || 0);
    } else {
      addVehicleCircles(player.car, player.carPos.x, player.carPos.z, player.heading, 0, 0, carCircles, player.carPos.y || 0);
    }
    for (const c of traffic) {
      const h = c.car.rotation.y;
      addCarCircle(c.car.position.x, c.car.position.z, h,
        Math.sin(h) * c.speed, Math.cos(h) * c.speed, carCircles);
    }
    // e anche i veicoli parcheggiati (lasciati in giro dal giocatore)
    for (const pc of parkedCars) {
      addVehicleCircles(pc, pc.position.x, pc.position.z, pc.rotation.y, 0, 0, carCircles);
    }
  }

  function animate () {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // contatore FPS reale: ogni 10 secondi la media finisce nel log
    // (console -> processo main -> game.log). Usa performance.now() e non
    // il dt del gioco, che è limitato a 0.05 e con tanto lag "rallenta"
    fpsN++;
    const fpsNow = performance.now();
    if (fpsNow - fpsT0 >= 10000) {
      console.log('[fps]', Math.round(fpsN * 1000 / (fpsNow - fpsT0)),
        '| risoluzione:', Math.round(window.innerWidth * renderer.getPixelRatio()) + 'x' +
        Math.round(window.innerHeight * renderer.getPixelRatio()),
        '| pixelRatio:', renderer.getPixelRatio());
      fpsN = 0; fpsT0 = fpsNow;
    }

    // nuvole alla deriva
    for (const c of clouds) {
      c.g.position.x += c.speed * dt;
      if (c.g.position.x > CITY_SIZE) c.g.position.x = -CITY_SIZE;
    }

    barber.update(dt, t);
    dealer.update(dt, t);
    workshop.update(dt, t);
    smoke.update(dt);
    updateCity(dt);

    if (uiState === 'playing') {
      // mappa completa: si apre con M (o cliccando la minimappa)
      if (consumePress('KeyM')) bigmap.open();
      if (consumePress('KeyE')) {
        if (player.mode === 'drive' && player.carPos.distanceTo(workshop.repairPos) < 4.5 &&
            (player.carDamage || 0) > 0.01) {
          // sulla piazzola dell'officina con l'auto rovinata: ripara (a pagamento)
          const costo = repairCost();
          if (missions.coins >= costo) {
            missions.coins -= costo;
            hud.coins.textContent = missions.coins.toLocaleString(locale());
            repairCar(player);
            sfx.coin();
            hud.toast(tr('repair_done', { n: costo.toLocaleString(locale()) }));
          } else {
            sfx.bump();
            hud.toast(tr('repair_need', { n: costo.toLocaleString(locale()) }));
          }
        } else if (player.mode === 'walk' && player.pos.distanceTo(barber.barberPos) < 3.4) {
          openCustomizer();
        } else if (player.mode === 'walk' && player.pos.distanceTo(dealer.dealerPos) < 3.6) {
          openDealer();
        } else if (!robbery && (police.stars === 0 ||
                   (player.mode === 'drive' && player.car.userData.stolen)) &&
                   heists.spots.some(s => {
                     const px = player.mode === 'drive' ? player.carPos.x : player.pos.x;
                     const pz = player.mode === 'drive' ? player.carPos.z : player.pos.z;
                     return Math.hypot(px - s.x, pz - s.z) < 3.8;
                   })) {
          // davanti a banca/gioielleria/supermarket: inizia la rapina
          // (a piedi o anche restando in macchina)
          const px = player.mode === 'drive' ? player.carPos.x : player.pos.x;
          const pz = player.mode === 'drive' ? player.carPos.z : player.pos.z;
          robbery = { spot: heists.spots.find(s => Math.hypot(px - s.x, pz - s.z) < 3.8), t: 0 };
          hud.toast(tr('alarm'));
          sfx.pickup();
        } else {
          // prima le panchine (siamo più vicini a una panchina che all'auto),
          // poi l'auto del traffico da rubare, le auto parcheggiate e per
          // ultime salire/scendere dalla macchina di adesso
          const sitRes = trySit(player, benches);
          if (sitRes === 'sitting') sfx.pickup();
          else if (sitRes === 'rising') sfx.pickup();
          else if (player.mode === 'walk' && traffic.some(c =>
              Math.hypot(c.car.position.x - player.pos.x, c.car.position.z - player.pos.z) < 3.6)) {
            stealTrafficCar(traffic.find(c =>
              Math.hypot(c.car.position.x - player.pos.x, c.car.position.z - player.pos.z) < 3.6));
          } else if (player.mode === 'walk' && parkedCars.some(c =>
              Math.hypot(c.position.x - player.pos.x, c.position.z - player.pos.z) < 3.6)) {
            swapToParked(parkedCars.find(c =>
              Math.hypot(c.position.x - player.pos.x, c.position.z - player.pos.z) < 3.6));
          } else if (player.mode === 'walk' && freeBikes.some(b =>
              Math.hypot(b.position.x - player.pos.x, b.position.z - player.pos.z) < 2.6)) {
            takeFreeBike(freeBikes.find(b =>
              Math.hypot(b.position.x - player.pos.x, b.position.z - player.pos.z) < 2.6));
          } else {
            // usa sempre player.car: switchCar sostituisce il modello quando
            // compri un'auto, la vecchia variabile "car" non è più in scena
            const res = tryEnterExit(player, player.car);
            if (res === 'entered') { sfx.door(); hud.speed.classList.remove('hidden'); hud.prompt.classList.add('hidden'); }
            if (res === 'exited') { sfx.door(); hud.speed.classList.add('hidden'); }
          }
        }
      }

      const playerPos = player.mode === 'drive' ? player.carPos : player.pos;
      updateCarCircles(player.mode === 'drive');

      if (player.mode === 'drive') {
        const dmgBefore = player.carDamage || 0;
        const r = updateDrive(player, dt, colliders, carCircles);
        if (r.bumped) {
          sfx.bump();
          if (dmgBefore < 0.3 && (player.carDamage || 0) >= 0.3) {
            hud.toast(tr('dmg_30'));
          } else if (dmgBefore < 0.6 && player.carDamage >= 0.6) {
            hud.toast(tr('dmg_60'));
          }
        }
        syncCarVisual(player, dt);
        // in bici il personaggio si vede: è seduto in sella
        if (player.car.userData && player.car.userData.bike) syncBikeRider(player, dt);
        // fumo nero dal cofano quando l'auto è molto rovinata (più danno
        // = più sbuffi al secondo), anche da ferma. Le bici non fumano!
        if (!(player.car.userData && player.car.userData.bike) &&
            (player.carDamage || 0) > 0.45 &&
            Math.random() < dt * 14 * player.carDamage) {
          const [L, H] = player.car.userData?.size || [4, 1.5];
          const hood = player.carPos.clone().add(new THREE.Vector3(
            Math.sin(player.heading) * (L / 2 - 0.5),
            H * 0.55,
            Math.cos(player.heading) * (L / 2 - 0.5)
          ));
          smoke.spawn(hood.x, hood.y, hood.z);
        }
        const dmgPct = Math.round((player.carDamage || 0) * 100);
        hud.speed.textContent = `${Math.round(Math.abs(player.speed) * 3.6)} ${tr('kmh')}` +
          (dmgPct ? ` 🔧 ${dmgPct}%` : '');
        // davanti alla porta dell'officina: ricorda come si ripara
        const nearWorkshop = player.carPos.distanceTo(workshop.repairPos) < 4.5 &&
          (player.carDamage || 0) > 0.01;
        if (nearWorkshop) {
          const txt = tr('prompt_repair', { n: repairCost().toLocaleString(locale()) });
          if (txt !== lastPrompt) { hud.prompt.innerHTML = txt; lastPrompt = txt; }
        }
        hud.prompt.classList.toggle('hidden', !nearWorkshop);
        updateCamera(dt, player.carPos, player.heading, true);
      } else {
        updateWalk(player, dt, colliders, carCircles);
        updateCamera(dt, player.pos, player.yaw, false);
        const nearBarber = player.pos.distanceTo(barber.barberPos) < 3.4;
        const nearDealer = player.pos.distanceTo(dealer.dealerPos) < 3.6;
        const nearCar = player.pos.distanceTo(player.car.position) < 3.6;
        const sitting = player.rig.sitPhase;
        const nearBench = !sitting && benches.some(b =>
          Math.hypot(player.pos.x - b.x, player.pos.z - b.z) < 1.7);
        // auto del traffico vicina (si ruba!) e auto parcheggiate (si riprende)
        const nearTrafficCar = traffic.find(c =>
          Math.hypot(c.car.position.x - player.pos.x, c.car.position.z - player.pos.z) < 3.6);
        const nearParked = parkedCars.find(c =>
          Math.hypot(c.position.x - player.pos.x, c.position.z - player.pos.z) < 3.6);
        // una bici lasciata in giro (si prende con E!)
        const nearFreeBike = freeBikes.find(b =>
          Math.hypot(b.position.x - player.pos.x, b.position.z - player.pos.z) < 2.6);
        // il passante più vicino (anche sui passanti delle strisce): se
        // c'è, il prompt è "premi T per parlare"
        let nearNpc = null;
        let npcDist = 3.2;
        for (const n of talkers) {
          if (n.rd) continue;
          const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
          if (d < npcDist) { npcDist = d; nearNpc = n; }
        }
        // prompt in base a cosa c'è vicino (sedersi, la concessionaria, i
        // furti e solo dopo l'auto di adesso)
        const ownBike = !!player.car.userData.bike; // anche la tua è una bici?
        const txt = sitting ? tr('prompt_stand')
          : nearBench ? tr('prompt_sit')
          : nearDealer ? tr('prompt_buy')
          : nearNpc ? tr('prompt_talk')
          : nearTrafficCar ? tr('prompt_steal')
          : nearParked ? tr(nearParked.userData.bike ? 'prompt_swap_bike' : 'prompt_swap_car')
          : nearFreeBike ? tr('prompt_take_bike')
          : (nearCar && !nearBarber && !nearDealer) ? tr(ownBike ? 'prompt_enter_bike' : 'prompt_enter_car')
          : '';
        if (txt !== lastPrompt) { hud.prompt.innerHTML = txt; lastPrompt = txt; }
        hud.prompt.classList.toggle('hidden', !txt);

        // T: parla col passante più vicino (prima ancora di E, così non
        // entri in macchina mentre vuoi chiacchierare)
        if (nearNpc && consumePress('KeyT')) {
          if (talk.tryTalk()) uiState = 'talking';
        }
      }

      updateBarberBubble();
      updateNPCs(npcs, dt, colliders, carCircles, player.pos, playerCarCircles,
        () => { sfx.bump(); hud.toast(tr('npc_bump')); });
      crossers.updateCrossers(dt, carCircles, playerCarCircles, player.pos,
        () => { sfx.bump(); hud.toast(tr('npc_bump')); });
      updateTraffic(traffic, dt, playerPos, lights, lightPhase);
      updateCoins(dt, t, playerPos);
      updateMissions(missions, dt, playerPos, hud, sfx);
      hud.updateToast(dt);

      // ----- navigatore: arrivati a destinazione? -----
      if (nav.on && Math.hypot(playerPos.x - nav.x, playerPos.z - nav.z) < 8) {
        nav.on = false;
        hud.toast(tr('nav_arrived'));
        sfx.coin();
      }

      // ----- rapina in corso: resta vicino alla porta per 4 secondi -----
      if (robbery) {
        const s = robbery.spot;
        if (Math.hypot(playerPos.x - s.x, playerPos.z - s.z) > 5) {
          robbery = null;
          hud.setRobbery(null);
          hud.toast(tr('robbery_abort'));
          police.startRobbery(s, player);
        } else {
          robbery.t += dt;
          hud.setRobbery(Math.min(robbery.t / 4, 1), tr('robbery_ongoing'));
          if (robbery.t >= 4) {
            missions.coins += s.reward;
            hud.coins.textContent = missions.coins.toLocaleString(locale());
            hud.setRobbery(null);
            sfx.coin();
            police.startRobbery(s, player);
            // rapina fatta con l'auto rubata: la polizia aggiunge un'altra stella
            const inStolen = player.mode === 'drive' && player.car.userData.stolen;
            hud.toast(tr(inStolen ? 'robbery_win_stolen' : 'robbery_win',
              { n: s.reward.toLocaleString(locale()) }));
            if (inStolen) police.addStars(1, player);
            robbery = null;
          }
        }
      }

      // ----- sparare con F (solo quando la polizia ti da' la caccia) -----
      if (consumePress('KeyF')) police.playerShoot(player);

      // ----- polizia: stelle, inseguimenti, arresti -----
      policeCtx.player = player;
      policeCtx.playerPos = playerPos;
      policeCtx.pads = garagePads; // i garage sotterranei sono i nascondigli
      policeCtx.hud = hud;
      policeCtx.sfx = sfx;
      policeCtx.onDeath = (reason) => {
        if (uiState !== 'playing') return;
        uiState = 'dead';
        deadTimer = 3.5;
        robbery = null;
        hud.setRobbery(null);
        hud.bigMsg(reason === 'morto' ? tr('big_dead') : tr('big_busted'), reason);
        sfx.bump();
      };
      police.update(dt, policeCtx);
      hud.setStars(police.stars);
      hud.setHearts(police.hearts);
    } else if (uiState === 'customizer') {
      // il mondo continua a vivere, la camera guarda l'avatar davanti
      animateRig(player.rig, dt, false, false);
      player.rig.group.position.copy(player.pos);
      player.rig.group.rotation.y = player.yaw;
      player.rig.updateDecos();
      updateNPCs(npcs, dt, colliders);
      crossers.updateCrossers(dt);
      updateTraffic(traffic, dt, player.pos, lights, lightPhase);

      const front = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(1.55);
      const desired = player.pos.clone().add(front).add(new THREE.Vector3(0, 1.55, 0));
      camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
      camera.lookAt(player.pos.x, player.pos.y + 1.42, player.pos.z);
    } else if (uiState === 'dealer') {
      // il mondo continua a vivere dietro al negozio, il giocatore è fermo
      animateRig(player.rig, dt, false, false);
      player.rig.group.position.copy(player.pos);
      player.rig.group.rotation.y = player.yaw;
      player.rig.updateDecos();
      updateNPCs(npcs, dt, colliders);
      crossers.updateCrossers(dt);
      updateTraffic(traffic, dt, player.pos, lights, lightPhase);
    } else if (uiState === 'talking') {
      // stai parlando con un passante: il mondo vive, tu sei fermo e la
      // camera guarda l'NPC da dietro alle tue spalle
      if (!talk.isOpen()) uiState = 'playing'; // chiuso col pulsante o Esc
      updateNPCs(npcs, dt, colliders, carCircles, player.pos, playerCarCircles,
        () => { sfx.bump(); hud.toast(tr('npc_bump')); });
      crossers.updateCrossers(dt, carCircles, playerCarCircles, player.pos,
        () => { sfx.bump(); hud.toast(tr('npc_bump')); });
      updateTraffic(traffic, dt, player.pos, lights, lightPhase);
      updateCoins(dt, t, player.pos);
      updateMissions(missions, dt, player.pos, hud, sfx);
      hud.updateToast(dt);
      updateBarberBubble();
      talk.updateBubble();
      const talkNpc = talk.isOpen()
        ? npcs.find(n => Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z) < 4) : null;
      if (talkNpc) {
        const face = Math.atan2(player.pos.x - talkNpc.pos.x, player.pos.z - talkNpc.pos.z);
        talkNpc.yaw = face; // l'NPC si guarda te
        const mid = player.pos.clone().add(talkNpc.pos).multiplyScalar(0.5);
        const camPos = mid.clone().add(new THREE.Vector3(
          Math.sin(player.yaw) * -4.5, 2.8, Math.cos(player.yaw) * -4.5));
        camera.position.lerp(camPos, 1 - Math.exp(-4 * dt));
        camera.lookAt(talkNpc.pos.x, 1.6, talkNpc.pos.z);
      }
    } else if (uiState === 'dead') {
      // MORTO / ARRESTATO: schermo a tinta unita, poi ti risvegli all'ospedale
      // con una vera fattura (ambulanza + ricovero) e l'auto davanti
      deadTimer -= dt;
      if (deadTimer <= 0) {
        hud.hideBigMsg();
        police.clearAll();
        hud.setStars(0);
        hud.setHearts(HEARTS_MAX);
        // il conto dell'ospedale, come al pronto soccorso: corsa in
        // ambulanza + un giorno di ricovero in reparto. Se non bastano,
        // prendono tutto quello che hai
        const AMBULANZA = 200;
        const RICOVERO = 300;
        const conto = AMBULANZA + RICOVERO;
        const pagato = Math.min(missions.coins, conto);
        missions.coins -= pagato;
        hud.coins.textContent = missions.coins.toLocaleString(locale());
        if (player.mode === 'drive') hud.speed.classList.add('hidden');
        player.mode = 'walk';
        player.pos.copy(hospital.spawn);
        player.pos.y = 0;
        player.rig.group.visible = true;
        player.rig.decosVisible = true;
        player.rig.sitPhase = null; // niente pose sedute di mezzo (bici compresa)
        for (const d of player.rig.decos) d.obj.visible = true;
        // ti riportano l'auto davanti all'ospedale
        player.carPos.copy(hospital.carSpot);
        player.heading = hospital.carHeading;
        player.speed = 0;
        syncCarVisual(player, 0);
        hud.toast(tr('hospital_bill', {
          a: AMBULANZA.toLocaleString(locale()),
          r: RICOVERO.toLocaleString(locale()),
          tot: conto.toLocaleString(locale())
        }) + (pagato >= conto ? '' : ' ' + tr('hospital_took')));
        uiState = 'playing';
      }
    } else if (uiState === 'menu') {
      // nel menu la camera orbita lenta sulla città
      const a = t * 0.08;
      camera.position.set(Math.sin(a) * 170, 70, Math.cos(a) * 170);
      camera.lookAt(0, 0, 0);
    }

    // minimappa in tutti gli stati di gioco (non nel menu)
    if (uiState !== 'menu' && uiState !== 'loading') {
      minimap.update({
        player, car, missions, barber, dealer, traffic, coins,
        bikes: freeBikes, // bici da prendere in giro
        nav, // la destinazione del navigatore (se accesa)
        heists: heists.spots.concat([
          { x: hospital.spawn.x, z: hospital.spawn.z, icon: '🏥' },
          { x: workshop.pos.x, z: workshop.pos.z, icon: '🔧' }
        ]),
        pads: garagePads
      });
    }

    endFrame();
    renderer.render(scene, camera);
  }
  animate();
}
