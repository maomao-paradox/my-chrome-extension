import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X } from "lucide-react";
import MagneticPointer from "../../components/MagneticPointer";
import NavigationCircle from "../../components/NavigationCircle";
import ScrollingTimeline from "../../components/ScrollingTimeline";
import Static404 from "../../components/Static404";
import Waves from "../../components/Waves";
import JungleKnotButton from "../../components/Jungle-knot/Button";
import FlowerLoading from "../../components/loading/main";
import ChromaticText from "../../components/text";
import { ArknightsButton } from "../../components/Arknights/ArknightsButton";
import { ArknightsCard } from "../../components/Arknights/ArknightsCard";
import { ArknightsProgress } from "../../components/Arknights/ArknightsProgress";
import { ArknightsTag } from "../../components/Arknights/ArknightsTag";
import { JungleCruxButton } from "../../components/Arknights/JungleCruxButton";
import ArknightsModal from "../../components/Arknights/Modal";
import AnimatedSearch from "../../components/special/AnimatedSearch";
import CarouselScene from "../../components/special/CarouselScene";
import InteractiveGradient from "../../components/InteractiveGradient";
import MASwitch from "../../components/switch/main";
import TextScramble, {
  DEFAULT_TEXT_SCRAMBLE_PHRASES,
} from "../../components/TextScramble";
import AnimatedTextFill from "../../components/richtext/AnimatedTextFill";
import MaMarkdown from "../../components/richtext/MaMarkdown";
import RollingText from "../../components/richtext/RollingText";
import Animate403 from "../../components/response-code/Animate403";
import "../../components/switch/style.scss";
import "./app.scss";

interface PropertyInfo {
  name: string;
  type: string;
  description: string;
  options?: string[];
  defaultValue?: string | number | boolean | string[];
  defaultValues?: Record<string, string | number | boolean | string[]>;
}

type EditableValue = string | number | boolean | string[];
type PreviewProps = Record<string, unknown>;
type DetailLayout = "default" | "top-split";

const getPropertyKey = (propertyName: string) =>
  propertyName.split("/")[0].trim().replace(/\s+/g, "");

const getEventHandlerNames = (propertyName: string) =>
  propertyName
    .split("/")
    .map((name) => name.trim())
    .filter((name) => /^on[A-Z]/.test(name));

const canEditProperty = (property: PropertyInfo) => {
  if (getEventHandlerNames(property.name).length > 0) return false;
  const type = property.type.toLowerCase();
  return !(
    type.includes("function") ||
    (type.includes("reactnode") &&
      property.defaultValue === undefined &&
      !property.defaultValues) ||
    (type.includes("[]") &&
      property.defaultValue === undefined &&
      !property.defaultValues) ||
    type.includes("cssproperties") ||
    type.includes("buttonhtmlattributes") ||
    type.includes("...")
  );
};

const getDefaultPropertyValue = (property: PropertyInfo): EditableValue => {
  const key = getPropertyKey(property.name);
  if (property.defaultValues && key in property.defaultValues) {
    return property.defaultValues[key];
  }
  if (property.defaultValue !== undefined) return property.defaultValue;
  return "";
};

const getInitialPropertyValues = (component: ComponentInfo) => {
  const values: Record<string, EditableValue> = {};

  component.properties.forEach((property) => {
    if (!canEditProperty(property)) return;
    if (property.defaultValues) Object.assign(values, property.defaultValues);
    if (property.defaultValue !== undefined) {
      values[getPropertyKey(property.name)] = property.defaultValue;
    }
  });

  return values;
};

const toComponentTagName = (componentName: string) =>
  componentName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const serializeUsageValue = (value: unknown) => {
  if (typeof value === "string") return `"${value.replace(/"/g, '\\"')}"`;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
};

const buildUsageSnippet = (
  component: ComponentInfo,
  values: Record<string, EditableValue>,
) => {
  const tagName = toComponentTagName(component.name);
  const attributes: string[] = [];

  component.properties.forEach((property) => {
    const eventHandlerNames = getEventHandlerNames(property.name);
    if (eventHandlerNames.length > 0) {
      attributes.push(...eventHandlerNames.map((name) => `${name}=""`));
      return;
    }
    if (!canEditProperty(property)) return;
    const propertyKey = getPropertyKey(property.name);
    const defaultValues =
      property.defaultValues ??
      (property.defaultValue !== undefined
        ? { [propertyKey]: property.defaultValue }
        : {});
    const usageKeys = Object.keys(defaultValues).length
      ? Object.keys(defaultValues)
      : [propertyKey];

    usageKeys.forEach((key) => {
      const hasLiveValue = Object.prototype.hasOwnProperty.call(values, key);
      const hasDefaultValue = Object.prototype.hasOwnProperty.call(
        defaultValues,
        key,
      );
      if (!hasLiveValue && !hasDefaultValue) return;
      const currentValue = hasLiveValue ? values[key] : defaultValues[key];
      if (currentValue === undefined || currentValue === null) return;
      if (Array.isArray(currentValue)) {
        attributes.push(`${key}={${JSON.stringify(currentValue)}}`);
        return;
      }
      if (typeof currentValue === "boolean") {
        attributes.push(`${key}={${currentValue}}`);
        return;
      }
      if (typeof currentValue === "number") {
        attributes.push(`${key}={${currentValue}}`);
        return;
      }

      attributes.push(`${key}=${serializeUsageValue(currentValue)}`);
    });
  });

  return `<${tagName}${attributes.length ? ` ${attributes.join(" ")}` : ""} />`;
};

type PreviewKind =
  | "draggable"
  | "magnetic"
  | "navigation"
  | "timeline"
  | "error"
  | "waves"
  | "interactive-gradient"
  | "jungle-button"
  | "flower-loading"
  | "chromatic-text"
  | "text-scramble"
  | "rolling-text"
  | "animated-text-fill"
  | "ma-markdown"
  | "animate-403"
  | "arknights-button"
  | "arknights-card"
  | "arknights-progress"
  | "arknights-tag"
  | "arknights-modal"
  | "jungle-crux-button"
  | "special-search"
  | "special-search-optimized"
  | "special-carousel"
  | "switch";

interface ComponentInfo {
  id: string;
  name: string;
  category: string;
  source: string;
  description: string;
  preview: PreviewKind;
  height: "short" | "medium" | "tall";
  properties: PropertyInfo[];
  wide?: boolean;
  detailLayout?: DetailLayout;
}

const COMPONENTS: ComponentInfo[] = [
  {
    id: "draggable",
    name: "Draggable",
    category: "INTERACTION / DRAG",
    source: "src/components/Draggable.tsx",
    description: "可拖动浮层，支持边缘吸附、拖拽手柄和命令式位置控制。",
    preview: "draggable",
    height: "medium",
    properties: [
      {
        name: "initialX / initialY",
        type: "number",
        description: "初始坐标，默认均为 0。",
        defaultValues: { initialX: 0, initialY: 0 },
      },
      {
        name: "initialPosition",
        type: "InitialPosition",
        description: "预设位置，默认 center。",
        defaultValue: "center",
      },
      {
        name: "enableAdsorption",
        type: "boolean",
        description: "是否启用边缘吸附，默认 false。",
        defaultValue: false,
      },
      {
        name: "edgeDistance / adsorbMargin",
        type: "number",
        description: "边缘检测距离默认 50，吸附边距默认 0。",
        defaultValues: { edgeDistance: 50, adsorbMargin: 0 },
      },
      {
        name: "canOverflow",
        type: "boolean",
        description: "是否允许拖出视口，默认 false。",
        defaultValue: false,
      },
      {
        name: "easeFactor",
        type: "number",
        description: "位置缓动因子，默认 0.2。",
        defaultValue: 0.2,
      },
      {
        name: "dragHandle",
        type: "string",
        description: "允许开始拖动的手柄选择器。",
      },
      {
        name: "width / height",
        type: "number",
        description: "组件尺寸，默认均为 45。",
        defaultValues: { width: 45, height: 45 },
      },
      { name: "children", type: "ReactNode", description: "浮层内部内容。" },
      {
        name: "onDragStart / onDragging / onDragEnd",
        type: "function",
        description: "拖动生命周期回调。",
      },
      {
        name: "onAdsorbed / onMove / onClick",
        type: "function",
        description: "吸附、位置变化和点击回调。",
      },
      {
        name: "ref",
        type: "DraggableHandle",
        description: "读取当前位置，或平滑/立即设置位置。",
      },
    ],
  },
  {
    id: "magnetic-pointer",
    name: "Magnetic Pointer",
    category: "INTERACTION / POINTER",
    source: "src/components/MagneticPointer.tsx",
    description: "跟随鼠标的四角指针，悬停目标时放大并向目标中心产生磁吸效果。",
    preview: "magnetic",
    height: "short",
    properties: [
      {
        name: "color",
        type: "string",
        description: "指针颜色，展示默认值 #99ee79。",
        defaultValue: "#99ee79",
      },
      {
        name: "size",
        type: "string",
        description: "初始宽高，展示默认值 2.5rem。",
        defaultValue: "2.5rem",
      },
      {
        name: "cssSelector",
        type: "string[]",
        description: "磁吸目标选择器，默认 ._target。",
      },
      {
        name: "hideUntilTargetHover",
        type: "boolean",
        description: "为 true 时，只在悬停目标后显示指针。",
        defaultValue: true,
      },
      {
        name: "children",
        type: "ReactNode",
        description: "自定义展示内容；不传时显示演示文案。",
      },
    ],
  },
  {
    id: "navigation-circle",
    name: "Navigation Circle",
    category: "NAVIGATION / ORBIT",
    source: "src/components/NavigationCircle.tsx",
    description: "七节点环形导航，支持悬停预览圆弧、点击选择和进场动画。",
    preview: "navigation",
    height: "tall",
    properties: [],
  },
  {
    id: "scrolling-timeline",
    name: "Scrolling Timeline",
    category: "NAVIGATION / TIMELINE",
    source: "src/components/ScrollingTimeline.tsx",
    description: "可横向浏览的时间轴，支持受控选中、键盘导航和进度反馈。",
    preview: "timeline",
    height: "medium",
    wide: true,
    detailLayout: "top-split",
    properties: [
      {
        name: "items",
        type: "ScrollingTimelineItem[]",
        description: "时间轴节点数据。",
      },
      {
        name: "activeId",
        type: "string",
        description: "受控模式下的当前节点 ID。",
        defaultValue: "launch",
      },
      {
        name: "onActiveIdChange",
        type: "function",
        description: "当前节点变化回调。",
      },
      {
        name: "onSelect",
        type: "function",
        description: "选中节点时回调并传入节点数据。",
      },
      {
        name: "eyebrow / title",
        type: "string",
        description: "时间轴眉题与标题。",
        defaultValues: { eyebrow: "PROJECT LOG", title: "进度时间轴" },
      },
      {
        name: "previousLabel / nextLabel",
        type: "string",
        description: "前后导航按钮的无障碍标签。",
        defaultValues: {
          previousLabel: "查看上一个时间点",
          nextLabel: "查看下一个时间点",
        },
      },
    ],
  },
  {
    id: "static-404",
    name: "Static 404",
    category: "FEEDBACK / ERROR",
    source: "src/components/Static404.tsx",
    description: "轻量 404 占位界面，可选提供返回操作。",
    preview: "error",
    height: "short",
    properties: [
      {
        name: "onGoBack",
        type: "() => void",
        description: "传入后显示“返回首页”按钮。",
      },
    ],
  },
  {
    id: "animate-403",
    name: "Animate 403",
    category: "FEEDBACK / ERROR",
    source: "src/components/response-code/Animate403.tsx",
    description: "逐字输出 HTTP 403 错误信息与访问权限说明的终端告示。",
    preview: "animate-403",
    height: "medium",
    properties: [],
  },
  {
    id: "waves",
    name: "Waves",
    category: "DECORATION / MOTION",
    source: "src/components/Waves.tsx",
    description: "循环滚动的波纹背景，可用作页面或区块的动态底纹。",
    preview: "waves",
    height: "medium",
    properties: [],
  },
  {
    id: "interactive-gradient",
    name: "Interactive Gradient",
    category: "DECORATION / POINTER",
    source: "src/components/InteractiveGradient.tsx",
    description: "多层融合渐变随鼠标移动，支持标题和玻璃内容面板。",
    preview: "interactive-gradient",
    height: "tall",
    properties: [
      { name: "title", type: "ReactNode", description: "卡片上方的标题插槽。" },
      {
        name: "children",
        type: "ReactNode",
        description: "玻璃面板内的内容。",
      },
    ],
  },
  {
    id: "jungle-knot-button",
    name: "Jungle Knot Button",
    category: "JUNGLE-KNOT / BUTTON",
    source: "src/components/Jungle-knot/Button.tsx",
    description: "带有扫描光效和色彩反转反馈的操作按钮。",
    preview: "jungle-button",
    height: "short",
    properties: [
      {
        name: "subTitle",
        type: "string",
        description: "顶部操作标签，展示默认值 KNOT//LINK。",
        defaultValue: "KNOT//LINK",
      },
      {
        name: "mainTitle",
        type: "string",
        description: "主标题，展示默认值 OPEN CHANNEL。",
        defaultValue: "OPEN CHANNEL",
      },
      {
        name: "primaryColor / secondaryColor",
        type: "string",
        description: "按钮的主色与辅助色。",
        defaultValues: { primaryColor: "#e0c75a", secondaryColor: "#13282b" },
      },
      {
        name: "clipPath",
        type: "string",
        description: "顶部标签裁切路径。",
        defaultValue: "inset(0% 0% 75% 0%)",
      },
      {
        name: "children",
        type: "ReactNode",
        description: "自定义主内容，优先于 mainTitle。",
      },
      { name: "onClick", type: "() => void", description: "点击回调。" },
    ],
  },
  {
    id: "flower-loading",
    name: "Flower Loading",
    category: "LOADING / FLOWER",
    source: "src/components/loading/main.tsx",
    description: "旋转花瓣与扫描进度条组成的循环加载动画。",
    preview: "flower-loading",
    height: "medium",
    properties: [
      {
        name: "progressDelay",
        type: "string",
        description: "进度条动画时长，展示默认值 4s。",
        defaultValue: "4s",
      },
    ],
  },
  {
    id: "chromatic-text",
    name: "Chromatic Poster Text",
    category: "TEXT / CHROMATIC",
    source: "src/components/text/index.tsx",
    description: "红蓝错位叠层的海报文字，悬停时色层向字形收拢。",
    preview: "chromatic-text",
    height: "medium",
    detailLayout: "top-split",
    properties: [
      {
        name: "content",
        type: "string",
        description: "要展示的字样，展示默认值 SIGNAL。",
        defaultValue: "SIGNAL",
      },
    ],
  },
  {
    id: "text-scramble",
    name: "Text Scramble",
    category: "TEXT / SCRAMBLE",
    source: "src/components/TextScramble.tsx",
    description: "字符随机扰动后逐步还原为下一句文案，可配置字符集和切换间隔。",
    preview: "text-scramble",
    height: "medium",
    properties: [
      {
        name: "phrases",
        type: "string[]",
        description: "循环展示的文案数组，默认包含 7 条短句。",
        defaultValue: DEFAULT_TEXT_SCRAMBLE_PHRASES,
      },
      {
        name: "chars",
        type: "string",
        description: "随机扰动使用的字符集。",
        defaultValue: "!<>-_\\/[]{}?=+*^?#________",
      },
      {
        name: "speed",
        type: "number",
        description: "每条文案完成后的停留时长，默认 800ms。",
        defaultValue: 800,
      },
    ],
  },
  {
    id: "rolling-text",
    name: "Rolling Text",
    category: "TEXT / ROLLING",
    source: "src/components/richtext/RollingText.tsx",
    description: "字母分层卷入动画，适合标题/品牌词的动态展示。",
    preview: "rolling-text",
    height: "short",
    properties: [
      {
        name: "text",
        type: "string",
        description: "要滚动展示的文案，默认 HELLO。",
        defaultValue: "HELLO",
      },
      {
        name: "href",
        type: "string",
        description: "链接地址，默认 #。",
        defaultValue: "#",
      },
    ],
  },
  {
    id: "animated-text-fill",
    name: "Animated Text Fill",
    category: "TEXT / FILL",
    source: "src/components/richtext/AnimatedTextFill.tsx",
    description: "背景图像裁切到文字中，形成流动渐变填充效果。",
    preview: "animated-text-fill",
    height: "medium",
    properties: [
      {
        name: "text",
        type: "string",
        description: "展示文案，默认 HELLO WORLD。",
        defaultValue: "HELLO WORLD",
      },
      {
        name: "children",
        type: "ReactNode",
        description: "可直接传入自定义内容，优先于 text。",
      },
    ],
  },
  {
    id: "ma-markdown",
    name: "MaMarkdown",
    category: "TEXT / MARKDOWN",
    source: "src/components/richtext/MaMarkdown.tsx",
    description:
      "支持编辑和预览的 Markdown 渲染器，可在 split 模式中同时展示源码和结果。",
    preview: "ma-markdown",
    height: "medium",
    properties: [
      {
        name: "value",
        type: "string",
        description: "Markdown 源文本内容。",
        defaultValue: "# Hello\n\n- one\n- two",
      },
      {
        name: "mode",
        type: "split | preview | edit",
        description: "显示模式，默认 split。",
        defaultValue: "split",
      },
      {
        name: "onInput / onChange",
        type: "function",
        description: "编辑内容时触发的回调。",
      },
    ],
  },
  {
    id: "arknights-button",
    name: "Arknights Button",
    category: "ARKNIGHTS / CONTROL",
    source: "src/components/Arknights/ArknightsButton.tsx",
    description: "PRTS 风格的指令按钮，悬停时切换阵营色高亮。",
    preview: "arknights-button",
    height: "short",
    properties: [
      {
        name: "variant",
        type: "primary | warning | danger | ghost",
        description: "按钮视觉变体，默认 primary。",
        defaultValue: "primary",
      },
      {
        name: "subText",
        type: "string",
        description: "顶部系统标签，默认 PRTS//CMD。",
        defaultValue: "PRTS//CMD",
      },
      { name: "children", type: "ReactNode", description: "按钮主文案。" },
      {
        name: "...buttonProps",
        type: "ButtonHTMLAttributes",
        description: "原生 button 属性与事件。",
      },
    ],
  },
  {
    id: "arknights-card",
    name: "Arknights Card",
    category: "ARKNIGHTS / PANEL",
    source: "src/components/Arknights/ArknightsCard.tsx",
    description: "带 PRTS 标题栏、定位角标和警示斜纹的终端面板。",
    preview: "arknights-card",
    height: "medium",
    properties: [
      {
        name: "title",
        type: "string",
        description: "面板标题，展示默认值 OPERATION。",
        defaultValue: "OPERATION",
      },
      {
        name: "systemCode",
        type: "string",
        description: "右上角系统编号。",
        defaultValue: "// RHODES_ISLAND",
      },
      { name: "children", type: "ReactNode", description: "面板主体内容。" },
      {
        name: "style",
        type: "CSSProperties",
        description: "覆盖面板容器样式。",
      },
    ],
  },
  {
    id: "arknights-progress",
    name: "Arknights Progress",
    category: "ARKNIGHTS / STATUS",
    source: "src/components/Arknights/ArknightsProgress.tsx",
    description: "分段式终端同步进度条，拖动滑块可实时改变进度。",
    preview: "arknights-progress",
    height: "short",
    properties: [
      {
        name: "value",
        type: "number",
        description: "进度百分比，范围 0 到 100。",
        defaultValue: 64,
      },
      {
        name: "segments",
        type: "number",
        description: "进度块数量，默认 16。",
        defaultValue: 16,
      },
      {
        name: "label",
        type: "string",
        description: "进度标签，默认 SYSTEM_SYNC。",
        defaultValue: "SYSTEM_SYNC",
      },
    ],
  },
  {
    id: "arknights-tag",
    name: "Arknights Tag",
    category: "ARKNIGHTS / STATUS",
    source: "src/components/Arknights/ArknightsTag.tsx",
    description: "拥有切角轮廓的状态标签。",
    preview: "arknights-tag",
    height: "short",
    properties: [
      {
        name: "type",
        type: "warning | info | danger",
        description: "标签语义和配色，默认 info。",
        options: ["warning", "info", "danger"],
        defaultValue: "info",
      },
      { name: "children", type: "ReactNode", description: "标签内容。" },
    ],
  },
  {
    id: "arknights-modal",
    name: "Arknights Modal",
    category: "ARKNIGHTS / DIALOG",
    source: "src/components/Arknights/Modal.tsx",
    description: "带警戒标题栏和确认/取消操作的终端对话框。",
    preview: "arknights-modal",
    height: "short",
    properties: [
      {
        name: "isOpen",
        type: "boolean",
        description: "是否显示弹窗。",
        defaultValue: false,
      },
      { name: "onClose", type: "() => void", description: "关闭回调。" },
      {
        name: "onConfirm",
        type: "() => void",
        description: "可选确认回调；提供后显示确认按钮。",
      },
      {
        name: "title / subTitle",
        type: "string",
        description: "标题和系统副标题。",
        defaultValues: { title: "SYSTEM NOTICE", subTitle: "PRTS//PREVIEW" },
      },
      {
        name: "confirmText / cancelText",
        type: "string",
        description: "确认和取消按钮文字。",
        defaultValues: { confirmText: "CONFIRM", cancelText: "CANCEL" },
      },
      { name: "children", type: "ReactNode", description: "弹窗主体内容。" },
    ],
  },
  {
    id: "jungle-crux-button",
    name: "Jungle Crux Button",
    category: "ARKNIGHTS / JUNGLE CRUX",
    source: "src/components/Arknights/JungleCruxButton.tsx",
    description: "荧光边线与斜切造型的扫描操作按钮。",
    preview: "jungle-crux-button",
    height: "short",
    properties: [
      {
        name: "variant",
        type: "green | orange",
        description: "按钮主题色，默认 green。",
        defaultValue: "green",
      },
      {
        name: "subText",
        type: "string",
        description: "顶部识别标签，默认 SPECIMEN//SCAN。",
        defaultValue: "SPECIMEN//SCAN",
      },
      { name: "children", type: "ReactNode", description: "按钮主文案。" },
      {
        name: "...buttonProps",
        type: "ButtonHTMLAttributes",
        description: "原生 button 属性与事件。",
      },
    ],
  },
  {
    id: "special-animated-search",
    name: "Animated Search",
    category: "SPECIAL / SEARCH",
    source: "src/components/special/AnimatedSearch.tsx",
    description: "从折叠搜索图标展开为输入框，支持受控值和 Enter 提交。",
    preview: "special-search",
    height: "short",
    detailLayout: "top-split",
    properties: [
      {
        name: "value / defaultValue",
        type: "string",
        description: "受控值或非受控初始值。",
        defaultValues: { value: "" },
      },
      {
        name: "placeholder / label",
        type: "string",
        description: "输入提示和无障碍名称。",
        defaultValues: { placeholder: "Search", label: "Search" },
      },
      {
        name: "onValueChange",
        type: "(value) => void",
        description: "输入值变化回调。",
      },
      {
        name: "onSubmitQuestion",
        type: "(value) => void",
        description: "按 Enter 提交非空内容。",
      },
    ],
  },
  {
    id: "special-carousel-scene",
    name: "Carousel Scene",
    category: "SPECIAL / 3D CAROUSEL",
    source: "src/components/special/CarouselScene.tsx",
    description: "3D 环形轮播，支持水平/垂直方向、滚轮、触控滑动和键盘切换。",
    preview: "special-carousel",
    height: "tall",
    wide: true,
    properties: [
      {
        name: "cells",
        type: "number | ReactNode[]",
        description: "卡片数量或自定义卡片内容，展示默认值 7。",
        defaultValue: 7,
      },
      {
        name: "orientation",
        type: "horizontal | vertical",
        description: "轮播轴向，默认 horizontal。",
        defaultValue: "horizontal",
      },
      {
        name: "initialIndex",
        type: "number",
        description: "非受控模式初始索引。",
        defaultValue: 0,
      },
      { name: "activeIndex", type: "number", description: "受控当前索引。" },
      {
        name: "onIndexChange",
        type: "(index) => void",
        description: "当前卡片改变时回调。",
      },
      {
        name: "ariaLabel",
        type: "string",
        description: "轮播区域无障碍名称。",
        defaultValue: "Special collection carousel preview",
      },
    ],
  },
  {
    id: "ma-switch",
    name: "MASwitch",
    category: "SWITCH / SCI-FI",
    source: "src/components/switch/main.tsx",
    description: "科幻风格开关，支持受控/非受控值、禁用态和键盘操作。",
    preview: "switch",
    height: "short",
    properties: [
      {
        name: "checked",
        type: "boolean",
        description: "受控开关状态。",
        defaultValue: false,
      },
      {
        name: "defaultChecked",
        type: "boolean",
        description: "非受控初始状态，默认 false。",
      },
      {
        name: "label",
        type: "string",
        description: "开关标签。",
        defaultValue: "NETWORK UPLINK",
      },
      {
        name: "openText / closeText",
        type: "string",
        description: "开启和关闭时显示的状态文字。",
        defaultValues: { openText: "ON", closeText: "OFF" },
      },
      {
        name: "onChange",
        type: "(checked) => void",
        description: "状态变化回调。",
      },
      {
        name: "disabled",
        type: "boolean",
        description: "禁用交互，默认 false。",
        defaultValue: false,
      },
      { name: "className", type: "string", description: "根容器附加类名。" },
      {
        name: "children",
        type: "ReactNode",
        description: "标签下方的附加内容。",
      },
    ],
  },
];

function DraggablePreview() {
  const dragOrigin = useRef<{
    pointerId: number;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = dragOrigin.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    setOffset({
      x: Math.max(-64, Math.min(64, origin.offsetX + event.clientX - origin.x)),
      y: Math.max(-42, Math.min(42, origin.offsetY + event.clientY - origin.y)),
    });
  };

  const handlePointerUp = () => {
    dragOrigin.current = null;
    setDragging(false);
  };

  return (
    <div className="art art--draggable">
      <span className="art-label">FLOAT / 01</span>
      <button
        className={`drag-card${dragging ? " is-dragging" : ""}`}
        type="button"
        aria-label="拖动卡片预览"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) rotate(-5deg)`,
        }}
      >
        <span className="drag-card__grip">•••</span>
        <span className="drag-card__line drag-card__line--wide" />
        <span className="drag-card__line" />
        <span className="drag-card__tag">DRAG</span>
      </button>
      <span className="drag-crosshair" />
    </div>
  );
}

function ErrorPreview() {
  const [returned, setReturned] = useState(false);
  if (returned) return <div className="art art--error-returned">DEMO HOME</div>;
  return (
    <div className="art art--error">
      <Static404 onGoBack={() => setReturned(true)} />
    </div>
  );
}

function MagneticPreview() {
  const targetId = useId();
  return (
    <div className="art art--magnetic">
      <MagneticPointer
        color="#99ee79"
        size="2.5rem"
        cssSelector={[`[data-gallery-target="${targetId}"]`]}
        hideUntilTargetHover
        children={
          <>
            <span
              className="gallery-magnetic-target"
              data-gallery-target={targetId}
            >
              HOVER ME
            </span>
            <small className="magnetic-caption">MAGNETIC TARGET</small>
          </>
        }
      />
    </div>
  );
}

function Preview({
  kind,
  previewProps,
}: {
  kind: PreviewKind;
  previewProps?: PreviewProps;
}) {
  const props = previewProps ?? {};
  switch (kind) {
    case "draggable":
      return <DraggablePreview previewProps={props} />;
    case "magnetic":
      return <MagneticPreview previewProps={props} />;
    case "navigation":
      return (
        <div className="art art--navigation">
          <NavigationCircle />
        </div>
      );
    case "timeline":
      const activeId =
        typeof props.activeId === "string" && props.activeId.trim()
          ? String(props.activeId)
          : undefined;
      return (
        <div className="art art--timeline">
          <ScrollingTimeline
            activeId={activeId}
            eyebrow={String(props.eyebrow ?? "PROJECT LOG")}
            title={String(props.title ?? "进度时间轴")}
            previousLabel={String(props.previousLabel ?? "查看上一个时间点")}
            nextLabel={String(props.nextLabel ?? "查看下一个时间点")}
          />
        </div>
      );

    case "error":
      return <ErrorPreview previewProps={props} />;
    case "animate-403":
      return (
        <div className="art art--animate-403">
          <Animate403 />
        </div>
      );
    case "waves":
      return (
        <div className="art art--waves">
          <Waves />
        </div>
      );
    case "interactive-gradient":
      return (
        <div className="art art--interactive-gradient">
          <InteractiveGradient
            title={
              <span className="interactive-gradient-demo__label">
                FIELD NOTES / 01
              </span>
            }
          >
            <div className="interactive-gradient-demo__content">
              <span>MOTION STUDY</span>
              <h1>Color in motion.</h1>
              <p>Move your cursor through the light.</p>
            </div>
          </InteractiveGradient>
        </div>
      );

    case "jungle-button":
      return <JungleKnotPreview previewProps={props} />;
    case "flower-loading":
      return (
        <div className="art art--loading">
          <FlowerLoading progressDelay={String(props.progressDelay ?? "4s")} />
        </div>
      );
    case "chromatic-text":
      return (
        <div className="art art--chromatic">
          <ChromaticText content={String(props.content ?? "SIGNAL")} />
        </div>
      );

    case "text-scramble":
      return (
        <div className="art art--text-scramble">
          <TextScramble
            phrases={
              Array.isArray(props.phrases)
                ? props.phrases.filter(
                    (phrase): phrase is string => typeof phrase === "string",
                  )
                : undefined
            }
            chars={String(props.chars ?? "!<>-_\\/[]{}?=+*^?#________")}
            speed={Number(props.speed ?? 800)}
          />
        </div>
      );

    case "rolling-text":
      return (
        <div className="art art--rolling-text">
          <RollingText
            text={String(props.text ?? "HELLO")}
            href={String(props.href ?? "#")}
          />
        </div>
      );
    case "animated-text-fill":
      return (
        <div className="art art--animated-text-fill">
          <AnimatedTextFill text={String(props.text ?? "HELLO WORLD")} />
        </div>
      );

    case "ma-markdown":
      return (
        <div className="art art--ma-markdown">
          <MaMarkdown
            value={String(props.value ?? "# Hello\n\n- one\n- two")}
            mode={
              String(props.mode ?? "preview") as "split" | "preview" | "edit"
            }
          />
        </div>
      );

    case "arknights-button":
      return <ArknightsButtonPreview previewProps={props} />;
    case "arknights-card":
      return <ArknightsCardPreview previewProps={props} />;
    case "arknights-progress":
      return <ArknightsProgressPreview previewProps={props} />;

    case "arknights-tag":
      return <ArknightsTagPreview previewProps={props} />;
    case "arknights-modal":
      return <ArknightsModalPreview previewProps={props} />;
    case "special-search":
      return <SpecialSearchPreview previewProps={props} />;
    case "special-search-optimized":
      return <SpecialSearchOptimizedPreview previewProps={props} />;
    case "special-carousel":
      return (
        <div className="art art--special-carousel">
          <CarouselScene
            cells={Number(props.cells ?? 7)}
            orientation={
              String(props.orientation ?? "horizontal") as
                | "horizontal"
                | "vertical"
            }
            initialIndex={Number(props.initialIndex ?? 0)}
            ariaLabel={String(
              props.ariaLabel ?? "Special collection carousel preview",
            )}
          />
        </div>
      );
    case "switch":
      return <SwitchPreview previewProps={props} />;
    default:
      return <JungleCruxPreview previewProps={props} />;
  }
}

function SwitchPreview({ previewProps }: { previewProps?: PreviewProps }) {
  const [checked, setChecked] = useState(
    Boolean(previewProps?.checked ?? false),
  );

  useEffect(() => {
    setChecked(Boolean(previewProps?.checked ?? false));
  }, [previewProps]);

  return (
    <div
      className="art art--switch"
      style={
        {
          "--popup-switch-active-border": "#00e5ff",
          "--popup-switch-active-bg":
            "linear-gradient(135deg, #002244 0%, #004466 100%)",
          "--popup-switch-active-thumb-bg":
            "linear-gradient(135deg, #00aacc 0%, #00f0ff 100%)",
          "--popup-inset-highlight": "inset 0 0 5px rgba(0, 68, 102, .5)",
          "--popup-text-on-accent": "#00f0ff",
        } as React.CSSProperties
      }
    >
      <MASwitch
        label={String(previewProps?.label ?? "NETWORK UPLINK")}
        checked={checked}
        openText={String(previewProps?.openText ?? "ON")}
        closeText={String(previewProps?.closeText ?? "OFF")}
        disabled={Boolean(previewProps?.disabled ?? false)}
        onChange={setChecked}
      />
      <MASwitch
        label={String(previewProps?.label ?? "SECURE MODE")}
        defaultChecked
        disabled
        openText="LOCK"
        closeText="OFF"
      />
    </div>
  );
}

function SpecialSearchPreview({
  previewProps,
}: {
  previewProps?: PreviewProps;
}) {
  const [submitted, setSubmitted] = useState("");
  const [value, setValue] = useState(String(previewProps?.value ?? ""));

  useEffect(() => {
    if (previewProps?.value !== undefined) setValue(String(previewProps.value));
  }, [previewProps]);

  return (
    <div className="art art--special-search">
      <AnimatedSearch
        value={value || undefined}
        placeholder={String(previewProps?.placeholder ?? "Search")}
        label={String(previewProps?.label ?? "Search")}
        onValueChange={setValue}
        onSubmitQuestion={setSubmitted}
      />
      {submitted && (
        <span className="special-search-feedback">SUBMITTED: {submitted}</span>
      )}
    </div>
  );
}

function SpecialSearchOptimizedPreview({
  previewProps,
}: {
  previewProps?: PreviewProps;
}) {
  const [submitted, setSubmitted] = useState("");
  const [value, setValue] = useState(String(previewProps?.value ?? ""));

  useEffect(() => {
    if (previewProps?.value !== undefined) setValue(String(previewProps.value));
  }, [previewProps]);

  return (
    <div className="art art--special-search">
      <AnimatedSearchOptimized
        value={value || undefined}
        placeholder={String(previewProps?.placeholder ?? "Search")}
        label={String(previewProps?.label ?? "Search")}
        onValueChange={setValue}
        onSubmitQuestion={setSubmitted}
      />
      {submitted && (
        <span className="special-search-feedback">SUBMITTED: {submitted}</span>
      )}
    </div>
  );
}

function JungleKnotPreview({ previewProps }: { previewProps?: PreviewProps }) {
  const [activated, setActivated] = useState(
    Boolean(previewProps?.activated ?? false),
  );

  useEffect(() => {
    setActivated(Boolean(previewProps?.activated ?? false));
  }, [previewProps]);

  return (
    <div className="art art--jungle-knot">
      <JungleKnotButton
        subTitle={String(previewProps?.subTitle ?? "KNOT//LINK")}
        mainTitle={
          activated
            ? String(previewProps?.mainTitle ?? "SIGNAL SENT")
            : String(previewProps?.mainTitle ?? "OPEN CHANNEL")
        }
        primaryColor={String(previewProps?.primaryColor ?? "#e0c75a")}
        secondaryColor={String(previewProps?.secondaryColor ?? "#13282b")}
        clipPath={String(previewProps?.clipPath ?? "inset(0% 0% 75% 0%)")}
        onClick={() => setActivated((value) => !value)}
      />
    </div>
  );
}

function ArknightsButtonPreview({
  previewProps,
}: {
  previewProps?: PreviewProps;
}) {
  const [executed, setExecuted] = useState(false);
  return (
    <div className="art art--arknights-button">
      <ArknightsButton
        variant={
          String(previewProps?.variant ?? "primary") as
            | "primary"
            | "warning"
            | "danger"
            | "ghost"
        }
        subText={String(previewProps?.subText ?? "PRTS//CMD")}
        onClick={() => setExecuted((value) => !value)}
      >
        {executed
          ? String(previewProps?.children ?? "COMMAND SENT")
          : String(previewProps?.children ?? "DEPLOY UNIT")}
      </ArknightsButton>
    </div>
  );
}

function ArknightsCardPreview({
  previewProps,
}: {
  previewProps?: PreviewProps;
}) {
  return (
    <div className="art art--arknights-card">
      <ArknightsCard
        title={String(previewProps?.title ?? "OPERATION")}
        systemCode={String(previewProps?.systemCode ?? "// RHODES_ISLAND")}
      >
        <div className="ark-card-demo">
          <ArknightsTag
            type={
              String(previewProps?.tagType ?? "warning") as
                | "warning"
                | "info"
                | "danger"
            }
          >
            HIGH RISK
          </ArknightsTag>
          <ArknightsProgress
            value={Number(previewProps?.value ?? 68)}
            label={String(previewProps?.label ?? "MISSION SYNC")}
          />
          <ArknightsButton variant="ghost">VIEW DETAILS</ArknightsButton>
        </div>
      </ArknightsCard>
    </div>
  );
}

function ArknightsProgressPreview({
  previewProps,
}: {
  previewProps?: PreviewProps;
}) {
  const [value, setValue] = useState(Number(previewProps?.value ?? 64));

  useEffect(() => {
    if (previewProps?.value !== undefined) setValue(Number(previewProps.value));
  }, [previewProps]);

  return (
    <div className="art art--arknights-progress">
      <label className="progress-control">
        <span>DRAG TO ADJUST</span>
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          aria-label="调整 Arknights 进度预览"
          onChange={(event) => setValue(Number(event.currentTarget.value))}
        />
      </label>
      <ArknightsProgress
        value={value}
        segments={Number(previewProps?.segments ?? 16)}
        label={String(previewProps?.label ?? "SYSTEM_SYNC")}
      />
    </div>
  );
}

function ArknightsTagPreview({
  previewProps,
}: {
  previewProps?: PreviewProps;
}) {
  const [type, setType] = useState<"warning" | "info" | "danger">(
    String(previewProps?.type ?? "info") as "warning" | "info" | "danger",
  );
  const nextType = {
    info: "warning",
    warning: "danger",
    danger: "info",
  } as const;

  useEffect(() => {
    if (previewProps?.type !== undefined)
      setType(String(previewProps.type) as "warning" | "info" | "danger");
  }, [previewProps]);

  return (
    <div className="art art--arknights-tag">
      <button type="button" onClick={() => setType(nextType[type])}>
        <ArknightsTag type={type}>{type.toUpperCase()} / CLICK</ArknightsTag>
      </button>
    </div>
  );
}

function ArknightsModalPreview({
  previewProps,
}: {
  previewProps?: PreviewProps;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (previewProps?.isOpen !== undefined) {
      setIsOpen(Boolean(previewProps.isOpen));
    }
  }, [previewProps]);

  return (
    <div className="art art--arknights-modal">
      <ArknightsButton
        variant={
          String(previewProps?.variant ?? "warning") as
            | "primary"
            | "warning"
            | "danger"
            | "ghost"
        }
        onClick={() => setIsOpen(true)}
      >
        OPEN SYSTEM NOTICE
      </ArknightsButton>
      <ArknightsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={() => setIsOpen(false)}
        title={String(previewProps?.title ?? "SYSTEM NOTICE")}
        subTitle={String(previewProps?.subTitle ?? "PRTS//PREVIEW")}
        confirmText={String(previewProps?.confirmText ?? "CONFIRM")}
        cancelText={String(previewProps?.cancelText ?? "CANCEL")}
      >
        Preview confirmation dialog.
      </ArknightsModal>
    </div>
  );
}

function JungleCruxPreview({ previewProps }: { previewProps?: PreviewProps }) {
  const [scanned, setScanned] = useState(
    Boolean(previewProps?.scanned ?? false),
  );

  useEffect(() => {
    setScanned(Boolean(previewProps?.scanned ?? false));
  }, [previewProps]);

  return (
    <div className="art art--jungle-crux">
      <JungleCruxButton
        variant={String(previewProps?.variant ?? "green") as "green" | "orange"}
        subText={String(previewProps?.subText ?? "SPECIMEN//SCAN")}
        onClick={() => setScanned((value) => !value)}
      >
        {scanned ? "SCAN COMPLETE" : "SCAN SPECIMEN"}
      </JungleCruxButton>
    </div>
  );
}

function App() {
  const [selected, setSelected] = useState<ComponentInfo | null>(null);
  const [liveValues, setLiveValues] = useState<Record<string, EditableValue>>(
    {},
  );
  const [editedValues, setEditedValues] = useState<
    Record<string, EditableValue>
  >({});

  useEffect(() => {
    if (!selected) return;
    setLiveValues(getInitialPropertyValues(selected));
    setEditedValues({});
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selected]);

  const updatePropertyValue = (propertyName: string, value: EditableValue) => {
    setLiveValues((previous) => ({ ...previous, [propertyName]: value }));
    setEditedValues((previous) => ({ ...previous, [propertyName]: value }));
  };

  const copyUsage = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(
      buildUsageSnippet(selected, liveValues),
    );
  };

  const usageSnippet = selected ? buildUsageSnippet(selected, liveValues) : "";

  return (
    <main className="component-wall-page">
      <div className="component-wall" aria-label="React 组件照片墙">
        {COMPONENTS.map((component) => (
          <article
            className={`component-tile component-tile--${component.height}`}
            key={component.id}
            data-component-id={component.id}
          >
            <div className="component-tile__art">
              <Preview kind={component.preview} />
            </div>
            <div className="component-tile__caption">
              <span className="component-tile__category">
                {component.category}
              </span>
              <button
                className="component-tile__name"
                type="button"
                aria-haspopup="dialog"
                onClick={() => setSelected(component)}
              >
                {component.name}
              </button>
              <span className="component-tile__description">
                {component.description}
              </span>
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <div className="dialog-backdrop" onClick={() => setSelected(null)}>
          <section
            className={`component-dialog${selected.wide ? " component-dialog--wide" : ""}${selected.detailLayout === "top-split" ? " component-dialog--top-split" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="component-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="关闭组件详情"
              onClick={() => setSelected(null)}
            >
              <X size={19} strokeWidth={1.8} />
            </button>
            <div
              className={`dialog-preview${selected.wide ? " dialog-preview--wide" : ""}`}
            >
              <Preview kind={selected.preview} previewProps={editedValues} />
            </div>

            {selected.detailLayout === "top-split" ? (
              <div className="dialog-content dialog-content--top-split">
                <div className="dialog-content__body dialog-content__body--top-split">
                  <div className="dialog-main-info">
                    <span className="dialog-category">{selected.category}</span>
                    <h1 id="component-dialog-title">{selected.name}</h1>
                    <p className="dialog-description">{selected.description}</p>
                    <p className="dialog-source">{selected.source}</p>
                    <div className="dialog-usage-box">
                      <div className="dialog-usage-box__header">
                        <span>组件用法</span>
                        <button
                          className="dialog-copy-button dialog-copy-button--inline"
                          type="button"
                          onClick={copyUsage}
                        >
                          复制组件用法
                        </button>
                      </div>
                      <code>{usageSnippet || "<Component />"}</code>
                    </div>
                  </div>

                  <div className="dialog-properties">
                    <h2>属性</h2>
                    <div className="dialog-properties__scroll">
                      {selected.properties.length ? (
                        <dl>
                          {selected.properties.map((property) => {
                            if (!canEditProperty(property)) {
                              return (
                                <div
                                  className="property-row"
                                  key={property.name}
                                >
                                  <div className="property-info">
                                    <dt>{property.name}</dt>
                                    <dd className="property-description">
                                      {property.description}
                                    </dd>
                                  </div>
                                  <dd
                                    className="property-editor property-editor--empty"
                                    aria-hidden="true"
                                  />
                                  <dd className="property-type">
                                    {property.type}
                                  </dd>
                                </div>
                              );
                            }
                            const propertyKey = getPropertyKey(property.name);
                            const currentValue =
                              liveValues[propertyKey] ??
                              getDefaultPropertyValue(property);
                            const isBoolean = property.type
                              .toLowerCase()
                              .includes("boolean");
                            const isNumber = property.type
                              .toLowerCase()
                              .includes("number");

                            return (
                              <div className="property-row" key={property.name}>
                                <div className="property-info">
                                  <dt>{property.name}</dt>
                                  <dd className="property-description">
                                    {property.description}
                                  </dd>
                                </div>
                                <dd className="property-editor">
                                  {isBoolean ? (
                                    <label className="property-checkbox">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(currentValue)}
                                        onChange={(event) =>
                                          updatePropertyValue(
                                            propertyKey,
                                            event.target.checked,
                                          )
                                        }
                                      />
                                      <span>{String(currentValue)}</span>
                                    </label>
                                  ) : isNumber ? (
                                    <input
                                      type="number"
                                      value={
                                        currentValue === ""
                                          ? ""
                                          : Number(currentValue)
                                      }
                                      onChange={(event) =>
                                        updatePropertyValue(
                                          propertyKey,
                                          Number(event.target.value),
                                        )
                                      }
                                    />
                                  ) : Array.isArray(currentValue) ? (
                                    <textarea
                                      rows={5}
                                      value={currentValue.join("\n")}
                                      onChange={(event) =>
                                        updatePropertyValue(
                                          propertyKey,
                                          event.target.value.split(/\r?\n/),
                                        )
                                      }
                                    />
                                  ) : property.options?.length ? (
                                    <select
                                      value={String(currentValue)}
                                      onChange={(event) =>
                                        updatePropertyValue(
                                          propertyKey,
                                          event.target.value,
                                        )
                                      }
                                    >
                                      {property.options.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={String(currentValue ?? "")}
                                      onChange={(event) =>
                                        updatePropertyValue(
                                          propertyKey,
                                          event.target.value,
                                        )
                                      }
                                    />
                                  )}
                                </dd>
                                <dd className="property-type">
                                  {property.type}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      ) : (
                        <p className="dialog-empty">此组件没有公开属性。</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dialog-content">
                <div className="dialog-content__header">
                  <span className="dialog-category">{selected.category}</span>
                  <h1 id="component-dialog-title">{selected.name}</h1>
                  <p className="dialog-description">{selected.description}</p>
                  <div className="dialog-usage-box">
                    <div className="dialog-usage-box__header">
                      <span>组件用法</span>
                      <button
                        className="dialog-copy-button dialog-copy-button--inline"
                        type="button"
                        onClick={copyUsage}
                      >
                        复制组件用法
                      </button>
                    </div>
                    <code>{usageSnippet || "<Component />"}</code>
                  </div>
                  <p className="dialog-source">{selected.source}</p>
                </div>

                <div className="dialog-properties">
                  <h2>属性</h2>
                  <div className="dialog-properties__scroll">
                    {selected.properties.length ? (
                      <dl>
                        {selected.properties.map((property) => {
                          if (!canEditProperty(property)) {
                            return (
                              <div className="property-row" key={property.name}>
                                <dt>{property.name}</dt>
                                <dd className="property-type">
                                  {property.type}
                                </dd>
                                <dd className="property-description">
                                  {property.description}
                                </dd>
                              </div>
                            );
                          }
                          const propertyKey = getPropertyKey(property.name);
                          const currentValue =
                            liveValues[propertyKey] ??
                            getDefaultPropertyValue(property);
                          const isBoolean = property.type
                            .toLowerCase()
                            .includes("boolean");
                          const isNumber = property.type
                            .toLowerCase()
                            .includes("number");

                          return (
                            <div className="property-row" key={property.name}>
                              <div className="property-info">
                                <dt>{property.name}</dt>
                                <dd className="property-description">
                                  {property.description}
                                </dd>
                              </div>
                              <dd className="property-editor">
                                {isBoolean ? (
                                  <label className="property-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(currentValue)}
                                      onChange={(event) =>
                                        updatePropertyValue(
                                          propertyKey,
                                          event.target.checked,
                                        )
                                      }
                                    />
                                    <span>{String(currentValue)}</span>
                                  </label>
                                ) : isNumber ? (
                                  <input
                                    type="number"
                                    value={
                                      currentValue === ""
                                        ? ""
                                        : Number(currentValue)
                                    }
                                    onChange={(event) =>
                                      updatePropertyValue(
                                        propertyKey,
                                        Number(event.target.value),
                                      )
                                    }
                                  />
                                ) : Array.isArray(currentValue) ? (
                                  <textarea
                                    rows={5}
                                    value={currentValue.join("\n")}
                                    onChange={(event) =>
                                      updatePropertyValue(
                                        propertyKey,
                                        event.target.value.split(/\r?\n/),
                                      )
                                    }
                                  />
                                ) : property.options?.length ? (
                                  <select
                                    value={String(currentValue)}
                                    onChange={(event) =>
                                      updatePropertyValue(
                                        propertyKey,
                                        event.target.value,
                                      )
                                    }
                                  >
                                    {property.options.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={String(currentValue ?? "")}
                                    onChange={(event) =>
                                      updatePropertyValue(
                                        propertyKey,
                                        event.target.value,
                                      )
                                    }
                                  />
                                )}
                              </dd>
                              <dd className="property-type">{property.type}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    ) : (
                      <p className="dialog-empty">此组件没有公开属性。</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
