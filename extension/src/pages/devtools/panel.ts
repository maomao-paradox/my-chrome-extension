/**
 * @description AI 助手 DevTools 面板入口（React 版本）
 */
import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';

installGlobalLogger({ title: 'MRIA DEVTOOLS PANEL', enabled: false });
void syncGlobalLoggerFromStorage();

// 动态导入 React 版本
void import('./panel/index');
