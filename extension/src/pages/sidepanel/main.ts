/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/pages/sidepanel/main.ts
 * @date 2026-02-05T02:38:01.696Z
 */

import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';
import { createApp } from 'vue';
import App from './App.vue';
import { pinia } from '@/stores';
import { useFloatingballStore } from '@/stores/floatingball';

installGlobalLogger({ title: 'MRIA SIDEPANEL', enabled: false });
void syncGlobalLoggerFromStorage();

// 创建Vue应用
const app = createApp(App);

// 使用Pinia
app.use(pinia);

// 获取floatingball store实例
const floatingballStore = useFloatingballStore(pinia);

// 监听侧边栏关闭事件
window.addEventListener('beforeunload', () => {
  // 当侧边栏页面即将关闭时，将侧边栏激活状态设为false
  floatingballStore.toggleSidepanel(false);
});

// 挂载应用到DOM
app.mount('body');

window.onclose = () => {
  maLogger.info('关闭侧边栏');
};
