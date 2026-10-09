import { createContentFeaturePanel } from "@/components/content-feature-panel/main";
import { useRouteWatcher } from "@/document-api/route-watcher";
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
  restartOnRouteChange?: boolean;
}

export interface ContentFeatureRegistrationOptions {
  restartOnRouteChange?: boolean;
}

export interface ContentFeatureRegistryOptions {
  scriptId: string;
  scriptName: string;
}

export interface ContentFeatureRegistry {
  register: (
    id: string,
    label: string,
    setup: ContentFeatureSetup,
    options?: ContentFeatureRegistrationOptions,
  ) => void;
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
  const generations = new Map<string, number>();
  let currentConfig: Record<string, boolean> = {};
  let initialized = false;
  let featuresSuspended = false;
  let unsubscribeRouteWatcher: (() => void) | null = null;

  const stopWatchingRoutes = (): void => {
    unsubscribeRouteWatcher?.();
    unsubscribeRouteWatcher = null;
  };

  const nextGeneration = (id: string): number => {
    const generation = (generations.get(id) || 0) + 1;
    generations.set(id, generation);
    return generation;
  };

  const cleanupFeature = async (id: string): Promise<void> => {
    const cleanup = cleanups.get(id);
    cleanups.delete(id);
    if (!cleanup) return;
    try {
      await cleanup();
    } catch (error) {
      maLogger.error(`[ContentFeature] 清理功能失败: ${id}`, error);
    }
  };

  const installFeature = async (
    feature: ContentFeatureDefinition,
    generation: number,
  ): Promise<void> => {
    try {
      const cleanup = await feature.setup();
      if (
        generations.get(feature.id) !== generation ||
        currentConfig[feature.id] !== true
      ) {
        if (typeof cleanup === "function") {
          await cleanup();
        }
        return;
      }
      if (typeof cleanup === "function") {
        cleanups.set(feature.id, cleanup);
      }
    } catch (error) {
      maLogger.error(`[ContentFeature] 启动功能失败: ${feature.id}`, error);
    }
  };

  // 注册功能块，应该在最顶层调用，确保所有功能块都已注册，不要放在异步或者setTimeout中
  const register = (
    id: string,
    label: string,
    setup: ContentFeatureSetup,
    registrationOptions: ContentFeatureRegistrationOptions = {},
  ): void => {
    if (!id || features.has(id)) {
      throw new Error(`[ContentFeature] 重复或无效的功能 ID: ${id}`);
    }
    features.set(id, {
      id,
      label,
      setup,
      restartOnRouteChange: registrationOptions.restartOnRouteChange === true,
    });
  };

  const runFeature = async (
    feature: ContentFeatureDefinition,
  ): Promise<void> => {
    await installFeature(feature, nextGeneration(feature.id));
  };

  const restartFeature = async (
    feature: ContentFeatureDefinition,
  ): Promise<void> => {
    const generation = nextGeneration(feature.id);
    await cleanupFeature(feature.id);
    if (
      generations.get(feature.id) !== generation ||
      currentConfig[feature.id] !== true
    ) {
      return;
    }
    await installFeature(feature, generation);
  };

  const cleanupFeatures = async (): Promise<void> => {
    for (const id of features.keys()) {
      nextGeneration(id);
    }
    for (const id of Array.from(cleanups.keys())) {
      await cleanupFeature(id);
    }
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
          featuresSuspended = true;
          stopWatchingRoutes();
          await cleanupFeatures();
          currentConfig = nextConfig;
          writeConfig(configKey, nextConfig);
          featuresSuspended = false;
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

    if (
      Array.from(features.values()).some(
        (feature) =>
          feature.restartOnRouteChange && currentConfig[feature.id] === true,
      )
    ) {
      unsubscribeRouteWatcher = useRouteWatcher(() => {
        if (featuresSuspended) return;
        for (const feature of features.values()) {
          if (
            feature.restartOnRouteChange &&
            currentConfig[feature.id] === true
          ) {
            void restartFeature(feature);
          }
        }
      });
    }

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
