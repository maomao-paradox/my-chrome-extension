import type { ContextMenuHandler } from '@/types';
import { addDisabledDomain, extractDomain } from './domain-state';

interface MenuItem extends chrome.contextMenus.CreateProperties {
	children?: MenuItem[];
}

const contextMenus = chrome.contextMenus;

const menuList: MenuItem[] = [
	{
		id: 'OPEN_SIDEPANEL',
		title: '开启侧边栏',
		contexts: ['all']
	},
	{
		id: 'DISABLE_ON_THIS_DOMAIN',
		title: '在此页面上禁用',
		contexts: ['all']
	}
];

const menuHandlers: ContextMenuHandler = {
	OPEN_SIDEPANEL: (tab) => {
		chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
	},
	DISABLE_ON_THIS_DOMAIN: async (tab) => {
		try {
			console.log('禁用此域名:', tab.url);
			if (!tab.url) {
				console.error('无法获取当前标签页URL');
				return;
			}

			const domain = extractDomain(tab.url);
			if (!domain) {
				console.error('无法提取域名');
				return;
			}

			await addDisabledDomain(domain);

			try {
				chrome.notifications.create({
					type: 'basic',
					iconUrl: 'static/icons/favicon48.ico',
					title: '扩展已禁用',
					message: `已在 ${domain} 上禁用扩展，页面即将刷新...`
				});
			} catch (notifyError) {
				console.error('创建通知失败:', notifyError);
			}

			if (tab.id) {
				chrome.tabs.reload(tab.id);
			}

			console.log(`已成功禁用域名: ${domain}`);
		} catch (error) {
			console.error('禁用域名失败:', error);
		}
	}
};

function createMenu(menu: MenuItem): void {
	contextMenus.create({
		id: menu.id,
		title: menu.title,
		contexts: menu.contexts,
		parentId: menu.parentId,
	}, () => {
		if (chrome.runtime.lastError) {
			console.log(chrome.runtime.lastError);
		}

		menu.children?.forEach(createMenu);
	});
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
			console.error('无法获取当前活跃标签页');
			return;
		}

		if (handler) {
			handler(tab);
		} else {
			console.log('未处理的菜单点击:', info.menuItemId);
		}
	});
}
