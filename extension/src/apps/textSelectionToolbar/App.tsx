/**
 * App 组件 - Preact 版本
 * 文本选择工具栏主容器，管理所有子组件和状态
 */
import React, {
  Suspense,
  lazy,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { TextTool } from "@/types";
import { componentManager } from "@/utils/componentManager";
import { trackTextAction } from "@/services/achievements";
import { eventManager } from "@/event";
import toast from "@/utils/toast";
import type { Comment } from "@/services/commentStorage";
import TextToolbar from "./views/TextToolbar";
import type { ReplaceOptions } from "./views/ReplaceModal";
import "./views/styles/app.scss";
// import "./views/styles/textarea-ai.scss";

/**
 * 懒加载组件 - 按需加载以减小初始包体积
 */
const LazyTranslationPanel = lazy(() => import("./views/TranslationPanel"));
const LazyReplaceModal = lazy(() => import("./views/ReplaceModal"));
const LazyCommentModal = lazy(() => import("./views/CommentModal"));
const LazyCommentDisplay = lazy(() => import("./views/CommentDisplay"));

/**
 * 动态导入 CommentStorage
 */
async function getCommentStorage() {
  const { CommentStorage } = await import("@/services/commentStorage");
  return CommentStorage;
}

/**
 * App 组件属性接口
 */
interface AppProps {
  /** 初始文本（选中文本） */
  initialText: string;
  /** 自定义工具列表 */
  customTools?: TextTool[];
  /** 是否显示关闭按钮 */
  showCloseBtn?: boolean;
}

/**
 * 翻译状态类型
 */
type TranslationStatus = "loading" | "success" | "error";

/**
 * 位置接口
 */
interface TranslationPosition {
  left: number;
  top: number;
}

/**
 * 翻译面板载荷接口
 */
interface TranslationPanelPayload {
  messageId: string;
  content: string;
  status?: TranslationStatus;
  position?: TranslationPosition;
  sourceText?: string;
}

/**
 * 翻译面板状态接口
 */
interface TranslationPanelState {
  messageId: string;
  content: string;
  status: TranslationStatus;
  position: TranslationPosition;
  sourceText: string;
  shakeKey: number;
}

/**
 * 范围信息接口
 */
interface RangeInfo {
  startContainerXPath: string;
  startOffset: number;
  endContainerXPath: string;
  endOffset: number;
}

const STORAGE_KEY = "textSelectionToolbarState";

/**
 * App 组件
 * 文本选择工具栏主容器
 */
const App: React.FC<AppProps> = ({
  initialText,
  customTools = [],
  showCloseBtn = true,
}) => {
  // 工具栏可见性状态
  const [isVisible, setIsVisible] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showRedDot, setShowRedDot] = useState(false);

  // 文本状态
  const [currentInitialText, setCurrentInitialText] =
    useState<string>(initialText);

  // 工具栏工具列表
  const [localTools, setLocalTools] = useState<TextTool[]>([...customTools]);

  // 翻译面板列表
  const [translationPanels, setTranslationPanels] = useState<
    TranslationPanelState[]
  >([]);

  // 替换模态框状态
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceSearchText, setReplaceSearchText] = useState("");

  // 评论相关状态
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showCommentDisplay, setShowCommentDisplay] = useState(false);
  const [currentSelectedText, setCurrentSelectedText] = useState("");
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [commentDisplayPosition, setCommentDisplayPosition] = useState({
    x: 100,
    y: 100,
  });
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [pageComments, setPageComments] = useState<Comment[]>([]);
  const [currentRangeInfo, setCurrentRangeInfo] = useState<RangeInfo | null>(
    null,
  );

  /**
   * 加载保存的状态
   */
  const loadState = useCallback(() => {
    try {
      const storedState = localStorage.getItem(STORAGE_KEY);
      if (storedState) {
        const state = JSON.parse(storedState);
        setShowRedDot(state.showRedDot);
        setShowToolbar(state.showToolbar);
      }
    } catch (error) {
      maLogger.error("加载工具栏状态失败:", error);
    }
  }, []);

  /**
   * 保存状态
   */
  const saveState = useCallback(() => {
    try {
      const state = {
        showRedDot,
        showToolbar,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      maLogger.error("保存工具栏状态失败:", error);
    }
  }, [showRedDot, showToolbar]);

  /**
   * 显示工具栏
   */
  const show = useCallback(() => {
    setIsVisible(true);
  }, []);

  /**
   * 隐藏工具栏
   */
  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  /**
   * 关闭工具栏
   */
  const handleClose = useCallback(() => {
    setIsVisible(false);
  }, []);

  /**
   * 点击红点展开工具栏
   */
  const handleRedDotClick = useCallback(() => {
    setShowRedDot(false);
    setShowToolbar(true);
  }, []);

  /**
   * 更新文本
   */
  const updateText = useCallback((text: string) => {
    setCurrentInitialText(text);
  }, []);

  /**
   * 显示工具栏并设置文本
   */
  const showWithIframeText = useCallback((text: string) => {
    setCurrentInitialText(text);
    setIsVisible(true);
  }, []);

  /**
   * 显示翻译面板
   */
  const showTranslationPanel = useCallback(
    (payload: TranslationPanelPayload) => {
      setTranslationPanels((prevPanels) => {
        const nextPanel: TranslationPanelState = {
          messageId: payload.messageId,
          content: payload.content,
          status: payload.status || "loading",
          sourceText: payload.sourceText || "",
          shakeKey: 0,
          position: payload.position || {
            left: 100,
            top: 100,
          },
        };

        const panelIndex = prevPanels.findIndex(
          (panel) => panel.messageId === payload.messageId,
        );
        if (panelIndex === -1) {
          return [...prevPanels, nextPanel];
        }

        return prevPanels.map((panel, index) => {
          return index === panelIndex ? nextPanel : panel;
        });
      });
    },
    [],
  );

  /**
   * 更新翻译面板
   */
  const updateTranslationPanel = useCallback(
    (payload: Partial<TranslationPanelPayload> & { messageId: string }) => {
      setTranslationPanels((prevPanels) => {
        const panelIndex = prevPanels.findIndex(
          (panel) => panel.messageId === payload.messageId,
        );
        if (panelIndex === -1) {
          return prevPanels;
        }

        return prevPanels.map((panel, index) => {
          if (index !== panelIndex) {
            return panel;
          }

          return {
            ...panel,
            content: payload.content ?? panel.content,
            status: payload.status ?? panel.status,
            position: payload.position ?? panel.position,
            sourceText: payload.sourceText ?? panel.sourceText,
          };
        });
      });
    },
    [],
  );

  /**
   * 震动翻译面板
   */
  const shakeTranslationPanelBySourceText = useCallback(
    (sourceText: string): boolean => {
      const normalizedText = sourceText.trim();
      if (!normalizedText) {
        return false;
      }

      let found = false;
      setTranslationPanels((prevPanels) => {
        const panelIndex = prevPanels.findIndex(
          (panel) => panel.sourceText === normalizedText,
        );
        if (panelIndex === -1) {
          return prevPanels;
        }

        found = true;
        const targetPanel = prevPanels[panelIndex];
        const bumpedPanel = {
          ...targetPanel,
          shakeKey: targetPanel.shakeKey + 1,
        };

        return [
          ...prevPanels.filter((_, index) => index !== panelIndex),
          bumpedPanel,
        ];
      });
      return found;
    },
    [],
  );

  /**
   * 隐藏翻译面板
   */
  const hideTranslationPanel = useCallback((messageId?: string) => {
    if (!messageId) {
      setTranslationPanels([]);
      return;
    }

    setTranslationPanels((prevPanels) => {
      return prevPanels.filter((panel) => panel.messageId !== messageId);
    });
  }, []);

  /**
   * 显示替换模态框
   */
  const showReplaceModalFn = useCallback((text: string) => {
    setReplaceSearchText(text);
    setShowReplaceModal(true);
  }, []);

  /**
   * 隐藏替换模态框
   */
  const hideReplaceModal = useCallback(() => {
    setShowReplaceModal(false);
    setReplaceSearchText("");
  }, []);

  /**
   * 执行文本替换
   */
  const handleReplace = useCallback(
    async (replaceText: string, options: ReplaceOptions) => {
      try {
        const searchText = replaceSearchText.trim();
        if (!searchText || !replaceText.trim()) {
          return;
        }

        let regexPattern = searchText.replace(
          /[.*+?^=!:${}()|[\]\/\\]/g,
          "\\$&",
        );

        if (options.wholeWord) {
          regexPattern = `\\b${regexPattern}\\b`;
        }

        const flags = options.caseSensitive ? "g" : "gi";
        const regex = new RegExp(regexPattern, flags);

        // 动态导入以减少初始加载体积
        const { default: findAndReplaceDOMText } =
          await import("./findAndReplaceDOMText");

        const instance = findAndReplaceDOMText(document.body, {
          find: regex,
          replace: replaceText,
          preset: "prose",
        });

        maLogger.log("替换完成，共替换:", instance.matches.length, "处");

        if (instance.matches.length > 0) {
          toast.success(`成功替换 ${instance.matches.length} 处文本！`);
        }
      } catch (error) {
        maLogger.error("替换失败:", error);
      } finally {
        hideReplaceModal();
      }
    },
    [replaceSearchText, hideReplaceModal],
  );

  /**
   * 根据节点获取 XPath
   */
  const getXPathForNode = useCallback((node: Node): string => {
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

    const parentXPath = node.parentNode ? getXPathForNode(node.parentNode) : "";
    const nodeName = node.nodeName.toLowerCase();

    if (parentXPath) {
      return `${parentXPath}/${nodeName}[${count}]`;
    }
    return `/${nodeName}[${count}]`;
  }, []);

  /**
   * 根据 XPath 获取节点
   */
  const getNodeByXPath = useCallback((xpath: string): Node | null => {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      );
      return result.singleNodeValue;
    } catch (error) {
      maLogger.error("XPath 查询失败:", error);
      return null;
    }
  }, []);

  /**
   * 根据文本查找范围
   */
  const findTextRange = useCallback((searchText: string): Range | null => {
    const treeWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.parentElement?.closest("script, style, noscript, iframe")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let currentNode: Node | null;
    while ((currentNode = treeWalker.nextNode())) {
      const textContent = currentNode.textContent || "";
      const index = textContent.indexOf(searchText);
      if (index !== -1) {
        const range = document.createRange();
        range.setStart(currentNode, index);
        range.setEnd(currentNode, index + searchText.length);
        return range;
      }
    }
    return null;
  }, []);

  /**
   * 高亮已评论的文本
   */
  const highlightCommentedText = useCallback(() => {
    // 清除已有的标记
    const existingMarkers = document.querySelectorAll(
      ".comment-highlight-marker",
    );
    existingMarkers.forEach((marker) => {
      const textContent = marker.textContent || "";
      const textNode = document.createTextNode(textContent);
      marker.parentNode?.replaceChild(textNode, marker);
    });

    pageComments.forEach((comment) => {
      if (!comment.text) return;

      let range: Range | null = null;

      if (comment.rangeInfo) {
        const {
          startContainerXPath,
          startOffset,
          endContainerXPath,
          endOffset,
        } = comment.rangeInfo;
        if (startContainerXPath && endContainerXPath) {
          const startNode = getNodeByXPath(startContainerXPath);
          const endNode = getNodeByXPath(endContainerXPath);

          if (startNode && endNode) {
            try {
              range = document.createRange();
              range.setStart(startNode, startOffset || 0);
              range.setEnd(endNode, endOffset || 0);
            } catch (e) {
              maLogger.warn("使用XPath定位失败，回退到文本匹配:", e);
              range = null;
            }
          }
        }
      }

      if (!range) {
        range = findTextRange(comment.text);
      }

      if (range) {
        const span = document.createElement("span");
        span.className = "comment-highlight-marker";
        span.dataset.commentId = comment.id;
        span.style.cssText = `
          text-decoration: underline;
          text-decoration-color: #0d9488;
          text-decoration-thickness: 2px;
          text-underline-offset: 4px;
          cursor: pointer;
          color: inherit;
          background: rgba(13, 148, 136, 0.12);
          border-radius: 2px;
          transition: all 0.2s ease;
          position: relative;
          z-index: 1;
        `;
        span.addEventListener("click", (event) => {
          event.stopPropagation();
          event.preventDefault();
          const rect = span.getBoundingClientRect();
          setCommentDisplayPosition({
            x: Math.min(
              rect.left + rect.width / 2 - 170,
              window.innerWidth - 360,
            ),
            y: rect.bottom + 10,
          });
          setSelectedComment(comment);
          setShowCommentDisplay(true);
        });
        try {
          range.surroundContents(span);
        } catch (e) {
          maLogger.warn("无法高亮文本:", e);
        }
      }
    });
  }, [pageComments, getNodeByXPath, findTextRange]);

  /**
   * 加载页面评论
   */
  const loadPageComments = useCallback(async () => {
    try {
      const CommentStorage = await getCommentStorage();
      const comments = await CommentStorage.getCommentsForCurrentPage();
      setPageComments(comments);
      maLogger.log("加载当前页面留言:", comments);
      // 在下一帧高亮文本
      setTimeout(() => {
        highlightCommentedText();
      }, 100);
    } catch (error) {
      maLogger.error("加载留言失败:", error);
    }
  }, [highlightCommentedText]);

  /**
   * 显示评论模态框
   */
  const showCommentModalFn = useCallback(
    (text: string, rangeInfo?: RangeInfo) => {
      setCurrentSelectedText(text);
      setEditingCommentId("");
      setEditingCommentContent("");
      setCurrentRangeInfo(rangeInfo || null);
      setShowCommentModal(true);
    },
    [],
  );

  /**
   * 隐藏评论模态框
   */
  const hideCommentModal = useCallback(() => {
    setShowCommentModal(false);
    setCurrentSelectedText("");
    setEditingCommentId("");
    setEditingCommentContent("");
  }, []);

  /**
   * 隐藏评论展示
   */
  const hideCommentDisplay = useCallback(() => {
    setShowCommentDisplay(false);
    setSelectedComment(null);
  }, []);

  /**
   * 保存评论
   */
  const handleSaveComment = useCallback(
    async (data: { text: string; comment: string; commentId?: string }) => {
      try {
        const CommentStorage = await getCommentStorage();
        const url = window.location.href;
        const hash = window.location.hash || "#";

        if (data.commentId) {
          await CommentStorage.updateComment(data.commentId, {
            comment: data.comment,
          });
          maLogger.log("更新留言成功:", data.commentId);
        } else {
          await CommentStorage.saveComment({
            text: data.text,
            comment: data.comment,
            url,
            hash,
            rangeInfo: currentRangeInfo || undefined,
          });
          maLogger.log("保存留言成功");
        }

        hideCommentModal();
        setCurrentRangeInfo(null);
        await loadPageComments();
        toast.success("留言保存成功！");
      } catch (error) {
        maLogger.error("保存留言失败:", error);
      }
    },
    [currentRangeInfo, hideCommentModal, loadPageComments],
  );

  /**
   * 删除评论
   */
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        const CommentStorage = await getCommentStorage();
        await CommentStorage.deleteComment(commentId);
        maLogger.log("删除留言成功:", commentId);
        hideCommentModal();
        await loadPageComments();
        toast.success("留言删除成功！");
      } catch (error) {
        maLogger.error("删除留言失败:", error);
      }
    },
    [hideCommentModal, loadPageComments],
  );

  /**
   * 编辑评论
   */
  const handleEditComment = useCallback(() => {
    if (selectedComment) {
      setEditingCommentId(selectedComment.id);
      setEditingCommentContent(selectedComment.comment);
      setCurrentSelectedText(selectedComment.text);
      setShowCommentDisplay(false);
      setShowCommentModal(true);
    }
  }, [selectedComment]);

  /**
   * 哈希变化处理
   */
  const handleHashChange = useCallback(() => {
    loadPageComments();
  }, [loadPageComments]);

  /**
   * 工具点击处理 - 已委托给 TextToolbar 组件内部执行
   * 此处仅用于接收回调通知
   */
  const handleToolClick = useCallback((tool: TextTool) => {
    maLogger.log("工具栏工具点击(回调通知):", tool.id);
    if (["copy", "search", "translate", "bookmark", "replace"].includes(tool.id)) {
      void trackTextAction(tool.id).then((unlocked) => {
        unlocked.forEach((achievement) => {
          toast.success(`成就解锁：${achievement.name}`);
        });
      });
    }
  }, []);

  // 同步 customTools prop 变化
  useEffect(() => {
    setLocalTools([...customTools]);
  }, [customTools]);

  // 监听事件总线更新
  useEffect(() => {
    const [_, unsubscribe] = eventManager.useBus(
      "update:toolbar:tools",
      (newTools: TextTool[]) => {
        maLogger.log("接收到事件总线更新tools:", newTools);
        setLocalTools([...newTools]);
      },
    );
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // 保存状态
  useEffect(() => {
    saveState();
  }, [showRedDot, showToolbar, saveState]);

  // 初始化
  useEffect(() => {
    loadState();
    loadPageComments();

    window.addEventListener("hashchange", handleHashChange);

    // 注册组件到 componentManager
    componentManager.register("TextSelectionToolbar", {
      show,
      hide,
      updateText,
      showWithIframeText,
      showTranslationPanel,
      updateTranslationPanel,
      shakeTranslationPanelBySourceText,
      hideTranslationPanel,
      showReplaceModal: showReplaceModalFn,
      showCommentModal: showCommentModalFn,
    });

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      componentManager.unregister("TextSelectionToolbar");
    };
  }, []);

  return (
    <div className="toolbar-root">
      {isVisible && (
        <div>
          {showRedDot && (
            <button
              className="red-dot"
              type="button"
              aria-label="展开文本选择工具栏"
              onClick={handleRedDotClick}
            />
          )}
          {showToolbar && (
            <div className="animation-container show">
              <TextToolbar
                initialText={currentInitialText}
                selectedText={currentInitialText}
                customTools={localTools}
                showCloseBtn={showCloseBtn}
                onClose={handleClose}
                onToolClick={handleToolClick}
              />
            </div>
          )}
        </div>
      )}

      <Suspense fallback={null}>
        {translationPanels.map((panel) => (
          <LazyTranslationPanel
            key={panel.messageId}
            visible={true}
            content={panel.content}
            status={panel.status}
            position={panel.position}
            shakeKey={panel.shakeKey}
            onClose={() => hideTranslationPanel(panel.messageId)}
          />
        ))}

        {showReplaceModal && (
          <LazyReplaceModal
            visible={showReplaceModal}
            searchText={replaceSearchText}
            onClose={hideReplaceModal}
            onReplace={handleReplace}
          />
        )}

        {showCommentModal && (
          <LazyCommentModal
            visible={showCommentModal}
            selectedText={currentSelectedText}
            commentId={editingCommentId}
            existingComment={editingCommentContent}
            onClose={hideCommentModal}
            onSave={handleSaveComment}
            onDelete={handleDeleteComment}
          />
        )}

        {selectedComment && (
          <LazyCommentDisplay
            visible={showCommentDisplay}
            comment={selectedComment}
            position={commentDisplayPosition}
            onClose={hideCommentDisplay}
            onEdit={handleEditComment}
          />
        )}
      </Suspense>
    </div>
  );
};

export default App;
export { App };
export type {
  AppProps,
  TranslationPanelPayload,
  TranslationPanelState,
  RangeInfo,
};
