// -------------------------------------------------------------
// Caricamento degli asset 3D:
// - personaggio rigged (FBX) con scheletro e animazione
// - pacchetto auto (GLB): le auto non hanno nomi, quindi le
//   separiamo raggruppando le mesh vicine tra loro (clustering)
// -------------------------------------------------------------
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { HEAD, DECO_SCALE } from './avatar.js';

const TARGET_HEIGHT = 1.8; // altezza del personaggio in metri
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpO = new THREE.Vector3();

// Trova le ossa principali dello scheletro (i nomi possono avere prefissi tipo "modello:")
function findBones (root) {
  const map = {};
  root.traverse((o) => {
    if (!o.isBone) return;
    const base = o.name.split(':').pop().toLowerCase().replace(/^mixamorig/, '');
    if (base === 'head') map.head = o;
    else if (base === 'neck') map.neck = o;
    else if (base === 'spine' ) map.spine = o;
    else if (base === 'spine_02' || base === 'spine2') map.spine2 = o; // Mixamo: "Spine2"
    else if (base === 'upperarm_l') map.armL = o;
    else if (base === 'leftarm') map.armL = o; // nomi Mixamo senza underscore
    else if (base === 'upperarm_r') map.armR = o;
    else if (base === 'rightarm') map.armR = o;
    else if (base === 'lowerarm_l') map.forearmL = o;
    else if (base === 'leftforearm') map.forearmL = o;
    else if (base === 'lowerarm_r') map.forearmR = o;
    else if (base === 'rightforearm') map.forearmR = o;
    else if (base === 'hand_l') map.handL = o;
    else if (base === 'lefthand') map.handL = o;
    else if (base === 'hand_r') map.handR = o;
    else if (base === 'righthand') map.handR = o;
    else if (base === 'upperleg_l') map.legL = o;
    else if (base === 'leftupleg') map.legL = o;
    else if (base === 'upperleg_r') map.legR = o;
    else if (base === 'rightupleg') map.legR = o;
    else if (base === 'lowerleg_l') map.shinL = o;
    else if (base === 'leftleg') map.shinL = o;
    else if (base === 'lowerleg_r') map.shinR = o;
    else if (base === 'rightleg') map.shinR = o;
    else if (base === 'foot_l') map.footL = o;
    else if (base === 'leftfoot') map.footL = o;
    else if (base === 'foot_r') map.footR = o;
    else if (base === 'rightfoot') map.footR = o;
    else if (base === 'shoulder_l') map.shoulderL = o;
    else if (base === 'leftshoulder') map.shoulderL = o;
    else if (base === 'shoulder_r') map.shoulderR = o;
    else if (base === 'rightshoulder') map.shoulderR = o;
  });
  return map;
}

export async function loadAssets (onProgress) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, loaded, total) => onProgress(Math.round((loaded / total) * 100));

  const loadFBX = (url) => new Promise((res, rej) => new FBXLoader(manager).load(url, res, undefined, rej));
  const loadGLB = (url) => new Promise((res, rej) => new GLTFLoader(manager).load(url, res, undefined, rej));

  // ---------------- personaggio (stickman Mixamo) ----------------
  const eric = await loadFBX('/3d/stickman/source/body_v2.fbx');

  // animazioni: Mixamo esporta ogni clip con dentro anche la mesh e
  // l'avanzamento dei fianchi (root motion): teniamo solo i movimenti
  // "sul posto" (aazzero x e z dei fianchi, teniamo il rimbalzo).
  const clipFiles = [
    ['/3d/Slow Run.fbx', 'corri lento'],
    ['/3d/Fast Run.fbx', 'corri veloce']
  ];
  const clips = [];
  const HIPS_REST = [0.009, 0.073, 0.003];
  // Mixamo esporta i fianchi con l'avanzamento in avanti (root motion) e
  // con un'origine che non combacia con quella del modello: teniamo solo
  // un rimbalzino verticale, il resto resta alla posa di riposo.
  const rewriteHips = (clip) => {
    for (const tr of clip.tracks) {
      if (tr.name === 'mixamorigHips.position') {
        const y0 = tr.values[1];
        for (let i = 0; i < tr.values.length; i += 3) {
          tr.values[i] = HIPS_REST[0];
          tr.values[i + 1] = HIPS_REST[1] + (tr.values[i + 1] - y0) * 0.4;
          tr.values[i + 2] = HIPS_REST[2];
        }
      }
    }
  };
  // variante per le clip in cui l'altezza dei fianchi fa parte dell'azione
  // (sedersi scende, il salto salta): azzeriamo l'avanzamento x/z e
  // riportiamo l'altezza y dallo spazio "unità nodo" di Mixamo (origine ai
  // piedi: in piedi ≈ 4.24) allo spazio del modello (origine ai fianchi:
  // in piedi ≈ 0.07). K si calibra da solo sulla clip "siediti", che inizia
  // in piedi: il suo primo valore vale esattamente HIPS_REST[1].
  let hipsK = 4.171; // a margine, se non c'è "siediti" da cui calibrare
  const rewriteHipsXZ = (clip, nome) => {
    for (const tr of clip.tracks) {
      if (tr.name !== 'mixamorigHips.position') continue;
      if (nome === 'siediti') {
        const k = tr.values[1] - HIPS_REST[1];
        if (k > 1) hipsK = k; // il primo fotogramma è in piedi
      }
      for (let i = 0; i < tr.values.length; i += 3) {
        tr.values[i] = HIPS_REST[0];
        tr.values[i + 1] = tr.values[i + 1] - hipsK;
        tr.values[i + 2] = HIPS_REST[2];
      }
    }
  };
  const addClip = (fbx, nome, hipsXZ) => {
    const clip = fbx.animations[0];
    if (!clip) return;
    clip.name = nome;
    if (hipsXZ) rewriteHipsXZ(clip, nome); else rewriteHips(clip);
    clips.push(clip);
  };
  for (const [url, nome] of clipFiles) {
    const anim = await loadFBX(url);
    addClip(anim, nome);
  }
  // clip facoltative: appena le esporti da Mixamo nella cartella 3d/ il
  // gioco le usa. "siediti" la carichiamo per prima perché la calibrazione
  // K la ricava dal suo primo fotogramma (in piedi).
  const optionalClips = [
    ['/3d/Stand To Sit.fbx', 'siediti', true],
    ['/3d/Sitting Idle.fbx', 'seduto', true],
    ['/3d/Sit To Stand.fbx', 'alzati', true],
    ['/3d/Getting Up.fbx', 'rialzati', true],
    ['/3d/Idle.fbx', 'fermo', false],
    ['/3d/Jumping.fbx', 'salto', true]
  ];
  for (const [url, nome, hipsXZ] of optionalClips) {
    try {
      const fbx = await loadFBX(url);
      const prima = clips.length;
      addClip(fbx, nome, hipsXZ);
      if (clips.length > prima) console.log('[asset] clip "' + nome + '" caricata da ' + url);
    } catch {
      console.log('[asset] ' + url + ' non trovata: si gioca comunque senza');
    }
  }

  // normalizza l'altezza a TARGET_HEIGHT e appoggia i piedi a terra
  const box = new THREE.Box3().setFromObject(eric);
  const rawHeight = Math.max(0.01, box.max.y - box.min.y);
  const normScale = TARGET_HEIGHT / rawHeight;
  eric.scale.setScalar(normScale);
  eric.position.y = -box.min.y * normScale;

  eric.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false; // con lo skinning il bbox resta quello in T-pose
      o.castShadow = true;
    }
  });

  console.log('[asset] animazioni:', clips.map(a => `"${a.name}" ${a.duration.toFixed(2)}s, ${a.tracks.length} tracce`).join('; ') || 'nessuna');

  function createEric () {
    const model = SkeletonUtils.clone(eric);
    const group = new THREE.Group();
    group.add(model);
    const bones = findBones(model);
    const mixer = clips.length ? new THREE.AnimationMixer(model) : null;
    const rig = { group, model, bones, mixer, baseScale: normScale, decos: [], phase: Math.random() * 10, decosVisible: true };

    // ---------- pittura del corpo (pelle, maglia, pantaloni, scarpe) ----------
    // il modello è una mesh unica senza texture: coloriamo i vertici in base
    // all'osso a cui sono agganciati (e per il torso, all'altezza: sopra il
    // collo c'è la testa).
    let mesh = null;
    model.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    // il clono condivide la geometria: ogni personaggio ha i suoi colori
    mesh.geometry = mesh.geometry.clone();
    mesh.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const pos = mesh.geometry.attributes.position;
    const count = pos.count;
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const si = mesh.geometry.attributes.skinIndex;
    const sw = mesh.geometry.attributes.skinWeight;
    const bonesAll = mesh.skeleton.bones;
    const headY = 0.592; // soglia in coordinate normalizzate (v.y * normScale)

    // 0 = pelle, 1 = maglia, 2 = pantaloni, 3 = scarpe
    const regions = new Uint8Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const w = [[sw.getX(i), si.getX(i)], [sw.getY(i), si.getY(i)], [sw.getZ(i), si.getZ(i)], [sw.getW(i), si.getW(i)]]
        .sort((a, b) => b[0] - a[0]);
      const bn = bonesAll[w[0][1]] ? bonesAll[w[0][1]].name.replace('mixamorig', '') : '';
      if (/^(LeftFoot|RightFoot|LeftToeBase|RightToeBase)$/.test(bn)) regions[i] = 3;
      else if (/^(LeftUpLeg|RightUpLeg|LeftLeg|RightLeg|Hips)$/.test(bn)) regions[i] = 2;
      else if (/^(LeftForeArm|RightForeArm|LeftHand|RightHand)$/.test(bn)) regions[i] = 0;
      else if (/^(LeftArm|RightArm|LeftShoulder|RightShoulder|Spine|Spine1)$/.test(bn)) regions[i] = 1;
      else { // Spine2: torace fino al collo, sopra la testa
        v.fromBufferAttribute(pos, i);
        regions[i] = (v.y * normScale > headY) ? 0 : 1;
      }
    }
    mesh.userData.regions = regions;
    const colorAttr = mesh.geometry.attributes.color;

    // centro del cranio in coordinate del rig, misurato sui vertici della
    // testa alla posa di riposo: serve ad avatar.js per agganciare le
    // decorazioni della testa all'osso Head in modo preciso
    const skull = new THREE.Vector3();
    let skullN = 0;
    for (let i = 0; i < count; i++) {
      if (regions[i] !== 0) continue;
      v.fromBufferAttribute(pos, i);
      if (v.y * normScale <= headY) continue;
      skull.x += v.x; skull.y += v.y; skull.z += v.z;
      skullN++;
    }
    skull.divideScalar(skullN || 1);
    mesh.updateWorldMatrix(true, false);
    rig.group.updateWorldMatrix(true, false);
    skull.applyMatrix4(new THREE.Matrix4()
      .copy(rig.group.matrixWorld).invert()
      .multiply(mesh.matrixWorld));
    rig.skullLocal = skull;

    // ossa di servizio per gli accessori della testa: sono figlie dell'osso
    // Head, così seguono il dondolio della testa E la scala del corpo
    // (altezza e peso scelte nel barbiere). Sono "ossa" senza vertici:
    // servono solo da punti di aggancio per capelli, occhi e bocca.
    const headBone = rig.bones.head;
    if (headBone) {
      headBone.updateWorldMatrix(true, false);
      const hp = new THREE.Vector3();
      const hq = new THREE.Quaternion();
      headBone.getWorldPosition(hp);
      headBone.getWorldQuaternion(hq);
      const skullWorld = skull.clone().applyMatrix4(rig.group.matrixWorld);
      // l'offset va in unità "raw" dello scheletro (la scala del modello è
      // a monte nella gerarchia): moltiplichiamo per quante unità raw ci
      // sono in un metro
      const rawPerMetro = 1 / rig.model.scale.x;
      const anchor = (nome, ox, oy, oz) => {
        const b = new THREE.Bone();
        b.name = nome;
        b.position.set(ox, oy, oz).sub(hp).multiplyScalar(rawPerMetro).applyQuaternion(hq.clone().invert());
        // i figli sono in "unità deco" (1/1.6): la scala dell'osa deve
        // portarli a metri mondo COMPENSANDO la scala dello scheletro
        b.scale.setScalar(DECO_SCALE * rawPerMetro);
        headBone.add(b);
        rig.bones[nome] = b;
      };
      anchor('ossoCapelli', skullWorld.x, skullWorld.y, skullWorld.z);
      const ex = HEAD.eyeX * DECO_SCALE;
      const ey = (HEAD.eyeY - HEAD.skull) * DECO_SCALE;
      const ez = HEAD.face * DECO_SCALE;
      anchor('ossoOcchioSx', skullWorld.x - ex, skullWorld.y + ey, skullWorld.z + ez);
      anchor('ossoOcchioDx', skullWorld.x + ex, skullWorld.y + ey, skullWorld.z + ez);
    }

    rig.setColors = (pal) => {
      const c = [new THREE.Color(pal.skin), new THREE.Color(pal.shirt), new THREE.Color(pal.pants), new THREE.Color(pal.shoes)];
      for (let i = 0; i < count; i++) {
        const col = c[regions[i]];
        colorAttr.setXYZ(i, col.r, col.g, col.b);
      }
      colorAttr.needsUpdate = true;
    };

    // ---------- animazioni ----------
    // posa di riposo dello scheletro: serve per ricalcolare gli agganci
    // delle decos (applyAvatar può essere richiamato a animazione in corso)
    rig.restPose = mesh.skeleton.bones.map(b => ({
      pos: b.position.clone(), quat: b.quaternion.clone(), scl: b.scale.clone()
    }));
    rig.setRestPose = () => {
      mesh.skeleton.bones.forEach((b, i) => {
        const r = rig.restPose[i];
        b.position.copy(r.pos); b.quaternion.copy(r.quat); b.scale.copy(r.scl);
      });
    };
    rig.actions = null;
    rig.currentAction = null;
    if (mixer) {
      const byName = (n) => {
        const c = clips.find(k => k.name === n);
        return c ? mixer.clipAction(c) : null;
      };
      rig.actions = {
        slow: byName('corri lento') || mixer.clipAction(clips[0]),
        fast: byName('corri veloce'),
        idle: byName('fermo'),
        jump: byName('salto'),
        sitDown: byName('siediti'),
        sitIdle: byName('seduto'),
        standUp: byName('alzati'),
        getUp: byName('rialzati') // dopo il ragdoll
      };
      const first = rig.actions.idle || rig.actions.slow;
      first.play();
      first.timeScale = rig.actions.idle ? 1 : 0.2; // senza Idle: trottare piano
      rig.currentAction = first;
      // stato per sedersi sulle panchine: null | 'down' | 'sat' | 'up'
      rig.sitPhase = null;
      rig.onSitEnd = null; // richiamato quando ci si è alzati del tutto
      rig.airborne = false; // vero mentre il salto è in volo
    }

    // visibilità delle decos e riposizionamento di quelle "di ripiego"
    // (agganciate alla scena). Quelle figlie delle ossa di servizio seguono
    // da sole la testa, il corpo e la loro scala.
    rig.updateDecos = () => {
      rig.group.updateWorldMatrix(true, true);
      rig.group.getWorldQuaternion(tmpQ);
      for (const d of rig.decos) {
        // le decos stanno nella scena, non nel gruppo: quando il corpo è
        // nascosto (in macchina) vanno nascoste anche loro
        d.obj.visible = rig.decosVisible;
        if (!d.offset) continue; // figlia di un osso di servizio: a posto così
        d.bone.getWorldPosition(tmpV);
        tmpV.add(tmpO.copy(d.offset).applyQuaternion(tmpQ));
        d.obj.position.copy(tmpV);
        d.obj.quaternion.copy(tmpQ);
        d.obj.scale.setScalar(d.scale || 1);
      }
    };
    return rig;
  }

  // ---------------- auto ----------------
  const gltf = await loadGLB('/3d/cars/source/Indian Car Simulator Traffic Car Pack.glb');
  const rootScene = gltf.scene;
  const sceneBox = new THREE.Box3().setFromObject(rootScene);
  const sceneSize = sceneBox.getSize(new THREE.Vector3());

  const wrapper = new THREE.Group();
  wrapper.add(rootScene);
  if (sceneSize.z < sceneSize.x && sceneSize.z < sceneSize.y) {
    rootScene.rotation.x = -Math.PI / 2; // modello Z-up -> Y-up
    console.log('[asset] auto: modello Z-up ruotato in Y-up');
  }
  rootScene.updateWorldMatrix(true, true);

  // clustering: le auto sono Mesh senza nomi sparsi nella scena
  const meshes = [];
  rootScene.traverse((o) => { if (o.isMesh) { o.castShadow = true; meshes.push(o); } });
  const boxes = meshes.map((m) => new THREE.Box3().setFromObject(m));

  const E = 0.4; // le parti della stessa auto si toccano, auto diverse sono distanti
  const parent = meshes.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const near = (a, b) =>
    a.min.x - E <= b.max.x && b.min.x - E <= a.max.x &&
    a.min.y - E <= b.max.y && b.min.y - E <= a.max.y &&
    a.min.z - E <= b.max.z && b.min.z - E <= a.max.z;
  for (let i = 0; i < meshes.length; i++) {
    for (let j = i + 1; j < meshes.length; j++) {
      if (near(boxes[i], boxes[j])) parent[find(i)] = find(j);
    }
  }

  const clusters = new Map();
  meshes.forEach((m, i) => {
    const r = find(i);
    if (!clusters.has(r)) { const g = new THREE.Group(); wrapper.add(g); clusters.set(r, g); }
    clusters.get(r).attach(m); // attach mantiene la trasformazione mondiale
  });

  const carPrefabs = [];
  for (const g of clusters.values()) {
    const bb = new THREE.Box3().setFromObject(g);
    const size = bb.getSize(new THREE.Vector3());
    const center = bb.getCenter(new THREE.Vector3());
    const inner = new THREE.Group();
    inner.add(g);
    g.position.set(-center.x, -bb.min.y, -center.z); // origine: centro-basso dell'auto
    if (size.x > size.z) inner.rotation.y = Math.PI / 2; // lato lungo verso il davanti
    const outer = new THREE.Group();
    outer.add(inner);
    outer.userData.size = [Math.max(size.x, size.z), size.y, Math.min(size.x, size.z)];
    carPrefabs.push(outer);
  }
  carPrefabs.sort((a, b) => a.userData.size[0] - b.userData.size[0]);
  console.log('[asset] auto trovate:', carPrefabs.length,
    carPrefabs.map(p => p.userData.size.map(s => s.toFixed(1)).join('x')).join(', '));

  return { createEric, carPrefabs };
}
