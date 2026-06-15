<template>
  <div class="glass-cursor-container">
    <!-- 无延迟 -->
    <div class="cursor-core" :style="{
      transform: `translate(${corePosition.x - 6}px, ${corePosition.y - 6}px)`,
      opacity: isVisible ? 1 : 0
    }">
      <div class="star-shape"></div>
    </div>
    <!-- 带延迟 -->
    <div class="glass-cursor" :style="{
      transform: `translate(${glassPosition.x - 45}px, ${glassPosition.y - 45}px)`,
      opacity: isVisible ? 1 : 0
    }">
      <div class="cursor-glow"></div>
      <div class="cursor-ring"></div>
      <!-- 旋转轨道 -->
      <div class="star-orbit">
        <div class="star-particle"
          :style="{ transform: `translate(-50%, -50%) rotate(${orbitAngle}deg) translateX(45px)` }"></div>
      </div>
    </div>
    <!-- 粒子效果 -->
    <div v-for="(particle, index) in starParticles" :key="index" class="random-star" :style="{
      left: `${particle.x}px`,
      top: `${particle.y}px`,
      opacity: particle.opacity,
      transform: `scale(${particle.scale})`,
      animationDelay: `${particle.delay}s`
    }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useEventListener } from '@/event';
import { useMouseTracker } from '@/assets/composables/mouse/mouseTracker';

// 光标位置状态
const glassPosition = ref({ x: 0, y: 0 });
const corePosition = ref({ x: 0, y: 0 });
// const cursorPosition = ref({ x: 0, y: 0 });
const isVisible = ref(true);

// 初始化鼠标跟踪
const { x: cursorX, y: cursorY } = useMouseTracker();

// 新添加的状态
const orbitAngle = ref(0); // 轨道旋转角度
const starParticles = ref<any[]>([]); // 随机星星粒子
const particleCount = 50; // 星星粒子数量
let animationFrameId: number | null = null;

// 平滑跟随参数 - 减小值增加延迟
const coreFollowSpeed = 0.3;
const glassFollowSpeed = 0.1;

// 鼠标移动事件处理
const handleMouseMove = (event: MouseEvent) => {
  if (!isVisible.value) return;

  // 随机生成星星粒子
  if (Math.random() < 0.1) {
    createStarParticle(event.clientX, event.clientY);
  }
};

// 创建星星粒子
const createStarParticle = (x: number, y: number) => {
  const particle = {
    x: x + (Math.random() - 0.5) * 100,
    y: y + (Math.random() - 0.5) * 100,
    opacity: Math.random() * 0.8 + 0.2,
    scale: Math.random() * 0.8 + 0.2,
    delay: Math.random() * 2
  };
  starParticles.value.push(particle);

  // 限制粒子数量
  if (starParticles.value.length > particleCount) {
    starParticles.value.shift();
  }
};

// 鼠标离开事件处理
const handleMouseLeave = () => {
  isVisible.value = false;
};

// 鼠标进入事件处理
const handleMouseEnter = () => {
  isVisible.value = true;
};

// 平滑跟随动画
const animateCursor = () => {
  // 计算当前位置到目标位置的距离
  const cx = cursorX.value - corePosition.value.x ;
  const cy = cursorY.value - corePosition.value.y;
  const dx = cursorX.value - glassPosition.value.x;
  const dy = cursorY.value - glassPosition.value.y;

  // 更新核心位置（平滑跟随）
  corePosition.value.x += cx * coreFollowSpeed;
  corePosition.value.y += cy * coreFollowSpeed;

  // 更新光标位置（平滑跟随）
  glassPosition.value.x += dx * glassFollowSpeed;
  glassPosition.value.y += dy * glassFollowSpeed;

  // 更新轨道旋转角度
  orbitAngle.value = (orbitAngle.value + 0.5) % 360;

  // 继续下一帧动画
  animationFrameId = requestAnimationFrame(animateCursor);
};

// 初始化随机星星粒子
const initStarParticles = () => {
  for (let i = 0; i < particleCount; i++) {
    starParticles.value.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      opacity: Math.random() * 0.8 + 0.2,
      scale: Math.random() * 0.8 + 0.2,
      delay: Math.random() * 2
    });
  }
};

useEventListener(window, new Map([
  ['mousemove', handleMouseMove],
  ['mouseleave', handleMouseLeave],
  ['mouseenter', handleMouseEnter]
]));

// 生命周期钩子
onMounted(() => {
  cursorX.value = window.innerWidth / 2;
  cursorY.value = window.innerHeight / 2;
  corePosition.value = { x: cursorX.value, y: cursorY.value };
  glassPosition.value = { x: cursorX.value, y: cursorY.value };

  // 初始化星星粒子
  initStarParticles();

  // 启动动画
  animateCursor();
});

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
});
</script>

<style scoped>
.glass-cursor-container {
  position: fixed;
  /* top: 0;
  left: 0; */
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
  cursor: none;
}

/* 核心光标 - 圆形粒子 */
.cursor-core {
  position: absolute;
  width: 12px;
  height: 12px;
  z-index: 10001;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.star-shape {
  position: absolute;
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
  animation: starParticlePulse 3s ease-in-out infinite;
  transform-origin: center;
}

/* 玻璃光标 - 宇宙圆环 */
.glass-cursor {
  position: absolute;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  transform-origin: center;
  transition: opacity 0.3s ease;
}

.cursor-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 191, 255, 0.3) 0%, rgba(30, 144, 255, 0.1) 50%, transparent 100%);
  animation: cosmicGlowPulse 4s ease-in-out infinite;
  filter: blur(15px);
}

.cursor-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: transparent;
  border: 2px solid rgba(128, 128, 128, 0.6);
  animation: cosmicRingRotate 12s linear infinite;
  box-shadow: 0 0 20px rgba(128, 128, 128, 0.4), inset 0 0 20px rgba(128, 128, 128, 0.1);
}

/* 星星轨道 */
.star-orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  pointer-events: none;
}

.star-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  pointer-events: none;
}

.star-particle::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #00BFFF 0%, #1E90FF 100%);
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  box-shadow: 0 0 20px rgba(0, 191, 255, 0.8), 0 0 40px rgba(0, 191, 255, 0.4);
  /* 卫星自转的动画控制，6s完成一圈 */
  animation: starPulse 12s ease-in-out infinite;
  transform-origin: center;
}

/* 随机星星粒子 */
.random-star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
  animation: randomStarTwinkle 4s ease-in-out infinite;
  pointer-events: none;
  z-index: 9998;
}

/* 动画效果 */
@keyframes starPulse {
  0% {
    transform: rotate(0deg);
    box-shadow: 0 0 20px rgba(0, 191, 255, 0.8), 0 0 40px rgba(0, 191, 255, 0.4);
  }

  50% {
    transform: rotate(-180deg);
    box-shadow: 0 0 30px rgba(0, 191, 255, 1), 0 0 60px rgba(0, 191, 255, 0.6);
  }

  100% {
    transform: rotate(-360deg);
    box-shadow: 0 0 20px rgba(0, 191, 255, 0.8), 0 0 40px rgba(0, 191, 255, 0.4);
  }
}

@keyframes cosmicGlowPulse {

  0%,
  100% {
    transform: translate(-50%, -50%) rotate(0deg);
    opacity: 0.5;
    box-shadow: 0 0 20px rgba(0, 191, 255, 0.8), 0 0 40px rgba(0, 191, 255, 0.4), 0 0 60px rgba(0, 191, 255, 0.2);
  }

  50% {
    transform: translate(-50%, -50%) rotate(180deg);
    opacity: 0.8;
    box-shadow: 0 0 30px rgba(0, 191, 255, 1), 0 0 60px rgba(0, 191, 255, 0.6), 0 0 90px rgba(0, 191, 255, 0.4);
  }
}

@keyframes cosmicRingRotate {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes starParticlePulse {

  0%,
  100% {
    transform: rotate(0deg);
    opacity: 0.6;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
  }

  50% {
    transform: rotate(180deg);
    opacity: 1;
    box-shadow: 0 0 20px rgba(255, 255, 255, 1), 0 0 30px rgba(0, 191, 255, 0.6);
  }
}

@keyframes randomStarTwinkle {

  0%,
  100% {
    opacity: 0.2;
    transform: rotate(0deg);
  }

  50% {
    opacity: 1;
    transform: rotate(180deg);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(0, 191, 255, 0.4);
  }
}
</style>
