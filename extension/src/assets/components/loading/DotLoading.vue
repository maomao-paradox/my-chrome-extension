<template>
    <div ref="loaderRef" class="loader">
        <div v-for="(i, index) in dotCount" :key="index" class="dot" :style="getDotStyle(index + 1)" />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue';

// 组件 props
const props = defineProps({
  /** 点的数量 */
  dotCount: {
    type: Number,
    default: 26
  },
  /** 容器宽度 */
  width: {
    type: String,
    default: '100%'
  },
  /** 容器高度 */
  height: {
    type: String,
    default: '60px'
  },
  /** 点的大小 */
  dotSize: {
    type: String,
    default: '10px'
  },
  /** 点之间的间距 */
  dotSpacing: {
    type: Number,
    default: 25
  }
});

// 容器引用
const loaderRef = ref<HTMLElement | null>(null);
// 容器宽度
const containerWidth = ref(300);
// 中心点位置
const centerPosition = computed(() => containerWidth.value / 2);

// 计算每个点的样式
const getDotStyle = (index: number) => {
  const isEven = index % 2 === 0;
  // 计算位置：从中心向两侧延伸
  const offset = Math.floor((index - 1) / 2) * props.dotSpacing;
  const position = centerPosition.value - offset;
  // 计算动画延迟
  const delay = isEven ? -1.2 - (Math.floor(index / 2) - 1) * 0.2 : -0.1 - (Math.floor((index - 1) / 2) * 0.2);

  return {
    left: `${position}px`,
    animationDelay: `${delay}s`,
    WebkitAnimationDelay: `${delay}s`,
    width: props.dotSize,
    height: props.dotSize
  };
};

// 更新容器宽度
const updateContainerWidth = () => {
  if (loaderRef.value) {
    containerWidth.value = loaderRef.value.offsetWidth || 300;
  }
};

// 监听窗口大小变化
const handleResize = () => {
  updateContainerWidth();
};

import { useEventListener } from '@/event';

// 监听窗口大小变化
useEventListener(window, 'resize', handleResize);

onMounted(() => {
  maLogger.log('DotLoading mounted');
  updateContainerWidth();
});

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 监听宽度变化
watch(() => props.width, () => {
  // 宽度变化时更新
  setTimeout(updateContainerWidth, 100);
});
</script>

<style>
html,
body {
    height: 100%;
}

body {
    align-items: center;
    background-color: #212121;
    display: flex;
    justify-content: center;
}

.loader {
    position: relative;
    width: v-bind(width);
    height: v-bind(height);
    margin: 0 auto;
}

.loader .dot {
    -webkit-animation-name: movement;
    animation-name: movement;
    -webkit-animation-duration: 2s;
    animation-duration: 2s;
    -webkit-animation-iteration-count: infinite;
    animation-iteration-count: infinite;
    -webkit-animation-timing-function: ease-in-out;
    animation-timing-function: ease-in-out;
    position: absolute;
    top: 50%;
    -webkit-transform: translate3d(0, -25px, 0) scale(1);
    transform: translate3d(0, -25px, 0) scale(1);
    margin-top: -5px;
    /* 垂直居中调整 */
}

.loader .dot::before {
    -webkit-animation-name: size-opacity;
    animation-name: size-opacity;
    -webkit-animation-duration: 2s;
    animation-duration: 2s;
    -webkit-animation-iteration-count: infinite;
    animation-iteration-count: infinite;
    -webkit-animation-timing-function: ease;
    animation-timing-function: ease;
    background: white;
    border-radius: 50%;
    content: '';
    display: block;
    height: 100%;
    width: 100%;
    /* 继承父元素的动画延迟 */
    -webkit-animation-delay: inherit;
    animation-delay: inherit;
}

.loader .dot:nth-of-type(even)::before {
    background-color: #ff47aa;
    box-shadow: inset 0 0 4px #ff1492;
}

@keyframes movement {
    0% {
        -webkit-transform: translate3d(0, -25px, 0);
        transform: translate3d(0, -25px, 0);
        z-index: 0;
    }

    50% {
        -webkit-transform: translate3d(0, 25px, 0);
        transform: translate3d(0, 25px, 0);
        z-index: 10;
    }

    100% {
        -webkit-transform: translate3d(0, -25px, 0);
        transform: translate3d(0, -25px, 0);
        z-index: -5;
    }
}

@keyframes size-opacity {
    0% {
        opacity: 1;
        -webkit-transform: scale(1);
        transform: scale(1);
    }

    25% {
        -webkit-transform: scale(1.5);
        transform: scale(1.5);
    }

    50% {
        opacity: 1;
    }

    75% {
        opacity: .35;
        -webkit-transform: scale(0.5);
        transform: scale(0.5);
    }

    100% {
        opacity: 1;
        -webkit-transform: scale(1);
        transform: scale(1);
    }
}

/* 兼容 WebKit 浏览器 */
@-webkit-keyframes movement {
    0% {
        -webkit-transform: translate3d(0, -25px, 0);
        transform: translate3d(0, -25px, 0);
        z-index: 0;
    }

    50% {
        -webkit-transform: translate3d(0, 25px, 0);
        transform: translate3d(0, 25px, 0);
        z-index: 10;
    }

    100% {
        -webkit-transform: translate3d(0, -25px, 0);
        transform: translate3d(0, -25px, 0);
        z-index: -5;
    }
}

@-webkit-keyframes size-opacity {
    0% {
        opacity: 1;
        -webkit-transform: scale(1);
        transform: scale(1);
    }

    25% {
        -webkit-transform: scale(1.5);
        transform: scale(1.5);
    }

    50% {
        opacity: 1;
    }

    75% {
        opacity: .35;
        -webkit-transform: scale(0.5);
        transform: scale(0.5);
    }

    100% {
        opacity: 1;
        -webkit-transform: scale(1);
        transform: scale(1);
    }
}
</style>
