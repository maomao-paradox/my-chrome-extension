/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/dom-api/toast.ts
 * @date 2026-02-05T02:38:01.698Z
 */

import { createRoot } from "react-dom/client";
import Toast, { ToastType } from "@/components/toast/main";

let toastContainer: HTMLDivElement | null = null;
let toastRoot: any = null;

interface ToastOptions {
  appendTo?: HTMLElement;
  duration?: number;
  onClose?: () => void;
}

export const toast = {
  show: ({
    message,
    type = ToastType.Success,
    options,
  }: {
    message: string;
    type: ToastType;
    options?: ToastOptions;
  }) => {
    // 清理旧 Toast
    if (toastContainer) {
      toastRoot?.unmount();
      options?.appendTo?.removeChild(toastContainer);
      toastContainer = null;
      toastRoot = null;
    }

    toastContainer = document.createElement("div");
    options?.appendTo?.appendChild(toastContainer);

    toastRoot = createRoot(toastContainer);
    toastRoot.render(
      <Toast
        message={message}
        type={type}
        appendTo={options?.appendTo}
        duration={options?.duration}
        onClose={() => {
          options?.onClose?.();
          setTimeout(() => {
            if (toastContainer) {
              toastRoot?.unmount();
              options?.appendTo?.removeChild(toastContainer);
              toastContainer = null;
              toastRoot = null;
            }
          }, 300);
        }}
      />,
    );
  },

  success: (message: string, options?: ToastOptions) => {
    toast.show({ message, type: ToastType.Success, options });
  },

  error: (message: string, options?: ToastOptions) => {
    toast.show({ message, type: ToastType.Error, options });
  },

  warn: (message: string, options?: ToastOptions) => {
    toast.show({ message, type: ToastType.Warn, options });
  },

  info: (message: string, options?: ToastOptions) => {
    toast.show({ message, type: ToastType.Info, options });
  },
};
