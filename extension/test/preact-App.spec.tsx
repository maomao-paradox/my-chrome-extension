/**
 * App 组件集成测试 - Preact 版本
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, fireEvent, act } from '@testing-library/preact';
import App from '@/apps/textSelectionToolbar/preact/App';
import type { TextTool } from '@/types';

vi.stubGlobal('maLogger', {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
});

// 使用 vi.hoisted 创建可引用的 mock 对象（解决提升问题）
const mocks = vi.hoisted(() => {
  return {
    componentManager: {
      register: vi.fn(),
      unregister: vi.fn(),
      call: vi.fn(),
    },
    eventManager: {
      useBus: vi.fn(() => vi.fn()),
    },
    commentStorage: {
      getCommentsForCurrentPage: vi.fn().mockResolvedValue([]),
      saveComment: vi.fn().mockResolvedValue({ id: 'test-id' }),
      updateComment: vi.fn().mockResolvedValue({ id: 'test-id' }),
      deleteComment: vi.fn().mockResolvedValue(undefined),
    },
    findAndReplaceDOMText: vi.fn().mockReturnValue({ matches: [] }),
    showSuccessMessage: vi.fn(),
  };
});

// Mock componentManager
vi.mock('@/utils/componentManager', () => ({
  componentManager: mocks.componentManager,
}));

// Mock eventManager
vi.mock('@/event', () => ({
  eventManager: mocks.eventManager,
}));

// Mock CommentStorage
vi.mock('@/services/commentStorage', () => ({
  CommentStorage: mocks.commentStorage,
}));

// Mock findAndReplaceDOMText
vi.mock('@/apps/textSelectionToolbar/findAndReplaceDOMText', () => ({
  default: mocks.findAndReplaceDOMText,
}));

// Mock utils
vi.mock('@/utils', () => ({
  showSuccessMessage: mocks.showSuccessMessage,
}));

// Mock lazy loaded components to resolve immediately
vi.mock('@/apps/textSelectionToolbar/preact/TranslationPanel', () => ({
  default: ({ visible, content, status, position, shakeKey, onClose }: any) => {
    if (!visible) return null;
    return h('div', { className: 'translation-panel' }, [
      h('div', { className: 'translation-panel__header' }, 'AI解释'),
      h('div', { className: `translation-panel__body is-${status}` }, content),
    ]);
  },
}));

vi.mock('@/apps/textSelectionToolbar/preact/ReplaceModal', () => ({
  default: ({ visible, onClose, onReplace, searchText }: any) => {
    if (!visible) return null;
    return h('div', { className: 'replace-modal' }, [
      h('button', { className: 'replace-modal__close', onClick: onClose }, '×'),
      h('div', { className: 'replace-modal__body' }, searchText),
    ]);
  },
}));

vi.mock('@/apps/textSelectionToolbar/preact/CommentModal', () => ({
  default: ({ visible, onClose, onSave, onDelete, selectedText }: any) => {
    if (!visible) return null;
    return h('div', { className: 'comment-modal' }, [
      h('textarea', { className: 'comment-textarea' }),
      h('div', { className: 'comment-modal-footer' }, [
        h('button', { className: 'btn-primary', onClick: () => onSave?.({ text: selectedText, comment: 'test' }) }, '保存'),
      ]),
    ]);
  },
}));

vi.mock('@/apps/textSelectionToolbar/preact/CommentDisplay', () => ({
  default: ({ visible, comment, onClose, onEdit }: any) => {
    if (!visible) return null;
    return h('div', { className: 'comment-display' }, [
      h('div', { className: 'comment-display__content' }, comment?.comment),
    ]);
  },
}));

describe('App 组件', () => {
  const mockTools: TextTool[] = [
    { id: 'copy', label: '复制', handler: vi.fn() },
    { id: 'translate', label: '问AI', handler: vi.fn() },
    { id: 'comment', label: '留言', handler: vi.fn() },
    { id: 'search', label: '搜索', handler: vi.fn() },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该渲染根容器', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      const root = document.querySelector('.toolbar-root');
      expect(root).toBeTruthy();
    });

    it('不可见时不应该渲染工具栏内容', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      const toolbar = document.querySelector('.text-selection-toolbar');
      expect(toolbar).toBeNull();
    });
  });

  describe('TranslationPanel 渲染', () => {
    it('初始状态下不应该有翻译面板', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      const panels = document.querySelectorAll('.translation-panel');
      expect(panels.length).toBe(0);
    });
  });

  describe('Modal 组件渲染', () => {
    it('初始状态下不显示替换模态框', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      const modal = document.querySelector('.replace-modal');
      expect(modal).toBeNull();
    });

    it('初始状态下不显示评论模态框', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      const modal = document.querySelector('.comment-modal');
      expect(modal).toBeNull();
    });

    it('初始状态下不显示评论展示面板', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      const display = document.querySelector('.comment-display');
      expect(display).toBeNull();
    });
  });

  describe('组件注册', () => {
    it('应该在挂载时注册组件到 componentManager', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      expect(mocks.componentManager.register).toHaveBeenCalledWith(
        'TextSelectionToolbar',
        expect.objectContaining({
          show: expect.any(Function),
          hide: expect.any(Function),
        })
      );
    });

    it('应该提供所有必要的方法', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      expect(typeof methods.show).toBe('function');
      expect(typeof methods.hide).toBe('function');
      expect(typeof methods.updateText).toBe('function');
      expect(typeof methods.showWithIframeText).toBe('function');
      expect(typeof methods.showTranslationPanel).toBe('function');
      expect(typeof methods.updateTranslationPanel).toBe('function');
      expect(typeof methods.shakeTranslationPanelBySourceText).toBe('function');
      expect(typeof methods.hideTranslationPanel).toBe('function');
      expect(typeof methods.showReplaceModal).toBe('function');
      expect(typeof methods.showCommentModal).toBe('function');
    });

    it('卸载时应该注销组件', () => {
      const { unmount } = render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      unmount();
      
      expect(mocks.componentManager.unregister).toHaveBeenCalledWith('TextSelectionToolbar');
    });
  });

  describe('状态管理', () => {
    it('应该能通过 updateText 更新文本', () => {
      render(
        h(App, {
          initialText: '初始文本',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.updateText('新文本');
      });
      
      act(() => {
        methods.show();
      });
    });

    it('应该能通过 show 和 hide 控制可见性', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.show();
      });
      
      const toolbar = document.querySelector('.text-selection-toolbar');
      expect(toolbar).toBeTruthy();
      
      act(() => {
        methods.hide();
      });
    });
  });

  describe('TranslationPanel 管理', () => {
    it('应该能添加翻译面板', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.showTranslationPanel({
          messageId: 'msg-1',
          content: '正在翻译...',
          status: 'loading',
        });
      });
      
      const panels = document.querySelectorAll('.translation-panel');
      expect(panels.length).toBe(1);
    });

    it('应该能更新翻译面板内容', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.showTranslationPanel({
          messageId: 'msg-1',
          content: '正在翻译...',
          status: 'loading',
        });
      });
      
      act(() => {
        methods.updateTranslationPanel({
          messageId: 'msg-1',
          content: '翻译完成',
          status: 'success',
        });
      });
      
      const panel = document.querySelector('.translation-panel__body');
      expect(panel!.textContent).toContain('翻译完成');
    });

    it('应该能隐藏翻译面板', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.showTranslationPanel({
          messageId: 'msg-1',
          content: '测试',
        });
      });
      
      expect(document.querySelectorAll('.translation-panel').length).toBe(1);
      
      act(() => {
        methods.hideTranslationPanel('msg-1');
      });
      
      expect(document.querySelectorAll('.translation-panel').length).toBe(0);
    });

    it('应该能隐藏所有翻译面板', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.showTranslationPanel({
          messageId: 'msg-1',
          content: '面板1',
        });
        methods.showTranslationPanel({
          messageId: 'msg-2',
          content: '面板2',
        });
      });
      
      expect(document.querySelectorAll('.translation-panel').length).toBe(2);
      
      act(() => {
        methods.hideTranslationPanel();
      });
      
      expect(document.querySelectorAll('.translation-panel').length).toBe(0);
    });
  });

  describe('ReplaceModal 管理', () => {
    it('应该能显示替换模态框', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.showReplaceModal('要替换的文本');
      });
      
      const modal = document.querySelector('.replace-modal');
      expect(modal).toBeTruthy();
    });

    it('关闭替换模态框应该触发 onClose', async () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.showReplaceModal('要替换的文本');
      });
      
      const closeBtn = document.querySelector('.replace-modal__close');
      await fireEvent.click(closeBtn!);
      
      const modal = document.querySelector('.replace-modal');
      expect(modal).toBeNull();
    });
  });

  describe('CommentModal 管理', () => {
    it('应该能显示评论模态框', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.showCommentModal('选中的文本', undefined);
      });
      
      const modal = document.querySelector('.comment-modal');
      expect(modal).toBeTruthy();
    });

    it('保存评论应该调用 CommentStorage', async () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.showCommentModal('选中的文本', undefined);
      });
      
      const textarea = document.querySelector('.comment-textarea');
      await fireEvent.input(textarea!, { target: { value: '我的留言' } });
      
      const saveBtn = document.querySelector('.comment-modal-footer .btn-primary');
      await fireEvent.click(saveBtn!);
      
      expect(mocks.commentStorage.saveComment).toHaveBeenCalled();
    });
  });

  describe('事件总线', () => {
    it('应该监听 update:toolbar:tools 事件', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      expect(mocks.eventManager.useBus).toHaveBeenCalledWith(
        'update:toolbar:tools',
        expect.any(Function)
      );
    });
  });

  describe('localStorage 状态持久化', () => {
    it('应该在初始化时加载保存的状态', () => {
      const mockStorage = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockStorage);
      
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      vi.unstubAllGlobals();
    });
  });

  describe('边界情况', () => {
    it('空工具列表应该正常工作', () => {
      render(
        h(App, {
          initialText: '',
          customTools: [],
        })
      );
      
      const toolbar = document.querySelector('.toolbar-root');
      expect(toolbar).toBeTruthy();
    });

    it('无初始文本应该正常工作', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const toolbar = document.querySelector('.toolbar-root');
      expect(toolbar).toBeTruthy();
    });

    it('showCloseBtn 默认为 true', () => {
      render(
        h(App, {
          initialText: '',
          customTools: mockTools,
        })
      );
      
      const registerCall = mocks.componentManager.register.mock.calls[0];
      const methods = registerCall[1];
      
      act(() => {
        methods.show();
      });
      
      const closeBtn = document.querySelector('.close-btn');
      expect(closeBtn).toBeTruthy();
    });
  });
});
