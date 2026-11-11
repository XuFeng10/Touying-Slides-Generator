import { App, Button } from "antd";
import { useEffect, type FC } from "react";

const eventTarget = new EventTarget();
let unresolvedCnt = 0;

export const requestUserAction = () =>
  new Promise<void>((resolve) => {
    ++unresolvedCnt;
    const f = () => {
      --unresolvedCnt;
      resolve();
    };
    eventTarget.addEventListener("userAction", f, {
      once: true,
    });
    eventTarget.dispatchEvent(new Event("requestUserAction"));
  });

const RequestUserActionHolder: FC = () => {
  const { notification } = App.useApp();
  useEffect(() => {
    let key: string | undefined = undefined;
    let disposed = false;
    const h = () => {
      const resolve = () => {
        if (key) notification.destroy(key);
        eventTarget.dispatchEvent(new Event("userAction"));
      };
      if (window.navigator.userActivation?.isActive) {
        resolve();
        return;
      }
      if (key) return;
      key = "request-user-action";
      notification.info({
        key,
        title: "点击窗口任意位置以继续加载",
        description: "需要先在应用内进行一次操作，之后才能使用部分功能。",
        closable: false,
        duration: false,
        placement: "bottomRight",
        actions: (
          <Button type="primary" onClick={() => resolve()}>
            继续
          </Button>
        ),
      });
      (function t() {
        if (window.navigator.userActivation?.isActive) resolve();
        else if (!disposed) requestAnimationFrame(t);
      })();
    };
    eventTarget.addEventListener("requestUserAction", h);
    if (unresolvedCnt > 0) h();
    return () => {
      eventTarget.removeEventListener("requestUserAction", h);
      if (key) notification.destroy(key);
      disposed = true;
    };
  }, [notification]);
  return null;
};

export default RequestUserActionHolder;
