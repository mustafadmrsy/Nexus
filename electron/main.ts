import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { isDev } from './utils';

let mainWindow: BrowserWindow | null = null;

// Auto-updater configuration
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}

// Auto-updater events
autoUpdater.on('update-available', () => {
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Güncelleme Mevcut',
    message: 'Yeni bir güncelleme mevcut. İndiriliyor...',
    buttons: ['Tamam']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Güncelleme Hazır',
    message: 'Güncelleme indirildi. Yeniden başlatılsın mı?',
    buttons: ['Yeniden Başlat', 'Sonra'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

function createWindow(): void {
  // Ana pencereyi oluştur
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
    titleBarStyle: 'default',
    show: false,
  });

  // Development'ta localhost'u, production'da build dosyalarını yükle
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production'da build dosyasını yükle
    const indexPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'dist/index.html')
      : path.join(__dirname, '../dist/index.html');
    
    mainWindow.loadFile(indexPath);
  }

  // Pencere hazır olduğunda göster
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    
    // Production'da güncellemeleri kontrol et
    if (!isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
      }, 3000);
    }
  });

  // Pencere kapatıldığında referansı temizle
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Uygulama hazır olduğunda pencereyi oluştur
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Tüm pencereler kapatıldığında uygulamayı kapat (macOS hariç)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Menü konfigürasyonu
const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Quit',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu); 