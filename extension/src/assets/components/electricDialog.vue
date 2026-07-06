<template>
  <main class="main-container">
    <svg class="svg-container">
      <defs>
        <filter id="turbulent-displace" colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="1" />
          <feOffset in="noise1" dx="0" dy="0" result="offsetNoise1">
            <animate attributeName="dy" values="700; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>

          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="1" />
          <feOffset in="noise2" dx="0" dy="0" result="offsetNoise2">
            <animate attributeName="dy" values="0; -700" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>

          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="2" />
          <feOffset in="noise1" dx="0" dy="0" result="offsetNoise3">
            <animate attributeName="dx" values="490; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>

          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="2" />
          <feOffset in="noise2" dx="0" dy="0" result="offsetNoise4">
            <animate attributeName="dx" values="0; -490" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>

          <feComposite in="offsetNoise1" in2="offsetNoise2" result="part1" />
          <feComposite in="offsetNoise3" in2="offsetNoise4" result="part2" />
          <feBlend in="part1" in2="part2" mode="color-dodge" result="combinedNoise" />

          <feDisplacementMap in="SourceGraphic" in2="combinedNoise" scale="30" xChannelSelector="R"
            yChannelSelector="B" />
        </filter>
      </defs>
    </svg>

    <div class="card-container" :style="cardStyle">
      <div class="inner-container">
        <div class="border-outer" :style="borderStyle">
          <div class="main-card" :style="mainCardStyle"></div>
        </div>
        <div class="glow-layer-1" :style="glowStyle1"></div>
        <div class="glow-layer-2" :style="glowStyle2"></div>
      </div>

      <div class="overlay-1"></div>
      <div class="overlay-2"></div>
      <div class="background-glow" :style="backgroundGlowStyle"></div>

      <div class="content-container">
        <!-- 默认插槽，如果提供则完全替换内容 -->
        <slot>
          <!-- 头部插槽 -->
          <div class="content-top">
            <!-- Scrollbar Glass 插槽 -->
            <slot name="scrollbarGlass">
              <div v-if="showScrollbarGlass" class="scrollbar-glass">
                {{ scrollbarGlassText }}
              </div>
            </slot>
            
            <!-- 标题插槽 -->
            <slot name="title">
              <p class="title">{{ title }}</p>
            </slot>
          </div>

          <!-- 分隔线插槽 -->
          <slot name="divider">
            <hr class="divider" />
          </slot>

          <!-- 底部插槽 -->
          <div class="content-bottom">
            <!-- 描述插槽 -->
            <slot name="description">
              <p class="description">{{ description }}</p>
            </slot>
          </div>
        </slot>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props定义
const props = withDefaults(defineProps<{
  /** 弹窗标题 */
  title?: string
  /** 弹窗描述 */
  description?: string
  /** 弹窗宽度 */
  width?: string | number
  /** 弹窗高度 */
  height?: string | number
  /** 边框颜色 */
  borderColor?: string
  /** 是否显示顶部的scrollbar-glass元素 */
  showScrollbarGlass?: boolean
  /** scrollbar-glass元素的文本内容 */
  scrollbarGlassText?: string
}>(), {
  title: 'Electric Border',
  description: 'In case you\'d like to emphasize something very dramatically.',
  width: 350,
  height: 500,
  borderColor: '#dd8448',
  showScrollbarGlass: true,
  scrollbarGlassText: 'Dramatic'
})

// 计算样式
const cardStyle = computed(() => ({
  '--electric-border-color': props.borderColor,
  '--electric-light-color': `oklch(from ${props.borderColor} l c h)`,
  '--gradient-color': `oklch(from ${props.borderColor} 0.3 calc(c / 2) h / 0.4)`
}))

const mainCardStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height
}))

const borderStyle = computed(() => ({
  borderColor: `${props.borderColor}80` // 50% opacity
}))

const glowStyle1 = computed(() => ({
  borderColor: `${props.borderColor}99` // 60% opacity
}))

const glowStyle2 = computed(() => ({
  borderColor: props.borderColor
}))

const backgroundGlowStyle = computed(() => ({
  background: `linear-gradient(-30deg, oklch(from ${props.borderColor} l c h), transparent, ${props.borderColor})`
}))
</script>

<style scoped>
/* Reset and base styles */

/* CSS Variables */
:root {
  --electric-border-color: #dd8448;
  --electric-light-color: oklch(from var(--electric-border-color) l c h);
  --gradient-color: oklch(from var(--electric-border-color) 0.3 calc(c / 2) h / 0.4);
  --color-neutral-900: oklch(0.185 0 0);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background-color: oklch(0.145 0 0);
  color: oklch(0.985 0 0);
  height: 100vh;
  overflow: hidden;
}

/* Main container */
.main-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

/* SVG positioning */
.svg-container {
  position: absolute;
}

/* Card container */
.card-container {
  padding: 2px;
  border-radius: 24px;
  position: relative;
  background: linear-gradient(-30deg,
      var(--gradient-color),
      transparent,
      var(--gradient-color)),
    linear-gradient(to bottom,
      var(--color-neutral-900),
      var(--color-neutral-900));
}

/* Inner container */
.inner-container {
  position: relative;
}

/* Border layers */
.border-outer {
  border: 2px solid rgba(221, 132, 72, 0.5);
  border-radius: 24px;
  padding-right: 4px;
  padding-bottom: 4px;
}

.main-card {
  width: 350px;
  height: 500px;
  border-radius: 24px;
  border: 2px solid var(--electric-border-color);
  margin-top: -4px;
  margin-left: -4px;
  filter: url(#turbulent-displace);
}

/* Glow effects */
.glow-layer-1 {
  border: 2px solid rgba(221, 132, 72, 0.6);
  border-radius: 24px;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  filter: blur(1px);
}

.glow-layer-2 {
  border: 2px solid var(--electric-light-color);
  border-radius: 24px;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  filter: blur(4px);
}

/* Overlay effects */
.overlay-1 {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 24px;
  opacity: 1;
  mix-blend-mode: overlay;
  transform: scale(1.1);
  filter: blur(16px);
  background: linear-gradient(-30deg,
      white,
      transparent 30%,
      transparent 70%,
      white);
}

.overlay-2 {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 24px;
  opacity: 0.5;
  mix-blend-mode: overlay;
  transform: scale(1.1);
  filter: blur(16px);
  background: linear-gradient(-30deg,
      white,
      transparent 30%,
      transparent 70%,
      white);
}

/* Background glow */
.background-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 24px;
  filter: blur(32px);
  transform: scale(1.1);
  opacity: 0.3;
  z-index: -1;
  background: linear-gradient(-30deg,
      var(--electric-light-color),
      transparent,
      var(--electric-border-color));
}

/* Content container */
.content-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Content sections */
.content-top {
  display: flex;
  flex-direction: column;
  padding: 48px;
  padding-bottom: 16px;
  height: 100%;
}

.content-bottom {
  display: flex;
  flex-direction: column;
  padding: 48px;
  padding-top: 16px;
}

/* Scrollbar glass component */
.scrollbar-glass {
  background: radial-gradient(47.2% 50% at 50.39% 88.37%,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0) 100%),
    rgba(255, 255, 255, 0.04);
  position: relative;
  transition: background 0.3s ease;
  border-radius: 14px;
  width: fit-content;
  height: fit-content;
  padding: 8px 16px;
  text-transform: uppercase;
  font-weight: bold;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.scrollbar-glass:hover {
  background: radial-gradient(47.2% 50% at 50.39% 88.37%,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0) 100%),
    rgba(255, 255, 255, 0.08);
}

.scrollbar-glass::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 1px;
  background: linear-gradient(150deg,
      rgba(255, 255, 255, 0.48) 16.73%,
      rgba(255, 255, 255, 0.08) 30.2%,
      rgba(255, 255, 255, 0.08) 68.2%,
      rgba(255, 255, 255, 0.6) 81.89%);
  border-radius: inherit;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: xor;
  -webkit-mask-composite: xor;
  pointer-events: none;
}

/* Typography */
.title {
  font-size: 36px;
  font-weight: 500;
  margin-top: auto;
}

.description {
  opacity: 0.5;
}

/* Divider */
.divider {
  margin-top: auto;
  border: none;
  height: 1px;
  background-color: currentColor;
  opacity: 0.1;
  mask-image: linear-gradient(to right, transparent, black, transparent);
  -webkit-mask-image: linear-gradient(to right,
      transparent,
      black,
      transparent);
}
</style>