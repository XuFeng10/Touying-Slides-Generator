import favicon from "/favicon.png";
import {
  faBookOpen,
  faFolderOpen,
  faInfo,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { App, Button } from "antd";
import { useCallback, useState, type FC } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { clientOnly$ } from "vite-env-only/macros";

import { useModal } from "@/components/modalWrapper";
import SyntaxGuide from "@/components/SyntaxGuide";
import { VersionInfoModal } from "@/components/VersionInfoModal";
import { createDefaultDocument } from "@/utils/newDocument";
import { uploadDocumentFromFile } from "@/utils/uploadDocument";

import DocumentGrid from "./documentGrid";

import "./index.css";

const Root: FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const [guideOpen, setGuideOpen] = useState(() => searchParams.has("guide"));

  const [versionInfo, versionInfoContextHolder] = useModal(VersionInfoModal);

  const onClickNew = useCallback(async () => {
    try {
      await createDefaultDocument(navigate);
    } catch (e) {
      console.error("Failed to create new document", e);
      message.error("新建文档失败");
    }
  }, [message, navigate]);

  return (
    <>
      <div className="root-layout">
        <aside className="root-sidebar">
          <div className="root-sidebar-brand">
            <img src={favicon} alt="Favicon" className="favicon" />
            <div>
              <h1 className="app-title">Touying Slides Generator</h1>
              <p className="root-sidebar-subtitle">Markdown → Typst 演示文稿</p>
            </div>
          </div>

          <div className="root-sidebar-actions">
            <Button
              type="primary"
              block
              icon={<FontAwesomeIcon icon={faPlus} />}
              onClick={onClickNew}
            >
              新建文档
            </Button>
            <Button
              block
              icon={<FontAwesomeIcon icon={faFolderOpen} />}
              onClick={() =>
                uploadDocumentFromFile({
                  navigate,
                  onError: (e) => {
                    console.error(
                      "Error when loading document from uploaded file.",
                      e,
                    );
                    message.error("文件打开失败");
                  },
                })
              }
            >
              打开文档
            </Button>
          </div>

          <div className="root-sidebar-footer">
            <Button
              block
              type="text"
              icon={<FontAwesomeIcon icon={faBookOpen} />}
              onClick={() => setGuideOpen(true)}
            >
              语法说明
            </Button>
            <Button
              block
              type="text"
              icon={<FontAwesomeIcon icon={faInfo} />}
              onClick={() => versionInfo.show()}
            >
              关于
            </Button>
          </div>
        </aside>

        <div className="root-content">
          <h2 className="root-content-title">最近打开</h2>
          {clientOnly$(<DocumentGrid />)}
        </div>
      </div>
      {versionInfoContextHolder}
      <SyntaxGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
};

export default Root;
