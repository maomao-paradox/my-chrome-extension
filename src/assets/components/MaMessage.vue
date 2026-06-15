<template>
  <Transition name="ma-message-fade" appear>
    <div v-show="visible" :class="[
      messageClass,
      center ? 'is-center' : '',
      showClose ? 'is-closable' : '',
      customClass || ''
    ]" role="alert" style="z-index: 2147483647;">
      <i :class="iconClass"></i>

      <slot>
        <p v-if="dangerouslyUseHTMLString" class="ma-message__content" v-html="message"></p>
        <p v-else class="ma-message__content">
          <span>{{ message }}</span>
        </p>
      </slot>

      <i v-if="showClose" class="ma-message__closeBtn ma-icon-close" @click="close"></i>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

// 定义类型
interface MaMessageProps {
  message?: string;
  duration?: number;
  type?: 'success' | 'warning' | 'info' | 'error';
  customClass?: string;
  showClose?: boolean;
  dangerouslyUseHTMLString?: boolean;
  center?: boolean;
  offset?: number;
  onClose?: () => void;
}

// 定义props和emits
const props = withDefaults(defineProps<MaMessageProps>(), {
  message: '',
  duration: 3000,
  type: 'success',
  customClass: '',
  showClose: false,
  dangerouslyUseHTMLString: false,
  center: false,
  offset: 20,
  onClose: () => {}
});

// 响应式数据
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

// 计算属性
const messageClass = computed(() => {
  return `ma-message ma-message--${props.type}`;
});

const iconClass = computed(() => {
  return `ma-message__icon ma-icon-${props.type}`;
});

// 方法定义
function close() {
  visible.value = false;
  if (typeof props.onClose === 'function') {
    props.onClose();
  }
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function startTimer() {
  visible.value = true;
  if (props.duration > 0) {
    timer = setTimeout(() => {
      if (visible.value) {
        close();
      }
    }, props.duration);
  }
}

// 生命周期钩子
onMounted(() => {
  startTimer();
});

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<style scoped>
.ma-message {
  min-width: 380px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  border-width: 1px;
  border-style: solid;
  border-color: #ebeef5;
  position: fixed;
  left: 50%;
  top: 20px;
  -webkit-transform: translateX(-50%);
  transform: translateX(-50%);
  background-color: #edf2fc;
  -webkit-transition: opacity .3s, top .4s, -webkit-transform .4s;
  transition: opacity .3s, top .4s, -webkit-transform .4s;
  transition: opacity .3s, transform .4s, top .4s;
  transition: opacity .3s, transform .4s, top .4s, -webkit-transform .4s;
  padding: 15px 15px 15px 20px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center
}

.ma-message.is-center {
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center
}

.ma-message.is-closable .ma-message__content {
  padding-right: 16px
}

.ma-message p {
  margin: 0
}

.ma-message--info .ma-message__content {
  color: #909399
}

.ma-message--success {
  background-color: #f0f9eb;
  border-color: #e1f3d8
}

.ma-message--success .ma-message__content {
  color: #67c23a
}

.ma-message--warning {
  background-color: #fdf6ec;
  border-color: #faecd8
}

.ma-message--warning .ma-message__content {
  color: #e6a23c
}

.ma-message--error {
  background-color: #fef0f0;
  border-color: #fde2e2
}

.ma-message--error .ma-message__content {
  color: #f56c6c
}

.ma-message__icon {
  margin-right: 10px
}

.ma-message__content {
  padding: 0;
  font-size: 14px;
  line-height: 1
}

.ma-message__closeBtn {
  position: absolute;
  top: 50%;
  right: 15px;
  -webkit-transform: translateY(-50%);
  transform: translateY(-50%);
  cursor: pointer;
  color: #c0c4cc;
  font-size: 16px
}

.ma-message__closeBtn:hover {
  color: #909399
}

.ma-message .ma-icon-success {
  color: #67c23a
}

.ma-message .ma-icon-error {
  color: #f56c6c
}

.ma-message .ma-icon-info {
  color: #909399
}

.ma-message .ma-icon-warning {
  color: #e6a23c
}

.ma-message-fade-enter-from,
.ma-message-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -100%);
}

.ma-message-fade-enter-to,
.ma-message-fade-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}

.ma-message-fade-enter-active,
.ma-message-fade-leave-active {
  transition: all 0.5s ease;
}
</style>