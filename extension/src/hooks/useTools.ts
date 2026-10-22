import { useCallback, useEffect, useRef, useState } from "react";
import { getAllFrameOrigins } from "@/utils";
import type { WebMcpTool } from "@/types/web-mcp";

interface ToolsUpdatedMessage {
  type: "TOOLS_UPDATED";
  tabId?: number;
  tools?: WebMcpTool[];
  error?: string;
}

export function useTools(): {
  tools: WebMcpTool[];
  status: string;
  tabId: number | null;
  refresh: () => Promise<void>;
} {
  const [tools, setTools] = useState<WebMcpTool[]>([]);
  const [status, setStatus] = useState("");
  const [tabId, setTabId] = useState<number | null>(null);
  const toolsRef = useRef<WebMcpTool[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    toolsRef.current = [];
    setTools([]);
    setTabId(null);
    setStatus("正在发现当前页面工具…");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (typeof tab?.id !== "number") {
        throw new Error("无法获取当前活动标签页。");
      }
      setTabId(tab.id);
      setStatus("正在发现当前页面工具…");
      const fromOrigins = await getAllFrameOrigins(tab.id);
      const response = await chrome.tabs.sendMessage(
        tab.id,
        { action: "LIST_TOOLS", fromOrigins },
        { frameId: 0 },
      );
      if (response?.success === false) {
        throw new Error(response.error || "当前页面无法发现 WebMCP 工具。");
      }
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const listener = (
      rawMessage: unknown,
      sender: chrome.runtime.MessageSender,
    ): void => {
      if (!rawMessage || typeof rawMessage !== "object") return;
      const message = rawMessage as ToolsUpdatedMessage;
      if (message?.type !== "TOOLS_UPDATED") return;
      const messageTabId = message.tabId ?? sender.tab?.id;
      if (typeof messageTabId !== "number") return;

      void chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => {
          if (tab?.id !== messageTabId) return;
          setTabId(messageTabId);
          const incoming = Array.isArray(message.tools) ? message.tools : [];
          const haveNewTools =
            JSON.stringify(toolsRef.current) !== JSON.stringify(incoming);
          toolsRef.current = incoming;
          setTools(incoming);
          setStatus(message.error || "");
          if (haveNewTools) {
            window.dispatchEvent(
              new CustomEvent("webmcp:tools-changed", { detail: incoming }),
            );
          }
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : String(error));
        });
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return { tools, status, tabId, refresh };
}