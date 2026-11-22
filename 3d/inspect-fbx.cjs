// Misure del modello: testa, anche, braccia — per calibrare le decorazioni
const fs = require('fs');
const path = require('path');

global.self = global;
global.window = global;

const THREE = require('../node_modules/three/build/three.module.js');
(async () => {
  const { FBXLoader } = await import('../node_modules/three/examples/jsm/loaders/FBXLoader.js');

  const file = process.argv[2];
  const buf = fs.readFileSync(file);
  const ab = new Uint8Array(buf.byteLength);
  ab.set(buf);
  const obj = new FBXLoader().parse(ab.buffer, path.dirname(file) + path.sep);

  obj.updateWorldMatrix(true, true);

  let mesh = null;
  obj.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const pos = mesh.geometry.attributes.position;
  const si = mesh.geometry.attributes.skinIndex;
  const sw = mesh.geometry.attributes.skinWeight;
  const bones = mesh.skeleton.bones;

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const norm = 1.8 / size.y;
  console.log('altezza raw:', size.y.toFixed(3), '-> scala per 1.8m:', norm.toFixed(4));

  // raggruppa i vertici per osso dominante (in coordinate mondo, scala 1.8)
  const v = new THREE.Vector3();
  const groups = new Map();
  for (let i = 0; i < pos.count; i++) {
    const w0 = sw.getX(i), w1 = sw.getY(i), w2 = sw.getZ(i), w3 = sw.getW(i);
    const i0 = si.getX(i), i1 = si.getY(i), i2 = si.getZ(i), i3 = si.getW(i);
    const ws = [[w0, i0], [w1, i1], [w2, i2], [w3, i3]].sort((a, b) => b[0] - a[0]);
    const boneName = bones[ws[0][1]] ? bones[ws[0][1]].name.replace('mixamorig', '') : '?';
    v.fromBufferAttribute(pos, i);
    mesh.boneTransform ? null : null;
    v.applyMatrix4(mesh.bindMatrix); // verso lo spazio mondo della bind pose
    if (!groups.has(boneName)) groups.set(boneName, { min: v.clone(), max: v.clone(), n: 0 });
    const gg = groups.get(boneName);
    gg.min.min(v); gg.max.max(v); gg.n++;
  }
  for (const [name, gg] of groups) {
    const c = new THREE.Vector3().addVectors(gg.min, gg.max).multiplyScalar(0.5);
    console.log(
      name.padEnd(14),
      'n=' + String(gg.n).padStart(5),
      'y[' + (gg.min.y * norm).toFixed(3) + ' .. ' + (gg.max.y * norm).toFixed(3) + ']',
      'x[' + (gg.min.x * norm).toFixed(3) + ' .. ' + (gg.max.x * norm).toFixed(3) + ']',
      'z[' + (gg.min.z * norm).toFixed(3) + ' .. ' + (gg.max.z * norm).toFixed(3) + ']',
      'centro=(' + (c.x * norm).toFixed(3) + ',' + (c.y * norm).toFixed(3) + ',' + (c.z * norm).toFixed(3) + ')'
    );
  }

  // posizioni mondo delle ossa principali (scala 1.8)
  const wanted = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'LeftArm', 'RightArm'];
  for (const b of bones) {
    const base = b.name.replace('mixamorig', '');
    if (wanted.includes(base)) {
      const p = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
      console.log('OSA', base.padEnd(14), '(' + (p.x * norm).toFixed(3) + ', ' + (p.y * norm).toFixed(3) + ', ' + (p.z * norm).toFixed(3) + ')');
    }
  }
})().catch(e => { console.error('ERRORE:', e); process.exit(1); });
