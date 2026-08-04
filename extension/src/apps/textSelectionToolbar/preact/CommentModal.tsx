/**
 * CommentModal 组件 - Preact 版本
 * 留言编辑/添加模态框，支持创建和编辑留言
 */
import { h, type ComponentChild } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import './styles/comment-modal.scss';

/**
 * CommentModal 组件属性接口
 */
interface CommentModalProps {
  /** 是否可见 */
  visible: boolean;
  /** 选中文本 */
  selectedText: string;
  /** 评论ID（编辑时传入） */
  commentId?: string;
  /** 已有评论内容（编辑时传入） */
  existingComment?: string;
  /** 关闭事件 */
  onClose?: () => void;
  /** 保存事件 */
  onSave?: (data: { text: string; comment: string; commentId?: string }) => void;
  /** 删除事件 */
  onDelete?: (commentId: string) => void;
}

/**
 * CommentModal 组件
 * 提供添加/编辑留言的模态框UI
 */
const CommentModal = ({
  visible,
  selectedText,
  commentId = '',
  existingComment = '',
  onClose,
  onSave,
  onDelete
}: CommentModalProps): ComponentChild => {
  const [commentContent, setCommentContent] = useState<string>('');
  const [isEdit, setIsEdit] = useState<boolean>(false);

  /**
   * 监听 visible 变化，初始化表单状态
   */
  useEffect(() => {
    if (visible) {
      if (existingComment && commentId) {
        setCommentContent(existingComment);
        setIsEdit(true);
      } else {
        setCommentContent('');
        setIsEdit(false);
      }
    }
  }, [visible, existingComment, commentId]);

  /**
   * 处理关闭
   */
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /**
   * 处理保存
   */
  const handleSave = useCallback(() => {
    if (!commentContent.trim()) return;

    onSave?.({
      text: selectedText,
      comment: commentContent.trim(),
      commentId: commentId || undefined
    });
  }, [commentContent, selectedText, commentId, onSave]);

  /**
   * 处理删除
   */
  const handleDelete = useCallback(() => {
    if (commentId) {
      onDelete?.(commentId);
    }
  }, [commentId, onDelete]);

  /**
   * 处理输入变化
   */
  const handleInputChange = useCallback((e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    setCommentContent(target.value);
  }, []);

  // 计算标题
  const title = isEdit ? '编辑留言' : '添加留言';

  // 计算保存按钮文本
  const saveText = isEdit ? '保存修改' : '添加留言';

  // 如果不可见则返回 null
  if (!visible) return null;

  return (
    <div className="comment-modal-overlay" onClick={(e: Event) => {
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className="comment-modal">
        <div className="comment-modal-header">
          <h3 className="comment-modal-title">{title}</h3>
          <button
            className="comment-modal-close"
            type="button"
            aria-label="关闭留言弹窗"
            onClick={handleClose}
          >
            <svg
              width="20"
              height="20"
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

        <div className="comment-modal-body">
          <div className="comment-selected-text">
            <span className="label">选中文本</span>
            <p className="text-content">{selectedText}</p>
          </div>

          <div className="comment-input-group">
            <label className="label" htmlFor="comment-modal-textarea">留言内容</label>
            <textarea
              id="comment-modal-textarea"
              className="comment-textarea"
              placeholder="请输入留言内容..."
              rows={4}
              maxLength={500}
              value={commentContent}
              onInput={handleInputChange}
            ></textarea>
            <span className="char-count">{commentContent.length}/500</span>
          </div>
        </div>

        <div className="comment-modal-footer">
          {isEdit && (
            <button
              className="btn btn-danger"
              type="button"
              onClick={handleDelete}
            >
              删除留言
            </button>
          )}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleClose}
          >
            取消
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!commentContent.trim()}
            onClick={handleSave}
          >
            {saveText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentModal;
export { CommentModal };
export type { CommentModalProps };
