import React from 'react';
import { AK_THEME } from './ArknightsTheme';

interface CardProps {
  title?: string;
  systemCode?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const ArknightsCard: React.FC<CardProps> = ({
  title = 'TERMINAL',
  systemCode = '// PRTS_SYS_v4.2',
  children,
  style,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#09090b',
        border: `1px solid ${AK_THEME.colors.border}`,
        color: '#f4f4f5',
        padding: '20px',
        clipPath: AK_THEME.clipCornerBR,
        fontFamily: 'monospace, sans-serif',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* 顶部左/右两角 准星定位符 */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '8px', height: '8px', borderTop: `2px solid ${AK_THEME.colors.rhodesCyan}`, borderLeft: `2px solid ${AK_THEME.colors.rhodesCyan}` }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', borderTop: `2px solid ${AK_THEME.colors.rhodesCyan}`, borderRight: `2px solid ${AK_THEME.colors.rhodesCyan}` }} />

      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${AK_THEME.colors.border}`,
          paddingBottom: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: AK_THEME.colors.rhodesCyan,
              boxShadow: `0 0 8px ${AK_THEME.colors.rhodesCyan}`,
            }}
          />
          <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em' }}>
            {title}
          </span>
        </div>
        <span style={{ fontSize: '10px', color: AK_THEME.colors.textMuted }}>{systemCode}</span>
      </div>

      {/* 主体内容 */}
      <div>{children}</div>

      {/* 底部斜条纹装饰 */}
      <div
        style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          width: '40px',
          height: '6px',
          background: AK_THEME.hazardStripes,
          opacity: 0.4,
        }}
      />
    </div>
  );
};