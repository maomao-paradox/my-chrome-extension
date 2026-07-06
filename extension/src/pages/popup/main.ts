/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/pages/popup/main.ts
 * @date 2026-02-05T02:38:01.696Z
 */

import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';
import { createApp } from "vue";
import Popup from './App.vue';
import './styles/themes.css';
import { applyStoredPopupThemeHint } from './composables/usePopupTheme.js';

installGlobalLogger({ title: 'MRIA POPUP', enabled: false });
void syncGlobalLoggerFromStorage();
applyStoredPopupThemeHint();

function mountPopup() {
  const app = createApp(Popup);
  app.mount('#app');
  app.config.errorHandler = (err, vm, info) => {
    console.error('全局错误:', err)
    console.error('组件实例:', vm)
    console.error('错误信息:', info)
  }
}

if (document.readyState === 'complete') {
  maLogger.info('文档加载完成，挂载应用');
  mountPopup();
} else {
  maLogger.info('文档加载未完成，等待DOMContentLoaded事件挂载应用');
  document.addEventListener('DOMContentLoaded', () => {
    mountPopup();
    maLogger.info('应用挂载完成');
    document.removeEventListener('DOMContentLoaded', mountPopup);
  });
};
