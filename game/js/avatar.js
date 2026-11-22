// -------------------------------------------------------------
// Personalizzazione dell'avatar (dal barbiere):
// - 20 tagli di capelli, 20 occhi, 20 bocche
// - 5 peluria, 5 barbe, 5 mani
// - 10 magliette, 10 pantaloni, 5 scarpe e palette del colore della pelle
// - altezza e peso in stile "creazione giocatore"
// Le forme sono procedurali e agganciate alle ossa; i vestiti e la pelle
// sono "dipinti" sui vertici della mesh (il modello è una mesh unica).
//
// Personaggio: stickman Mixamo (mesh unica, ossa "mixamorig…").
// Nota: in questo rig la testa non ha vertici legati alle ossa Head, quindi
// le decorazioni della testa sono figlie di ossa di servizio (ossoCapelli,
// ossoOcchioSx, ossoOcchioDx — create in assets.js come figlie dell'osso
// Head): così seguono il dondolio della testa e la scala altezza/peso.
//
// Costanti calibrate sulle misure del modello (testa: sfera r=0.154 con
// centro a y=0.746, collo a y=0.533, tutto in scala 1.8m).
// Le decorazioni sono costruite in scala 1.6 rispetto al modello, partendo
// dalla base del cranio (y=0.592).
// -------------------------------------------------------------
import * as THREE from 'three';

// Riferimenti in metri relativi alla base del cranio, in scala deco (1/1.6)
export const HEAD = {
  skull: 0.096,      // centro del cranio (raggio reale 0.154 / 1.6)
  face: 0.1,         // superficie del viso (leggermente sporgente)
  eyeY: 0.115,       // altezza degli occhi
  eyeX: 0.031,       // semi-distanza tra gli occhi
  eyeShift: 0,       // il volto dello stickman è simmetrico
  mouthY: 0.052,     // altezza della bocca
  jawY: 0.02         // mento / mascella
};
export const DECO_SCALE = 1.6;  // le forme sono disegnate "in scala Eric"
const HEAD_OFFSET = [0, 0.214, 0]; // dalla Spine2 alla base del cranio

const HC = { nero: '#22201e', castano: '#5a3825', biondo: '#e2ba5f', rosso: '#a8431f', grigio: '#c7c7c7', rosa: '#e86aa6', verde: '#3f9142' };

// ---------- piccoli aiuti per costruire le forme ----------
const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r1, r2, h, seg = 12) => new THREE.CylinderGeometry(r1, r2, h, seg);
const T = (r, t, seg, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 8, seg, arc);
const K = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);

function part (geo, color, pos, rot = null, scale = null, opacity = null) {
  const mat = opacity === null
    ? new THREE.MeshLambertMaterial({ color })
    : new THREE.MeshLambertMaterial({ color, transparent: true, opacity });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  return m;
}
function G (...parts) {
  const g = new THREE.Group();
  parts.forEach(p => p && g.add(p));
  return g;
}
const SK = () => HEAD.skull;
// calotta aperta (mezza sfera, non un solido: altrimenti ingloba il cranio
// e nasconde il viso). Il bordo sta poco sopra gli occhi.
const cap = (r, color, dy = 0.035) => {
  const m = part(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), color, [0, SK() + dy, -0.012]);
  m.material.side = THREE.DoubleSide;
  return m;
};

// ---------- 20 tagli di capelli ----------
export const HAIRCUTS = [
  { nome: 'Taglio originale', build: () => null },
  { nome: 'Rasato nero', build: () => cap(0.104, HC.nero, 0.045) },
  { nome: 'Corti castani', build: () => cap(0.112, HC.castano) },
  { nome: 'Corti biondi', build: () => cap(0.112, HC.biondo) },
  { nome: 'Ciuffo castano', build: () => G(
      cap(0.112, HC.castano),
      part(B(0.07, 0.05, 0.04), HC.castano, [0, SK() + 0.07, 0.075], [-0.6, 0, 0])
    ) },
  { nome: 'Afro nero', build: () => part(S(0.105), HC.nero, [0, SK() + 0.08, -0.02], null, [1.05, 0.9, 0.95]) },
  { nome: 'Afro biondo', build: () => part(S(0.105), HC.biondo, [0, SK() + 0.08, -0.02], null, [1.05, 0.9, 0.95]) },
  { nome: 'Ricci rossi', build: () => G(
      cap(0.12, HC.rosso),
      part(S(0.055), HC.rosso, [0, SK() + 0.09, 0]),
      part(S(0.055), HC.rosso, [0.075, SK() + 0.055, 0.03]),
      part(S(0.055), HC.rosso, [-0.075, SK() + 0.055, 0.03]),
      part(S(0.055), HC.rosso, [0.06, SK() + 0.055, -0.08]),
      part(S(0.055), HC.rosso, [-0.06, SK() + 0.055, -0.08])
    ) },
  { nome: 'Punte rosa', build: () => G(
      cap(0.118, HC.rosa),
      ...[[0.06, 0.02], [-0.06, 0.02], [0.045, -0.08], [-0.045, -0.08], [0.085, -0.045], [-0.085, -0.045]].map(([x, z]) =>
        part(K(0.03, 0.1), HC.rosa, [x, SK() + 0.1, z], [z * 2, 0, -x * 2.2]))
    ) },
  { nome: 'Mohawk nero', build: () => G(
      part(B(0.05, 0.13, 0.22), HC.nero, [0, SK() + 0.075, -0.01]),
      cap(0.106, HC.nero, 0.045)
    ) },
  { nome: 'Coda castana', build: () => G(
      cap(0.112, HC.castano),
      part(C(0.028, 0.018, 0.24), HC.castano, [0, SK() - 0.1, -0.135], [0.45, 0, 0])
    ) },
  { nome: 'Coda bionda', build: () => G(
      cap(0.112, HC.biondo),
      part(C(0.028, 0.018, 0.24), HC.biondo, [0, SK() - 0.1, -0.135], [0.45, 0, 0])
    ) },
  { nome: 'Chignon rosso', build: () => G(
      cap(0.108, HC.rosso),
      part(S(0.06), HC.rosso, [0, SK() + 0.1, -0.08])
    ) },
  { nome: 'Lunghi neri', build: () => G(
      cap(0.113, HC.nero),
      part(B(0.2, 0.3, 0.08), HC.nero, [0, SK() - 0.14, -0.105])
    ) },
  { nome: 'Bob castano', build: () => G(
      part(S(0.13), HC.castano, [0, SK() - 0.025, -0.045], null, [1, 0.95, 1]),
      part(B(0.02, 0.15, 0.12), HC.castano, [0.125, SK() - 0.1, -0.02]),
      part(B(0.02, 0.15, 0.12), HC.castano, [-0.125, SK() - 0.1, -0.02])
    ) },
  { nome: 'Treccia grigia', build: () => G(
      cap(0.108, HC.grigio),
      part(S(0.035), HC.grigio, [0, SK() - 0.035, -0.115]),
      part(S(0.03), HC.grigio, [0, SK() - 0.09, -0.12]),
      part(S(0.025), HC.grigio, [0, SK() - 0.14, -0.105])
    ) },
  { nome: 'Punk rosa', build: () => G(
      cap(0.118, HC.rosa),
      part(K(0.04, 0.17), HC.rosa, [0.095, SK() + 0.065, -0.02], [0, 0, -0.55]),
      part(K(0.04, 0.17), HC.rosa, [-0.095, SK() + 0.065, -0.02], [0, 0, 0.55]),
      part(K(0.035, 0.14), HC.rosa, [0, SK() + 0.05, -0.125], [-0.5, 0, 0])
    ) },
  { nome: 'Lungo biondo', build: () => G(
      cap(0.113, HC.biondo),
      part(B(0.19, 0.32, 0.07), HC.biondo, [0, SK() - 0.16, -0.105]),
      part(B(0.02, 0.2, 0.1), HC.biondo, [0.125, SK() - 0.075, -0.02]),
      part(B(0.02, 0.2, 0.1), HC.biondo, [-0.125, SK() - 0.075, -0.02])
    ) },
  { nome: 'Corti verdi', build: () => cap(0.112, HC.verde) },
  { nome: 'Scompigliato grigio', build: () => G(
      cap(0.108, HC.grigio),
      part(B(0.05, 0.07, 0.03), HC.grigio, [0.05, SK() + 0.085, 0.02], [0.3, 0, -0.4]),
      part(B(0.05, 0.07, 0.03), HC.grigio, [-0.06, SK() + 0.075, -0.03], [-0.3, 0, 0.4]),
      part(B(0.04, 0.06, 0.03), HC.grigio, [0.01, SK() + 0.095, -0.07], [0.4, 0, 0.1])
    ) }
];

// ---------- 20 bocche (5 colori x 4 forme) ----------
const MC = { naturale: '#c97a63', rosso: '#c62828', rosa: '#e57373', scuro: '#8d4a3a', prugna: '#7b3247' };
const MOUTH_SHAPES = [
  { nome: 'sottile', build: (c) => part(B(0.036, 0.007, 0.01), c, [0, HEAD.mouthY, 0.09]) },
  { nome: 'sorriso', build: (c) => part(T(0.024, 0.006, 14, 2.2), c, [0, HEAD.mouthY + 0.024, 0.085], [0, 0, -Math.PI / 2 - 1.1]) },
  { nome: 'sorrisone', build: (c) => part(T(0.031, 0.006, 14, 2.6), c, [0, HEAD.mouthY + 0.028, 0.082], [0, 0, -Math.PI / 2 - 1.3]) },
  { nome: 'sbalordito', build: (c) => part(T(0.013, 0.006, 12), c, [0, HEAD.mouthY - 0.002, 0.09], null, [1, 1.3, 1]) }
];
export const MOUTHS = Object.keys(MC).flatMap((ck) =>
  MOUTH_SHAPES.map((sh) => ({
    nome: `Bocca ${sh.nome} ${ck}`,
    build: () => sh.build(MC[ck])
  }))
);

// ---------- 20 occhi (10 colori x 2 misure) ----------
const EC = { marroni: '#5d4037', castani: '#795548', blu: '#42a5f5', azzurri: '#4fc3f7', verdi: '#66bb6a', grigi: '#90a4ae', neri: '#263238', nocciola: '#c68642', viola: '#ab47bc', ambra: '#ffb300' };
const EYE_SIZES = [{ suf: '', r: 0.024 }, { suf: ' giganti', r: 0.032 }];
export const EYES = Object.keys(EC).flatMap((ck) =>
  EYE_SIZES.map((sz) => ({
    nome: `Occhi ${ck}${sz.suf}`,
    build: () => G(
      part(S(sz.r, 12, 10), EC[ck], [HEAD.eyeShift - HEAD.eyeX, HEAD.eyeY, HEAD.face], null, [1, 1, 0.55]),
      part(S(sz.r, 12, 10), EC[ck], [HEAD.eyeShift + HEAD.eyeX, HEAD.eyeY, HEAD.face], null, [1, 1, 0.55])
    )
  }))
);

// ---------- 5 peluria ----------
function fuzz (lvl) {
  const op = 0.14 + lvl * 0.1;
  const s = 1 + lvl * 0.15;
  return G(
    part(B(0.05 * s, 0.014, 0.008), '#6d4c41', [0, HEAD.mouthY + 0.024, 0.092], null, null, op),
    part(B(0.05 * s, 0.055, 0.008), '#6d4c41', [0.055 + HEAD.eyeShift, HEAD.eyeY - 0.05, 0.075], [0, 0.35, 0.15], null, op),
    part(B(0.05 * s, 0.055, 0.008), '#6d4c41', [-0.055 + HEAD.eyeShift, HEAD.eyeY - 0.05, 0.075], [0, -0.35, -0.15], null, op)
  );
}
export const FUZZ = [
  { nome: 'Nessuna', build: () => null },
  { nome: 'Leggera', build: () => fuzz(1) },
  { nome: 'Media', build: () => fuzz(2) },
  { nome: 'Folta', build: () => fuzz(3) },
  { nome: 'Da lupo', build: () => fuzz(4) }
];

// ---------- 5 barbe ----------
export const BEARDS = [
  { nome: 'Nessuna', build: () => null },
  { nome: 'Trespetto', build: () => part(B(0.15, 0.07, 0.075), '#4a2c1a', [0, HEAD.jawY + 0.005, 0.058], null, null, 0.3) },
  { nome: 'Baffi', build: () => G(
      part(B(0.036, 0.012, 0.012), HC.castano, [-0.021 + HEAD.eyeShift, HEAD.mouthY + 0.026, 0.09], [0, 0, 0.3]),
      part(B(0.036, 0.012, 0.012), HC.castano, [0.021 + HEAD.eyeShift, HEAD.mouthY + 0.026, 0.09], [0, 0, -0.3])
    ) },
  { nome: 'Pizzetto', build: () => G(
      part(K(0.014, 0.055), HC.castano, [0 + HEAD.eyeShift, HEAD.jawY - 0.03, 0.062], [Math.PI, 0, 0]),
      part(B(0.03, 0.012, 0.012), HC.castano, [0 + HEAD.eyeShift, HEAD.jawY + 0.005, 0.08])
    ) },
  { nome: 'Barba piena', build: () => G(
      part(T(0.062, 0.018, 18, Math.PI), HC.castano, [0 + HEAD.eyeShift, HEAD.jawY + 0.02, 0.022], [Math.PI / 2, 0, 0]),
      part(S(0.034), HC.castano, [0 + HEAD.eyeShift, HEAD.jawY + 0.012, 0.05], null, [1.15, 0.75, 0.85])
    ) }
];

// ---------- 5 mani ----------
export const HANDS = [
  { nome: 'Della pelle', color: null }, // usa il colore della pelle scelto
  { nome: 'Guanti bianchi', color: '#f8f8f8' },
  { nome: 'Guanti gialli', color: '#fdd835' },
  { nome: 'Guanti rossi', color: '#d32f2f' },
  { nome: 'Guanti neri', color: '#212121' }
];
function handDecor (color) {
  return () => G(
    part(S(0.04), color, [0, -0.035, 0], null, [0.8, 1.3, 0.6]),
    part(C(0.034, 0.038, 0.05), color, [0, 0.015, 0])
  );
}

// ---------- 10 magliette ----------
export const SHIRTS = [
  { nome: 'Rossa', color: '#e53935' },
  { nome: 'Arancione', color: '#fb8c00' },
  { nome: 'Gialla', color: '#fdd835' },
  { nome: 'Verde prato', color: '#43a047' },
  { nome: 'Acquamarina', color: '#00acc1' },
  { nome: 'Azzurra', color: '#1e88e5' },
  { nome: 'Viola', color: '#5e35b1' },
  { nome: 'Rosa', color: '#ec407a' },
  { nome: 'Bianca', color: '#fafafa' },
  { nome: 'Nera', color: '#37474f' }
];

// ---------- 10 pantaloni ----------
export const PANTS = [
  { nome: 'Jeans blu', color: '#3b5985' },
  { nome: 'Neri', color: '#263238' },
  { nome: 'Grigi', color: '#78909c' },
  { nome: 'Beige', color: '#d7c49e' },
  { nome: 'Marroni', color: '#795548' },
  { nome: 'Verde militare', color: '#33691e' },
  { nome: 'Rossi', color: '#b71c1c' },
  { nome: 'Viola', color: '#6a1b9a' },
  { nome: 'Arancioni', color: '#e65100' },
  { nome: 'Chiarissimi', color: '#eceff1' }
];

// ---------- 5 scarpe ----------
export const SHOES = [
  { nome: 'Bianche', color: '#f5f5f5' },
  { nome: 'Nere', color: '#212121' },
  { nome: 'Rosse', color: '#d32f2f' },
  { nome: 'Blu', color: '#1565c0' },
  { nome: 'Gialle', color: '#fbc02d' }
];

// ---------- palette del colore della pelle ----------
export const SKINS = [
  { nome: 'Porcellana', color: '#ffe0bd' },
  { nome: 'Sabbia', color: '#f5cba7' },
  { nome: 'Latte e miele', color: '#eab98b' },
  { nome: 'Mediterranea', color: '#d8a06b' },
  { nome: 'Ambra', color: '#c68642' },
  { nome: 'Caramella', color: '#a9704f' },
  { nome: 'Casta, scura', color: '#8d5524' },
  { nome: 'Cioccolato', color: '#5c3a21' }
];

// ---------- configurazione ----------
const KEY = 'kids-city-avatar-v2';
export const DEFAULT_AVATAR = {
  hair: 2, eyes: 0, mouth: 0, beard: 0, fuzz: 0, hands: 0,
  shirt: 5, pants: 0, shoes: 0, skin: 3,
  heightCm: 175, weightKg: 65
};

export function loadAvatarConfig () {
  try {
    return { ...DEFAULT_AVATAR, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}
export function saveAvatarConfig (cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* ignora */ }
}
export function randomAvatarConfig () {
  const rnd = (n) => Math.floor(Math.random() * n);
  return {
    hair: rnd(HAIRCUTS.length),
    eyes: rnd(EYES.length),
    mouth: rnd(MOUTHS.length),
    beard: rnd(BEARDS.length),
    fuzz: rnd(FUZZ.length),
    hands: rnd(HANDS.length),
    shirt: rnd(SHIRTS.length),
    pants: rnd(PANTS.length),
    shoes: rnd(SHOES.length),
    skin: rnd(SKINS.length),
    heightCm: 150 + rnd(46),
    weightKg: 45 + rnd(51)
  };
}

// applica gli accessori al rig (rimuove quelli precedenti)
export function applyAvatar (rig, cfg, scene) {
  for (const d of rig.decos) {
    d.obj.removeFromParent();
    d.obj.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    });
  }
  rig.decos = [];

  const addDeco = (build, bone, offset = [0, 0, 0], scale = 1) => {
    if (!bone) return;
    const obj = build();
    if (!obj) return;
    // ripiego (nessun osso di servizio): decos a livello scena, tenute
    // al passo dalle ossa da updateDecos
    const wrap = new THREE.Group();
    wrap.add(obj);
    scene.add(wrap);
    rig.decos.push({ obj: wrap, bone, offset: new THREE.Vector3(...offset), scale });
  };

  // capelli, bocca, barba e peluria: agganciati all'osso della testa
  // (figlio dell'osso Head: segue il dondolio E la scala altezza/peso).
  // Le forme sono costruite partendo dalla base del cranio: l'osso sta al
  // centro, quindi vanno spostate in giù del raggio del cranio.
  const addHeadDeco = (build) => {
    const anchor = rig.bones.ossoCapelli;
    if (!anchor) {
      addDeco(build, rig.bones.spine2 || rig.bones.head, HEAD_OFFSET, DECO_SCALE);
      return;
    }
    const obj = build();
    if (!obj) return;
    // le forme partono dalla base del cranio, l'osso sta al centro:
    // sposta in giù SENZA cancellare l'offset interno della forma
    obj.position.y -= HEAD.skull;
    anchor.add(obj);
    rig.decos.push({ obj, bone: anchor });
  };

  // occhi: una mesh ciascuno, agganciata al suo osso (così seguono la testa
  // e la sua scala anche quando si cambia altezza e peso)
  const addEyeDecos = () => {
    const obj = EYES[cfg.eyes].build();
    if (!obj) return;
    const meshes = [];
    obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const sx = rig.bones.ossoOcchioSx;
    const dx = rig.bones.ossoOcchioDx;
    if (sx && dx && meshes.length === 2) {
      meshes.sort((a, b) => a.position.x - b.position.x);
      meshes[0].position.set(0, 0, 0);
      meshes[1].position.set(0, 0, 0);
      sx.add(meshes[0]);
      dx.add(meshes[1]);
      rig.decos.push({ obj: meshes[0], bone: sx }, { obj: meshes[1], bone: dx });
      return;
    }
    // ripiego: gruppo unico sull'osso della testa
    const anchor = rig.bones.ossoCapelli;
    if (anchor) {
      obj.position.y -= HEAD.skull;
      anchor.add(obj);
      rig.decos.push({ obj, bone: anchor });
    } else {
      addDeco(() => obj, rig.bones.spine2 || rig.bones.head, HEAD_OFFSET, DECO_SCALE);
    }
  };

  addHeadDeco(() => HAIRCUTS[cfg.hair].build());
  addEyeDecos();
  addHeadDeco(() => MOUTHS[cfg.mouth].build());
  addHeadDeco(() => BEARDS[cfg.beard].build());
  addHeadDeco(() => FUZZ[cfg.fuzz].build());

  // mani: agganciate direttamente alle ossa delle mani (così anche i guanti
  // seguono la scala del corpo)
  const handColor = HANDS[cfg.hands].color || SKINS[cfg.skin].color;
  for (const bone of [rig.bones.handL, rig.bones.handR]) {
    if (!bone) continue;
    const obj = handDecor(handColor)(); // handDecor restituisce un builder
    // le forme sono in scala mondo: la scala dello scheletro (0.21) le
    // schiaccerebbe, quindi le rimettiamo a misura (e seguono altezza/peso)
    const wrap = new THREE.Group();
    wrap.add(obj);
    wrap.scale.setScalar(1 / rig.baseScale);
    bone.add(wrap);
    rig.decos.push({ obj: wrap, bone });
  }

  // vestiti e pelle
  if (rig.setColors) {
    rig.setColors({
      skin: SKINS[cfg.skin].color,
      shirt: SHIRTS[cfg.shirt].color,
      pants: PANTS[cfg.pants].color,
      shoes: SHOES[cfg.shoes].color
    });
  }
}

// altezza e peso: scala il modello (larghezza e altezza indipendenti)
export function applyBody (rig, cfg) {
  const h = cfg.heightCm / 175;
  const w = 0.72 + ((cfg.weightKg - 40) / 80) * 0.73; // 40kg -> 0.72, 120kg -> 1.45
  rig.model.scale.set(rig.baseScale * w, rig.baseScale * h, rig.baseScale * w);
}

// animazione: usa le clip Mixamo caricate con il modello ("corri lento",
// "corri veloce", "fermo", "salto", "siediti", "seduto", "alzati", "rialzati"
// — quelle facoltative solo se presenti in 3d/).
// Da fermo: l'animazione Idle se c'è, altrimenti un piccolo trottare sul
// posto, che in un gioco per bambini sta benissimo.
// Sedersi e alzarsi sono clip "una volta sola" guidate da rig.sitPhase
// ('down' → 'sat' → 'up' → null); il salto è guidato da rig.airborne.
// Il ragdoll è guidato da rig.ragdollPhase ('fly' → 'lie' → 'getup' → null):
// durante il volo la posa resta congelata (corpo rigido, lo muove npc.js),
// a terra il corpo si stende con il primo fotogramma di "rialzati", che dopo
// 3 secondi viene riprodotto per intero fino a rialzarsi in piedi.
export function animateRig (rig, dt, moving, running) {
  if (!rig.mixer) return;

  const acts = rig.actions;
  if (!acts) return;

  // fa partire una clip con dissolvenza, sostituendo quella in corso
  const switchTo = (act, ts, fade = 0.18, once = false) => {
    if (!act || rig.currentAction === act) return;
    act.reset();
    if (once) {
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
    }
    act.timeScale = ts;
    act.fadeIn(fade).play();
    if (rig.currentAction) rig.currentAction.fadeOut(fade);
    rig.currentAction = act;
  };

  // ---------- ragdoll ----------
  if (rig.ragdollPhase === 'fly') return; // posa congelata: in aria fa la capriola
  rig.mixer.update(dt);
  if (rig.ragdollPhase === 'lie' || rig.ragdollPhase === 'getup') {
    const act = acts.getUp;
    if (!act) { // senza la clip "rialzati" ci si rialza per magia
      rig.ragdollPhase = null;
      return;
    }
    if (rig.ragdollPhase === 'lie') {
      // resta congelato sul primo fotogramma (sdraiato a terra)
      if (rig.currentAction !== act) {
        act.reset();
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
        act.timeScale = 1;
        act.time = 0;
        act.paused = true;
        act.fadeIn(0.12).play();
        if (rig.currentAction) rig.currentAction.fadeOut(0.12);
        rig.currentAction = act;
      }
    } else if (rig.currentAction !== act) {
      switchTo(act, 1, 0.1, true);
    } else if (act.paused) {
      if (act.time > 0.05) rig.ragdollPhase = null; // rialzato del tutto
      else act.paused = false; // si riparte dal primo fotogramma
    }
    return;
  }

  // ---------- sedersi / alzarsi (macchina a stati) ----------
  if (rig.sitPhase === 'down' || rig.sitPhase === 'up') {
    const act = rig.sitPhase === 'down' ? acts.sitDown : acts.standUp;
    if (act) {
      switchTo(act, 1, 0.08, true);
      // le clip "una volta sola" si mettono in pausa quando finite
      if (rig.currentAction === act && act.paused) {
        if (rig.sitPhase === 'down') {
          rig.sitPhase = 'sat'; // ora restiamo seduti finché non si preme E
        } else {
          rig.sitPhase = null;
          if (rig.onSitEnd) rig.onSitEnd();
        }
      }
    } else {
      // senza le clip di seduta: ci si siede "per magia" e si resta in Idle
      rig.sitPhase = rig.sitPhase === 'down' ? 'sat' : null;
      if (rig.sitPhase === null && rig.onSitEnd) rig.onSitEnd();
    }
    if (rig.sitPhase === 'sat') switchTo(acts.sitIdle || acts.idle || acts.slow, 1);
    if (rig.sitPhase === null) switchTo(acts.idle || acts.slow, 1);
    return;
  }
  if (rig.sitPhase === 'sat') {
    switchTo(acts.sitIdle || acts.idle || acts.slow, 1);
    return;
  }

  // ---------- in volo: la clip del salto, una volta sola ----------
  if (rig.airborne && acts.jump) {
    switchTo(acts.jump, 1, 0.06, true);
    return;
  }

  const target = !moving
    ? (acts.idle || acts.slow)
    : (moving && running && acts.fast ? acts.fast : acts.slow);
  const ts = !moving
    ? (acts.idle ? 1 : 0.2)
    : (target === acts.fast ? 1 : 0.8);

  if (rig.currentAction !== target) {
    switchTo(target, ts);
  } else {
    target.timeScale += (ts - target.timeScale) * Math.min(1, dt * 8);
  }
}
