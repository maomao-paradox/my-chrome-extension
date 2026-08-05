/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/stores/floatingball.ts
 * @date 2026-02-05T02:38:01.696Z
 */

// stores/floatingball.ts
// 已从 Pinia 迁移为 Zustand（框架无关，Vue/React 均可使用）
import { create } from "zustand";
import type { Tool } from "@/types";
import { storage } from "@/stores";
import { appConfigKey } from "@/config";

/**
 * Floatingball 状态管理接口
 * 合并了原 Pinia 的 state + getters + actions
 */
interface FloatingballState {
  // === State（原 ref + computed getter 合并）===
  /** 悬浮球是否启用（原 isEnabled + enabledStat）*/
  isEnabled: boolean;
  /** 侧边栏模式是否激活（原 isSidePanelModeActive + sidePanelModeStat）*/
  isSidePanelModeActive: boolean;
  /** 控制面板是否打开（原 openDialog + dialogStat）*/
  openDialog: boolean;
  /** 工具抽屉是否打开（原 openDrawer + drawerStat）*/
  openDrawer: boolean;
  /** 当前激活的工具（原 activeTool + activeToolStat）*/
  activeTool: Tool | null;
  /** 点击行为：弹窗或侧边栏（原 clickBehavior + clickBehaviorStat）*/
  clickBehavior: "dialog" | "sidepanel";

  // === Actions ===
  /** 统一 toggle：切换 dialog/drawer 的开关状态 */
  toggle: (key: "dialog" | "drawer", forced?: boolean) => void;
  /** 切换当前激活的工具 */
  changeTool: (tool: Tool | null) => void;
  /** 切换侧边栏状态（通过 chrome.runtime 消息）*/
  toggleSidepanel: (forced?: boolean) => void;
  /** 从 storage 加载配置 */
  loadConfig: () => Promise<void>;
  /** 设置点击行为 */
  setClickBehavior: (behavior: "dialog" | "sidepanel") => void;
  /** 设置启用状态 */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Floatingball Zustand store
 * 在 React 中：useFloatingballStore(s => s.openDialog)
 * 在 Vue/非组件中：useFloatingballStore.getState().toggle(...)
 */
export const useFloatingballStore = create<FloatingballState>((set, get) => ({
  // === 初始 State ===
  isEnabled: true,
  isSidePanelModeActive: false,
  openDialog: false,
  openDrawer: false,
  activeTool: null,
  clickBehavior: "dialog",

  // === Actions ===
  toggle: (key, forced) =>
    set((state) => ({
      ...(key === "dialog"
        ? { openDialog: typeof forced === "boolean" ? forced : !state.openDialog }
        : {}),
      ...(key === "drawer"
        ? { openDrawer: typeof forced === "boolean" ? forced : !state.openDrawer }
        : {}),
    })),

  changeTool: (tool) => set({ activeTool: tool }),

  toggleSidepanel: (forced) => {
    const active = typeof forced === "boolean" ? forced : !get().isSidePanelModeActive;
    const type = active ? "OPEN_SIDEPANEL" : "CLOSE_SIDEPANEL";
    // 开启/关闭侧边栏
    chrome.runtime.sendMessage({ type, target: "background" }, () => {
      if (chrome.runtime.lastError) {
        maLogger.log("侧边栏状态切换失败", chrome.runtime.lastError.message);
      } else {
        maLogger.log("侧边栏状态切换成功");
        set({ isSidePanelModeActive: active });
      }
    });
  },

  loadConfig: async () => {
    try {
      const result = await storage.ext.local.get(appConfigKey);
      if (result) {
        // 查找悬浮球配置
        const config = result["floatingball"];
        if (config) {
          const behavior = config.type || "dialog";
          // 同时设置两个行为状态以确保一致性
          set({
            clickBehavior: behavior,
            isEnabled: config.value !== false,
          });
        }
      }
      const state = get();
      maLogger.log("悬浮球启用状态:", state.isEnabled, "悬浮球点击行为:", state.clickBehavior);
    } catch (error) {
      maLogger.error("加载配置失败:", error);
    }
  },

  setClickBehavior: (behavior) => set({ clickBehavior: behavior }),

  setEnabled: (enabled) => set({ isEnabled: enabled }),
}));
