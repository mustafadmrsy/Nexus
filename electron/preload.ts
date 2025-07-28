import { contextBridge, ipcRenderer } from "electron";

// Renderer process'e güvenli API'ler sunuyoruz
contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // Pencere kontrolleri
  minimize: () => ipcRenderer.invoke("window-minimize"),
  maximize: () => ipcRenderer.invoke("window-maximize"),
  close: () => ipcRenderer.invoke("window-close"),

  // Bildirim gönderme
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke("show-notification", title, body),
});

// Ekstra: Electron ortamı kontrolü için bayrak
contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
});

// Type definitions için global arayüz
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      showNotification: (title: string, body: string) => Promise<void>;
    };
    electron: {
      isElectron: boolean;
    };
  }
}
