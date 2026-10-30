// src/components/ChatKnowledgeGraph/index.tsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { ChatKnowledgeGraphProps, GraphNode, NodeType } from './types';
import { useForceGraph } from './useForceGraph';
import './styles.scss';

const DEFAULT_COLORS: Record<NodeType, string> = {
  role: '#f472b6',
  preference: '#fbbf24',
  topic: '#60a5fa',
  behavior: '#a78bfa',
  proactive: '#f87171',
  custom: '#64748b',
};

const LEGEND_LABELS: Record<NodeType, string> = {
  role: '角色/用户',
  preference: '偏好/称呼',
  topic: '对话主题',
  behavior: '互动行为',
  proactive: 'AI主动行为',
  custom: '自定义',
};

export const ChatKnowledgeGraph: React.FC<ChatKnowledgeGraphProps> = ({
  data,
  height = 700,
  maxWidth = 1300,
  showLegend = true,
  showBadge = true,
  draggable = true,
  zoomable = true,
  initialScale = 1,
  theme = 'dark',
  colorMap: customColors,
  onNodeClick,
  onNodeHover,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 800, height: 700 });
  const [tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  const colorMap = useMemo(
    () => ({ ...DEFAULT_COLORS, ...customColors }),
    [customColors]
  );

  // 尺寸监听
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  // 画布像素尺寸同步
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = size.width + 'px';
    canvas.style.height = size.height + 'px';
  }, [size]);

  const handleHover = useCallback(
    (node: GraphNode | null) => {
      if (!node) {
        setTooltip(null);
        onNodeHover?.(null);
        return;
      }
      // 计算屏幕位置（相对容器）
      const st = (window as any).__kgStateRef?.current;
      if (st) {
        const n = st.simNodes.find((s: any) => s.id === node.id);
        if (n) {
          const sx = n.x * st.transform.k + st.transform.x;
          const sy = n.y * st.transform.k + st.transform.y;
          setTooltip({ node, x: sx, y: sy });
        }
      }
      onNodeHover?.(node);
    },
    [onNodeHover]
  );

  const stateRef = useForceGraph(canvasRef, data, {
    width: size.width,
    height: size.height,
    draggable,
    zoomable,
    initialScale,
    colorMap,
    theme,
    onNodeClick,
    onNodeHover: handleHover,
  } as any);

  // 把 stateRef 暴露给 tooltip 定位（hack 但够用）
  (window as any).__kgStateRef = stateRef;

  const usedTypes = useMemo(() => {
    const s = new Set<NodeType>();
    data.nodes.forEach((n) => s.add(n.type));
    return Array.from(s);
  }, [data.nodes]);

  return (
    <div className={`ckg-wrapper ckg-theme-${theme} ${className}`} style={{ maxWidth }}>
      <div className="ckg-header">
        <h1>
          <span>🐱</span> {data.title ?? '聊天记录知识图谱'}
        </h1>
        {showBadge && (
          <div className="ckg-badge">
            <span className="ckg-dot" />
            节点 {data.nodes.length} · 关系 {data.edges.length}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="ckg-canvas-container"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <canvas ref={canvasRef} />
        {tooltip && (
          <div
            className="ckg-tooltip"
            style={{ left: tooltip.x + 20, top: tooltip.y - 30 }}
          >
            <strong>{tooltip.node.label}</strong>
            <br />
            <span className="ckg-tooltip-type">{LEGEND_LABELS[tooltip.node.type]}</span>
            {tooltip.node.desc && <p>{tooltip.node.desc}</p>}
          </div>
        )}
      </div>

      {showLegend && (
        <div className="ckg-legend">
          {usedTypes.map((t) => (
            <div key={t} className="ckg-legend-item">
              <span className="ckg-legend-color" style={{ background: colorMap[t] }} />
              {LEGEND_LABELS[t]}
            </div>
          ))}
        </div>
      )}

      <div className="ckg-footer">
        悬停节点查看详情 · 拖拽移动 / 滚轮缩放
      </div>
    </div>
  );
};

export default ChatKnowledgeGraph;