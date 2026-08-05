/**
 * MCPDialog 组件 - React 版本
 * AI 对话交互界面，支持流式响应和指令执行
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input, Button } from "antd";
import "./styles/mcp-dialog.scss";
import { completeChatFlow } from "@/service-worker/deepseek";
import { mcpContext } from "./mcp-context";
import { generateMultiTurnPrompt } from "./mcp-prompt";
import { parseMCPCommand } from "./mcp-parser";
import { executeMCPCommand } from "./mcp-executor";

// 对话历史项类型
interface ConversationItem {
  role: "user" | "assistant";
  content: string;
  result?: any;
}

// 组件属性
interface MCPDialogProps {
  visible?: boolean;
}

/**
 * MCPDialog 组件
 * AI 对话交互界面
 */
const MCPDialog: React.FC<MCPDialogProps> = ({ visible = true }) => {
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // 从上下文加载历史记录
  useEffect(() => {
    mcpContext.loadFromStorage();
    const history = mcpContext.getHistory();
    setConversationHistory(
      history.map((item) => ({
        role: item.role as "user" | "assistant",
        content: item.content,
      }))
    );
    scrollToBottom();
  }, []);

  // 监听对话历史变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (historyRef.current) {
        historyRef.current.scrollTop = historyRef.current.scrollHeight;
      }
    });
  }, []);

  // 处理发送消息
  const handleSend = useCallback(async () => {
    const message = inputMessage.trim();
    if (!message || loading) return;

    // 添加用户消息到历史记录
    const userItem: ConversationItem = {
      role: "user",
      content: message,
    };
    setConversationHistory((prev) => {
      const next = [...prev, userItem];
      return next;
    });
    mcpContext.addItem("user", message);
    mcpContext.saveToStorage();

    setInputMessage("");
    setLoading(true);

    try {
      // 生成AI提示词
      const formattedHistory = mcpContext.getFormattedHistory();
      const prompt = generateMultiTurnPrompt(formattedHistory, message);

      // 调用AI生成指令
      let assistantResponse = "";
      const assistantItem: ConversationItem = {
        role: "assistant",
        content: "",
      };
      setConversationHistory((prev) => [...prev, assistantItem]);

      // 使用流式响应
      await completeChatFlow(
        prompt,
        "mcp-assistant",
        {
          onData: (data: string) => {
            assistantResponse += data;
            setConversationHistory((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: assistantResponse,
                };
              }
              return next;
            });
          },
          onComplete: async () => {
            setLoading(false);

            // 添加助手响应到上下文
            mcpContext.addItem("assistant", assistantResponse);
            mcpContext.saveToStorage();

            // 解析并执行指令
            const parseResult = parseMCPCommand(assistantResponse);
            if (parseResult.success && parseResult.command) {
              // 执行指令
              const executeResult = await executeMCPCommand(parseResult.command);
              setConversationHistory((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    result: executeResult,
                  };
                }
                return next;
              });
            } else {
              // 解析失败
              setConversationHistory((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    result: {
                      success: false,
                      error: parseResult.error || "指令解析失败",
                    },
                  };
                }
                return next;
              });
            }
          },
          onError: (error: any) => {
            setLoading(false);
            maLogger.error("AI调用失败:", error);

            setConversationHistory((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: "AI调用失败，请稍后重试",
                  result: {
                    success: false,
                    error: error.message || "AI调用失败",
                  },
                };
              }
              return next;
            });

            mcpContext.addItem("assistant", "AI调用失败，请稍后重试");
            mcpContext.saveToStorage();
          },
        }
      );
    } catch (error) {
      setLoading(false);
      maLogger.error("发送消息失败:", error);

      const errorItem: ConversationItem = {
        role: "assistant",
        content: "发送消息失败，请稍后重试",
        result: {
          success: false,
          error: error instanceof Error ? error.message : "发送消息失败",
        },
      };
      setConversationHistory((prev) => [...prev, errorItem]);
      mcpContext.addItem("assistant", errorItem.content);
      mcpContext.saveToStorage();
    }
  }, [inputMessage, loading]);

  // 处理清空历史
  const handleClear = useCallback(() => {
    setConversationHistory([]);
    mcpContext.clearHistory();
    mcpContext.saveToStorage();
  }, []);

  // 处理回车键发送
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="mcp-dialog">
      {/* 对话历史 */}
      <div ref={historyRef} className="dialog-history">
        {conversationHistory.map((item, index) => (
          <div
            key={index}
            className={`message-item ${item.role}`}
          >
            <div className="message-avatar">
              {item.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="message-content">
              <div className="message-text">{item.content}</div>
              {item.result && (
                <div className="message-result">
                  <div className="result-label">执行结果：</div>
                  <div
                    className={`result-content ${
                      item.result.success ? "success" : "error"
                    }`}
                  >
                    {item.result.success
                      ? item.result.result
                      : item.result.error}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 加载状态 */}
        {loading && (
          <div className="loading-item">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="loading-text">AI正在思考...</div>
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="input-area">
        <Input.TextArea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          rows={2}
          placeholder="请输入您想要执行的操作，例如：点击页面右上角的登录按钮"
          style={{ resize: "none" }}
        />
        <div className="input-actions">
          <Button
            type="primary"
            disabled={!inputMessage.trim() || loading}
            onClick={handleSend}
          >
            发送
          </Button>
          <Button onClick={handleClear}>清空</Button>
        </div>
      </div>
    </div>
  );
};

export default MCPDialog;
