import { Button, Modal } from "antd";
import { useCallback, useEffect, useRef, useState, type FC } from "react";

import { useEditorDoc } from "./editorContext";
import { useSaveDocument } from "./useSaveDocument";

/**
 * 桌面端关闭窗口时的未保存提醒。
 *
 * 主进程在窗口 close 事件里发现文档被改过，就会先问渲染进程；
 * 这里弹一个三选一的对话框：保存并退出 / 放弃更改退出 / 取消。
 * 浏览器端 `window.electronAPI` 不存在，本组件不产生任何界面。
 */
const DesktopCloseGuard: FC = () => {
  const { doc, modified, setModified } = useEditorDoc();
  const saveCurrent = useSaveDocument();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);

  // 把「是否有未保存修改」同步给主进程，主进程据此决定要不要拦截关闭
  useEffect(() => {
    window.electronAPI?.setDocumentDirty(modified);
  }, [modified]);
  useEffect(() => {
    const api = window.electronAPI;
    return () => api?.setDocumentDirty(false);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    return api.onBeforeClose(() => {
      if (busyRef.current) return;
      setOpen(true);
    });
  }, []);

  const closeWindow = useCallback(() => {
    window.electronAPI?.confirmClose();
  }, []);

  const handleCancel = useCallback(() => setOpen(false), []);

  const handleDiscard = useCallback(() => {
    setOpen(false);
    closeWindow();
  }, [closeWindow]);

  const handleSaveAndClose = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    try {
      const result = await saveCurrent({ silent: true });
      if (result === "saved") {
        setOpen(false);
        setModified(false);
        closeWindow();
      }
      // cancelled：用户在「另存为」对话框里点了取消，留在应用里继续编辑
      // failed：保存出错，提示已经由 saveCurrent 弹出
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }, [saveCurrent, setModified, closeWindow]);

  return (
    <Modal
      open={open}
      title="文档尚未保存"
      onCancel={handleCancel}
      maskClosable={false}
      keyboard={!saving}
      closable={!saving}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={saving}>
          取消
        </Button>,
        <Button key="discard" danger onClick={handleDiscard} disabled={saving}>
          放弃更改并退出
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={saving}
          onClick={() => void handleSaveAndClose()}
        >
          保存并退出
        </Button>,
      ]}
    >
      <p>
        文档「<strong>{doc.name}</strong>」还有未保存的更改。
      </p>
      <p>直接退出会丢失这些修改，是否先保存到本地？</p>
    </Modal>
  );
};

export default DesktopCloseGuard;
