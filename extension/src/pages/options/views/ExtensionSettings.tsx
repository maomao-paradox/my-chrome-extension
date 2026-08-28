import { useEffect, useRef, useState } from "react";
import { storage } from "@/stores";
import { DEFAULT_OPTIONS_PERFORMANCE_LEVEL, normalizeOptionsPerformanceLevel, syncOptionsPerformanceMirror, type OptionsPerformanceLevel } from "../composables/useOptionsPerformance";

type Settings = { debugMode: boolean; autoCheckUpdate: boolean; notificationTimeout: number; performanceMode: OptionsPerformanceLevel };
const defaults: Settings = { debugMode: false, autoCheckUpdate: true, notificationTimeout: 5, performanceMode: DEFAULT_OPTIONS_PERFORMANCE_LEVEL };

const ExtensionSettings = () => {
  const [settings, setSettings] = useState(defaults);
  const [themeColor, setThemeColor] = useState("#409EFF");
  const [language, setLanguage] = useState("zh_CN");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };

  useEffect(() => { void (async () => {
    const saved = await storage.ext.local.get("extensionSettings", {});
    setSettings({ ...defaults, ...(saved || {}), performanceMode: normalizeOptionsPerformanceLevel(saved?.performanceMode) });
    setThemeColor(await storage.ext.local.get("themeColor", "#409EFF"));
    setLanguage(await storage.ext.local.get("language", "zh_CN"));
  })(); }, []);

  const saveSettings = async (next: Settings = settings) => { const normalized = { ...next, performanceMode: normalizeOptionsPerformanceLevel(next.performanceMode) }; setSettings(normalized); syncOptionsPerformanceMirror(normalized.performanceMode); await storage.ext.local.set("extensionSettings", normalized); notify("基础设置已保存"); };
  const exportSettings = () => { const blob = new Blob([JSON.stringify({ extensionSettings: settings, themeColor, language }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "mria-extension-settings.json"; link.click(); URL.revokeObjectURL(url); notify("设置已导出"); };
  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; void file.text().then(async (text) => { try { const data = JSON.parse(text); const next = { ...defaults, ...(data.extensionSettings || {}) }; setSettings(next); setThemeColor(data.themeColor || "#409EFF"); setLanguage(data.language || "zh_CN"); await storage.ext.local.set("extensionSettings", next); await storage.ext.local.set("themeColor", data.themeColor || "#409EFF"); await storage.ext.local.set("language", data.language || "zh_CN"); notify("设置已导入"); } catch { notify("设置文件格式无效"); } }); event.target.value = ""; };

  return <section className="options-view options-settings"><header className="options-view__heading"><span>HULL CONFIG / DECK-04</span><h2>舰体设置矩阵</h2></header><div className="options-grid-2"><div className="options-panel"><h3>基础参数</h3><label>调试模式<input type="checkbox" checked={settings.debugMode} onChange={(e) => void saveSettings({ ...settings, debugMode: e.target.checked })} /></label><label>自动检查更新<input type="checkbox" checked={settings.autoCheckUpdate} onChange={(e) => void saveSettings({ ...settings, autoCheckUpdate: e.target.checked })} /></label><label>通知超时（秒）<input type="number" min={1} max={60} value={settings.notificationTimeout} onChange={(e) => setSettings({ ...settings, notificationTimeout: Number(e.target.value) })} onBlur={() => void saveSettings()} /></label><label>性能档位<select value={settings.performanceMode} onChange={(e) => void saveSettings({ ...settings, performanceMode: e.target.value as OptionsPerformanceLevel })}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label></div><div className="options-panel"><h3>界面协议</h3><label>主题颜色<input type="color" value={themeColor} onChange={(e) => { setThemeColor(e.target.value); void storage.ext.local.set("themeColor", e.target.value); notify("主题颜色已保存"); }} /></label><label>语言协议<select value={language} onChange={(e) => { setLanguage(e.target.value); void storage.ext.local.set("language", e.target.value); notify("语言设置已保存"); }}><option value="zh_CN">简体中文</option><option value="en">English</option></select></label></div></div><div className="options-actions"><button type="button" onClick={() => { setSettings(defaults); void saveSettings(defaults); }}>恢复默认</button><button type="button" onClick={exportSettings}>导出设置</button><button type="button" onClick={() => inputRef.current?.click()}>导入设置</button><input ref={inputRef} hidden type="file" accept=".json,application/json" onChange={importSettings} /></div><div className="options-view__notice">{notice}</div></section>;
};
export default ExtensionSettings;
