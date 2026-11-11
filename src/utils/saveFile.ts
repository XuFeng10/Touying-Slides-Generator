/**
 * 统一的「把文件交给用户」出口。
 *
 * - Electron：走原生保存对话框，用户能自己选目录，也不会有浏览器的下载气泡。
 * - 浏览器：回落到 <a download>，行为与改造前一致。
 */

export type SaveFileFilter = { name: string; extensions: string[] };

export type SaveFileOptions = {
  fileName: string;
  contents: Uint8Array | string;
  mime: string;
  filters?: SaveFileFilter[];
};

function toBytes(contents: Uint8Array | string): Uint8Array {
  return typeof contents === "string"
    ? new TextEncoder().encode(contents)
    : contents;
}

export async function saveFileToDisk({
  fileName,
  contents,
  mime,
  filters,
}: SaveFileOptions): Promise<boolean> {
  const bytes = toBytes(contents);

  const api = window.electronAPI;
  if (api) {
    const result = await api.saveBinaryFile({
      defaultFileName: fileName,
      data: bytes,
      filters,
    });
    return !result.canceled;
  }

  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
