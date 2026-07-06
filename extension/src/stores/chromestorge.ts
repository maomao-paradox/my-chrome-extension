/**
 * 跨环境的极简 KV 存储封装
 * 1. Chrome 插件 → chrome.storage
 * 2. 普通浏览器 → localStorage
 */
const isExtension = typeof chrome !== 'undefined' && chrome.storage;

export declare interface PageStorage {
  /* 有 */
  has(key: string): boolean;
  /* 读取 */
  get(key: string, defaultValue?: any): any;

  /* 写入 */
  set(key: string, value: any): void;

  /* 删除 */
  remove(key: string): void;

  /* 清空（慎用） */
  clear(): void;
}

export declare interface ExtStorage {
  /* 有 */
  has(key: string): Promise<boolean>;
  /* 读取 */
  get(key: string, defaultValue?: any): Promise<any>;

  /* 写入 */
  set(key: string, value: any): Promise<void>;

  /* 删除 */
  remove(key: string): Promise<void>;

  /* 清空（慎用） */
  clear(): Promise<void>;
}

const extLocal: ExtStorage = {
  /* 有 */
  async has(key: string) {
    if (!isExtension) throw new Error('Not in extension environment');
    const result = await chrome.storage.local.get(key);
    return result.hasOwnProperty(key);
  },
  /* 读取 */
  async get(key: string, defaultValue?: any) {
    if (!isExtension) throw new Error('Not in extension environment');
    defaultValue = defaultValue === undefined ? {} : defaultValue;
    const result = await chrome.storage.local.get(key);
    return result[key] ?? defaultValue;
  },

  /* 写入 */
  async set(key, value) {
    if (!isExtension) throw new Error('Not in extension environment');
    return chrome.storage.local.set({ [key]: value });
  },

  /* 删除 */
  async remove(key: string) {
    if (!isExtension) throw new Error('Not in extension environment');
    return chrome.storage.local.remove(key);
  },

  /* 清空（慎用） */
  async clear() {
    if (!isExtension) throw new Error('Not in extension environment');
    return chrome.storage.local.clear();
  },
};

const pageLocal: PageStorage = {
  /* 有 */
  has(key: string) {
    return localStorage.hasOwnProperty(key);
  },
  /* 读取 */
  get(key: string, defaultValue?: any) {
    try {
      return JSON.parse(localStorage.getItem(key) as string) ?? defaultValue ?? null;
    } catch {
      return localStorage.getItem(key) ?? null;
    }
  },

  /* 写入 */
  set(key, value) {
    if (typeof value === 'object') value = JSON.stringify(value)
    localStorage.setItem(key, value);
  },

  /* 删除 */
  remove(key: string) {
    localStorage.removeItem(key);
  },

  /* 清空（慎用） */
  clear() {
    localStorage.clear();
  },
};

const pageSession: PageStorage = {
  /* 有 */
  has(key: string) {
    return sessionStorage.hasOwnProperty(key);
  },
  /* 读取 */
  get(key: string, defaultValue?: any) {
    defaultValue = defaultValue === undefined ? {} : defaultValue;
    try {
      return JSON.parse(sessionStorage.getItem(key) as string) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  },

  /* 写入 */
  set(key: string, value: string) {
    if (typeof value === 'object') value = JSON.stringify(value)
    sessionStorage.setItem(key, value);
  },

  /* 删除 */
  remove(key: string) {
    sessionStorage.removeItem(key);
  },

  /* 清空（慎用） */
  clear() {
    sessionStorage.clear();
  },
}

const extSession: ExtStorage = {
  /* 有 */
  async has(key: string) {
    if (!isExtension) throw new Error('Not in extension environment');
    const result = await chrome.storage.session.get(key);
    return result.hasOwnProperty(key);
  },
  /* 读取 */
  async get(key: string, defaultValue?: any) {
    if (!isExtension) throw new Error('Not in extension environment');
    defaultValue = defaultValue === undefined ? {} : defaultValue;
    const result = await chrome.storage.session.get(key);
    return result[key] ?? defaultValue;
  },
  /* 写入 */
  async set(key: string, value: string) {
    if (!isExtension) throw new Error('Not in extension environment');
    return chrome.storage.session.set({ [key]: value });
  },
  /* 删除 */
  async remove(key: string) {
    if (!isExtension) throw new Error('Not in extension environment');
    return chrome.storage.session.remove(key);
  },
  /* 清空（慎用） */
  async clear() {
    if (!isExtension) throw new Error('Not in extension environment');
    return chrome.storage.session.clear();
  },
}

export declare type Page = {
  local: PageStorage;
  session: PageStorage;
}

export declare type Ext = {
  local: ExtStorage;
  session: ExtStorage;
}

const page: Page = {
  local: pageLocal,
  session: pageSession,
}

const ext: Ext = {
  local: extLocal,
  session: extSession,
}

export default {
  ext,
  page,
};
