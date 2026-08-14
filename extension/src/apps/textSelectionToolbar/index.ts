/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/apps/textSelectionToolbar/index-preact.ts
 * @description Preact 版本的文本选择工具栏入口
 */

import { AppModule } from "@/types/index.js";
import { shadowRoot, setShadowRoot } from "@/utils/shadow-dom";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import { createShadowHost, injectCssDom } from "@/utils/shadow-dom";
import { storage } from "@/stores";
import {
  debounce,
  ElementPositionInfo,
  addElementToDom,
  PositionStrategy,
} from "@/utils";
import toast from "@/utils/toast";
import { componentManager } from "@/utils/componentManager";
import { TextTool } from "@/types";
import { getAssetsAbstractPathSync } from "@/utils/common";
import { generateId } from "@/utils/base";
import { BookmarkStorage } from "@/services/bookmarkStorage";
import { loadAIConfig } from "@/utils/ai-config";
import { fillTextareaElementByAI } from "./textarea-ai";
import React from "react";

const appName = "textSelectionToolbar";

const TRANSLATOR_ROLE_PREFIX = "translator";

/**
 * 获取翻译会话角色
 */
const getTranslationSessionRole = (): string => {
  const hostname = location.hostname.trim().toLowerCase();
  const fallbackScope = location.protocol.replace(/:$/, "") || "page";
  const scope = hostname || fallbackScope;
  const safeScope = scope.replace(/[^a-z0-9.-]/g, "_");
  return `${TRANSLATOR_ROLE_PREFIX}_${safeScope}`;
};

/**
 * 创建翻译流端口
 */
const createTranslationStreamPort = (messageId: string) => {
  const port = chrome.runtime.connect({ name: `ai-conversation-${messageId}` });
  maLogger.log("创建端口连接成功:", port);
  return port;
};

type OnStreamUpdate = (content: string, status: TranslationPanelStatus) => void;

/**
 * 设置翻译流处理器
 */
const setupTranslationStreamHandlers = (
  port: chrome.runtime.Port,
  messageId: string,
  onUpdate: OnStreamUpdate,
): string => {
  let fullTranslation = "";

  const getStatusForType = (type: string): TranslationPanelStatus | null => {
    if (type === "AI_CONVERSATION_STREAM_DATA") {
      return "success";
    }
    if (type === "AI_CONVERSATION_ERROR") {
      return "error";
    }
    return null;
  };

  port.onMessage.addListener((msg) => {
    maLogger.log("收到端口消息:", msg);
    if (msg.payload?.messageId !== messageId) {
      return;
    }

    const status = getStatusForType(msg.type);

    if (msg.type === "AI_CONVERSATION_STREAM_DATA" && status) {
      fullTranslation += msg.payload.content;
      maLogger.log("收到流式数据:", msg.payload.content);
      onUpdate(fullTranslation, status);
    } else if (msg.type === "AI_CONVERSATION_ERROR" && status) {
      maLogger.log("收到错误消息:", msg.payload.error);
      onUpdate(`翻译失败: ${msg.payload.error}`, status);
    } else if (msg.type === "AI_CONVERSATION_COMPLETE") {
      maLogger.log("收到完成消息");
      port.disconnect();
    }
  });

  port.onDisconnect.addListener(() => maLogger.log("端口已断开连接"));
  return fullTranslation;
};

/**
 * 文本选择工具栏选项接口
 */
declare interface TextSelectionToolbarOptions {
  enabled?: boolean;
  tools?: TextTool[];
  brandColor?: string;
  textareaAI?: boolean;
}

type TranslationPanelStatus = "loading" | "success" | "error";

interface TranslationPanelPosition {
  left: number;
  top: number;
}

interface TranslationPanelPayload {
  messageId: string;
  content: string;
  status?: TranslationPanelStatus;
  position?: TranslationPanelPosition;
  sourceText?: string;
}

type TextareaAIDotState = "idle" | "generating" | "filled" | "error";

/**
 * 文本选择工具栏模块 - Preact 版本
 */
class TextSelectionToolbarModule implements AppModule {
  _ctx: AppContext | null = null;
  _root: Root | null = null;
  _instance = null;
  _container: HTMLElement | null = null;
  isInjected: boolean = false;
  isEnabled: boolean = false;
  private isVisible: boolean = false;
  private positionTimer: ReturnType<typeof setTimeout> | null = null;
  private customTools: TextTool[] = [];
  private showCloseBtn: boolean = true;
  private highlightedElements: HTMLElement[] = [];
  private selectedText: string = "";
  private selectionRange: Range | null = null;
  private brandColor: string = "#ff0dc5";
  private textareaAIEnabled: boolean = true;
  private textareaAIButtons = new Map<HTMLTextAreaElement, HTMLButtonElement>();
  private textareaAIObserver: MutationObserver | null = null;
  private textareaAIPositionTimer: number | null = null;
  private activeTextareaAI: HTMLTextAreaElement | null = null;
  private readonly textareaAIStyleId =
    "text-selection-toolbar-textarea-ai-style";
  private promptDialog: HTMLElement | null = null;
  private promptTextarea: HTMLTextAreaElement | null = null;
  private promptTargetTextarea: HTMLTextAreaElement | null = null;

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private getTranslationPanelPosition(): TranslationPanelPosition {
    const margin = 12;
    const selectionRect = this.selectionRange?.getBoundingClientRect() ?? null;
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const panelWidth = Math.min(560, viewportWidth - margin * 2);
    const panelHeight = Math.min(320, viewportHeight - margin * 2);

    let left = 100;
    let top = 100;

    if (selectionRect) {
      left = selectionRect.left + selectionRect.width / 2 - panelWidth / 2;

      const preferredTop = selectionRect.bottom + 12;
      const fallbackTop = selectionRect.top - panelHeight - 12;
      top =
        preferredTop + panelHeight + margin <= viewportHeight
          ? preferredTop
          : fallbackTop;
    }

    const maxLeft = Math.max(margin, viewportWidth - panelWidth - margin);
    const maxTop = Math.max(margin, viewportHeight - panelHeight - margin);

    return {
      left: Math.round(this.clamp(left, margin, maxLeft)),
      top: Math.round(this.clamp(top, margin, maxTop)),
    };
  }

  private showTranslationPanel(payload: TranslationPanelPayload): void {
    componentManager.call(
      "TextSelectionToolbar",
      "showTranslationPanel",
      payload,
    );
  }

  private updateTranslationPanel(payload: TranslationPanelPayload): void {
    componentManager.call(
      "TextSelectionToolbar",
      "updateTranslationPanel",
      payload,
    );
  }

  private shakeTranslationPanelBySourceText(sourceText: string): boolean {
    return !!componentManager.call(
      "TextSelectionToolbar",
      "shakeTranslationPanelBySourceText",
      sourceText,
    );
  }

  /**
   * 处理翻译功能
   */
  private async handleTranslation(text: string): Promise<void> {
    const textToTranslate = (text || this.selectedText).trim();
    if (!textToTranslate) {
      return;
    }
    if (this.shakeTranslationPanelBySourceText(textToTranslate)) {
      maLogger.log("命中已存在的翻译面板，触发抖动提示:", textToTranslate);
      return;
    }

    const messageId = generateId();
    maLogger.log("翻译开始执行，文本:", textToTranslate);

    try {
      this.showTranslationPanel({
        messageId,
        content: "正在翻译...",
        status: "loading",
        position: this.getTranslationPanelPosition(),
        sourceText: textToTranslate,
      });

      const port = createTranslationStreamPort(messageId);

      setupTranslationStreamHandlers(port, messageId, (content, status) => {
        this.updateTranslationPanel({ messageId, content, status });
      });

      const aiConfig = await loadAIConfig();

      port.postMessage({
        type: "START_AI_CONVERSATION",
        payload: {
          prompt: `请先将以下文本翻译成中文，并结合对话上下文附带简短的解释：\n\n${textToTranslate}`,
          role: getTranslationSessionRole(),
          provider: aiConfig.provider,
          model: aiConfig.modelId,
          apiKey: aiConfig.apiKey,
          apiBaseUrl: aiConfig.apiBaseUrl,
        },
      });
      maLogger.log("翻译请求已发送");
    } catch (error) {
      maLogger.error("翻译失败:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isConnectError =
        String(error).includes("端口") || String(error).includes("connect");
      const panelUpdate = {
        messageId,
        content: `${isConnectError ? "连接" : "翻译"}失败: ${errorMsg}`,
        status: "error",
      } as const;
      isConnectError
        ? this.updateTranslationPanel(panelUpdate)
        : this.showTranslationPanel({
            ...panelUpdate,
            position: this.getTranslationPanelPosition(),
          });
    }
  }

  /**
   * 处理书签功能
   */
  private async handleBookmark(sourceText?: string): Promise<void> {
    const text = (sourceText || this.selectedText).trim();
    maLogger.log("书签开始执行，文本:", text);

    try {
      if (!text || text.trim().length === 0) {
        maLogger.warn("书签保存失败：文本为空");
        return;
      }

      const url = window.location.href;
      const title = document.title;
      const scrollPosition = {
        x: window.pageXOffset || document.documentElement.scrollLeft,
        y: window.pageYOffset || document.documentElement.scrollTop,
      };

      maLogger.log("保存书签信息:", { text, url, title, scrollPosition });

      const bookmark = await BookmarkStorage.saveBookmark({
        text,
        url,
        title,
        scrollPosition,
      });

      maLogger.log("书签保存成功:", bookmark);
      toast.success("书签保存成功！");
    } catch (error) {
      maLogger.error("书签保存失败:", error);
      toast.error("书签保存失败，请稍后重试！");
    }
  }

  private isTextareaAICandidate(textarea: HTMLTextAreaElement): boolean {
    if (textarea.disabled || textarea.readOnly) {
      return false;
    }

    const style = window.getComputedStyle(textarea);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect = textarea.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  private setTextareaAIDotState(
    button: HTMLButtonElement,
    state: TextareaAIDotState,
    message?: string,
  ): void {
    button.dataset.state = state;
    const labels: Record<TextareaAIDotState, string> = {
      idle: "使用 AI 填写此 textarea",
      generating: "AI 正在填写此 textarea",
      filled: "AI 已填写此 textarea",
      error: "AI 填写失败，点击重试",
    };
    button.setAttribute("aria-label", message || labels[state]);
    button.title = message || labels[state];
  }

  private positionTextareaAIDot(
    textarea: HTMLTextAreaElement,
    button: HTMLButtonElement,
  ): void {
    const rect = textarea.getBoundingClientRect();
    const offset = 6;
    button.style.left = `${Math.round(rect.right - button.offsetWidth - offset)}px`;
    button.style.top = `${Math.round(rect.top + offset)}px`;
  }

  private createTextareaAIDot(
    textarea: HTMLTextAreaElement,
  ): HTMLButtonElement | null {
    if (!shadowRoot) {
      return null;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "textarea-ai-dot";
    this.setTextareaAIDotState(button, "idle");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handleTextareaAIClick(textarea, button);
    });

    shadowRoot.appendChild(button);
    return button;
  }

  private syncTextareaAIDots = (): void => {
    if (!this.textareaAIEnabled || !shadowRoot || !document.body) {
      return;
    }

    const candidates = new Set(
      Array.from(
        document.querySelectorAll<HTMLTextAreaElement>("textarea"),
      ).filter((textarea) => this.isTextareaAICandidate(textarea)),
    );

    for (const [textarea, button] of this.textareaAIButtons) {
      if (!candidates.has(textarea) || !textarea.isConnected) {
        button.remove();
        this.textareaAIButtons.delete(textarea);
      }
    }

    for (const textarea of candidates) {
      let button = this.textareaAIButtons.get(textarea);
      if (!button) {
        button = this.createTextareaAIDot(textarea) || undefined;
        if (!button) {
          continue;
        }
        this.textareaAIButtons.set(textarea, button);
      }
      this.positionTextareaAIDot(textarea, button);
    }
  };

  private scheduleTextareaAIDotSync = (): void => {
    if (this.textareaAIPositionTimer) {
      clearTimeout(this.textareaAIPositionTimer);
    }
    this.textareaAIPositionTimer = window.setTimeout(() => {
      this.textareaAIPositionTimer = null;
      this.syncTextareaAIDots();
    }, 80);
  };

  /**
   * 显示 Prompt 编辑弹窗
   */
  private showPromptDialog(textarea: HTMLTextAreaElement): void {
    if (this.promptDialog) {
      return;
    }

    this.promptTargetTextarea = textarea;
    const defaultPrompt = textarea.placeholder || "";

    const overlay = document.createElement("div");
    overlay.className = "textarea-ai-prompt-overlay";

    const dialog = document.createElement("div");
    dialog.className = "textarea-ai-prompt-dialog";

    const header = document.createElement("div");
    header.className = "textarea-ai-prompt-header";

    const title = document.createElement("h3");
    title.className = "textarea-ai-prompt-title";
    title.textContent = "编辑 AI 提示词";

    const closeBtn = document.createElement("button");
    closeBtn.className = "textarea-ai-prompt-close";
    closeBtn.textContent = "✕";
    closeBtn.title = "关闭";
    closeBtn.addEventListener("click", () => this.closePromptDialog());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const promptTextarea = document.createElement("textarea");
    promptTextarea.className = "textarea-ai-prompt-textarea";
    promptTextarea.value = defaultPrompt;
    promptTextarea.spellcheck = false;

    const footer = document.createElement("div");
    footer.className = "textarea-ai-prompt-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.className =
      "textarea-ai-prompt-btn textarea-ai-prompt-btn-cancel";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => this.closePromptDialog());

    const confirmBtn = document.createElement("button");
    confirmBtn.className =
      "textarea-ai-prompt-btn textarea-ai-prompt-btn-confirm";
    confirmBtn.textContent = "确定生成";
    confirmBtn.addEventListener("click", () => {
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

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.closePromptDialog();
      }
    });

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.closePromptDialog();
        document.removeEventListener("keydown", handleKeydown);
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        const targetTextarea = this.promptTargetTextarea;
        const finalPrompt = promptTextarea.value.trim();
        this.closePromptDialog();
        document.removeEventListener("keydown", handleKeydown);
        this.submitPromptAndFill(targetTextarea, finalPrompt);
      }
    };
    document.addEventListener("keydown", handleKeydown);

    if (!shadowRoot) {
      return;
    }

    shadowRoot.appendChild(overlay);
    this.promptDialog = overlay;
    this.promptTextarea = promptTextarea;

    setTimeout(() => {
      promptTextarea.focus();
    }, 100);
  }

  /**
   * 关闭 Prompt 编辑弹窗
   */
  private closePromptDialog(): void {
    if (this.promptDialog) {
      this.promptDialog.remove();
      this.promptDialog = null;
      this.promptTextarea = null;
      this.promptTargetTextarea = null;
    }
  }

  /**
   * 提交 Prompt 并执行 AI 填充
   */
  private async submitPromptAndFill(
    textarea: HTMLTextAreaElement | null,
    userPrompt: string,
  ): Promise<void> {
    if (!textarea) {
      return;
    }

    this.activeTextareaAI = textarea;
    const button = this.textareaAIButtons.get(textarea);
    if (button) {
      this.setTextareaAIDotState(button, "generating");
    }

    try {
      const result = await fillTextareaElementByAI(
        textarea,
        userPrompt || undefined,
      );
      if (result.success && button) {
        this.setTextareaAIDotState(button, "filled", result.msg);
        toast.success(result.msg);
      } else if (button) {
        this.setTextareaAIDotState(button, "error", result.msg);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (button) {
        this.setTextareaAIDotState(button, "error", message);
      }
      maLogger.warn("[TextSelectionToolbar] textarea AI 填写失败:", message);
    } finally {
      this.activeTextareaAI = null;
      this.scheduleTextareaAIDotSync();
    }
  }

  private async handleTextareaAIClick(
    textarea: HTMLTextAreaElement,
    button: HTMLButtonElement,
  ): Promise<void> {
    if (this.activeTextareaAI) {
      return;
    }

    this.showPromptDialog(textarea);
  }

  private enableTextareaAI(): void {
    if (!this.textareaAIEnabled) {
      return;
    }

    this.syncTextareaAIDots();

    if (!this.textareaAIObserver && document.body) {
      this.textareaAIObserver = new MutationObserver(
        this.scheduleTextareaAIDotSync,
      );
      this.textareaAIObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "placeholder",
          "disabled",
          "readonly",
        ],
      });
    }

    window.addEventListener("resize", this.scheduleTextareaAIDotSync);
    window.addEventListener("scroll", this.scheduleTextareaAIDotSync, true);
    document.addEventListener("focusin", this.scheduleTextareaAIDotSync);
  }

  private disableTextareaAI(): void {
    if (this.textareaAIPositionTimer) {
      clearTimeout(this.textareaAIPositionTimer);
      this.textareaAIPositionTimer = null;
    }

    this.textareaAIObserver?.disconnect();
    this.textareaAIObserver = null;
    window.removeEventListener("resize", this.scheduleTextareaAIDotSync);
    window.removeEventListener("scroll", this.scheduleTextareaAIDotSync, true);
    document.removeEventListener("focusin", this.scheduleTextareaAIDotSync);
    this.textareaAIButtons.forEach((button) => button.remove());
    this.textareaAIButtons.clear();
    this.activeTextareaAI = null;
  }

  constructor(options?: TextSelectionToolbarOptions) {
    //@ts-ignore
    this.customTools = options?.tools || [
      {
        id: "copy",
        label: "复制",
        handler: (text: string) => {
          const textToCopy = text || this.selectedText;
          navigator.clipboard
            .writeText(textToCopy)
            .then(() => toast.success("复制成功！"))
            .catch((err) => {
              toast.success(`复制失败: ${err}`);
            });
        },
      },
      {
        id: "comment",
        label: "留言",
        handler: (text: string) => {
          const textToComment = text || this.selectedText;
          if (textToComment.trim() && this.selectionRange) {
            const getXPathForNode = (node: Node): string => {
              if (node.nodeType === Node.DOCUMENT_NODE) {
                return "";
              }
              if (node.nodeType === Node.TEXT_NODE) {
                let count = 1;
                let sibling = node.previousSibling;
                while (sibling) {
                  if (sibling.nodeType === Node.TEXT_NODE) {
                    count++;
                  }
                  sibling = sibling.previousSibling;
                }
                const parentXPath = node.parentNode
                  ? getXPathForNode(node.parentNode)
                  : "";
                if (parentXPath) {
                  return `${parentXPath}/text()[${count}]`;
                }
                return `/text()[${count}]`;
              }
              let count = 1;
              let sibling = node.previousSibling;
              while (sibling) {
                if (sibling.nodeName === node.nodeName) {
                  count++;
                }
                sibling = sibling.previousSibling;
              }
              const parentXPath = node.parentNode
                ? getXPathForNode(node.parentNode)
                : "";
              const nodeName = node.nodeName.toLowerCase();
              return parentXPath
                ? `${parentXPath}/${nodeName}[${count}]`
                : `/${nodeName}[${count}]`;
            };

            const rangeInfo = {
              startContainerXPath: getXPathForNode(
                this.selectionRange.startContainer,
              ),
              startOffset: this.selectionRange.startOffset,
              endContainerXPath: getXPathForNode(
                this.selectionRange.endContainer,
              ),
              endOffset: this.selectionRange.endOffset,
            };

            componentManager.call(
              "TextSelectionToolbar",
              "showCommentModal",
              textToComment,
              rangeInfo,
            );
          }
        },
      },
      {
        id: "search",
        label: "搜索",
        handler: (text: string) => {
          const textToSearch = text || this.selectedText;
          window.open(
            `https://www.google.com/search?q=${encodeURIComponent(textToSearch)}`,
            "_blank",
          );
        },
      },
      {
        id: "translate",
        label: "问AI",
        handler: (text: string) => this.handleTranslation(text),
      },
      {
        id: "bookmark",
        label: "书签",
        handler: (text: string) => this.handleBookmark(text),
      },
      {
        id: "replace",
        label: "替换",
        handler: (text: string) => {
          const textToReplace = text || this.selectedText;
          componentManager.call(
            "TextSelectionToolbar",
            "showReplaceModal",
            textToReplace,
          );
        },
      },
    ];

    this.brandColor = options?.brandColor || "#007bff";
    this.textareaAIEnabled = options?.textareaAI !== false;
  }

  /**
   * 显示并定位组件
   */
  private showAndPositionComponent = () => {
    if (!shadowRoot || !this._container || !this.selectionRange) {
      maLogger.error("Shadow DOM、Preact 容器或选区不存在");
      return;
    }

    const rect = this.selectionRange.getBoundingClientRect();
    const positionInfo = new ElementPositionInfo({
      rect,
      zIndex: 0,
      scrollX: window.pageXOffset || document.documentElement.scrollLeft,
      scrollY: window.pageYOffset || document.documentElement.scrollTop,
      viewportWidth: window.innerWidth || document.documentElement.clientWidth,
      viewportHeight:
        window.innerHeight || document.documentElement.clientHeight,
    });

    positionInfo.positionElement({
      targetElement: this._container,
      strategy: PositionStrategy.Down,
      alignment: "center",
      offset: { x: 0, y: 10 },
      observeReference: false,
      pinned: true,
    });

    this.clearPositionTimer();
    this.isVisible = true;
    componentManager.call("TextSelectionToolbar", "show");
  };

  /**
   * 隐藏组件
   */
  private hideComponent = () => {
    if (!this._container) {
      return;
    }

    this.isVisible = false;
    componentManager.call("TextSelectionToolbar", "hide");
  };

  /**
   * 清理组件资源
   */
  private cleanupComponent = () => {
    this.clearPositionTimer();

    // 移除容器元素
    if (this._container) {
      try {
        this._container.remove();
      } catch (error) {
        // 元素可能已经被移除
      }
      this._container = null;
    }
  };

  /**
   * 清除位置定时器
   */
  private clearPositionTimer(): void {
    if (this.positionTimer) {
      clearTimeout(this.positionTimer);
      this.positionTimer = null;
    }
  }

  private createTempElement(
    x: number,
    y: number,
    width: number = 10,
    height: number = 10,
  ): HTMLElement {
    const tempElement = document.createElement("span");
    tempElement.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${width}px;
      height: ${height}px;
      pointer-events: none;
    `;
    document.body.appendChild(tempElement);
    return tempElement;
  }

  private removeTempElement(element: HTMLElement): void {
    setTimeout(() => {
      try {
        document.body.removeChild(element);
      } catch (error) {
        // 元素可能已经被移除
      }
    }, 1000);
  }

  // 防抖处理的文本选择事件
  private handleSelectionChange = debounce(() => {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const text = selection.toString().trim();
    this.selectedText = text;
    componentManager.call("TextSelectionToolbar", "updateText", text);

    if (text.length > 0) {
      maLogger.log("用户选中了文本:", text);
      try {
        const range = selection.getRangeAt(0);
        this.selectionRange = range;
        maLogger.log("选中文本的位置:", range.getBoundingClientRect());
      } catch (error) {
        maLogger.error("获取选区位置失败:", error);
      }
    } else {
      maLogger.log("用户取消选择文本");
      this.selectionRange = null;
      this.hideComponent();
    }
  }, 100);

  private handleIframeSelectionChange = debounce((event: CustomEvent) => {
    maLogger.log("收到来自iframe的选择事件:", event);
    const { text, selectionRect } = event.detail;
    this.selectedText = text;
    if (text && text.length > 0 && selectionRect) {
      maLogger.log("iframe中选中的文本:", text);
      maLogger.log("选中文本的位置:", selectionRect);

      const tempElement = this.createTempElement(
        selectionRect.left,
        selectionRect.top,
        selectionRect.width,
        selectionRect.height,
      );

      componentManager.call("TextSelectionToolbar", "updateText", text);

      try {
        const range = document.createRange();
        range.selectNode(tempElement);
        this.selectionRange = range;
        maLogger.log("为iframe选择创建临时Range:", range);
      } catch (error) {
        maLogger.error("创建iframe选择的临时Range失败:", error);
      }

      setTimeout(() => {
        try {
          document.body.removeChild(tempElement);
          this.selectionRange = null;
        } catch (error) {
          // 元素可能已经被移除
        }
      }, 1000);
    }
  }, 300);

  /**
   * 注入文本选择工具栏到页面
   */
  async inject(): Promise<void> {
    try {
      if (window.self !== window.top) {
        maLogger.log("不是主页面，不注入文本选择工具栏");
        return;
      }

      if (!document.body) {
        await new Promise((resolve) => {
          const checkBody = () => {
            if (document.body) {
              resolve(null);
            } else {
              requestAnimationFrame(checkBody);
            }
          };
          checkBody();
        });
      }

      // 注入选中文本样式
      if (!document.head.querySelector("#selection-custom-style")) {
        const selectionStyle = document.createElement("style");
        selectionStyle.id = "selection-custom-style";
        selectionStyle.textContent = `
          ::selection {
            background: transparent;
            color: var(--kria-brand-color);
            text-decoration: underline wavy var(--kria-brand-color);
            text-underline-offset: 4px;
          }
        `;
        document.head.appendChild(selectionStyle);
      }

      // 如果已经注入，则不重复注入
      if (this.isInjected && this._container && this._root && shadowRoot) {
        return;
      }

      if (!this.isInjected) {
        injectCssDom(shadowRoot, getAssetsAbstractPathSync(`css/${appName}`));
        // 注入懒加载组件的 CSS 到 Shadow DOM，避免 Vite preload helper 使用相对路径报错
        // file-map.json 中记录了各懒加载组件的 CSS 路径，通过 injectCssDom 从 chrome-extension:// 加载
        const lazyComponentCssList = [
          "css/TranslationPanel",
          "css/ReplaceModal",
          "css/CommentModal",
          "css/CommentDisplay",
        ];
        lazyComponentCssList.forEach((cssKey) => {
          injectCssDom(shadowRoot, getAssetsAbstractPathSync(cssKey));
        });
        this.isInjected = true;
      }

      // 创建react容器
      if (
        !this._container &&
        !shadowRoot?.getElementById(`shadow-app-${appName}`)
      ) {
        this._container = addElementToDom({
          tag: "div",
          attrs: {
            id: `shadow-app-${appName}`,
          },
          style: "position: fixed; z-index: var(--z-index);",
        })(shadowRoot);

        this._root = createRoot(this._container);
        this._root.render(
          React.createElement(App, {
            initialText: "",
            customTools: this.customTools,
            showCloseBtn: this.showCloseBtn,
          }),
        );
      }
    } catch (error) {
      maLogger.error("注入文本选择工具栏失败:", error);
    }
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "`" || event.key === "~") {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() || this.selectedText;

      if (selectedText.length > 0 && this.selectionRange && this._container) {
        maLogger.log("用户按下 ~ 键，显示工具栏");
        this.showAndPositionComponent();
      }
    }
  };

  private handleScroll = () => {
    if (this.isVisible && this.selectionRange && this._container) {
      const rect = this.selectionRange.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        const positionInfo = new ElementPositionInfo({
          rect,
          zIndex: 0,
          scrollX: window.pageXOffset || document.documentElement.scrollLeft,
          scrollY: window.pageYOffset || document.documentElement.scrollTop,
          viewportWidth:
            window.innerWidth || document.documentElement.clientWidth,
          viewportHeight:
            window.innerHeight || document.documentElement.clientHeight,
        });

        positionInfo.positionElement({
          targetElement: this._container,
          strategy: PositionStrategy.Down,
          alignment: "center",
          offset: { x: 0, y: 10 },
          observeReference: false,
          pinned: true,
        });
      }
    }
  };

  /**
   * 启用文本选择工具栏
   */
  enable(options?: any): void {
    try {
      if (!this.isInjected) {
        this.inject().catch((error) => {
          maLogger.error("注入文本选择工具栏失败:", error);
        });
      }
      this.brandColor = options?.brandColor || this.brandColor;
      if (Object.prototype.hasOwnProperty.call(options || {}, "textareaAI")) {
        this.textareaAIEnabled = options?.textareaAI !== false;
      }
      document.body.style.setProperty("--kria-brand-color", this.brandColor);
      document.addEventListener(
        "selectionchange",
        this.handleSelectionChange as EventListener,
      );
      document.addEventListener("keydown", this.handleKeyDown);
      window.addEventListener("scroll", this.handleScroll, true);

      window.addEventListener(
        "iframe-selectionchange",
        this.handleIframeSelectionChange as EventListener,
      );
      if (this.textareaAIEnabled) {
        this.enableTextareaAI();
      } else {
        this.disableTextareaAI();
      }

      this.isEnabled = true;
      maLogger.log("文本选择工具栏已启用");
    } catch (error) {
      maLogger.error("启用文本选择工具栏失败:", error);
    }
  }

  /**
   * 禁用文本选择工具栏
   */
  disable(): void {
    try {
      document.removeEventListener(
        "selectionchange",
        this.handleSelectionChange as EventListener,
      );
      document.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("scroll", this.handleScroll, true);
      //@ts-ignore
      window.removeEventListener(
        "iframe-selectionchange",
        this.handleIframeSelectionChange,
      );

      this.hideComponent();
      this.disableTextareaAI();
      this.cleanupComponent();

      this.isEnabled = false;
      maLogger.log("文本选择工具栏已禁用");
    } catch (error) {
      maLogger.error("禁用文本选择工具栏失败:", error);
    }
  }

  /**
   * 初始化文本选择工具栏
   */
  async init(
    context?: any,
    options?: TextSelectionToolbarOptions,
  ): Promise<void> {
    this._ctx = context;
    try {
      if (options?.tools) {
        this.customTools = [...options.tools];
      }

      const config = await storage.ext.local.get("appConfig");
      if (config?.appConfig?.textSelectionToolbar !== false) {
        this.enable();
      }
    } catch (error) {
      maLogger.error("初始化文本选择工具栏失败:", error);
    }
  }

  /**
   * 根据设置更新状态
   */
  updateStatus(enabled: boolean): void {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
}

// 导出 Preact 版本
export default (ctx: AppContext, options?: any): AppModule => {
  const appInstance = new TextSelectionToolbarModule(options);
  appInstance.init(ctx);
  return appInstance;
};
