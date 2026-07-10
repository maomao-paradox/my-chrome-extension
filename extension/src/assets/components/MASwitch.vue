<!-- 科幻风格开关组件 -->
<template>
  <div class="sci-fi-switch-container">
    <div class="sci-fi-switch-label">{{ label }}</div>
    <slot name="default"></slot>
    <div
      class="sci-fi-switch"
      :class="{ active: modelValue }"
      @click="handleClick"
      role="switch"
      :aria-checked="modelValue"
    >
      <div class="switch-track">
        <div class="switch-thumb"></div>
        <div class="switch-glow"></div>
        <div class="switch-indicator">{{ modelValue ? "ON" : "OFF" }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";

// 定义组件名称
defineOptions({
  name: "MASwitch",
});

// 定义props和默认值
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    openText?: string;
    closeText?: string;
  }>(),
  {
    modelValue: false,
    label: "",
    openText: "启用",
    closeText: "禁用",
  },
);

// 定义事件
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "change", value: boolean): void;
}>();

// 计算属性用于控制开关状态
const checked = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

// 点击开关事件
const handleClick = () => {
  const newValue = !checked.value;
  checked.value = newValue;
  emit("change", newValue);
};
</script>

<style scoped>
.sci-fi-switch-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 0;
}

.sci-fi-switch-label {
  font-size: 14px;
  font-weight: 600;
  color: #00f0ff;
  text-align: left;
  letter-spacing: 0.5px;
  text-shadow: 0 0 5px rgba(0, 240, 255, 0.5);
}

.sci-fi-switch {
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
}

.switch-track {
  position: relative;
  width: 80px;
  height: 36px;
  border: 2px solid #004466;
  border-radius: 20px;
  background: linear-gradient(135deg, #001122 0%, #002244 100%);
  box-shadow:
    0 0 10px rgba(0, 68, 102, 0.5),
    inset 0 0 5px rgba(0, 0, 0, 0.5);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;
}

.switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #004466 0%, #006699 100%);
  box-shadow:
    0 0 10px rgba(0, 102, 153, 0.5),
    0 0 5px rgba(0, 153, 204, 0.5) inset;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 2;
}

.switch-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: radial-gradient(
    circle,
    rgba(0, 240, 255, 0.3) 0%,
    transparent 70%
  );
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: all 0.5s ease;
  z-index: 1;
}

.switch-indicator {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: bold;
  color: #006699;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.3s ease;
  z-index: 3;
}

/* 激活状态样式 */
.sci-fi-switch.active .switch-track {
  border-color: #00f0ff;
  background: linear-gradient(135deg, #002244 0%, #004466 100%);
  box-shadow:
    0 0 15px rgba(0, 240, 255, 0.6),
    inset 0 0 5px rgba(0, 68, 102, 0.5);
}

.sci-fi-switch.active .switch-thumb {
  left: calc(100% - 29px);
  background: linear-gradient(135deg, #00aacc 0%, #00f0ff 100%);
  box-shadow:
    0 0 15px rgba(0, 240, 255, 0.8),
    0 0 5px rgba(0, 255, 255, 0.5) inset;
}

.sci-fi-switch.active .switch-glow {
  width: 150px;
  height: 150px;
  background: radial-gradient(
    circle,
    rgba(0, 240, 255, 0.4) 0%,
    transparent 70%
  );
}

.sci-fi-switch.active .switch-indicator {
  color: #00f0ff;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.8);
  right: 50px;
}

/* 悬停状态 */
.sci-fi-switch:hover {
  transform: scale(1.05);
}

.sci-fi-switch:hover .switch-track {
  box-shadow:
    0 0 12px rgba(0, 240, 255, 0.4),
    inset 0 0 5px rgba(0, 0, 0, 0.5);
}

/* 点击效果 */
.sci-fi-switch:active {
  transform: scale(0.98);
}

/* 动画效果 */
@keyframes pulse {
  0% {
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.6);
  }

  50% {
    box-shadow: 0 0 25px rgba(0, 240, 255, 0.8);
  }

  100% {
    box-shadow: 0 0 15px rgba(0, 240, 255, 0.6);
  }
}

.sci-fi-switch.active .switch-track {
  animation: pulse 2s infinite;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .switch-track {
    width: 70px;
    height: 32px;
  }

  .switch-thumb {
    width: 22px;
    height: 22px;
  }

  .sci-fi-switch.active .switch-thumb {
    left: calc(100% - 25px);
  }

  .switch-indicator {
    font-size: 10px;
    right: 8px;
  }

  .sci-fi-switch.active .switch-indicator {
    right: 45px;
  }
}
</style>
