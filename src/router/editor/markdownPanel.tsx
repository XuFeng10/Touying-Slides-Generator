import {
  markdown as markdownExtension,
  markdownLanguage,
} from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { faImage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import CodeMirror from "@uiw/react-codemirror";
import { App, Button, Tooltip } from "antd";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FC,
  type SetStateAction,
} from "react";

import "./markdownPanel.css";

export type InsertedImage = { uuid: string; name: string };

const ACCEPT_IMAGE_TYPES =
  ".png,.jpg,.jpeg,.gif,.svg,.webp,.bmp,.avif,image/png,image/jpeg,image/gif,image/svg+xml,image/webp";

const IMAGE_NAME_RE = /\.(?:png|jpe?g|gif|svg|webp|bmp|avif|ico)$/i;

/** 路径里出现空格或括号时必须用尖括号包住，否则 Markdown 解析不出来。 */
const NEEDS_ANGLE_BRACKET = /[\s()]/;

/**
 * 判断是否为图片。不能只看 MIME：从资源管理器拖入的文件（尤其是桌面端）
 * 常常拿不到 `type`，此时退回用扩展名判断。
 */
const isImageFile = (file: File) =>
  file.type.startsWith("image/") || IMAGE_NAME_RE.test(file.name);

const altFromName = (name: string) =>
  name.replace(/^.*[\\/]/, "").replace(/\.[^./\\]+$/, "") || "图片";

/** 生成一段可直接插入的 Markdown：本地路径原样引用，和 Typora 一致。 */
function toImageMarkdown(alt: string, target: string) {
  const destination = NEEDS_ANGLE_BRACKET.test(target) ? `<${target}>` : target;
  return `![${alt || "图片"}](${destination})`;
}

const MarkdownPanel: FC<{
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  /**
   * 浏览器版拿不到磁盘路径时的兜底：把图片存进文档，返回 `asset://` 标识。
   */
  onAddImages?: (files: File[]) => InsertedImage[];
}> = ({ code, setCode, onAddImages }) => {
  const { message } = App.useApp();
  const viewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const insertSnippet = useCallback(
    (view: EditorView, snippets: string[], position?: number) => {
      if (snippets.length === 0) return;
      const text = snippets.join("\n");
      const at = position ?? view.state.selection.main.head;
      view.dispatch({
        changes: { from: at, insert: text },
        selection: { anchor: at + text.length },
        scrollIntoView: true,
      });
      view.focus();
      message.success(
        snippets.length === 1 ? "已插入 1 张图片" : `已插入 ${snippets.length} 张图片`,
      );
    },
    [message],
  );

  const insertImages = useCallback(
    (view: EditorView, files: File[], position?: number) => {
      const imageFiles = files.filter(isImageFile);
      if (imageFiles.length === 0) return;

      const api = window.electronAPI;
      const snippets: string[] = [];
      const fallbackFiles: File[] = [];

      for (const file of imageFiles) {
        // 桌面端能拿到真实磁盘路径，直接写进 Markdown；
        // 浏览器版只能把图片存进文档，用 asset:// 引用。
        const filePath = api?.getPathForFile(file) ?? "";
        if (filePath) snippets.push(toImageMarkdown(altFromName(file.name), filePath));
        else fallbackFiles.push(file);
      }

      if (fallbackFiles.length > 0) {
        if (!onAddImages) {
          message.error("当前环境无法读取本地图片，请改用网络图片地址");
          if (snippets.length === 0) return;
        } else {
          for (const image of onAddImages(fallbackFiles))
            snippets.push(toImageMarkdown(image.name, `asset://${image.uuid}`));
        }
      }

      insertSnippet(view, snippets, position);
    },
    [insertSnippet, message, onAddImages],
  );

  const extensions = useMemo(
    () => [
      EditorView.lineWrapping,
      EditorView.theme({
        "&.cm-focused": { outline: "none" },
        "&.cm-editor": { height: "100%" },
        ".cm-scroller": {
          "z-index": "2",
          "overflow-anchor": "none",
        },
      }),
      markdownExtension({
        base: markdownLanguage,
        extensions: [{ remove: ["HTMLBlock", "HTMLTag"] }],
        completeHTMLTags: false,
      }),
      // 拖入 / 粘贴图片文件时，接管默认行为并插入 Markdown
      EditorView.domEventHandlers({
        drop(event, view) {
          const files = [...(event.dataTransfer?.files ?? [])].filter(
            isImageFile,
          );
          if (files.length === 0) return false;
          event.preventDefault();
          const position =
            view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
            view.state.selection.main.head;
          insertImages(view, files, position);
          return true;
        },
        paste(event, view) {
          const files = [...(event.clipboardData?.files ?? [])].filter(
            isImageFile,
          );
          if (files.length === 0) return false;
          event.preventDefault();
          insertImages(view, files, view.state.selection.main.head);
          return true;
        },
      }),
    ],
    [insertImages],
  );

  const hasFileDrag = (event: React.DragEvent) =>
    [...(event.dataTransfer?.types ?? [])].includes("Files");

  const pickImages = async () => {
    const view = viewRef.current;
    if (!view) return;
    const api = window.electronAPI;
    if (!api) {
      fileInputRef.current?.click();
      return;
    }
    const result = await api.chooseImages();
    if (result.canceled) return;
    insertSnippet(
      view,
      result.filePaths.map((filePath) =>
        toImageMarkdown(altFromName(filePath), filePath),
      ),
    );
  };

  return (
    <div
      className="contest-editor-markdown-wrapper"
      onDragOver={(event) => {
        if (!hasFileDrag(event)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        setDragging(false);
        // CodeMirror 内部已处理（会调用 preventDefault），这里不再重复插入；
        // 落在按钮等非编辑区时走兜底，光标位置即插入位置。
        if (event.defaultPrevented) return;
        const files = [...(event.dataTransfer?.files ?? [])].filter(isImageFile);
        if (files.length === 0) return;
        event.preventDefault();
        const view = viewRef.current;
        if (view) insertImages(view, files);
      }}
    >
      <CodeMirror
        className="contest-editor-markdown-panel"
        extensions={extensions}
        value={code}
        onChange={(x) => setCode(x)}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
      />
      <Tooltip title="插入图片：把图片拖进来，或点这里选择文件（插入的是本地路径）">
        <Button
          className="markdown-panel-image-button"
          type="text"
          size="small"
          icon={<FontAwesomeIcon icon={faImage} />}
          onClick={pickImages}
        >
          图片
        </Button>
      </Tooltip>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGE_TYPES}
        multiple
        hidden
        onChange={(event) => {
          const view = viewRef.current;
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (view) insertImages(view, files);
        }}
      />
      {dragging && (
        <div className="markdown-panel-drop-hint">
          <FontAwesomeIcon icon={faImage} size="2x" />
          <span>松开即可插入图片路径</span>
        </div>
      )}
    </div>
  );
};

export default MarkdownPanel;
