import { App } from "antd";
import { useCallback } from "react";

import { saveDocument } from "@/storage/index.client";
import { recordRecentlyOpened } from "@/utils/.client/indexedDB/recentlyOpened";

import { useEditorDoc, useEditorEvents } from "./editorContext";

export type SaveResult = "saved" | "cancelled" | "failed";

export type SaveOptions = {
  /** 强制弹出「另存为」对话框，即使当前文档已有路径 */
  saveAs?: boolean;
  /** 成功时是否弹出提示（关闭前保存时不打扰用户） */
  silent?: boolean;
};

/**
 * 保存当前文档。
 *
 * 桌面端不再让用户选「浏览器存储 / 本机文件」，而是直接落到磁盘：
 * 已有路径就原地覆盖，没有路径就弹原生「另存为」对话框。
 * 浏览器端仍走原来的资源管理器（只有在那里才有意义）。
 */
export function useSaveDocument() {
  const { doc, path, setPath, setModified } = useEditorDoc();
  const editorEvents = useEditorEvents();
  const { message } = App.useApp();

  return useCallback(
    async ({ saveAs = false, silent = false }: SaveOptions = {}) => {
      const api = window.electronAPI;
      // 桌面端只认本机文件路径；临时文档、旧浏览器存储路径都要重新选位置
      const canSaveInPlace =
        !saveAs &&
        path !== undefined &&
        (api === undefined || path[0] === "electron");
      let target: string[] | undefined = canSaveInPlace ? path : undefined;

      try {
        if (target === undefined) {
          // 浏览器端没有原生对话框，交给调用方回落到资源管理器
          if (!api) return "cancelled" as const;
          const result = await api.chooseSavePath(
            `${doc.name || "演示文稿"}.csg`,
          );
          if (result.canceled || !result.filePath) return "cancelled" as const;
          target = ["electron", result.filePath];
        }

        const saved = await saveDocument(target, doc);
        setPath(target);
        setModified(false);

        const nowUrl = new URL(window.location.href);
        nowUrl.searchParams.set(
          "file",
          target.map(encodeURIComponent).join("/"),
        );
        history.replaceState(undefined, "", nowUrl.href);

        recordRecentlyOpened(target, saved.name).catch((e) =>
          console.warn("Failed to record recently opened document", e),
        );
        editorEvents.emit("documentSaved", { path: target });
        if (!silent) message.success("已保存到本地");
        return "saved" as const;
      } catch (e) {
        console.error("Error when saving document.", e);
        message.error(
          `保存失败：${e instanceof Error ? e.message : String(e)}`,
        );
        return "failed" as const;
      }
    },
    [doc, path, setPath, setModified, editorEvents, message],
  );
}
