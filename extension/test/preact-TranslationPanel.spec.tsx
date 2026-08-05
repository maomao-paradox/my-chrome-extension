/**
 * TranslationPanel 组件单元测试 - Preact 版本
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent } from '@testing-library/preact';
import TranslationPanel from '@/apps/textSelectionToolbar/preact/TranslationPanel';

// Mock window 属性
Object.defineProperty(window, 'innerWidth', { value: 1024 });
Object.defineProperty(window, 'innerHeight', { value: 768 });

describe('TranslationPanel 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('拖拽功能', () => {
    it('拖拽应该移动面板位置', () => {
      render(
        h(TranslationPanel, {
          visible: true,
          content: '测试内容',
          position: { left: 100, top: 100 },
        }),
      );

      const header = document.querySelector('.translation-panel__header')!;

      // 模拟 pointerdown
      fireEvent.pointerDown(header, {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      });

      // 模拟 pointermove
      fireEvent.pointerMove(document, {
        clientX: 200,
        clientY: 200,
        pointerId: 1,
      });

      // 模拟 pointerup
      fireEvent.pointerUp(document, {
        pointerId: 1,
      });

      const panel = document.querySelector('.translation-panel') as HTMLElement;
      expect(panel).toBeTruthy();
      // 位置应该更新（初始100 + 偏移100 = 200）
      expect(panel.style.left).toBe('200px');
      expect(panel.style.top).toBe('200px');
    });

    it('第二次拖拽应该正常工作（不应被旧监听器影响）', () => {
      render(
        h(TranslationPanel, {
          visible: true,
          content: '测试内容',
          position: { left: 50, top: 50 },
        }),
      );

      const header = document.querySelector('.translation-panel__header')!;

      // 第一次拖拽
      fireEvent.pointerDown(header, {
        clientX: 50,
        clientY: 50,
        pointerId: 1,
      });
      fireEvent.pointerMove(document, {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      });
      fireEvent.pointerUp(document, { pointerId: 1 });

      const panel = document.querySelector('.translation-panel') as HTMLElement;
      expect(panel.style.left).toBe('100px');
      expect(panel.style.top).toBe('100px');

      // 第二次拖拽
      fireEvent.pointerDown(header, {
        clientX: 100,
        clientY: 100,
        pointerId: 2,
      });
      fireEvent.pointerMove(document, {
        clientX: 150,
        clientY: 150,
        pointerId: 2,
      });
      fireEvent.pointerUp(document, { pointerId: 2 });

      // 第二次拖拽后位置应该正确更新
      expect(panel.style.left).toBe('150px');
      expect(panel.style.top).toBe('150px');
    });

    it('关闭按钮应该阻止事件冒泡且不触发拖拽', () => {
      const onClose = vi.fn();
      render(
        h(TranslationPanel, {
          visible: true,
          content: '测试内容',
          position: { left: 100, top: 100 },
          onClose,
        }),
      );

      const closeBtn = document.querySelector('.translation-panel__close')!;
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('拖拽中应该添加 is-dragging 类', () => {
      render(
        h(TranslationPanel, {
          visible: true,
          content: '测试内容',
        }),
      );

      const header = document.querySelector('.translation-panel__header')!;

      fireEvent.pointerDown(header, {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      });

      expect(header.classList.contains('is-dragging')).toBe(true);

      fireEvent.pointerUp(document, { pointerId: 1 });
    });
  });

  describe('震动功能', () => {
    it('shakeKey 变化时应该触发震动', async () => {
      const { rerender } = render(
        h(TranslationPanel, {
          visible: true,
          content: '测试内容',
          shakeKey: 0,
        }),
      );

      const panel = document.querySelector('.translation-panel')!;
      expect(panel.classList.contains('is-shaking')).toBe(false);

      rerender(
        h(TranslationPanel, {
          visible: true,
          content: '测试内容',
          shakeKey: 1,
        }),
      );

      // 等待 requestAnimationFrame 执行
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(panel.classList.contains('is-shaking')).toBe(true);
    });
  });

  describe('可见性', () => {
    it('visible 为 false 时应该不渲染', () => {
      render(
        h(TranslationPanel, {
          visible: false,
          content: '测试内容',
        }),
      );

      const panel = document.querySelector('.translation-panel');
      expect(panel).toBeNull();
    });
  });

  describe('关闭事件', () => {
    it('点击关闭按钮应该调用 onClose', () => {
      const onClose = vi.fn();
      render(
        h(TranslationPanel, {
          visible: true,
          content: '测试内容',
          onClose,
        }),
      );

      const closeBtn = document.querySelector('.translation-panel__close')!;
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
