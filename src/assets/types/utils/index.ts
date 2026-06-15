/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/utils/index.ts
 * @date 2026-02-05T02:38:01.698Z
 */

export interface ImageInfo {
  src: string
  alt: string
  loaded?: boolean
  isBase64: boolean
  name?: string
  element?: HTMLElement | Element
}

export interface StyleObject {
  [key: string]: string;
}

export interface AttributeObject {
  [key: string]: string | number | boolean;
}

export interface EventListenerObject {
  [key: string]: EventListenerOrEventListenerObject;
}

export interface ElemOpts {
  tag?: string | HTMLElement;
  attrs?: AttributeObject;
  style?: string | StyleObject;
  eventlistener?: EventListenerObject;
  children?: (HTMLElement | ElemOpts)[];
  [key: string]: any;
};

export interface CreateElemOpts extends ElemOpts {

};

export interface CloneElemOpts extends ElemOpts {
  deep: boolean,
  el: HTMLElement;
};

export interface AddElemOpts extends ElemOpts {
  autoRemoveDelay?: number;
};

/**
 * 过滤函数类型定义
 */
export type ElementFilter = (element: Element) => boolean;

/**
 * 优化后的等待元素选项接口
 */
export interface WaitForSelectorOptions {
  selector: string | string[];
  callback?: AddElementFunc | Function;
  callbackArgs?: any[];
  iframeSelector?: string;
  maxWaitTimes?: number;
  timeout?: number;
  interval?: number;
  filter?: ElementFilter | Function;
  once?: boolean; // 当设置为true时，找到第一个匹配元素后立即停止搜索
  useMutationObserver?: boolean;
  observerOptions?: MutationObserverInit;
  signal?: AbortSignal;
  initCallback?: AddElementFunc | Function;
}

// 定义XHR规则接口
export interface RuleInstruction {
  type: string;
  params?: {
    path?: string;
    value?: any;
    search?: string;
    [key: string]: any;
  };
}

export interface XhrRule {
  api?: string;
  openRules?: RuleInstruction[];
  sendRules?: RuleInstruction[];
  responseRules?: RuleInstruction[];
}

export interface XhrRulesMap {
  [key: string]: XhrRule;
}

export interface XhrRulesArray extends Array<XhrRule> {
  // [key: number]: CurXhrRule;
}

export type DEBUGER = {
  title: string;
  mode: boolean;
  [key: string]: any;
};

/*
     * 对XMLHttpRequest进行修改
     * 支持动态配置规则，通过content script注入和通信
     */
// 定义类型
export type XhrRequest = {
  method: string;
  url: string;
  async?: boolean;
  user?: string;
  password?: string;
};

export type XhrResponse = {
  status: number;
  statusText: string;
  responseText: string;
  responseXML?: Document | null;
  responseType: string;
  response: any;
};

// 定义配置对象接口以支持类型安全
export interface XHR_PATCH_CONFIG {
  rules: XhrRulesMap;
  isPatched: boolean; // 是否已应用补丁
  isEnabled: boolean; // 是否启用，逻辑开关
  originalXHR: typeof XMLHttpRequest;
  updateRules: (newRules: XhrRulesMap) => void;
  clearRules: () => void;
  applyPatch: () => void;
  resetPatch: () => void;
  getStatus: () => Record<string, boolean>;
  toggleEnabled: (enable: boolean) => void;
  getCurrentRules: () => XhrRulesMap;
  loadRulesFromStorage?: () => void;
  saveRulesToStorage?: () => void;
  init: () => void;
}

export interface AppModule {
  shadowHostId: string;
  isInjected: boolean;
  vueContainer: HTMLElement | null;
  shadowRoot: ShadowRoot | null;
  appInstance: any | null;
  isEnabled: boolean;
  init(options?: any): Promise<void>;
  enable(): void;
  disable(): void;
}

export type AddElementFunc = (byElement?: HTMLElement, position?: string) => void

// 定位相关类型定义
export type PositionStrategy = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type Alignment = 'start' | 'center' | 'end';
export type PositionContext = 'viewport' | 'document' | 'parent';

export interface Offset {
  x: number;
  y: number;
}

export interface PositionOptions {
  targetElement: HTMLElement;
  strategy?: PositionStrategy;
  alignment?: Alignment;
  offset?: Offset;
  context?: PositionContext;
  avoidCollision?: boolean;
  collisionPadding?: number;
  observeReference?: boolean;
}

export interface PositionResult {
  element: HTMLElement;
  position: { x: number; y: number };
  adjusted: boolean;
  strategy: PositionStrategy;
  alignment: Alignment;
  cleanup?: () => void;
}

export interface ViewportInfo {
  width: number;
  height: number;
}

export interface ElementPositionInfo {
  // 视口相对位置
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;

  // 文档绝对位置
  absoluteTop: number;
  absoluteLeft: number;

  // 元素属性
  id: string;
  className: string;
  tagName: string;

  // 视口信息
  viewport: ViewportInfo;

  // 方法
  insertToShadow(options: {
    shadowRoot?: ShadowRoot;
    shadowHostId?: string;
    content?: string | HTMLElement;
    style?: Record<string, string>;
    attrs?: Record<string, string>;
  }): HTMLElement;

  cloneToShadow(options: {
    shadowRoot?: ShadowRoot;
    shadowHostId?: string;
    preserveStyles?: boolean;
    preserveEvents?: boolean;
  }): HTMLElement;

  positionElement(options: PositionOptions): PositionResult;
} 
