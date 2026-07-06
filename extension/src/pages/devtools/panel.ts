import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';
import { createApp } from 'vue';
import PanelApp from './panel.vue';

installGlobalLogger({ title: 'MRIA DEVTOOLS PANEL', enabled: false });
void syncGlobalLoggerFromStorage();

createApp(PanelApp).mount('#app');
