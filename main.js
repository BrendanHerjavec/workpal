const { app, BrowserWindow, Menu, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { getMacStats } = require('./src/macSources');
const gmail = require('./src/gmail');

const store = new Store({
  defaults: {
    stats: {
      goodDays: 0,
      badDaysInARow: 0,
      stage: 0, // 0=egg, 1=blob, 2=sprout, 3=junior, 4=senior, 5=executive
      history: [], // [{date, score}]
      deathDays: 0,
      lastTickDate: null,
      tasksTowardEvolve: 0
    },
    settings: {
      alwaysOnTop: true,
      paused: false,
      mockMode: true,
      demoMode: false,
      demoCycleSeconds: 20,
      tasksPerEvolve: 3,
      mock: {
        unreadEmails: 12,
        overdueTasks: 2,
        todaysCompletedTasks: 4,
        focusMinutes: 90
      }
    }
  }
});

let win = null;

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 280,
    height: 380,
    x: width - 300,
    y: 40,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: store.get('settings.alwaysOnTop'),
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('src/index.html');
  win.setVisibleOnAllWorkspaces(true);
}

// IPC: store accessors
ipcMain.handle('store:get', (_e, key) => store.get(key));
ipcMain.handle('store:set', (_e, key, val) => { store.set(key, val); return true; });

ipcMain.handle('window:setAlwaysOnTop', (_e, flag) => {
  if (win) win.setAlwaysOnTop(flag);
  store.set('settings.alwaysOnTop', flag);
});

ipcMain.handle('window:quit', () => app.quit());
ipcMain.handle('window:getPosition', () => win ? win.getPosition() : [0, 0]);
ipcMain.handle('window:setPosition', (_e, x, y) => { if (win) win.setPosition(Math.round(x), Math.round(y)); });
ipcMain.handle('real:getStats', () => getMacStats());

ipcMain.handle('gmail:isConnected', () => gmail.isConnected(store));
ipcMain.handle('gmail:connect', async (_e, creds) => {
  await gmail.connect(store, creds);
  return true;
});
ipcMain.handle('gmail:disconnect', () => { gmail.disconnect(store); return true; });
ipcMain.handle('gmail:getStats', async () => {
  try { return await gmail.getInboxStats(store); }
  catch (err) { return { error: err.message, unreadEmails: 0 }; }
});

ipcMain.handle('dialog:promptGmailCreds', async () => {
  // Two-step prompt using a temporary BrowserWindow with a tiny HTML form.
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      width: 460, height: 320, parent: win, modal: true, resizable: false,
      title: 'Connect Gmail',
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    const html = `data:text/html,${encodeURIComponent(`
      <html><body style="font-family:system-ui;padding:16px;background:#1f2937;color:#f1f5f9">
        <h2 style="margin:0 0 8px">Connect Gmail</h2>
        <p style="margin:0 0 12px;font-size:12px;opacity:.8">Paste your OAuth client credentials from Google Cloud Console (Desktop app type).</p>
        <label style="font-size:12px">Client ID<br><input id=c style="width:100%;padding:6px;margin:4px 0 10px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px"></label>
        <label style="font-size:12px">Client Secret<br><input id=s style="width:100%;padding:6px;margin:4px 0 12px;background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px"></label>
        <div style="text-align:right">
          <button onclick="window.close()" style="padding:6px 12px;margin-right:6px;background:#374151;color:#fff;border:0;border-radius:6px;cursor:pointer">Cancel</button>
          <button onclick="document.title='SUBMIT::'+document.getElementById('c').value+'::'+document.getElementById('s').value;window.close()" style="padding:6px 12px;background:#3b82f6;color:#fff;border:0;border-radius:6px;cursor:pointer">Continue →</button>
        </div>
      </body></html>
    `)}`;
    w.loadURL(html);
    w.on('closed', () => {
      const t = w?.getTitle?.() || '';
      // closed event fires after getTitle is unavailable; use the page-title-updated path instead
      resolve(null);
    });
    w.on('page-title-updated', (_ev, title) => {
      if (title.startsWith('SUBMIT::')) {
        const [, id, secret] = title.split('::');
        resolve({ clientId: id, clientSecret: secret });
        w.close();
      }
    });
  });
});

ipcMain.handle('menu:show', (_e, items) => {
  const template = items.map(it => ({
    label: it.label,
    type: it.type || 'normal',
    checked: it.checked,
    click: () => win.webContents.send('menu:click', it.id)
  }));
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: win });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
