/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-mria.ts
 * @date 2026-02-05T02:38:01.694Z
 */

import { getQueryParams, parseCSV, base64ToBlob, randomString, randomNum, randomSelect, generateRandomIDCard, generateRandomPhoneNumber } from "@/utils/base"
import { cloneEl, saveToLocal, addElementToDom, injectScriptToActivateTab, addFileInput, waitForSelector, injectVueComponent, getElementAbsolutePosition, createEl, PositionStrategy } from "@/utils/element-control"
import { createApp } from 'vue'
import { Requester, getFormCodeByName, addForm, addUser, autoDelay, autoCheckTimeoutTask, createTreatflow, deletePatient, getFormDesign, get_token, markHighRisk, registerPatient, reloadRemoteDevices, updateForm, updatePatientImage, uploadSignPicture, userLogin, userLogout } from "@/services/api/mria-api"
import type { PatientRegistrationData, Response, ExtMessage, MessageHandler, Tool } from "@/types"
import { QuickLogin, ElInputSearch } from "@components/index"
import { storage } from "@/stores"
import { getRuntimeScript,  } from "@/utils"
import { whenDomReady } from "@/utils/element-control"
import messenger from "@/message"
import xhrRules from "@/runtime/xhr-patch/rules"
import { injectXhrPatch } from "@/runtime/xhr-patch/xhr_message_handler"


export const tools: Tool[] = [
	{
		id: "0",
		label: "患者管理",
		children: [
			{
				id: "registerPatient",
				label: "从剪贴板创建患者",
			}, {
				id: "deletePatient",
				label: "删除当前患者",
			}, {
				id: "markHighRisk",
				label: "该患者标注为“高风险”",
			}, {
				id: "updatePatientImage",
				label: "更新患者头像（不走人脸服务）",
			}
		],
	},
	{
		id: "1",
		label: "表单功能",
		children: [
			{
				id: "editComponent",
				label: "编辑组件属性",
			}, {
				id: "downloadForm",
				label: "下载当前表单",
			}, {
				id: "uploadForm",
				label: "批量上传表单",
			}
		]
	},
	{
		id: "2",
		label: "定时任务",
		children: [
			{
				id: "autoDelay",
				label: "触发自动顺延",
			}, {
				id: "autoCheckTimeoutTask",
				label: "自动检测超时任务",
			},
		]
	},
	{
		id: "3",
		label: "其他功能",
		children: [
			{
				id: "beautifyLog",
				label: "日志可视化",
			}, {
				id: "createTestUser",
				label: "创建测试用户",
			}, {
				id: "reloadRemoteDevices",
				label: "重载远程控制beta",
			}, {
				id: "uploadSignPicture",
				label: "上传签名图片",
			}, {
				id: "downloadImages",
				label: "下载当前页面所有图片资源",
			}, {
				id: "getTabInfo",
				label: "获取当前页面tab信息",
			},
		]
	}, {
		id: "enhanceWeb",
		label: "网页增强",
		children: [
			{
				id: "enhance-quickLogin",
				label: "快捷登录",
			},
			{
				id: "enhance-Nav",
				label: "扩展导航地址",
			},
			{
				id: "enhance-unblockInput",
				label: "解除输入阻止",
			},
			{
				id: "enhance-editForm",
				label: "表单配置可视化",
			},
		]
	}
];

const ROLES = ["医生", "助理医生", "物理师", "定位技师", "治疗技师", "主任医生", "物理主任", "护士"];
const _ADMIN = 'admin';

const checkVaild = (value: { string: any }): boolean =>
	value && typeof value === 'object' && Object.keys(value).length > 0;

const createHandleRequest = (ctx: AppContext) =>
	(_R: Function, ...args: any): Promise<any> => {
		maLogger.log(_R.name, ...args);
		return new Promise((resolve, reject) => {
			if (!_R || typeof _R !== "function") {
				reject(new Error(`api[${_R}] not found in serverApi`));
				return;
			}
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
				return;
			}
			_R.name === "userLogin" || ctx.requester.access_token || ctx.requester.restruct();
			const res = _R.apply(ctx.requester, args);
			resolve(res);
		});
	};

const createHandleResponse = (ctx: AppContext) =>
	(res: Response<any>, condition?: boolean): any => {
		maLogger.log(res, condition);
		const timeout = 2000;
		const msg = res.msg || res.message || res;

		const isSuccess = (res.code && res.code === 10000) || condition;
		if (isSuccess) {
			if (msg) {
				ctx.message.success(msg as string, timeout);
			}
			return res.data || res;
		} else {
			ctx.message.error(msg as string, timeout);
			throw new Error(msg as string);
		}
	};

const removeDisabled = (): void => {
	Array.from(["div", "button", "li", "span", "label", "input"]).forEach(
		s => waitForSelector({
			selector: s + ".is-disabled",
			callback: (el: HTMLElement) => {
				el.classList.remove('is-disabled', 'disabled', 'disabledBtn');
				//@ts-ignore
				el['disabled'] = false;
				//@ts-ignore
				el['aria-disabled'] = false;
				el.childNodes?.length > 0 && Array.from(el.childNodes).forEach(e => {
					if (e instanceof Node && e.nodeName !== "#comment" && 'disabled' in e) {
						(e as any).disabled = false;
					}
				});
			}
		}));
};

const sendRequestToBack = async (requests: any, handleResponse: (response: any) => void): Promise<void> => {
	chrome.runtime.sendMessage(requests, response =>
		chrome.runtime.lastError
			? maLogger.log(chrome.runtime.lastError.message)
			: handleResponse ? handleResponse(response) : maLogger.log("Received response from background:", response));
};

export default (ctx: AppContext, config = {}) => {
	const roles = Array.from(ROLES);
	const handleRequest = createHandleRequest(ctx);
	const handleResponse = createHandleResponse(ctx);

	/**
	 * 读取表单文件内容
	 * @param file 上传的 .form 文件
	 * @returns 表单名称和组件JSON字符串
	 */
	const readFormFile = (file: File): Promise<{ name: string, components: string }> => {
		return new Promise((resolve, reject) => {
			const name = file.name.split('.form')[0];
			const reader = new FileReader();
			reader.readAsText(file);
			reader.onload = (event: ProgressEvent<FileReader>) => {
				const components = event.target?.result as string;
				resolve({ name, components });
			};
			reader.onerror = reject;
		});
	};

	/**
	 * 处理表单上传的核心逻辑：先创建表单，根据条件处理响应或更新表单
	 * @param name 表单名称
	 * @param components 组件JSON字符串
	 */
	const processFormUpload = async (name: string, components: string): Promise<void> => {
		const addFormRes = await handleRequest(addForm, name) as any;

		const shouldHandleDirectly = typeof addFormRes === 'object'
			&& addFormRes !== null
			&& !('data' in addFormRes)
			&& !ctx.globalConfig.FillForm.value;

		if (shouldHandleDirectly) {
			handleResponse(addFormRes as Response<any>);
			return;
		}

		const formCode = await handleRequest(getFormCodeByName, name);
		const updateRes = await handleRequest(updateForm, formCode, name, JSON.parse(components));
		handleResponse(updateRes as Response<any>);
	};

	/**
	 * 验证消息是否有效且目标为 content
	 */
	const shouldHandleMessage = (message: ExtMessage): boolean => {
		const { type, target } = message;
		return !!type && target === 'content';
	};

	/**
	 * 确保 requester 已初始化（惰性初始化）
	 */
	const ensureRequesterReady = (): void => {
		if (!ctx.requester) {
			get_token()
				? ctx.requester = new Requester()
				: maLogger.warn("当前内容页不支持Requester实例化");
		}
	};

	/**
	 * 执行消息处理步骤：调用 messageHandlers 中对应的处理器
	 */
	const executeMessageHandlers = (type: string, data: any): void => {
		const steps = [type];
		let step = steps.shift();

		while (step) {
			const handler = messageHandlers[step as keyof typeof messageHandlers];
			if (handler) {
				handler(data);
			} else {
				return;
			}
			step = steps.shift();
		}
	};

	/**
	 * 统一处理接收到的扩展消息
	 */
	const handleExtensionMessage = (message: ExtMessage, sender: chrome.runtime.MessageSender): boolean => {
		const { type, payload: data } = message;

		maLogger.log(`Received request: `, type, data, "from",
			sender.tab ? `tab ${sender.tab.id}` : "background");

		if (!shouldHandleMessage(message) || !type) {
			return false;
		}

		ensureRequesterReady();
		executeMessageHandlers(type, data);
		return true;
	};

	/**
	 * 为单个角色获取拼音并生成用户配置项
	 */
	const fetchRolePinyinConfig = async (role: string): Promise<{ key: string, config: any } | null> => {
		const realname = role + "A";
		const response: any = await messenger.ext.send({
			type: "getPinyin",
			payload: realname,
			target: 'background'
		});

		if (response?.success) {
			return {
				key: response.payload,
				config: { realname, enabled: true, role, password: "123456" }
			};
		}
		return null;
	};

	/**
	 * 根据 roles 数组批量生成完整的 userConfig 配置对象
	 */
	const buildUserConfigFromRoles = async (): Promise<Record<string, any>> => {
		maLogger.info("初始化默认登录用户", roles);
		const userConfig: Record<string, any> = {};

		if (roles.length === 0) {
			return userConfig;
		}

		const pinyinPromises = roles.map(role => fetchRolePinyinConfig(role));
		const results = await Promise.all(pinyinPromises);

		for (const result of results) {
			if (result) {
				userConfig[result.key] = result.config;
			}
		}

		return userConfig;
	};

	/**
	 * 处理 userInfo 配置的加载和初始化
	 */
	const processUserInfoConfig = async (pageContext: any): Promise<void> => {
		const userConfig = await buildUserConfigFromRoles();
		if (Object.keys(userConfig).length > 0) {
			pageContext.userInfo = userConfig;
		}
	};

	/**
	 * 加载单个配置键的通用处理流程
	 */
	const processSingleConfigKey = async (key: string, pageContext: any): Promise<void> => {
		const savedConfig = await storage.ext.local.get(key, {});

		if (checkVaild(savedConfig)) {
			pageContext[key] = savedConfig;
		}

		if (key === 'userInfo') {
			await processUserInfoConfig(pageContext);
		}

		await storage.page.local.set(key, pageContext[key] || {});
	};

	/**
	 * 在指定元素旁挂载 QuickLogin Vue 组件到 Shadow DOM
	 */
	const enrichQuickLogin = (byElement: HTMLElement, position: {
		position: PositionStrategy | undefined,
		offset: { x?: number, y?: number }
	}): void => {
		if (!byElement) return;

		const shadowRoot = ctx.gmod("__SHADOW_DOM");
		if (!shadowRoot) {
			maLogger.error("Shadow DOM 不存在");
			return;
		}

		const positionInfo = getElementAbsolutePosition(byElement);
		const loginContainer = createEl({
			tag: 'div',
			style: "width: 180px; height: 20px;",
			attrs: { className: 'quick-login-shadow-container' }
		});

		shadowRoot.appendChild(loginContainer);

		const app = createApp(QuickLogin, {
			userList: {
				["mp" + _ADMIN]: { realname: '超级管理员', password: _ADMIN + "123", enabled: true, role: "管理员" },
				//@ts-ignore
				...ctx['userInfo']
			}
		});

		app.mount(loginContainer);

		positionInfo.positionElement({
			targetElement: loginContainer,
			strategy: position.position,
			alignment: 'center',
			offset: position.offset,
			observeReference: true
		});
	};

	/**
	 * 自定义导航链接列表配置
	 */
	const getCustomNavLinks = (): Array<[string, string]> => [
		[" 自助报道机 ", ctx.origin + '/#/selfCheckin'],
		[" 叫号大屏 ", ctx.origin + '/#/queueScreen'],
		[" 数据大屏 ", ctx.origin + '/#/es-big-screen'],
		[" 服务监视 ", "http://" + ctx.location.hostname + ':9001']
	];

	/**
	 * 在顶部菜单追加自定义导航链接
	 */
	const appendCustomNavLinks = (el: HTMLElement): void => {
		getCustomNavLinks().forEach(([name, url]) => {
			const cloned = cloneEl({
				deep: true,
				el: el.children[0] as HTMLElement,
				eventlistener: { 'click': () => ctx.open(url, '_blank') }
			});
			cloned.classList.remove('is-active');
			(cloned.children[0] as HTMLElement).innerText = name;
			el.appendChild(cloned);
		});
	};

	/**
	 * 表单库搜索框输入事件处理
	 */
	const handleFormSearchInput = (event: InputEvent): void => {
		const inputElement = (event.target || event.currentTarget) as HTMLInputElement;
		const linkLibryay = document.querySelector("div#pane-linkLibryay");
		linkLibryay?.children[1].childNodes.forEach(node => {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const element = node as HTMLElement;
				if (element.innerText) {
					element.style.display = element.innerText.match(inputElement?.value) ? 'block' : 'none';
				}
			}
		});
	};

	/**
	 * 获取表单库的 ElInputSearch 组件配置
	 */
	const getFormSearchComponentConfig = () => ({
		placeholder: "请输入表单名称进行检索",
		handleInput: handleFormSearchInput
	});

	const parasitism = (): void => {
		if (location.hash.match("#/login")) {
			waitForSelector({
				selector: "#app > div > div.login-main > form > div.login-form-title",
				callback: enrichQuickLogin,
				callbackArgs: [{ position: "right", offset: { x: -180, y: 0 } }],
				maxWaitTimes: 10,
				useMutationObserver: true,
				timeout: 5000
			});
		}

		waitForSelector({
			selector: "#app > div > div.navbar > div.right-menu",
			callback: enrichQuickLogin,
			callbackArgs: [{ position: "left", offset: { x: 113, y: 0 } }],
			maxWaitTimes: 10
		});

		waitForSelector({
			selector: "#app > div > div.navbar > div.top-menu",
			callback: appendCustomNavLinks,
			maxWaitTimes: 10
		});

		waitForSelector({
			selector: "div#pane-linkLibryay",
			callback: injectVueComponent(ElInputSearch, getFormSearchComponentConfig()),
			callbackArgs: ["afterbegin"],
			maxWaitTimes: 10
		}).then(res => maLogger.log(res));
	};

	// 命令处理器对象，将每个action的处理逻辑提取为单独的方法
	const messageHandlers: MessageHandler = {
		quickLogin: async (data: any) => {
			const { username, password } = data;
			if (!username || !password) {
				ctx.message.error("用户名或密码不能为空");
				return;
			}
			try {
				await handleRequest(userLogout);
				const userInfo = await handleRequest(userLogin, username, password).then((res) => handleResponse(res as Response<any>));
				storage.page.local.set('Manteia-UserInfo', JSON.stringify(userInfo));
				document.cookie = "Manteia-token=" + userInfo['access_token'];
				ctx.requester.restruct();
				location.reload();
			} catch (err) {
				maLogger.error(err);
			}
		},

		registerPatient: async (data: any) => {
			// 创建患者
			const patientData: PatientRegistrationData = {
				admission_number: randomString(8, "number"),
				name: null,
				gender: randomSelect(["男", "女", "保密"]) as string,
				id_number: generateRandomIDCard(),
				age: randomNum(18, 100) as number,
				phone: generateRandomPhoneNumber(),
				birthdate: `${randomNum(1900, 2000)}-${randomNum(1, 12)}-${randomNum(1, 31)}`,
				marital_status: randomSelect(["未婚", "已婚", "离异", "丧偶", "其他"]) as string,
				patient_type: randomSelect(["住院", "门诊", "其他"]) as string,
				contact_number: generateRandomPhoneNumber(),
				payment_way: randomSelect(["商业医保", "职工医院", "城乡医保", "非医保", "城乡居民", "企业在职"], -1) as string | string[],
				docGroup: null,
				social_security_card_no: randomString(11, "number"),
				patient_id: randomString(8, "number"),
				visit_number: randomString(8, "number"),
				visit_sn: randomString(8, "number"),
				visit_times: randomNum(0, 10) as number,
				hospitalization_times: randomNum(0, 10) as number,
				allergic_history: `${randomString(256)}`,
				past_medical_history: `${randomString(256)}`
			};
			const { base_info: patient_visit_code } = await handleRequest(registerPatient, patientData).then((res: any) => res?.data);
			const id_number = patientData.id_number;
			// 创建疗程
			const treatflow_code = await handleRequest(createTreatflow, patient_visit_code).then((res: any) => handleResponse(res as Response<any>));
			ctx.location.assign(ctx.origin + `/#/flow-system/patient?id=${id_number}&pd=${patient_visit_code}&fc=${treatflow_code}`);
		},

		deletePatient: async () => {
			const params = getQueryParams();
			await handleRequest(deletePatient, params.pd).then((res: any) => handleResponse(res as Response<any>));
			history.back();
		},

		downloadForm: async () => {
			const params = getQueryParams();
			await handleRequest(getFormDesign, params.code)
				.then(res => saveToLocal(new Blob([JSON.stringify(res)], { type: 'application/json' }), `${params.name}.form`))
				.catch(err => {
					handleResponse(err);
					maLogger.error(err);
				});
		},

		uploadForm: () => {
			addFileInput(async (file: File) => {
				try {
					const { name, components } = await readFormFile(file);
					await processFormUpload(name, components);
				} catch (error) {
					maLogger.error('表单上传失败:', error);
				}
			}).click();
		},

		markHighRisk: async () => {
			const params = getQueryParams();
			handleRequest(markHighRisk, params.pd, params.fc).then((res: any) => handleResponse(res as Response<any>));
		},

		updatePatientImage: async (data?: any) => {
			if (data) {
				const { id_number, patient_visit_code, base64Data } = data;
				const imageData = base64ToBlob(base64Data, "image/jpeg");
				if (!imageData || !imageData.size) {
					throw new Error('接收到的图片数据无效:' + imageData.size);
				}
				maLogger.log('成功接收图片数据，大小:', imageData.size, 'bytes');
				handleRequest(updatePatientImage, id_number, patient_visit_code, imageData).then((res: any) => handleResponse(res));
			} else {
				const { pd, id } = getQueryParams();
				addFileInput(async (file: File) => {
					handleRequest(updatePatientImage, id, pd, file);
				}).click();
			}
		},

		uploadSignPicture: () => {
			addFileInput(async (file: File) => {
				handleRequest(uploadSignPicture, file);
			}).click();
		},

		autoDelay: async () => {
			await handleRequest(autoDelay).then((res: any) => handleResponse(res));
			location.reload();
		},

		autoCheckTimeoutTask: async () => {
			await handleRequest(autoCheckTimeoutTask).then((res: any) => handleResponse(res));
			location.reload();
		},

		editComponent: () => {
			waitForSelector({
				selector: "div#tab-first",
				filter: (el: HTMLElement) => el.textContent?.trim() !== "",
				callback: (el: HTMLElement) => {
					const t = document.querySelector('#jsonDisplayContainer');
					const i = document.querySelector('#injecte-script');
					t && t.remove();
					i && i.remove();
					addElementToDom({
						tag: 'button',
						attrs: { className: "el-button mt-button el-button--table mt-button--table", innerText: "修改属性" },
						eventlistener: {
							click: (j: Event) => {
								const target = j.target || j.currentTarget;
								if (target instanceof HTMLElement) {
									injectScriptToActivateTab({ file: getRuntimeScript("editComponent") });
								}
							}
						}
					})(el, "afterend");
				}
			});
		},

		reloadRemoteDevices: async () => {
			await handleRequest(reloadRemoteDevices).then((res: any) => handleResponse(res));
		},
		createTestUser: () => {
			addFileInput(async (file: File) => {
				const reader = new FileReader();
				reader.readAsText(file);
				reader.onload = () => {
					const csv_data = parseCSV(reader.result as string);
					if (csv_data.length === 0) {
						maLogger.warn("文件内容为空");
						return;
					}

					csv_data.forEach(user => {
						try {
							// 使用对象参数形式调用addUser，更直观且易于扩展
							handleRequest(addUser, user);
						} catch (error) {
							// 如果对象参数形式调用失败，尝试使用旧的参数列表形式（向后兼容）
							maLogger.warn("使用对象参数形式调用addUser失败，尝试使用旧的参数列表形式", error);
							handleRequest(addUser, ...Object.values(user));
						}
					});
				};
			}).click();
		}
	};
	// 初始化消息监听器
	const initMessageListener = () => {
		ctx.requester = ctx.requester ?? new Requester();
		messenger.ext.listen(handleExtensionMessage);
	};

	const initPageConfig = (pageContext: any): void => {
		const initConfigKeys = ['userInfo'];
		Promise.all(initConfigKeys.map(key => processSingleConfigKey(key, pageContext)));
	};
	const updateSidebar = async (tools: Tool[]) => {
		// 侧边栏配置
		try {
			// 只在主页面更新侧边栏，避免iframe中重复创建
			if (ctx.self === ctx.top) {
				let sideBarInstance = ctx.gmod("__MODULE_SIDEBAR");
				maLogger.info("当前sidebar实例:", sideBarInstance);

				// 如果sidebar实例不存在，尝试获取sidebar模块并加载
				if (!sideBarInstance) {
					// 发送消息给content/index.ts，请求加载sidebar并更新工具
					messenger.ext.send({
						type: 'UPDATE_SIDEBAR_TOOLS',
						payload: { tools },
						target: 'content'
					});
				} else {
					// 如果sidebar实例存在，直接调用updateTools
					sideBarInstance.updateTools(tools);
				}
			}
		} catch (error: any) {
			maLogger.error("发送侧边栏工具更新请求失败:", error.message);
		}
	};

	whenDomReady(() => {
		// 注入XHR补丁
		injectXhrPatch(xhrRules['mria']);
		// 初始化寄生式注入
		parasitism();
		// 初始化侧边栏
		updateSidebar(tools);
	})
	// 初始化消息监听器
	initMessageListener();
	// 初始化页面配置
	initPageConfig(ctx);

	return {
		// 返回可调用的公共API
		createTestUser: messageHandlers.createTestUser,
	};
};