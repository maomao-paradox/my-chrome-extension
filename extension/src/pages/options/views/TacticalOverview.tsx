/**
 * @file src/pages/options/views/TacticalOverview.tsx
 * @description React 版星舰总览弹层。
 */
import { type CSSProperties } from 'react';
import {
  STARSHIP_STATUS_TEXT,
  STARSHIP_STATUS_TINT,
  type StarshipModuleState,
  type StarshipPanelId,
} from './starshipModules';

interface TacticalOverviewProps {
  modules: StarshipModuleState[];
  activePanelKey: StarshipPanelId;
  onClose: () => void;
  onSelectPanel: (panelKey: StarshipPanelId) => void;
}

const TacticalOverview = ({ modules, activePanelKey, onClose, onSelectPanel }: TacticalOverviewProps) => {
  const overviewModules = modules.filter((module) => module.id !== 'main' && module.overview);
  const activeModule = modules.find((module) => module.id === activePanelKey) ?? modules[0];

  return (
    <div className="tactical-overview" onClick={onClose}>
      <div className="tactical-shell" onClick={(event) => event.stopPropagation()}>
        <header className="tactical-header">
          <div>
            <p>Starship Tactical Overview</p>
            <h2>星舰总览</h2>
          </div>
          <button type="button" onClick={onClose}>关闭总览</button>
        </header>

        <div className="overview-stage">
          <div className="overview-core-card">
            <span>Bridge Core</span>
            <strong>{activeModule.telemetry.metric}</strong>
            <p>{activeModule.telemetry.headline}</p>
          </div>

          {overviewModules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={`callout-card ${module.id === activePanelKey ? 'is-active' : ''}`}
              style={{ '--status-color': STARSHIP_STATUS_TINT[module.telemetry.status] } as CSSProperties}
              onClick={() => onSelectPanel(module.id)}
            >
              <span>{module.glyph}</span>
              <strong>{module.title}</strong>
              <small>{module.telemetry.detail}</small>
              <em>{STARSHIP_STATUS_TEXT[module.telemetry.status]} / {module.telemetry.metric}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TacticalOverview;
