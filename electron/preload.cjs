// 预加载脚本：在隔离上下文中把有限的原生能力暴露给渲染进程。
// 保持 CJS + sandbox，渲染进程无法直接接触 Node。
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },

  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),

  /** 原生「打开文档」对话框，返回 { canceled, filePath, content } */
  openDocument: () => ipcRenderer.invoke("document:open"),

  /** 原生「另存为」对话框，仅选择路径，返回 { canceled, filePath } */
  chooseSavePath: (defaultFileName) =>
    ipcRenderer.invoke("document:saveAs", { defaultFileName }),

  readDocument: (filePath) =>
    ipcRenderer.invoke("document:read", { filePath }),

  writeDocument: (filePath, content) =>
    ipcRenderer.invoke("document:write", { filePath, content }),

  /** 导出 PDF / 压缩包等二进制文件，data 必须是 Uint8Array */
  saveBinaryFile: (options) => ipcRenderer.invoke("file:saveBinary", options),
});
