/**
 * @file pages/options/views/HeroSection.tsx
 * @description AI 核心链路视图 —— 极简蓝图风格：四个方块节点 + 动态数据流线条
 *
 * 结构（对齐手绘参考流程图）：
 *   [感知] → [计划] → [执行]
 *              ↑        │
 *              │        ↓
 *            [记忆] ←───┘
 *
 * - 节点只保留名称，无额外文字说明
 * - 流线由 SVG 叠加层根据方框真实位置动态计算（ResizeObserver 自适应）
 * - 虚线流动 + 脉冲光点沿路径运动，表现数据流向
 *
 * Props 签名保持不变（PanelNav 契约）。
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOptionsPerformance } from "../composables/useOptionsPerformance";
import SignalGlitchCard from "@/components/SignalGlitchCard";
import TextScramble from "@/components/TextScramble";
import "./hero-section.scss";

/* ══════════════════════════════════════════════════════════════════
 * 类型与常量
 * ══════════════════════════════════════════════════════════════════ */

type NodeId = "perception" | "planning" | "execution" | "memory";
type NodeVariant = "ghost" | "active" | "live";

interface FlowNode {
  id: NodeId;
  label: string;
  variant: NodeVariant;
}

/** 一条流线：路径 d（起点 → 终点即数据流向）+ 箭头三角顶点 */
interface FlowSegment {
  id: string;
  d: string;
  arrow: string;
}

/** 上排 感知→计划→执行，下排 记忆 居中 */
const FLOW_NODES: FlowNode[] = [
  { id: "perception", label: "PEC", variant: "ghost" },
  { id: "planning", label: "PLN", variant: "ghost" },
  { id: "execution", label: "EXC", variant: "active" },
  { id: "memory", label: "MEM", variant: "live" },
];

/** 箭头尖端与方框边缘的留白（px） */
const ARROW_GAP = 10;

/** 脉冲光点沿单条流线运动一圈的周期（s） */
const PULSE_DUR = 2.4;

/** 底部滚动歌词（Song in the bird cage · 英文歌词逐句一行） */
const SCRAMBLE_PHRASES = [
  "Song in the bird cage",
  "Should I sing if I sing",
  "Sky look wind tomorrow",
  "Blow today",
  "Blow today",
  "Morning in the bird",
  "Spend with me",
  "Blow tomorrow",
  "Every single day",
  "It is next to you",
  "Surely come in the morning one day say hello",
  "To expand the hand to",
  "The side of other town",
  "Surely not accustomed divert alone",
  "Come morning everyone laugh again with me",
  "Because anyway every night every night",
  "Sing a song so on in the picture",
  "Sky a look wind tomorrow",
  "Blow to the side of you",
  "Blow today",
  "Morning in the bird",
  "It is next to you",
  "I can sing again like a bird in the sky",
  "I have heard innocent voice",
  "I'll sing out with my girl",
  "Go to the meeting place sing alone rolling stone",
  "Come morning everyone laugh again with me",
  "Surely come in the morning one day say hello",
  "To expand the hand to",
  "The side of other town",
  "Surely not accustomed divert alone",
  "Come morning everyone laugh again With me",
  "Song in the bird cage",
  "Should I sing if I sing",
  "Sky look wind tomorrow",
  "Blow today",
  "Blow today",
  "Morning in the bird",
  "Spend with me",
  "Blow tomorrow",
  "Every single day",
  "It is next to you",
  "I can sing again like a bird in the sky",
  "I have heard innocent voice",
  "I'll sing out with my girl",
  "Go to the meeting place sing alone rolling stone",
  "Come morning everyone laugh again with me",
  "Surely come in the morning one day say hello",
  "To expand the hand to",
  "The side of other town",
  "Surely not accustomed divert alone",
  "Come morning everyone laugh again With me",
];

/** 乱码字符集 */
const SCRAMBLE_CHARS = "!<>-_\\/[]{}?=+*^?#________";

/* ══════════════════════════════════════════════════════════════════
 * 主组件
 * ══════════════════════════════════════════════════════════════════ */

const HeroSection: React.FC = () => {
  /* ── 性能级别（low 时停用脉冲与虚线动画） ── */
  const { performanceLevel } = useOptionsPerformance();
  /* ── 画布 ref + 流线段坐标（随方框真实位置动态计算） ── */
  const flowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = flowRef.current;
    if (!el) return;

    let disposed = false;

    /** 依据四个方框的实时位置计算四条流线（含 L 形回流） */
    const recalc = () => {
      if (disposed) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 160) return;

      const nodeRect = (id: string) =>
        el
          .querySelector<HTMLElement>(`[data-node="${id}"]`)
          ?.getBoundingClientRect();
      const perception = nodeRect("perception");
      const planning = nodeRect("planning");
      const execution = nodeRect("execution");
      const memory = nodeRect("memory");
      if (!perception || !planning || !execution || !memory) return;

      // 屏幕坐标 → 容器坐标
      const left = (r: DOMRect) => r.left - rect.left;
      const top = (r: DOMRect) => r.top - rect.top;
      const centerX = (r: DOMRect) => left(r) + r.width / 2;
      const centerY = (r: DOMRect) => top(r) + r.height / 2;

      const segs: FlowSegment[] = [];

      // 1) 感知 → 计划（水平向右）
      {
        const y = centerY(perception);
        const x1 = left(perception) + perception.width;
        const x2 = left(planning) - ARROW_GAP;
        segs.push({
          id: "perception-planning",
          d: `M ${x1} ${y} L ${x2} ${y}`,
          // 尖端在计划左边缘，指向右
          arrow: `${x2 + ARROW_GAP},${y} ${x2},${y - 5} ${x2},${y + 5}`,
        });
      }

      // 2) 计划 → 执行（水平向右）
      {
        const y = centerY(planning);
        const x1 = left(planning) + planning.width;
        const x2 = left(execution) - ARROW_GAP;
        segs.push({
          id: "planning-execution",
          d: `M ${x1} ${y} L ${x2} ${y}`,
          arrow: `${x2 + ARROW_GAP},${y} ${x2},${y - 5} ${x2},${y + 5}`,
        });
      }

      // 3) 执行 → 记忆（L 形：先垂直向下，再水平向左流入记忆右侧）
      {
        const x = centerX(execution);
        const y1 = top(execution) + execution.height;
        const y2 = centerY(memory);
        const xEnd = left(memory) + memory.width + ARROW_GAP;
        segs.push({
          id: "execution-memory",
          d: `M ${x} ${y1} L ${x} ${y2} L ${xEnd} ${y2}`,
          // 尖端在记忆右边缘，指向左
          arrow: `${xEnd - ARROW_GAP},${y2} ${xEnd},${y2 - 5} ${xEnd},${y2 + 5}`,
        });
      }

      // 4) 记忆 → 计划（垂直向上回注）
      {
        const x = centerX(memory);
        const y1 = top(memory);
        const y2 = top(planning) + planning.height + ARROW_GAP;
        segs.push({
          id: "memory-planning",
          d: `M ${x} ${y1} L ${x} ${y2}`,
          // 尖端在计划下边缘，指向上
          arrow: `${x},${y2 - ARROW_GAP} ${x - 5},${y2} ${x + 5},${y2}`,
        });
      }
    };

    recalc();
    // 首帧字体/布局未稳时轮询校正，2s 后交由 ResizeObserver 接管
    const retryTimer = setInterval(recalc, 120);
    const stopRetry = setTimeout(() => clearInterval(retryTimer), 2000);
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    el.querySelectorAll("[data-node]").forEach((n) => ro.observe(n));
    window.addEventListener("resize", recalc);
    return () => {
      disposed = true;
      clearInterval(retryTimer);
      clearTimeout(stopRetry);
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  /* ── 根节点 className（性能级别用于关闭动画） ── */
  const consoleClass = useMemo(() => {
    const parts = ["ai-core-console"];
    if (performanceLevel === "low") parts.push("is-low-perf");
    else if (performanceLevel === "medium") parts.push("is-medium-perf");
    return parts.join(" ");
  }, [performanceLevel]);

  /* ══════════════════════════════════════════════════════════════════
   * 渲染
   * ══════════════════════════════════════════════════════════════════ */
  return (
    <section className={consoleClass} aria-label="AI 核心链路">
      {/* 顶部 HUD：左侧点阵状态球（点击可反色）+ 右侧信号故障牌 */}
      <div className="ai-console-glitch">
        <SignalGlitchCard text="SIGNAL LOST" />
      </div>

      {/* 底部：Matrix 台词乱码打字机 */}
      <div className="ai-console-ticker">
        <TextScramble
          phrases={SCRAMBLE_PHRASES}
          chars={SCRAMBLE_CHARS}
          speed={800}
        />
      </div>
    </section>
  );
};

export default HeroSection;
