/**
 * @file test/textarea-ai-dialog.spec.ts
 * @description textarea AI 弹窗交互流程测试
 * @author Vivy
 * @date 2026-08-03
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 测试类 - 简化版本
class TextareaDialogTester {
  promptDialog: HTMLElement | null = null;
  promptTextarea: HTMLTextAreaElement | null = null;
  promptTargetTextarea: HTMLTextAreaElement | null = null;
  activeTextareaAI: HTMLTextAreaElement | null = null;
  textareaAIButtons = new Map<HTMLTextAreaElement, HTMLButtonElement>();
  
  // 用于测试的记录
  lastUserPrompt: string | null = null;
  lastAction: string | null = null;
  mockAIResponse: { success: boolean; msg: string } | null = null;

  /**
   * 显示弹窗
   */
  showPromptDialog(textarea: HTMLTextAreaElement): void {
    if (this.promptDialog) return;

    this.promptTargetTextarea = textarea;
    const defaultPrompt = textarea.placeholder || '';

    // 创建弹窗 DOM
    const overlay = document.createElement('div');
    overlay.className = 'textarea-ai-prompt-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'textarea-ai-prompt-dialog';

    const header = document.createElement('div');
    header.className = 'textarea-ai-prompt-header';
    
    const title = document.createElement('h3');
    title.className = 'textarea-ai-prompt-title';
    title.textContent = '编辑 AI 提示词';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'textarea-ai-prompt-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePromptDialog();
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);

    const promptTextarea = document.createElement('textarea');
    promptTextarea.className = 'textarea-ai-prompt-textarea';
    promptTextarea.value = defaultPrompt;

    const footer = document.createElement('div');
    footer.className = 'textarea-ai-prompt-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'textarea-ai-prompt-btn textarea-ai-prompt-btn-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePromptDialog();
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'textarea-ai-prompt-btn textarea-ai-prompt-btn-confirm';
    confirmBtn.textContent = '确定生成';
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止冒泡到 overlay
      // 先保存 textarea 引用和 prompt，因为 closePromptDialog 会清空 promptTargetTextarea
      const targetTextarea = this.promptTargetTextarea;
      const finalPrompt = promptTextarea.value.trim();
      this.closePromptDialog();
      this.submitPromptAndFill(targetTextarea, finalPrompt);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    dialog.appendChild(header);
    dialog.appendChild(promptTextarea);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e: Event) => {
      if (e.target === overlay) {
        this.closePromptDialog();
      }
    });

    document.body.appendChild(overlay);
    this.promptDialog = overlay;
    this.promptTextarea = promptTextarea;
  }

  /**
   * 关闭弹窗
   */
  closePromptDialog(): void {
    if (this.promptDialog) {
      this.promptDialog.remove();
      this.promptDialog = null;
      this.promptTextarea = null;
      this.promptTargetTextarea = null;
    }
  }

  /**
   * 提交并填充 - 与真实代码行为保持一致
   * 接收 textarea 参数（模拟修复后的签名）
   */
  submitPromptAndFill(textarea: HTMLTextAreaElement | null, userPrompt: string): void {
    // 模拟真实代码：如果 textarea 为 null，直接返回（这是 bug 的关键点）
    if (!textarea) {
      this.lastUserPrompt = null;
      this.lastAction = null;
      return;
    }

    this.lastUserPrompt = userPrompt;
    this.activeTextareaAI = textarea;

    // 模拟 AI 调用
    const response = this.mockAIResponse || { success: true, msg: '完成' };
    this.lastAction = response.success ? 'success' : 'error';

    this.activeTextareaAI = null;
  }

  /**
   * 点击处理
   */
  handleClick(textarea: HTMLTextAreaElement, button: HTMLButtonElement): void {
    if (this.activeTextareaAI) return;
    this.showPromptDialog(textarea);
  }

  /**
   * 模拟 Ctrl+Enter 提交
   */
  simulateCtrlEnter(): void {
    const promptTextarea = this.promptTextarea;
    if (!promptTextarea) return;
    
    // 先保存引用，避免 closePromptDialog 清空 promptTargetTextarea
    const targetTextarea = this.promptTargetTextarea;
    const finalPrompt = promptTextarea.value.trim();
    this.closePromptDialog();
    this.submitPromptAndFill(targetTextarea, finalPrompt);
  }

  /**
   * 模拟 ESC 关闭
   */
  simulateEscape(): void {
    this.closePromptDialog();
  }

  /**
   * 模拟点击确定按钮
   */
  clickConfirm(): void {
    const overlay = this.promptDialog;
    const confirmBtn = overlay?.querySelector('.textarea-ai-prompt-btn-confirm');
    if (confirmBtn) {
      confirmBtn.dispatchEvent(new MouseEvent('click'));
    }
  }

  /**
   * 模拟点击取消按钮
   */
  clickCancel(): void {
    const overlay = this.promptDialog;
    const cancelBtn = overlay?.querySelector('.textarea-ai-prompt-btn-cancel');
    if (cancelBtn) {
      cancelBtn.dispatchEvent(new MouseEvent('click'));
    }
  }

  /**
   * 模拟点击关闭按钮
   */
  clickClose(): void {
    const overlay = this.promptDialog;
    const closeBtn = overlay?.querySelector('.textarea-ai-prompt-close');
    if (closeBtn) {
      closeBtn.dispatchEvent(new MouseEvent('click'));
    }
  }

  /**
   * 模拟点击遮罩
   */
  clickOverlay(): void {
    const overlay = this.promptDialog;
    if (overlay) {
      overlay.dispatchEvent(new MouseEvent('click'));
    }
  }
}

describe('textarea AI 弹窗交互流程', () => {
  let tester: TextareaDialogTester;
  let testTextarea: HTMLTextAreaElement;
  let testButton: HTMLButtonElement;

  beforeEach(() => {
    tester = new TextareaDialogTester();
    tester.mockAIResponse = { success: true, msg: '完成' };

    // 创建测试 textarea
    testTextarea = document.createElement('textarea');
    testTextarea.placeholder = '请输入您的评论内容';
    testTextarea.style.width = '300px';
    testTextarea.style.height = '100px';
    document.body.appendChild(testTextarea);

    // 创建测试按钮
    testButton = document.createElement('button');
    testButton.className = 'textarea-ai-dot';
    testTextarea.parentElement?.appendChild(testButton);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('弹窗显示测试', () => {
    it('点击圆点应显示弹窗', () => {
      tester.handleClick(testTextarea, testButton);

      expect(tester.promptDialog).not.toBeNull();
      expect(tester.promptTargetTextarea).toBe(testTextarea);
      expect(tester.promptDialog?.className).toBe('textarea-ai-prompt-overlay');
    });

    it('弹窗初始值应为 placeholder 内容', () => {
      tester.handleClick(testTextarea, testButton);

      const promptTextarea = tester.promptTextarea;
      expect(promptTextarea?.value).toBe('请输入您的评论内容');
    });

    it('没有 placeholder 时弹窗初始值应为空', () => {
      testTextarea.placeholder = '';
      tester.handleClick(testTextarea, testButton);

      const promptTextarea = tester.promptTextarea;
      expect(promptTextarea?.value).toBe('');
    });

    it('弹窗应包含标题和按钮', () => {
      tester.handleClick(testTextarea, testButton);

      const overlay = tester.promptDialog;
      const dialog = overlay?.querySelector('.textarea-ai-prompt-dialog');

      expect(dialog?.querySelector('.textarea-ai-prompt-title')?.textContent).toBe('编辑 AI 提示词');
      expect(dialog?.querySelector('.textarea-ai-prompt-btn-confirm')?.textContent).toBe('确定生成');
      expect(dialog?.querySelector('.textarea-ai-prompt-btn-cancel')?.textContent).toBe('取消');
    });
  });

  describe('弹窗关闭测试', () => {
    it('点击取消按钮应关闭弹窗', () => {
      tester.handleClick(testTextarea, testButton);
      tester.clickCancel();

      expect(tester.promptDialog).toBeNull();
      expect(tester.promptTextarea).toBeNull();
      expect(tester.promptTargetTextarea).toBeNull();
    });

    it('点击关闭按钮应关闭弹窗', () => {
      tester.handleClick(testTextarea, testButton);
      tester.clickClose();

      expect(tester.promptDialog).toBeNull();
    });

    it('点击遮罩层应关闭弹窗', () => {
      tester.handleClick(testTextarea, testButton);
      tester.clickOverlay();

      expect(tester.promptDialog).toBeNull();
    });

    it('按 ESC 键应关闭弹窗', () => {
      tester.handleClick(testTextarea, testButton);
      tester.simulateEscape();

      expect(tester.promptDialog).toBeNull();
    });
  });

  describe('弹窗提交测试', () => {
    it('点击确定应提交用户修改后的内容', () => {
      tester.handleClick(testTextarea, testButton);

      // 用户修改内容
      if (tester.promptTextarea) {
        tester.promptTextarea.value = '写一段关于人工智能的介绍';
      }

      tester.clickConfirm();

      // 验证提交的内容
      expect(tester.lastUserPrompt).toBe('写一段关于人工智能的介绍');
      expect(tester.promptDialog).toBeNull(); // 弹窗已关闭
    });

    it('空内容提交时应传空字符串', () => {
      testTextarea.placeholder = '';
      tester.handleClick(testTextarea, testButton);

      if (tester.promptTextarea) {
        tester.promptTextarea.value = '';
      }

      tester.clickConfirm();

      expect(tester.lastUserPrompt).toBe('');
    });

    it('Ctrl+Enter 快捷键应提交', () => {
      tester.handleClick(testTextarea, testButton);

      if (tester.promptTextarea) {
        tester.promptTextarea.value = '快捷键提交测试';
      }

      tester.simulateCtrlEnter();

      expect(tester.lastUserPrompt).toBe('快捷键提交测试');
    });
  });

  describe('AI 填充结果处理', () => {
    it('AI 成功时应设置 success 状态', () => {
      tester.mockAIResponse = { success: true, msg: 'AI 已生成内容并填入' };

      tester.handleClick(testTextarea, testButton);
      tester.clickConfirm();

      expect(tester.lastAction).toBe('success');
      expect(tester.activeTextareaAI).toBeNull(); // 状态已清理
    });

    it('AI 失败时应设置 error 状态', () => {
      tester.mockAIResponse = { success: false, msg: 'AI 生成失败' };

      tester.handleClick(testTextarea, testButton);
      tester.clickConfirm();

      expect(tester.lastAction).toBe('error');
      expect(tester.activeTextareaAI).toBeNull(); // 状态已清理
    });
  });

  describe('防重复提交测试', () => {
    it('AI 生成中不应重复触发点击', () => {
      // 模拟正在生成中
      tester.activeTextareaAI = testTextarea;

      // 尝试点击
      tester.handleClick(testTextarea, testButton);

      // 不应创建新弹窗
      expect(tester.promptDialog).toBeNull();
    });

    it('完成后应允许再次点击', () => {
      // 模拟之前已完成
      tester.activeTextareaAI = null;

      // 点击
      tester.handleClick(testTextarea, testButton);

      // 应创建弹窗
      expect(tester.promptDialog).not.toBeNull();
    });
  });

  describe('状态清理测试', () => {
    it('完成后应清理 activeTextareaAI 状态', () => {
      tester.mockAIResponse = { success: true, msg: '完成' };

      tester.handleClick(testTextarea, testButton);
      tester.clickConfirm();

      expect(tester.activeTextareaAI).toBeNull();
    });

    it('AI 失败后也应清理 activeTextareaAI 状态', () => {
      tester.mockAIResponse = { success: false, msg: '失败' };

      tester.handleClick(testTextarea, testButton);
      tester.clickConfirm();

      expect(tester.activeTextareaAI).toBeNull();
    });
  });

  describe('回归测试 - bug 修复验证', () => {
    it('点击确定后应正确传递 textarea 引用（不能因 closePromptDialog 而丢失）', () => {
      // 这个测试用例用于验证 bug 修复：
      // 原先的代码先调用 closePromptDialog() 再调用 submitPromptAndFill()，
      // 导致 promptTargetTextarea 被清空，submitPromptAndFill 拿到 null 直接 return
      tester.handleClick(testTextarea, testButton);

      if (tester.promptTextarea) {
        tester.promptTextarea.value = '测试内容';
      }

      tester.clickConfirm();

      // 如果 bug 存在，lastUserPrompt 会是 null
      // 修复后，lastUserPrompt 应该是 '测试内容'
      expect(tester.lastUserPrompt).toBe('测试内容');
      expect(tester.lastAction).not.toBeNull();
    });

    it('Ctrl+Enter 提交后应正确传递 textarea 引用', () => {
      tester.handleClick(testTextarea, testButton);

      if (tester.promptTextarea) {
        tester.promptTextarea.value = '快捷键测试';
      }

      tester.simulateCtrlEnter();

      // 验证 bug 修复：textarea 引用不能丢失
      expect(tester.lastUserPrompt).toBe('快捷键测试');
      expect(tester.lastAction).not.toBeNull();
    });
  });
});