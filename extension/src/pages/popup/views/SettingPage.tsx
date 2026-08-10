/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/views/SettingPage.tsx
 * @description React 版设置页面 - 主题、站点脚本与功能入口集中配置
 */
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import MaSwitch from "@/assets/components/MaSwitch";
import {
  SettingOutlined,
  FileTextOutlined,
  ToolOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import TableContainer from "../components/TableContainer";
import { storage } from "@/stores";
import { sendMessageToContentScript } from "@/message/back-content";
import { appConfigKey, domainConfigsKey } from "@/config";
import { useDomainState, extractDomain } from "../composables/useDomainState";
import {
  popupThemes,
  usePopupTheme,
  type PopupThemeKey,
} from "../composables/usePopupTheme";
import { usePopupMouseTrail } from "../composables/usePopupMouseTrail";
import { mouseTrailPresetOptions } from "@/assets/composables/mouse/mouseTrailPreference";
import {
  useDomainManager,
  type DomainConfigItem,
} from "../composables/useDomainManager";
import { usePluginManager } from "../composables/usePluginManager";
import JungleKnotButton from "@/assets/components/Jungle-knot/Button";
import "./setting-page.scss";
import { ConfigItem } from "@/types";

/**
 * 保存状态类型
 */
type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * 消息类型映射
 */
const MESSAGE_TYPE = {
  "0": "CONFIG_INIT",
  "1": "CONFIG_UPDATE",
  "2": "CONFIG_DELETE",
} as const;

/**
 * 设置页面组件
 */
export const SettingPage: React.FC = () => {
  const { activeTheme, setPopupTheme, loadPopupTheme } = usePopupTheme();
  const {
    isMouseTrailEnabled,
    mouseTrailPreset,
    loadPopupMouseTrail,
    setPopupMouseTrail,
    setPopupMouseTrailPreset,
  } = usePopupMouseTrail();
  const { domainConfigs, loadDomainConfigs } = useDomainManager();
  const { pluginConfigs, setPluginConfigs, loadPluginConfigs, isLoaded } =
    usePluginManager();

  const [selectedContentScript, setSelectedContentScript] =
    useState<string>("");
  const [currentActivedTabDomain, setCurrentActivedTabDomain] =
    useState<string>("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // 深拷贝 pluginConfigs 以便修改
  const [localPluginConfigs, setLocalPluginConfigs] = useState<
    Record<string, ConfigItem>
  >(() => JSON.parse(JSON.stringify(pluginConfigs)));

  // 首次加载存储配置后，将真实状态同步到本地副本（仅执行一次）
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (isLoaded && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      setLocalPluginConfigs(JSON.parse(JSON.stringify(pluginConfigs)));
    }
  }, [isLoaded, pluginConfigs]);

  // 保存状态重置定时器
  const saveResetTimerRef = React.useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  /** 可用的内容脚本列表 */
  const availableContentScripts = useMemo<string[]>(() => {
    return Object.entries(domainConfigs)
      .filter(([key, config]) => {
        if (key === "Eve") return false;
        if (typeof config === "object" && config !== null) {
          return (config as DomainConfigItem).enabled;
        }
        return true;
      })
      .map(([key]) => key);
  }, [domainConfigs]);

  /** 插件配置条目列表 */
  const pluginConfigEntries = useMemo(() => {
    return Object.entries(localPluginConfigs);
  }, [localPluginConfigs]);

  /** 已启用的插件数量 */
  const enabledPluginCount = useMemo(() => {
    return pluginConfigEntries.filter(([, app]) => Boolean(app.enabled)).length;
  }, [pluginConfigEntries]);

  /** 已配置路由的插件数量 */
  const routedPluginCount = useMemo(() => {
    return pluginConfigEntries.filter(([, value]) => value.type !== undefined)
      .length;
  }, [pluginConfigEntries]);

  /** 当前主题标签 */
  const currentThemeLabel = useMemo(() => {
    return (
      popupThemes.find((theme) => theme.key === activeTheme)?.label ??
      popupThemes[0].label
    );
  }, [activeTheme]);

  /** 选中脚本标签 */
  const selectedScriptLabel = useMemo(() => {
    if (!currentActivedTabDomain) return "当前站点未识别";
    return selectedContentScript || "当前站点未绑定脚本";
  }, [currentActivedTabDomain, selectedContentScript]);

  /** 是否正在保存 */
  const isSaving = saveState === "saving";

  /** 保存按钮标题 */
  const saveButtonTitle = useMemo(() => {
    switch (saveState) {
      case "saving":
        return "保存中";
      case "saved":
        return "已保存";
      case "error":
        return "保存失败";
      default:
        return "保存配置";
    }
  }, [saveState]);

  /** 保存按钮提示 */
  const saveButtonHint = useMemo(() => {
    switch (saveState) {
      case "saving":
        return "正在写入本地并同步页面";
      case "saved":
        return "配置已同步到当前页面";
      case "error":
        return "请稍后重试或检查当前页面状态";
      default:
        return "写入本地并同步到当前页面";
    }
  }, [saveState]);

  /** 解析域名列表字符串 */
  const parseDomains = useCallback((domainsString: string): string[] => {
    if (!domainsString) return [];
    return Array.from(
      new Set(
        domainsString
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }, []);

  /** 获取域名配置字符串 */
  const getDomainsString = useCallback(
    (scriptKey: string): string => {
      const config = domainConfigs[scriptKey];
      if (typeof config === "object" && config !== null) {
        return (config as DomainConfigItem).domains || "";
      }
      return typeof config === "string" ? config : "";
    },
    [domainConfigs],
  );

  /** 确保域名配置为对象格式 */
  const ensureDomainConfigObject = useCallback(
    (scriptKey: string): DomainConfigItem => {
      const currentConfig = domainConfigs[scriptKey];
      if (typeof currentConfig === "object" && currentConfig !== null) {
        return currentConfig as DomainConfigItem;
      }

      const normalizedConfig: DomainConfigItem = {
        enabled: true,
        domains: typeof currentConfig === "string" ? currentConfig : "",
      };
      // 注意：此处不应直接修改 domainConfigs，需要通过 setter
      return normalizedConfig;
    },
    [domainConfigs],
  );

  /** 同步当前域名选择 */
  const syncCurrentDomainSelection = useCallback(
    (scriptKey: string): void => {
      if (!currentActivedTabDomain) return;

      const newDomainConfigs = { ...domainConfigs };
      for (const [key] of Object.entries(domainConfigs)) {
        if (key === "Eve") continue;

        const config = ensureDomainConfigObject(key);
        const filteredDomains = parseDomains(config.domains).filter(
          (item) => item !== currentActivedTabDomain,
        );

        if (scriptKey && key === scriptKey) {
          filteredDomains.push(currentActivedTabDomain);
        }

        config.domains = Array.from(new Set(filteredDomains)).join(",");
        newDomainConfigs[key] = config;
      }
      // 这里需要调用 setDomainConfigs，但目前没有这个 setter
      // 实际使用时需要根据项目结构调整
    },
    [
      currentActivedTabDomain,
      domainConfigs,
      parseDomains,
      ensureDomainConfigObject,
    ],
  );

  /** 解析选中脚本 */
  const resolveSelectedScript = useCallback((): string => {
    if (!currentActivedTabDomain) return "";

    for (const scriptKey of availableContentScripts) {
      if (
        parseDomains(getDomainsString(scriptKey)).includes(
          currentActivedTabDomain,
        )
      ) {
        return scriptKey;
      }
    }
    return "";
  }, [
    currentActivedTabDomain,
    availableContentScripts,
    parseDomains,
    getDomainsString,
  ]);

  /** 处理脚本变更 */
  const handleScriptChange = useCallback(() => {
    syncCurrentDomainSelection(selectedContentScript);
  }, [selectedContentScript, syncCurrentDomainSelection]);

  /** 选择主题 */
  const selectTheme = useCallback(
    async (themeKey: PopupThemeKey): Promise<void> => {
      if (themeKey === activeTheme) return;
      await setPopupTheme(themeKey);
    },
    [activeTheme, setPopupTheme],
  );

  /** 处理鼠标拖尾变更 */
  const handleMouseTrailChange = useCallback(
    async (enabled: boolean): Promise<void> => {
      await setPopupMouseTrail(enabled);
    },
    [setPopupMouseTrail],
  );

  /** 处理鼠标拖尾预设变更 */
  const handleMouseTrailPresetChange = useCallback(
    async (preset: any): Promise<void> => {
      await setPopupMouseTrailPreset(preset);
    },
    [setPopupMouseTrailPreset],
  );

  /** 加载配置 */
  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      await loadPluginConfigs();
      await loadDomainConfigs();
    } catch (error) {
      maLogger.error("加载配置失败:", error);
    }
  }, [loadPluginConfigs, loadDomainConfigs]);

  /** 获取当前活动标签页 */
  const getActivedTab =
    useCallback(async (): Promise<chrome.tabs.Tab | null> => {
      if (!chrome.tabs) return null;
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0];
    }, []);

  /** 获取当前活动标签页域名 */
  const getActivedTabDomain = useCallback(async (): Promise<string> => {
    const tab = await getActivedTab();
    return extractDomain(tab?.url || "");
  }, [getActivedTab]);

  /** 安排保存状态重置 */
  const scheduleSaveStateReset = useCallback((): void => {
    if (saveResetTimerRef.current) {
      clearTimeout(saveResetTimerRef.current);
    }

    saveResetTimerRef.current = setTimeout(() => {
      setSaveState("idle");
      saveResetTimerRef.current = undefined;
    }, 1800);
  }, []);

  /** 保存配置 */
  const saveConfig = useCallback(async (): Promise<void> => {
    if (isSaving) return;

    setSaveState("saving");

    try {
      if (chrome.storage?.local) {
        await storage.ext.local.set(appConfigKey, localPluginConfigs);
        await storage.ext.local.set(domainConfigsKey, domainConfigs);
      }

      const res = await sendMessageToContentScript({
        type: MESSAGE_TYPE["1"],
        payload: localPluginConfigs,
      });
      maLogger.log(res);
      if (res?.success) {
        setSaveState("saved");
      } else {
        setSaveState("error");
      }
    } catch (error) {
      maLogger.error("保存配置失败:", error);
      setSaveState("error");
    } finally {
      scheduleSaveStateReset();
    }
  }, [isSaving, localPluginConfigs, domainConfigs, scheduleSaveStateReset]);

  /** 更新插件启用状态 */
  const handlePluginToggle = useCallback((key: string, enabled: boolean) => {
    setLocalPluginConfigs((prev: any) => ({
      ...prev,
      [key]: { ...prev[key], enabled },
    }));
  }, []);

  /** 初始化加载 */
  useEffect(() => {
    loadConfig();
    getActivedTabDomain().then((domain) => {
      setCurrentActivedTabDomain(domain);
      setSelectedContentScript(resolveSelectedScript());
    });
  }, []);

  /** 加载主题和鼠标拖尾 */
  useEffect(() => {
    loadPopupTheme();
    loadPopupMouseTrail();
  }, [loadPopupTheme, loadPopupMouseTrail]);

  /** 清理定时器 */
  useEffect(() => {
    return () => {
      if (saveResetTimerRef.current) {
        clearTimeout(saveResetTimerRef.current);
      }
    };
  }, []);

  return (
    <TableContainer
      headLeft={
        <>
          <p className="section-kicker">Control Center</p>
          <h2 className="section-title">配置设置</h2>
          <p className="section-subtitle">主题、站点脚本与功能入口集中配置。</p>
        </>
      }
      headRight={
        <div className="settings-summary">
          <div className="summary-chip">
            <span>配置项</span>
            <strong>{pluginConfigEntries.length}</strong>
          </div>
          <div className="summary-chip summary-chip--accent">
            <span>已启用</span>
            <strong>{enabledPluginCount}</strong>
          </div>
        </div>
      }
    >
      <div className="settings-dashboard">
        {/* 主题设置面板 */}
        <section className="settings-panel settings-panel--theme">
          <div className="panel-heading">
            <span className="panel-icon">
              <SettingOutlined />
            </span>
            <div className="panel-copy">
              <p className="card-kicker">Appearance</p>
              <h3 className="card-title">主题设置</h3>
            </div>
            <span className="panel-status">{currentThemeLabel}</span>
          </div>

          <div className="theme-grid">
            {popupThemes.map((theme) => (
              <li
                key={theme.key}
                className={`theme-option theme-option--${theme.key} ${
                  activeTheme === theme.key ? "theme-option--active" : ""
                }`}
                aria-pressed={activeTheme === theme.key}
              >
                <JungleKnotButton
                  label="THEME"
                  onClick={() => selectTheme(theme.key)}
                  primaryColor={theme.primaryColor}
                  secondaryColor={theme.secondaryColor}
                >
                  <span className="theme-copy">
                    <strong>{theme.label}</strong>
                    <span>{theme.description}</span>
                  </span>
                </JungleKnotButton>
              </li>
            ))}
          </div>

          <div className="switch-row switch-row--appearance">
            <MaSwitch
              label="鼠标拖尾"
              checked={isMouseTrailEnabled}
              onChange={(checked) => handleMouseTrailChange(checked)}
            >
              <select
                id="mouse-trail-preset-select"
                value={mouseTrailPreset}
                className="dropdown-select mouse-trail-preset-select"
                disabled={!isMouseTrailEnabled}
                aria-label="鼠标拖尾样式"
                onChange={(e) => handleMouseTrailPresetChange(e.target.value)}
              >
                {mouseTrailPresetOptions.map((option: any) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </MaSwitch>
          </div>
        </section>

        {/* 内容脚本面板 */}
        <section className="settings-panel settings-panel--site">
          <div className="panel-heading">
            <span className="panel-icon">
              <FileTextOutlined />
            </span>
            <div className="panel-copy">
              <p className="card-kicker">Current Site</p>
              <h3 className="card-title">内容脚本</h3>
            </div>
            <span className="panel-status">
              {availableContentScripts.length} 个
            </span>
          </div>

          <div className="site-controls">
            <div className="domain-row">
              <span className="field-label">当前域名</span>
              <strong className="domain-value">
                {currentActivedTabDomain || "未识别"}
              </strong>
            </div>

            <label className="script-field">
              <span className="field-label">绑定脚本</span>
              <span className="select-shell">
                <select
                  value={selectedContentScript}
                  className="content-script-select"
                  disabled={
                    availableContentScripts.length === 0 ||
                    !currentActivedTabDomain
                  }
                  onChange={(e) => {
                    setSelectedContentScript(e.target.value);
                    handleScriptChange();
                  }}
                >
                  <option value="">不启用内容脚本</option>
                  {availableContentScripts.map((script) => (
                    <option key={script} value={script}>
                      {script}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <div
              className={`selection-summary ${
                !selectedContentScript ? "selection-summary--empty" : ""
              }`}
            >
              <span className="selection-dot"></span>
              <span>{selectedScriptLabel}</span>
            </div>

            {availableContentScripts.length === 0 && (
              <p className="selector-hint">暂无可用内容脚本</p>
            )}
          </div>
        </section>

        {/* 功能设置面板 */}
        <section className="settings-panel settings-panel--features">
          <div className="panel-heading">
            <span className="panel-icon">
              <ToolOutlined />
            </span>
            <div className="panel-copy">
              <p className="card-kicker">Feature Routing</p>
              <h3 className="card-title">功能设置</h3>
            </div>
            <span className="panel-status">{routedPluginCount} 个入口</span>
          </div>

          {pluginConfigEntries.length > 0 ? (
            <div className="switch-list">
              {pluginConfigEntries.map(([key, app]) => (
                <div key={key} className="switch-row">
                  <MaSwitch
                    label={(app as any).name}
                    checked={Boolean((app as any).enabled)}
                    onChange={(checked) => handlePluginToggle(key, checked)}
                  >
                    {(app as any).type === "toolbar" &&
                      (app as any).options && (
                        <div className="color-picker-wrapper">
                          <input
                            type="color"
                            className="color-picker"
                            value={(app as any).options.brandColor}
                            aria-label="选择品牌颜色"
                            onChange={(e) => {
                              setLocalPluginConfigs((prev: any) => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  options: {
                                    ...prev[key].options,
                                    brandColor: e.target.value,
                                  },
                                },
                              }));
                            }}
                          />
                          <span>{(app as any).options.brandColor}</span>
                        </div>
                      )}
                  </MaSwitch>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <SettingOutlined />
              </div>
              <p className="empty-title">暂无配置项</p>
            </div>
          )}
        </section>
      </div>

      {/* 保存按钮 */}
      <div className={`save-dock save-dock--${saveState}`} aria-live="polite">
        <button
          className="primary-btn"
          disabled={isSaving}
          onClick={saveConfig}
        >
          <span className="primary-btn__icon">
            <CheckCircleOutlined />
          </span>
          <span className="primary-btn__copy">
            <strong>{saveButtonTitle}</strong>
            <small>{saveButtonHint}</small>
          </span>
        </button>
      </div>
    </TableContainer>
  );
};

export default SettingPage;
