<template>
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <defs>
      <linearGradient id="searchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="100%" stop-color="#8b5cf6" />
      </linearGradient>
    </defs>
    <!-- 科幻风格背景光环 -->
    <circle cx="12" cy="12" r="10" fill="none" stroke="url(#searchGradient)" stroke-width="0.5" opacity="0.3" />
    <!-- 搜索图标主体 -->
    <circle cx="11" cy="11" r="8" fill="none" stroke="url(#searchGradient)" stroke-width="1.5" />
    <path 
      d="M21 21l-4.35-4.35" 
      fill="none" 
      stroke="url(#searchGradient)" 
      stroke-width="1.5" 
      stroke-linecap="round" 
    />
    <!-- 装饰性闪光点 -->
    <circle cx="11" cy="11" r="3" fill="none" stroke="url(#searchGradient)" stroke-width="0.5" opacity="0.5" />
  </svg>
</template>

<script setup lang="ts">
// Setup script for IconSearch component
// This is a static SVG icon component with no props or logic
</script>