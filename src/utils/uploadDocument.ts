import type { NavigateFunction } from "react-router";

import { navigateToEditorWithDoc } from "@/router/editor/navigationState";
import { toImmerContent } from "@/utils/contestDataUtils";
import { jsonToDocument } from "@/utils/jsonDocument";

type UploadDocumentOptions = {
  navigate: NavigateFunction;
  beforeOpen?: () => boolean | Promise<boolean>;
  onError?: (error: unknown) => void;
};

/** 从绝对路径取显示名：去掉目录和文档扩展名。 */
function fileNameOf(filePath: string): string {
  const segments = filePath.split(/[\\/]/u);
  const base = segments[segments.length - 1] || "未命名文档";
  return base.replace(/\.[^/.]+$/, "") || base;
}

export async function uploadDocumentFromFile({
  navigate,
  beforeOpen,
  onError,
}: UploadDocumentOptions) {
  const canOpen = await Promise.resolve(beforeOpen?.() ?? true);
  if (!canOpen) return;

  // 桌面端走原生对话框，顺便记住真实磁盘路径，之后 Ctrl+S 才能原地覆盖
  const api = window.electronAPI;
  if (api) {
    try {
      const result = await api.openDocument();
      if (result.canceled || !result.filePath || result.content === undefined)
        return;
      const loadedDoc = await jsonToDocument(result.content);
      loadedDoc.name = fileNameOf(result.filePath);
      navigateToEditorWithDoc(
        navigate,
        { ...loadedDoc, content: toImmerContent(loadedDoc.content) },
        ["electron", result.filePath],
      );
    } catch (e) {
      if (onError) onError(e);
      else console.error("Error when opening document via native dialog.", e);
    }
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csg,.json,application/json";
  input.addEventListener(
    "change",
    async () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      try {
        const text = await file.text();
        const loadedDoc = await jsonToDocument(text);
        loadedDoc.name = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        navigateToEditorWithDoc(
          navigate,
          { ...loadedDoc, content: toImmerContent(loadedDoc.content) },
          ["tmp", crypto.randomUUID()],
        );
      } catch (e) {
        if (onError) {
          onError(e);
        } else {
          console.error("Error when loading document from uploaded file.", e);
        }
      }
    },
    { once: true },
  );
  input.click();
}
