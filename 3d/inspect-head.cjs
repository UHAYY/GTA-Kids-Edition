// Misure testate: vertici sopra il collo + posa dell'osso Head
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

  for (const b of obj.skeleton ? [] : []) {}
  let mesh = null;
  obj.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const bones = mesh.skeleton.bones;
  const norm = 1.8 / 8.588;

  for (const b of bones) {
    if (/Head|Neck/.test(b.name)) {
      const p = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
      console.log('OSSO', b.name.replace('mixamorig', ''), '(' + (p.x * norm).toFixed(3) + ', ' + (p.y * norm).toFixed(3) + ', ' + (p.z * norm).toFixed(3) + ')');
    }
  }

  // vertici dominati da Head o HeadTop
  const pos = mesh.geometry.attributes.position;
  const si = mesh.geometry.attributes.skinIndex;
  const sw = mesh.geometry.attributes.skinWeight;
  const v = new THREE.Vector3();
  const min = new THREE.Vector3(1e9, 1e9, 1e9);
  const max = new THREE.Vector3(-1e9, -1e9, -1e9);
  let count = 0;
  for (let i = 0; i < pos.count; i++) {
    const ws = [[sw.getX(i), si.getX(i)], [sw.getY(i), si.getY(i)], [sw.getZ(i), si.getZ(i)], [sw.getW(i), si.getW(i)]].sort((a, b) => b[0] - a[0]);
    const bn = bones[ws[0][1]] ? bones[ws[0][1]].name : '';
    if (!/Head/.test(bn)) continue;
    count++;
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
    min.min(v); max.max(v);
  }
  console.log('vertici Head:', count);
  if (count) {
    console.log('testa (scala 1.8): y[' + (min.y * norm).toFixed(3) + ' .. ' + (max.y * norm).toFixed(3) + '] x[' + (min.x * norm).toFixed(3) + ' .. ' + (max.x * norm).toFixed(3) + '] z[' + (min.z * norm).toFixed(3) + ' .. ' + (max.z * norm).toFixed(3) + ']');
    console.log('raggio orizzontale medio: ' + (((max.x - min.x) / 2) * norm).toFixed(3));
  }
})().catch(e => { console.error('ERRORE:', e.message); process.exit(1); });
