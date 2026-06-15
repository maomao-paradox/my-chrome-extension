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
import { applyStoredPopupThemeHint } from './composables/usePopupTheme';

installGlobalLogger({ title: 'MRIA POPUP', enabled: false });
void syncGlobalLoggerFromStorage();
applyStoredPopupThemeHint();

document.addEventListener('DOMContentLoaded', () => {
  createApp(Popup).mount('#app')
});
