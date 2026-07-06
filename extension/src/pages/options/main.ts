/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/pages/options/main.ts
 * @date 2026-02-05T02:38:01.695Z
 */

import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';
import { createApp } from 'vue'
import App from './App2.vue'
// import ElementPlus from 'element-plus'
// import 'element-plus/dist/index.css'
import { pinia } from '@/stores';

installGlobalLogger({ title: 'MRIA OPTIONS', enabled: false });
void syncGlobalLoggerFromStorage();

document.addEventListener('DOMContentLoaded', () => {
  const app = createApp(App);
  // app.use(ElementPlus);
  app.use(pinia);
  app.mount('#app');
});
