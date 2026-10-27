import { useCallback, useEffect, useState } from "react";
import { BugOutlined } from "@ant-design/icons";
import MASwitch from "@/components/switch/main";
import { storage } from "@/stores";
import "./debug-mode-setting.scss";

type ExtensionSettings = Record<string, unknown> & {
  debugMode?: boolean;
};

const EXTENSION_SETTINGS_KEY = "extensionSettings";

const normalizeSettings = (value: unknown): ExtensionSettings =>
  value && typeof value === "object"
    ? (value as ExtensionSettings)
    : {};

const DebugModeSetting = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState(false);

  const loadDebugMode = useCallback(async (): Promise<void> => {
    setLoadError(false);
    setStatus("正在读取设置");
    try {
      const settings = normalizeSettings(
        await storage.ext.local.get(EXTENSION_SETTINGS_KEY, {}),
      );
      setDebugMode(settings.debugMode === true);
      setIsLoaded(true);
      setStatus("");
    } catch (error) {
      maLogger.error("读取调试模式失败:", error);
      setLoadError(true);
      setStatus("读取失败，请重试");
    }
  }, []);

  useEffect(() => {
    void loadDebugMode();
  }, [loadDebugMode]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return;
    }

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ): void => {
      if (areaName !== "local" || !changes[EXTENSION_SETTINGS_KEY]) {
        return;
      }

      const settings = normalizeSettings(
        changes[EXTENSION_SETTINGS_KEY].newValue,
      );
      setDebugMode(settings.debugMode === true);
      setIsLoaded(true);
      setLoadError(false);
      setStatus("");
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleDebugModeChange = async (enabled: boolean): Promise<void> => {
    setIsSaving(true);
    setStatus("正在保存");
    try {
      const currentSettings = normalizeSettings(
        await storage.ext.local.get(EXTENSION_SETTINGS_KEY, {}),
      );
      await storage.ext.local.set(EXTENSION_SETTINGS_KEY, {
        ...currentSettings,
        debugMode: enabled,
      });
      setDebugMode(enabled);
      setStatus("已保存");
    } catch (error) {
      maLogger.error("保存调试模式失败:", error);
      setStatus("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="settings-panel settings-panel--debug">
      <div className="panel-heading">
        <span className="panel-icon">
          <BugOutlined />
        </span>
        <div className="panel-copy">
          <p className="card-kicker">Developer</p>
          <h3 className="card-title">调试日志</h3>
        </div>
        <span className="panel-status">
          {loadError ? "配置异常" : debugMode ? "已开启" : "已关闭"}
        </span>
      </div>

      <div className="debug-mode-row">
        <MASwitch
          label="调试模式"
          checked={debugMode}
          disabled={!isLoaded || isSaving}
          onChange={handleDebugModeChange}
        >
          <span className="debug-mode-description">
            开启后显示 log、info、debug 等日志；warn 和 error 始终输出。
          </span>
        </MASwitch>
        <div className="debug-mode-feedback" aria-live="polite">
          {loadError && (
            <button
              type="button"
              className="debug-mode-retry"
              onClick={() => void loadDebugMode()}
            >
              重新读取
            </button>
          )}
          <span>{status}</span>
        </div>
      </div>
    </section>
  );
};

export default DebugModeSetting;
