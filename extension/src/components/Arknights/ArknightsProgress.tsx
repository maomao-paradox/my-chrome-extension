import React from 'react';
import { AK_THEME } from './ArknightsTheme';

interface ProgressProps {
  value: number; // 0 - 100
  segments?: number;
  label?: string;
}

export const ArknightsProgress: React.FC<ProgressProps> = ({
  value,
  segments = 16,
  label = 'SYSTEM_SYNC',
}) => {
  const activeSegments = Math.round((Math.min(100, Math.max(0, value)) / 100) * segments);

  return (
    <div style={{ fontFamily: 'monospace, sans-serif', width: '100%' }}>
      {/* 信息头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: AK_THEME.colors.textMuted, marginBottom: '6px' }}>
        <span style={{ letterSpacing: '0.1em' }}>{label}</span>
        <span style={{ color: AK_THEME.colors.rhodesCyan, fontWeight: 'bold' }}>{value}%</span>
      </div>

      {/* 矩阵方块阵列 */}
      <div
        style={{
          display: 'flex',
          gap: '3px',
          padding: '4px',
          backgroundColor: '#121212',
          border: `1px solid ${AK_THEME.colors.border}`,
        }}
      >
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '10px',
              flex: 1,
              backgroundColor: i < activeSegments ? AK_THEME.colors.rhodesCyan : 'rgba(255,255,255,0.05)',
              boxShadow: i < activeSegments ? `0 0 4px ${AK_THEME.colors.rhodesCyan}` : 'none',
              transition: 'background-color 0.15s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
};