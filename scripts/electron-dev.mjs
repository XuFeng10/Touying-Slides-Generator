// 开发模式启动器：先起 React Router 的 dev server，就绪后再拉起 Electron。
// 生产模式不需要它 —— 主进程直接加载 app:// 下的构建产物。
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import electronPath from "electron";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4481;
// Windows 上 Vite 常把 localhost 解析到 ::1，两个都探一遍更稳
const HOSTS = ["localhost", "127.0.0.1"];
const READY_TIMEOUT_MS = 180_000;

/** Electron 的 npm 包是「路径字符串」的默认导出，但要防一手 CJS 互操作差异。 */
const electronBinary =
  typeof electronPath === "string" ? electronPath : electronPath.default;

function tryConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function waitForServer(hosts, port, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      for (const host of hosts) if (await tryConnect(host, port)) return resolve(host);
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`等待 dev server（端口 ${port}）超时`));
        return;
      }
      setTimeout(() => void attempt(), 300);
    };
    void attempt();
  });
}

function spawnProcess(command, args, { shell = false, ...options } = {}) {
  const env = { ...process.env, ...options.env };
  // 某些环境（含 CI / 部分 IDE 插件）会预设该变量，
  // 它会让 electron 以纯 Node 模式启动、开不出窗口。
  delete env.ELECTRON_RUN_AS_NODE;
  return spawn(command, args, {
    stdio: "inherit",
    ...options,
    // 只有 corepack（无 .exe 后缀的启动器）需要 shell；
    // electron 的路径里带空格，走 shell 会被切断。
    shell,
    env,
  });
}

let shuttingDown = false;
let devServer;
let electron;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electron && !electron.killed) electron.kill();
  if (devServer && !devServer.killed) devServer.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

devServer = spawnProcess("corepack", ["pnpm", "run", "dev"], {
  cwd: ROOT,
  shell: process.platform === "win32",
});

devServer.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(`dev server 退出（code ${code}）`);
    shutdown(code ?? 1);
  }
});

let readyHost;
try {
  readyHost = await waitForServer(HOSTS, PORT, READY_TIMEOUT_MS);
} catch (error) {
  console.error(String(error));
  shutdown(1);
}

console.log(`dev server ready: http://${readyHost}:${PORT}，启动 Electron…`);

electron = spawnProcess(electronBinary, [ROOT], {
  cwd: ROOT,
  env: { ELECTRON_RENDERER_URL: `http://${readyHost}:${PORT}` },
});

electron.on("exit", (code) => shutdown(code ?? 0));
