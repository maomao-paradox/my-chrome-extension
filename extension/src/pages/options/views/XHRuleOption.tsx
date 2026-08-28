import { useEffect, useState } from "react";

type Rule = { id: number; urlPattern: string; responseData: string; responseType: string; enabled: boolean };
const RULES_KEY = "mria_xhr_rules";
const WHITELIST_KEY = "mria_xhr_whitelist";
const XHRuleOption = () => {
  const [tab, setTab] = useState<"rules" | "whitelist">("rules");
  const [rules, setRules] = useState<Rule[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [domain, setDomain] = useState("");
  useEffect(() => { try { const stored = JSON.parse(localStorage.getItem(RULES_KEY) || "[]"); setRules(Array.isArray(stored) ? stored : []); } catch { setRules([]); } try { const stored = JSON.parse(localStorage.getItem(WHITELIST_KEY) || "[]"); setWhitelist(Array.isArray(stored) ? stored : []); } catch { setWhitelist([]); } }, []);
  const saveRules = (next: Rule[]) => { setRules(next); localStorage.setItem(RULES_KEY, JSON.stringify(next)); };
  const addRule = () => saveRules([...rules, { id: Date.now(), urlPattern: "https://example.com/api/*", responseData: "{}", responseType: "json", enabled: true }]);
  const addDomain = () => { const value = domain.trim(); if (!value || whitelist.includes(value)) return; const next = [...whitelist, value]; setWhitelist(next); localStorage.setItem(WHITELIST_KEY, JSON.stringify(next)); setDomain(""); };
  return <section className="options-view"><header className="options-view__heading"><span>INTERCEPTOR BAY / DECK-02</span><h2>XHR 响应修改器</h2></header><div className="options-tabs"><button className={tab === "rules" ? "is-active" : ""} onClick={() => setTab("rules")}>规则管理</button><button className={tab === "whitelist" ? "is-active" : ""} onClick={() => setTab("whitelist")}>域名白名单</button></div>{tab === "rules" ? <div className="options-panel"><div className="options-panel__toolbar"><h3>当前规则（{rules.length}）</h3><button type="button" onClick={addRule}>添加规则</button></div>{rules.length === 0 ? <p className="options-empty">暂无规则配置</p> : rules.map((rule) => <article className="options-rule" key={rule.id}><input value={rule.urlPattern} onChange={(e) => saveRules(rules.map((item) => item.id === rule.id ? { ...item, urlPattern: e.target.value } : item))} /><textarea value={rule.responseData} onChange={(e) => saveRules(rules.map((item) => item.id === rule.id ? { ...item, responseData: e.target.value } : item))} /><label><input type="checkbox" checked={rule.enabled} onChange={(e) => saveRules(rules.map((item) => item.id === rule.id ? { ...item, enabled: e.target.checked } : item))} />启用</label><button type="button" onClick={() => saveRules(rules.filter((item) => item.id !== rule.id))}>删除</button></article>)}</div> : <div className="options-panel"><h3>域名白名单</h3><div className="options-inline"><input value={domain} placeholder="example.com 或 *.example.com" onChange={(e) => setDomain(e.target.value)} /><button type="button" onClick={addDomain}>添加</button></div>{whitelist.map((item) => <div className="options-list-item" key={item}><code>{item}</code><button type="button" onClick={() => { const next = whitelist.filter((value) => value !== item); setWhitelist(next); localStorage.setItem(WHITELIST_KEY, JSON.stringify(next)); }}>删除</button></div>)}</div>}</section>;
};
export default XHRuleOption;
