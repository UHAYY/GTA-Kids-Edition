// HUD: testo e pannelli sovrapposti al gioco
export function createHUD () {
  const el = (id) => document.getElementById(id);
  const hud = {
    root: el('hud'),
    coins: el('coins'),
    missions: el('missions'),
    missionText: el('mission-text'),
    speed: el('speed'),
    prompt: el('prompt'),
    toastEl: el('toast'),
    menu: el('menu'),
    heartsEl: el('hearts'),
    starsEl: el('stars'),
    gunhintEl: el('gunhint'),
    robberyEl: el('robbery'),
    robberyFill: el('robbery-fill'),
    robberyLabel: el('robbery-label'),
    bigmsgEl: el('bigmsg')
  };
  let toastTime = 0;

  hud.show = () => hud.root.classList.remove('hidden');
  hud.toast = (text) => {
    hud.toastEl.textContent = text;
    hud.toastEl.classList.remove('hidden');
    toastTime = 3;
  };
  hud.updateToast = (dt) => {
    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) hud.toastEl.classList.add('hidden');
    }
  };

  // cuori: vita del giocatore (3 = tutto ok)
  hud.setHearts = (n) => {
    hud.heartsEl.textContent = n > 0 ? '❤️'.repeat(n) : '💀';
  };

  // stelle della polizia: ☆ spente e ⭐ accese
  hud.setStars = (n) => {
    hud.starsEl.classList.toggle('hidden', n === 0);
    hud.gunhintEl.classList.toggle('hidden', n === 0);
    hud.starsEl.textContent = '⭐'.repeat(n) + '☆'.repeat(5 - n);
  };

  // barra della rapina in corso (p = 0..1, o null per nasconderla)
  hud.setRobbery = (p, label) => {
    if (p == null) {
      hud.robberyEl.classList.add('hidden');
      return;
    }
    hud.robberyEl.classList.remove('hidden');
    hud.robberyFill.style.width = Math.round(p * 100) + '%';
    hud.robberyLabel.textContent = label;
  };

  // MORTO / ARRESTATO a tutto schermo
  hud.bigMsg = (text, kind) => {
    hud.bigmsgEl.textContent = text;
    hud.bigmsgEl.className = kind;
  };
  hud.hideBigMsg = () => {
    hud.bigmsgEl.className = 'hidden';
  };

  return hud;
}
