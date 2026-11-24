# 🚗 Auto Avventure — Kids City

[English](README.md) | **Italiano**

Videogioco 3D in stile GTA pensato per i bambini: guida per una città colorata,
consegna pizze e pacchi, aiuta i vicini e raccogli monete.
**Nessuna violenza vera, niente contenuti per adulti: qui la polizia ti arresta
e ti cura, non ti spara!**

> 🌍 Il gioco è disponibile in **italiano, inglese, spagnolo e russo**:
> scegli la lingua con le bandierine nel menu principale.

## 📥 Scarica e gioca (Windows)

Non serve installare nulla di nulla — prendi l'ultima versione dalla pagina
[**Releases**](https://github.com/UHAYY/GTA-Kids-Edition/releases/latest):

- **`Auto.Avventure.-.Kids.City.<versione>.exe`** → *portable*: scarichi, doppio
  clic, giochi. Nessuna installazione.
- **`Auto.Avventure.-.Kids.City.Setup.<versione>.exe`** → *installer*:
  installazione classica con scorciatoie nel menu Start e sul desktop.

Le DLL del runtime Visual C++ di Microsoft sono incluse nel pacchetto, quindi
il gioco funziona subito su qualsiasi PC Windows 10/11.

## 🎮 Cosa c'è nel gioco

- **Una città 3D generata proceduralmente**: isolotti, negozi con insegne,
  parchi, panchine, lampioni, alberi, pedoni e traffico… e un mare con la
  spiaggia tutt'intorno.
- **Missioni di buon vicinato**: ritira e consegna pizze, pacchi, regali,
  dolci e medicine seguendo la freccia gialla e il faro luminoso. Ogni
  consegna completata vale **60 monete di mancia**. 🪙
- **Monete raccoglibili per la città**: quando finiscono, ricompaiono dopo
  un attimo.
- **Concessionaria da Stella**: 10 tipi di auto (citycar, berlina, SUV, van,
  coupé, cabriolet…) con prezzi e velocità di punta realistiche. Compra quelle
  più veloci con le monete raccolte!
- **🔧 Officina**: gli scontri rovinano l'auto (diventa sempre più lenta e,
  se è molto rovinata, sbuffa fumo nero dal cofano). In officina la rimetti
  a nuova pagando la manodopera.
- **🅿️ Garage sotterranei**: 4 parcheggi con l'ingresso in superficie e la
  sala piena di posti sotto il prato. Scendi con l'auto dalla discesa… e sono
  anche il posto perfetto per **perdere la polizia**!
- **🚨 Rapine e stelle della polizia**: ruba alla banca, alla gioielleria o al
  supermarket (resta fermo davanti alla porta 4 secondi), ma le stelle salgono
  e la polizia ti insegue. Nasconditi in un garage o nell'auto della polizia
  non ci si tocca: se ti arrestano (o ti mettono K.O.)… **ospedale**, con
  conto di ambulanza e ricovero! 🚑
- **✂️ Barbiere da Tony**: personalizza il tuo avatar a piacere — tagli di
  capelli, colori, occhiali di ogni misura, barbe, magliette, pantaloni,
  scarpe, altezza e peso.
- **Camera libera**: tieni premuto il **tasto destro** del mouse per girarti
  e guardarti intorno.

## ⌨️ Comandi

| Tasto | Azione |
|-------|--------|
| `W A S D` | muoviti / guida |
| `Shift` | corri (a piedi) |
| `E` | sali / scendi dalla macchina, interagisci (negozi, panchine, riparazioni) |
| `F` | sparare (solo quando la polizia ti dà la caccia 🔫) |
| `Spazio` | salta |
| `Tasto destro` (tenuto) | ruota la camera |
| `Esc` | chiudi i pannelli |

## 🛠️ Avvio da sorgente (sviluppatori)

Serve [Node.js](https://nodejs.org) installato. Poi:

```bash
npm install
npm start
```

Si apre la finestra di **Electron** con il gioco.

<details>
<summary>Per giocare dal browser (sviluppo)</summary>

```bash
node dev-server.js
```

Poi apri <http://localhost:8080/game/index.html>.

</details>

<details>
<summary>Creare tu una release Windows</summary>

```bash
npm run dist
```

L'installer e la versione portable `.exe` finiscono nella cartella `dist/`.

</details>

## 🌍 Cambiare lingua

Nel menu principale clicca una bandierina: 🇮🇹 italiano · 🇬🇧 inglese ·
🇪🇸 spagnolo · 🇷🇺 russo. La scelta viene salvata e vale anche per le insegne
dei negozi nel mondo 3D.

## 🩺 Risoluzione dei problemi

Il gioco scrive un log dettagliato di ogni sessione — passaggi di caricamento,
errori della console, crash con causa e codici di uscita, stato della GPU — in:

```
C:\Users\<tuo utente Windows>\AppData\Roaming\Auto Avventure - Kids City\logs\game.log
```

Suggerimento: premi `Win + R`, incolla `%APPDATA%\Auto Avventure - Kids City\logs`
e dai Invio per aprire subito la cartella (`game.old.log` è la sessione
precedente). Se il gioco fa i capricci, quel file dice esattamente perché.

Il file di log si azzera automaticamente a 512 KB, quindi non cresce all'infinito.

## 🏷️ Versioni e release

Ogni release viene compilata in automatico da GitHub Actions quando viene
spinto un tag tipo `v1.0.2`: la pipeline crea i file `.exe` per Windows e li
allega alla GitHub Release (vedi
[`.github/workflows/release.yml`](.github/workflows/release.yml)).

## 🛠️ Tecnologia

- **Electron** per il client desktop
- **Three.js** per il mondo 3D (città low-poly generata proceduralmente)
- Personaggi animati con rig FBX e clamp di animazioni (corsa, salto, sedersi…)
- Effetti sonori generati con WebAudio, niente file esterni
- Interfaccia tradotta in 4 lingue (`game/js/i18n.js`)
- Log dettagliato su file (`main.js`) per diagnosticare problemi su qualsiasi PC

## 📁 Struttura

```
main.js            → processo principale Electron (finestra del gioco + log su file)
dev-server.js      → mini web server per giocare dal browser in sviluppo
game/
  index.html       → pagina del gioco (HUD, menu, pannelli)
  style.css        → stile dell'interfaccia
  js/
    main.js        → ciclo di gioco, menu, negozi, orchestrazione
    i18n.js        → traduzioni (it/en/es/ru) e selettore lingua
    city.js        → generazione della città e collisioni
    player.js      → personaggio, guida arcade, danni dell'auto
    garage.js      → parcheggi sotterranei con rampa e sala
    workshop.js    → officina con riparazione a pagamento
    dealer.js      → concessionaria con autosalone e podi
    barber.js      → barbiere con palo a strisce
    hospital.js    → ospedale (spawn dopo arresto/K.O.)
    heists.js      → banca, gioielleria e supermarket rapinabili
    police.js      → stelle, inseguimenti e arresti
    missions.js    → sistema di missioni di consegna
    npc.js         → pedoni con ragdoll morbido
    traffic.js     → auto del traffico
    smoke.js       → fumo nero dal cofano dell'auto rovinata
    hud.js         → interfaccia (toast, stelle, cuori, missioni)
    minimap.js     → minimappa in alto a destra
    avatar.js      → costruzione e personalizzazione dell'avatar
    assets.js      → caricamento di modelli e animazioni FBX
    input.js       → tastiera e pressi "una volta sola"
    audio.js       → effetti sonori WebAudio
  vendor/          → moduli addon di three.js usati dal gioco (FBX, GLTF…)
3d/                → modelli e animazioni FBX (personaggio e auto)
dlls/              → DLL runtime Microsoft VC++ incluse nell'app
.github/workflows/ → CI: release Windows automatiche a ogni tag
```

## 📜 Licenza

[MIT](LICENSE) — gioca, studia e modifica quanto vuoi!
