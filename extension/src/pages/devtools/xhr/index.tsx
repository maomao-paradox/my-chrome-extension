/**
 * @description XHR 补丁管理入口
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import XhrApp from './App';
import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';

installGlobalLogger({ title: 'MRIA XHR', enabled: false });
void syncGlobalLoggerFromStorage();

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <XhrApp />
    </React.StrictMode>
  );
}
