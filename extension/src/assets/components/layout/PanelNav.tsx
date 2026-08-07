/**
 * @file src/assets/components/layout/PanelNav.tsx
 * @description React 版 Options 星舰面板导航。
 */
import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import TacticalOverview from '@/pages/options/views/TacticalOverview';
import {
  STARSHIP_MODULES,
  STARSHIP_STATUS_TEXT,
  STARSHIP_STATUS_TINT,
  type StarshipPanelId,
} from '@/pages/options/views/starshipModules';
import { useStarshipTelemetry } from './useStarshipTelemetry';
import BrowserVarView from '@/pages/options/views/BrowserVarView';

type Direction = 'top' | 'right' | 'bottom' | 'left';

const DIRECTION_OFFSETS: Record<Direction, { x: number; y: number }> = {
  top: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
};

const reactPanelMap: Partial<Record<StarshipPanelId, ComponentType>> = {
  'top-right': BrowserVarView,
};

const ReactModulePlaceholder = ({ panelKey }: { panelKey: StarshipPanelId }) => {
  const module = STARSHIP_MODULES.find((item) => item.id === panelKey) ?? STARSHIP_MODULES[0];

  return (
    <section className="react-module-placeholder">
      <span>{module.glyph}</span>
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      <small>该舱段的 Vue 业务面板待迁移为 React 组件。</small>
    </section>
  );
};

const PanelNav = () => {
  const [activePanelKey, setActivePanelKey] = useState<StarshipPanelId>('main');
  const [showOverview, setShowOverview] = useState(false);
  const modules = useStarshipTelemetry();

  const activeModule = modules.find((module) => module.id === activePanelKey) ?? modules[0];
  const peripheralModules = modules.filter((module) => module.id !== 'main');
  const gridModules = [...peripheralModules].sort((a, b) => b.position.y - a.position.y || a.position.x - b.position.x);
  const ActivePanelComponent = reactPanelMap[activePanelKey];

  const focusPanel = (panelKey: StarshipPanelId) => {
    setActivePanelKey(panelKey);
    setShowOverview(false);
  };

  const navigate = (direction: Direction) => {
    const current = STARSHIP_MODULES.find((module) => module.id === activePanelKey);
    const offset = DIRECTION_OFFSETS[direction];

    if (!current) {
      return;
    }

    const next = STARSHIP_MODULES.find((module) => {
      return module.position.x === current.position.x + offset.x && module.position.y === current.position.y + offset.y;
    });

    if (next) {
      focusPanel(next.id);
    }
  };

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (showOverview && event.key === 'Escape') {
        setShowOverview(false);
        return;
      }

      if ((event.key === 'o' || event.key === 'O') && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setShowOverview(true);
        return;
      }

      if (showOverview) {
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        navigate('top');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigate('right');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        navigate('bottom');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate('left');
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [activePanelKey, showOverview]);

  return (
    <div className="panel-nav-shell">
      {showOverview ? (
        <TacticalOverview
          modules={modules}
          activePanelKey={activePanelKey}
          onClose={() => setShowOverview(false)}
          onSelectPanel={focusPanel}
        />
      ) : null}

      <div className={`options-shell ${showOverview ? 'blur-active' : ''}`}>
        <div className="options-scanlines" aria-hidden="true" />
        <header className="options-bridge-header">
          <div>
            <p className="options-eyebrow">Command Bridge / React PanelNav</p>
            <h1>星舰指挥中心</h1>
            <p>React 版 PanelNav 已接管模块导航、总览弹层、键盘方向键和遥测摘要。业务舱段将继续逐个迁移。</p>
          </div>
          <div className="options-status">
            <span>{activeModule.code}</span>
            <strong>{activeModule.title}</strong>
            <small>{STARSHIP_STATUS_TEXT[activeModule.telemetry.status]} / {activeModule.telemetry.metric}</small>
          </div>
        </header>

        <section className="options-command-grid" aria-label="Options 模块导航">
          <aside className="options-panel options-panel--status">
            <div className="options-panel__heading">
              <span>CORE STATUS</span>
              <strong>{activeModule.telemetry.metric}</strong>
            </div>
            <div className="options-metrics">
              {['React PanelNav', 'Module Map', 'Storage Sync'].map((label, index) => (
                <div className="options-metric" key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{index === 0 ? 'READY' : index === 1 ? `${peripheralModules.length} MOD` : 'LIVE'}</strong>
                  </div>
                  <i style={{ width: `${88 - index * 12}%` }} />
                </div>
              ))}
            </div>
            <button className="options-action" type="button" onClick={() => setShowOverview(true)}>
              打开星舰总览
            </button>
          </aside>

          <section className="options-hologram" aria-label="当前模块">
            <div className="options-orbit" aria-hidden="true">
              {peripheralModules.map((module, index) => (
                <span
                  key={module.id}
                  className={`options-orbit__node ${module.id === activePanelKey ? 'is-active' : ''}`}
                  style={{ '--node-index': index } as CSSProperties}
                />
              ))}
            </div>
            <div className="options-core-card" data-status={activeModule.telemetry.status}>
              <span>{activeModule.glyph}</span>
              <h2>{activeModule.title}</h2>
              <p>{activeModule.description}</p>
              <small>{activeModule.telemetry.headline}</small>
            </div>
          </section>

          <aside className="options-panel options-panel--detail">
            <div className="options-panel__heading">
              <span>ACTIVE MODULE</span>
              <strong>{activeModule.section}</strong>
            </div>
            <p>{activeModule.telemetry.detail}</p>
            <button className="options-action options-action--secondary" type="button" onClick={() => focusPanel('main')}>
              返回指挥中心
            </button>
          </aside>
        </section>

        <section className="options-module-grid">
          {gridModules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={`options-module-card ${module.id === activePanelKey ? 'is-active' : ''}`}
              data-status={module.telemetry.status}
              style={{ '--status-color': STARSHIP_STATUS_TINT[module.telemetry.status] } as CSSProperties}
              onClick={() => focusPanel(module.id)}
            >
              <span>{module.glyph}</span>
              <strong>{module.title}</strong>
              <small>{module.code}</small>
              <em>{module.telemetry.metric}</em>
            </button>
          ))}
        </section>

        {activePanelKey !== 'main' ? (
          <section className="react-module-shell" data-status={activeModule.telemetry.status}>
            <header className="react-module-shell__header">
              <div>
                <span>{activeModule.glyph} / {activeModule.section}</span>
                <h2>{activeModule.title}</h2>
              </div>
              <button type="button" onClick={() => focusPanel('main')}>返回指挥中心</button>
            </header>
            <div className="react-module-shell__body">
              {ActivePanelComponent ? <ActivePanelComponent /> : <ReactModulePlaceholder panelKey={activePanelKey} />}
            </div>
          </section>
        ) : null}

        <footer className="bridge-footer">
          <span>EDGE NAV ACTIVE</span>
          <span>{activeModule.code} / {activeModule.section}</span>
          <span>模块 {modules.length - 1} 个</span>
          <span>`O` 打开总览</span>
        </footer>
      </div>
    </div>
  );
};

export default PanelNav;
