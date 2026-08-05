<template>
    <div class="container">
        <p class="search-letters">se</p>
        <div class="input-wrapper" :class="{ 'active': isActive }">
            <div class="search-icon icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBEFF9" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </div>
            <textarea id="search" ref="searchInput" v-model="inputModel" class="animated-search"
                autocomplete="off" wrap="soft" maxlength="500" @click="toggleSearch($event)"
                @keyup.ctrl.enter="submitQuestion" />
            <div class="close-icon icon" @click="clearField($event)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBEFF9" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </div>
        </div>
        <p class="search-letters">rch</p>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

interface AnimatedSearchProps {
}

const [inputModel, modifiers] = defineModel<string>('input-value', {
  set(value) {
    if (modifiers['?']) {
      return value.replace(/[\?, ？]/g, '');
    }
    // 拦截所有问号，无论是否使用修饰符
    return value;
  }
});
const props = defineProps<AnimatedSearchProps>();
const searchInput = ref<HTMLTextAreaElement>();
const inputWidth = 500;

const emit = defineEmits(['submitQuestion']);

const isActive = ref(false);

function submitQuestion() {
  if (!inputModel.value) {
    searchInput.value?.focus();
    return;
  }
  maLogger.log('提交问题', inputModel.value);
  emit('submitQuestion', inputModel.value);
}

watch(() => inputModel.value, (newValue) => {
  if (!isActive.value) {return;}

  const textarea = searchInput.value;
  if (!textarea) {return;}

  // 创建隐藏元素来测量文本宽度
  const tempSpan = document.createElement('span');
  // 确保隐藏元素的样式与输入框完全一致
  const computedStyle = getComputedStyle(textarea);
  tempSpan.style.fontSize = computedStyle.fontSize;
  tempSpan.style.fontFamily = computedStyle.fontFamily;
  tempSpan.style.fontWeight = computedStyle.fontWeight;
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.position = 'absolute';
  tempSpan.style.whiteSpace = 'nowrap';
  tempSpan.style.padding = '0';
  tempSpan.style.margin = '0';
  tempSpan.textContent = newValue || '';
  document.body.appendChild(tempSpan);

  // 测量文本宽度
  const textWidth = tempSpan.offsetWidth;
  document.body.removeChild(tempSpan);

  // 计算最终宽度，确保至少为inputWidth
  const finalWidth = Math.max(inputWidth, textWidth + 100); // 100px 为左右内边距和按钮的空间
  textarea.style.width = finalWidth + 'px';

  // 如果达到最大宽度800px，则需要换行显示了
  if (finalWidth >= 800) {
    textarea.style.height = 'auto';
  }
});

function toggleSearch(event: Event) {
  // 防止点击输入框内部时重复触发
  if (isActive.value) {
    event.stopPropagation();
    return;
  }

  // 聚焦输入框
  setTimeout(() => {
    isActive.value = true;
    searchInput.value?.focus();
    updateTextareaShape();
  }, 100);
}

function clearField(event: Event) {
  // 防止事件冒泡，避免触发 textarea 的点击事件
  event.stopPropagation();

  maLogger.log('点击清除图标', inputModel.value?.length);

  if (inputModel.value?.length === 0) {
    isActive.value = false;
  } else {
    // 同时清空 inputModel.value 和 textarea.value
    inputModel.value = '';
        searchInput.value!.value = '';
  }
  maLogger.log('清空输入框', inputModel.value);
  maLogger.log(searchInput.value?.value);

  updateTextareaShape();
}

function updateTextareaShape() {
  if (!searchInput.value) {return;}

  const textarea = searchInput.value;
  const lines = textarea.value.split(/\r\n|\r|\n/).length;
  const style = getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight);
  const paddingTop = parseFloat(style.paddingTop);
  const paddingBottom = parseFloat(style.paddingBottom);
  const isExpanded = isActive.value;

  if (!textarea.value) {
    textarea.style.height = '45px';
    textarea.style.borderRadius = '22.5px';
    maLogger.log('重置为初始的圆形状态');
    if (isExpanded) {
      // 没有内容但处于激活状态，保持展开的宽度
      textarea.style.width = inputWidth + 'px';
    } else {
      // 没有内容且不处于激活状态，重置为初始的圆形状态
      textarea.style.width = '45px';
    }
  } else {
    const contentHeight = lines * lineHeight;
    const containerHeight = contentHeight + paddingTop + paddingBottom;
    const width = isExpanded ? inputWidth : 45;
    textarea.style.width = width + 'px';
    textarea.style.height = containerHeight + 'px';

    setTimeout(() => {
      textarea.style.borderRadius = Math.round(containerHeight / 2) + 'px';
    }, 16);
  }
}

onMounted(() => {
});
</script>

<!-- <style>
@import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap');

/* body {
    background-color: #93aa93;
    overflow: hidden;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
}

body,
html {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
} */
</style> -->

<style scoped>
@font-face {
    font-family: 'Comfortaa';
    src: url('/static/front/Comfortaa-VariableFont_wght.ttf') format('truetype');
    font-weight: 300;
    font-style: normal;
    font-display: swap;
}
.container {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 10;
    user-select: none;
    padding: 20px;
    min-width: 400px;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    overflow: hidden;
}

.container svg {
    flex: 0 0 auto;
    height: 100px;
    overflow: visible;
    position: relative;
}

.input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    margin-left: 4px;
    margin-right: 14px;
    max-width: 800px;
}

.input-wrapper::after {
    content: '';
    position: absolute;
    display: block;
    right: 0;
    bottom: 0;
    /* right: -3px; */
    width: 5px;
    border-radius: 3.25px;
    /* 边框宽度 */
    height: 50%;
    /* 高度为容器的一半，只显示下半部分 */
    background-color: #42AB40;
    /* 边框颜色 */
}

.input-wrapper.active::after {
    width: 4px;
}

.input-wrapper.active .icon {
    display: block;
}

.icon {
    display: none;
    margin-top: 2px;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    opacity: 0.8;
}

.search-icon {
    left: 15px;
    pointer-events: none;
}

.close-icon {
    right: 15px;
    cursor: pointer;
}

.close-icon:hover {
    opacity: 1;
}

.animated-search {
    display: inline-block;
    width: 45px;
    height: 45px;
    padding: 5px 10px;
    border: 5px solid #42AB40;
    background: transparent;
    font-size: 25px;
    font-family: 'Quicksand', sans-serif;
    font-weight: 400;
    color: #FBEFF9;
    line-height: 34px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: width, height, border-radius;
    backface-visibility: hidden;
    transform: translateZ(0);
    box-sizing: border-box;
    resize: none;
    border-radius: 22.5px;
    text-align: center;
    opacity: 1;
    /* right: -3px; */
    position: relative;
    z-index: 1;
    overflow: hidden;
}

.input-wrapper.active .animated-search {
    width: 350px;
    text-align: left;
    border-radius: 20.5px;
    padding: 0 35px;
    border-width: 4px;
}

.animated-search:focus {
    outline: none;
}

.search-letters {
    position: relative;
    letter-spacing: 10px;
    font-size: 80px;
    top: -4px;
    font-family: 'Comfortaa', 'Roboto', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #FBEFF9;
    font-weight: 300;
}
</style>