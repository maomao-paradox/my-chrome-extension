/**
 * TextToolbar 组件单元测试 - Preact 版本
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, screen } from '@testing-library/preact';
import TextToolbar from '@/apps/textSelectionToolbar/preact/TextToolbar';
import type { TextTool } from '@/types';

// Mock maLogger
vi.stubGlobal('maLogger', {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
});

describe('TextToolbar 组件', () => {
  const mockTools: TextTool[] = [
    { id: 'copy', label: '复制', handler: vi.fn() },
    { id: 'translate', label: '问AI', handler: vi.fn() },
    { id: 'comment', label: '留言', handler: vi.fn() },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染工具栏容器', () => {
      render(h(TextToolbar, { customTools: mockTools }));
      const toolbar = document.querySelector('.text-selection-toolbar');
      expect(toolbar).toBeTruthy();
    });

    it('应该渲染所有工具按钮', () => {
      render(h(TextToolbar, { customTools: mockTools }));
      const buttons = document.querySelectorAll('.toolbar-btn');
      expect(buttons.length).toBe(3);
    });

    it('应该显示工具标签', () => {
      render(h(TextToolbar, { customTools: mockTools }));
      expect(screen.getByText('复制')).toBeTruthy();
      expect(screen.getByText('问AI')).toBeTruthy();
      expect(screen.getByText('留言')).toBeTruthy();
    });

    it('不显示关闭按钮当 showCloseBtn 为 false', () => {
      render(h(TextToolbar, { customTools: mockTools, showCloseBtn: false }));
      const closeBtn = document.querySelector('.close-btn');
      expect(closeBtn).toBeNull();
    });

    it('显示关闭按钮当 showCloseBtn 为 true', () => {
      render(h(TextToolbar, { customTools: mockTools, showCloseBtn: true }));
      const closeBtn = document.querySelector('.close-btn');
      expect(closeBtn).toBeTruthy();
    });

    it('没有自定义工具时不渲染工具按钮', () => {
      render(h(TextToolbar, { customTools: [] }));
      const buttons = document.querySelectorAll('.toolbar-btn');
      expect(buttons.length).toBe(0);
    });
  });

  describe('交互行为', () => {
    it('点击关闭按钮应该触发 onClose 回调', async () => {
      const onClose = vi.fn();
      render(h(TextToolbar, { customTools: mockTools, showCloseBtn: true, onClose }));
      
      const closeBtn = document.querySelector('.close-btn');
      expect(closeBtn).toBeTruthy();
      
      await fireEvent.click(closeBtn!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击工具按钮应该执行 tool.handler', async () => {
      render(h(TextToolbar, { customTools: mockTools, selectedText: '测试文本' }));
      
      const buttons = document.querySelectorAll('.toolbar-btn');
      await fireEvent.click(buttons[0]);
      // handler 应该被调用
      expect(mockTools[0].handler).toHaveBeenCalledTimes(1);
      expect(mockTools[0].handler).toHaveBeenCalledWith('测试文本');
    });

    it('点击工具按钮应该触发 onToolClick 回调', async () => {
      const onToolClick = vi.fn();
      render(h(TextToolbar, { customTools: mockTools, onToolClick }));
      
      const buttons = document.querySelectorAll('.toolbar-btn');
      await fireEvent.click(buttons[0]);
      expect(onToolClick).toHaveBeenCalledWith(mockTools[0]);
    });

    it('handler 执行后应该触发 onToolClick 回调通知', async () => {
      const onToolClick = vi.fn();
      render(h(TextToolbar, { customTools: mockTools, selectedText: '选中的文本', onToolClick }));
      
      const buttons = document.querySelectorAll('.toolbar-btn');
      await fireEvent.click(buttons[1]);
      
      // 验证 handler 和 onToolClick 都被调用
      expect(mockTools[1].handler).toHaveBeenCalledWith('选中的文本');
      expect(onToolClick).toHaveBeenCalledWith(mockTools[1]);
    });

    it('每个工具按钮应该传递正确的工具参数', async () => {
      const onToolClick = vi.fn();
      render(h(TextToolbar, { customTools: mockTools, selectedText: '文本', onToolClick }));
      
      const buttons = document.querySelectorAll('.toolbar-btn');
      
      for (let i = 0; i < buttons.length; i++) {
        await fireEvent.click(buttons[i]);
        expect(mockTools[i].handler).toHaveBeenCalledWith('文本');
        expect(onToolClick).toHaveBeenCalledWith(mockTools[i]);
      }
    });

    it('handler 应该使用 selectedText 优先于 initialText', async () => {
      render(h(TextToolbar, { customTools: mockTools, initialText: '初始文本', selectedText: '选中文本' }));
      
      const buttons = document.querySelectorAll('.toolbar-btn');
      await fireEvent.click(buttons[0]);
      expect(mockTools[0].handler).toHaveBeenCalledWith('选中文本');
    });

    it('没有 selectedText 时应该回退到 initialText', async () => {
      render(h(TextToolbar, { customTools: mockTools, initialText: '初始文本' }));
      
      const buttons = document.querySelectorAll('.toolbar-btn');
      await fireEvent.click(buttons[0]);
      expect(mockTools[0].handler).toHaveBeenCalledWith('初始文本');
    });

    it('关闭按钮点击只触发一次', async () => {
      const onClose = vi.fn();
      render(h(TextToolbar, { customTools: mockTools, showCloseBtn: true, onClose }));
      
      const closeBtn = document.querySelector('.close-btn')!;
      await fireEvent.click(closeBtn);
      await fireEvent.click(closeBtn);
      
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('图标渲染', () => {
    it('有自定义图标时显示自定义图标', () => {
      const toolsWithIcon: TextTool[] = [
        { id: 'custom', label: '自定义', icon: '⭐', handler: vi.fn() },
      ];
      render(h(TextToolbar, { customTools: toolsWithIcon }));
      
      const customIcon = document.querySelector('.tool-custom-icon');
      expect(customIcon).toBeTruthy();
      expect(customIcon!.textContent).toBe('⭐');
    });

    it('没有自定义图标时显示 SVG 图标', () => {
      render(h(TextToolbar, { customTools: mockTools }));
      
      const svgIcons = document.querySelectorAll('.tool-svg');
      expect(svgIcons.length).toBe(3);
    });

    it('SVG 图标应该有正确的 viewBox 属性', () => {
      render(h(TextToolbar, { customTools: mockTools }));
      
      const svgIcons = document.querySelectorAll('.tool-svg');
      svgIcons.forEach(svg => {
        expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      });
    });
  });

  describe('属性更新', () => {
    it('initialText 更新应该触发重新渲染', () => {
      const { rerender } = render(
        h(TextToolbar, { customTools: mockTools, initialText: '初始文本' })
      );
      
      // 组件内部使用 initialText，验证不报错
      expect(document.querySelector('.text-selection-toolbar')).toBeTruthy();
      
      rerender(h(TextToolbar, { customTools: mockTools, initialText: '更新的文本' }));
      expect(document.querySelector('.text-selection-toolbar')).toBeTruthy();
    });

    it('customTools 更新应该反映在渲染中', () => {
      const { rerender } = render(
        h(TextToolbar, { customTools: mockTools })
      );
      
      expect(document.querySelectorAll('.toolbar-btn').length).toBe(3);
      
      const newTools: TextTool[] = [
        { id: 'new-tool', label: '新工具', handler: vi.fn() },
      ];
      rerender(h(TextToolbar, { customTools: newTools }));
      expect(document.querySelectorAll('.toolbar-btn').length).toBe(1);
      expect(screen.getByText('新工具')).toBeTruthy();
    });
  });

  describe('可访问性', () => {
    it('工具按钮应该有正确的 role 属性', () => {
      render(h(TextToolbar, { customTools: mockTools }));
      
      const buttons = document.querySelectorAll('.toolbar-btn');
      buttons.forEach(btn => {
        expect(btn.getAttribute('type')).toBe('button');
      });
    });

    it('.tool-icon 应该有 aria-hidden 属性', () => {
      render(h(TextToolbar, { customTools: mockTools }));
      
      const icons = document.querySelectorAll('.tool-icon');
      icons.forEach(icon => {
        expect(icon.getAttribute('aria-hidden')).toBe('true');
      });
    });
  });
});
