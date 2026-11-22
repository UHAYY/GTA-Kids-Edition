// Fumo nero dal cofano delle auto rovinate: un pool di sprite che salgono,
// si allargano e svaniscono. In main.js si "accende" quando il danno
// dell'auto supera la soglia (più danno = più fumo).
import * as THREE from 'three';

// texture dello sbuffo: cerchio sfumato scuro disegnato al volo
function makePuffTexture () {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(30,30,30,0.9)');
  grad.addColorStop(0.7, 'rgba(20,20,20,0.45)');
  grad.addColorStop(1, 'rgba(15,15,15,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSmoke (scene, n = 40) {
  const tex = makePuffTexture();
  const pool = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false
    }));
    m.visible = false;
    scene.add(m);
    pool.push({ m, age: 0, life: 1, size: 0.4, vx: 0, vy: 0, vz: 0 });
  }
  let next = 0;

  // emette uno sbuffo da (x, y, z)
  function spawn (x, y, z) {
    const p = pool[next++ % pool.length];
    p.age = 0;
    p.life = 0.9 + Math.random() * 0.6;
    p.size = 0.35 + Math.random() * 0.3;
    p.vx = (Math.random() - 0.5) * 0.7;
    p.vy = 1.4 + Math.random() * 0.9;
    p.vz = (Math.random() - 0.5) * 0.7;
    p.m.position.set(x, y, z);
    p.m.visible = true;
  }

  function update (dt) {
    for (const p of pool) {
      if (!p.m.visible) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { p.m.visible = false; continue; }
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      p.m.scale.setScalar(p.size + k * 1.7);   // si allarga salendo
      p.m.material.opacity = 0.8 * (1 - k);    // e svanisce
    }
  }

  return { spawn, update };
}
