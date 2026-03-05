// WinClaw Desktop Shell - Preload Script
// Exposes a secure IPC bridge for the hamburger menu button.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("winclaw", {
  showMenu: (x, y) => ipcRenderer.send("show-app-menu", { x, y }),
});
