const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workpal', {
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, val) => ipcRenderer.invoke('store:set', key, val),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
  quit: () => ipcRenderer.invoke('window:quit'),
  getRealStats: () => ipcRenderer.invoke('real:getStats'),
  gmail: {
    isConnected: () => ipcRenderer.invoke('gmail:isConnected'),
    connect: (creds) => ipcRenderer.invoke('gmail:connect', creds),
    disconnect: () => ipcRenderer.invoke('gmail:disconnect'),
    getStats: () => ipcRenderer.invoke('gmail:getStats'),
    promptCreds: () => ipcRenderer.invoke('dialog:promptGmailCreds')
  },
  showMenu: (items) => ipcRenderer.invoke('menu:show', items),
  onMenuClick: (cb) => ipcRenderer.on('menu:click', (_e, id) => cb(id))
});
