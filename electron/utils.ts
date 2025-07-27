import { app } from 'electron';

export const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

export const getAssetPath = (assetName: string): string => {
  if (isDev) {
    return `http://localhost:5173/${assetName}`;
  }
  return `file://${app.getAppPath()}/dist/${assetName}`;
}; 