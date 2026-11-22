// -------------------------------------------------------------
// Auto Avventure — Kids City
// Main process di Electron: crea la finestra e serve i file di gioco
// con un protocollo custom ("app://") così i moduli ES funzionano
// senza bisogno di un web server.
// -------------------------------------------------------------
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = __dirname;

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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.removeMenu();

  // Logga i messaggi della console del gioco (utile per il debug)
  win.webContents.on('console-message', (...args) => {
    const first = args[0];
    if (first && typeof first === 'object' && 'message' in first) {
      console.log('[gioco]', first.message);
    } else {
      console.log('[gioco]', args[2] ?? '');
    }
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[gioco] processo renderer terminato:', details.reason);
  });

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
