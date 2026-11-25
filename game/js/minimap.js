// Minimappa: mostra la porzione di città attorno al giocatore con i
// marker utili (auto, barbiere, concessionaria, monete, obiettivo missione).
// Lo sfondo è una mappa statica disegnata una volta in city.js (city.map).
export function createMinimap (canvasEl, map) {
  const ctx = canvasEl.getContext('2d');
  const VIEW = canvasEl.width;   // lato del canvas in pixel
  const SCALE = 1.3;             // pixel della minimappa per metro
  const R = VIEW / 2;            // raggio in pixel
  const vis = VIEW / SCALE;      // metri visibili per lato

  // posizione sulla minimappa di un punto del mondo (giocatore al centro)
  const sx = (wx, px) => (wx - px) * SCALE + R;
  const sy = (wz, pz) => (wz - pz) * SCALE + R;

  function update (state) {
    const { player, missions, barber, dealer, traffic, coins, heists, pads, bikes, nav } = state;
    const driving = player.mode === 'drive';
    const p = driving ? player.carPos : player.pos;
    const heading = driving ? player.heading : player.yaw;

    // sfondo: ritaglio della mappa statica centrato sul giocatore
    const srcHalf = R / map.S / SCALE; // metà lato visibile, in pixel di mappa
    const cx = (p.x + map.off) * map.S;
    const cy = (p.z + map.off) * map.S;
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(map.canvas,
      cx - srcHalf, cy - srcHalf, srcHalf * 2, srcHalf * 2,
      0, 0, VIEW, VIEW);

    // auto del traffico (pallini gialli)
    ctx.fillStyle = '#ffd54f';
    for (const c of traffic) {
      ctx.beginPath();
      ctx.arc(sx(c.car.position.x, p.x), sy(c.car.position.z, p.z), 2.5, 0, 7);
      ctx.fill();
    }

    // monete (puntini dorati piccoli)
    ctx.fillStyle = '#fff3b0';
    for (const c of coins) {
      if (c.taken) continue;
      ctx.beginPath();
      ctx.arc(sx(c.mesh.position.x, p.x), sy(c.mesh.position.z, p.z), 1.8, 0, 7);
      ctx.fill();
    }

    // la tua auto parcheggiata (pallino blu)
    const carPos = player.car.position;
    ctx.fillStyle = '#2979ff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx(carPos.x, p.x), sy(carPos.z, p.z), 4, 0, 7);
    ctx.fill();
    ctx.stroke();

    // bici da prendere (🚲, solo se abbastanza vicini)
    if (bikes) {
      for (const b of bikes) {
        if (Math.abs(b.position.x - p.x) < vis && Math.abs(b.position.z - p.z) < vis) {
          ctx.fillText('🚲', sx(b.position.x, p.x), sy(b.position.z, p.z));
        }
      }
    }

    // barbiere e concessionaria (emoji, solo se abbastanza vicini)
    ctx.font = '13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (Math.abs(barber.barberPos.x - p.x) < vis && Math.abs(barber.barberPos.z - p.z) < vis) {
      ctx.fillText('💈', sx(barber.barberPos.x, p.x), sy(barber.barberPos.z, p.z));
    }
    if (Math.abs(dealer.dealerPos.x - p.x) < vis && Math.abs(dealer.dealerPos.z - p.z) < vis) {
      ctx.fillText('🚗', sx(dealer.dealerPos.x, p.x), sy(dealer.dealerPos.z, p.z));
    }

    // negozi da rapinare e parcheggi nascondiglio
    if (heists) {
      for (const s of heists) {
        if (Math.abs(s.x - p.x) < vis && Math.abs(s.z - p.z) < vis) {
          ctx.fillText(s.icon, sx(s.x, p.x), sy(s.z, p.z));
        }
      }
    }
    if (pads) {
      for (const pad of pads) {
        const px2 = sx(pad.x, p.x);
        const py2 = sy(pad.z, p.z);
        ctx.fillStyle = '#2f6fb3';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(px2 - 6, py2 - 6, 12, 12, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('P', px2, py2 + 1);
        ctx.font = '13px serif';
      }
    }

    // navigatore: la bandierina della destinazione scelta sulla mappa.
    // Vicina si vede dov'è; lontana si aggancia al bordo della minimappa
    if (nav && nav.on) {
      const dx = nav.x - p.x;
      const dz = nav.z - p.z;
      const dist = Math.hypot(dx, dz);
      let mx = sx(nav.x, p.x);
      let my = sy(nav.z, p.z);
      if (dist > (R - 13) / SCALE) {
        mx = R + (dx / dist) * (R - 13);
        my = R + (dz / dist) * (R - 13);
      }
      ctx.font = 'bold 15px serif';
      ctx.fillText('📍', mx, my + 1);
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      const label = dist > 1000 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist / 10) * 10 + 'm';
      ctx.strokeText(label, mx, my - 8);
      ctx.fillText(label, mx, my - 8);
      ctx.font = '13px serif';
    }

    // obiettivo della missione: stella, ancorata al bordo se è lontana
    const target = missions.phase === 'pickup' ? missions.pickupPos : missions.targetPos;
    if (target) {
      let mx = sx(target.x, p.x);
      let my = sy(target.z, p.z);
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > (R - 14) / SCALE) {
        // fuori dalla mappa: aggancia al bordo nella direzione giusta
        mx = R + (dx / dist) * (R - 14);
        my = R + (dz / dist) * (R - 14);
      }
      ctx.font = 'bold 15px serif';
      ctx.fillText('⭐', mx, my);
    }

    // giocatore: triangolino bianco al centro, ruotato come lui
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return { update };
}
