import { version as APP_VERSION } from "/package.json";
import { Button, Modal } from "antd";

import { createModal } from "./modalWrapper";

import "./VersionInfoModal.css";

export const VersionInfoModal = createModal(({ modalHandler }) => {
  return (
    <Modal
      title="关于"
      open={modalHandler.visible}
      onCancel={modalHandler.resolveHide}
      afterClose={modalHandler.remove}
      footer={
        <Button type="primary" onClick={modalHandler.resolveHide}>
          确定
        </Button>
      }
      width={600}
    >
      <div className="version-info-layout">
        <img src="/favicon.png" alt="icon" className="version-info-icon" />
        <div className="version-info-details">
          <strong>Touying Slides Generator</strong>
          <div>
            基于 CNOI Statement Generator 精简而来，仅保留 touying 演示文稿模板。
          </div>
          <div>上游项目按 AGPL 3.0 许可证发布，本派生作品同样适用。</div>
          <br />
          <div>
            <strong>版本：</strong>
            {APP_VERSION}
          </div>
          <div>
            <strong>提交 ID：</strong>
            {GIT_COMMIT_INFO + (import.meta.env.DEV ? " (dev)" : "")}
          </div>
          <div>
            <strong>构建时间：</strong>
            {BUILD_TIME}
          </div>
          <br />
          <div>
            <strong>运行环境：</strong>
            {navigator.userAgent}
          </div>
          <div>
            <strong>语言：</strong>
            {navigator.language}
          </div>
        </div>
      </div>
    </Modal>
  );
});
