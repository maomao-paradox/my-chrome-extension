/**
 * CommentDisplay 组件 - Preact 版本
 * 留言内容展示面板，显示原文、留言内容和时间戳
 */
import { h, type ComponentChild } from 'preact';
import { useCallback } from 'preact/hooks';
import type { Comment } from '@/services/commentStorage';
import './styles/comment-display.scss';

/**
 * CommentDisplay 组件属性接口
 */
interface CommentDisplayProps {
  /** 是否可见 */
  visible: boolean;
  /** 评论数据 */
  comment: Comment;
  /** 位置坐标 */
  position: { x: number; y: number };
  /** 关闭事件 */
  onClose?: () => void;
  /** 编辑事件 */
  onEdit?: () => void;
}

/**
 * 格式化时间戳为可读字符串
 * @param timestamp - 时间戳（毫秒）
 * @returns 格式化后的时间字符串
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

/**
 * CommentDisplay 组件
 * 提供留言内容展示的UI
 */
const CommentDisplay = ({
  visible,
  comment,
  position,
  onClose,
  onEdit
}: CommentDisplayProps): ComponentChild => {
  /**
   * 处理关闭
   */
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /**
   * 处理编辑
   */
  const handleEdit = useCallback(() => {
    onEdit?.();
  }, [onEdit]);

  // 如果不可见则返回 null
  if (!visible) return null;

  // 计算样式
  const style = {
    left: `${position.x}px`,
    top: `${position.y}px`
  };

  return (
    <div className="comment-display-overlay" onClick={(e: Event) => {
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className="comment-display" style={style}>
        <div className="comment-display-header">
          <h4 className="comment-display-title">留言内容</h4>
          <button
            className="comment-display-close"
            type="button"
            aria-label="关闭留言内容"
            onClick={handleClose}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="comment-display-body">
          <div className="comment-original-text">
            <span className="label">原文</span>
            <p className="text">{comment.text}</p>
          </div>

          <div className="comment-content">
            <span className="label">留言</span>
            <p className="text">{comment.comment}</p>
          </div>

          <div className="comment-meta">
            <span className="timestamp">{formatTime(comment.timestamp)}</span>
          </div>
        </div>

        <div className="comment-display-footer">
          <button
            className="btn btn-edit"
            type="button"
            onClick={handleEdit}
          >
            编辑
          </button>
          <button
            className="btn btn-close"
            type="button"
            onClick={handleClose}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentDisplay;
export { CommentDisplay, formatTime };
export type { CommentDisplayProps };
