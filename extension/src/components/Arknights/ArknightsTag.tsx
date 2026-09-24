import React from 'react';
import { AK_THEME } from './ArknightsTheme';

interface TagProps {
  type?: 'warning' | 'info' | 'danger';
  children: React.ReactNode;
}

export const ArknightsTag: React.FC<TagProps> = ({ type = 'info', children }) => {
  const styles = {
    warning: {
      bg: AK_THEME.colors.rhodesYellow,
      text: '#000000',
      border: 'none',
    },
    info: {
      bg: 'rgba(0, 229, 255, 0.1)',
      text: AK_THEME.colors.rhodesCyan,
      border: `1px solid ${AK_THEME.colors.rhodesCyan}`,
    },
    danger: {
      bg: AK_THEME.colors.danger,
      text: '#ffffff',
      border: 'none',
    },
  };

  const current = styles[type];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '10px',
        fontWeight: 'bold',
        fontFamily: 'monospace, sans-serif',
        backgroundColor: current.bg,
        color: current.text,
        border: current.border,
        clipPath: AK_THEME.clipCornerDiagonal,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {type === 'warning' && <span style={{ marginRight: '4px' }}>⚠️</span>}
      {children}
    </span>
  );
};