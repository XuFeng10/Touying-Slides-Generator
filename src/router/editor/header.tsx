import { faAngleLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { App } from "antd";
import { useCallback, useEffect, useMemo, type FC } from "react";
import { useNavigate } from "react-router";

import ExplorerModal from "@/components/ExplorerModal";
import MenuBar, { type MenuGroup } from "@/components/menuBar";
import { useModal } from "@/components/modalWrapper";
import useTemplateManager from "@/components/templateManagerContext";
import useTypstInitStatus from "@/components/typstInitStatusContext";
import { VersionInfoModal } from "@/components/VersionInfoModal";
import { saveDocument } from "@/storage/index.client";
import { recordRecentlyOpened } from "@/utils/.client/indexedDB/recentlyOpened";
import { toImmerContent } from "@/utils/contestDataUtils";
import { removeImmer } from "@/utils/documentZod";
import { documentToJson } from "@/utils/jsonDocument";
import { createDefaultDocument } from "@/utils/newDocument";
import { saveFileToDisk } from "@/utils/saveFile";
import { uploadDocumentFromFile } from "@/utils/uploadDocument";

import { useEditorDoc, useEditorEvents } from "./editorContext";

import "./header.css";

const ContestEditorHeader: FC = () => {
  const { doc, path, modified, setModified, setPath, updateDoc } =
    useEditorDoc();
  const editorEvents = useEditorEvents();
  const { notification, message, modal } = App.useApp();
  const { compiler } = useTemplateManager();
  const navigate = useNavigate();

  const [explorer, explorerContextHolder] = useModal(ExplorerModal);

  const typstInitStatus = useTypstInitStatus();

  const onClickExportPDF = useCallback(async () => {
    try {
      const data = await compiler.compileToPdf(doc.content);
      if (!data) throw new Error("编译器未返回任何数据");
      const saved = await saveFileToDisk({
        fileName: `${doc.name}.pdf`,
        contents: data,
        mime: "application/pdf",
        filters: [{ name: "PDF 文档", extensions: ["pdf"] }],
      });
      if (saved) message.success("PDF 导出成功");
    } catch (e) {
      console.error("Error when exporting PDF.", e);
      notification.error({
        title: "导出失败",
        placement: "bottomRight",
        description: (
          <>
            <div>{e instanceof Error ? e.message : String(e)}</div>
            <div>请检查 Markdown 内容，或稍后重试。</div>
          </>
        ),
        duration: 5,
        showProgress: true,
        pauseOnHover: true,
      });
    }
  }, [compiler, doc.content, doc.name, notification, message]);

  const onClickExportTypstSource = useCallback(async () => {
    try {
      const data = await compiler.exportTypstSourceZip(doc.content);
      if (!data) throw new Error("Compiler did not return any data.");
      const saved = await saveFileToDisk({
        fileName: `${doc.name}-source.zip`,
        contents: new Uint8Array(data),
        mime: "application/zip",
        filters: [{ name: "ZIP 压缩包", extensions: ["zip"] }],
      });
      if (saved) message.success("Typst 源代码导出成功");
    } catch (e) {
      message.error("Typst 源代码导出失败");
      console.error("Error when exporting Typst source zip.", e);
    }
  }, [compiler, doc.name, doc.content, message]);

  const confirmDiscardUnsavedChanges = useCallback(async () => {
    if (!modified) return true;
    return await modal.confirm({
      content: (
        <>
          你确定要继续吗？
          <br />
          未保存的更改将会丢失。
        </>
      ),
      mask: {
        closable: true,
      },
    });
  }, [modal, modified]);

  const onClickSaveAs = useCallback(() => {
    explorer
      .show({
        mode: "save",
        doc,
      })
      .then((data) => {
        if (data.state === "success") {
          setPath(data.path);
          updateDoc({
            ...data.doc,
            content: toImmerContent(data.doc.content),
          });
          const nowUrl = new URL(window.location.href);
          nowUrl.searchParams.set(
            "file",
            data.path.map(encodeURIComponent).join("/"),
          );
          history.replaceState(undefined, "", new URL(nowUrl).href);
          recordRecentlyOpened(data.path, data.doc.name).catch((e) =>
            console.warn("Failed to record recently opened document", e),
          );
          editorEvents.emit("documentSaved", { path: data.path });
        }
      });
  }, [explorer, setPath, updateDoc, doc, editorEvents]);

  const onClickSave = useCallback(async () => {
    if (!path) {
      onClickSaveAs();
      return;
    }
    try {
      await saveDocument(path, doc);
      setModified(false);
      editorEvents.emit("documentSaved", { path });
    } catch (e) {
      console.error("Error when saving document.", e);
      message.error("保存失败");
    }
  }, [doc, path, message, setModified, onClickSaveAs, editorEvents]);

  const onClickUpload = useCallback(async () => {
    await uploadDocumentFromFile({
      navigate,
      beforeOpen: confirmDiscardUnsavedChanges,
      onError: (e) => {
        console.error("Error when loading document from uploaded file.", e);
        message.error("文件加载失败");
      },
    });
  }, [message, confirmDiscardUnsavedChanges, navigate]);

  const onClickDownload = useCallback(async () => {
    const json = await documentToJson(removeImmer(doc));
    const saved = await saveFileToDisk({
      fileName: `${doc.name}.json`,
      contents: json,
      mime: "application/json",
      filters: [{ name: "JSON 文件", extensions: ["json"] }],
    });
    if (saved) message.success("文档已保存到本地");
  }, [doc, message]);

  const onClickNew = useCallback(async () => {
    if (!(await confirmDiscardUnsavedChanges())) return;
    try {
      await createDefaultDocument(navigate);
    } catch (e) {
      console.error("Failed to create new document", e);
      message.error("新建文档失败");
    }
  }, [confirmDiscardUnsavedChanges, message, navigate]);

  const [versionInfo, versionInfoContextHolder] = useModal(VersionInfoModal);
  const menuGroup = useMemo(
    (): MenuGroup[] => [
      {
        key: "home",
        label: (
          <>
            <FontAwesomeIcon icon={faAngleLeft} />
            主页
          </>
        ),
        onSelect: () => navigate("/"),
      },
      {
        key: "file",
        label: "文件",
        items: [
          {
            key: "new",
            label: "新建",
            onSelect: onClickNew,
          },
          {
            key: "upload",
            label: "从本地上传",
            onSelect: onClickUpload,
            shortcut: "Ctrl+O",
          },
          {
            key: "save",
            label: "保存",
            onSelect: onClickSave,
            shortcut: "Ctrl+S",
          },
          {
            key: "saveAs",
            label: "另存为",
            onSelect: onClickSaveAs,
            shortcut: "Ctrl+Shift+S",
          },
          {
            key: "download",
            label: "下载到本地",
            onSelect: onClickDownload,
          },
          {
            key: "export PDF",
            label: "导出 PDF",
            onSelect: onClickExportPDF,
            disabled: typstInitStatus !== "fulfilled",
            shortcut: "Ctrl+Shift+P",
          },
          {
            key: "export typst source",
            label: "导出 Typst 源代码",
            onSelect: onClickExportTypstSource,
            disabled: typstInitStatus !== "fulfilled",
          },
        ],
      },
      {
        key: "help",
        label: "帮助",
        items: [
          {
            key: "about",
            label: "关于",
            onSelect: () => versionInfo.show(),
          },
        ],
      },
    ],
    [
      navigate,
      onClickExportPDF,
      onClickExportTypstSource,
      typstInitStatus,
      versionInfo,
      onClickSave,
      onClickSaveAs,
      onClickDownload,
      onClickUpload,
      onClickNew,
    ],
  );
  useEffect(() => {
    document.title = `${modified ? "● " : ""}${doc.name} - Touying Slides Generator`;
  });
  return (
    <header>
      <div>
        <MenuBar menuGroup={menuGroup} />
      </div>
      <div className="title">
        <div className="file-name">{doc.name}</div>
        {modified && <div className="modified-indicator">●</div>}
      </div>
      {versionInfoContextHolder}
      {explorerContextHolder}
    </header>
  );
};

export default ContestEditorHeader;
