/**
 * @file test/panel-coordinates.spec.ts
 * @description 九宫格面板坐标系换算 + 小键盘键位映射单元测试
 *
 * 覆盖：
 *   1. 面板坐标 → 面板自身位移 / 视口位移，两者必须互相抵消
 *   2. 小键盘 1-9 的坐标与物理键盘布局一致（x+ 右、y+ 上）
 *   3. 可编辑元素判定（避免输入框内误触发导航）
 */

import { describe, expect, it } from "vitest";
import {
  NUMPAD_PANEL_POSITIONS,
  getPanelTransform,
  getViewportTransform,
  isEditableTarget,
  type PanelPoint,
} from "@/layout/panel-coordinates";

/** 九宫格的全部 9 个坐标 */
const GRID_POINTS: PanelPoint[] = [
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];

describe("panel-coordinates —— 视口与面板位移", () => {
  it("面板位移在视口位移的反方向上，二者相加为零（面板正好落到屏幕中央）", () => {
    for (const point of GRID_POINTS) {
      const panel = getPanelTransform(point);
      const viewport = getViewportTransform(point);

      expect(panel.x + viewport.x).toBe(0);
      expect(panel.y + viewport.y).toBe(0);
    }
  });

  it("x 正方向为右：右侧面板自身向右偏移，视口向左偏移", () => {
    const point = { x: 1, y: 0 };

    expect(getPanelTransform(point).x).toBe(100);
    expect(getViewportTransform(point).x).toBe(-100);
  });

  it("y 正方向为上：上方面板自身向上偏移（负值），视口向下偏移", () => {
    const point = { x: 0, y: 1 };

    expect(getPanelTransform(point).y).toBe(-100);
    expect(getViewportTransform(point).y).toBe(100);
  });

  it("中央面板不产生任何位移", () => {
    expect(getPanelTransform({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(getViewportTransform({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("panel-coordinates —— 小键盘映射", () => {
  it("恰好覆盖 1-9 九个数字键", () => {
    expect(Object.keys(NUMPAD_PANEL_POSITIONS).sort()).toEqual(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9"].sort(),
    );
  });

  it("映射结果与物理小键盘布局一致", () => {
    // 上排 7/8/9 —— y 全部为正
    expect(NUMPAD_PANEL_POSITIONS["7"]).toEqual({ x: -1, y: 1 });
    expect(NUMPAD_PANEL_POSITIONS["8"]).toEqual({ x: 0, y: 1 });
    expect(NUMPAD_PANEL_POSITIONS["9"]).toEqual({ x: 1, y: 1 });
    // 中排 4/5/6 —— y 为 0
    expect(NUMPAD_PANEL_POSITIONS["4"]).toEqual({ x: -1, y: 0 });
    expect(NUMPAD_PANEL_POSITIONS["5"]).toEqual({ x: 0, y: 0 });
    expect(NUMPAD_PANEL_POSITIONS["6"]).toEqual({ x: 1, y: 0 });
    // 下排 1/2/3 —— y 全部为负
    expect(NUMPAD_PANEL_POSITIONS["1"]).toEqual({ x: -1, y: -1 });
    expect(NUMPAD_PANEL_POSITIONS["2"]).toEqual({ x: 0, y: -1 });
    expect(NUMPAD_PANEL_POSITIONS["3"]).toEqual({ x: 1, y: -1 });
  });

  it("左侧的三个数字键 x 均为负，右侧的三个数字键 x 均为正", () => {
    const leftKeys = ["7", "4", "1"];
    const rightKeys = ["9", "6", "3"];

    for (const key of leftKeys) {
      expect(NUMPAD_PANEL_POSITIONS[key].x).toBe(-1);
    }
    for (const key of rightKeys) {
      expect(NUMPAD_PANEL_POSITIONS[key].x).toBe(1);
    }
  });

  it("九个数字键映射到九个互不重复的面板坐标", () => {
    const keys = Object.keys(NUMPAD_PANEL_POSITIONS);
    const serialized = new Set(
      keys.map((key) => {
        const { x, y } = NUMPAD_PANEL_POSITIONS[key];
        return `${x},${y}`;
      }),
    );

    expect(serialized.size).toBe(9);
  });
});

describe("panel-coordinates —— 可编辑元素判定", () => {
  it("input / textarea / select 与 contenteditable 被视为可编辑", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");

    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
  });

  it("普通元素与 null 不视为可编辑", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });
});
