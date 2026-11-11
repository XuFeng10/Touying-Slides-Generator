/**
 * Electron 预加载脚本暴露给渲染进程的接口（见 electron/preload.cjs）。
 * 在浏览器环境下 `window.electronAPI` 为 undefined。
 */
export type ElectronAppInfo = {
  version: string;
  platform: string;
  isPackaged: boolean;
};

export type ElectronDialogResult = {
  canceled: boolean;
  filePath?: string;
};

export type ElectronOpenDocumentResult = ElectronDialogResult & {
  content?: string;
};

export type ElectronSaveBinaryOptions = {
  defaultFileName: string;
  data: Uint8Array;
  filters?: { name: string; extensions: string[] }[];
};

export type ElectronAPI = {
  platform: string;
  versions: { electron: string; chrome: string };
  getAppInfo: () => Promise<ElectronAppInfo>;
  openDocument: () => Promise<ElectronOpenDocumentResult>;
  chooseSavePath: (defaultFileName?: string) => Promise<ElectronDialogResult>;
  readDocument: (filePath: string) => Promise<string>;
  writeDocument: (filePath: string, content: string) => Promise<ElectronDialogResult>;
  saveBinaryFile: (
    options: ElectronSaveBinaryOptions,
  ) => Promise<ElectronDialogResult>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
