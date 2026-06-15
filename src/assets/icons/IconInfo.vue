<template>
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <defs>
      <linearGradient id="infoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="100%" stop-color="#8b5cf6" />
      </linearGradient>
    </defs>
    <!-- 科幻风格背景光环 -->
    <circle cx="12" cy="12" r="10" fill="none" stroke="url(#infoGradient)" stroke-width="0.5" opacity="0.3" />
    <!-- 信息图标主体 -->
    <circle cx="12" cy="12" r="8" fill="none" stroke="url(#infoGradient)" stroke-width="1.5" />
    <path 
      d="M12 8v4M12 16h.01" 
      fill="none" 
      stroke="url(#infoGradient)" 
      stroke-width="1.5" 
      stroke-linecap="round" 
    />
    <!-- 装饰性效果 -->
    <path 
      d="M12 4l0 .01M12 20l0 .01M4 12l.01 0M20 12l.01 0" 
      fill="none" 
      stroke="url(#infoGradient)" 
      stroke-width="1" 
      stroke-linecap="round" 
      opacity="0.7" 
    />
  </svg>
</template>