// Toast.tsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./toast.css";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = "success",
  duration = 1500,
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

  // 不同主题的颜色配置
  const theme = {
    success: {
      border: "rgba(13, 148, 136, 0.22)",
      iconColor: "#0d9488",
      textColor: "#134e4a",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0d9488"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    error: {
      border: "rgba(239, 68, 68, 0.22)",
      iconColor: "#ef4444",
      textColor: "#991b1b",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
    warning: {
      border: "rgba(234, 179, 8, 0.22)",
      iconColor: "#eab308",
      textColor: "#854d0e",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#eab308"
          strokeWidth="2"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
    },
    info: {
      border: "rgba(59, 130, 246, 0.22)",
      iconColor: "#3b82f6",
      textColor: "#1e3a8a",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
  };

  const currentTheme = theme[type];

  return createPortal(
    <div
      style={{
        position: "fixed",
        zIndex: 9999999,
        right: "20px",
        top: "20px",
        animation: isExiting
          ? "slideOut 0.3s cubic-bezier(0.55, 0, 1, 1) forwards"
          : "slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.96)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${currentTheme.border}`,
          borderRadius: "12px",
          padding: "14px 18px",
          fontSize: "14px",
          lineHeight: "1.5",
          maxWidth: "280px",
          boxShadow: `
            0 18px 42px rgba(15, 23, 42, 0.18),
            0 4px 12px rgba(13, 148, 136, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.84)
          `,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {currentTheme.icon}
          <span style={{ color: currentTheme.textColor, fontWeight: 700 }}>
            {message}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default Toast;
