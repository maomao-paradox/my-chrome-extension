/**
 * 轻量级 sessionStorage 封装
 * 支持对象自动序列化/反序列化
 * 所有操作均为同步，适合高频读写
 */

export const session = {
  /** 写入任何可序列化值 */
  set<T>(key: string, value: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      maLogger.warn('sessionStorage write error:', e);
    }
  },

  /** 读取并反序列化，默认值可选 */
  get<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? defaultValue : (JSON.parse(raw) as T);
    } catch (e) {
      maLogger.warn('sessionStorage read error:', e);
      return defaultValue;
    }
  },

  /** 删除单个 key */
  remove(key: string): void {
    sessionStorage.removeItem(key);
  },

  /** 清空所有 sessionStorage */
  clear(): void {
    sessionStorage.clear();
  },

  /** 判断 key 是否存在 */
  has(key: string): boolean {
    return sessionStorage.getItem(key) !== null;
  },
};