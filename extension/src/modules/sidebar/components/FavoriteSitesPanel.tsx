import React, { useEffect, useMemo } from "react";
import type { Tool } from "@/types";
import "../styles/favorite-sites.scss";

interface FavoriteSitesPanelProps {
  visible: boolean;
  tools: Tool[];
  onClose: () => void;
}

/** 纵向循环滚动的收藏站点卡片面板。 */
const FavoriteSitesPanel: React.FC<FavoriteSitesPanelProps> = ({ visible, tools, onClose }) => {
  const loopTools = useMemo(() => (tools.length > 1 ? [...tools, ...tools] : tools), [tools]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  const openSite = (tool: Tool) => {
    const url = tool.details;
    if (url) {
      chrome.runtime.sendMessage({
        type: "OPEN_SITE_FAVORITE",
        target: "background",
        payload: { url },
      });
    }
    onClose();
  };

  return (
    <div className="favorite-sites-overlay" role="dialog" aria-label="收藏站点">
      <button type="button" className="favorite-sites-backdrop" aria-label="关闭收藏站点" onClick={onClose} />
      <section className="favorite-sites-panel">
        <header className="favorite-sites-header">
          <div>
            <span className="favorite-sites-eyebrow">YOUR COLLECTION</span>
            <h2>收藏站点</h2>
          </div>
          <button type="button" className="favorite-sites-close" onClick={onClose} aria-label="关闭">×</button>
        </header>
        {tools.length === 0 ? (
          <div className="favorite-sites-empty">在网页上右键选择“收藏当前站点”</div>
        ) : (
          <div className="favorite-sites-viewport">
            <div className={`favorite-sites-track ${tools.length > 1 ? "is-looping" : ""}`}>
              {loopTools.map((tool, index) => (
                <button
                  type="button"
                  className="favorite-site-card"
                  key={`${tool.id}-${index}`}
                  onClick={() => openSite(tool)}
                >
                  <span className="favorite-site-favicon">
                    <img src={tool.image} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  </span>
                  <span className="favorite-site-title" title={tool.label}>{tool.label}</span>
                  <span className="favorite-site-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default FavoriteSitesPanel;
