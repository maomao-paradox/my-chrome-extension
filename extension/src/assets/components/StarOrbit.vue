<template>
  <div class="glass-cursor-container" :style="{ opacity: isVisible ? 1 : 0 }">
    <!-- 带延迟的宇宙圆环 -->
    <div class="glass-cursor" :style="{
      transform: `translate(${glassPosition.x - 40}px, ${glassPosition.y - 40}px) scale(${isVisible ? 1 : 0})`,
    }">
      <div class="cursor-glow"></div>
      <div class="cursor-ring"></div>
      <!-- 旋转的星星轨道 -->
      <div class="star-orbit">
        <div class="star-particle"
          :style="{ transform: `translate(-50%, -50%) rotate(${orbitAngle}deg) translateX(40px)` }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

interface StarOrbitProps {
  // 直径
  diameter?: number;
  isVisible: boolean;
  followSpeed?: number;
  position: { x: number; y: number };   // 跟随移动的主体中心位置
}

const props = withDefaults(defineProps<StarOrbitProps>(), {
  isVisible: true,
  followSpeed: 0.1,
  diameter: 80
});

// 光标位置状态
const glassPosition = ref({ x: props.position.x, y: props.position.y });

// 新添加的状态
const orbitAngle = ref(0); // 轨道旋转角度

// 平滑跟随动画
const animateCursor = () => {
  // 计算当前位置到目标位置的距离
  const dx = props.position.x - glassPosition.value.x;
  const dy = props.position.y - glassPosition.value.y;

  // 更新光标位置（平滑跟随）
  glassPosition.value.x += dx * props.followSpeed;
  glassPosition.value.y += dy * props.followSpeed;

  // 更新轨道旋转角度
  orbitAngle.value = (orbitAngle.value + 0.5) % 360;

  // 继续下一帧动画
  requestAnimationFrame(animateCursor);
};

// 监听位置变化
watch(() => props.position, (newPosition) => {
  // 当外部位置变化时，平滑过渡到新位置
}, { deep: true });

// 生命周期钩子
onMounted(() => {
  // 初始化位置
  glassPosition.value = { ...props.position };

  // 启动动画
  animateCursor();
});

onUnmounted(() => {
  // 清理工作
});
</script>

<style scoped>
body {
  cursor: none !important;
}

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
  transition: opacity 0.3s ease;
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
  width: 80px;
  height: 80px;
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