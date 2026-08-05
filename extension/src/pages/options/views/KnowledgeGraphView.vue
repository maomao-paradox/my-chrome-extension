<template>
  <div class="knowledge-graph-console">
    <section class="graph-command-bar" aria-label="知识图谱控制台">
      <div class="graph-command-bar__title">
        <span>Skill Atlas</span>
        <h2>个人知识图谱</h2>
      </div>

      <div class="graph-command-bar__metrics">
        <div v-for="metric in graphMetrics" :key="metric.label" class="metric-pill">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </div>
      </div>

      <div class="view-switch" role="tablist" aria-label="视图切换">
        <button
          type="button"
          :class="{ active: activeView === 'graph' }"
          role="tab"
          :aria-selected="activeView === 'graph'"
          @click="activeView = 'graph'"
        >
          图谱
        </button>
        <button
          type="button"
          :class="{ active: activeView === 'book' }"
          role="tab"
          :aria-selected="activeView === 'book'"
          @click="activeView = 'book'"
        >
          技能书
        </button>
      </div>
    </section>

    <div class="graph-layout">
      <aside class="node-inspector" aria-label="节点编辑器">
        <header class="panel-heading">
          <div>
            <span class="panel-heading__eyebrow">Node Editor</span>
            <h3>{{ selectedNode?.title || '未选中节点' }}</h3>
          </div>
          <strong>{{ selectedDepthLabel }}</strong>
        </header>

        <template v-if="selectedNode">
          <div class="selected-path" aria-label="节点路径">
            <span v-for="pathNode in selectedPath" :key="pathNode.id">{{ pathNode.title }}</span>
          </div>

          <label class="field">
            <span>节点名称</span>
            <input :value="selectedNode.title" type="text" maxlength="24" @input="handleTitleInput" />
          </label>

          <label class="field">
            <span>知识分类</span>
            <select :value="selectedNode.category" @change="handleCategoryChange">
              <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="field">
            <span>掌握状态</span>
            <select :value="selectedNode.status" @change="handleStatusChange">
              <option v-for="option in statusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="field field--range">
            <span>熟练度</span>
            <input :value="selectedNode.level" type="range" min="0" max="100" @input="handleLevelInput" />
            <strong>{{ selectedNode.level }}%</strong>
          </label>

          <label class="field">
            <span>备注</span>
            <textarea :value="selectedNode.notes" rows="4" maxlength="140" @input="handleNotesInput"></textarea>
          </label>

          <div class="node-actions">
            <button type="button" class="action-btn action-btn--primary" @click="addChildNode(selectedNode.id)">
              <Plus aria-hidden="true" />
              <span>添加子节点</span>
            </button>
            <button type="button" class="action-btn" @click="addSiblingNode">
              <Connection aria-hidden="true" />
              <span>添加同级</span>
            </button>
            <button
              type="button"
              class="action-btn action-btn--danger"
              :disabled="selectedNode.id === ROOT_NODE_ID"
              @click="deleteNode(selectedNode.id)"
            >
              <Delete aria-hidden="true" />
              <span>删除节点</span>
            </button>
          </div>
        </template>
      </aside>

      <main v-if="activeView === 'graph'" class="graph-stage-panel" aria-label="知识图谱画布">
        <div class="canvas-toolbar">
          <div class="search-box">
            <Collection aria-hidden="true" />
            <input v-model="searchTerm" type="search" placeholder="搜索节点" @keydown.enter="selectFirstMatch" />
          </div>

          <div class="canvas-toolbar__actions">
            <button type="button" aria-label="添加根级节点" title="添加根级节点" @click="addChildNode(ROOT_NODE_ID)">
              <Plus aria-hidden="true" />
            </button>
            <button type="button" aria-label="放大图谱" title="放大图谱" @click="zoomBy(1.18)">
              <ZoomIn aria-hidden="true" />
            </button>
            <button type="button" aria-label="缩小图谱" title="缩小图谱" @click="zoomBy(0.84)">
              <ZoomOut aria-hidden="true" />
            </button>
            <button type="button" aria-label="重置视图" title="重置视图" @click="resetViewport">
              <Aim aria-hidden="true" />
            </button>
            <button type="button" aria-label="重置示例数据" title="重置示例数据" @click="resetGraph">
              <RefreshLeft aria-hidden="true" />
            </button>
          </div>
        </div>

        <svg
          ref="canvasRef"
          class="graph-canvas"
          :viewBox="`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`"
          role="application"
          aria-label="可拖拽、缩放和编辑的个人知识图谱"
          tabindex="0"
          @pointerdown="startCanvasPan"
          @pointermove="handleCanvasPointerMove"
          @pointerup="finishPointerGesture"
          @pointercancel="finishPointerGesture"
          @wheel.prevent="handleWheel"
          @keydown.delete.prevent="deleteSelectedNode"
        >
          <defs>
            <pattern id="atlasGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" class="grid-line" />
            </pattern>
            <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect :width="CANVAS_WIDTH" :height="CANVAS_HEIGHT" fill="url(#atlasGrid)" class="canvas-grid" />

          <g :transform="stageTransform">
            <g class="edge-layer">
              <line
                v-for="link in links"
                :key="link.id"
                :x1="link.source.x"
                :y1="link.source.y"
                :x2="link.target.x"
                :y2="link.target.y"
                :stroke="edgeColor(link.target)"
                :class="{ 'is-selected': selectedPathIds.has(link.source.id) && selectedPathIds.has(link.target.id) }"
              />
            </g>

            <g class="node-layer">
              <g
                v-for="node in nodes"
                :key="node.id"
                class="graph-node"
                :class="{
                  'is-selected': node.id === selectedNodeId,
                  'is-related': selectedPathIds.has(node.id),
                  'is-match': matchedNodeIds.has(node.id),
                  'is-root': node.id === ROOT_NODE_ID,
                }"
                :transform="`translate(${node.x} ${node.y})`"
                @pointerdown.stop="startNodeDrag($event, node)"
                @click.stop="selectNode(node.id)"
              >
                <circle
                  class="node-orbit"
                  :r="nodeRadius(node) + 12"
                  :stroke="categoryMeta[node.category].color"
                />
                <circle
                  class="node-body"
                  :r="nodeRadius(node)"
                  :fill="categoryMeta[node.category].surface"
                  :stroke="categoryMeta[node.category].color"
                  filter="url(#nodeGlow)"
                />
                <text class="node-code" y="-7" text-anchor="middle">{{ categoryMeta[node.category].code }}</text>
                <text class="node-title" y="10" text-anchor="middle">{{ shortLabel(node.title, 9) }}</text>
                <text class="node-level" y="27" text-anchor="middle">{{ node.level }}%</text>

                <g class="node-inline-actions" :transform="`translate(${nodeRadius(node) + 14} -${nodeRadius(node) + 10})`">
                  <g
                    class="node-action node-action--add"
                    role="button"
                    tabindex="0"
                    aria-label="添加子节点"
                    @pointerdown.stop
                    @click.stop="addChildNode(node.id)"
                    @keydown.enter.stop="addChildNode(node.id)"
                    @keydown.space.stop.prevent="addChildNode(node.id)"
                  >
                    <title>添加子节点</title>
                    <circle r="13" />
                    <path d="M -5 0 H 5 M 0 -5 V 5" />
                  </g>
                  <g
                    v-if="node.id !== ROOT_NODE_ID"
                    class="node-action node-action--delete"
                    role="button"
                    tabindex="0"
                    aria-label="删除节点"
                    transform="translate(0 32)"
                    @pointerdown.stop
                    @click.stop="deleteNode(node.id)"
                    @keydown.enter.stop="deleteNode(node.id)"
                    @keydown.space.stop.prevent="deleteNode(node.id)"
                  >
                    <title>删除节点</title>
                    <circle r="13" />
                    <path d="M -5 -5 L 5 5 M 5 -5 L -5 5" />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </svg>
      </main>

      <main v-else class="skill-book-panel" aria-label="技能书">
        <div class="book-toolbar">
          <div>
            <span>Skill Book</span>
            <strong>{{ groupedNodes.length }} 个章节</strong>
          </div>
          <button type="button" class="action-btn action-btn--primary" @click="addChildNode(selectedNodeId)">
            <Plus aria-hidden="true" />
            <span>添加到当前章节</span>
          </button>
        </div>

        <section v-for="group in groupedNodes" :key="group.category" class="book-section">
          <header>
            <div>
              <span :style="{ background: categoryMeta[group.category].color }"></span>
              <strong>{{ categoryMeta[group.category].label }}</strong>
            </div>
            <small>{{ group.nodes.length }} nodes</small>
          </header>

          <div class="book-node-list">
            <button
              v-for="node in group.nodes"
              :key="node.id"
              type="button"
              class="book-node"
              :class="{ active: node.id === selectedNodeId }"
              @click="selectNode(node.id)"
            >
              <span>{{ shortLabel(node.title, 16) }}</span>
              <strong>{{ node.level }}%</strong>
              <small>{{ statusMeta[node.status].label }}</small>
            </button>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Aim,
  Collection,
  Connection,
  Delete,
  Plus,
  RefreshLeft,
  ZoomIn,
  ZoomOut
} from '@element-plus/icons-vue';

type NodeCategory = 'foundation' | 'frontend' | 'backend' | 'ai' | 'product' | 'operations';
type NodeStatus = 'learning' | 'active' | 'mastered';
type ActiveView = 'graph' | 'book';

interface KnowledgeNode {
  id: string;
  title: string;
  category: NodeCategory;
  status: NodeStatus;
  level: number;
  notes: string;
  x: number;
  y: number;
  parentId: string | null;
}

interface NodeLink {
  id: string;
  source: KnowledgeNode;
  target: KnowledgeNode;
}

type DragState =
  | {
      mode: 'pan';
      pointerId: number;
      lastCanvasX: number;
      lastCanvasY: number;
    }
  | {
      mode: 'node';
      pointerId: number;
      nodeId: string;
      offsetX: number;
      offsetY: number;
    };

const ROOT_NODE_ID = 'root';
const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 720;
const MIN_SCALE = 0.42;
const MAX_SCALE = 2.2;
const STORAGE_KEY = 'mria_knowledge_graph_nodes';
const VIEWPORT_STORAGE_KEY = 'mria_knowledge_graph_viewport';

const categoryMeta: Record<NodeCategory, { label: string; code: string; color: string; surface: string }> = {
  foundation: { label: '基础能力', code: 'CORE', color: '#8bf8ff', surface: 'rgba(139, 248, 255, 0.18)' },
  frontend: { label: '前端工程', code: 'FE', color: '#69b7ff', surface: 'rgba(105, 183, 255, 0.18)' },
  backend: { label: '后端服务', code: 'BE', color: '#7af7d0', surface: 'rgba(122, 247, 208, 0.17)' },
  ai: { label: 'AI 协作', code: 'AI', color: '#b9a1ff', surface: 'rgba(185, 161, 255, 0.17)' },
  product: { label: '产品思维', code: 'PD', color: '#ffcf6b', surface: 'rgba(255, 207, 107, 0.16)' },
  operations: { label: '工程运维', code: 'OPS', color: '#ff8f70', surface: 'rgba(255, 143, 112, 0.16)' }
};

const statusMeta: Record<NodeStatus, { label: string; weight: number }> = {
  learning: { label: '学习中', weight: 0.35 },
  active: { label: '实践中', weight: 0.7 },
  mastered: { label: '已掌握', weight: 1 }
};

const defaultNodes = (): KnowledgeNode[] => [
  {
    id: ROOT_NODE_ID,
    title: '个人技能书',
    category: 'foundation',
    status: 'active',
    level: 82,
    notes: '所有能力、经验和知识条目的根节点。',
    x: 0,
    y: 0,
    parentId: null
  },
  {
    id: 'frontend-core',
    title: '前端架构',
    category: 'frontend',
    status: 'mastered',
    level: 88,
    notes: 'Vue、状态管理、构建链路和组件设计。',
    x: -260,
    y: -140,
    parentId: ROOT_NODE_ID
  },
  {
    id: 'backend-core',
    title: '服务端能力',
    category: 'backend',
    status: 'active',
    level: 74,
    notes: '接口设计、鉴权、数据建模和任务队列。',
    x: 270,
    y: -130,
    parentId: ROOT_NODE_ID
  },
  {
    id: 'ai-workflow',
    title: 'AI 工作流',
    category: 'ai',
    status: 'active',
    level: 78,
    notes: '提示词、Agent 协同、评估和自动化。',
    x: 10,
    y: -250,
    parentId: ROOT_NODE_ID
  },
  {
    id: 'product-sense',
    title: '产品判断',
    category: 'product',
    status: 'learning',
    level: 62,
    notes: '需求拆解、优先级、信息架构和验收标准。',
    x: -230,
    y: 180,
    parentId: ROOT_NODE_ID
  },
  {
    id: 'ops-quality',
    title: '质量与运维',
    category: 'operations',
    status: 'active',
    level: 68,
    notes: '日志、监控、发布、回滚和性能预算。',
    x: 250,
    y: 185,
    parentId: ROOT_NODE_ID
  },
  {
    id: 'vue-system',
    title: 'Vue 组件系统',
    category: 'frontend',
    status: 'mastered',
    level: 91,
    notes: '组合式 API、可复用组件和样式边界。',
    x: -430,
    y: -270,
    parentId: 'frontend-core'
  },
  {
    id: 'interaction-design',
    title: '交互设计',
    category: 'frontend',
    status: 'active',
    level: 79,
    notes: '复杂工具页面的状态、反馈和可访问性。',
    x: -470,
    y: -60,
    parentId: 'frontend-core'
  },
  {
    id: 'api-contract',
    title: 'API 契约',
    category: 'backend',
    status: 'active',
    level: 72,
    notes: '请求响应结构、错误模型和版本兼容。',
    x: 430,
    y: -250,
    parentId: 'backend-core'
  },
  {
    id: 'prompt-eval',
    title: 'Prompt 评估',
    category: 'ai',
    status: 'learning',
    level: 58,
    notes: '任务拆分、输出约束、回归样例和人工复核。',
    x: 150,
    y: -410,
    parentId: 'ai-workflow'
  },
  {
    id: 'research-notes',
    title: '研究笔记',
    category: 'product',
    status: 'learning',
    level: 52,
    notes: '把零散输入沉淀为可复用知识条目。',
    x: -390,
    y: 330,
    parentId: 'product-sense'
  },
  {
    id: 'release-loop',
    title: '发布闭环',
    category: 'operations',
    status: 'active',
    level: 70,
    notes: '构建、冒烟、风险记录和发布后观察。',
    x: 420,
    y: 330,
    parentId: 'ops-quality'
  }
];

const activeView = ref<ActiveView>('graph');
const nodes = ref<KnowledgeNode[]>(defaultNodes());
const selectedNodeId = ref(ROOT_NODE_ID);
const searchTerm = ref('');
const viewport = ref({ x: 0, y: 0, scale: 0.88 });
const canvasRef = ref<SVGSVGElement | null>(null);
const dragState = ref<DragState | null>(null);

let persistTimer: ReturnType<typeof setTimeout> | null = null;

const categoryOptions = Object.entries(categoryMeta).map(([value, meta]) => ({
  value: value as NodeCategory,
  label: meta.label
}));

const statusOptions = Object.entries(statusMeta).map(([value, meta]) => ({
  value: value as NodeStatus,
  label: meta.label
}));

const nodesById = computed(() => {
  return nodes.value.reduce((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {} as Record<string, KnowledgeNode>);
});

const selectedNode = computed<KnowledgeNode | null>(() => nodesById.value[selectedNodeId.value] || nodesById.value[ROOT_NODE_ID]);

const links = computed<NodeLink[]>(() => {
  return nodes.value.reduce((acc, node) => {
    if (!node.parentId) {
      return acc;
    }

    const source = nodesById.value[node.parentId];
    if (source) {
      acc.push({
        id: `${source.id}-${node.id}`,
        source,
        target: node
      });
    }

    return acc;
  }, [] as NodeLink[]);
});

const matchedNodeIds = computed(() => {
  const query = searchTerm.value.trim().toLowerCase();
  if (!query) {
    return new Set<string>();
  }

  return new Set(
    nodes.value
      .filter((node) => {
        return `${node.title} ${node.notes} ${categoryMeta[node.category].label}`.toLowerCase().includes(query);
      })
      .map((node) => node.id)
  );
});

const selectedPath = computed(() => {
  const path: KnowledgeNode[] = [];
  let current = selectedNode.value;
  let guard = 0;

  while (current && guard < nodes.value.length + 1) {
    path.unshift(current);
    current = current.parentId ? nodesById.value[current.parentId] : null;
    guard += 1;
  }

  return path;
});

const selectedPathIds = computed(() => new Set(selectedPath.value.map((node) => node.id)));

const selectedDepthLabel = computed(() => `L-${String(Math.max(0, selectedPath.value.length - 1)).padStart(2, '0')}`);

const groupedNodes = computed(() => {
  return categoryOptions
    .map((option) => ({
      category: option.value,
      nodes: nodes.value.filter((node) => node.category === option.value)
    }))
    .filter((group) => group.nodes.length > 0);
});

const graphMetrics = computed(() => {
  const mastered = nodes.value.filter((node) => node.status === 'mastered').length;
  const active = nodes.value.filter((node) => node.status === 'active').length;
  const average = Math.round(nodes.value.reduce((sum, node) => sum + node.level, 0) / Math.max(nodes.value.length, 1));

  return [
    { label: '节点', value: String(nodes.value.length).padStart(2, '0') },
    { label: '实践中', value: String(active).padStart(2, '0') },
    { label: '已掌握', value: String(mastered).padStart(2, '0') },
    { label: '均值', value: `${average}%` }
  ];
});

const stageTransform = computed(() => {
  const { x, y, scale } = viewport.value;
  return `translate(${CANVAS_WIDTH / 2 + x} ${CANVAS_HEIGHT / 2 + y}) scale(${scale})`;
});

const clampScale = (scale: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

const clientToCanvasPoint = (event: PointerEvent | WheelEvent) => {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) {
    return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
  }

  return {
    x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
  };
};

const clientToGraphPoint = (event: PointerEvent | WheelEvent) => {
  const point = clientToCanvasPoint(event);
  return {
    x: (point.x - CANVAS_WIDTH / 2 - viewport.value.x) / viewport.value.scale,
    y: (point.y - CANVAS_HEIGHT / 2 - viewport.value.y) / viewport.value.scale
  };
};

const queuePersist = () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes.value));
    window.localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport.value));
    persistTimer = null;
  }, 140);
};

const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const isKnowledgeNodeArray = (value: unknown): value is KnowledgeNode[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((node) => {
    const candidate = node as Partial<KnowledgeNode>;
    return typeof candidate.id === 'string'
      && typeof candidate.title === 'string'
      && typeof candidate.category === 'string'
      && candidate.category in categoryMeta
      && typeof candidate.status === 'string'
      && candidate.status in statusMeta
      && typeof candidate.level === 'number'
      && typeof candidate.x === 'number'
      && typeof candidate.y === 'number';
  });
};

const loadGraph = () => {
  const storedNodes = safeParse<unknown>(window.localStorage.getItem(STORAGE_KEY), null);
  if (isKnowledgeNodeArray(storedNodes) && storedNodes.some((node) => node.id === ROOT_NODE_ID)) {
    nodes.value = storedNodes;
  }

  const storedViewport = safeParse<Partial<typeof viewport.value>>(
    window.localStorage.getItem(VIEWPORT_STORAGE_KEY),
    {}
  );

  if (
    typeof storedViewport.x === 'number'
    && typeof storedViewport.y === 'number'
    && typeof storedViewport.scale === 'number'
  ) {
    viewport.value = {
      x: storedViewport.x,
      y: storedViewport.y,
      scale: clampScale(storedViewport.scale)
    };
  }

  queuePersist();
};

const updateSelectedNode = <K extends keyof KnowledgeNode>(key: K, value: KnowledgeNode[K]) => {
  const node = selectedNode.value;
  if (!node) {
    return;
  }

  node[key] = value;
  queuePersist();
};

const handleTitleInput = (event: Event) => {
  updateSelectedNode('title', (event.target as HTMLInputElement).value.trimStart());
};

const handleCategoryChange = (event: Event) => {
  updateSelectedNode('category', (event.target as HTMLSelectElement).value as NodeCategory);
};

const handleStatusChange = (event: Event) => {
  updateSelectedNode('status', (event.target as HTMLSelectElement).value as NodeStatus);
};

const handleLevelInput = (event: Event) => {
  updateSelectedNode('level', Number((event.target as HTMLInputElement).value));
};

const handleNotesInput = (event: Event) => {
  updateSelectedNode('notes', (event.target as HTMLTextAreaElement).value);
};

const createNodeId = () => `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const selectNode = (nodeId: string) => {
  if (nodesById.value[nodeId]) {
    selectedNodeId.value = nodeId;
  }
};

const addChildNode = (parentId: string) => {
  const parent = nodesById.value[parentId] || nodesById.value[ROOT_NODE_ID];
  const siblingCount = nodes.value.filter((node) => node.parentId === parent.id).length;
  const angle = ((siblingCount * 48) - 84) * (Math.PI / 180);
  const radius = parent.id === ROOT_NODE_ID ? 250 : 176;
  const nextNode: KnowledgeNode = {
    id: createNodeId(),
    title: `新技能 ${nodes.value.length + 1}`,
    category: parent.category,
    status: 'learning',
    level: 30,
    notes: '',
    x: parent.x + Math.cos(angle) * radius,
    y: parent.y + Math.sin(angle) * radius,
    parentId: parent.id
  };

  nodes.value = [...nodes.value, nextNode];
  selectedNodeId.value = nextNode.id;
  activeView.value = 'graph';
  queuePersist();
  ElMessage.success('已添加知识节点');
};

const addSiblingNode = () => {
  const node = selectedNode.value;
  if (!node || !node.parentId) {
    addChildNode(ROOT_NODE_ID);
    return;
  }

  addChildNode(node.parentId);
};

const collectDescendantIds = (nodeId: string) => {
  const ids = new Set<string>([nodeId]);
  let changed = true;

  while (changed) {
    changed = false;
    nodes.value.forEach((node) => {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    });
  }

  return ids;
};

const deleteNode = async (nodeId: string) => {
  const target = nodesById.value[nodeId];
  if (!target) {
    return;
  }

  if (target.id === ROOT_NODE_ID) {
    ElMessage.warning('根节点用于承载技能书，不能删除');
    return;
  }

  const idsToDelete = collectDescendantIds(target.id);

  try {
    await ElMessageBox.confirm(
      `将删除「${target.title}」及其 ${idsToDelete.size - 1} 个子节点。`,
      '删除知识节点',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    );
  } catch {
    return;
  }

  nodes.value = nodes.value.filter((node) => !idsToDelete.has(node.id));
  selectedNodeId.value = target.parentId || ROOT_NODE_ID;
  queuePersist();
  ElMessage.success('节点已删除');
};

const deleteSelectedNode = () => {
  void deleteNode(selectedNodeId.value);
};

const resetGraph = async () => {
  try {
    await ElMessageBox.confirm('恢复内置技能书示例会覆盖当前图谱。', '重置知识图谱', {
      type: 'warning',
      confirmButtonText: '重置',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }

  nodes.value = defaultNodes();
  selectedNodeId.value = ROOT_NODE_ID;
  resetViewport();
  queuePersist();
  ElMessage.success('知识图谱已重置');
};

const selectFirstMatch = () => {
  const firstId = Array.from(matchedNodeIds.value)[0];
  if (firstId) {
    selectNode(firstId);
  }
};

const resetViewport = () => {
  viewport.value = { x: 0, y: 0, scale: 0.88 };
  queuePersist();
};

const zoomBy = (factor: number, anchor = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }) => {
  const nextScale = clampScale(viewport.value.scale * factor);
  const graphX = (anchor.x - CANVAS_WIDTH / 2 - viewport.value.x) / viewport.value.scale;
  const graphY = (anchor.y - CANVAS_HEIGHT / 2 - viewport.value.y) / viewport.value.scale;

  viewport.value = {
    x: anchor.x - CANVAS_WIDTH / 2 - graphX * nextScale,
    y: anchor.y - CANVAS_HEIGHT / 2 - graphY * nextScale,
    scale: nextScale
  };
  queuePersist();
};

const handleWheel = (event: WheelEvent) => {
  zoomBy(event.deltaY < 0 ? 1.08 : 0.92, clientToCanvasPoint(event));
};

const startCanvasPan = (event: PointerEvent) => {
  const point = clientToCanvasPoint(event);
  dragState.value = {
    mode: 'pan',
    pointerId: event.pointerId,
    lastCanvasX: point.x,
    lastCanvasY: point.y
  };
  canvasRef.value?.setPointerCapture(event.pointerId);
};

const startNodeDrag = (event: PointerEvent, node: KnowledgeNode) => {
  const point = clientToGraphPoint(event);
  selectedNodeId.value = node.id;
  dragState.value = {
    mode: 'node',
    pointerId: event.pointerId,
    nodeId: node.id,
    offsetX: point.x - node.x,
    offsetY: point.y - node.y
  };
  canvasRef.value?.setPointerCapture(event.pointerId);
};

const handleCanvasPointerMove = (event: PointerEvent) => {
  const gesture = dragState.value;
  if (!gesture || gesture.pointerId !== event.pointerId) {
    return;
  }

  if (gesture.mode === 'pan') {
    const point = clientToCanvasPoint(event);
    viewport.value = {
      ...viewport.value,
      x: viewport.value.x + point.x - gesture.lastCanvasX,
      y: viewport.value.y + point.y - gesture.lastCanvasY
    };
    dragState.value = {
      ...gesture,
      lastCanvasX: point.x,
      lastCanvasY: point.y
    };
    queuePersist();
    return;
  }

  const node = nodesById.value[gesture.nodeId];
  if (!node) {
    return;
  }

  const point = clientToGraphPoint(event);
  node.x = point.x - gesture.offsetX;
  node.y = point.y - gesture.offsetY;
  queuePersist();
};

const finishPointerGesture = (event: PointerEvent) => {
  if (dragState.value?.pointerId === event.pointerId) {
    dragState.value = null;
  }

  if (canvasRef.value?.hasPointerCapture(event.pointerId)) {
    canvasRef.value.releasePointerCapture(event.pointerId);
  }
};

const shortLabel = (label: string, maxLength: number) => {
  const chars = Array.from(label || '未命名');
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join('')}...` : chars.join('');
};

const nodeRadius = (node: KnowledgeNode) => {
  if (node.id === ROOT_NODE_ID) {
    return 52;
  }

  return 34 + Math.round(node.level / 16);
};

const edgeColor = (node: KnowledgeNode) => categoryMeta[node.category].color;

watch(nodes, queuePersist, { deep: true });
watch(viewport, queuePersist, { deep: true });

onMounted(() => {
  loadGraph();
});

onUnmounted(() => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
});

defineExpose({
  ROOT_NODE_ID,
  categoryMeta,
  statusMeta
});
</script>

<style scoped lang="scss">
.knowledge-graph-console {
  min-height: calc(100vh - 210px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  color: #edfaff;
}

.graph-command-bar,
.node-inspector,
.graph-stage-panel,
.skill-book-panel {
  border: 1px solid rgba(115, 196, 249, 0.18);
  background: rgba(5, 13, 24, 0.72);
  box-shadow: inset 0 1px 0 rgba(197, 236, 255, 0.06);
}

.graph-command-bar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 14px;
  border-radius: 8px;

  &__title span,
  &__metrics span,
  .view-switch button {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__title span {
    display: block;
    margin-bottom: 3px;
    font-size: 10px;
    color: rgba(142, 204, 238, 0.72);
  }

  &__title h2 {
    margin: 0;
    font-size: 22px;
    line-height: 1.1;
  }

  &__metrics {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.metric-pill {
  min-width: 72px;
  padding: 8px 10px;
  border: 1px solid rgba(126, 210, 255, 0.14);
  border-radius: 8px;
  background: rgba(8, 20, 35, 0.72);

  span {
    display: block;
    margin-bottom: 2px;
    font-size: 9px;
    color: rgba(156, 212, 241, 0.72);
  }

  strong {
    font-size: 14px;
    color: #f3fbff;
  }
}

.view-switch {
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(126, 210, 255, 0.14);
  border-radius: 8px;
  background: rgba(3, 10, 20, 0.72);

  button {
    min-width: 64px;
    border: 0;
    border-radius: 6px;
    padding: 8px 10px;
    background: transparent;
    color: rgba(205, 232, 246, 0.72);
    cursor: pointer;
    transition: color 0.18s ease, background 0.18s ease;

    &.active,
    &:hover {
      background: rgba(105, 183, 255, 0.18);
      color: #ffffff;
    }
  }
}

.graph-layout {
  min-height: 0;
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr);
  gap: 14px;
}

.node-inspector,
.graph-stage-panel,
.skill-book-panel {
  min-height: 0;
  border-radius: 8px;
  overflow: hidden;
}

.node-inspector {
  padding: 16px;
  overflow-y: auto;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  &__eyebrow,
  strong {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__eyebrow {
    display: block;
    margin-bottom: 6px;
    font-size: 10px;
    color: rgba(142, 204, 238, 0.72);
  }

  h3 {
    margin: 0;
    font-size: 18px;
    line-height: 1.2;
    color: #f2fbff;
  }

  strong {
    color: rgba(139, 248, 255, 0.88);
    font-size: 11px;
  }
}

.selected-path {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;

  span {
    max-width: 100%;
    padding: 5px 8px;
    border: 1px solid rgba(139, 248, 255, 0.15);
    border-radius: 6px;
    color: rgba(216, 243, 255, 0.82);
    background: rgba(139, 248, 255, 0.07);
    font-size: 12px;
  }
}

.field {
  display: grid;
  gap: 7px;
  margin-bottom: 12px;

  span {
    font-size: 12px;
    color: rgba(188, 224, 242, 0.78);
  }

  input,
  select,
  textarea {
    width: 100%;
    border: 1px solid rgba(126, 210, 255, 0.16);
    border-radius: 8px;
    padding: 10px 11px;
    background: rgba(3, 10, 20, 0.78);
    color: #edfaff;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;

    &:focus {
      border-color: rgba(139, 248, 255, 0.46);
      box-shadow: 0 0 0 3px rgba(139, 248, 255, 0.08);
    }
  }

  textarea {
    resize: vertical;
    min-height: 92px;
    line-height: 1.55;
  }
}

.field--range {
  grid-template-columns: 1fr auto;
  align-items: center;

  span,
  input {
    grid-column: 1 / -1;
  }

  input {
    accent-color: #69b7ff;
  }

  strong {
    grid-column: 2;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    color: #8bf8ff;
  }
}

.node-actions {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.action-btn,
.canvas-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(126, 210, 255, 0.18);
  border-radius: 8px;
  background: rgba(8, 20, 35, 0.78);
  color: #def7ff;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover:not(:disabled),
  &:focus-visible {
    border-color: rgba(139, 248, 255, 0.42);
    background: rgba(105, 183, 255, 0.16);
    color: #ffffff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.action-btn {
  min-height: 40px;
  padding: 9px 12px;

  &--primary {
    border-color: rgba(105, 183, 255, 0.32);
    background: rgba(37, 99, 235, 0.34);
  }

  &--danger {
    border-color: rgba(255, 143, 112, 0.26);
    color: #ffd2c6;
  }
}

.graph-stage-panel {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.canvas-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid rgba(126, 210, 255, 0.12);
  background: rgba(4, 11, 21, 0.74);

  &__actions {
    display: flex;
    gap: 8px;
  }

  button {
    width: 38px;
    height: 38px;
    padding: 0;
  }
}

.search-box {
  flex: 1;
  min-width: 160px;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 420px;
  border: 1px solid rgba(126, 210, 255, 0.16);
  border-radius: 8px;
  padding: 0 10px;
  background: rgba(3, 10, 20, 0.72);

  svg {
    width: 16px;
    height: 16px;
    color: rgba(139, 248, 255, 0.72);
  }

  input {
    width: 100%;
    min-height: 38px;
    border: 0;
    background: transparent;
    color: #edfaff;
    outline: none;
  }
}

.graph-canvas {
  width: 100%;
  height: 100%;
  min-height: 520px;
  display: block;
  touch-action: none;
  cursor: grab;
  background: #050b14;

  &:active {
    cursor: grabbing;
  }

  &:focus-visible {
    outline: 2px solid rgba(139, 248, 255, 0.55);
    outline-offset: -2px;
  }
}

.canvas-grid {
  opacity: 0.62;
}

.grid-line {
  fill: none;
  stroke: rgba(114, 188, 229, 0.1);
  stroke-width: 1;
}

.edge-layer line {
  stroke-width: 2;
  stroke-opacity: 0.32;
  transition: stroke-opacity 0.18s ease, stroke-width 0.18s ease;

  &.is-selected {
    stroke-opacity: 0.9;
    stroke-width: 3;
  }
}

.graph-node {
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  .node-orbit {
    fill: none;
    stroke-width: 1.2;
    stroke-opacity: 0.24;
    stroke-dasharray: 5 7;
  }

  .node-body {
    stroke-width: 2;
    transition: stroke-width 0.18s ease, fill 0.18s ease;
  }

  &.is-selected {
    .node-body {
      stroke-width: 3.4;
    }

    .node-orbit {
      stroke-opacity: 0.7;
    }
  }

  &.is-match .node-orbit {
    stroke: #ffcf6b;
    stroke-opacity: 0.9;
    stroke-width: 2;
  }

  &.is-related:not(.is-selected) .node-body {
    stroke-width: 2.6;
  }
}

.node-code,
.node-title,
.node-level {
  pointer-events: none;
  user-select: none;
}

.node-code,
.node-level {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  letter-spacing: 0.08em;
}

.node-code {
  fill: rgba(228, 248, 255, 0.82);
  font-size: 10px;
}

.node-title {
  fill: #ffffff;
  font-size: 13px;
  font-weight: 700;
}

.node-level {
  fill: rgba(202, 234, 248, 0.76);
  font-size: 9px;
}

.node-inline-actions {
  opacity: 0;
  transition: opacity 0.18s ease;
}

.graph-node:hover .node-inline-actions,
.graph-node.is-selected .node-inline-actions {
  opacity: 1;
}

.node-action {
  cursor: pointer;

  circle {
    fill: rgba(4, 12, 22, 0.94);
    stroke: rgba(139, 248, 255, 0.48);
    stroke-width: 1.4;
  }

  path {
    stroke: #e9fbff;
    stroke-width: 2;
    stroke-linecap: round;
  }

  &:hover circle {
    fill: rgba(37, 99, 235, 0.8);
  }

  &--delete circle {
    stroke: rgba(255, 143, 112, 0.58);
  }
}

.skill-book-panel {
  padding: 16px;
  overflow-y: auto;
}

.book-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;

  span,
  strong {
    display: block;
  }

  span {
    margin-bottom: 4px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    letter-spacing: 0.12em;
    color: rgba(142, 204, 238, 0.72);
    font-size: 10px;
    text-transform: uppercase;
  }
}

.book-section {
  padding: 14px 0;
  border-top: 1px solid rgba(126, 210, 255, 0.12);

  header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;

    div {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    span {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      box-shadow: 0 0 12px currentColor;
    }

    small {
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      color: rgba(188, 224, 242, 0.62);
      text-transform: uppercase;
    }
  }
}

.book-node-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px;
}

.book-node {
  min-height: 74px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px 10px;
  align-items: center;
  text-align: left;
  border: 1px solid rgba(126, 210, 255, 0.14);
  border-radius: 8px;
  padding: 11px;
  background: rgba(8, 20, 35, 0.64);
  color: #edfaff;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 700;
  }

  strong {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    color: #8bf8ff;
  }

  small {
    grid-column: 1 / -1;
    color: rgba(202, 234, 248, 0.68);
  }

  &:hover,
  &.active {
    border-color: rgba(139, 248, 255, 0.42);
    background: rgba(105, 183, 255, 0.14);
  }
}

@media (max-width: 1120px) {
  .graph-command-bar {
    grid-template-columns: 1fr;
  }

  .graph-layout {
    grid-template-columns: 1fr;
  }

  .node-inspector {
    max-height: none;
  }
}

@media (max-width: 720px) {
  .knowledge-graph-console {
    min-height: auto;
  }

  .graph-command-bar__metrics,
  .canvas-toolbar,
  .book-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .canvas-toolbar__actions {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
  }

  .canvas-toolbar button {
    width: auto;
  }

  .graph-canvas {
    min-height: 460px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-btn,
  .canvas-toolbar button,
  .graph-node .node-body,
  .edge-layer line,
  .node-inline-actions,
  .book-node {
    transition-duration: 0.01ms !important;
  }
}
</style>
