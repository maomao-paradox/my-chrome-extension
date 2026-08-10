/**
 * SpectrumEffects.tsx - 光谱效应组件集
 *
 * 提供一组可直接参考的 CSS 光谱视觉效果，用于页面浮层、状态卡片和装饰性背景。
 */
import React, { useCallback, useMemo, useState } from "react";
import { Button, Segmented, Slider, Switch } from "antd";
import {
  BgColorsOutlined,
  CopyOutlined,
  PauseOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import "./styles/spectrum-effects.scss";

interface NotificationMessage {
  message: string;
  type: "success" | "info" | "warning" | "error";
}

interface SpectrumEffectsProps {
  onAddMessage?: (msg: NotificationMessage) => void;
}

type EffectId = "prism" | "aurora" | "halo" | "diffraction";

interface EffectConfig {
  id: EffectId;
  name: string;
  tone: string;
  description: string;
  className: string;
  css: string;
}

const EFFECTS: EffectConfig[] = [
  {
    id: "prism",
    name: "棱镜折射",
    tone: "PRISM",
    description: "适合放在按钮、提示条或徽标周围，突出高能状态。",
    className: "spectrum-prism",
    css: `.spectrum-prism {
  background:
    linear-gradient(115deg, transparent 0 28%, rgba(255,255,255,.76) 31%, transparent 34%),
    conic-gradient(from 210deg, #ff3d8b, #ffd166, #2dd4bf, #60a5fa, #a78bfa, #ff3d8b);
  filter: saturate(1.3);
}`,
  },
  {
    id: "aurora",
    name: "极光幕布",
    tone: "AURORA",
    description: "适合大面积背景，用柔和带状色彩承载信息面板。",
    className: "spectrum-aurora",
    css: `.spectrum-aurora {
  background:
    radial-gradient(circle at 18% 24%, rgba(34,197,94,.72), transparent 28%),
    radial-gradient(circle at 74% 30%, rgba(56,189,248,.74), transparent 30%),
    linear-gradient(135deg, rgba(15,23,42,.95), rgba(39,39,42,.9));
}`,
  },
  {
    id: "halo",
    name: "光谱环",
    tone: "HALO",
    description: "适合头像、入口图标和加载态，形成可控的聚焦环。",
    className: "spectrum-halo",
    css: `.spectrum-halo {
  background:
    radial-gradient(circle, #050816 0 48%, transparent 50%),
    conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #ef4444);
  box-shadow: 0 0 32px rgba(125,211,252,.35);
}`,
  },
  {
    id: "diffraction",
    name: "衍射薄膜",
    tone: "FILM",
    description: "适合卡片表面和浮层封面，强调玻璃、薄膜、油彩质感。",
    className: "spectrum-diffraction",
    css: `.spectrum-diffraction {
  background:
    linear-gradient(45deg, rgba(255,255,255,.18), transparent 34%),
    conic-gradient(from 120deg, #f472b6, #facc15, #34d399, #38bdf8, #c084fc, #f472b6);
  background-blend-mode: screen;
}`,
  },
];

const SEGMENT_OPTIONS = EFFECTS.map((effect) => ({
  label: effect.name,
  value: effect.id,
}));

const SpectrumEffects: React.FC<SpectrumEffectsProps> = ({ onAddMessage }) => {
  const [activeEffectId, setActiveEffectId] = useState<EffectId>("prism");
  const [intensity, setIntensity] = useState(72);
  const [motionEnabled, setMotionEnabled] = useState(true);

  const activeEffect = useMemo(
    () => EFFECTS.find((effect) => effect.id === activeEffectId) ?? EFFECTS[0],
    [activeEffectId]
  );

  const effectStyle = useMemo(
    () =>
      ({
        "--spectrum-opacity": `${intensity / 100}`,
        "--spectrum-saturate": `${1 + intensity / 180}`,
      }) as React.CSSProperties,
    [intensity]
  );

  const copyCss = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeEffect.css);
      onAddMessage?.({ message: `${activeEffect.name} CSS 已复制`, type: "success" });
    } catch (error) {
      maLogger.error("复制光谱 CSS 失败:", error);
      onAddMessage?.({ message: "复制失败，请检查剪贴板权限", type: "error" });
    }
  }, [activeEffect, onAddMessage]);

  return (
    <section className="spectrum-effects" aria-label="光谱效应组件集">
      <header className="spectrum-header">
        <div>
          <div className="spectrum-eyebrow">SPECTRUM KIT</div>
          <h1>光谱效应组件</h1>
        </div>
        <Button
          type="primary"
          icon={<CopyOutlined />}
          className="spectrum-copy-btn"
          onClick={copyCss}
        >
          复制 CSS
        </Button>
      </header>

      <div className="spectrum-stage" style={effectStyle}>
        <div
          className={`spectrum-demo ${activeEffect.className}${
            motionEnabled ? " is-motion" : " is-static"
          }`}
        >
          <div className="spectrum-demo-core">
            <span className="spectrum-demo-tone">{activeEffect.tone}</span>
            <strong>{activeEffect.name}</strong>
          </div>
        </div>
      </div>

      <div className="spectrum-controls">
        <Segmented
          block
          options={SEGMENT_OPTIONS}
          value={activeEffectId}
          onChange={(value) => setActiveEffectId(value as EffectId)}
        />

        <div className="spectrum-control-row">
          <label className="spectrum-slider-label">
            <BgColorsOutlined />
            强度
          </label>
          <Slider
            min={30}
            max={100}
            value={intensity}
            onChange={setIntensity}
            tooltip={{ formatter: (value) => `${value}%` }}
          />
        </div>

        <div className="spectrum-switch-row">
          <span>{activeEffect.description}</span>
          <Switch
            checked={motionEnabled}
            checkedChildren={<PlayCircleOutlined />}
            unCheckedChildren={<PauseOutlined />}
            onChange={setMotionEnabled}
            aria-label="切换光谱动效"
          />
        </div>
      </div>

      <div className="spectrum-grid">
        {EFFECTS.map((effect) => (
          <button
            key={effect.id}
            type="button"
            className={`spectrum-card${
              effect.id === activeEffectId ? " is-active" : ""
            }`}
            onClick={() => setActiveEffectId(effect.id)}
          >
            <span className={`spectrum-card-preview ${effect.className}`} />
            <span className="spectrum-card-copy">
              <strong>{effect.name}</strong>
              <small>{effect.tone}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

SpectrumEffects.displayName = "SpectrumEffects";

export default SpectrumEffects;
