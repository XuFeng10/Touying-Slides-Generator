// 预加载脚本：在隔离上下文中把有限的原生能力暴露给渲染进程。
// 保持 CJS + sandbox，渲染进程无法直接接触 Node。
const { contextBridge, ipcRenderer, webUtils } = require("electron");

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

  /** 原生「插入图片」对话框，返回 { canceled, filePaths } */
  chooseImages: () => ipcRenderer.invoke("dialog:openImages"),

  /** 读取本机文件内容（用于 Markdown 中引用的图片路径），返回 Uint8Array */
  readLocalFile: (filePath) =>
    ipcRenderer.invoke("file:readBinary", { filePath }),

  /** 由主进程代取网络图片，规避渲染进程的跨域限制 */
  fetchRemoteFile: (url) => ipcRenderer.invoke("net:fetchBinary", { url }),

  /**
   * 拖入的 File 对象不带磁盘路径，这里取回真实路径，
   * 以便像 Typora 一样在 Markdown 里写绝对路径。取不到时返回空字符串。
   */
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch {
      return "";
    }
  },

  /** 告知主进程当前文档是否有未保存的修改，主进程据此决定是否拦截关闭 */
  setDocumentDirty: (dirty) =>
    ipcRenderer.send("app:setDocumentDirty", Boolean(dirty)),

  /** 有未保存修改时，主进程会在关闭窗口前通知渲染进程 */
  onBeforeClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:before-close", listener);
    return () => ipcRenderer.removeListener("app:before-close", listener);
  },

  /** 渲染进程确认可以关闭（保存完成或用户选择放弃） */
  confirmClose: () => ipcRenderer.send("app:closeResponse", "close"),
});
