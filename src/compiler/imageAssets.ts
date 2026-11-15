/**
 * Markdown 里图片地址的解析与读取。
 *
 * 支持三种写法：
 * - `asset://<uuid>`：旧版文档里的内嵌图片（读取前一版数据格式时仍会遇到）
 * - 本机绝对路径：`E:\pics\a.png`、`E:/pics/a.png`、`file:///E:/pics/a.png`
 * - 网络地址：`https://cdn.example.com/a.png`
 */
import { isAxiosError } from "axios";

import axiosInstance from "@/utils/axiosInstance";

const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/;
const UNC_RE = /^\\\\/;
const POSIX_RE = /^\//;
const REMOTE_RE = /^https?:\/\//i;

/** 把 Markdown 里的图片地址解析成本机绝对路径；不是本地文件时返回 undefined。 */
export function toLocalPath(url: string): string | undefined {
  const target = url.trim();
  if (target.startsWith("file://")) {
    let filePath = target.slice("file://".length);
    try {
      filePath = decodeURI(filePath);
    } catch {
      // 保持原样即可
    }
    // file:///E:/x.png → /E:/x.png
    if (/^\/[a-zA-Z]:/.test(filePath)) filePath = filePath.slice(1);
    return filePath;
  }
  if (WINDOWS_DRIVE_RE.test(target) || UNC_RE.test(target) || POSIX_RE.test(target))
    return target;
  return undefined;
}

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
}

async function readLocalFile(filePath: string): Promise<ArrayBuffer> {
  const api = window.electronAPI;
  if (!api) {
    throw new Error(
      `无法读取本地图片「${filePath}」：浏览器版拿不到磁盘文件，请改用网络图片地址。`,
    );
  }
  try {
    return toArrayBuffer(await api.readLocalFile(filePath));
  } catch (e) {
    console.error("Failed to read local image.", filePath, e);
    throw new Error(`无法读取本地图片「${filePath}」，请检查文件是否还存在。`);
  }
}

async function readRemoteFile(url: string): Promise<ArrayBuffer> {
  const api = window.electronAPI;
  // 桌面版由主进程代取：页面处于 app:// 源，直接请求一般会被跨域拦下。
  if (api) {
    try {
      return toArrayBuffer(await api.fetchRemoteFile(url));
    } catch (e) {
      console.error("Failed to download image via main process.", url, e);
      throw new Error(`下载网络图片失败「${url}」，请检查网络连接或地址是否有效。`);
    }
  }
  try {
    const response = await axiosInstance.get<ArrayBuffer>(url);
    return response.data;
  } catch (e) {
    if (isAxiosError(e)) {
      console.error("Failed to download image.", e);
      throw new Error(
        `下载网络图片失败「${url}」：可能是网络不通，或该站点不允许跨域引用。`,
      );
    }
    throw e;
  }
}

/** 读取任意图片地址对应的字节内容，供 Typst 编译时嵌入。 */
export async function readImageBytes(url: string): Promise<ArrayBuffer> {
  const localPath = toLocalPath(url);
  if (localPath) return await readLocalFile(localPath);
  if (REMOTE_RE.test(url)) return await readRemoteFile(url);
  // data: / blob: / 与应用同源的相对路径
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法读取图片「${url}」`);
  return await response.arrayBuffer();
}
