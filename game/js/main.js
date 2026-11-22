// -------------------------------------------------------------
// Auto Avventure — Kids City
// Modulo principale: caricamento asset, scena, ciclo di gioco,
// barbiere e personalizzazione dell'avatar.
// -------------------------------------------------------------
import * as THREE from 'three';
import { initInput, consumePress, endFrame } from './input.js';
import { buildCity, resolveCollisions, CITY_SIZE, GRID } from './city.js';
import { loadAssets } from './assets.js';
import { createPlayer, attachCar, updateWalk, updateDrive, tryEnterExit, trySit, syncCarVisual, repairCar } from './player.js';
import { createNPCs, updateNPCs } from './npc.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createHUD } from './hud.js';
import { createMinimap } from './minimap.js';
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
import { t as tr, tn, locale, applyStatic, buildLangSwitch } from './i18n.js';

// testi statici della pagina (menu, hud, pannelli) nella lingua salvata
applyStatic();

// ---------- renderer, scena, camera ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3f0);
scene.fog = new THREE.Fog(0x9fd8f5, 170, 560);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

// ---------- luci ----------
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x9c8f6b, 1.05));
const sun = new THREE.DirectionalLight(0xfff3d6, 1.8);
sun.position.set(70, 110, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(3072, 3072);
sun.shadow.camera.left = -240;
sun.shadow.camera.right = 240;
sun.shadow.camera.top = 240;
sun.shadow.camera.bottom = -240;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 600;
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
  const { colliders, pois, clouds, roadCenters, benches, updateCity } = city;
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

  // cambia (o compra) un'auto: il modello si sostituisce dove sei
  function switchCar (i) {
    const model = SHOP[i].prefab.clone();
    scene.add(model);
    scene.remove(player.car);
    player.car = model;
    player.maxSpeed = SHOP[i].topSpeed;
    player.carDamage = 0; // un'auto appena comprata è integra, non eredita
                          // i danni della vecchia
    garage.current = i;
    syncCarVisual(player, 0);
  }
  // all'inizio guidi la Citycar del negozio (l'unica già tua)
  switchCar(0);

  const npcs = createNPCs(scene, 20, colliders, pois, assets.createEric);
  const traffic = createTraffic(scene, roadCenters, assets.carPrefabs, playerCarPrefab, 10);
  const missions = createMissions(scene, pois);
  const hud = createHUD();
  const minimap = createMinimap(el('minimap'), city.map);

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
    mesh.position.set(p.x, 1.2, p.z);
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
      c.mesh.position.y = 1.2 + Math.sin(t * 2 + c.spin) * 0.15;
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
    if (e.code === 'Escape' && uiState === 'dealer') closeDealer();
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
  window.__game = { scene, camera, player, barber, dealer, workshop, smoke, assets, npcs, traffic, benches, missions, police, heists,
    // debug: forzare lo stato (es. test del conto dell'ospedale)
    __debug: { setUiState: s => { uiState = s; } } };

  // ---------- ciclo di gioco ----------
  initInput();
  const clock = new THREE.Clock();

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
  function updateCarCircles (excludePlayerCar) {
    carCircles.length = 0;
    playerCarCircles.length = 0;
    if (excludePlayerCar) {
      // in guida: l'auto del giocatore va nei suoi cerchi (per i pedoni)
      const vx = Math.sin(player.heading) * player.speed;
      const vz = Math.cos(player.heading) * player.speed;
      addCarCircle(player.carPos.x, player.carPos.z, player.heading, vx, vz, playerCarCircles, player.carPos.y || 0);
    } else {
      addCarCircle(player.carPos.x, player.carPos.z, player.heading, 0, 0, carCircles, player.carPos.y || 0);
    }
    for (const c of traffic) {
      const h = c.car.rotation.y;
      addCarCircle(c.car.position.x, c.car.position.z, h,
        Math.sin(h) * c.speed, Math.cos(h) * c.speed, carCircles);
    }
  }

  function animate () {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

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
        } else if (player.mode === 'walk' && police.stars === 0 && !robbery &&
                   heists.spots.some(s => Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 3.8)) {
          // davanti a banca/gioielleria/supermarket: inizia la rapina
          robbery = { spot: heists.spots.find(s => Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 3.8), t: 0 };
          hud.toast(tr('alarm'));
          sfx.pickup();
        } else {
          // prima le panchine (siamo più vicini a una panchina che all'auto),
          // poi salire/scendere dalla macchina
          const sitRes = trySit(player, benches);
          if (sitRes === 'sitting') sfx.pickup();
          else if (sitRes === 'rising') sfx.pickup();
          else {
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
        // fumo nero dal cofano quando l'auto è molto rovinata (più danno
        // = più sbuffi al secondo), anche da ferma
        if ((player.carDamage || 0) > 0.45 &&
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
        // prompt in base a cosa c'è vicino (sedersi e la concessionaria prima dell'auto)
        const txt = sitting ? tr('prompt_stand')
          : nearBench ? tr('prompt_sit')
          : nearDealer ? tr('prompt_buy')
          : (nearCar && !nearBarber && !nearDealer) ? tr('prompt_enter_car')
          : '';
        if (txt !== lastPrompt) { hud.prompt.innerHTML = txt; lastPrompt = txt; }
        hud.prompt.classList.toggle('hidden', !txt);
      }

      updateBarberBubble();
      updateNPCs(npcs, dt, colliders, carCircles, player.pos, playerCarCircles,
        () => { sfx.bump(); hud.toast(tr('npc_bump')); });
      updateTraffic(traffic, dt, playerPos);
      updateCoins(dt, t, playerPos);
      updateMissions(missions, dt, playerPos, hud, sfx);
      hud.updateToast(dt);

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
            hud.toast(tr('robbery_win', { n: s.reward.toLocaleString(locale()) }));
            sfx.coin();
            police.startRobbery(s, player);
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
      updateTraffic(traffic, dt, player.pos);

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
      updateTraffic(traffic, dt, player.pos);
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
