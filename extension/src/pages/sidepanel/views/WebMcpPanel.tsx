import { useCallback, useEffect, useState } from "react";
import type { FC, FormEvent } from "react";
import { useTools } from "@/hooks/useTools";
import { usePromptAI } from "@/hooks/usePromptAI";
import { executeTool } from "@/utils/executeTool";
import type { WebMcpTool } from "@/types/web-mcp";
import "./web-mcp.scss";

const formatValue = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

const WebMcpPanel: FC = () => {
  const { tools, status, tabId, refresh } = useTools();
  const assistant = usePromptAI({ tools, tabId });
  const [selectedToolKey, setSelectedToolKey] = useState("");
  const [argumentsText, setArgumentsText] = useState("{}");
  const [manualResult, setManualResult] = useState("");
  const [manualError, setManualError] = useState("");
  const [executing, setExecuting] = useState(false);
  const [prompt, setPrompt] = useState("");

  const selectedTool = tools.find(
    (tool) => `${tool.frameId}:${tool.name}` === selectedToolKey,
  );

  useEffect(() => {
    if (tools.length === 0) {
      setSelectedToolKey("");
      return;
    }
    if (!tools.some((tool) => `${tool.frameId}:${tool.name}` === selectedToolKey)) {
      setSelectedToolKey(`${tools[0].frameId}:${tools[0].name}`);
      setArgumentsText("{}");
    }
  }, [selectedToolKey, tools]);

  useEffect(() => {
    const onUpdated = (
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "loading") {
        setManualResult("");
        setManualError("");
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [tabId]);

  const runManualTool = useCallback(async () => {
    if (!selectedTool || tabId === null || executing) return;
    setManualError("");
    setManualResult("");
    let args: unknown;
    try {
      args = JSON.parse(argumentsText || "{}");
    } catch (error) {
      setManualError(
        error instanceof Error ? `参数 JSON 无效：${error.message}` : String(error),
      );
      return;
    }
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      setManualError("工具参数必须是 JSON 对象。");
      return;
    }

    setExecuting(true);
    try {
      const result = await executeTool(
        tabId,
        selectedTool.name,
        JSON.stringify(args),
        selectedTool.frameId,
      );
      setManualResult(formatValue(result));
    } catch (error) {
      setManualError(error instanceof Error ? error.message : String(error));
    } finally {
      setExecuting(false);
    }
  }, [argumentsText, executing, selectedTool, tabId]);

  const submitPrompt = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const current = prompt.trim();
      if (!current || assistant.busy) return;
      setPrompt("");
      await assistant.promptAI(current);
    },
    [assistant, prompt],
  );

  const toolLabel = (tool: WebMcpTool) => `${tool.name} (frame ${tool.frameId})`;

  return (
    <section className="webmcp-panel">
      <header className="webmcp-header">
        <div>
          <p className="webmcp-eyebrow">WEB MODEL CONTEXT PROTOCOL</p>
          <h2>网页工具</h2>
          <p>发现当前页面及 iframe 注册的工具，并手动或通过 AI 调用。</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          刷新工具
        </button>
      </header>

      {status && <p className="webmcp-notice" role="status">{status}</p>}

      <section className="webmcp-section" aria-labelledby="webmcp-tools-title">
        <div className="webmcp-section-heading">
          <h3 id="webmcp-tools-title">当前页面工具</h3>
          <span>{tools.length} 项</span>
        </div>
        {tools.length === 0 ? (
          <p className="webmcp-empty">
            尚未发现工具。请确认当前网页已启用 WebMCP，并尝试刷新工具列表。
          </p>
        ) : (
          <ul className="webmcp-tool-list">
            {tools.map((tool) => (
              <li key={`${tool.frameId}:${tool.name}`}>
                <div>
                  <strong>{tool.name}</strong>
                  <span>Frame {tool.frameId}</span>
                </div>
                <p>{tool.description || "没有工具说明。"}</p>
                {tool.annotations && (
                  <small>标注：{tool.annotations}</small>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="webmcp-section" aria-labelledby="webmcp-manual-title">
        <div className="webmcp-section-heading">
          <h3 id="webmcp-manual-title">手动测试</h3>
        </div>
        {tools.length > 0 ? (
          <>
            <label className="webmcp-field">
              工具
              <select
                value={selectedToolKey}
                onChange={(event) => {
                  setSelectedToolKey(event.target.value);
                  setArgumentsText("{}");
                  setManualResult("");
                  setManualError("");
                }}
              >
                {tools.map((tool) => (
                  <option
                    key={`${tool.frameId}:${tool.name}`}
                    value={`${tool.frameId}:${tool.name}`}
                  >
                    {toolLabel(tool)}
                  </option>
                ))}
              </select>
            </label>
            {selectedTool && (
              <details className="webmcp-schema">
                <summary>查看参数 Schema</summary>
                <pre>{selectedTool.inputSchema || "{}"}</pre>
              </details>
            )}
            <label className="webmcp-field">
              参数（JSON 对象）
              <textarea
                rows={5}
                value={argumentsText}
                spellCheck={false}
                onChange={(event) => setArgumentsText(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="webmcp-primary"
              disabled={!selectedTool || executing}
              onClick={() => void runManualTool()}
            >
              {executing ? "执行中…" : "执行工具"}
            </button>
            {manualError && (
              <pre className="webmcp-output webmcp-error" role="alert">
                {manualError}
              </pre>
            )}
            {manualResult && (
              <pre className="webmcp-output">{manualResult}</pre>
            )}
          </>
        ) : (
          <p className="webmcp-empty">发现工具后即可在这里填写参数并执行。</p>
        )}
      </section>

      <section className="webmcp-section" aria-labelledby="webmcp-ai-title">
        <div className="webmcp-section-heading">
          <h3 id="webmcp-ai-title">AI 助手</h3>
          <button type="button" onClick={assistant.reset} disabled={assistant.busy}>
            清空对话
          </button>
        </div>
        {tools.length === 0 && (
          <p className="webmcp-empty">
            AI 对话仍可使用，但当前没有可供调用的页面工具。
          </p>
        )}
        <div className="webmcp-chat" aria-live="polite">
          {assistant.messages.map((message, index) => (
            <article
              className={`webmcp-chat-message webmcp-chat-message--${message.role}`}
              key={`${message.role}-${index}`}
            >
              <strong>
                {message.role === "user"
                  ? "你"
                  : message.role === "tool"
                    ? "工具结果"
                    : "AI"}
              </strong>
              <pre>{message.content || (assistant.busy ? "正在处理…" : "")}</pre>
            </article>
          ))}
        </div>
        {assistant.error && (
          <p className="webmcp-error" role="alert">{assistant.error}</p>
        )}
        <form className="webmcp-prompt-form" onSubmit={submitPrompt}>
          <textarea
            rows={3}
            value={prompt}
            placeholder="描述你想完成的网页任务"
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button
            type="submit"
            className="webmcp-primary"
            disabled={assistant.busy || !prompt.trim()}
          >
            {assistant.busy ? "处理中…" : "发送"}
          </button>
        </form>
        <p className="webmcp-provider-note">
          DeepSeek 网页会话支持工具调用，无需配置 API Key；AI 会自动执行网页工具，可能改变页面状态，
          请仅在信任当前网页及其工具时使用。
        </p>
      </section>
    </section>
  );
};

export default WebMcpPanel;
