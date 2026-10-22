import { injectExtensionScript } from "./script-injection";
import type { WebMcpTool } from "@/types/web-mcp";

const updateBadge = async (tabId: number, count: number): Promise<void> => {
  try {
    await chrome.action.setBadgeText({
      tabId,
      text: count > 99 ? "99+" : count ? String(count) : "",
    });
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: "#2563eb",
    });
  } catch (error) {
    console.warn(`[WebMCP] Could not update badge for tab ${tabId}:`, error);
  }
};

const listToolsForTab = async (tabId: number): Promise<void> => {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    const fromOrigins = [
      ...new Set(
        (frames ?? [])
          .map((frame) => {
            try {
              return new URL(frame.url).origin;
            } catch {
              return null;
            }
          })
          .filter((origin): origin is string => !!origin),
      ),
    ];
    await chrome.tabs.sendMessage(
      tabId,
      { action: "LIST_TOOLS", fromOrigins },
      { frameId: 0 },
    );
  } catch (error) {
    console.debug(`[WebMCP] Tool discovery unavailable in tab ${tabId}:`, error);
  }
};

const injectIntoOpenTabs = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number } => !!tab.id)
      .map(async ({ id: tabId }) => {
        try {
          await injectExtensionScript(tabId, "sfs/web-mcp.js", {
            allFrames: true,
          });
          await listToolsForTab(tabId);
        } catch (error) {
          console.debug(`[WebMCP] Could not inject into tab ${tabId}:`, error);
        }
      }),
  );
};

export function initWebMcpBackground(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === "WEB_MCP_GET_FRAME_ID") {
      sendResponse({ frameId: sender.frameId ?? 0 });
      return false;
    }

    if (message?.type !== "TOOLS_UPDATED") {
      return false;
    }
    if (sender.frameId !== 0) {
      return false;
    }

    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      return false;
    }

    const tools = Array.isArray(message.tools)
      ? (message.tools as WebMcpTool[])
      : [];
    void updateBadge(tabId, tools.length);
    void chrome.runtime.sendMessage({
      type: "TOOLS_UPDATED",
      tabId,
      tools,
      url: typeof message.url === "string" ? message.url : sender.url,
      error: typeof message.error === "string" ? message.error : undefined,
    }).catch((error) => {
      if (!String(error).includes("Receiving end does not exist")) {
        console.warn("[WebMCP] Could not notify extension pages:", error);
      }
    });
    return false;
  });

  chrome.runtime.onInstalled.addListener(() => {
    void injectIntoOpenTabs().catch((error) => {
      console.error("[WebMCP] Injection into existing tabs failed:", error);
    });
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void listToolsForTab(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") {
      return;
    }
    void updateBadge(tabId, 0);
    if (tab.active) {
      void listToolsForTab(tabId);
    }
  });
}
