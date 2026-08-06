import type { ContextMenuHandler } from "@/types";
import { toggleDisabledDomain, extractDomain } from "./domain-state";

interface MenuItem extends chrome.contextMenus.CreateProperties {
  children?: MenuItem[];
}

const contextMenus = chrome.contextMenus;

const menuList: MenuItem[] = [
  {
    id: "OPEN_SIDEPANEL",
    title: "开启侧边栏",
    contexts: ["all"],
  },
  {
    id: "DISABLE_ON_THIS_DOMAIN",
    title: "在此站点禁用/启用扩展",
    contexts: ["all"],
  },
];

const menuHandlers: ContextMenuHandler = {
  OPEN_SIDEPANEL: (tab) => {
    chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
  },
  DISABLE_ON_THIS_DOMAIN: async (tab) => {
    try {
      console.log("当前站点:", tab.url);
      if (!tab.url) {
        console.error("无法获取当前站点URL");
        return;
      }

      const domain = extractDomain(tab.url);
      if (!domain) {
        console.error("无法提取站点域名URL");
        return;
      }

      await toggleDisabledDomain(domain);

      try {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "static/icons/favicon48.ico",
          title: "扩展已禁用",
          message: `已在 ${domain} 上禁用扩展，页面即将刷新...`,
        });
      } catch (notifyError) {
        console.error("创建通知失败:", notifyError);
      }

      if (tab.id) {
        chrome.tabs.reload(tab.id);
      }

      console.log(`已成功禁用域名: ${domain}`);
    } catch (error) {
      console.error("禁用域名失败:", error);
    }
  },
};

function createMenu(menu: MenuItem): void {
  contextMenus.create(
    {
      id: menu.id,
      title: menu.title,
      contexts: menu.contexts,
      parentId: menu.parentId,
    },
    () => {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);
      }

      menu.children?.forEach(createMenu);
    },
  );
}

export function initMenuListener(): void {
  chrome.runtime.onInstalled.addListener(() => {
    for (const menu of menuList) {
      createMenu(menu);
    }
  });

  contextMenus.onClicked.addListener((info, tab) => {
    const handler = menuHandlers[String(info.menuItemId)];
    if (!tab || !tab.id || !tab.windowId) {
      console.error("无法获取当前活跃标签页");
      return;
    }

    if (handler) {
      handler(tab);
    } else {
      console.log("未处理的菜单点击:", info.menuItemId);
    }
  });
}
