// ArknightsTheme.ts
export const AK_THEME = {
  colors: {
    bgDark: '#121212',
    surface: '#18181b',
    border: '#3f3f46',
    borderLight: '#52525b',
    primary: '#ffffff',
    rhodesCyan: '#00e5ff',
    rhodesYellow: '#ffe600',
    warning: '#fbbf24',
    danger: '#ef4444',
    textMuted: '#a1a1aa',
  },
  // 45度单切角（右下）
  clipCornerBR: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)',
  // 45度双对角切角（右上 + 左下）
  clipCornerDiagonal: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
  // 警示斜条纹背景
  hazardStripes: 'repeating-linear-gradient(-45deg, #ffe600, #ffe600 8px, #121212 8px, #121212 16px)',
};