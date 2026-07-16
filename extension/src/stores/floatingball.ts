/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/stores/floatingball.ts
 * @date 2026-02-05T02:38:01.696Z
 */

// stores/floatingball.ts
import { defineStore } from 'pinia';
import { ref, computed, Ref } from 'vue';
import { Tool } from '@/types';
import { storage } from '@/stores';
import { appConfigKey } from '@/config';

// 使用组合式 API 风格（推荐）
export const useFloatingballStore = defineStore('floatingBall', () => {
  // 新增侧边栏相关状态
  const isEnabled = ref(true); // 悬浮球是否启用
  const isSidePanelModeActive = ref(false); // 侧边栏模式是否激活
  const openDialog = ref(false);
  const openDrawer = ref(false);
  const activeTool = ref<Tool | null>(null);
  const clickBehavior = ref<'dialog' | 'sidepanel'>('dialog');

  // getters (计算属性)
  const dialogStat = computed(() => openDialog.value);
  const drawerStat = computed(() => openDrawer.value);
  const enabledStat = computed(() => isEnabled.value);
  const sidePanelModeStat = computed(() => isSidePanelModeActive.value);
  const clickBehaviorStat = computed(() => clickBehavior.value);
  const activeToolStat = computed(() => activeTool.value);

  // actions
  type BoolKeys = 'dialog' | 'drawer'
  const boolMap: Record<BoolKeys, Ref<boolean>> = {
    dialog: openDialog,
    drawer: openDrawer
  };

  // 统一 toggle
  function toggle<K extends BoolKeys>(key: K, forced?: boolean): void {
    const target = boolMap[key];
    // maLogger.info(target)
    target.value = typeof forced === 'boolean' ? forced : !target.value;
  }

  function changeTool(tool: Tool | null) {
    activeTool.value = tool;
  }

  function toggleSidepanel(forced?: boolean) {
    const active = typeof forced === 'boolean' ? forced : !isSidePanelModeActive.value;
    const type = active ? 'OPEN_SIDEPANEL' : 'CLOSE_SIDEPANEL';
    // 开启侧边栏
    chrome.runtime.sendMessage({ type, target: 'background' }, () => {
      if (chrome.runtime.lastError) {
        maLogger.log('侧边栏状态切换失败', chrome.runtime.lastError.message);
      } else {
        maLogger.log('侧边栏状态切换成功');
        isSidePanelModeActive.value = active;
      }
    });
  }

  // 加载配置
  function loadConfig() {
    try {
      storage.ext.local.get(appConfigKey)
        .then((result) => {
          if (result) {
            // 查找悬浮球配置
            const config = result['floatingball'];
            if (config) {
              const behavior = config.type || 'dialog';
              // 同时设置两个行为状态以确保一致性
              setClickBehavior(behavior);
              setEnabled(config.value !== false);
            }
          }
        });
      maLogger.log('悬浮球启用状态:', enabledStat.value, '悬浮球点击行为:', clickBehaviorStat.value);
    } catch (error) {
      maLogger.error('加载配置失败:', error);
    }
  }

  // 设置点击行为
  function setClickBehavior(behavior: 'dialog' | 'sidepanel') {
    clickBehavior.value = behavior;
  }

  // 设置启用状态
  function setEnabled(enabled: boolean) {
    isEnabled.value = enabled;
  }

  return {
    dialogStat,
    drawerStat,
    enabledStat,
    sidePanelModeStat,
    clickBehaviorStat,
    activeToolStat,
    toggle,
    changeTool,
    toggleSidepanel,
    loadConfig,
    setClickBehavior,
    setEnabled
  };
});