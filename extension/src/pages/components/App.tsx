import React, { useMemo, useState, useCallback } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  ListFilter,
  Search,
  Shapes,
  Sparkles,
  Code2,
} from "lucide-react";
import { showcaseItems, type ShowcaseItem } from "./registry";

const categories = ["全部", ...Array.from(new Set(showcaseItems.map((item) => item.category)))];

const App = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [activeId, setActiveId] = useState(showcaseItems[0]?.id ?? "");

  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return showcaseItems.filter((item) => {
      const matchesCategory =
        activeCategory === "全部" || item.category === activeCategory;
      const matchesKeyword =
        !keyword ||
        [item.name, item.summary, item.path, item.category, ...item.tags]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return matchesCategory && matchesKeyword;
    });
  }, [activeCategory, query]);

  const selectedItem = useMemo(() => {
    return (
      visibleItems.find((item) => item.id === activeId) ?? visibleItems[0] ?? showcaseItems[0]
    );
  }, [activeId, visibleItems]);

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<string, number>>((acc, category) => {
      acc[category] =
        category === "全部"
          ? showcaseItems.length
          : showcaseItems.filter((item) => item.category === category).length;
      return acc;
    }, {});
  }, []);

  const handleSelectItem = useCallback((item: ShowcaseItem) => {
    setActiveId(item.id);
  }, []);

  const copyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (error) {
      console.warn("copy failed", error);
    }
  }, []);

  const previewItem = selectedItem ?? showcaseItems[0];

  return (
    <main className="showcase-page">
      <header className="showcase-header">
        <div>
          <p className="showcase-kicker">KIRA:NOVE / ASSETS</p>
          <h1>组件展示页</h1>
          <p className="showcase-lead">
            用接近 Ant Design / Element Plus 的方式，集中浏览 `src/assets/components`
            里的自研组件。
          </p>
        </div>

        <div className="showcase-header__meta">
          <div className="showcase-stat">
            <span>已收录</span>
            <strong>{showcaseItems.length}</strong>
          </div>
          <div className="showcase-stat">
            <span>可预览</span>
            <strong>{showcaseItems.filter((item) => item.status === "可预览").length}</strong>
          </div>
          <div className="showcase-stat">
            <span>目录项</span>
            <strong>{showcaseItems.filter((item) => item.status === "目录").length}</strong>
          </div>
        </div>
      </header>

      <section className="showcase-toolbar">
        <label className="showcase-search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索组件名、标签、路径"
          />
        </label>

        <div className="showcase-toolbar__tags">
          {categories.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                className={`showcase-tag${active ? " is-active" : ""}`}
                onClick={() => setActiveCategory(category)}
              >
                <ListFilter size={14} />
                <span>{category}</span>
                <em>{categoryCounts[category] ?? 0}</em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="showcase-layout">
        <aside className="showcase-panel showcase-panel--catalog">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Catalog</p>
              <h2>组件目录</h2>
            </div>
            <Shapes size={18} />
          </div>

          <div className="catalog-list">
            {visibleItems.map((item) => {
              const active = item.id === previewItem.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`catalog-item${active ? " is-active" : ""}`}
                  onClick={() => handleSelectItem(item)}
                >
                  <span className="catalog-item__icon" style={{ color: `var(--accent-${item.accent})` }}>
                    {item.icon}
                  </span>
                  <span className="catalog-item__body">
                    <span className="catalog-item__title">
                      {item.name}
                      <ChevronRight size={14} />
                    </span>
                    <span className="catalog-item__summary">{item.summary}</span>
                    <span className="catalog-item__meta">
                      {item.kind} · {item.category} · {item.status}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="showcase-panel showcase-panel--preview">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Preview</p>
              <h2>{previewItem.name}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => copyPath(previewItem.path)}
              title="复制路径"
            >
              <ClipboardCopy size={16} />
            </button>
          </div>

          <div className="preview-shell">
            <div className="preview-stage">{previewItem.preview}</div>

            <div className="preview-caption">
              <div className="preview-caption__title">
                <Sparkles size={16} />
                <span>{previewItem.summary}</span>
              </div>
              <p>{previewItem.details[0]}</p>
            </div>
          </div>
        </section>

        <aside className="showcase-panel showcase-panel--detail">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Detail</p>
              <h2>组件信息</h2>
            </div>
            <Code2 size={18} />
          </div>

          <div className="detail-stack">
            <section className="detail-card">
              <span className="detail-label">文件路径</span>
              <code>{previewItem.path}</code>
              <button type="button" className="ghost-button" onClick={() => copyPath(previewItem.path)}>
                <ClipboardCopy size={14} />
                复制
              </button>
            </section>

            <section className="detail-card">
              <span className="detail-label">标签</span>
              <div className="tag-row">
                {previewItem.tags.map((tag) => (
                  <span key={tag} className="mini-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="detail-card">
              <span className="detail-label">说明</span>
              <ul className="detail-list">
                {previewItem.details.map((detail) => (
                  <li key={detail}>
                    <CheckCircle2 size={14} />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="detail-card detail-card--foot">
              <span className="detail-label">状态</span>
              <div className="status-line">
                <span className={`status-pill status-pill--${previewItem.status === "可预览" ? "live" : "catalog"}`}>
                  {previewItem.status}
                </span>
                <span className="status-text">
                  {previewItem.kind} · {previewItem.category}
                </span>
              </div>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
};

export default App;
