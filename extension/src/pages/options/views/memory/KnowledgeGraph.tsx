/**
 * @file KnowledgeGraph.tsx
 * @description 记忆知识网络 —— 基于 Cytoscape 的力导向图谱（动态加载，避免拖慢 options 首屏）
 *
 * 视觉编码：
 *   颜色   = 记忆分类
 *   大小   = 重要度
 *   描边   = 遗忘状态（绿/橙/灰）
 *   透明度 = 艾宾浩斯保留率（越淡越接近遗忘）
 *   连线   = 共享关键词，越粗共享越多
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Button, Empty, Space, Spin } from "antd";
import type {
  MemoryCategory,
  MemoryDecayState,
  MemoryEntry,
  MemoryImportance,
} from "@/services/memory";
import { buildMemoryGraph, DEFAULT_MAX_NODES } from "./graph-builder";

/** Cytoscape 集合（节点 / 边）的最小结构描述 */
interface CyCollection {
  addClass: (name: string) => CyCollection;
  removeClass: (name: string) => CyCollection;
  not: (other: CyCollection) => CyCollection;
  closedNeighborhood: () => CyCollection;
  id: () => string;
}

/** Cytoscape 实例的最小结构描述 —— 避免直接依赖其 export= 命名空间类型 */
interface CyCore {
  on: (
    event: string,
    selector: string,
    handler: (evt: { target: CyCollection }) => void,
  ) => void;
  getElementById: (id: string) => CyCollection;
  elements: () => CyCollection;
  layout: (options: Record<string, unknown>) => { run: () => void };
  resize: () => void;
  destroy: () => void;
}

/** Cytoscape 工厂函数的最小签名 */
type CyFactory = (options: Record<string, unknown>) => CyCore;

export interface KnowledgeGraphProps {
  /** 当前角色的所有记忆条目 */
  entries: MemoryEntry[];
  /** 点击节点时回传对应记忆条目 */
  onSelectEntry?: (entry: MemoryEntry) => void;
}

/** 分类 → 节点填充色 */
const CATEGORY_COLOR: Record<MemoryCategory, string> = {
  identity: "#a78bfa",
  preference: "#22d3ee",
  fact: "#60a5fa",
  conversation: "#94a3b8",
  episodic: "#fb923c",
};

/** 重要度 → 节点直径 */
const IMPORTANCE_SIZE: Record<MemoryImportance, number> = {
  critical: 36,
  high: 30,
  medium: 24,
  low: 18,
};

/** 遗忘状态 → 节点描边色 */
const DECAY_BORDER: Record<MemoryDecayState, string> = {
  active: "#4ade80",
  fading: "#fb923c",
  forgotten: "#64748b",
};

/** 遗忘节点也不会淡到看不见 */
const MIN_NODE_OPACITY = 0.35;

/** 力导向布局参数 */
const COSE_LAYOUT: Record<string, unknown> = {
  name: "cose",
  animate: true,
  animationDuration: 500,
  idealEdgeLength: 90,
  nodeRepulsion: 8000,
  gravity: 0.4,
  fit: true,
  padding: 30,
};

/** Cytoscape 样式表 —— 用 data() 映射实现按数据着色/定尺寸 */
const GRAPH_STYLE: Array<Record<string, unknown>> = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      width: "data(size)",
      height: "data(size)",
      opacity: "data(opacity)",
      "border-width": 2,
      "border-color": "data(borderColor)",
      label: "data(label)",
      "font-size": 9,
      "font-family":
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif',
      color: "#cbd5e1",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 4,
      "text-wrap": "wrap",
      "text-max-width": 100,
      "text-background-color": "rgba(5,13,24,0.65)",
      "text-background-opacity": 1,
      "text-background-padding": "2px",
    },
  },
  {
    selector: "edge",
    style: {
      width: "mapData(weight, 1, 10, 1, 4)",
      "line-color": "rgba(148,163,184,0.35)",
      "curve-style": "bezier",
      opacity: 0.6,
    },
  },
  // 邻接高亮：非邻接元素淡出
  {
    selector: ".faded",
    style: { opacity: 0.1 },
  },
  // 被选中的节点加粗描边
  {
    selector: ".selected",
    style: { "border-width": 4, "border-color": "#e6f4ff", opacity: 1 },
  },
];

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  entries,
  onSelectEntry,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<CyCore | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 图数据（节点/边）—— 记忆变化时重算 */
  const graphData = useMemo(() => buildMemoryGraph(entries), [entries]);

  /** 节点 ID → 原始记忆条目，供点击回查 */
  const entryMap = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );

  /** 是否因数量上限被裁剪 */
  const truncated = entries.length > DEFAULT_MAX_NODES;

  /** 把图数据转成 Cytoscape elements（补充视觉映射字段） */
  const elements = useMemo(
    () => [
      ...graphData.nodes.map((node) => ({
        data: {
          ...node.data,
          color: CATEGORY_COLOR[node.data.category],
          size: IMPORTANCE_SIZE[node.data.importance],
          borderColor: DECAY_BORDER[node.data.decayState],
          opacity: Math.max(MIN_NODE_OPACITY, node.data.retention),
        },
      })),
      ...graphData.edges,
    ],
    [graphData],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || elements.length === 0) {
      setLoading(false);
      return;
    }

    let disposed = false;
    let cy: CyCore | null = null;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        // 动态加载：只有切到知识网络 Tab 才会真正请求这个 chunk
        const mod = (await import("cytoscape")) as unknown as {
          default: CyFactory;
        };
        if (disposed) {
          return;
        }

        cy = mod.default({
          container,
          elements,
          style: GRAPH_STYLE,
          layout: COSE_LAYOUT,
          wheelSensitivity: 0.2,
          minZoom: 0.2,
          maxZoom: 2,
        });
        cyRef.current = cy;

        // 点击节点 → 回传记忆条目
        cy.on("tap", "node", (evt) => {
          const entry = entryMap.get(evt.target.id());
          if (entry) {
            onSelectEntry?.(entry);
          }
        });

        // 悬停高亮邻接子图
        cy.on("mouseover", "node", (evt) => {
          if (!cy) {
            return;
          }
          const collection = cy.getElementById(evt.target.id());
          cy.elements().not(collection.closedNeighborhood()).addClass("faded");
          collection.addClass("selected");
        });

        cy.on("mouseout", "node", () => {
          cy?.elements().removeClass("faded selected");
        });

        setLoading(false);
      } catch (err) {
        if (disposed) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      cy?.destroy();
      cyRef.current = null;
    };
  }, [elements, entryMap, onSelectEntry]);

  /** 重新跑一次力导向布局 */
  const handleRelayout = useCallback(() => {
    cyRef.current?.layout({ ...COSE_LAYOUT, randomize: true }).run();
  }, []);

  // ─── 空状态 ─── //
  if (entries.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无记忆，无法生成知识网络"
        style={{ padding: "60px 0" }}
      />
    );
  }

  return (
    <div>
      <Space size={8} style={{ marginBottom: 8 }} wrap>
        <span className="memory-center__count">
          {graphData.nodes.length} 节点 · {graphData.edges.length} 连线
        </span>
        <Button size="small" onClick={handleRelayout}>
          重新布局
        </Button>
      </Space>

      {truncated && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          message={`记忆超过 ${DEFAULT_MAX_NODES} 条，已按「重要度 + 保留率」优先展示前 ${DEFAULT_MAX_NODES} 条`}
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 8 }}
          message={`图谱加载失败：${error}`}
        />
      )}

      <div style={{ position: "relative" }}>
        <div ref={containerRef} className="memory-center__graph" />
        {loading && (
          <div className="memory-center__graph-loading">
            <Spin tip="正在构建知识网络…" />
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraph;
