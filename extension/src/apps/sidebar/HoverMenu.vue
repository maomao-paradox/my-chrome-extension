<template>
  <!-- 只在expanded为true时显示整个菜单容器 -->
  <div class="dock" ref="dockRef" style="position: fixed; right: 0;top:50%;">
    <div
      v-show="mikuTriggerVisible"
      class="miku-trigger"
      aria-label="打开 Miku 对话"
      @click.stop="toggleMikuChat"
      style="position: absolute; right: -84px; width: 126px; height: auto"
    >
      <img :src="mikuSrc" alt="Miku trigger" aria-hidden="true" width="100%"/>
    </div>
    <!-- <li
      v-for="(it, i) in items"
      :key="it.id"
      class="dock-cell"
      @mouseenter="onMouseEnter(i)"
      @mouseleave="onMouseLeave()"
      @click="onClick(i)"
      :style="{ '--delay': i * 0.12 + 's' }"
    >
      <div
        class="dock-icon"
        :class="{ hover: hoverIdx === i }"
        :style="{ '--c': it.color || getRainbowColor(i) }"
      >
        <component :is="it.icon || IconCommunity" class="ic" />
      </div>
      <div v-if="hoverIdx === i && it.label" class="tip">{{ it.label }}</div>
    </li> -->
  </div>
  <MikuChatWindow v-if="mikuChatVisible" @close="toggleMikuChat" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { Tool } from "@/types";
import { IconCommunity } from "@icons/index";
import { eventManager } from "@/event";
import MikuChatWindow from "./MikuChatWindow.vue";

// Props定义
const props = defineProps<{
  items: Tool[];
  layout?: "vertical" | "horizontal" | "fold";
  visible?: boolean;
}>();

// 彩虹色数组
const rainbowColors = [
  "#FF0000", // 红色
  "#FF7F00", // 橙色
  "#FFFF00", // 黄色
  "#00FF00", // 绿色
  "#0000FF", // 蓝色
  "#4B0082", // 靛蓝色
  "#9400D3", // 紫色
];

// 根据索引获取彩虹色
const getRainbowColor = (index: number) => {
  // 使用模运算确保索引不会超出数组范围
  return rainbowColors[index % rainbowColors.length];
};

const hoverIdx = ref<number>(-1); // 用于控制悬浮效果和提示文本
const mikuTriggerVisible = ref(false);
const mikuChatVisible = ref(false);

const mikuSrc = chrome.runtime.getURL("static/img/miku.png");

// 鼠标进入一级菜单 - 控制悬浮效果和提示文本
const onMouseEnter = (i: number) => {
  hoverIdx.value = i;
};

const onMouseLeave = () => {
  hoverIdx.value = -1;
};

const emit = defineEmits<{
  click: [item: Tool];
}>();

const toggleMikuChat = () => {
  mikuTriggerVisible.value = !mikuTriggerVisible.value;
  mikuChatVisible.value = !mikuChatVisible.value;
};

// 点击一级菜单 - 控制子菜单显示
const onClick = (i: number) => {
  const item = props.items[i];
  // 发出点击事件
  emit("click", item);
  // 点击已经激活的菜单项，不做任何操作
  if (hoverIdx.value === i) {
    return;
  }
};

const dockRef = ref<HTMLDivElement>();

// 显示整个菜单
const show = () => {
  dockRef.value?.classList.add("active");
};

// 隐藏整个菜单
const hide = () => {
  dockRef.value?.classList.remove("active");
};

// 处理键盘事件 - 监听Ctrl+Q快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  // 添加调试日志
  maLogger.log("Key pressed:", event.key, "ctrlKey:", event.ctrlKey);
  // 检查是否按下了Ctrl+Q
  if (event.ctrlKey && event.key.toLowerCase() === "q") {
    // 阻止默认行为
    event.preventDefault();
    // 显示菜单
    dockRef.value?.classList.toggle("hover");
  }
};

eventManager.useBus({ show: show, hide: hide });
eventManager.useListener("keydown", handleKeyDown);

// 组件生命周期
onMounted(() => {
  mikuTriggerVisible.value = true;
  setTimeout(() => {
    show();
  }, 100);

  setTimeout(() => {
    hide();
  }, 500);
});
</script>

<style scoped lang="scss">
$dock-z-index: 9999;
$dock-border-radius: 10px;
$icon-size: 40px;
$icon-border-radius: 20px;
$trigger-width: 126px;
$trigger-offset: 84px;

.dock {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: $dock-z-index;
  opacity: 1;
  transition: opacity 0.6s ease;

  &::before {
    content: "";
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    min-height: 144px;
    height: calc(100% + 32px);
    background: transparent;
    border-radius: $dock-border-radius 0 0 $dock-border-radius;
    cursor: pointer;
    z-index: 1;
  }
}

.miku-trigger {
  position: absolute;
  right: -$trigger-offset;
  top: 50%;
  width: 126px;
  height: auto;
  padding: 0;
  border: none;
  background: transparent;
  transform: translateY(-50%);
  transition:
    transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1),
    filter 0.2s ease;
  cursor: pointer;
  z-index: 2;
  filter: drop-shadow(0 8px 18px rgba(15, 23, 42, 0.24));
  will-change: transform, opacity;

  img {
    width: 100%;
    height: 100%;
    user-select: none;
    -webkit-user-drag: none;
    object-fit: cover; /* 或 contain，按需调整 */
    display: block;
  }

  &:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.85);
    outline-offset: 3px;
    border-radius: 8px;
  }
}

.dock:hover .miku-trigger,
.dock.active .miku-trigger {
  transform: translate(calc(-#{$trigger-offset} + 1px), -50%);
}

.dock-cell {
  display: flex;
  position: relative;
  flex-direction: row-reverse;
  align-items: flex-start;
  right: -50px;
  transform: translateX(0);
  opacity: 1;
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
  z-index: 0;
  transition-delay: var(--delay, 0s);
}

.dock:hover .dock-cell,
.dock.active .dock-cell {
  transform: translateX(-120%);
}

.dock-icon {
  width: $icon-size;
  height: $icon-size;
  background: var(--c, #409eff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1),
    filter 0.25s;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
  position: relative;
  border-radius: $icon-border-radius 0 0 $icon-border-radius;

  &.active,
  &:hover {
    transform: scaleX(1.35) scaleY(1.15);
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2));

    + .tip {
      opacity: 1;
    }
  }
}

.ic {
  width: 20px;
  height: 20px;
}

.tip {
  position: absolute;
  right: 110%;
  top: 50%;
  transform: translateY(-50%);
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
  border-radius: 4px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.arr {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  opacity: 0.8;
}

@media (prefers-reduced-motion: reduce) {
  .dock,
  .dock-cell,
  .dock-icon,
  .miku-trigger,
  .tip {
    transition-duration: 0.01ms;
  }
}
</style>
