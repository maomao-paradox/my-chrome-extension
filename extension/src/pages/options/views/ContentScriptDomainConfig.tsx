import { useEffect, useMemo, useState } from "react";
import { contentDomains, domainConfigsKey } from "@/config";
import { storage } from "@/stores";

type DomainConfig = { enabled: boolean; domains: string };
type DomainConfigMap = Record<string, DomainConfig>;

const normalize = (value: unknown): DomainConfigMap =>
  Object.entries(value && typeof value === "object" ? value : {}).reduce(
    (result, [key, raw]) => {
      const config = typeof raw === "string" ? { enabled: true, domains: raw } : raw;
      result[key] = {
        enabled: config && typeof config === "object" && "enabled" in config ? config.enabled !== false : true,
        domains: config && typeof config === "object" && "domains" in config ? String(config.domains || "") : "",
      };
      return result;
    },
    {} as DomainConfigMap,
  );

const ContentScriptDomainConfig = () => {
  const [configs, setConfigs] = useState<DomainConfigMap>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      const stored = await storage.ext.local.get(domainConfigsKey, null);
      const next = normalize(stored);
      contentDomains.forEach((domain) => {
        next[domain] ||= { enabled: true, domains: "" };
      });
      setConfigs(next);
    })();
  }, []);

  const entries = useMemo(() => Object.entries(configs), [configs]);
  const save = async (next: DomainConfigMap, message: string) => {
    setConfigs(next);
    await storage.ext.local.set(domainConfigsKey, next);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <section className="options-view options-domain-config">
      <header className="options-view__heading"><span>DOMAIN MATRIX</span><h2>内容脚本域名配置</h2></header>
      {entries.map(([name, config]) => (
        <article className="options-config-row" key={name}>
          <div className="options-config-row__top"><strong>{name}</strong><label className="options-toggle"><input type="checkbox" checked={config.enabled} onChange={(event) => void save({ ...configs, [name]: { ...config, enabled: event.target.checked } }, `${name} 已${event.target.checked ? "启用" : "禁用"}`)} /><span>{config.enabled ? "启用" : "禁用"}</span></label></div>
          <div className="options-config-row__controls"><input value={config.domains} disabled={!config.enabled} placeholder="多个域名用逗号分隔，留空表示全部域名" onChange={(event) => setConfigs((current) => ({ ...current, [name]: { ...config, domains: event.target.value } }))} /><button type="button" disabled={!config.enabled} onClick={() => void save(configs, `${name} 域名配置已保存`)}>保存</button></div>
          <small>{config.domains || "当前未限制域名"}</small>
        </article>
      ))}
      <div className="options-view__notice">{notice || "配置后需要刷新页面才能生效。"}</div>
    </section>
  );
};

export default ContentScriptDomainConfig;
