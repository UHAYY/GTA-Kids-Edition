// Auto del traffico: usano i modelli del pacchetto GLB e girano per la città
// lungo anelli rettangolari di strade. Sono educatissime: rallentano e si
// fermano se qualcuno è davanti! Ognuno guida nella sua corsia (sfalsati a
// destra), così i sensi opposti si incrociano senza compenetrarsi.

export function createTraffic (scene, roadCenters, carPrefabs, playerPrefab, count = 10, avoid = []) {
  const cars = [];
  const n = roadCenters.length;
  const others = carPrefabs.filter(p => p !== playerPrefab);
  if (!others.length) others.push(playerPrefab);

  for (let i = 0; i < count; i++) {
    const prefab = others[Math.floor(Math.random() * others.length)];
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

    // punto di partenza: tra 30 tentativi a caso sul ring scegliamo il più
    // lontano dal giocatore e dalle auto già piazzate (niente auto incollate)
    const taken = cars.map(c => c.car.position);
    let bestSeg = 0, bestT = Math.random(), bestD = -1;
    for (let tries = 0; tries < 30; tries++) {
      const seg = Math.floor(Math.random() * 4);
      const tt = Math.random();
      const a = ring[seg], b = ring[(seg + 1) % 4];
      const x = a[0] + (b[0] - a[0]) * tt;
      const z = a[1] + (b[1] - a[1]) * tt;
      let d = Infinity;
      for (const av of avoid) d = Math.min(d, Math.hypot(x - av.x, z - av.z));
      for (const o of taken) d = Math.min(d, Math.hypot(x - o.x, z - o.z));
      if (d > bestD) { bestD = d; bestSeg = seg; bestT = tt; }
    }

    cars.push({
      car, ring,
      seg: bestSeg,
      t: bestT,
      rc: roadCenters, // tutte le strade: per trovare i semafori avanti
      cruise: 6 + Math.random() * 3,
      speed: 0,
      still: 0, // quanto tempo è ferma: per sciogliere gli ingorghi
      rev: 0    // secondi di retromarcia (per uscire dagli ingorghi veri)
    });

    // pialla subito al punto scelto, in corsia (updateTraffic la muoverà poi)
    const s = { ax: ring[bestSeg][0], az: ring[bestSeg][1],
      bx: ring[(bestSeg + 1) % 4][0], bz: ring[(bestSeg + 1) % 4][1] };
    const h = s.bz !== s.az ? (s.bz > s.az ? 0 : Math.PI) : (s.bx > s.ax ? Math.PI / 2 : -Math.PI / 2);
    const x = s.ax + (s.bx - s.ax) * bestT;
    const z = s.az + (s.bz - s.az) * bestT;
    car.position.set(x + Math.cos(h) * LANE, 0, z - Math.sin(h) * LANE);
    car.rotation.y = h;
  }
  return cars;
}

// sfalsamento a destra rispetto alla linea centrale della strada (in metri):
// la strada è larga 12, così le due corsie restano ben divise
const LANE = 1.7;

function segmentOf (c) {
  const a = c.ring[c.seg];
  const b = c.ring[(c.seg + 1) % 4];
  return { ax: a[0], az: a[1], bx: b[0], bz: b[1] };
}

function headingOf (s) {
  if (s.bz !== s.az) return s.bz > s.az ? 0 : Math.PI;
  return s.bx > s.ax ? Math.PI / 2 : -Math.PI / 2;
}

// strada larga 12: metà strada (dove inizia l'incrocio)
const ROAD_HALF = 6;

export function updateTraffic (cars, dt, playerPos, lights, lightPhase) {
  for (const c of cars) {
    const s = segmentOf(c);
    const len = Math.abs(s.bx - s.ax) + Math.abs(s.bz - s.az);
    const h = headingOf(s);
    const sh = Math.sin(h), ch = Math.cos(h);
    const lx = c.car.position.x, lz = c.car.position.z;

    // ostacolo davanti = qualcuno (giocatore o altra auto) poco avanti e
    // sulla stessa corsia: chi viene dalla direzione opposta è nella sua
    // corsia e non ci blocca
    let blocked = false, gap = Infinity;
    const consider = (ox, oz) => {
      const oa = ox * sh + oz * ch;         // quanto è avanti a noi
      const ol = Math.abs(ox * ch - oz * sh); // quanto è di lato
      if (oa > 0 && oa < 9 && ol < 2.6) { blocked = true; gap = Math.min(gap, oa); }
    };
    consider(playerPos.x - lx, playerPos.z - lz);
    for (const o of cars) {
      if (o === c) continue;
      consider(o.car.position.x - lx, o.car.position.z - lz);
    }

    // semafori: se al prossimo incrocio con le luci non è verde, fermati
    // sulla linea di stop (7,5 m prima del centro). Se sei a meno di 0,5 m
    // dalla linea (o l'hai già passata) sei impegnato: attraversa e via.
    let lightStop = false;
    if (lights && lightPhase && lightPhase() !== 0) {
      const vertical = Math.abs(s.bz - s.az) > 0.1;
      const dir = vertical ? (s.bz > s.az ? 1 : -1) : (s.bx > s.ax ? 1 : -1);
      const axis = vertical ? lz : lx;
      const road = vertical ? s.ax : s.az; // la strada che stai percorrendo
      let dLight = Infinity;
      for (const rc of c.rc) {
        const d = (rc - axis) * dir; // quanto è avanti l'incrocio
        // solo il primo incrocio avanti (a metà segmento ce ne sono tanti)
        if (d < ROAD_HALF || d > 52) continue;
        if (lights.has(road + '|' + rc)) dLight = Math.min(dLight, d);
      }
      if (dLight !== Infinity) {
        // linea di stop a 11 m dal centro: le strisce pedonali sono a 7,1 m,
        // così l'auto si ferma PRIMA delle strisce e i pedoni attraversano
        // comodi (il muso dell'auto sporge 2,4 m oltre il centro)
        const stopLine = dLight - 11;
        if (stopLine < 10.5 && stopLine > 0.5) {
          blocked = true;
          lightStop = true;
          gap = Math.min(gap, stopLine); // la linea di stop è l'ostacolo
        }
      }
    }

    // anti-ingorgo: dopo 2,5 s ferma avanza piano ma SOLO se c'è spazio
    // (gap > 4,6 m): così non si compenetra mai nell'auto davanti. Se invece
    // è davvero incastrata (ingorgo a incrocio), indietreggia un attimo.
    // Al semaforo rosso invece resta ferma educatamente: niente retromarcia.
    c.still = blocked && c.speed < 0.3 ? c.still + dt : 0;
    c.rev = Math.max(0, (c.rev || 0) - dt);
    if (!lightStop && blocked && c.still > 6 && gap < 4.6) c.rev = 1.4;
    let target = c.cruise;
    if (blocked) target = (c.still > 2.5 && gap > 4.6) ? c.cruise * 0.35 : 0;
    if (c.rev > 0) target = -1.5;
    c.speed += (target - c.speed) * Math.min(1, dt * 2.5);

    c.t += (c.speed * dt) / Math.max(len, 1);
    while (c.t >= 1) { c.t -= 1; c.seg = (c.seg + 1) % 4; }

    const s2 = segmentOf(c);
    const x = s2.ax + (s2.bx - s2.ax) * c.t;
    const z = s2.az + (s2.bz - s2.az) * c.t;
    const h2 = headingOf(s2);
    // guida a destra: sfalsa l'auto di 1,7 m dalla linea centrale
    const tx = x + Math.cos(h2) * LANE;
    const tz = z - Math.sin(h2) * LANE;
    // morbidezza agli angoli: posizione e direzione inseguono il bersaglio
    // invece di saltare quando l'anello gira
    if (c.lx === undefined) { c.lx = tx; c.lz = tz; c.h = h2; }
    const k = Math.min(1, dt * 6);
    c.lx += (tx - c.lx) * k;
    c.lz += (tz - c.lz) * k;
    let dh = h2 - c.h;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.h += dh * k;
    c.car.position.set(c.lx, 0, c.lz);
    c.car.rotation.y = c.h;
  }
}
