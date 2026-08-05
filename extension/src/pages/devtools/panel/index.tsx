/**
 * @description AI 助手 DevTools 面板入口（React 版本）
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import PanelApp from './App';
import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';

installGlobalLogger({ title: 'MRIA DEVTOOLS PANEL', enabled: false });
void syncGlobalLoggerFromStorage();

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#0e639c',
            colorBgBase: '#1e1e1e',
            colorBgContainer: '#252526',
            colorBgElevated: '#252526',
            colorBorder: '#3e3e42',
            colorText: '#d4d4d4',
            colorTextSecondary: '#9aa0a6',
          },
        }}
      >
        <PanelApp />
      </ConfigProvider>
    </React.StrictMode>
  );
}
