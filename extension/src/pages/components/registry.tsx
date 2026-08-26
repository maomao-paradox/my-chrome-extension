import React, { type ReactNode } from "react";
import {
  ArrowUpRight,
  Binary,
  Frame,
  Layers3,
  Move,
  Sparkles,
  SquareStack,
  Type,
  Waves,
} from "lucide-react";
import Draggable from "@/assets/components/Draggable";
import QuickLogin from "@/assets/components/QuickLogin/QuickLogin";
import ScrollingTimeline from "@/assets/components/ScrollingTimeline";
import Static404 from "@/assets/components/Static404";
import WavesEffect from "@/assets/components/Waves";

export type ShowcaseKind = "React" | "Vue" | "样式" | "复合";

export interface ShowcaseItem {
  id: string;
  name: string;
  summary: string;
  category: string;
  kind: ShowcaseKind;
  status: "可预览" | "目录";
  path: string;
  tags: string[];
  accent: string;
  icon: ReactNode;
  details: string[];
  preview: ReactNode;
}

const quickLoginUsers = {
  admin: {
    realname: "超级管理员",
    password: "admin123",
    role: "管理员",
    enabled: true,
  },
  editor: {
    realname: "内容编辑",
    password: "editor123",
    role: "编辑",
    enabled: true,
  },
};

const timelineItems = [
  {
    id: "foundation",
    date: "01.10",
    title: "基础结构",
    description: "先把导航、搜索和说明区放稳。",
    meta: "layout",
  },
  {
    id: "preview",
    date: "01.18",
    title: "组件预览",
    description: "把可交互组件接到中间舞台。",
    meta: "demo",
  },
  {
    id: "catalog",
    date: "01.26",
    title: "目录整理",
    description: "补齐文件路径、分类和标签。",
    meta: "catalog",
  },
  {
    id: "release",
    date: "02.02",
    title: "页面发布",
    description: "整理说明后接入构建入口。",
    meta: "ship",
  },
];

const iconWrap = (node: ReactNode) => <span className="showcase-icon">{node}</span>;

export const showcaseItems: ShowcaseItem[] = [
  {
    id: "quick-login",
    name: "QuickLogin",
    summary: "快捷账号切换，下拉即用。",
    category: "表单",
    kind: "React",
    status: "可预览",
    path: "src/assets/components/QuickLogin/QuickLogin.tsx",
    tags: ["登录", "下拉", "高频操作"],
    accent: "cyan",
    icon: iconWrap(<Binary size={18} />),
    details: [
      "适合放在管理后台、调试页和小窗口工具里。",
      "支持受控回调，也能独立触发登录逻辑。",
      "展示时建议传入自定义用户列表。",
    ],
    preview: (
      <QuickLogin
        userList={quickLoginUsers}
        onLogin={(username) => {
          console.info("quick login demo", username);
        }}
      />
    ),
  },
  {
    id: "draggable",
    name: "Draggable",
    summary: "固定定位的拖拽浮层组件。",
    category: "布局",
    kind: "React",
    status: "可预览",
    path: "src/assets/components/Draggable.tsx",
    tags: ["拖拽", "浮层", "吸附"],
    accent: "blue",
    icon: iconWrap(<Move size={18} />),
    details: [
      "组件内部直接操作 transform，拖动反馈比较轻。",
      "适合悬浮按钮、工具球和可移动面板。",
      "预览时会跟随视口移动，这是它本来的行为。",
    ],
    preview: (
      <Draggable
        customClass="showcase-draggable"
        initialPosition="center"
        width={240}
        height={124}
        enableAdsorption
        adsorbMargin={20}
        edgeDistance={42}
      >
        <div className="draggable-demo">
          <span className="demo-chip">Drag me</span>
          <strong>拖拽浮层</strong>
          <p>可拖动、可吸附，适合做全局工具入口。</p>
        </div>
      </Draggable>
    ),
  },
  {
    id: "timeline",
    name: "ScrollingTimeline",
    summary: "横向滚动的时间轴组件。",
    category: "展示",
    kind: "React",
    status: "可预览",
    path: "src/assets/components/ScrollingTimeline.tsx",
    tags: ["时间轴", "键盘", "滚动"],
    accent: "emerald",
    icon: iconWrap(<Layers3 size={18} />),
    details: [
      "支持左右键、Home 和 End。",
      "适合发布记录、阶段路线和任务里程碑。",
      "卡片和节点都可点击切换。",
    ],
    preview: <ScrollingTimeline items={timelineItems} title="组件演进时间轴" />,
  },
  {
    id: "static404",
    name: "Static404",
    summary: "页面缺省状态组件。",
    category: "反馈",
    kind: "React",
    status: "可预览",
    path: "src/assets/components/Static404.tsx",
    tags: ["空状态", "错误页", "兜底"],
    accent: "slate",
    icon: iconWrap(<Frame size={18} />),
    details: [
      "适合作为目录页、详情页和回退页兜底。",
      "可选择性传入返回回调。",
      "视觉上保持轻量，不抢主内容。",
    ],
    preview: <Static404 onGoBack={() => console.info("go back")} />,
  },
  {
    id: "waves",
    name: "Waves",
    summary: "双层波纹背景组件。",
    category: "动效",
    kind: "React",
    status: "可预览",
    path: "src/assets/components/Waves.tsx",
    tags: ["背景", "波纹", "节奏"],
    accent: "violet",
    icon: iconWrap(<Waves size={18} />),
    details: [
      "适合做底层动效，不建议和重信息叠太多。",
      "可以在登录页、宣传页和空白页使用。",
      "当前页面里作为轻量气氛层。",
    ],
    preview: <WavesEffect />,
  },
  {
    id: "mr-button",
    name: "MRButton",
    summary: "通用按钮基元。",
    category: "基础",
    kind: "Vue",
    status: "目录",
    path: "src/assets/components/MRButton.vue",
    tags: ["按钮", "基础", "复用"],
    accent: "amber",
    icon: iconWrap(<SquareStack size={18} />),
    details: [
      "用于统一按钮外观和交互语义。",
      "适合在表单和操作条里重复使用。",
    ],
    preview: <CatalogPreview title="MRButton" text="轻量按钮基元，适合做统一操作口径。" />,
  },
  {
    id: "mr-input",
    name: "MRInput",
    summary: "输入框封装组件。",
    category: "表单",
    kind: "Vue",
    status: "目录",
    path: "src/assets/components/MRInput.vue",
    tags: ["输入", "表单", "校验"],
    accent: "cyan",
    icon: iconWrap(<Type size={18} />),
    details: ["适合承载统一样式、前后缀和校验提示。"],
    preview: <CatalogPreview title="MRInput" text="文本输入封装，适合高频表单场景。" />,
  },
  {
    id: "mr-select",
    name: "MRSelect",
    summary: "选择器封装组件。",
    category: "表单",
    kind: "Vue",
    status: "目录",
    path: "src/assets/components/MRSelect.vue",
    tags: ["选择", "表单", "下拉"],
    accent: "blue",
    icon: iconWrap(<ArrowUpRight size={18} />),
    details: ["适合作为选项集、筛选器和枚举输入。"],
    preview: <CatalogPreview title="MRSelect" text="下拉选择封装，适合统一筛选入口。" />,
  },
  {
    id: "mr-dialog",
    name: "MRDialog",
    summary: "对话框封装组件。",
    category: "反馈",
    kind: "Vue",
    status: "目录",
    path: "src/assets/components/MRDialog.vue",
    tags: ["弹窗", "确认", "交互"],
    accent: "rose",
    icon: iconWrap(<Sparkles size={18} />),
    details: ["适合承载确认、编辑和轻量流程。"],
    preview: <CatalogPreview title="MRDialog" text="通用弹窗封装，适合承载确认流程。" />,
  },
  {
    id: "ma-carousel",
    name: "MACarousel",
    summary: "轮播展示组件。",
    category: "展示",
    kind: "Vue",
    status: "目录",
    path: "src/assets/components/MACarousel.vue",
    tags: ["轮播", "展示", "卡片"],
    accent: "emerald",
    icon: iconWrap(<Layers3 size={18} />),
    details: ["适合图文轮播、特性展示和轮换插图。"],
    preview: <CatalogPreview title="MACarousel" text="内容轮播容器，适合承载展示型卡片。" />,
  },
  {
    id: "tool-grid",
    name: "ToolGrid",
    summary: "工具入口栅格。",
    category: "布局",
    kind: "Vue",
    status: "目录",
    path: "src/assets/components/ToolGrid.vue",
    tags: ["栅格", "工具", "入口"],
    accent: "indigo",
    icon: iconWrap(<SquareStack size={18} />),
    details: ["适合整理多个功能入口，便于快速扫描。"],
    preview: <CatalogPreview title="ToolGrid" text="工具栅格布局，适合门户型入口区域。" />,
  },
];

function CatalogPreview({ title, text }: { title: string; text: string }) {
  return (
    <div className="catalog-preview">
      <div className="catalog-preview__marker" />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
