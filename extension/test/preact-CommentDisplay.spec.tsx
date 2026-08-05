/**
 * CommentDisplay 组件单元测试 - Preact 版本
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, screen } from '@testing-library/preact';
import CommentDisplay, { formatTime } from '@/apps/textSelectionToolbar/preact/CommentDisplay';
import type { Comment } from '@/services/commentStorage';

vi.stubGlobal('maLogger', {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
});

// Mock Comment 类型
const mockComment: Comment = {
  id: 'test-id-123',
  text: '这是原文内容',
  comment: '这是留言内容',
  url: 'https://example.com',
  hash: '#hash',
  timestamp: Date.now(),
};

describe('CommentDisplay 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatTime 函数', () => {
    it('刚刚的时间应该返回"刚刚"', () => {
      const now = Date.now();
      expect(formatTime(now)).toBe('刚刚');
    });

    it('1分钟前应该返回"1分钟前"', () => {
      const time = Date.now() - 60000;
      expect(formatTime(time)).toBe('1分钟前');
    });

    it('5分钟前应该返回"5分钟前"', () => {
      const time = Date.now() - 300000;
      expect(formatTime(time)).toBe('5分钟前');
    });

    it('1小时前应该返回"1小时前"', () => {
      const time = Date.now() - 3600000;
      expect(formatTime(time)).toBe('1小时前');
    });

    it('3小时前应该返回"3小时前"', () => {
      const time = Date.now() - 10800000;
      expect(formatTime(time)).toBe('3小时前');
    });
  });

  describe('基础渲染', () => {
    it('不可见时不渲染', () => {
      render(
        h(CommentDisplay, {
          visible: false,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      const display = document.querySelector('.comment-display');
      expect(display).toBeNull();
    });

    it('可见时正确渲染', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      const display = document.querySelector('.comment-display');
      expect(display).toBeTruthy();
    });

    it('显示原文内容', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      expect(screen.getByText('这是原文内容')).toBeTruthy();
    });

    it('显示留言内容', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      expect(screen.getByText('这是留言内容')).toBeTruthy();
    });

    it('显示"原文"标签', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      expect(screen.getByText('原文')).toBeTruthy();
    });

    it('显示"留言"标签', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      expect(screen.getByText('留言')).toBeTruthy();
    });

    it('显示"留言内容"标题', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      expect(screen.getByText('留言内容')).toBeTruthy();
    });
  });

  describe('位置定位', () => {
    it('应该使用传入的位置坐标', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 200, y: 300 },
        })
      );
      
      const display = document.querySelector('.comment-display') as HTMLElement;
      expect(display.style.left).toBe('200px');
      expect(display.style.top).toBe('300px');
    });

    it('应该能接收不同的位置坐标', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 50, y: 50 },
        })
      );
      
      const display = document.querySelector('.comment-display') as HTMLElement;
      expect(display.style.left).toBe('50px');
      expect(display.style.top).toBe('50px');
    });
  });

  describe('交互行为', () => {
    it('点击编辑按钮应该触发 onEdit 回调', async () => {
      const onEdit = vi.fn();
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
          onEdit,
        })
      );
      
      const editBtn = screen.getByText('编辑');
      await fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('点击关闭按钮应该触发 onClose 回调', async () => {
      const onClose = vi.fn();
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
          onClose,
        })
      );
      
      const closeBtn = screen.getByText('关闭');
      await fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击关闭图标应该触发 onClose 回调', async () => {
      const onClose = vi.fn();
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
          onClose,
        })
      );
      
      const closeIconBtn = document.querySelector('.comment-display-close');
      await fireEvent.click(closeIconBtn!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击遮罩层应该触发 onClose 回调', async () => {
      const onClose = vi.fn();
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
          onClose,
        })
      );
      
      const overlay = document.querySelector('.comment-display-overlay');
      await fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击内容区域不应该触发关闭', async () => {
      const onClose = vi.fn();
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
          onClose,
        })
      );
      
      const display = document.querySelector('.comment-display');
      await fireEvent.click(display!);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('按钮渲染', () => {
    it('应该显示编辑按钮', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      const editBtn = screen.getByText('编辑');
      expect(editBtn).toBeTruthy();
    });

    it('应该显示关闭按钮', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      const closeBtn = screen.getByText('关闭');
      expect(closeBtn).toBeTruthy();
    });

    it('编辑按钮应该有正确的类名', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      const editBtn = screen.getByText('编辑');
      expect(editBtn.classList.contains('btn-edit')).toBe(true);
    });

    it('关闭按钮应该有正确的类名', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      const closeBtn = screen.getByText('关闭');
      expect(closeBtn.classList.contains('btn-close')).toBe(true);
    });
  });

  describe('时间戳显示', () => {
    it('应该显示格式化的时间', () => {
      render(
        h(CommentDisplay, {
          visible: true,
          comment: mockComment,
          position: { x: 100, y: 100 },
        })
      );
      
      const timestamp = document.querySelector('.timestamp');
      expect(timestamp).toBeTruthy();
      // 因为是刚刚创建的，应该显示"刚刚"
      expect(timestamp!.textContent).toBe('刚刚');
    });
  });

  describe('边界情况', () => {
    it('空原文内容应该正常显示', () => {
      const emptyTextComment: Comment = {
        ...mockComment,
        text: '',
      };
      
      render(
        h(CommentDisplay, {
          visible: true,
          comment: emptyTextComment,
          position: { x: 100, y: 100 },
        })
      );
      
      const textElement = document.querySelector('.comment-original-text .text');
      expect(textElement!.textContent).toBe('');
    });

    it('空留言内容应该正常显示', () => {
      const emptyComment: Comment = {
        ...mockComment,
        comment: '',
      };
      
      render(
        h(CommentDisplay, {
          visible: true,
          comment: emptyComment,
          position: { x: 100, y: 100 },
        })
      );
      
      const commentElement = document.querySelector('.comment-content .text');
      expect(commentElement!.textContent).toBe('');
    });
  });
});
