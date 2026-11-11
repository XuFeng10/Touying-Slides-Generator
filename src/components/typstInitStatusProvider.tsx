import { App, Button } from "antd";
import { type FC, type ReactNode, useEffect, useState } from "react";

import useTemplateManager from "./templateManagerContext";
import { TypstInitStatusContext } from "./typstInitStatusContext";

/** 初始化通常在 1 秒内完成；超过这个时间才提示，避免每次打开都弹一下。 */
const SLOW_INIT_THRESHOLD_MS = 2000;

const TypstInitStatusProvider: FC<{
  children: ReactNode;
}> = ({ children }) => {
  const { compiler } = useTemplateManager();

  const [status, setStatus] = useState(compiler.typstInitStatus);

  const { notification } = App.useApp();

  useEffect(() => {
    const initKey = crypto.randomUUID();
    const mountTime = performance.now();
    let rafId: number | undefined = undefined;
    const loop = () => {
      const { typstInitStatus } = compiler;
      setStatus(typstInitStatus);
      const elapsed = performance.now() - mountTime;

      if (typstInitStatus === "pending") {
        rafId = requestAnimationFrame(loop);
        if (elapsed >= SLOW_INIT_THRESHOLD_MS)
          notification.info({
            key: initKey,
            placement: "bottomRight",
            title: "正在准备编辑器",
            description: "首次打开需要加载渲染组件，请稍候。",
            closable: false,
            duration: false,
            showProgress: true,
          });
      } else if (typstInitStatus === "rejected")
        notification.error({
          key: initKey,
          placement: "bottomRight",
          title: "编辑器初始化失败",
          description: "请重新加载应用重试。",
          closable: false,
          duration: false,
          actions: (
            <Button onClick={() => window.location.reload()} type="primary">
              重新加载
            </Button>
          ),
        });
      else notification.destroy(initKey);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      notification.destroy(initKey);
    };
  }, [compiler, notification]);

  return (
    <TypstInitStatusContext.Provider value={status}>
      {children}
    </TypstInitStatusContext.Provider>
  );
};

export default TypstInitStatusProvider;
