# 🚗 Auto Avventure — Kids City

**English** | [Italiano](README.it.md)

A GTA-style 3D video game designed for kids: drive around a colorful city,
deliver pizzas and parcels, help your neighbors and collect coins.
**No real violence, no adult content: here the police arrest you and take
care of you, they don't shoot you!**

> 🌍 The game is available in **Italian, English, Spanish and Russian**:
> pick your language with the flags in the main menu.

## 📥 Download and play (Windows)

No installation of anything required — grab the latest release from the
[**Releases page**](https://github.com/UHAYY/GTA-Kids-Edition/releases/latest):

- **`Auto.Avventure.-.Kids.City.<version>.exe`** → *portable*: download, double
  click, play. Nothing is installed.
- **`Auto.Avventure.-.Kids.City.Setup.<version>.exe`** → *installer*: classic
  installation with Start-menu and desktop shortcuts.

The Microsoft Visual C++ runtime DLLs are included in the package, so the
game runs on any Windows 10/11 machine right away.

## 🎮 What's in the game

- **A procedurally generated 3D city**: blocks, shops with signs, parks,
  benches, street lamps, trees, pedestrians and traffic… plus a sea with a
  beach all around.
- **Good-neighbor missions**: pick up and deliver pizzas, parcels, gifts,
  sweets and medicine by following the yellow arrow and the glowing beacon.
  Every completed delivery is worth **60 bonus coins**. 🪙
- **Collectible coins around the city**: when they run out, they reappear
  after a short while.
- **Stella's car dealership**: 10 types of cars (city car, sedan, SUV, van,
  coupé, convertible…) with realistic prices and top speeds. Buy the faster
  ones with the coins you collect!
- **🔧 Repair shop**: crashes wear your car out (it gets slower and slower
  and, when badly damaged, puffs black smoke from the hood). At the repair
  shop you can make it good as new — for a labor fee.
- **🅿️ Underground garages**: 4 parking sites with a street-level entrance
  and a hall full of spots beneath the grass. Drive down the ramp… they're
  also the perfect place to **shake off the police**!
- **🚨 Heists and police stars**: rob the bank, the jewelry store or the
  supermarket (stand still in front of the door for 4 seconds), but your
  wanted stars go up and the police will chase you. Hiding in a garage is
  allowed — the cops can't touch you there. If they arrest you (or knock
  you out)… **hospital**, with an ambulance and hospitalization bill! 🚑
- **✂️ Tony's barbershop**: customize your avatar however you like —
  haircuts, colors, glasses of every size, beards, T-shirts, pants, shoes,
  height and weight.
- **Free camera**: hold the **right mouse button** to turn around and look
  about.

## ⌨️ Controls

| Key | Action |
|-----|--------|
| `W A S D` | move / drive |
| `Shift` | run (on foot) |
| `E` | get in / out of the car, interact (shops, benches, repairs) |
| `F` | shoot (only while the police are after you 🔫) |
| `Space` | jump |
| `Right mouse button` (held) | rotate the camera |
| `Esc` | close panels |

## 🛠️ Run from source (developers)

You need [Node.js](https://nodejs.org) installed. Then:

```bash
npm install
npm start
```

An **Electron** window opens with the game.

<details>
<summary>To play in the browser (development)</summary>

```bash
node dev-server.js
```

Then open <http://localhost:8080/game/index.html>.

</details>

<details>
<summary>Build a Windows release yourself</summary>

```bash
npm run dist
```

The installer and portable `.exe` files end up in the `dist/` folder.

</details>

## 🌍 Changing language

In the main menu, click a flag: 🇮🇹 Italian · 🇬🇧 English ·
🇪🇸 Spanish · 🇷🇺 Russian. Your choice is saved and applies to the shop
signs in the 3D world too.

## 🩺 Troubleshooting

The game writes a detailed log of every session — loading steps, console
errors, crashes with their cause and exit codes, GPU status — to:

```
C:\Users\<your Windows user>\AppData\Roaming\Auto Avventure - Kids City\logs\game.log
```

Tip: press `Win + R`, paste `%APPDATA%\Auto Avventure - Kids City\logs` and
press Enter to open the folder directly (`game.old.log` is the previous
session). If the game misbehaves, that file says exactly why.

The log file rotates automatically at 512 KB, so it never grows forever.

## 🏷️ Versions and releases

Every release is built automatically by GitHub Actions when a tag like
`v1.0.2` is pushed: the pipeline compiles the Windows `.exe` files and
attaches them to the GitHub Release (see
[`.github/workflows/release.yml`](.github/workflows/release.yml)).

## 🛠️ Technology

- **Electron** for the desktop client
- **Three.js** for the 3D world (procedurally generated low-poly city)
- Characters animated with FBX rigs and animation clamping (running,
  jumping, sitting…)
- Sound effects generated with WebAudio, no external files
- UI translated into 4 languages (`game/js/i18n.js`)
- Detailed file logging (`main.js`) for diagnosing problems on any machine

## 📁 Structure

```
main.js            → Electron main process (game window + file logging)
dev-server.js      → tiny web server to play in the browser while developing
game/
  index.html       → game page (HUD, menu, panels)
  style.css        → UI styles
  js/
    main.js        → game loop, menu, shops, orchestration
    i18n.js        → translations (it/en/es/ru) and language picker
    city.js        → city generation and collisions
    player.js      → character, arcade driving, car damage
    garage.js      → underground parking lots with ramp and hall
    workshop.js    → repair shop with paid repairs
    dealer.js      → car dealership with showroom and podiums
    barber.js      → barbershop with striped pole
    hospital.js    → hospital (spawn after arrest / K.O.)
    heists.js      → robbable bank, jewelry store and supermarket
    police.js      → wanted stars, chases and arrests
    missions.js    → delivery mission system
    npc.js         → pedestrians with soft ragdoll
    traffic.js     → traffic cars
    smoke.js       → black smoke from a damaged car's hood
    hud.js         → UI (toasts, stars, hearts, missions)
    minimap.js     → minimap in the top-right corner
    avatar.js      → avatar building and customization
    assets.js      → FBX model and animation loading
    input.js       → keyboard and "press once" inputs
    audio.js       → WebAudio sound effects
  vendor/          → three.js addon loaders used by the game (FBX, GLTF…)
3d/                → FBX models and animations (character and cars)
dlls/              → Microsoft VC++ runtime DLLs bundled with the app
.github/workflows/ → CI: automatic Windows releases on every tag
```

## 📜 License

[MIT](LICENSE) — play, study and modify it as much as you like!
