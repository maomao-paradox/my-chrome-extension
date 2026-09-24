import React, { useState } from 'react';

interface JungleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  subText?: string;
  variant?: 'green' | 'orange';
  children: React.ReactNode;
}

export const JungleCruxButton: React.FC<JungleButtonProps> = ({
  subText = 'SPECIMEN//SCAN',
  variant = 'green',
  children,
  style,
  ...props
}) => {
  const [hovered, setHovered] = useState(false);

  // 变体主题
  const theme = variant === 'green' 
    ? { primary: '#00ff88', darkBg: '#0d1a14', text: '#00ff88' } 
    : { primary: '#ff5500', darkBg: '#1a0f0d', text: '#ff5500' };

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 24px',
        height: '46px',
        backgroundColor: hovered ? theme.primary : 'rgba(13, 26, 20, 0.85)',
        color: hovered ? '#050a07' : '#ffffff',
        border: `1px solid ${hovered ? theme.primary : 'rgba(0, 255, 136, 0.25)'}`,
        // 丛林活动招牌的 -10deg 平行四边形倾斜
        transform: 'skewX(-10deg)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(8px)',
        boxShadow: hovered ? `0 0 15px ${theme.primary}66` : 'none',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* 保持文字不倾斜 */}
      <div style={{ transform: 'skewX(10deg)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: '8px',
            fontFamily: 'monospace',
            letterSpacing: '0.2em',
            color: hovered ? '#050a07' : theme.text,
            opacity: hovered ? 0.8 : 1,
            marginBottom: '2px',
          }}
        >
          {subText}
        </span>
        <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.08em', fontFamily: 'sans-serif' }}>
          {children}
        </span>
      </div>

      {/* 侧边野外传感器角标 */}
      <div
        style={{
          position: 'absolute',
          right: '0',
          top: '0',
          bottom: '0',
          width: '4px',
          backgroundColor: hovered ? '#000000' : theme.primary,
        }}
      />
    </button>
  );
};