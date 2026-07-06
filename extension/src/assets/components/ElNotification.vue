<template>
  <transition name="el-message-fade">
    <div v-if="!closed" style="top: 20px; z-index: 2147483647;" role='alert' :class="messageClass">
      <i :class="iconClass"></i>
      <p class="el-message__content">
        <span>{{ message }}</span>
      </p>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

// 定义类型
interface ElNotificationProps {
  message?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  duration?: number;
  onClose?: (instance: any) => void;
}

// 定义props和emits
const props = withDefaults(defineProps<ElNotificationProps>(), {
  message: '',
  type: 'success',
  duration: 2000,
  onClose: () => {}
});

// 响应式数据
const closed = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

// 计算属性
const messageClass = computed(() => {
  return `el-message el-message--${props.type}`;
});

const iconClass = computed(() => {
  return `el-message__icon el-icon-${props.type}`;
});

// 方法定义
function close() {
  closed.value = true;
  if (typeof props.onClose === 'function') {
    props.onClose({});
  }
}

function startTimer() {
  timer = setTimeout(() => {
    if (!closed.value) {
      close();
    }
  }, props.duration);
}

// 生命周期钩子
onMounted(() => {
  startTimer();
});

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
});
</script>

<style scoped>
/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.el-message-fade-enter,
.el-message-fade-leave-active {
    opacity: 0;
    -webkit-transform: translate(-50%,-100%);
    transform: translate(-50%,-100%)
}
</style>