import { faFileCirclePlus, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { App, Button } from "antd";
import { useCallback, useEffect, useRef } from "react";

import type { DocumentBase } from "@/types/document";
import { documentToJson, jsonToDocument } from "@/utils/jsonDocument";

import { DocNotFoundError, LoadDocumentError, SaveDocumentError } from "../errors";

import "./index.css";
import type { StorageMethodObject } from "../types";

const getApi = () => window.electronAPI;

/** 从绝对路径推断文档显示名（同时兼容 Windows 与 POSIX 分隔符）。 */
function fileNameOf(filePath: string): string {
  const segments = filePath.split(/[\\/]/u);
  return segments[segments.length - 1] || "未命名文档";
}

export default {
  name: "本机文件",
  enabled: Boolean(getApi()),
  icon: <FontAwesomeIcon icon={faFileCirclePlus} />,
  saveDocument: async (
    path: string[],
    content: DocumentBase,
  ): Promise<DocumentBase> => {
    const api = getApi();
    if (!api) throw new SaveDocumentError("当前环境不支持 Electron 文件接口");
    const filePath = path[0];
    if (!filePath) throw new SaveDocumentError("缺少文件路径");
    try {
      const payload = { ...content, name: fileNameOf(filePath) };
      await api.writeDocument(filePath, await documentToJson(payload));
      return payload;
    } catch (e) {
      throw new SaveDocumentError(
        `保存失败：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  },
  loadDocument: async (path: string[]): Promise<DocumentBase> => {
    const api = getApi();
    if (!api) throw new LoadDocumentError("当前环境不支持 Electron 文件接口");
    const filePath = path[0];
    if (!filePath) throw new DocNotFoundError("缺少文件路径");
    try {
      const text = await api.readDocument(filePath);
      const doc = await jsonToDocument(text);
      return { ...doc, name: fileNameOf(filePath) };
    } catch (e) {
      if (e instanceof LoadDocumentError) throw e;
      const message = e instanceof Error ? e.message : String(e);
      if (/ENOENT|no such file/iu.test(message))
        throw new DocNotFoundError("文件不存在", { cause: e });
      throw new LoadDocumentError(`读取失败：${message}`, { cause: e });
    }
  },
  ExplorerPage: ({ mode, onConfirm }) => {
    const didAutoPick = useRef(false);
    const onConfirmRef = useRef(onConfirm);
    const { message } = App.useApp();

    useEffect(() => {
      onConfirmRef.current = onConfirm;
    }, [onConfirm]);

    const pickFile = useCallback(async () => {
      const api = getApi();
      if (!api) return;
      try {
        if (mode === "open") {
          const result = await api.openDocument();
          if (result.canceled || !result.filePath) return;
          onConfirmRef.current(result.filePath);
        } else {
          const result = await api.chooseSavePath("演示文稿.csg");
          if (result.canceled || !result.filePath) return;
          onConfirmRef.current(result.filePath);
        }
      } catch (e) {
        console.error("Failed to pick file via native dialog", e);
        message.error("打开文件对话框失败");
      }
    }, [mode, message]);

    useEffect(() => {
      if (didAutoPick.current) return;
      didAutoPick.current = true;
      void pickFile();
    }, [pickFile]);

    return (
      <div className="storage-electron-explorer-page">
        <FontAwesomeIcon
          icon={mode === "open" ? faFolderOpen : faFileCirclePlus}
          className="storage-electron-explorer-icon"
        />
        <div className="storage-electron-explorer-hint">
          {mode === "open"
            ? "使用系统文件对话框选择要打开的文档。"
            : "使用系统文件对话框选择保存位置。"}
        </div>
        <Button type="primary" onClick={() => void pickFile()}>
          选择文件
        </Button>
      </div>
    );
  },
} satisfies StorageMethodObject;
