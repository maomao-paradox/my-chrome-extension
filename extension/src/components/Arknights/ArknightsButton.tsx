import React, { useState } from "react";
import { AK_THEME } from "./ArknightsTheme";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "warning" | "danger" | "ghost";
  subText?: string;
  children: React.ReactNode;
}

export const ArknightsButton: React.FC<ButtonProps> = ({
  variant = "primary",
  subText = "PRTS//CMD",
  children,
  style,
  disabled,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // 变体样式配置
  const variants = {
    primary: {
      bg: isHovered ? AK_THEME.colors.rhodesCyan : AK_THEME.colors.surface,
      text: isHovered ? "#000000" : AK_THEME.colors.primary,
      border: isHovered ? AK_THEME.colors.rhodesCyan : AK_THEME.colors.border,
      dot: isHovered ? "#000000" : AK_THEME.colors.rhodesCyan,
    },
    warning: {
      bg: isHovered ? AK_THEME.colors.rhodesYellow : AK_THEME.colors.surface,
      text: isHovered ? "#000000" : AK_THEME.colors.warning,
      border: isHovered
        ? AK_THEME.colors.rhodesYellow
        : AK_THEME.colors.warning,
      dot: isHovered ? "#000000" : AK_THEME.colors.rhodesYellow,
    },
    danger: {
      bg: isHovered ? AK_THEME.colors.danger : AK_THEME.colors.surface,
      text: isHovered ? "#ffffff" : AK_THEME.colors.danger,
      border: AK_THEME.colors.danger,
      dot: "#ffffff",
    },
    ghost: {
      bg: isHovered ? "rgba(255,255,255,0.1)" : "transparent",
      text: isHovered ? "#ffffff" : AK_THEME.colors.textMuted,
      border: isHovered ? "#ffffff" : AK_THEME.colors.border,
      dot: isHovered ? "#ffffff" : AK_THEME.colors.textMuted,
    },
  };

  const currentTheme = variants[variant];

  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "8px 20px",
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
        border: `1px solid ${currentTheme.border}`,
        fontFamily: "monospace, sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        userSelect: "none",
        clipPath: AK_THEME.clipCornerBR,
        transition: "all 0.15s ease",
        ...style,
      }}
    >
      {/* 顶部微缩装饰 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          fontSize: "9px",
          opacity: 0.6,
          letterSpacing: "0.12em",
          marginBottom: "2px",
          fontFamily: "sans-serif",
          textTransform: "uppercase",
        }}
      >
        <span>{subText}</span>
        <span
          style={{
            width: "5px",
            height: "5px",
            backgroundColor: currentTheme.dot,
            display: "inline-block",
            marginLeft: "12px",
          }}
        />
      </div>

      {/* 主文字 */}
      <span
        style={{
          fontSize: "15px",
          fontWeight: "bold",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          fontFamily: "sans-serif",
        }}
      >
        {children}
      </span>
    </button>
  );
};
