/**
 * @file src/pages/options/views/BrowserVarView.tsx
 * @description React 版浏览器变量查看器舱段。
 */
import { useState } from 'react';
import BrowserVarInspector from '@/pages/sidepanel/views/BrowserVarInspector';
import './browser-var-view.scss';

const BrowserVarView = () => {
  const [lastUpdate, setLastUpdate] = useState('');

  const saveConfig = () => {
    setLastUpdate('配置已保存');
    window.setTimeout(() => setLastUpdate(''), 3000);
  };

  return (
    <section className="browser-var-view">
      <header className="browser-var-view__header">
        <div>
          <span>Telemetry Lab</span>
          <h2>浏览器变量查看器</h2>
        </div>
        <button type="button" onClick={saveConfig}>保存配置</button>
      </header>

      <div className="browser-var-view__description">
        <p>查看和修改浏览器环境中的变量。输入变量路径，例如 `window.localStorage` 或 `document.cookie`。</p>
        <small>修改系统变量可能影响页面运行，请在确认上下文后操作。</small>
      </div>

      <BrowserVarInspector />

      {lastUpdate ? <div className="browser-var-view__notice">{lastUpdate}</div> : null}
    </section>
  );
};

export default BrowserVarView;
