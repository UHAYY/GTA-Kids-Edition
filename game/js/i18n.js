// -------------------------------------------------------------
// Le lingue del gioco: italiano, inglese, spagnolo e russo.
// - t(chiave, variabili): testi dell'interfaccia (chiave -> {it,en,es,ru})
// - tn(nome): nomi "propri" tradotti a partire dal testo italiano
//   (insegne dei negozi, auto, capelli e via dicendo)
// La lingua scelta resta salvata (localStorage): le insegne 3D sono
// disegnate all'avvio, quindi cambiando lingua la pagina si ricarica.
// -------------------------------------------------------------
const KEY = 'kids-city-lang';

export const LANG_ORDER = ['it', 'en', 'es', 'ru'];
const FLAGS = { it: '🇮🇹', en: '🇬🇧', es: '🇪🇸', ru: '🇷🇺' };
const LOCALES = { it: 'it-IT', en: 'en-US', es: 'es-ES', ru: 'ru-RU' };

let lang = 'it';
try { lang = localStorage.getItem(KEY) || 'it'; } catch { /* niente localStorage */ }
if (!LANG_ORDER.includes(lang)) lang = 'it';

export function getLang () { return lang; }
export function locale () { return LOCALES[lang]; }

export function setLang (l) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch {}
}

// ---------- testi dell'interfaccia ----------
const STR = {
  // --- generici ---
  title: {
    it: 'Auto Avventure — Kids City',
    en: 'Car Adventures — Kids City',
    es: 'Aventuras en Coche — Kids City',
    ru: 'Автоприключения — Kids City'
  },
  game_name: { it: '🚗 Auto Avventure', en: '🚗 Car Adventures', es: '🚗 Aventuras en Coche', ru: '🚗 Автоприключения' },
  menu_sub: {
    it: 'Guida per la città, consegna pizze e pacchetti, aiuta i vicini e raccogli le monete. Qui non si litiga con nessuno: solo buone azioni e tanta guida!',
    en: 'Drive around the city, deliver pizzas and parcels, help your neighbours and collect coins. Nobody fights here: only good deeds and lots of driving!',
    es: 'Conduce por la ciudad, reparte pizzas y paquetes, ayuda a los vecinos y recoge monedas. Aquí nadie se pelea: solo buenas acciones y mucha conducción.',
    ru: 'Катайся по городу, доставляй пиццу и посылки, помогай соседям и собирай монетки. Здесь никто ни с кем не ссорится: только добрые дела и вождение!'
  },
  btn_play: { it: '▶ GIOCA', en: '▶ PLAY', es: '▶ JUGAR', ru: '▶ ИГРАТЬ' },
  menu_hint: {
    it: "Si gioca con la tastiera: <b>W A S D</b> per muoverti, <b>E</b> per salire in macchina. Passa dal <b>Barbiere da Tony</b> per creare il tuo avatar!",
    en: "Played with the keyboard: <b>W A S D</b> to move, <b>E</b> to get in the car. Visit <b>Tony's Barbershop</b> to create your avatar!",
    es: 'Se juega con el teclado: <b>W A S D</b> para moverte, <b>E</b> para subir al coche. ¡Pasa por la <b>Barbería de Tony</b> para crear tu avatar!',
    ru: 'Управление с клавиатуры: <b>W A S D</b> — движение, <b>E</b> — сесть в машину. Загляни в <b>Барбершоп Тони</b>, чтобы создать своего персонажа!'
  },
  loading_city: { it: 'Caricamento della città…', en: 'Loading the city…', es: 'Cargando la ciudad…', ru: 'Город загружается…' },
  load_error: { it: 'Errore di caricamento: {msg}', en: 'Loading error: {msg}', es: 'Error de carga: {msg}', ru: 'Ошибка загрузки: {msg}' },

  // --- HUD ---
  hud_mission: { it: 'Missione', en: 'Mission', es: 'Misión', ru: 'Задание' },
  hud_dots: { it: '…', en: '…', es: '…', ru: '…' },
  gun_hint: { it: '🔫 <b>F</b> = sparare', en: '🔫 <b>F</b> = shoot', es: '🔫 <b>F</b> = disparar', ru: '🔫 <b>F</b> = стрелять' },
  robbery_ongoing: { it: '💰 Rapina in corso…', en: '💰 Robbery in progress…', es: '💰 Robo en curso…', ru: '💰 Идёт ограбление…' },
  help_line: {
    it: '<b>W A S D</b> muoviti &nbsp;·&nbsp; <b>Shift</b> corri &nbsp;·&nbsp; <b>E</b> entra / esci dalla macchina &nbsp;·&nbsp; <b>F11</b> tutto schermo',
    en: '<b>W A S D</b> move &nbsp;·&nbsp; <b>Shift</b> run &nbsp;·&nbsp; <b>E</b> get in / out of the car &nbsp;·&nbsp; <b>F11</b> fullscreen',
    es: '<b>W A S D</b> muévete &nbsp;·&nbsp; <b>Shift</b> corre &nbsp;·&nbsp; <b>E</b> entra / sal del coche &nbsp;·&nbsp; <b>F11</b> pantalla completa',
    ru: '<b>W A S D</b> движение &nbsp;·&nbsp; <b>Shift</b> бег &nbsp;·&nbsp; <b>E</b> сесть / выйти из машины &nbsp;·&nbsp; <b>F11</b> весь экран'
  },
  prompt_enter_car: { it: 'Premi <b>E</b> per salire in macchina', en: 'Press <b>E</b> to get in the car', es: 'Pulsa <b>E</b> para subir al coche', ru: 'Нажми <b>E</b>, чтобы сесть в машину' },
  prompt_enter_bike: { it: 'Premi <b>E</b> per salire in bici', en: 'Press <b>E</b> to get on the bike', es: 'Pulsa <b>E</b> para subir a la bici', ru: 'Нажми <b>E</b>, чтобы сесть на велосипед' },
  prompt_take_bike: { it: '🚨 Premi <b>E</b> per prendere la bici!', en: '🚨 Press <b>E</b> to take the bike!', es: '🚨 ¡Pulsa <b>E</b> para coger la bici!', ru: '🚨 Нажми <b>E</b>, чтобы взять велосипед!' },
  prompt_steal: { it: "🚨 Premi <b>E</b> per rubare l'auto!", en: '🚨 Press <b>E</b> to steal the car!', es: '🚨 ¡Pulsa <b>E</b> para robar el coche!', ru: '🚨 Нажми <b>E</b>, чтобы угнать машину!' },
  prompt_swap_car: { it: '🔄 Premi <b>E</b> per prendere questa auto', en: '🔄 Press <b>E</b> to take this car', es: '🔄 Pulsa <b>E</b> para coger este coche', ru: '🔄 Нажми <b>E</b>, чтобы сесть в эту машину' },
  prompt_swap_bike: { it: '🔄 Premi <b>E</b> per riprendere questa bici', en: '🔄 Press <b>E</b> to take this bike back', es: '🔄 Pulsa <b>E</b> para coger esta bici', ru: '🔄 Нажми <b>E</b>, чтобы снова сесть на этот велосипед' },
  prompt_stand: { it: 'Premi <b>E</b> per alzarti', en: 'Press <b>E</b> to stand up', es: 'Pulsa <b>E</b> para levantarte', ru: 'Нажми <b>E</b>, чтобы встать' },
  prompt_sit: { it: 'Premi <b>E</b> per sederti', en: 'Press <b>E</b> to sit down', es: 'Pulsa <b>E</b> para sentarte', ru: 'Нажми <b>E</b>, чтобы сесть' },
  prompt_buy: { it: "Premi <b>E</b> per comprare auto e bici", en: 'Press <b>E</b> to buy cars and bikes', es: 'Pulsa <b>E</b> para comprar coches y bicis', ru: 'Нажми <b>E</b>, чтобы купить машину или велосипед' },
  prompt_robbery: { it: '🚨 Premi <b>E</b> per rapinare!', en: '🚨 Press <b>E</b> to rob it!', es: '🚨 ¡Pulsa <b>E</b> para robar!', ru: '🚨 Нажми <b>E</b>, чтобы ограбить!' },
  heli_here: {
    it: "🚁 L'elicottero della polizia ti ha visto: corri!",
    en: '🚁 The police helicopter spotted you: run!',
    es: '🚁 ¡El helicóptero de la policía te ha visto: corre!',
    ru: '🚁 Полицейский вертолёт тебя заметил: беги!'
  },
  heli_lost: {
    it: "🏔️ Sei scappato in montagna: l'elicottero ti ha perso! -2⭐",
    en: '🏔️ You escaped to the mountains: the helicopter lost you! -2⭐',
    es: '🏔️ ¡Escapaste a la montaña: el helicóptero te perdió! -2⭐',
    ru: '🏔️ Ты скрылся в горах: вертолёт тебя потерял! -2⭐'
  },
  prompt_repair: { it: "Premi <b>E</b> per riparare l'auto ({n} monete)", en: 'Press <b>E</b> to repair the car ({n} coins)', es: 'Pulsa <b>E</b> para reparar el coche ({n} monedas)', ru: 'Нажми <b>E</b>, чтобы починить машину ({n} монет)' },
  bubble_barber: { it: "✂️ Premi <b>E</b> per personalizzare l'avatar", en: '✂️ Press <b>E</b> to customize your avatar', es: '✂️ Pulsa <b>E</b> para personalizar tu avatar', ru: '✂️ Нажми <b>E</b>, чтобы настроить персонажа' },
  kmh: { it: 'km/h', en: 'km/h', es: 'km/h', ru: 'км/ч' },

  // --- parlare con gli NPC (tasto T) ---
  prompt_talk: { it: 'Premi <b>T</b> per parlare', en: 'Press <b>T</b> to talk', es: 'Pulsa <b>T</b> para hablar', ru: 'Нажми <b>T</b>, чтобы поговорить' },
  talk_title: { it: '💬 Parla con {name}', en: '💬 Talk to {name}', es: '💬 Habla con {name}', ru: '💬 Поговори с {name}' },
  talk_listen: { it: '🎤 Ascolto… parla ora!', en: '🎤 Listening… speak now!', es: '🎤 Escuchando… ¡habla ahora!', ru: '🎤 Слушаю… говори сейчас!' },
  talk_think: { it: '💭 {name} sta pensando…', en: '💭 {name} is thinking…', es: '💭 {name} está pensando…', ru: '💭 {name} думает…' },
  talk_you: { it: 'Tu', en: 'You', es: 'Tú', ru: 'Ты' },
  talk_say: { it: '…o scrivi qui e premi Invio:', en: '…or type here and press Enter:', es: '…o escribe aquí y pulsa Enter:', ru: '…или напиши здесь и нажми Enter:' },
  talk_close: { it: '✕ Chiudi (Esc)', en: '✕ Close (Esc)', es: '✕ Cerrar (Esc)', ru: '✕ Закрыть (Esc)' },
  talk_mic_error: {
    it: '🎤 Il microfono non è disponibile qui: scrivi il messaggio qui sotto!',
    en: '🎤 The microphone is not available here: type your message below!',
    es: '🎤 El micrófono no está disponible aquí: ¡escribe tu mensaje abajo!',
    ru: '🎤 Микрофон здесь недоступен: напиши сообщение ниже!'
  },
  talk_need_key: {
    it: 'Per parlare con gli NPC serve una chiave API gratuita di <a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a> (registrazione gratis, nessuna carta). Incollala qui sotto: resta salvata su questo PC.',
    en: 'Talking to NPCs needs a free API key from <a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a> (free sign-up, no card). Paste it below: it stays saved on this PC.',
    es: 'Para hablar con los NPC hace falta una clave API gratis de <a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a> (registro gratis, sin tarjeta). Pégala abajo: se queda guardada en este PC.',
    ru: 'Чтобы говорить с NPC, нужен бесплатный API-ключ от <a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a> (бесплатная регистрация, без карты). Вставь его ниже: он сохранится на этом ПК.'
  },
  talk_key_ph: { it: 'Incolla qui la chiave (sk-or-…)', en: 'Paste your key here (sk-or-…)', es: 'Pega aquí la clave (sk-or-…)', ru: 'Вставь ключ сюда (sk-or-…)' },
  talk_key_save: { it: '💾 Salva chiave', en: '💾 Save key', es: '💾 Guardar clave', ru: '💾 Сохранить ключ' },
  talk_key_ok: { it: '✅ Chiave salvata! Adesso parla!', en: '✅ Key saved! Now talk!', es: '✅ ¡Clave guardada! ¡Habla ahora!', ru: '✅ Ключ сохранён! Теперь говори!' },
  talk_key_bad: { it: '❌ La chiave non sembra valida: controlla e riprova.', en: '❌ The key does not look valid: check it and try again.', es: '❌ La clave no parece válida: revísala y prueba otra vez.', ru: '❌ Ключ не похож на правильный: проверь и попробуй снова.' },
  talk_model: { it: '🤖 Modello AI:', en: '🤖 AI model:', es: '🤖 Modelo de IA:', ru: '🤖 ИИ-модель:' },
  talk_ai_error: { it: '❌ Problema con l\'AI ({msg}). Riprova!', en: '❌ AI problem ({msg}). Try again!', es: '❌ Problema con la IA ({msg}). ¡Prueba otra vez!', ru: '❌ Проблема с ИИ ({msg}). Попробуй ещё!' },
  talk_ai_quiet: { it: 'Non ho sentito niente… riprova!', en: 'I did not hear anything… try again!', es: 'No he oído nada… ¡prueba otra vez!', ru: 'Я ничего не услышал… попробуй ещё!' },
  talk_who: { it: '{name}, un passante della città', en: '{name}, a passer-by in the city', es: '{name}, un paseante de la ciudad', ru: '{name}, прохожий в городе' },

  // --- messaggi vari (toast) ---
  coins_back: { it: '🪙 Sono ricomparse le monete!', en: '🪙 The coins are back!', es: '🪙 ¡Las monedas han vuelto!', ru: '🪙 Монетки появились снова!' },
  npc_bump: { it: '🤕 Ops! Si rialza tra poco!', en: '🤕 Oops! They get up in a moment!', es: '🤕 ¡Ups! Se levantará en un momento.', ru: '🤕 Ой! Сейчас встанет!' },
  repair_done: { it: '🔧 Auto riparata! Manodopera: {n} monete.', en: '🔧 Car repaired! Labor: {n} coins.', es: '🔧 ¡Coche reparado! Mano de obra: {n} monedas.', ru: '🔧 Машина починена! Работа: {n} монет.' },
  repair_need: { it: '💸 Ti servono {n} monete per la riparazione: raccogli altre monete!', en: '💸 You need {n} coins for the repair: collect more coins!', es: '💸 Necesitas {n} monedas para la reparación: ¡recoge más monedas!', ru: '💸 На ремонт нужно {n} монет: собери ещё!' },
  alarm: { it: '🚨 Allarme! Resterai qui fino alla fine…', en: '🚨 Alarm! You will stay here until the end…', es: '🚨 ¡Alarma! Te quedarás aquí hasta el final…', ru: '🚨 Тревога! Ты останешься здесь до конца…' },
  dmg_30: { it: "🔧 L'auto si sta rovinando… in officina la sistemano!", en: '🔧 The car is wearing out… the workshop will fix it!', es: '🔧 El coche se está estropeando… ¡en el taller lo arreglan!', ru: '🔧 Машина изнашивается… в сервисе её починят!' },
  dmg_60: { it: "🚨 L'auto è ridotta male: va bene anche piano, ma corri quasi il doppio meno!", en: "🚨 The car is in bad shape: going slow is fine, but it runs almost half as fast!", es: '🚨 El coche está muy dañado: despacio va bien, ¡pero corre casi el doble de menos!', ru: '🚨 Машина сильно побита: можно ехать тихо, но она почти вдвое медленнее!' },
  robbery_abort: { it: "🏃 Rapina abbandonata! L'allarme è scattato lo stesso!", en: '🏃 Robbery abandoned! The alarm went off anyway!', es: '🏃 ¡Robo abandonado! ¡La alarma saltó igual!', ru: '🏃 Ограбление брошено! Тревога всё равно сработала!' },
  robbery_win: { it: '💰 Bottino: {n} monete! Corri a nasconderti!', en: '💰 Loot: {n} coins! Run and hide!', es: '💰 Botín: {n} monedas. ¡Corre a esconderte!', ru: '💰 Добыча: {n} монет! Беги прятаться!' },
  robbery_win_stolen: { it: "💰 Bottino: {n} monete! E rapina con l'auto rubata: +1 ⭐ extra!", en: '💰 Loot: {n} coins! And a robbery in the stolen car: +1 extra ⭐!', es: '💰 Botín: {n} monedas. ¡Y robo con el coche robado: +1 ⭐ extra!', ru: '💰 Добыча: {n} монет! И ограбление на угнанной машине: +1 ⭐!' },
  car_stolen: { it: '🚨 Auto rubata! La polizia ti ha visto: +1 ⭐!', en: '🚨 Car stolen! The police saw you: +1 ⭐!', es: '🚨 ¡Coche robado! La policía te ha visto: +1 ⭐!', ru: '🚨 Машина угнана! Полиция тебя заметила: +1 ⭐!' },
  bike_stolen: { it: '🚨 Bici rubata! La polizia ti ha visto: +1 ⭐!', en: '🚨 Bike stolen! The police saw you: +1 ⭐!', es: '🚨 ¡Bici robada! La policía te ha visto: +1 ⭐!', ru: '🚨 Велосипед украден! Полиция тебя заметила: +1 ⭐!' },
  hidden_ok: { it: '🅿️ Nascosto! Le stelle sono sparite!', en: '🅿️ Hidden! The stars are gone!', es: '🅿️ ¡Escondido! ¡Las estrellas han desaparecido!', ru: '🅿️ Спрятался! Звёзды пропали!' },
  big_dead: { it: 'MORTO', en: 'GAME OVER', es: 'MUERTO', ru: 'КОНЕЦ ИГРЫ' },
  big_busted: { it: 'ARRESTATO', en: 'BUSTED', es: 'ARRESTADO', ru: 'ПОЙМАН' },
  hospital_bill: { it: '🏥 Ti hanno curato! Conto: 🚑 ambulanza {a} + 🏥 ricovero {r} = {tot} monete.', en: '🏥 They fixed you up! Bill: 🚑 ambulance {a} + 🏥 hospital stay {r} = {tot} coins.', es: '🏥 ¡Te han curado! Cuenta: 🚑 ambulancia {a} + 🏥 ingreso {r} = {tot} monedas.', ru: '🏥 Тебя вылечили! Счёт: 🚑 скорая {a} + 🏥 больница {r} = {tot} монет.' },
  hospital_took: { it: '… avevi poco: hanno preso tutto!', en: "… you were short: they took it all!", es: '… tenías poco: ¡se lo llevaron todo!', ru: '… денег было мало: забрали всё!' },

  // --- monete e concessionaria ---
  coins_n: { it: '🪙 Monete: {n}', en: '🪙 Coins: {n}', es: '🪙 Monedas: {n}', ru: '🪙 Монет: {n}' },

  // --- mappa completa e navigatore ---
  map_title: { it: '🗺️ Mappa della città', en: '🗺️ City map', es: '🗺️ Mapa de la ciudad', ru: '🗺️ Карта города' },
  map_hint: {
    it: '👆 Clicca un punto della mappa: il navigatore ti guiderà fin lì!',
    en: '👆 Click a spot on the map: the navigator will guide you there!',
    es: '👆 ¡Haz clic en un punto del mapa y el navegador te llevará!',
    ru: '👆 Кликни по карте — навигатор доведёт тебя туда!'
  },
  map_clear: { it: '🧭 Togli il navigatore', en: '🧭 Turn off navigator', es: '🧭 Quitar el navegador', ru: '🧭 Выключить навигатор' },
  map_close: { it: '✕ Chiudi', en: '✕ Close', es: '✕ Cerrar', ru: '✕ Закрыть' },
  nav_set: { it: '🧭 Navigatore acceso! Segui la 📍 sulla minimappa!', en: '🧭 Navigator on! Follow the 📍 on the minimap!', es: '🧭 ¡Navegador encendido! ¡Sigue la 📍 del minimapa!', ru: '🧭 Навигатор включён! Следуй за 📍 на миникарте!' },
  nav_clear: { it: '🧭 Navigatore spento.', en: '🧭 Navigator off.', es: '🧭 Navegador apagado.', ru: '🧭 Навигатор выключен.' },
  nav_arrived: { it: '🎯 Sei arrivato a destinazione!', en: "🎯 You've arrived!", es: '🎯 ¡Has llegado a tu destino!', ru: '🎯 Ты на месте!' },
  car_until: { it: '⚡ fino a {v} km/h', en: '⚡ up to {v} km/h', es: '⚡ hasta {v} km/h', ru: '⚡ до {v} км/ч' },
  car_yours: { it: '✓ è la tua', en: '✓ yours', es: '✓ es la tuya', ru: '✓ твоя машина' },
  car_use: { it: '🔄 usa questa', en: '🔄 use this one', es: '🔄 usa esta', ru: '🔄 выбрать' },
  need_coins: { it: '🪙 Ti servono altre {n} monete!', en: '🪙 You need {n} more coins!', es: '🪙 ¡Te faltan {n} monedas!', ru: '🪙 Не хватает {n} монет!' },
  bought: { it: '🎉 Hai comprato: {name}!', en: '🎉 You bought: {name}!', es: '🎉 Has comprado: {name}!', ru: '🎉 Куплено: {name}!' },
  shop_title: { it: '🚗 Concessionaria da Stella', en: "🚗 Stella's Car Dealer", es: '🚗 Concesionario de Stella', ru: '🚗 Автосалон Стеллы' },
  shop_hint: { it: 'Raccogli le monete per la città e compra auto sempre più veloci!', en: 'Collect the coins around the city and buy faster and faster cars!', es: '¡Recoge las monedas de la ciudad y compra coches cada vez más rápidos!', ru: 'Собирай монеты по городу и покупай всё более быстрые машины!' },
  btn_done: { it: '✔ Fatto', en: '✔ Done', es: '✔ Listo', ru: '✔ Готово' },

  // --- barbiere / personalizzazione ---
  barb_title: { it: '✂️ Barbiere da Tony', en: "✂️ Tony's Barbershop", es: '✂️ Barbería de Tony', ru: '✂️ Барбершоп Тони' },
  label_height: { it: '📏 Altezza', en: '📏 Height', es: '📏 Altura', ru: '📏 Рост' },
  label_weight: { it: '⚖️ Peso', en: '⚖️ Weight', es: '⚖️ Peso', ru: '⚖️ Вес' },
  build_prefix: { it: 'Costituzione: ', en: 'Build: ', es: 'Complexión: ', ru: 'Телосложение: ' },
  build_thin: { it: 'esile', en: 'slim', es: 'delgada', ru: 'худощавое' },
  build_athletic: { it: 'atletica', en: 'athletic', es: 'atlética', ru: 'атлетичное' },
  build_strong: { it: 'robusta', en: 'strong', es: 'fuerte', ru: 'крепкое' },
  build_heavy: { it: 'forte', en: 'heavy', es: 'corpulenta', ru: 'мощное' },
  tab_body: { it: '💪 Corpo', en: '💪 Body', es: '💪 Cuerpo', ru: '💪 Тело' },
  cat_shirt: { it: '👕 Magliette', en: '👕 T-shirts', es: '👕 Camisetas', ru: '👕 Футболки' },
  cat_pants: { it: '👖 Pantaloni', en: '👖 Trousers', es: '👖 Pantalones', ru: '👖 Штаны' },
  cat_shoes: { it: '👟 Scarpe', en: '👟 Shoes', es: '👟 Zapatos', ru: '👟 Обувь' },
  cat_skin: { it: '🎨 Pelle', en: '🎨 Skin', es: '🎨 Piel', ru: '🎨 Кожа' },
  cat_hair: { it: '💇 Capelli', en: '💇 Hair', es: '💇 Pelo', ru: '💇 Причёска' },
  cat_eyes: { it: '👁 Occhi', en: '👁 Eyes', es: '👁 Ojos', ru: '👁 Глаза' },
  cat_mouth: { it: '👄 Bocca', en: '👄 Mouth', es: '👄 Boca', ru: '👄 Рот' },
  cat_beard: { it: '🧔 Barba', en: '🧔 Beard', es: '🧔 Barba', ru: '🧔 Борода' },
  cat_fuzz: { it: '🌱 Peluria', en: '🌱 Fuzz', es: '🌱 Vello', ru: '🌱 Пушок' },
  cat_hands: { it: '✋ Mani', en: '✋ Hands', es: '✋ Manos', ru: '✋ Руки' },

  // --- missioni (frasi complete: ogni lingua le sue preposizioni) ---
  m_pickup_ok: { it: '🆗 Ritiro fatto! Ora consegna!', en: '🆗 Pickup done! Now deliver!', es: '🆗 ¡Recogido! ¡Ahora a entregar!', ru: '🆗 Забрал! Теперь доставь!' },
  m_done: { it: '🎉 Missione completata! +60 monete di mancia', en: '🎉 Mission complete! +60 coin tip', es: '🎉 ¡Misión completada! +60 monedas de propina', ru: '🎉 Задание выполнено! +60 монет чаевыми' },
  m_next: { it: 'Preparando la prossima missione…', en: 'Getting the next mission ready…', es: 'Preparando la próxima misión…', ru: 'Готовим следующее задание…' },
  m_pizza_pickup: { it: 'Consegna la pizza: vai alla Pizzeria Napoli ({d} m)', en: 'Deliver the pizza: go to Napoli Pizza ({d} m)', es: 'Entrega la pizza: ve a la Pizzería Nápoles ({d} m)', ru: 'Доставь пиццу: иди в пиццерию «Неаполь» ({d} m)' },
  m_pizza_deliver: { it: 'Consegna la pizza al cliente ({d} m)', en: 'Deliver the pizza to the customer ({d} m)', es: 'Entrega la pizza al cliente ({d} m)', ru: 'Доставь пиццу клиенту ({d} m)' },
  m_pacco_pickup: { it: 'Consegna il pacco: vai all\'Ufficio Postale ({d} m)', en: 'Deliver the parcel: go to the Post Office ({d} m)', es: 'Entrega el paquete: ve a la Oficina de Correos ({d} m)', ru: 'Доставь посылку: иди на почту ({d} m)' },
  m_pacco_deliver: { it: 'Porta il pacco al destinatario ({d} m)', en: 'Take the parcel to the recipient ({d} m)', es: 'Lleva el paquete al destinatario ({d} m)', ru: 'Отнеси посылку получателю ({d} m)' },
  m_regalo_pickup: { it: 'Un regalo speciale: vai alla Giocattoleria Penna Blu ({d} m)', en: 'A special gift: go to the Blue Feather Toy Shop ({d} m)', es: 'Un regalo especial: ve a la Juguetería Pluma Azul ({d} m)', ru: 'Особый подарок: иди в магазин игрушек «Синее перо» ({d} m)' },
  m_regalo_deliver: { it: 'Porta il regalo alla festa di compleanno ({d} m)', en: 'Take the gift to the birthday party ({d} m)', es: 'Lleva el regalo a la fiesta de cumpleaños ({d} m)', ru: 'Отнеси подарок на день рождения ({d} m)' },
  m_dolci_pickup: { it: 'Dolci in consegna: vai alla Pasticceria il Cupolino ({d} m)', en: 'Sweets on the way: go to the Little Dome Bakery ({d} m)', es: 'Dulces en reparto: ve a la Pastelería el Cúpula ({d} m)', ru: 'Сладости на доставку: иди в кондитерскую «Купол» ({d} m)' },
  m_dolci_deliver: { it: 'Consegna i dolcetti alla festa ({d} m)', en: 'Deliver the sweets to the party ({d} m)', es: 'Entrega los dulces en la fiesta ({d} m)', ru: 'Отнеси сладости на праздник ({d} m)' },
  m_nonno_pickup: { it: 'Aiuto per nonno Aldo: vai alla Farmacia della Piazza ({d} m)', en: "Help for grandpa Aldo: go to the Square Pharmacy ({d} m)", es: 'Ayuda para el abuelo Aldo: ve a la Farmacia de la Plaza ({d} m)', ru: 'Помощь дедушке Альдо: иди в аптеку на площади ({d} m)' },
  m_nonno_deliver: { it: 'Porta la medicina al nonnino ({d} m)', en: 'Take the medicine to grandpa ({d} m)', es: 'Lleva la medicina al abuelito ({d} m)', ru: 'Отнеси лекарство дедушке ({d} m)' }
};

export function t (key, vars) {
  const row = STR[key];
  let s = (row && (row[lang] || row.it)) || key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

// ---------- nomi propri tradotti dal testo italiano ----------
const NOMI = {
  // bici della concessionaria
  '🚲 Citybike': { en: '🚲 City bike', es: '🚲 Bici urbana', ru: '🚲 Городской велосипед' },
  '🚲 BMX': { en: '🚲 BMX', es: '🚲 BMX', ru: '🚲 BMX' },
  '🚴 Bici da corsa': { en: '🚴 Racing bike', es: '🚴 Bici de carreras', ru: '🚴 Гоночный велосипед' },
  // auto della concessionaria
  Utilitaria: { en: 'Compact', es: 'Utilitario', ru: 'Компакт' },
  Berlina: { en: 'Sedan', es: 'Berlina', ru: 'Седан' },
  Monovolume: { en: 'Minivan', es: 'Monovolumen', ru: 'Минивэн' },
  Van: { en: 'Van', es: 'Furgón', ru: 'Фургон' },
  Coupé: { en: 'Coupe', es: 'Cupé', ru: 'Купе' },
  Cabriolet: { en: 'Convertible', es: 'Descapotable', ru: 'Кабриолет' },
  // insegne dei negozi della città
  '🍕 Pizzeria da Luigi': { en: "🍕 Luigi's Pizza", es: '🍕 Pizzería de Luigi', ru: '🍕 Пиццерия Луиджи' },
  '🍦 Gelateria Polo Nord': { en: '🍦 North Pole Gelato', es: '🍦 Heladería Polo Norte', ru: '🍦 Мороженое «Полюс»' },
  '🧁 Dolcetto in Cima': { en: '🧁 Hilltop Sweets', es: '🧁 Dulces de la Cumbre', ru: '🧁 Сладости «Вершина»' },
  '📚 Libri Magici': { en: '📚 Magic Books', es: '📚 Libros Mágicos', ru: '📚 Волшебные книги' },
  '🎮 Pixel Videogiochi': { en: '🎮 Pixel Games', es: '🎮 Pixel Videojuegos', ru: '🎮 Пиксель Игры' },
  '🧸 Orsetto e Soci': { en: '🧸 Teddy & Co', es: '🧸 Osito y Cía', ru: '🧸 Мишка и Ко' },
  '🥐 Forno Birba': { en: '🥐 Rascal Bakery', es: '🥐 Horno Pícaro', ru: '🥐 Пекарня «Бирба»' },
  '🛒 Iperbimbo': { en: '🛒 Hyperkid', es: '🛒 Hiperbimbo', ru: '🛒 ГиперБимбо' },
  '🎨 TuttoColori': { en: '🎨 All Colors', es: '🎨 TodoColores', ru: '🎨 ВсеЦвета' },
  '💊 Farmacia Felice': { en: '💊 Happy Pharmacy', es: '💊 Farmacia Feliz', ru: '💊 Весёлая аптека' },
  '☕ Caffè dei Nonni': { en: "☕ Grandpas' Café", es: '☕ Café de los Abuelos', ru: '☕ Кофе у Дедушек' },
  '🎸 Scuola di Musica': { en: '🎸 Music School', es: '🎸 Escuela de Música', ru: '🎸 Школа музыки' },
  '🍞 Pane del Mattino': { en: '🍞 Morning Bread', es: '🍞 Pan de la Mañana', ru: '🍞 Утренний хлеб' },
  '🎈 Festa & Palloncini': { en: '🎈 Party & Balloons', es: '🎈 Fiesta y Globos', ru: '🎈 Праздник и шары' },
  '💐 Fiori Felici': { en: '💐 Happy Flowers', es: '💐 Flores Felices', ru: '💐 Весёлые цветы' },
  '✈️ Volare Toys': { en: '✈️ Flying Toys', es: '✈️ Juguetes Voladores', ru: '✈️ Летающие игрушки' },
  '🚲 Due Ruote': { en: '🚲 Two Wheels', es: '🚲 Dos Ruedas', ru: '🚲 Два Колеса' },
  '🐠 Acquario Blu': { en: '🐠 Blue Aquarium', es: '🐠 Acuario Azul', ru: '🐠 Синий аквариум' },
  // negozi rapinabili, ospedale, officina
  '🏦 BANCA': { en: '🏦 BANK', es: '🏦 BANCO', ru: '🏦 БАНК' },
  '💎 GIOIELLERIA': { en: '💎 JEWELRY', es: '💎 JOYERÍA', ru: '💎 ЮВЕЛИРНЫЙ' },
  '🛒 SUPERMARKET': { en: '🛒 SUPERMARKET', es: '🛒 SUPERMERCADO', ru: '🛒 СУПЕРМАРКЕТ' },
  OSPEDALE: { en: 'HOSPITAL', es: 'HOSPITAL', ru: 'БОЛЬНИЦА' },
  '🔧 OFFICINA 🔧': { en: '🔧 WORKSHOP 🔧', es: '🔧 TALLER 🔧', ru: '🔧 АВТОСЕРВИС 🔧' },
  '🚗 CONCESSIONARIA 🚗': { en: '🚗 CAR DEALER 🚗', es: '🚗 CONCESIONARIO 🚗', ru: '🚗 АВТОСАЛОН 🚗' },
  // paesini sui rilievi
  '🏘️ Collinetta Fiorita': { en: '🏘️ Flowery Hill', es: '🏘️ Colina Florida', ru: '🏘️ Цветущий холм' },
  '🏘️ Villaggio del Sole': { en: '🏘️ Sunny Village', es: '🏘️ Aldea del Sol', ru: '🏘️ Солнечная деревня' },
  '🏘️ Rifugio della Neve': { en: '🏘️ Snow Refuge', es: '🏘️ Refugio de la Nieve', ru: '🏘️ Снежное убежище' },
  '✂ BARBIERE DA TONY ✂': { en: "✂ TONY'S BARBER ✂", es: '✂ BARBERÍA DE TONY ✂', ru: '✂ БАРБЕРШОП ТОНИ ✂' },
  // barbiere: capelli
  'Taglio originale': { en: 'Original look', es: 'Corte original', ru: 'Обычная стрижка' },
  'Rasato nero': { en: 'Black buzzcut', es: 'Rapado negro', ru: 'Чёрный ёжик' },
  'Corti castani': { en: 'Short brown', es: 'Corto castaño', ru: 'Короткие каштановые' },
  'Corti biondi': { en: 'Short blond', es: 'Corto rubio', ru: 'Короткие светлые' },
  'Ciuffo castano': { en: 'Brown tuft', es: 'Flequillo castaño', ru: 'Каштановый чуб' },
  'Afro nero': { en: 'Black afro', es: 'Afro negro', ru: 'Чёрное афро' },
  'Afro biondo': { en: 'Blond afro', es: 'Afro rubio', ru: 'Светлое афро' },
  'Ricci rossi': { en: 'Red curls', es: 'Rizos rojos', ru: 'Рыжие кудри' },
  'Punte rosa': { en: 'Pink tips', es: 'Puntas rosas', ru: 'Розовые кончики' },
  'Mohawk nero': { en: 'Black mohawk', es: 'Mohawk negro', ru: 'Чёрный ирокез' },
  'Coda castana': { en: 'Brown ponytail', es: 'Coleta castaña', ru: 'Каштановый хвост' },
  'Coda bionda': { en: 'Blond ponytail', es: 'Coleta rubia', ru: 'Светлый хвост' },
  'Chignon rosso': { en: 'Red bun', es: 'Moño rojo', ru: 'Рыжий пучок' },
  'Lunghi neri': { en: 'Long black', es: 'Largo negro', ru: 'Длинные чёрные' },
  'Bob castano': { en: 'Brown bob', es: 'Bob castaño', ru: 'Каштановое каре' },
  'Treccia grigia': { en: 'Gray braid', es: 'Trenza gris', ru: 'Седая коса' },
  'Punk rosa': { en: 'Pink punk', es: 'Punk rosa', ru: 'Розовый панк' },
  'Lungo biondo': { en: 'Long blond', es: 'Largo rubio', ru: 'Длинные светлые' },
  'Corti verdi': { en: 'Short green', es: 'Corto verde', ru: 'Короткие зелёные' },
  'Scompigliato grigio': { en: 'Messy gray', es: 'Despeinado gris', ru: 'Растрёпанные седые' },
  // barbiere: peluria e barba
  Nessuna: { en: 'None', es: 'Ninguno', ru: 'Нет' },
  Leggera: { en: 'Light', es: 'Ligera', ru: 'Лёгкий' },
  Media: { en: 'Medium', es: 'Media', ru: 'Средний' },
  Folta: { en: 'Thick', es: 'Espesa', ru: 'Густой' },
  'Da lupo': { en: 'Werewolf', es: 'De lobo', ru: 'Волчий' },
  Trespetto: { en: 'Stubble', es: 'Sombra', ru: 'Щетина' },
  Baffi: { en: 'Moustache', es: 'Bigote', ru: 'Усы' },
  Pizzetto: { en: 'Goatee', es: 'Perilla', ru: 'Эспаньолка' },
  'Barba piena': { en: 'Full beard', es: 'Barba completa', ru: 'Борода' },
  // barbiere: mani
  'Della pelle': { en: 'Skin color', es: 'Color de piel', ru: 'Цвет кожи' },
  'Guanti bianchi': { en: 'White gloves', es: 'Guantes blancos', ru: 'Белые перчатки' },
  'Guanti gialli': { en: 'Yellow gloves', es: 'Guantes amarillos', ru: 'Жёлтые перчатки' },
  'Guanti rossi': { en: 'Red gloves', es: 'Guantes rojos', ru: 'Красные перчатки' },
  'Guanti neri': { en: 'Black gloves', es: 'Guantes negros', ru: 'Чёрные перчатки' },
  // magliette
  Rossa: { en: 'Red', es: 'Roja', ru: 'Красная' },
  Arancione: { en: 'Orange', es: 'Naranja', ru: 'Оранжевая' },
  Gialla: { en: 'Yellow', es: 'Amarilla', ru: 'Жёлтая' },
  'Verde prato': { en: 'Grass green', es: 'Verde hierba', ru: 'Травяная' },
  Acquamarina: { en: 'Aquamarine', es: 'Aguamarina', ru: 'Аквамариновая' },
  Azzurra: { en: 'Blue', es: 'Azul', ru: 'Голубая' },
  Viola: { en: 'Purple', es: 'Violeta', ru: 'Фиолетовая' },
  Rosa: { en: 'Pink', es: 'Rosa', ru: 'Розовая' },
  Bianca: { en: 'White', es: 'Blanca', ru: 'Белая' },
  Nera: { en: 'Black', es: 'Negra', ru: 'Чёрная' },
  // pantaloni
  'Jeans blu': { en: 'Blue jeans', es: 'Vaqueros azules', ru: 'Синие джинсы' },
  Neri: { en: 'Black', es: 'Negros', ru: 'Чёрные' },
  Grigi: { en: 'Gray', es: 'Grises', ru: 'Серые' },
  Beige: { en: 'Beige', es: 'Beige', ru: 'Бежевые' },
  Marroni: { en: 'Brown', es: 'Marrones', ru: 'Коричневые' },
  'Verde militare': { en: 'Army green', es: 'Verde militar', ru: 'Хаки' },
  Rossi: { en: 'Red', es: 'Rojos', ru: 'Красные' },
  Arancioni: { en: 'Orange', es: 'Naranjas', ru: 'Оранжевые' },
  Chiarissimi: { en: 'Bright white', es: 'Blanquecinos', ru: 'Почти белые' },
  // scarpe
  Bianche: { en: 'White', es: 'Blancos', ru: 'Белые' },
  Nere: { en: 'Black', es: 'Negros', ru: 'Чёрные' },
  Rosse: { en: 'Red', es: 'Rojos', ru: 'Красные' },
  Blu: { en: 'Blue', es: 'Azules', ru: 'Синие' },
  Gialle: { en: 'Yellow', es: 'Amarillos', ru: 'Жёлтые' },
  // pelle
  Porcellana: { en: 'Porcelain', es: 'Porcelana', ru: 'Фарфоровая' },
  Sabbia: { en: 'Sandy', es: 'Arenosa', ru: 'Песочная' },
  'Latte e miele': { en: 'Milk & honey', es: 'Leche y miel', ru: 'Молоко и мёд' },
  Mediterranea: { en: 'Mediterranean', es: 'Mediterránea', ru: 'Средиземноморская' },
  Ambra: { en: 'Amber', es: 'Ámbar', ru: 'Янтарная' },
  Caramella: { en: 'Caramel', es: 'Caramelo', ru: 'Карамельная' },
  'Casta, scura': { en: 'Dark brunette', es: 'Morena oscura', ru: 'Тёмная' },
  Cioccolato: { en: 'Chocolate', es: 'Chocolate', ru: 'Шоколадная' }
};

// bocche e occhi generati combinatoriamente ("Bocca sottile naturale",
// "Occhi marroni giganti"): li traduco per composizione
const MOUTH_SHAPES = {
  sottile: { en: 'thin', es: 'fina', ru: 'тонкий' },
  sorriso: { en: 'smile', es: 'sonrisa', ru: 'улыбка' },
  sorrisone: { en: 'big smile', es: 'sonrisota', ru: 'большая улыбка' },
  sbalordito: { en: 'amazed', es: 'asombrado', ru: 'удивлённый' }
};
const MOUTH_COLORS = {
  naturale: { en: 'natural', es: 'natural', ru: 'натуральный' },
  rosso: { en: 'red', es: 'rojo', ru: 'красный' },
  rosa: { en: 'pink', es: 'rosa', ru: 'розовый' },
  scuro: { en: 'dark', es: 'oscuro', ru: 'тёмный' },
  prugna: { en: 'plum', es: 'ciruela', ru: 'сливовый' }
};
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
for (const [sh, shT] of Object.entries(MOUTH_SHAPES)) {
  for (const [ck, ckT] of Object.entries(MOUTH_COLORS)) {
    NOMI['Bocca ' + sh + ' ' + ck] = {
      en: cap1(shT.en + ' ' + ckT.en + ' mouth'),
      es: 'Boca ' + shT.es + ' ' + ckT.es,
      ru: cap1(ckT.ru + ' ' + shT.ru + ' рот')
    };
  }
}
const EYE_COLORS = {
  marroni: { en: 'brown', es: 'marrones', ru: 'карие' },
  castani: { en: 'chestnut', es: 'castaños', ru: 'каштановые' },
  blu: { en: 'blue', es: 'azules', ru: 'голубые' },
  azzurri: { en: 'light blue', es: 'celestes', ru: 'небесные' },
  verdi: { en: 'green', es: 'verdes', ru: 'зелёные' },
  grigi: { en: 'gray', es: 'grises', ru: 'серые' },
  neri: { en: 'black', es: 'negros', ru: 'чёрные' },
  nocciola: { en: 'hazel', es: 'avellana', ru: 'ореховые' },
  viola: { en: 'purple', es: 'violetas', ru: 'фиолетовые' },
  ambra: { en: 'amber', es: 'ámbar', ru: 'янтарные' }
};
for (const [ck, ckT] of Object.entries(EYE_COLORS)) {
  NOMI['Occhi ' + ck] = {
    en: cap1(ckT.en + ' eyes'),
    es: 'Ojos ' + ckT.es,
    ru: cap1(ckT.ru + ' глаза')
  };
  NOMI['Occhi ' + ck + ' giganti'] = {
    en: 'Giant ' + ckT.en + ' eyes',
    es: 'Ojos ' + ckT.es + ' gigantes',
    ru: 'Гигантские ' + ckT.ru + ' глаза'
  };
}

// il nome tradotto (se esiste la voce, altrimenti resta l'italiano)
export function tn (nome) {
  const n = NOMI[nome];
  return (n && (n[lang] || nome)) || nome;
}

// ---------- testi statici della pagina e selettore lingua ----------
export function applyStatic () {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.innerHTML = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[data-i18n-ph]')) {
    el.placeholder = t(el.dataset.i18nPh);
  }
}

export function buildLangSwitch (container) {
  container.innerHTML = '';
  for (const code of LANG_ORDER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'langbtn' + (lang === code ? ' sel' : '');
    b.textContent = FLAGS[code];
    b.title = { it: 'Italiano', en: 'English', es: 'Español', ru: 'Русский' }[code];
    b.setAttribute('aria-label', b.title);
    b.onclick = () => {
      if (getLang() === code) return;
      setLang(code);
      location.reload(); // le insegne 3D sono disegnate all'avvio
    };
    container.appendChild(b);
  }
}
