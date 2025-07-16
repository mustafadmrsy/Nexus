import { app } from 'electron';

export const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1' || !app.isPackaged; 