/**
 * @file modules/sidebar/components/AIConversation.tsx
 * @description 真正的 AI 对话组件（React 版）—— 带聊天历史持久化
 *
 * 通信协议：
 *   前端 ──chrome.runtime.connect("ai-conversation-${messageId}")──▶ background
 *        ──{ type: "START_AI_CONVERSATION", payload }──▶ stream-manager.startStream()
 *        ◀── { type: "AI_CONVERSATION_STREAM_DATA", payload.content }
 *        ◀── { type: "AI_CONVERSATION_COMPLETE" }
 *        ◀── { type: "AI_CONVERSATION_ERROR", payload.error }
 *
 * 历史持久化（统一走记忆系统）：
 *   只有 category === "conversation" 的 MemoryEntry 才是对话历史
 *   存储键：ai_memory::entries::${role} —— 记忆系统所有条目按 role 分组
 *   加载：memoryService.listByCategory(role, "conversation") → 解析 content → ChatMessage[]
 *   保存：memoryService.addEntry({ category: "conversation" })
 *   默认展示最近 1 天 → 滚到顶部可扩到 7 天 → 再滚一次展示全部
 *
 * 记忆集成：
 *   stream-manager 已经自动接好记忆系统 —— role 决定了要走哪个记忆命名空间
 *   每次对话前 → memoryService.buildContext(role, prompt) 注入记忆
 *   每次对话后 → memoryService.observe(role, prompt, response) 自动学习
 *
 * @author Vivy
 * @date 2026-10-28
 */
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { loadAIConfig, type AIModelConfig } from "@/service-worker/chrome-api/ai-config";
import { getMemoryService } from "@/services/memory";
import { buildStorageKey, type MemoryEntry } from "@/services/memory/types";

/** 角色选项 —— 与原 Placeholder 保持相同接口 */
export interface AIRole {
    value: string;
    label: string;
    avatar: string;
    systemPrompt: string;
}

/** 单条聊天消息 —— createdAt 为毫秒时间戳 */
interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    streaming?: boolean;
    createdAt: number;
}

/** 时间窗口 —— 控制默认展示多少历史 */
type TimeWindow = "1d" | "7d" | "all";

/** 组件 Props —— 与 AIConversationPlaceholder 尽量兼容 */
export interface AIConversationProps {
    className?: string;
    title?: string;
    welcomeTitle?: string;
    welcomeMessage?: string;
    userIcon?: string;
    aiIcon?: string;
    typingMessage?: string;
    inputPlaceholder?: string;
    sendButtonText?: string;
    inputHint?: string;
    defaultRole?: string;
    roleOptions?: AIRole[];
    /** 默认展示历史的时间窗口，默认 "1d" */
    defaultHistoryWindow?: TimeWindow;
}

const genId = (): string =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 时间窗口对应的毫秒数 */
const TIME_WINDOW_MS: Record<Exclude<TimeWindow, "all">, number> = {
    "1d": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
};

/**
 * 解析记忆系统 conversation 类别的 content
 * 格式：`用户：xxx\nAI：xxx`（可能多段，或只有一方）
 *
 * MemoryEntry.content 是一整轮对话的摘要块，需要拆回两条 ChatMessage
 */
function parseConversationEntry(
    entry: MemoryEntry,
): ChatMessage[] {
    const content = entry.content?.trim();
    if (!content) return [];

    const lines = content.split(/\n+/).filter((l) => l.trim());
    const result: ChatMessage[] = [];

    for (const line of lines) {
        let msgRole: "user" | "assistant" | null = null;
        let body = line.trim();

        // 匹配前缀：用户：/ AI：/ 用户:/ AI:/ user:/ ai: 等
        const userMatch = body.match(
            /^(用户|User|user|Me|me|Human|human)[：:]\s*(.+)$/,
        );
        const aiMatch = body.match(
            /^(AI|ai|助手|Assistant|assistant|Bot|bot)[：:]\s*(.+)$/,
        );

        if (userMatch) {
            msgRole = "user";
            body = userMatch[2];
        } else if (aiMatch) {
            msgRole = "assistant";
            body = aiMatch[2];
        } else {
            // 无法识别角色 → 跳过这条（不是对话消息）
            continue;
        }

        if (body.length > 0) {
            result.push({
                id: `${entry.id}-${msgRole}-${result.length}`,
                role: msgRole,
                content: body,
                createdAt: entry.createdAt,
            });
        }
    }

    return result;
}

/** 把一轮 user + AI 回复合成记忆系统的 conversation 格式 */
function buildConversationChunk(userMsg: string, aiMsg: string): string {
    const u = userMsg.trim();
    const a = aiMsg.trim();
    const parts: string[] = [];
    if (u) parts.push(`用户：${u}`);
    if (a) parts.push(`AI：${a}`);
    return parts.join("\n");
}

/** 从全量历史中截取指定时间窗口内的消息 */
function filterByWindow(
    all: ChatMessage[],
    window: TimeWindow,
): ChatMessage[] {
    if (window === "all") return all;
    const cutoff = Date.now() - TIME_WINDOW_MS[window];
    return all.filter((m) => m.createdAt >= cutoff);
}

const AIConversation: React.FC<AIConversationProps> = ({
    className,
    welcomeTitle = "AI CONSOLE",
    welcomeMessage = "对话已就绪，说点什么吧~",
    userIcon = "YOU",
    aiIcon = "AI",
    typingMessage = "AI 正在组织语言...",
    inputPlaceholder = "输入消息，Enter 发送",
    sendButtonText = "发送",
    inputHint = "Enter 发送，Shift + Enter 换行",
    defaultRole,
    roleOptions = [],
    defaultHistoryWindow = "1d",
}) => {
    /* ── 核心状态 ── */
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorNotice, setErrorNotice] = useState<string>("");
    const [role, setRole] = useState<string>(defaultRole ?? roleOptions[0]?.value ?? "");
    const [config, setConfig] = useState<AIModelConfig | null>(null);

    /* ── 历史持久化状态（全部走记忆系统） ── */
    const [allHistory, setAllHistory] = useState<ChatMessage[]>([]); // 当前角色全量 conversation 消息
    const [timeWindow, setTimeWindow] = useState<TimeWindow>(defaultHistoryWindow);
    const [historyLoading, setHistoryLoading] = useState(false);   // 滚顶加载中
    // hasMoreHistory 不单独存 state：由 allHistory + timeWindow 派生，避免手动同步产生 stale 值

    const loadingRef = useRef(loading);
    loadingRef.current = loading;

    const listRef = useRef<HTMLDivElement>(null);       // 消息列表 DOM
    const autoScrollRef = useRef(true);                  // 是否自动滚到底部

    /* ══════════════════════════════════════════════════════════════════
     * 历史加载（从记忆系统 listByCategory(role, "conversation")）
     * ══════════════════════════════════════════════════════════════════ */

    /** 从记忆系统加载当前角色的全部 conversation 条目 → 解析为 ChatMessage[] */
    // 注意：本回调不依赖 timeWindow，保持引用稳定，
    // 否则下方「role 变化」effect 会在扩大时间窗口时被重复触发并把窗口重置回默认值
    const loadHistoryForRole = useCallback(async (targetRole: string) => {
        if (!targetRole) {
            setAllHistory([]);
            return;
        }
        try {
            const svc = getMemoryService();
            // 只取 category === "conversation" 的条目（对话历史）
            const entries = await svc.listByCategory(targetRole, "conversation");
            const parsed = entries
                .sort((a, b) => a.createdAt - b.createdAt)
                .flatMap(parseConversationEntry);

            setAllHistory(parsed);
        } catch (err) {
            console.warn("[AIConversation] loadHistory failed:", err);
            setAllHistory([]);
        }
    }, []);

    /* ══════════════════════════════════════════════════════════════════
     * 滚顶加载更早历史：扩大时间窗口
     * ══════════════════════════════════════════════════════════════════ */
    const loadMoreHistory = useCallback(() => {
        if (historyLoading) return;

        // 计算下一个时间窗口
        const next: TimeWindow =
            timeWindow === "1d" ? "7d" : timeWindow === "7d" ? "all" : "all";
        if (next === timeWindow) return; // 已经是最大窗口

        setHistoryLoading(true);
        // 保存当前滚动位置锚点（最后一条可见消息距底距离）
        const list = listRef.current;
        const anchor = list ? list.scrollHeight - list.scrollTop : 0;

        setTimeWindow(next);

        // 等 React 渲染完新消息后恢复滚动位置
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const el = listRef.current;
                if (el && anchor > 0) {
                    el.scrollTop = el.scrollHeight - anchor;
                }
                setHistoryLoading(false);
                // hasMoreHistory 由 allHistory + timeWindow 派生，无需手动同步
            });
        });
    }, [historyLoading, timeWindow]);

    /* ══════════════════════════════════════════════════════════════════
     * 角色卡加载（记忆系统）
     * ══════════════════════════════════════════════════════════════════ */

    const [storedRoles, setStoredRoles] = useState<AIRole[]>([]);

    useEffect(() => {
        let disposed = false;

        const loadStoredRoles = async () => {
            try {
                const svc = getMemoryService();
                const roles = await svc.listRoles();
                const cards = await Promise.all(
                    roles.map(async (r): Promise<AIRole | null> => {
                        try {
                            const identity = await svc.getIdentity(r);
                            if (!identity) return null;
                            const label = identity.displayName?.trim() || r;
                            return {
                                value: r,
                                label,
                                avatar: label.slice(0, 2).toUpperCase(),
                                systemPrompt: identity.systemPromptTemplate?.trim() ?? "",
                            };
                        } catch {
                            return null;
                        }
                    }),
                );
                if (!disposed) {
                    setStoredRoles(cards.filter((c): c is AIRole => c !== null));
                }
            } catch (error) {
                console.warn("[AIConversation] loadStoredRoles failed:", error);
                if (!disposed) setStoredRoles([]);
            }
        };

        void loadStoredRoles();

        if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
            const handler = (
                _changes: Record<string, chrome.storage.StorageChange>,
                area: string,
            ) => {
                if (area === "local") void loadStoredRoles();
            };
            chrome.storage.onChanged.addListener(handler);
            return () => {
                disposed = true;
                chrome.storage.onChanged.removeListener(handler);
            };
        }
        return () => {
            disposed = true;
        };
    }, []);

    /* 有效角色列表：记忆系统角色卡在前，props 硬编码角色去重后作补充 */
    const effectiveRoles = useMemo(() => {
        if (storedRoles.length === 0) return roleOptions;
        const storedIds = new Set(storedRoles.map((r) => r.value));
        const extras = roleOptions.filter((r) => !storedIds.has(r.value));
        return [...storedRoles, ...extras];
    }, [storedRoles, roleOptions]);

    const currentRole = useMemo(
        () => effectiveRoles.find((r) => r.value === role),
        [effectiveRoles, role],
    );

    useEffect(() => {
        void loadAIConfig()
            .then((cfg) => setConfig(cfg))
            .catch((err) => {
                console.warn("[AIConversation] loadAIConfig failed:", err);
            });
    }, []);

    /* ══════════════════════════════════════════════════════════════════
     * 角色同步 + 角色切换时加载对应历史
     * ══════════════════════════════════════════════════════════════════ */

    useEffect(() => {
        if (effectiveRoles.length === 0) return;
        if (effectiveRoles.some((r) => r.value === role)) return;
        const fallback =
            storedRoles[0] ??
            effectiveRoles.find((r) => r.value === defaultRole) ??
            effectiveRoles[0];
        setRole(fallback.value);
    }, [effectiveRoles, storedRoles, role, defaultRole]);

    /** role 变化 → 重置时间窗口 + 从记忆系统重载 + 滚到底部 */
    useEffect(() => {
        if (!role) return;
        setTimeWindow(defaultHistoryWindow);
        autoScrollRef.current = true;
        void loadHistoryForRole(role);
    }, [role, defaultHistoryWindow, loadHistoryForRole]);

    /**
     * 记忆变更实时同步。
     *
     * 后台主动对话或其他标签页写入 entries 后，MemoryStore 会通过
     * storage.onChanged 失效本地缓存；这里再主动重载一次，
     * 保证对话窗处于打开状态时也能立刻看到新消息。
     */
    useEffect(() => {
        if (!role) return;
        const entriesKey = buildStorageKey("entries", role);

        const handleStorageChange = (
            changes: Record<string, chrome.storage.StorageChange>,
            areaName: string,
        ) => {
            if (areaName !== "local" || !changes[entriesKey]) return;
            void loadHistoryForRole(role);
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, [role, loadHistoryForRole]);

    /** allHistory + timeWindow → 派生当前可见的历史消息 */
    const visibleHistory = useMemo(
        () => filterByWindow(allHistory, timeWindow),
        [allHistory, timeWindow],
    );

    /** 是否还有更早的历史：当前窗口没盖住全量 → 可继续扩大窗口加载 */
    const hasMoreHistory = useMemo(
        () => visibleHistory.length < allHistory.length,
        [visibleHistory, allHistory],
    );

    /** 合并可见历史 + 实时消息（新消息追加到尾部） */
    const displayMessages = useMemo<ChatMessage[]>(() => {
        const liveIds = new Set(messages.map((m) => m.id));
        // 历史中去掉已被实时消息替换的（同 id 的 streaming 版本）
        const deduped = visibleHistory.filter((m) => !liveIds.has(m.id));
        return [...deduped, ...messages];
    }, [visibleHistory, messages]);

    /* ══════════════════════════════════════════════════════════════════
     * 滚动管理
     * ══════════════════════════════════════════════════════════════════ */

    /** 自动滚到底部（仅当 autoScrollRef 为 true 时） */
    const scrollToBottom = useCallback(() => {
        if (!autoScrollRef.current) return;
        const el = listRef.current;
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
    }, []);

    /** 新消息到达 / 消息更新后自动滚动 */
    useEffect(() => {
        scrollToBottom();
    }, [displayMessages, scrollToBottom]);

    /** 滚动事件：用户手动上滑 → 停用自动滚动；滚回底部 → 重新启用 */
    const handleListScroll = useCallback(() => {
        const el = listRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        autoScrollRef.current = atBottom;

        // 滚到顶部 → 触发加载更多历史
        if (el.scrollTop < 40 && hasMoreHistory && !historyLoading) {
            loadMoreHistory();
        }
    }, [hasMoreHistory, historyLoading, loadMoreHistory]);

    /* ══════════════════════════════════════════════════════════════════
     * 发送消息
     * ══════════════════════════════════════════════════════════════════ */

    const buildFinalSystemPrompt = useCallback((): string => {
        const parts: string[] = [];
        if (config?.systemPrompt?.trim()) {
            parts.push(config.systemPrompt.trim());
        }
        if (currentRole?.systemPrompt?.trim()) {
            parts.push(currentRole.systemPrompt.trim());
        }
        return parts.join("\n\n");
    }, [config, currentRole]);

    const send = useCallback(async () => {
        const prompt = draft.trim();
        if (!prompt || loadingRef.current) return;
        if (!role) {
            setErrorNotice("请先选择一个角色");
            return;
        }

        setErrorNotice("");
        setDraft("");
        setLoading(true);

        // 发送新消息 → 强制自动滚到底部
        autoScrollRef.current = true;

        const userMsgId = genId();
        const userMsg: ChatMessage = {
            id: userMsgId,
            role: "user",
            content: prompt,
            createdAt: Date.now(),
        };
        const aiMsgId = genId();
        const aiMsg: ChatMessage = {
            id: aiMsgId,
            role: "assistant",
            content: "",
            streaming: true,
            createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, userMsg, aiMsg]);

        const messageId = `sidebar-${Date.now()}`;
        let port: chrome.runtime.Port | null = null;

        /* ── 连续回复追踪 ── */
        // 当前正在 streaming 的 AI 消息 id —— 首条 = aiMsgId；续轮 CONTINUING 后会更新
        let currentStreamingAiId = aiMsgId;
        // 本轮所有 AI 回复的 id 列表 —— 用于 persistTurn 时批量过滤
        const allAiMsgIds = [aiMsgId];

        // 同一轮只落库一次：COMPLETE / ERROR / onDisconnect 三条路径都可能触发
        let persistStarted = false;
        /**
         * 落库并让历史列表接管这一轮。
         * 批量保存：把首条回复 + 所有连续回复续轮合并成一个 conversation entry。
         */
        const persistTurn = async (): Promise<void> => {
            if (persistStarted) return;
            persistStarted = true;

            // 收集所有 role: "assistant" 的实时消息 content
            setMessages((prev) => {
                const userEntry = prev.find((m) => m.id === userMsgId);
                const aiEntries = prev.filter(
                    (m) => m.role === "assistant" && m.content.trim(),
                );

                // 如果有至少一条 AI 回复 → 批量保存为一个 conversation entry
                if (userEntry && aiEntries.length > 0) {
                    const userText = userEntry.content;
                    const aiTexts = aiEntries.map((m) => m.content.trim());
                    const chunk = buildConversationChunk(
                        userText,
                        aiTexts.join("\n"), // 多条 AI 回复拼成 "\nAI：xxx" 格式
                    );

                    void (async () => {
                        try {
                            const svc = getMemoryService();
                            await svc.addEntry({
                                role,
                                content: chunk,
                                category: "conversation",
                                importance: "medium",
                                source: "ai-conversation",
                            });
                            // 历史重载后移除所有本轮实时消息
                            await loadHistoryForRole(role);
                        } catch (err) {
                            console.warn(
                                "[AIConversation] 批量 persistTurn 失败:",
                                err,
                            );
                            // 落库失败时允许重试
                            persistStarted = false;
                        }
                    })();
                }

                // 移除所有本轮临时消息（user + 所有 assistant）
                const allTempIds = new Set([userMsgId, ...allAiMsgIds]);
                return prev.filter((m) => !allTempIds.has(m.id));
            });
        };

        try {
            if (typeof chrome === "undefined" || !chrome.runtime?.connect) {
                throw new Error("当前环境不支持 chrome.runtime.connect");
            }

            port = chrome.runtime.connect({
                name: `ai-conversation-${messageId}`,
            });

            port.onMessage.addListener((message: any) => {
                // IGNORED 不需要检查 messageId —— 入口层发的消息格式略有不同
                if (message?.type === "AI_CONVERSATION_IGNORED") {
                    // 心情驱动忽略：AI 选择不回复，移除 placeholder ai 消息，只留用户消息
                    setMessages((prev) =>
                        prev.filter((m) => m.id !== aiMsgId),
                    );
                    // 后端已经存了 "用户：xxx" 到记忆，这里不需要再调 persistTurn
                    setLoading(false);
                    port.disconnect();
                    return;
                }

                if (!message?.payload || message.payload.messageId !== messageId) return;

                if (message.type === "AI_CONVERSATION_CONTINUING") {
                    // 连续回复开始：创建新的 placeholder AI 消息
                    const newAiMsgId = genId();
                    const newAiMsg: ChatMessage = {
                        id: newAiMsgId,
                        role: "assistant",
                        content: "",
                        streaming: true,
                        createdAt: Date.now(),
                    };
                    currentStreamingAiId = newAiMsgId;
                    allAiMsgIds.push(newAiMsgId);
                    setMessages((prev) => [...prev, newAiMsg]);
                    return;
                }

                if (message.type === "AI_CONVERSATION_STREAM_DATA") {
                    const chunk = message.payload.content || "";
                    if (!chunk) return;

                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === currentStreamingAiId
                                ? { ...m, content: m.content + chunk }
                                : m,
                        ),
                    );
                    return;
                }

                if (message.type === "AI_CONVERSATION_CONTINUOUS_COMPLETE") {
                    // 所有连续回复轮次结束 —— 把正在 streaming 的消息都停掉
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === currentStreamingAiId
                                ? { ...m, streaming: false }
                                : m,
                        ),
                    );
                    return;
                }

                if (message.type === "AI_CONVERSATION_COMPLETE") {
                    // 最终终点：确保所有 streaming 消息都停掉
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.role === "assistant" && m.streaming
                                ? { ...m, streaming: false }
                                : m,
                        ),
                    );
                    // 对话完成 → 批量写入记忆系统
                    void persistTurn();
                    setLoading(false);
                    port?.disconnect();
                } else if (message.type === "AI_CONVERSATION_ERROR") {
                    setErrorNotice(message.payload.error || "AI 响应失败");
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === currentStreamingAiId
                                ? {
                                      ...m,
                                      streaming: false,
                                      content:
                                          m.content +
                                          (m.content ? "" : "[AI 返回失败]"),
                                  }
                                : m,
                        ),
                    );
                    // 出错也批量保存（有多少存多少）
                    void persistTurn();
                    setLoading(false);
                    port?.disconnect();
                }
            });

            port.onDisconnect.addListener(() => {
                setLoading((prev) => {
                    if (prev) {
                        setMessages((prevMsgs) =>
                            prevMsgs.map((m) =>
                                m.id === aiMsgId ? { ...m, streaming: false } : m,
                            ),
                        );
                        // 断开时也尝试保存
                        void persistTurn();
                    }
                    return false;
                });
            });

            port.postMessage({
                type: "START_AI_CONVERSATION",
                payload: {
                    prompt,
                    role,
                    provider: config?.provider,
                    model: config?.modelId,
                    apiKey: config?.apiKey,
                    apiBaseUrl: config?.apiBaseUrl,
                    systemPrompt: buildFinalSystemPrompt(),
                },
            });
        } catch (error) {
            console.error("[AIConversation] send failed:", error);
            setErrorNotice(error instanceof Error ? error.message : String(error));
            setLoading(false);
            port?.disconnect();
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === aiMsgId ? { ...m, streaming: false } : m,
                ),
            );
        }
    }, [draft, role, config, buildFinalSystemPrompt]);

    /* ══════════════════════════════════════════════════════════════════
     * 键盘 / 角色切换
     * ══════════════════════════════════════════════════════════════════ */

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
            }
        },
        [send],
    );

    const handleRoleChange = (newRole: string) => {
        setRole(newRole);
        setMessages([]);
        setErrorNotice("");
    };

    /* ══════════════════════════════════════════════════════════════════
     * 渲染
     * ══════════════════════════════════════════════════════════════════ */

    const hasAnyMessages = displayMessages.length > 0;

    return (
        <div className={`ai-conversation ${className || ""}`}>
            {effectiveRoles.length > 1 && (
                <div className="ac-role-switcher">
                    <span>角色：</span>
                    <select
                        value={role}
                        onChange={(e) => handleRoleChange(e.target.value)}
                        disabled={loading}
                    >
                        {effectiveRoles.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div
                ref={listRef}
                className="ac-message-list"
                onScroll={handleListScroll}
            >
                {/* 顶部加载更多指示器 */}
                {hasMoreHistory && (
                    <button
                        type="button"
                        className="ac-load-more"
                        onClick={loadMoreHistory}
                        disabled={historyLoading}
                    >
                        {historyLoading
                            ? "加载中..."
                            : timeWindow === "1d"
                              ? "↑ 加载更早的历史（近 7 天）"
                              : timeWindow === "7d"
                                ? "↑ 加载全部历史"
                                : "— 已到最顶 —"}
                    </button>
                )}

                {!hasAnyMessages ? (
                    <div className="ac-welcome">
                        <div className="ac-welcome-title">{welcomeTitle}</div>
                        <div className="ac-welcome-body">{welcomeMessage}</div>
                        <div className="ac-welcome-hint">
                            {currentRole ? (
                                <>
                                    当前角色：<b>{currentRole.label}</b>（记忆命名空间：
                                    <code>{role}</code>）
                                </>
                            ) : (
                                "⚠ 请先在 Options 页面配置角色"
                            )}
                        </div>
                    </div>
                ) : (
                    displayMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`ac-message ac-message--${msg.role}`}
                        >
                            <div className="ac-message-avatar">
                                {msg.role === "user" ? userIcon : aiIcon}
                            </div>
                            <div className="ac-message-body">
                                {msg.content ? (
                                    <p>{msg.content}</p>
                                ) : msg.streaming ? (
                                    <p className="ac-typing">{typingMessage}</p>
                                ) : null}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {errorNotice && <div className="ac-error-bar">{errorNotice}</div>}

            <div className="ac-input-bar">
                <textarea
                    className="ac-textarea"
                    value={draft}
                    rows={2}
                    placeholder={inputPlaceholder}
                    disabled={loading}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button
                    type="button"
                    className="ac-send-btn"
                    onClick={() => void send()}
                    disabled={loading || !draft.trim()}
                >
                    {loading ? "..." : sendButtonText}
                </button>
            </div>

            {inputHint && <div className="ac-input-hint">{inputHint}</div>}
        </div>
    );
};

export default AIConversation;
