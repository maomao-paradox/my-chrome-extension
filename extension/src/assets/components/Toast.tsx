// Toast.tsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toastStyle from "./toast.css?raw";

export enum ToastType {
  Success = "success",
  Error = "error",
  Warn = "warn",
  Info = "info",
}

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  appendTo?: HTMLElement;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = "success",
  duration = 1500,
  appendTo = document.body,
  onClose,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return createPortal(
    <>
      <style>{toastStyle}</style>
      <div
        id={type}
        className={`toast-container slide--${isExiting ? "out" : "in"}`}
      >
        <div className="toast-content">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="toast-message">{message}</span>
          </div>
        </div>
      </div>
    </>,
    appendTo,
  );
};

export default Toast;
