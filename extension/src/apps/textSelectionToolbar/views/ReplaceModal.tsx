/**
 * ReplaceModal 组件 - Preact 版本
 * 文本替换模态框，支持查找和替换功能
 */
import { useState, useEffect, useRef, useCallback } from "react";
// import "./styles/replace-modal.scss";

/**
 * 替换选项接口
 */
interface ReplaceOptions {
  /** 是否区分大小写 */
  caseSensitive: boolean;
  /** 是否全词匹配 */
  wholeWord: boolean;
}

/**
 * ReplaceModal 组件属性接口
 */
interface ReplaceModalProps {
  /** 是否可见 */
  visible: boolean;
  /** 弹窗标题 */
  title?: string;
  /** 要查找的文本 */
  searchText: string;
  /** 关闭事件 */
  onClose?: () => void;
  /** 替换事件 */
  onReplace?: (replaceText: string, options: ReplaceOptions) => void;
}

/**
 * ReplaceModal 组件
 * 提供文本替换的模态框UI
 */
const ReplaceModal: React.FC<ReplaceModalProps> = ({
  visible,
  title = "替换文本",
  searchText,
  onClose,
  onReplace,
}: ReplaceModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [replaceText, setReplaceText] = useState<string>("");
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [wholeWord, setWholeWord] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  /**
   * 监听 visible 变化，聚焦输入框
   */
  useEffect(() => {
    if (visible) {
      // 聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      setReplaceText("");
    }
  }, [visible]);

  /**
   * 触发震动动画
   */
  const triggerShake = useCallback(() => {
    setIsShaking(false);
    requestAnimationFrame(() => {
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
      }, 420);
    });
  }, []);

  /**
   * 处理关闭
   */
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /**
   * 处理替换
   */
  const handleReplace = useCallback(() => {
    if (!replaceText.trim()) {
      triggerShake();
      return;
    }
    onReplace?.(replaceText, {
      caseSensitive,
      wholeWord,
    });
  }, [replaceText, caseSensitive, wholeWord, triggerShake, onReplace]);

  /**
   * 处理输入变化
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement;
      setReplaceText(target.value);
    },
    [],
  );

  /**
   * 处理回车键
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleReplace();
      }
    },
    [handleReplace],
  );

  /**
   * 处理复选框变化
   */
  const handleCaseSensitiveChange = useCallback(() => {
    setCaseSensitive((prev) => !prev);
  }, []);

  const handleWholeWordChange = useCallback(() => {
    setWholeWord((prev) => !prev);
  }, []);

  // 如果不可见则返回 null
  if (!visible) return null;

  return (
    <div
      className="replace-modal-overlay"
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`replace-modal${isShaking ? " is-shaking" : ""}`}>
        <div className="replace-modal__header">
          <div className="replace-modal__title-group">
            <h2 className="replace-modal__title">{title}</h2>
            <p className="replace-modal__subtitle">（刷新页面后失效）</p>
          </div>
          <button
            className="replace-modal__close"
            type="button"
            aria-label="关闭替换文本弹窗"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <div className="replace-modal__body">
          <div className="replace-modal__input-group">
            <label className="replace-modal__label">查找文本</label>
            <div className="replace-modal__preview">{searchText}</div>
          </div>

          <div className="replace-modal__input-group">
            <label
              className="replace-modal__label"
              htmlFor="replace-modal-input"
            >
              替换为
            </label>
            <input
              id="replace-modal-input"
              ref={inputRef}
              type="text"
              className="replace-modal__input"
              placeholder="请输入替换后的文本"
              value={replaceText}
              onInput={handleInputChange}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="replace-modal__options">
            <label className="replace-modal__checkbox">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={handleCaseSensitiveChange}
              />
              <span className="replace-modal__checkbox-box"></span>
              <span className="replace-modal__checkbox-label">区分大小写</span>
            </label>
            <label className="replace-modal__checkbox">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={handleWholeWordChange}
              />
              <span className="replace-modal__checkbox-box"></span>
              <span className="replace-modal__checkbox-label">全词匹配</span>
            </label>
          </div>
        </div>

        <div className="replace-modal__footer">
          <button
            className="replace-modal__btn replace-modal__btn--secondary"
            type="button"
            onClick={handleClose}
          >
            取消
          </button>
          <button
            className="replace-modal__btn replace-modal__btn--primary"
            type="button"
            onClick={handleReplace}
          >
            替换
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplaceModal;
export { ReplaceModal };
export type { ReplaceModalProps, ReplaceOptions };
