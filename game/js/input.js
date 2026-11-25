// Stato della tastiera (condiviso da tutti i moduli)
export const keys = Object.create(null);
const justPressed = Object.create(null);

export function initInput () {
  window.addEventListener('keydown', (e) => {
    if (!e.repeat) justPressed[e.code] = true;
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    // F11: tutto schermo sì/no. Serve preventDefault, altrimenti il
    // browser/Electron attiva anche il suo e si doppiano le finestre
    if (e.code === 'F11') {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
}

// true finché il tasto è tenuto premuto
export function pressed (code) { return !!keys[code]; }

// true una sola volta per pressione: la chiamata "consuma" l'evento
export function consumePress (code) {
  if (justPressed[code]) { justPressed[code] = false; return true; }
  return false;
}

// da chiamare alla fine di ogni frame
export function endFrame () {
  for (const k of Object.keys(justPressed)) justPressed[k] = false;
}
