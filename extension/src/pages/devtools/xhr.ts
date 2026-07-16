import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';
import { createApp } from 'vue';
import XHRApp from './xhr.vue';

installGlobalLogger({ title: 'MRIA XHR', enabled: false });
void syncGlobalLoggerFromStorage();

createApp(XHRApp).mount('#app');
