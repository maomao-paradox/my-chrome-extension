// src/components/ChatKnowledgeGraph/types.ts

/** 节点类型枚举 —— 与颜色映射绑定 */
export type NodeType =
  | 'role'      // 角色（AI/用户）
  | 'preference'// 偏好/称呼
  | 'topic'     // 对话主题
  | 'behavior'  // 互动行为
  | 'proactive' // AI 主动行为
  | 'custom';   // 自定义

/** 图谱节点 */
export interface GraphNode {
  /** 唯一 ID，建议用英文/拼音短横线命名，如 "vivy"、"likes-petting" */
  id: string;
  /** 展示名称，中文即可，尽量简短（≤ 10 字） */
  label: string;
  /** 节点类型，决定颜色 */
  type: NodeType;
  /** 节点半径，默认按类型给基准值，可覆盖 */
  size?: number;
  /** 悬停提示的详细说明 */
  desc?: string;
  /** 可选：来源引用（聊天记录片段），用于溯源 */
  sourceQuote?: string;
}

/** 图谱边 */
export interface GraphEdge {
  /** 起点节点 ID */
  source: string;
  /** 终点节点 ID */
  target: string;
  /** 关系名称，如 "称呼用户"、"主动提醒" */
  label?: string;
  /** 边颜色，默认 #94a3b8 */
  color?: string;
  /** 线宽，默认 1.5 */
  width?: number;
  /** 是否虚线 */
  dashed?: boolean;
}

/** 完整图谱数据 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** 可选：图谱标题 */
  title?: string;
  /** 可选：数据版本/生成时间 */
  meta?: Record<string, string>;
}

/** 组件 Props */
export interface ChatKnowledgeGraphProps {
  /** 图谱数据 */
  data: GraphData;
  /** 容器高度，默认 700px */
  height?: number | string;
  /** 容器最大宽度，默认 1300px */
  maxWidth?: number | string;
  /** 是否显示图例，默认 true */
  showLegend?: boolean;
  /** 是否显示节点/边数量徽章，默认 true */
  showBadge?: boolean;
  /** 是否允许拖拽节点，默认 true */
  draggable?: boolean;
  /** 是否允许缩放，默认 true */
  zoomable?: boolean;
  /** 初始缩放比例，默认 1 */
  initialScale?: number;
  /** 主题：dark（默认）| light */
  theme?: 'dark' | 'light';
  /** 节点类型 → 颜色的映射，覆盖默认值 */
  colorMap?: Partial<Record<NodeType, string>>;
  /** 点击节点回调 */
  onNodeClick?: (node: GraphNode) => void;
  /** 悬停节点回调 */
  onNodeHover?: (node: GraphNode | null) => void;
  /** 自定义类名 */
  className?: string;
}