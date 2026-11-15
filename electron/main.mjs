// Electron 主进程：把构建产物 build/client 以 app:// 协议托管给 Chromium。
// 使用自定义协议而不是 file://，是为了让页面处于 secure context：
// Cache Storage、WASM 多线程、跨源 fetch 才能正常工作。
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
} from "electron";

const APP_SCHEME = "app";
const APP_HOST = "local";
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

const RENDERER_ROOT = path.join(app.getAppPath(), "build", "client");
const PRELOAD_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "preload.cjs",
);
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".txt": "text/plain; charset=utf-8",
};

function mimeTypeOf(filePath) {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ??
    "application/octet-stream"
  );
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

/** 把 URL 路径解析成 build/client 里的真实文件，并处理 SPA 回退。 */
async function resolveRequestPath(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  let filePath = path.join(RENDERER_ROOT, relative);

  // 阻断 ../ 越界访问
  if (!filePath.startsWith(RENDERER_ROOT)) return undefined;

  if (relative === "" || relative.endsWith("/")) {
    const indexFile = path.join(filePath, "index.html");
    if (await isFile(indexFile)) return indexFile;
  } else if (await isFile(filePath)) {
    return filePath;
  } else {
    const indexFile = path.join(filePath, "index.html");
    if (await isFile(indexFile)) return indexFile;
  }

  // 带扩展名的静态资源（js/wasm/字体…）缺失就是真缺失，
  // 不要用 HTML 兜底，否则模块加载会报出莫名其妙的内容类型错误。
  const extension = path.extname(relative);
  if (extension && extension !== ".html") return undefined;

  for (const fallback of ["__spa-fallback.html", "404.html", "index.html"]) {
    const candidate = path.join(RENDERER_ROOT, fallback);
    if (await isFile(candidate)) return candidate;
  }
  return undefined;
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const filePath = await resolveRequestPath(pathname);
    if (!filePath) {
      return new Response("Not Found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    try {
      const body = await readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      const isHtml = extension === ".html" || extension === ".htm";
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": mimeTypeOf(filePath),
          "cache-control": isHtml
            ? "no-cache"
            : "public, max-age=3600, immutable",
        },
      });
    } catch (error) {
      return new Response(`Failed to read ${pathname}: ${String(error)}`, {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  });
}

/**
 * 只放行应用真正需要的权限；其余（摄像头、串口、本机字体等）一律拒绝。
 * 字体已随应用打包，不需要 localFonts。
 */
const ALLOWED_PERMISSIONS = new Set([
  "clipboard-read",
  "clipboard-sanitized-write",
  "fullscreen",
]);

function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission));
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => ALLOWED_PERMISSIONS.has(permission),
  );
}

/** 窗口关闭保护：渲染进程同步过来的脏状态，以及本次关闭是否已被用户确认 */
const windowState = {
  documentDirty: false,
  approved: false,
};

function createWindow() {
  // 关闭保护状态：文档被改过时先问渲染进程，避免无提示丢内容
  windowState.documentDirty = false;
  windowState.approved = false;

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#f5f5f5",
    title: "Touying Slides Generator",
    icon: path.join(import.meta.dirname, "build", "icon.png"),
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  win.on("close", (event) => {
    if (windowState.approved || !windowState.documentDirty) return;
    // 有未保存修改：拦下这次关闭，让渲染进程弹「保存 / 放弃 / 取消」
    event.preventDefault();
    win.webContents.send("app:before-close");
  });

  // 渲染进程崩溃时没法回答询问，直接放行，避免窗口永远关不掉
  win.webContents.on("render-process-gone", () => {
    windowState.documentDirty = false;
  });

  win.on("closed", () => {
    windowState.documentDirty = false;
    windowState.approved = false;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//u.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const allowed =
      url.startsWith(`${APP_ORIGIN}/`) ||
      (DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : false);
    if (allowed) return;
    event.preventDefault();
    if (/^https?:\/\//u.test(url)) void shell.openExternal(url);
  });

  if (DEV_SERVER_URL) void win.loadURL(DEV_SERVER_URL);
  else void win.loadURL(`${APP_ORIGIN}/`);

  return win;
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新加载" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" },
        ...(DEV_SERVER_URL || !app.isPackaged
          ? [{ role: "toggleDevTools", label: "开发者工具" }]
          : []),
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "项目信息",
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: "关于",
              message: "Touying Slides Generator",
              detail: `版本 ${app.getVersion()}\n在本地用 Typst 将 Markdown 渲染为 touying 演示文稿。\n\n本程序基于上游项目派生，遵循 AGPL-3.0 许可证。`,
              buttons: ["好"],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const DOCUMENT_FILTERS = [
  { name: "演示文稿文档", extensions: ["csg", "json"] },
  { name: "所有文件", extensions: ["*"] },
];

const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "bmp",
  "avif",
];

/** 单张图片的大小上限，避免误拖一个巨大文件把内存吃满。 */
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;

function normalizeDialogPath(value) {
  return typeof value === "string" && path.isAbsolute(value) ? value : undefined;
}

function registerIpcHandlers() {
  ipcMain.handle("app:getInfo", () => ({
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  }));

  // 渲染进程同步「是否有未保存修改」，用于决定关闭窗口时是否拦一下
  ipcMain.on("app:setDocumentDirty", (event, dirty) => {
    if (!BrowserWindow.fromWebContents(event.sender)) return;
    windowState.documentDirty = Boolean(dirty);
  });

  // 用户在提醒对话框里选了「保存并退出」或「放弃更改并退出」
  ipcMain.on("app:closeResponse", (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || action !== "close") return;
    windowState.approved = true;
    // destroy 跳过 beforeunload，避免渲染进程的离开确认再拦一次
    win.destroy();
  });

  ipcMain.handle("document:open", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: "打开文档",
      properties: ["openFile"],
      filters: DOCUMENT_FILTERS,
    });
    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) return { canceled: true };
    const content = await readFile(filePath, "utf-8");
    return { canceled: false, filePath, content };
  });

  ipcMain.handle("document:saveAs", async (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const suggestion =
      typeof payload?.defaultFileName === "string"
        ? payload.defaultFileName
        : "演示文稿.csg";
    const result = await dialog.showSaveDialog(win, {
      title: "保存文档",
      defaultPath: suggestion,
      filters: DOCUMENT_FILTERS,
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle("document:read", async (_event, payload) => {
    const filePath = normalizeDialogPath(payload?.filePath);
    if (!filePath) throw new Error("无效的文件路径");
    return await readFile(filePath, "utf-8");
  });

  ipcMain.handle("document:write", async (_event, payload) => {
    const filePath = normalizeDialogPath(payload?.filePath);
    if (!filePath) throw new Error("无效的文件路径");
    if (typeof payload?.content !== "string") throw new Error("无效的文件内容");
    await writeFile(filePath, payload.content, "utf-8");
    return { canceled: false, filePath };
  });

  // 导出 PDF / Typst 源码压缩包等二进制结果
  ipcMain.handle("file:saveBinary", async (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const data = payload?.data;
    if (!(data instanceof Uint8Array)) throw new Error("无效的导出数据");
    const result = await dialog.showSaveDialog(win, {
      title: "导出文件",
      defaultPath:
        typeof payload?.defaultFileName === "string"
          ? payload.defaultFileName
          : "export.bin",
      filters: Array.isArray(payload?.filters) ? payload.filters : undefined,
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await writeFile(result.filePath, data);
    return { canceled: false, filePath: result.filePath };
  });

  // 选择要插入的图片，返回磁盘上的绝对路径（Markdown 里直接引用这些路径）
  ipcMain.handle("dialog:openImages", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: "插入图片",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "图片", extensions: IMAGE_EXTENSIONS }],
    });
    if (result.canceled) return { canceled: true, filePaths: [] };
    return { canceled: false, filePaths: result.filePaths };
  });

  // 读取本机图片文件（Markdown 里写的是绝对路径）
  ipcMain.handle("file:readBinary", async (_event, payload) => {
    const filePath = normalizeDialogPath(payload?.filePath);
    if (!filePath) throw new Error("无效的图片路径");
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("目标不是文件");
    if (info.size > MAX_IMAGE_BYTES) throw new Error("图片文件过大");
    return await readFile(filePath);
  });

  // 由主进程代取网络图片：渲染进程处于 app:// 源，直接请求会受跨域限制
  ipcMain.handle("net:fetchBinary", async (_event, payload) => {
    const url = typeof payload?.url === "string" ? payload.url : "";
    if (!/^https?:\/\//i.test(url)) throw new Error("无效的图片地址");
    const response = await net.fetch(url);
    if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("图片文件过大");
    return buffer;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        codeCache: true,
      },
    },
  ]);

  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    configurePermissions();
    registerIpcHandlers();
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
