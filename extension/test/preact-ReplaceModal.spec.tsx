/**
 * ReplaceModal 组件单元测试 - Preact 版本
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, screen } from '@testing-library/preact';
import ReplaceModal from '@/apps/textSelectionToolbar/preact/ReplaceModal';

vi.stubGlobal('maLogger', {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
});

describe('ReplaceModal 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('不可见时不渲染', () => {
      render(
        h(ReplaceModal, {
          visible: false,
          searchText: '查找文本',
        })
      );
      const modal = document.querySelector('.replace-modal');
      expect(modal).toBeNull();
    });

    it('可见时正确渲染', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      const modal = document.querySelector('.replace-modal');
      expect(modal).toBeTruthy();
    });

    it('显示标题"替换文本"', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      expect(screen.getByText('替换文本')).toBeTruthy();
    });

    it('显示查找文本预览', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '要查找的内容',
        })
      );
      expect(screen.getByText('要查找的内容')).toBeTruthy();
    });

    it('显示"查找文本"标签', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '要查找的内容',
        })
      );
      const label = document.querySelector('.replace-modal__label');
      expect(label?.textContent).toBe('查找文本');
    });

    it('显示"替换为"标签', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      expect(screen.getByText('替换为')).toBeTruthy();
    });

    it('显示"区分大小写"复选框', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      expect(screen.getByText('区分大小写')).toBeTruthy();
    });

    it('显示"全词匹配"复选框', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      expect(screen.getByText('全词匹配')).toBeTruthy();
    });

    it('显示"刷新页面后失效"提示', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      expect(screen.getByText('（刷新页面后失效）')).toBeTruthy();
    });
  });

  describe('交互行为', () => {
    it('点击取消按钮应该触发 onClose 回调', async () => {
      const onClose = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onClose,
        })
      );
      
      const cancelBtn = screen.getByText('取消');
      await fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击关闭图标应该触发 onClose 回调', async () => {
      const onClose = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onClose,
        })
      );
      
      const closeBtn = document.querySelector('.replace-modal__close');
      await fireEvent.click(closeBtn!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击替换按钮应该触发 onReplace 回调', async () => {
      const onReplace = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onReplace,
        })
      );
      
      const input = document.querySelector('.replace-modal__input');
      await fireEvent.input(input!, { target: { value: '替换文本' } });
      
      const replaceBtn = screen.getByText('替换');
      await fireEvent.click(replaceBtn);
      
      expect(onReplace).toHaveBeenCalledWith('替换文本', {
        caseSensitive: false,
        wholeWord: false,
      });
    });

    it('点击替换按钮时传递区分大小写选项', async () => {
      const onReplace = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onReplace,
        })
      );
      
      const input = document.querySelector('.replace-modal__input');
      await fireEvent.input(input!, { target: { value: '替换文本' } });
      
      const caseSensitiveCheckbox = document.querySelectorAll('.replace-modal__checkbox input')[0];
      await fireEvent.click(caseSensitiveCheckbox);
      
      const replaceBtn = screen.getByText('替换');
      await fireEvent.click(replaceBtn);
      
      expect(onReplace).toHaveBeenCalledWith('替换文本', {
        caseSensitive: true,
        wholeWord: false,
      });
    });

    it('点击替换按钮时传递全词匹配选项', async () => {
      const onReplace = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onReplace,
        })
      );
      
      const input = document.querySelector('.replace-modal__input');
      await fireEvent.input(input!, { target: { value: '替换文本' } });
      
      const wholeWordCheckbox = document.querySelectorAll('.replace-modal__checkbox input')[1];
      await fireEvent.click(wholeWordCheckbox);
      
      const replaceBtn = screen.getByText('替换');
      await fireEvent.click(replaceBtn);
      
      expect(onReplace).toHaveBeenCalledWith('替换文本', {
        caseSensitive: false,
        wholeWord: true,
      });
    });

    it('同时选择两个选项应该正确传递', async () => {
      const onReplace = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onReplace,
        })
      );
      
      const input = document.querySelector('.replace-modal__input');
      await fireEvent.input(input!, { target: { value: '替换文本' } });
      
      const checkboxes = document.querySelectorAll('.replace-modal__checkbox input');
      await fireEvent.click(checkboxes[0]); // 区分大小写
      await fireEvent.click(checkboxes[1]); // 全词匹配
      
      const replaceBtn = screen.getByText('替换');
      await fireEvent.click(replaceBtn);
      
      expect(onReplace).toHaveBeenCalledWith('替换文本', {
        caseSensitive: true,
        wholeWord: true,
      });
    });
  });

  describe('输入处理', () => {
    it('应该能获取输入框的值', async () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      
      const input = document.querySelector('.replace-modal__input') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: '新的替换文本' } });
      
      expect(input.value).toBe('新的替换文本');
    });

    it('回车键应该触发替换', async () => {
      const onReplace = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onReplace,
        })
      );
      
      const input = document.querySelector('.replace-modal__input');
      await fireEvent.input(input!, { target: { value: '替换文本' } });
      await fireEvent.keyDown(input!, { key: 'Enter' });
      
      expect(onReplace).toHaveBeenCalledWith('替换文本', {
        caseSensitive: false,
        wholeWord: false,
      });
    });

    it('打开时应该清空输入框', async () => {
      const { rerender } = render(
        h(ReplaceModal, {
          visible: false,
          searchText: '查找文本',
        })
      );
      
      rerender(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      
      // 等待 useEffect 执行
      await Promise.resolve();
      
      const input = document.querySelector('.replace-modal__input') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('选项复选框', () => {
    it('初始状态复选框应该未选中', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      
      const checkboxes = document.querySelectorAll('.replace-modal__checkbox input');
      checkboxes.forEach((checkbox) => {
        expect((checkbox as HTMLInputElement).checked).toBe(false);
      });
    });

    it('点击复选框应该切换状态', async () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      
      const checkboxes = document.querySelectorAll('.replace-modal__checkbox input');
      
      await fireEvent.click(checkboxes[0]);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      
      await fireEvent.click(checkboxes[0]);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    });
  });

  describe('遮罩层点击', () => {
    it('点击遮罩层应该关闭模态框', async () => {
      const onClose = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onClose,
        })
      );
      
      const overlay = document.querySelector('.replace-modal-overlay');
      await fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击模态框内容区域不应该关闭', async () => {
      const onClose = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onClose,
        })
      );
      
      const modal = document.querySelector('.replace-modal');
      await fireEvent.click(modal!);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    it('空替换文本不应该触发替换', async () => {
      const onReplace = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onReplace,
        })
      );
      
      const replaceBtn = screen.getByText('替换');
      await fireEvent.click(replaceBtn);
      
      // 空文本时不应该触发 onReplace
      expect(onReplace).not.toHaveBeenCalled();
    });

    it('只有空格的替换文本不应该触发替换', async () => {
      const onReplace = vi.fn();
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
          onReplace,
        })
      );
      
      const input = document.querySelector('.replace-modal__input');
      await fireEvent.input(input!, { target: { value: '   ' } });
      
      const replaceBtn = screen.getByText('替换');
      await fireEvent.click(replaceBtn);
      
      expect(onReplace).not.toHaveBeenCalled();
    });

    it('空查找文本应该显示为空', () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '',
        })
      );
      
      const preview = document.querySelector('.replace-modal__preview');
      expect(preview!.textContent).toBe('');
    });
  });

  describe('震动反馈', () => {
    it('空替换文本时应该触发震动效果', async () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      
      const replaceBtn = screen.getByText('替换');
      await fireEvent.click(replaceBtn);
      
      const modal = document.querySelector('.replace-modal');
      // 短暂延迟后检查是否添加了震动类
      setTimeout(() => {
        expect(modal!.classList.contains('is-shaking')).toBe(true);
      }, 10);
    });

    it('震动效果应该在短暂时间后停止', async () => {
      render(
        h(ReplaceModal, {
          visible: true,
          searchText: '查找文本',
        })
      );
      
      const replaceBtn = screen.getByText('替换');
      await fireEvent.click(replaceBtn);
      
      const modal = document.querySelector('.replace-modal');
      
      // 检查震动结束后类是否被移除
      setTimeout(() => {
        expect(modal!.classList.contains('is-shaking')).toBe(false);
      }, 500);
    });
  });
});
