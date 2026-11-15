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

export type ElectronOpenImagesResult = {
  canceled: boolean;
  filePaths: string[];
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
  /** 原生「插入图片」对话框 */
  chooseImages: () => Promise<ElectronOpenImagesResult>;
  /** 读取本机图片文件 */
  readLocalFile: (filePath: string) => Promise<Uint8Array>;
  /** 主进程代取网络图片（规避跨域限制） */
  fetchRemoteFile: (url: string) => Promise<Uint8Array>;
  /** 取拖入文件的真实磁盘路径，浏览器环境下不存在 */
  getPathForFile: (file: File) => string;
  /** 把「是否有未保存修改」同步给主进程 */
  setDocumentDirty: (dirty: boolean) => void;
  /** 订阅「窗口即将关闭」事件，返回取消订阅函数 */
  onBeforeClose: (callback: () => void) => () => void;
  /** 确认可以关闭窗口（保存完成或用户选择放弃） */
  confirmClose: () => void;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
