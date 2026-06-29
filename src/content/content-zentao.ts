/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-zentao.ts
 * @date 2026-02-05T02:38:01.694Z
 */

import { addElementToDom, injectScriptToActivateTab, waitForSelector } from "@/utils/element-control"
import messenger from "@/message"
import { ExtMessage, Tool, TextTool } from "@/types"
import { getRuntimeScript } from "@/utils/common";

const convertToCSV = (data: any[]): string => {
	const columns = Object.keys(data[0]).join(',');
	const rows = data.map(item => Object.values(item).join(','));
	return [columns, ...rows].join('\n');
};

const downloadCSV = (csvContent: string, filename: string): void => {
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename || 'data.csv';
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
};

const parseCSV = (csvContent: string): any[] => {
	const rows = csvContent.split('\n');
	const keys = rows[0].split(',').map(key => key.replace(/"/g, ''));
	return rows.slice(1, -1).map(row => {
		const values = row.split(',').map(value => value.replace(/"/g, '')).slice(0, -1);
		return values.reduce((obj: Record<string, string>, value, index) => {
			obj[keys[index]] = value;
			return obj;
		}, {});
	});
};

const fetchBugComments = async (bugData: any[]): Promise<void> => {
	for await (const bug of bugData) {
		try {
			const id = bug['Bug编号'];
			bug["禅道地址"] = `http://192.168.10.230/zentao/bug-view-${id}.html`;
			const docText = await fetch(`/zentao/bug-view-${id}.html`, {
				method: 'GET',
				headers: { Cookie: document.cookie },
				redirect: 'follow'
			}).then(res => res.text());
			const parser = new DOMParser();
			const doc = parser.parseFromString(docText, 'text/html');
			const commentElements = (doc.querySelector('#actionbox > div.detail-content > ol.histories-list') as HTMLElement)?.children;
			if (!commentElements) continue;
			let textContent = "";
			for (let i = 0; i < commentElements.length; i++) {
				const content = commentElements[i].querySelector(".comment-content");
				if (content) {
					textContent += (content as HTMLElement).innerText.trim().replaceAll("\n", "；");
				}
			}
			await new Promise(resolve => setTimeout(resolve, 500));
			bug['解决步骤'] = textContent;
		} catch (error) {
			maLogger.error(error);
		}
	}
};

const getDocumentContext = (): Document =>
	(document.getElementById("appIframe-qa") as HTMLIFrameElement)?.contentDocument || document;

const setupBatchEditFormStoryButton = (): void => {
	const dom = getDocumentContext();
	const cases = dom.querySelectorAll("#batchEditForm > div > table > tbody > tr");
	const story_id = (cases[0].querySelector("td:nth-child(7) > select > option") as HTMLOptionElement)?.value || "";
	maLogger.log(story_id);
	cases.forEach(e => {
		(e.querySelector("td:nth-child(7) > div > div > input") as HTMLInputElement).value = story_id;
		(e.querySelector("td:nth-child(7) > select > option") as HTMLOptionElement).value = story_id;
	});
};

const setupBatchEditFormModuleButton = (): void => {
	const dom = getDocumentContext();
	const cases = dom.querySelectorAll("#batchEditForm > div > table > tbody > tr");
	const module_id = (cases[0].querySelector("td:nth-child(5) > select") as HTMLOptionElement)?.value || "";
	maLogger.log(module_id);
	cases.forEach(e => {
		(e.querySelector("td:nth-child(5) > div >a> div > input") as HTMLInputElement).value = module_id;
		(e.querySelector("td:nth-child(5) > select") as HTMLOptionElement).value = module_id;
	});
};

const messageHandlers = {
	default: (...args: any) => {
		maLogger.error("未定义的消息类型", args);
	}
};

const shouldHandleZenTaoMessage = (message: ExtMessage): boolean =>
	message.target === 'content-zentao' && !!message.type;

const executeZenTaoMessageHandlers = (type: string, data: any): void => {
	const steps = [type];
	let step = steps.shift();
	while (step) {
		const handler = messageHandlers[step as keyof typeof messageHandlers];
		if (handler) {
			handler(data);
		}
		step = steps.shift();
	}
};

const initZenTaoMessageListener = (): void => {
	messenger.ext.listen((message: ExtMessage, sender) => {
		maLogger.log("Received message:", message, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
		const { type, payload } = message;
		if (!shouldHandleZenTaoMessage(message) || !type) {
			return true;
		}
		maLogger.info(`Received request: ${type}`, payload, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
		executeZenTaoMessageHandlers(type, payload as any);
	});
};

export default (ctx: AppContext, config = {}) => {
	let bugData: any[];
	let filename: string;

	const exportBugComment = () => {
		const csvFileInput = document.getElementById('csvFileInput') as HTMLInputElement;
		const exportConfirmButton = document.getElementById('export_confirm') as HTMLButtonElement;
		csvFileInput.addEventListener('change', function (event) {
			if (!event.target) return;
			const file = (event.target as HTMLInputElement).files![0];
			filename = file.name;
			if (file) {
				const reader = new FileReader();
				reader.onload = function (e: any) {
					bugData = parseCSV(e.target.result);
					maLogger.log(bugData);
				};
				reader.readAsText(file);
			}
		});
		exportConfirmButton.addEventListener("click", async function () {
			if (!bugData) return;
			await fetchBugComments(bugData);
			maLogger.log(bugData);
			const csvContent = convertToCSV(bugData);
			downloadCSV(csvContent, filename);
		});
		csvFileInput.click();
	};

	const updateToolbar = async (tools: Tool[]) => {
		try {
			if (ctx.self === ctx.top) {
				const toolBarInstance = ctx.gmod("__MODULE_TEXTSELECTIONTOOLBAR");
				if (!toolBarInstance) {
					maLogger.info("无法访问textSelectionToolbar实例，尝试加载");
					messenger.ext.send({
						type: 'UPDATE_TOOLBAR_TOOLS',
						payload: { tools },
						target: 'content'
					});
				} else {
					toolBarInstance.updateTools(tools);
				}
			}
		} catch (error) {
			maLogger.log("发送侧边栏工具更新请求失败: ", error);
		}
	};

	initZenTaoMessageListener();

	window.onload = () => {
		maLogger.log("禅道页面加载完成,开始监听消息");

		location.pathname.match("bug-browse") &&
			waitForSelector({
				selector: "#exportActionMenu > li:last-child",
				filter: (el: HTMLElement) => el.textContent?.trim() == "导出数据",
				callback: addElementToDom({
					tag: "li",
					attrs: { id: "exportBugCommentLi", "innerHTML": "<a class='export'>从外部索引导出bug</a>" },
					eventlistener: { "click": exportBugComment }
				})
			});

		waitForSelector({
			selector: "#batchEditForm > div > table > thead > tr > th.c-story",
			// filter: (el: HTMLElement) => el.textContent?.trim() == "相关研发需求",
			useMutationObserver: true,
			callback: addElementToDom({
				tag: "button",
				attrs: { id: "replaceC-Story", innerText: "一键同上" },
				style: { "margin": "5px 5px 5px 5px" },
				eventlistener: { "click": setupBatchEditFormStoryButton }
			}),
			iframeSelector: "#appIframe-qa"
		});

		waitForSelector({
			selector: "#batchEditForm > div > table > thead > tr > th.c-module",
			// filter: (el: HTMLElement) => el.textContent?.trim() == "所属模块",
			useMutationObserver: true,
			callback: addElementToDom({
				tag: "button",
				attrs: { id: "replaceC-Module", innerText: "一键同上" },
				style: { "margin": "5px 5px 5px 5px" },
				eventlistener: { "click": setupBatchEditFormModuleButton }
			}),
			iframeSelector: "#appIframe-qa"
		});

		waitForSelector({
			selector: "#mainContent > div.main-col.col-8 > div.main-actions > div > a:nth-child(3)",
			iframeSelector: "#appIframe-qa",
			useMutationObserver: true,
			filter: (el) => el.firstElementChild?.classList.contains('icon-testtask-runCase'),
			callback: (el: HTMLElement) => {
				const newEl = el.cloneNode(true) as HTMLElement;
				newEl.lastElementChild!.innerHTML = "自动化执行";
				newEl.removeAttribute('href');
				newEl.onclick = async () => ctx.message.info("功能开发中，敬请期待");
				el.after(newEl);
			}
		});

		waitForSelector({
			selector: "#mainContent > div.main-col.col-8 > div.main-actions > div > a:nth-child(3)",
			iframeSelector: "#appIframe-qa",
			useMutationObserver: true,
			filter: (el) => el.firstElementChild?.classList.contains('icon-testtask-runCase'),
			callback: (el: HTMLElement) => {
				const newEl = el.cloneNode(true) as HTMLElement;
				newEl.lastElementChild!.innerHTML = "录制";
				newEl.removeAttribute('href');
				newEl.onclick = async () => ctx.message.info("功能开发中，敬请期待");
				el.after(newEl);
			}
		});

		waitForSelector({
			selector: ["#dataform > div > div.side-col.col-4 > div.cell", "#dataform > table > tfoot"],
			iframeSelector: "#appIframe-qa",
			useMutationObserver: true,
			initCallback: () => injectScriptToActivateTab({ file: getRuntimeScript("zentao-content-replace") }),
			callback: (el: HTMLElement) => {
				const newEl = document.createElement('zentao-content-replace');
				if (el.classList.contains('cell')) {
					newEl.classList.add('detail');
				}
				Object.assign(newEl.style, {
					display: 'block',
					unicodeBidi: 'isolate',
					minWidth: '500px'
				});
				el.insertAdjacentElement('afterbegin', newEl);
			}
		});
	};

	return {};
};
