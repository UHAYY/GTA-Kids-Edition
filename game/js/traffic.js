// Auto del traffico: usano i modelli del pacchetto GLB e girano per la città
// lungo anelli rettangolari di strade. Sono educatissime: rallentano e si
// fermano se qualcuno è davanti!

export function createTraffic (scene, roadCenters, carPrefabs, playerPrefab, count = 10) {
  const cars = [];
  const n = roadCenters.length;
  const others = carPrefabs.filter(p => p !== playerPrefab);
  if (!others.length) others.push(playerPrefab);

  for (let i = 0; i < count; i++) {
    const prefab = others[i % others.length];
    const car = prefab.clone();
    scene.add(car);

    // due linee verticali e due orizzontali diverse -> anello
    const i0 = Math.floor(Math.random() * n);
    const i1 = (i0 + 2 + Math.floor(Math.random() * (n - 3))) % n;
    const j0 = Math.floor(Math.random() * n);
    const j1 = (j0 + 2 + Math.floor(Math.random() * (n - 3))) % n;
    const ring = [
      [roadCenters[i0], roadCenters[j0]],
      [roadCenters[i1], roadCenters[j0]],
      [roadCenters[i1], roadCenters[j1]],
      [roadCenters[i0], roadCenters[j1]]
    ];

    cars.push({
      car, ring,
      seg: 0,
      t: Math.random(),
      cruise: 6 + Math.random() * 3,
      speed: 0,
      still: 0 // quanto tempo è ferma: per sciogliere gli ingorghi
    });
  }
  return cars;
}

function segmentOf (c) {
  const a = c.ring[c.seg];
  const b = c.ring[(c.seg + 1) % 4];
  return { ax: a[0], az: a[1], bx: b[0], bz: b[1] };
}

function headingOf (s) {
  if (s.bz !== s.az) return s.bz > s.az ? 0 : Math.PI;
  return s.bx > s.ax ? Math.PI / 2 : -Math.PI / 2;
}

export function updateTraffic (cars, dt, playerPos) {
  for (const c of cars) {
    const s = segmentOf(c);
    const len = Math.abs(s.bx - s.ax) + Math.abs(s.bz - s.az);

    // si ferma se il giocatore o un'altra auto è davanti
    const h = headingOf(s);
    const dx = playerPos.x - c.car.position.x;
    const dz = playerPos.z - c.car.position.z;
    const ahead = dx * Math.sin(h) + dz * Math.cos(h);
    const dist = Math.hypot(dx, dz);
    let blocked = dist < 9 && ahead > 0;
    if (!blocked) {
      for (const o of cars) {
        if (o === c) continue;
        const ox = o.car.position.x - c.car.position.x;
        const oz = o.car.position.z - c.car.position.z;
        const oahead = ox * Math.sin(h) + oz * Math.cos(h);
        if (oahead > 0 && oahead < 6 && Math.hypot(ox, oz) < 6) { blocked = true; break; }
      }
    }
    // anti-ingorgo: se è ferma troppo a lungo, avanza piano comunque
    c.still = blocked && c.speed < 0.3 ? c.still + dt : 0;
    const target = (blocked && c.still < 2.5) ? 0 : c.cruise * (blocked ? 0.35 : 1);
    c.speed += (target - c.speed) * Math.min(1, dt * 2.5);

    c.t += (c.speed * dt) / Math.max(len, 1);
    while (c.t >= 1) { c.t -= 1; c.seg = (c.seg + 1) % 4; }

    const s2 = segmentOf(c);
    const x = s2.ax + (s2.bx - s2.ax) * c.t;
    const z = s2.az + (s2.bz - s2.az) * c.t;
    c.car.position.set(x, 0, z);
    c.car.rotation.y = headingOf(s2);
  }
}
