// toast.ts
import { createRoot } from "react-dom/client";
import Toast, { ToastType } from "@/assets/components/Toast";

let toastContainer: HTMLDivElement | null = null;
let toastRoot: any = null;

interface ToastOptions {
  appendTo?: HTMLElement;
  duration?: number;
  onClose?: () => void;
}

const toast = {
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

export default toast;
