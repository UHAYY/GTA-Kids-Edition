// -------------------------------------------------------------
// Auto Avventure — Kids City
// Main process di Electron: crea la finestra e serve i file di gioco
// con un protocollo custom ("app://") così i moduli ES funzionano
// senza bisogno di un web server.
// -------------------------------------------------------------
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = __dirname;

// -------------------------------------------------------------
// LOG SU FILE
// Il log si trova qui (su qualunque PC Windows):
//   C:\Users\<nome utente>\AppData\Roaming\Auto Avventure - Kids City\logs\game.log
// (si può aprire anche da "Esegui" con: %APPDATA%\Auto Avventure - Kids City\logs)
// -------------------------------------------------------------
const LOG_FILE = path.join(app.getPath('userData'), 'logs', 'game.log');
const LOG_MAX = 512 * 1024; // 512 KB: oltre, il vecchio diventa game.old.log

function log (...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    try {
      if (fs.statSync(LOG_FILE).size > LOG_MAX) fs.renameSync(LOG_FILE, path.join(path.dirname(LOG_FILE), 'game.old.log'));
    } catch {}
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {}
}

process.on('uncaughtException', (err) => log('ECCEZIONE MAIN:', err.stack || String(err)));
process.on('unhandledRejection', (err) => log('REJECTION MAIN:', err instanceof Error ? err.stack : String(err)));

log('--- AVVIO APP ---');
log('versione app:', app.getVersion());
log('versione Electron/Node/Chrome:', process.versions.electron, process.versions.node, process.versions.chrome);
log('piattaforma:', process.platform, process.arch, app.getLocale());
log('cartella app (ROOT):', ROOT);
log('cartella dati (userData):', app.getPath('userData'));
log('file di log:', LOG_FILE);

// Necessario perché le fetch() del renderer (FBXLoader ecc.) funzionino
// su app://: senza questo lo schema non è "supportato" dalla Fetch API.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    title: 'Auto Avventure — Kids City',
    backgroundColor: '#8fd3f0',
    autoHideMenuBar: true,
    // l'icona della finestra (e della barra delle applicazioni):
    // la stessa del gioco, già dentro l'exe una volta pacchettizzato
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.removeMenu();

  // Logga il ciclo di vita della finestra
  win.webContents.on('did-start-loading', () => log('pagina: inizio caricamento'));
  win.webContents.on('did-finish-load', () => log('pagina: caricamento completato'));
  win.webContents.on('did-fail-load', (_e, code, desc, url) => log('pagina: CARICAMENTO FALLITO', code, desc, url));
  win.on('unresponsive', () => log('finestra: NON RESPONSIVA (freeze)'));
  win.on('responsive', () => log('finestra: di nuovo responsiva'));
  win.on('closed', () => log('finestra: chiusa'));

  // Logga i messaggi della console del gioco (utile per il debug)
  win.webContents.on('console-message', (...args) => {
    const first = args[0];
    if (first && typeof first === 'object' && 'message' in first) {
      log('[gioco]', first.level, first.message);
    } else {
      const [_e, level, message, line, sourceId] = args;
      log('[gioco]', level, message, '(' + (sourceId || '?') + ':' + (line || '?') + ')');
    }
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    log('CRASH RENDERER:', details.reason, 'exitCode=' + details.exitCode);
  });
  app.on('child-process-gone', (_e, details) => {
    log('CRASH PROCESSO FIGLIO:', details.type, details.reason, 'exitCode=' + details.exitCode);
  });
  win.webContents.on('preload-error', (_e, p, err) => log('ERRORE PRELOAD:', p, err));

  // Stato GPU (utile se il gioco non parte su PC con video integrato datato)
  app.on('ready', () => setTimeout(() => log('stato GPU:', app.getGPUFeatureStatus()), 3000));

  win.loadURL('app://bundle/game/index.html');
}

app.whenReady().then(() => {
  // Mappa app://<qualsiasi-host><percorso> -> file dentro la cartella del progetto
  protocol.handle('app', async (request) => {
    try {
      const { pathname } = new URL(request.url);
      const clean = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '/');
      const filePath = path.join(ROOT, clean);
      if (!filePath.startsWith(ROOT)) return new Response('Not found', { status: 404 });
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
