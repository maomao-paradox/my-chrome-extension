/**
 * CommentModal 组件单元测试 - Preact 版本
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, screen } from '@testing-library/preact';
import CommentModal from '@/apps/textSelectionToolbar/preact/CommentModal';

// Mock maLogger
vi.stubGlobal('maLogger', {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
});

describe('CommentModal 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('不可见时不渲染', () => {
      render(
        h(CommentModal, {
          visible: false,
          selectedText: '测试文本',
        })
      );
      const modal = document.querySelector('.comment-modal');
      expect(modal).toBeNull();
    });

    it('可见时正确渲染模态框', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
        })
      );
      const modal = document.querySelector('.comment-modal');
      expect(modal).toBeTruthy();
    });

    it('显示添加留言标题', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
        })
      );
      const title = document.querySelector('.comment-modal-title');
      expect(title?.textContent).toBe('添加留言');
    });

    it('显示编辑留言标题', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          commentId: '123',
          existingComment: '已有留言',
        })
      );
      const title = document.querySelector('.comment-modal-title');
      expect(title?.textContent).toBe('编辑留言');
    });

    it('显示选中文本', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '这是被选中的文本',
        })
      );
      expect(screen.getByText('这是被选中的文本')).toBeTruthy();
    });

    it('显示保存按钮文本为"添加留言"', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
        })
      );
      const saveBtn = document.querySelector('.comment-modal-footer .btn-primary');
      expect(saveBtn?.textContent).toBe('添加留言');
    });

    it('编辑模式下显示保存按钮文本为"保存修改"', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          commentId: '123',
          existingComment: '已有留言',
        })
      );
      const saveBtn = document.querySelector('.comment-modal-footer .btn-primary');
      expect(saveBtn?.textContent).toBe('保存修改');
    });
  });

  describe('交互行为', () => {
    it('点击取消按钮应该触发 onClose 回调', async () => {
      const onClose = vi.fn();
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          onClose,
        })
      );
      
      const cancelBtn = document.querySelector('.btn-secondary');
      await fireEvent.click(cancelBtn!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击保存按钮应该触发 onSave 回调', async () => {
      const onSave = vi.fn();
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          onSave,
        })
      );
      
      const textarea = document.querySelector('.comment-textarea');
      await fireEvent.input(textarea!, { target: { value: '留言内容' } });
      
      const saveBtn = document.querySelector('.btn-primary');
      await fireEvent.click(saveBtn!);
      
      expect(onSave).toHaveBeenCalledWith({
        text: '测试文本',
        comment: '留言内容',
        commentId: undefined,
      });
    });

    it('保存按钮在没有内容时应该禁用', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
        })
      );
      
      const saveBtn = document.querySelector('.btn-primary') as HTMLButtonElement;
      expect(saveBtn.hasAttribute('disabled')).toBe(true);
    });

    it('保存按钮在有内容时应该启用', async () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
        })
      );
      
      const textarea = document.querySelector('.comment-textarea');
      await fireEvent.input(textarea!, { target: { value: '有内容的留言' } });
      
      const saveBtn = document.querySelector('.btn-primary') as HTMLButtonElement;
      expect(saveBtn.hasAttribute('disabled')).toBe(false);
    });

    it('点击删除按钮应该触发 onDelete 回调', async () => {
      const onDelete = vi.fn();
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          commentId: '123',
          existingComment: '已有留言',
          onDelete,
        })
      );
      
      const deleteBtn = document.querySelector('.btn-danger');
      await fireEvent.click(deleteBtn!);
      expect(onDelete).toHaveBeenCalledWith('123');
    });

    it('编辑模式下显示删除按钮', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          commentId: '123',
          existingComment: '已有留言',
        })
      );
      const deleteBtn = document.querySelector('.btn-danger');
      expect(deleteBtn).toBeTruthy();
    });

    it('新增模式下不显示删除按钮', () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
        })
      );
      const deleteBtn = document.querySelector('.btn-danger');
      expect(deleteBtn).toBeNull();
    });
  });

  describe('输入处理', () => {
    it('应该能获取输入框的值', async () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
        })
      );
      
      const textarea = document.querySelector('.comment-textarea') as HTMLTextAreaElement;
      await fireEvent.input(textarea, { target: { value: '新的留言内容' } });
      
      expect(textarea.value).toBe('新的留言内容');
    });

    it('字符计数应该正确', async () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
        })
      );
      
      const textarea = document.querySelector('.comment-textarea');
      const charCount = document.querySelector('.char-count');
      
      expect(charCount!.textContent).toBe('0/500');
      
      await fireEvent.input(textarea!, { target: { value: '12345' } });
      expect(charCount!.textContent).toBe('5/500');
    });

    it('打开编辑模式时应该填充已有内容', async () => {
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          commentId: '123',
          existingComment: '已有留言内容',
        })
      );
      
      await Promise.resolve();
      
      const textarea = document.querySelector('.comment-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('已有留言内容');
    });
  });

  describe('遮罩层点击', () => {
    it('点击遮罩层应该关闭模态框', async () => {
      const onClose = vi.fn();
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          onClose,
        })
      );
      
      const overlay = document.querySelector('.comment-modal-overlay');
      await fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击模态框内容区域不应该关闭', async () => {
      const onClose = vi.fn();
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          onClose,
        })
      );
      
      const modal = document.querySelector('.comment-modal');
      await fireEvent.click(modal!);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    it('空文本内容不应该触发保存', () => {
      const onSave = vi.fn();
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          onSave,
        })
      );
      
      const saveBtn = document.querySelector('.btn-primary') as HTMLButtonElement;
      expect(saveBtn.hasAttribute('disabled')).toBe(true);
    });

    it('空白内容（只有空格）不应该触发保存', async () => {
      const onSave = vi.fn();
      render(
        h(CommentModal, {
          visible: true,
          selectedText: '测试文本',
          onSave,
        })
      );
      
      const textarea = document.querySelector('.comment-textarea');
      await fireEvent.input(textarea!, { target: { value: '   ' } });
      
      const saveBtn = document.querySelector('.btn-primary') as HTMLButtonElement;
      expect(saveBtn.hasAttribute('disabled')).toBe(true);
    });
  });
});
