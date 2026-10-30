/**
 * @file src/layout/panel-coordinates.ts
 * @description 九宫格面板坐标系的纯函数换算（便于单测）
 *
 * 坐标约定与 STARSHIP_MODULES、小键盘方向保持一致：
 *   x: +1 向右、-1 向左
 *   y: +1 向上、-1 向下
 */

export interface PanelPoint {
  x: number;
  y: number;
}

/**
 * 面板坐标 → 面板自身位移百分比（写入 CSS 变量 --panel-x / --panel-y）
 * 屏幕 y 轴向下，而面板坐标 y 轴向上，因此 y 需要取反。
 */
export const getPanelTransform = ({ x, y }: PanelPoint): PanelPoint => ({
  x: x * 100 || 0,
  y: y * -100 || 0,
});

/**
 * 面板坐标 → 视口（.panel-wrap）位移百分比
 * 视口移动方向与面板方向相反：面板在右，视口就要向左移动。
 */
export const getViewportTransform = ({ x, y }: PanelPoint): PanelPoint => ({
  x: x * -100 || 0,
  y: y * 100 || 0,
});

/**
 * 小键盘数字键 → 面板坐标
 * 布局遵循物理小键盘：7/8/9 在上排，1/2/3 在下排，5 为中央。
 */
export const NUMPAD_PANEL_POSITIONS: Record<string, PanelPoint> = {
  "7": { x: -1, y: 1 },
  "8": { x: 0, y: 1 },
  "9": { x: 1, y: 1 },
  "4": { x: -1, y: 0 },
  "5": { x: 0, y: 0 },
  "6": { x: 1, y: 0 },
  "1": { x: -1, y: -1 },
  "2": { x: 0, y: -1 },
  "3": { x: 1, y: -1 },
};

/**
 * 判断按键事件是否发生在可编辑元素上
 * 用于避免在输入框 / 文本域 / 下拉框中输入数字时误触发面板导航。
 */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof (target as HTMLElement).tagName !== "string") {
    return false;
  }

  const element = target as HTMLElement;
  if (element.isContentEditable) {
    return true;
  }

  const tagName = element.tagName.toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
};
