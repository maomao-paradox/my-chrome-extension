import React, { useEffect } from "react";
import "./modal.scss";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
  subTitle?: string;
  confirmText?: string;
  cancelText?: string;
  children?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "SYSTEM NOTICE",
  subTitle = "PRTS//ALERT_LOG_V2",
  confirmText = "CONFIRM",
  cancelText = "CANCEL",
  children,
}) => {
  // 按 ESC 键关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="ark-modal-overlay" onClick={onClose}>
      {/* 阻止冒泡，防止点击内容区关闭弹窗 */}
      <div className="ark-modal" onClick={(e) => e.stopPropagation()}>
        {/* 1. 四角准星定位元素 */}
        <div className="ark-modal__corner ark-modal__corner--tl" />
        <div className="ark-modal__corner ark-modal__corner--tr" />
        <div className="ark-modal__corner ark-modal__corner--bl" />
        <div className="ark-modal__corner ark-modal__corner--br" />

        {/* 2. 警示黑黄/黑青标题栏 */}
        <div className="ark-modal__header">
          <div className="ark-modal__header-hazard" />
          <div className="ark-modal__header-title">
            <span className="ark-modal__header-dot" />
            <span className="ark-modal__header-text">{title}</span>
          </div>
          <span className="ark-modal__header-sub">{subTitle}</span>
        </div>

        {/* 3. 内容展示区 */}
        <div className="ark-modal__body">
          {children || (
            <div className="ark-modal__default-content">
              系统检测到未授权的终端操作请求，请确认是否继续执行当前指令序列。
            </div>
          )}
        </div>

        {/* 4. 底部操作按钮组 */}
        <div className="ark-modal__footer">
          <button className="ark-modal__btn ark-modal__btn--cancel" onClick={onClose}>
            <span className="ark-modal__btn-sub">CANCEL</span>
            <span className="ark-modal__btn-main">{cancelText}</span>
          </button>

          {onConfirm && (
            <button
              className="ark-modal__btn ark-modal__btn--confirm"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              <span className="ark-modal__btn-sub">EXECUTE</span>
              <span className="ark-modal__btn-main">{confirmText}</span>
            </button>
          )}
        </div>

        {/* 底部装饰斜纹 */}
        <div className="ark-modal__stripe-decor" />
      </div>
    </div>
  );
};

export default Modal;