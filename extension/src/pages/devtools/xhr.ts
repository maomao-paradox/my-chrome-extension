/**
 * @description XHR 补丁管理入口（React 版本）
 */
import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';

installGlobalLogger({ title: 'MRIA XHR', enabled: false });
void syncGlobalLoggerFromStorage();

// 动态导入 React 版本
void import('./xhr/index');
