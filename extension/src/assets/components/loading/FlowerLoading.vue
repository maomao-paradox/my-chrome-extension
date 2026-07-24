<template>
  <Transition name="fade">
    <div class="container">
      <div class="item-container">
        <div
          v-for="i in 8"
          :key="i"
          :class="['common', `item${i}`]"
          :style="getItemStyle(i)"
        ></div>
      </div>

      <div class="bar">
        <div class="progress"></div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Transition } from "vue";
const getItemStyle = (index: number) => {
  return {
    "--rotate": 45 * index + "deg",
    "--delay": 0.125 * (index - 1) + "s",
  };
};
</script>

<style lang="scss" scoped>
// 变量定义
$bg-color: #161b29;
$pink: #e645d0;
$cyan: #17e1e6;
$container-size: 40vw;
$bar-height: 5vw;
$bar-width: 2vw;

// 基础布局
body {
  background: $bg-color;
  margin: 0 auto;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.item-container {
  width: $container-size;
  height: $container-size;
  position: absolute;
  inset: 0;
  margin: auto;
  overflow: hidden;
  animation: container 5s linear infinite;
}

// 通用条状样式
.common {
  height: $bar-height;
  max-height: 100%;
  overflow: auto;
  width: $bar-width;
  margin: auto;
  max-width: 100%;
  position: absolute;
  background-color: transparent;
  border-radius: 0vw 10vw 0vw 10vw;
  box-shadow:
    inset 0vw 0vw 0vw 0.1vw $pink,
    0vw 0vw 1.5vw 0vw $pink;
}

// 位置和旋转 - 使用循环生成
$positions: (
  1: (
    left: 0,
    right: 0,
    top: 0,
    bottom: 7.5vw,
  ),
  2: (
    left: 5.5vw,
    right: 0,
    top: 0,
    bottom: 5.5vw,
  ),
  3: (
    left: 7.5vw,
    right: 0,
    top: 0,
    bottom: 0,
  ),
  4: (
    left: 5.5vw,
    right: 0,
    top: 5.5vw,
    bottom: 0,
  ),
  5: (
    left: 0,
    right: 0,
    top: 7.5vw,
    bottom: 0,
  ),
  6: (
    left: 0,
    right: 5.5vw,
    top: 5.5vw,
    bottom: 0,
  ),
  7: (
    left: 0,
    right: 7.5vw,
    top: 0,
    bottom: 0,
  ),
  8: (
    left: 0,
    right: 5.5vw,
    top: 0,
    bottom: 5.5vw,
  ),
);

// 生成每个条状元素的位置和动画
@each $name, $props in $positions {
  .item#{$name} {
    transform: rotate(var(--rotate));
    left: map-get($props, left);
    right: map-get($props, right);
    top: map-get($props, top);
    bottom: map-get($props, bottom);
    animation: animation#{$name} 5s var(--delay) ease infinite;
  }

  @keyframes animation#{$name} {
    0%,
    100% {
    }
    50% {
      background: transparent;
      box-shadow:
        inset 0vw 0vw 0vw 0.1vw $cyan,
        0vw 0vw 1.5vw 0vw $cyan;
    }
  }
}

// 进度条
.bar {
  width: 12vw;
  height: 0.25vw;
  position: absolute;
  inset: 0;
  top: 16vw;
  margin: auto;
  overflow: hidden;
  background: $pink;
}

.progress {
  width: 12vw;
  height: 0.5vw;
  position: absolute;
  inset: 0;
  margin: auto;
  overflow: hidden;
  background: $cyan;
  animation: progress 5s ease;
}

// 旋转容器动画
@keyframes container {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
}

// 进度条动画
@keyframes progress {
  0% {
    left: -24vw;
  }
  100% {
    left: 0;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: all 2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
