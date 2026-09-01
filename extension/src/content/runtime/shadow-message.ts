import { createRoot } from "react-dom/client";
import { shadowHostId } from "@/config";
import { createShadowHost } from "@/utils/shadow-dom";
import toast from "@/utils/toast";
import { ToastType } from "@/assets/components/toast/main";

export const initializeShadowMessage = (ctx: AppContext): ShadowRoot | null => {
  const { shadowRoot } = createShadowHost(shadowHostId, "open");

  if (shadowRoot) {
    const mountPoint = document.createElement("div");
    mountPoint.id = "app__message";
    shadowRoot.appendChild(mountPoint);

    Object.defineProperty(ctx, "message", {
      value: {},
      writable: true,
      enumerable: false,
      configurable: false,
    });

    const messageTypes = {
      Success: "success",
      Error: "error",
      Warn: "warn",
      Info: "info",
    };

    Object.values(messageTypes).forEach((type) => {
      Object.defineProperty(ctx.message, type, {
        value: (message: string, options: any = {}) => {
          toast.show({
            type: type as ToastType,
            message,
            options: {
              ...options,
              appendTo: mountPoint,
            },
          });
        },
        writable: false,
        enumerable: false,
        configurable: false,
      });
    });
  }

  Object.defineProperty(ctx, "__SHADOW_DOM", {
    value: shadowRoot,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return shadowRoot;
};
