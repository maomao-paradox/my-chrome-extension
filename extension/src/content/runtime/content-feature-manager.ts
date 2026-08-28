import { createContentFeaturePanel } from "@components/content-feature-panel";
import messenger from "@/message";

export const CONTENT_FEATURE_CONFIG_PREFIX = "kria-nove:content-script-config:";
export const CONTENT_FEATURE_SHORTCUT = "Ctrl+Shift+K";

export type ContentFeatureCleanup = void | (() => void | Promise<void>);
/**
 * 功能块的 setup 可以返回清理函数。清理逻辑由业务代码决定，例如：
 * - removeEventListener / disconnect observer
 * - 删除注入的 DOM
 * - 执行与注入脚本相反的脚本
 */
export type ContentFeatureSetup = () =>
  | ContentFeatureCleanup
  | Promise<ContentFeatureCleanup>;

export interface ContentFeatureDefinition {
  id: string;
  label: string;
  setup: ContentFeatureSetup;
}

export interface ContentFeatureRegistryOptions {
  scriptId: string;
  scriptName: string;
}

export interface ContentFeatureRegistry {
  register: (id: string, label: string, setup: ContentFeatureSetup) => void;
  initialize: () => Promise<void>;
  openPanel: () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const readConfig = (key: string): Record<string, boolean> | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return Object.fromEntries(
      Object.entries(parsed).map(([id, enabled]) => [id, enabled === true]),
    );
  } catch (error) {
    maLogger.warn("读取内容脚本功能配置失败:", error);
    return null;
  }
};

const writeConfig = (key: string, config: Record<string, boolean>): void => {
  window.localStorage.setItem(key, JSON.stringify(config));
};

export const createContentFeatureRegistry = (
  options: ContentFeatureRegistryOptions,
): ContentFeatureRegistry => {
  const configKey = `${CONTENT_FEATURE_CONFIG_PREFIX}${options.scriptId}`;
  const features = new Map<string, ContentFeatureDefinition>();
  const cleanups = new Map<string, () => void | Promise<void>>();
  let currentConfig: Record<string, boolean> = {};
  let initialized = false;

  const register = (
    id: string,
    label: string,
    setup: ContentFeatureSetup,
  ): void => {
    if (!id || features.has(id)) {
      throw new Error(`[ContentFeature] 重复或无效的功能 ID: ${id}`);
    }
    features.set(id, { id, label, setup });
  };

  const runFeature = async (
    feature: ContentFeatureDefinition,
  ): Promise<void> => {
    try {
      const cleanup = await feature.setup();
      if (typeof cleanup === "function") {
        cleanups.set(feature.id, cleanup);
      }
    } catch (error) {
      maLogger.error(`[ContentFeature] 启动功能失败: ${feature.id}`, error);
    }
  };

  const cleanupFeatures = async (): Promise<void> => {
    for (const [id, cleanup] of cleanups) {
      try {
        await cleanup();
      } catch (error) {
        maLogger.error(`[ContentFeature] 清理功能失败: ${id}`, error);
      }
    }
    cleanups.clear();
  };

  const openPanel = (): void => {
    createContentFeaturePanel({
      scriptName: options.scriptName,
      shortcut: CONTENT_FEATURE_SHORTCUT,
      isFirstUse: !window.localStorage.getItem(configKey),
      features: Array.from(features.values()).map(({ id, label }) => ({
        id,
        label,
      })),
      config: currentConfig,
      onSave: (nextConfig) => {
        void (async () => {
          await cleanupFeatures();
          currentConfig = nextConfig;
          writeConfig(configKey, nextConfig);
        })();
      },
    });
  };

  const handleShortcut = (event: KeyboardEvent): void => {
    if (
      event.key.toLowerCase() !== "k" ||
      !event.shiftKey ||
      !(event.ctrlKey || event.metaKey)
    ) {
      return;
    }
    event.preventDefault();
    openPanel();
  };
  window.addEventListener("keydown", handleShortcut, true);

  messenger.ext.listen((message) => {
    if (
      message.target === "content" &&
      message.type === "OPEN_CONTENT_FEATURE_PANEL"
    ) {
      openPanel();
    }
  });

  const initialize = async (): Promise<void> => {
    if (initialized) return;
    initialized = true;
    const storedConfig = readConfig(configKey);
    const firstUse = storedConfig === null;
    currentConfig =
      storedConfig ||
      Object.fromEntries(Array.from(features.keys()).map((id) => [id, false]));

    if (!firstUse) {
      for (const feature of features.values()) {
        if (currentConfig[feature.id] === true) {
          await runFeature(feature);
        }
      }
      return;
    }

    openPanel();
  };

  return { register, initialize, openPanel };
};
