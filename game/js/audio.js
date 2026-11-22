// Piccoli effetti sonori generati con WebAudio: niente file esterni
let ctx = null;

export function initAudio () {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone (freq, start, duration, type = 'square', volume = 0.12) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  coin () { tone(988, 0, 0.07); tone(1319, 0.07, 0.15); },
  pickup () { tone(660, 0, 0.1, 'triangle', 0.15); tone(880, 0.1, 0.18, 'triangle', 0.15); },
  door () { tone(220, 0, 0.08, 'triangle', 0.12); tone(180, 0.05, 0.1, 'triangle', 0.1); },
  complete () {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, 'triangle', 0.16));
  },
  bump () { tone(110, 0, 0.12, 'sawtooth', 0.1); }
};
