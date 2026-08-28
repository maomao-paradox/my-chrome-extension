import React, { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import MASwitch from "@/assets/components/MaSwitch";
import { shadowHostId } from "@/config";
import { createShadowHost, injectStyles } from "@/utils/shadow-dom";
import panelStyles from "./content-feature-panel.scss?inline";
import switchStyles from "@/assets/components/ma-switch.scss?inline";

interface FeatureItem {
  id: string;
  label: string;
}

interface ContentFeaturePanelOptions {
  scriptName: string;
  shortcut: string;
  isFirstUse: boolean;
  features: FeatureItem[];
  config: Record<string, boolean>;
  onSave: (config: Record<string, boolean>) => void;
}

const PANEL_MOUNT_ID = "kria-nove-content-feature-panel";

interface TourStep {
  title: string;
  description: string;
  target: "container" | "header" | "list" | "footer";
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "欢迎使用 内容脚本 配置",
    description:
      "这里可以按需管理当前内容脚本的功能。引导完成后，你可以随时使用快捷键重新打开面板。",
    target: "container",
  },
  {
    title: "选择需要的功能",
    description:
      "每一行代表一个独立业务功能。首次使用时全部关闭，请打开你需要的功能。",
    target: "list",
  },
  {
    title: "保存并刷新页面",
    description: "选择完成后点击保存。配置会写入当前网页，刷新页面后正式生效。",
    target: "footer",
  },
];

export const Panel: React.FC<
  ContentFeaturePanelOptions & { onClose: () => void }
> = ({
  scriptName,
  shortcut,
  isFirstUse,
  features,
  config,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<Record<string, boolean>>({ ...config });
  const [tourStep, setTourStep] = useState(isFirstUse ? 0 : -1);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (tourStep < 0) {
      setTargetRect(null);
      return;
    }

    const refs = {
      container: containerRef,
      header: headerRef,
      list: listRef,
      footer: footerRef,
    };
    console.log(headerRef.current?.getBoundingClientRect());

    const updateRect = () =>
      setTargetRect(
        refs[TOUR_STEPS[tourStep].target].current?.getBoundingClientRect() ||
          null,
      );
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [tourStep]);

  const closeTour = () => setTourStep(-1);
  const currentTourStep = tourStep >= 0 ? TOUR_STEPS[tourStep] : null;

  return (
    <div className="kn-panel-container">
      <div
        className="kn-panel"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${scriptName} 内容脚本配置`}
      >
        <div className="kn-panel__header" ref={headerRef}>
          <div>
            <div className="kn-panel__eyebrow">内容脚本配置</div>
            <h2>{scriptName}</h2>
          </div>
          <button
            className="kn-icon-button"
            type="button"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {isFirstUse && (
          <div className="kn-panel__guide">
            <strong>首次使用</strong>
            <span>
              已为你关闭全部功能。选择需要启用的功能并保存，之后可使用
              <code> {shortcut} </code>
              再次打开面板。
            </span>
          </div>
        )}

        <div className="kn-panel__list" ref={listRef}>
          {features.map((feature) => (
            <MASwitch
              key={feature.id}
              label={feature.label}
              checked={draft[feature.id] === true}
              onChange={(checked) =>
                setDraft((current) => ({ ...current, [feature.id]: checked }))
              }
              openText="开"
              closeText="关"
            >
              {/* <code>{feature.id}</code> */}
            </MASwitch>
          ))}
        </div>

        <div className="kn-panel__notice">更改配置后需要刷新页面生效</div>
        <div className="kn-panel__footer" ref={footerRef}>
          <button
            className="kn-button kn-button--ghost"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="kn-button kn-button--primary"
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            保存
          </button>
        </div>

        {currentTourStep && targetRect && (
          <div
            className="kn-tour"
            role="dialog"
            aria-label="首次使用引导"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              className="kn-tour__backdrop"
              aria-hidden="true"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            />
            <div
              className="kn-tour__spotlight"
              style={{
                top: targetRect.top - 8,
                left: targetRect.left - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            />
            <div
              className={`kn-tour__card kn-tour__card--${tourStep === TOUR_STEPS.length - 1 ? "bottom" : "top"}`}
              style={{
                top:
                  tourStep === TOUR_STEPS.length - 1
                    ? targetRect.top - 174
                    : targetRect.bottom + 16,
                left: Math.max(
                  16,
                  Math.min(window.innerWidth - 346, targetRect.left),
                ),
              }}
            >
              <div className="kn-tour__progress">
                {tourStep + 1} / {TOUR_STEPS.length}
              </div>
              <h3>{currentTourStep.title}</h3>
              <p>{currentTourStep.description}</p>
              <div className="kn-tour__actions">
                <button
                  className="kn-tour__skip"
                  type="button"
                  onClick={closeTour}
                >
                  跳过
                </button>
                {tourStep > 0 && (
                  <button
                    className="kn-button kn-button--ghost"
                    type="button"
                    onClick={() => setTourStep(tourStep - 1)}
                  >
                    上一步
                  </button>
                )}
                <button
                  className="kn-button kn-button--primary"
                  type="button"
                  onClick={() =>
                    tourStep === TOUR_STEPS.length - 1
                      ? closeTour()
                      : setTourStep(tourStep + 1)
                  }
                >
                  {tourStep === TOUR_STEPS.length - 1 ? "完成" : "下一步"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const createContentFeaturePanel = (
  options: ContentFeaturePanelOptions,
): void => {
  const existingHost = document.getElementById(shadowHostId);
  const { shadowHost, shadowRoot } = existingHost?.shadowRoot
    ? { shadowHost: existingHost, shadowRoot: existingHost.shadowRoot }
    : createShadowHost(shadowHostId, "open");

  const existingMount = shadowRoot.getElementById(PANEL_MOUNT_ID);
  existingMount?.remove();

  injectStyles(shadowRoot, `${panelStyles}\n${switchStyles}`);
  const mount = document.createElement("div");
  mount.id = PANEL_MOUNT_ID;
  shadowRoot.appendChild(mount);
  createRoot(mount).render(
    <Panel {...options} onClose={() => mount.remove()} />,
  );

  // Keep the host reference alive for browsers that optimize detached shadow trees.
  void shadowHost;
};
