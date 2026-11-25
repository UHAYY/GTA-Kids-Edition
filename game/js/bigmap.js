// -------------------------------------------------------------
// La mappa completa: si apre cliccando sulla minimappa. Mostra tutta
// l'isola con i marker utili (te, la macchina, i negozi, la missione…).
// Cliccando un punto della mappa quello diventa la destinazione del
// navigatore (la bandierina 📍 sulla minimappa). Il negozio in sé
// (che cosa mostrare) vive nel callback passato da main.js.
// -------------------------------------------------------------
import { t as tr } from './i18n.js';

export function createBigMap (map, getInfo, onPick) {
  const root = document.getElementById('bigmap');
  const canvas = document.getElementById('bigmap-canvas');
  const ctx = canvas.getContext('2d');
  // dal pixel della mappa grande al mondo e viceversa
  const scale = canvas.width / (map.off * 2);
  const px = (wx) => (wx + map.off) * scale;
  const py = (wz) => (wz + map.off) * scale;

  function draw () {
    const s = getInfo();
    const p = s.player.mode === 'drive' ? s.player.carPos : s.player.pos;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // sfondo: la mappa statica per intero
    ctx.drawImage(map.canvas, 0, 0, canvas.width, canvas.height);

    // bici da prendere
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of s.bikes) ctx.fillText('🚲', px(b.position.x), py(b.position.z));

    // auto del traffico (puntini) e parcheggi nascondiglio
    ctx.fillStyle = '#ffd54f';
    for (const c of s.traffic) {
      ctx.beginPath();
      ctx.arc(px(c.car.position.x), py(c.car.position.z), 2.5, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = '#2f6fb3';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    for (const pad of s.pads) {
      ctx.beginPath();
      ctx.roundRect(px(pad.x) - 6, py(pad.z) - 6, 12, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('P', px(pad.x), py(pad.z) + 1);
      ctx.font = '14px serif';
      ctx.fillStyle = '#2f6fb3';
    }

    // negozi e luoghi utili
    for (const m of s.marks) {
      if (Math.abs(m.x - p.x) + Math.abs(m.z - p.z) < map.off * 2) {
        ctx.fillText(m.icon, px(m.x), py(m.z));
      }
    }

    // la tua auto (o bici) ovunque sia
    ctx.font = s.player.car.userData.bike ? '14px serif' : '16px serif';
    ctx.fillText(s.player.car.userData.bike ? '🚲' : '🚙', px(s.player.car.position.x), py(s.player.car.position.z));

    // destinazione del navigatore
    if (s.nav.on) ctx.fillText('📍', px(s.nav.x), py(s.nav.z));

    // te: triangolino bianco ruotato come il veicolo/personaggio
    ctx.save();
    ctx.translate(px(p.x), py(p.z));
    ctx.rotate(Math.PI - (s.player.mode === 'drive' ? s.player.heading : s.player.yaw));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // click sulla mappa: diventa la destinazione del navigatore
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const wx = (e.clientX - r.left) / scale - map.off;
    const wz = (e.clientY - r.top) / scale - map.off;
    onPick(wx, wz);
  });

  document.getElementById('map-close').addEventListener('click', close);
  document.getElementById('map-clear').addEventListener('click', () => onPick(null));

  function open () { root.classList.remove('hidden'); draw(); }
  function close () { root.classList.add('hidden'); }
  function isOpen () { return !root.classList.contains('hidden'); }
  return { open, close, isOpen, draw };
}
