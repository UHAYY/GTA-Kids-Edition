// -------------------------------------------------------------
// Parlare con gli NPC (tasto T)
// - vicino a un passante premi T: si apre il dialogo
// - il microfono usa il riconoscimento vocale del browser (Web Speech
//   API): se non è disponibile (succede in Electron), si scrive il testo
// - la risposta dell'NPC arriva da un'AI gratis via OpenRouter
//   (serve una chiave API gratuita, salvata in localStorage)
// - la risposta viene detta a voce (sintesi vocale di sistema) e mostrata
//   in un fumetto sopra la testa dell'NPC
// -------------------------------------------------------------
import * as THREE from 'three';
import { t as tr, locale, getLang } from './i18n.js';

const KEY_STORE = 'kids-city-openrouter-key';
const MODEL_STORE = 'kids-city-openrouter-model';
// modello gratuito di default su OpenRouter (modificabile nel dialogo)
// NB: deve essere un modello di CHAT (non "embed"!), e il catalogo dei
// modelli :free cambia nel tempo — se smette di rispondere, guarda qui:
// https://openrouter.ai/models?max_price=0
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning:free';
const TALK_DIST = 3.2;   // distanza massima per parlare a un passante

// personaggi possibili per i passanti (il contesto dell'AI)
const ROLES = [
  { it: 'un panettiere allegro', en: 'a cheerful baker', es: 'un panadero alegre', ru: 'весёлый пекарь' },
  { it: 'una signora in pensione con il cane', en: 'a retired lady with a dog', es: 'una señora jubilada con su perro', ru: 'пенсионерка с собакой' },
  { it: 'un bambino curioso', en: 'a curious kid', es: 'un niño curioso', ru: 'любопытный ребёнок' },
  { it: 'un giardiniere della città', en: 'the city gardener', es: 'el jardinero de la ciudad', ru: 'городской садовник' },
  { it: 'un vigile urbano sorridente', en: 'a smiling traffic warden', es: 'un agente de tráfico sonriente', ru: 'улыбающийся регулировщик' },
  { it: 'un pescatore del molo', en: 'a fisherman from the pier', es: 'un pescador del muelle', ru: 'рыбак с пирса' },
  { it: 'un factotum sempre di corsa', en: 'a handyman always in a hurry', es: 'un manitas siempre con prisa', ru: 'мастер на все руки, вечно спешащий' },
  { it: 'una maestra delle elementari', en: 'a primary school teacher', es: 'una maestra de primaria', ru: 'учительница начальных классов' }
];
const NAMES = ['Marco', 'Giulia', 'Anna', 'Luca', 'Sara', 'Piero', 'Elena', 'Bruno',
  'Carla', 'Davide', 'Franca', 'Gino', 'Lia', 'Mirko', 'Nina', 'Oscar'];

function getKey () {
  try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; }
}
function getModel () {
  try { return localStorage.getItem(MODEL_STORE) || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}

export function createTalk ({ npcs, player, camera, promptEl }) {
  // ---------- elementi dell'interfaccia ----------
  const el = (id) => document.getElementById(id);
  const panel = el('talk');
  const titleEl = el('talk-title');
  const logEl = el('talk-log');
  const statusEl = el('talk-status');
  const inputEl = el('talk-input');
  const sendBtn = el('talk-send');
  const closeBtn = el('talk-close');
  const keyRow = el('talk-keyrow');
  const keyEl = el('talk-key');
  const keyBtn = el('talk-keysave');
  const modelEl = el('talk-model');
  const bubble = el('talk-bubble');
  const tmpV = new THREE.Vector3();

  let open = false;        // il dialogo è aperto?
  let npc = null;          // l'NPC con cui stai parlando
  let rec = null;          // SpeechRecognition corrente
  let micAvailable = false;
  let speaking = false;

  // memoria della conversazione, per NPC (si ricorda finché giochi)
  const history = new Map();
  const roles = new Map();
  const names = new Map();

  function nameOf (n, i) {
    if (!names.has(n)) names.set(n, NAMES[(i + Math.floor(n.pos.x * 7 + n.pos.z * 3)) % NAMES.length]);
    return names.get(n);
  }
  function roleOf (n, i) {
    if (!roles.has(n)) roles.set(n, ROLES[(i + Math.floor(n.pos.z * 5 + n.pos.x * 11)) % ROLES.length]);
    return roles.get(n);
  }

  // ---------- fumetto sopra la testa ----------
  function updateBubble () {
    if (!open || !npc) { bubble.classList.add('hidden'); return; }
    const last = [...logEl.querySelectorAll('.msg.npc')].pop();
    if (!last) { bubble.classList.add('hidden'); return; }
    const hp = npc.pos.clone().setY(2.15);
    const proj = hp.project(camera);
    if (proj.z > 1) { bubble.classList.add('hidden'); return; }
    bubble.style.left = ((proj.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    bubble.style.top = ((-proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    bubble.textContent = last.textContent;
    bubble.classList.remove('hidden');
  }

  // ---------- voce dell'NPC (sintesi vocale di sistema) ----------
  function say (text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = locale();
      u.rate = 1.02;
      u.pitch = 1.05;
      speechSynthesis.speak(u);
      speaking = true;
      u.onend = () => { speaking = false; };
    } catch { /* niente voce: pazienza */ }
  }

  // ---------- log del dialogo ----------
  function addMsg (who, text, cls) {
    const d = document.createElement('div');
    d.className = 'msg ' + cls;
    if (cls !== 'npc') {
      const b = document.createElement('b');
      b.textContent = who + ': ';
      d.appendChild(b);
    }
    d.appendChild(document.createTextNode(text));
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    return d;
  }

  function setStatus (txt) { statusEl.textContent = txt; }

  // ---------- microfono (Web Speech API) ----------
  function startMic () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { statusEl.textContent = tr('talk_mic_error'); return; }
    try {
      rec = new SR();
      rec.lang = locale();
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        if (text) send(text);
        else setStatus(tr('talk_ai_quiet'));
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed') {
          micAvailable = false;
          statusEl.textContent = tr('talk_mic_error');
        } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
          micAvailable = false;
          statusEl.textContent = tr('talk_mic_error');
        } else if (e.error === 'no-speech') {
          setStatus(tr('talk_listen'));
        }
      };
      rec.onend = () => {
        // finché il dialogo è aperto il microfono resta pronto
        if (open && micAvailable && !speaking) { try { rec.start(); } catch {} }
      };
      rec.start();
      micAvailable = true;
      setStatus(tr('talk_listen'));
    } catch {
      micAvailable = false;
      statusEl.textContent = tr('talk_mic_error');
    }
  }
  function stopMic () {
    if (rec) { try { rec.onend = null; rec.stop(); } catch {} rec = null; }
    try { speechSynthesis.cancel(); } catch {}
    speaking = false;
  }

  // ---------- l'AI risponde (OpenRouter, modello gratis) ----------
  async function askAI (npcName, role, messages) {
    const key = getKey();
    const sys = [
      `Sei ${role[getLang()] || role.it}, di nome ${npcName}, un passante in "Auto Avventure — Kids City",`,
      'un videogioco 3D pacifico per bambini di 6-10 anni.',
      'Rispondi SEMPRE in lingua ' + locale() + ', con massimo 2 frasi brevi e semplici.',
      'Sei gentile, allegro e un po\' giocoso. Niente violenza, niente soldi, niente argomenti per adulti:',
      'parla della città, delle auto, delle monete, del barbiere, della pizza.',
      'Se ti chiedono cose inadatte rispondi che preferisci parlare di cose belle della città.'
    ].join(' ');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'X-Title': 'Auto Avventure - Kids City'
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 600,
        temperature: 0.8,
        // i modelli "reasoning" bruciano i token ragionando prima di
        // rispondere: chiediamo di ragionare poco e di non mostrarlo
        reasoning: { effort: 'low', exclude: true },
        messages: [{ role: 'system', content: sys }, ...messages]
      })
    });
    if (!res.ok) {
      let msg = String(res.status);
      try { msg = (await res.json())?.error?.message || msg; } catch {}
      throw new Error(msg);
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    const reply = (choice?.message?.content || '').trim();
    if (!reply) {
      throw new Error('risposta vuota (finish=' + (choice?.finish_reason || '?') + ')');
    }
    return reply;
  }

  async function send (text) {
    if (!open || !text || !npc) return;
    stopMic();
    addMsg(tr('talk_you'), text, 'you');

    const i = npcs.indexOf(npc);
    const npcName = nameOf(npc, i);
    const role = roleOf(npc, i);
    if (!history.has(npc)) history.set(npc, []);
    const msgs = history.get(npc);
    msgs.push({ role: 'user', content: text });
    setStatus(tr('talk_think', { name: npcName }));

    inputEl.value = '';
    if (!getKey()) { showKeyRow(); return; }

    try {
      const reply = await askAI(npcName, role, msgs);
      if (!reply) throw new Error('empty');
      msgs.push({ role: 'assistant', content: reply });
      addMsg(npcName, reply, 'npc');
      setStatus('');
      say(reply);
      // dopo la voce, se il microfono funziona torna in ascolto
      const wait = setInterval(() => {
        if (!open) { clearInterval(wait); return; }
        if (!speaking) { clearInterval(wait); if (micAvailable) startMic(); }
      }, 300);
    } catch (e) {
      setStatus(tr('talk_ai_error', { msg: String(e.message || e).slice(0, 90) }));
      if (!getKey()) showKeyRow();
    }
  }

  // ---------- apertura e chiusura ----------
  function showKeyRow () {
    keyRow.classList.remove('hidden');
    keyEl.value = getKey();
    modelEl.value = getModel();
  }

  function tryTalk () {
    if (open) return false;
    // il passante più vicino (a piedi, non a terra per il ragdoll)
    let best = null;
    let bestD = TALK_DIST;
    for (const n of npcs) {
      if (n.rd) continue;
      const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (!best) return false;

    npc = best;
    open = true;
    const i = npcs.indexOf(npc);
    titleEl.textContent = tr('talk_title', { name: nameOf(npc, i) });
    logEl.innerHTML = '';
    addMsg('', tr('talk_who', { name: nameOf(npc, i) }), 'npc who');
    statusEl.textContent = '';
    panel.classList.remove('hidden');
    inputEl.placeholder = tr('talk_say');
    closeBtn.textContent = tr('talk_close');
    // la riga chiave+modello resta sempre disponibile (per cambiarle)
    showKeyRow();
    if (getKey()) startMic();
    setTimeout(() => inputEl.focus(), 50);
    return true;
  }

  function close () {
    if (!open) return;
    open = false;
    npc = null;
    stopMic();
    panel.classList.add('hidden');
    bubble.classList.add('hidden');
    inputEl.blur();
  }
  function isOpen () { return open; }

  // ---------- eventi dell'interfaccia ----------
  closeBtn.addEventListener('click', close);
  sendBtn.addEventListener('click', () => send(inputEl.value.trim()));
  inputEl.addEventListener('keydown', (e) => {
    e.stopPropagation(); // WASD ed Escape non devono muovere il giocatore
    if (e.key === 'Enter') send(inputEl.value.trim());
  });
  keyBtn.addEventListener('click', () => {
    const k = keyEl.value.trim();
    if (!/^sk-or-/.test(k)) { setStatus(tr('talk_key_bad')); return; }
    try {
      localStorage.setItem(KEY_STORE, k);
      const m = modelEl.value.trim();
      if (m) localStorage.setItem(MODEL_STORE, m);
      else localStorage.removeItem(MODEL_STORE);
    } catch {}
    keyRow.classList.add('hidden');
    setStatus(tr('talk_key_ok'));
    if (micAvailable) startMic();
  });
  // mentre scrivi nei campi non far partire comandi di gioco
  keyEl.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') keyBtn.click();
  });
  modelEl.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') keyBtn.click();
  });

  return { tryTalk, close, isOpen, updateBubble };
}
