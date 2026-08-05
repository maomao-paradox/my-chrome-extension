<template>
  <div class="text-rain-config-component">
    <h3 class="card-title">文字雨设置</h3>

    <!-- 文字雨开关 -->
    <div class="toggle-item">
      <label class="toggle-label">文字雨屏保</label>
      <label class="toggle-switch">
        <input v-model="textRainConfig.value" type="checkbox" @change="onConfigChange" />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <!-- 密度滑块 -->
    <div class="slider-container">
      <label for="density-slider" class="slider-label">雨滴密度</label>
      <div class="slider-wrapper">
        <input id="density-slider" v-model.number="textRainConfig.density" type="range" :min="textRainConfig.min"
          :max="textRainConfig.max" :step="textRainConfig.step" class="slider" @change="onConfigChange" />
        <span class="slider-value">{{ textRainConfig.density }}</span>
      </div>
      <div class="slider-info">值越小，密度越大</div>
    </div>

    <!-- 自定义弹幕输入 -->
    <div class="bullet-input-section">
      <h4 class="section-subtitle">添加自定义弹幕</h4>
      <div class="input-group">
        <input v-model="newBulletText" type="text" placeholder="请输入弹幕内容..." maxlength="20" class="text-input"
          @keyup.enter="addBullet" />
        <button class="send-btn" :disabled="!newBulletText.trim()" @click="addBullet">
          发送
        </button>
      </div>
      <div class="char-count">{{ newBulletText.length }}/20</div>
    </div>

    <!-- 已添加的弹幕列表 -->
    <div v-if="customBullets.length > 0" class="bullet-list-section">
      <h4 class="section-subtitle">已添加弹幕 ({{ customBullets.length }})</h4>
      <div class="bullet-tags">
        <span v-for="(bullet, index) in customBullets" :key="index" class="bullet-tag" @click="removeBullet(index)">
          {{ bullet }}
          <span class="remove-icon">×</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue';
import { sendMessageToContentScript } from '@/message/back-content';
import { ConfigItem } from '@/types';

// Props
const props = defineProps<{
  modelValue: ConfigItem;
}>();

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: ConfigItem];
  'configChange': [];
}>();

// 响应式数据 - 深度克隆配置对象
const textRainConfig = ref<ConfigItem>({
  ...props.modelValue
});
const newBulletText = ref('');
const customBullets = ref<string[]>([]);

// 监听props变化
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    // 深度合并新的配置
    textRainConfig.value = { ...newVal };
  }
}, { deep: true });

// 处理配置变化
const onConfigChange = () => {
  emit('update:modelValue', { ...textRainConfig.value });
  emit('configChange');
};

// 添加自定义弹幕
const addBullet = async (): Promise<void> => {
  const text = newBulletText.value.trim();
  if (!text) {return;}

  try {
    // 保存到localStorage
    const bullets = [...customBullets.value];
    if (!bullets.includes(text)) {
      bullets.push(text);
      customBullets.value = bullets;
      localStorage.setItem('customBulletTexts', JSON.stringify(bullets));
    }

    // 发送消息通知content脚本更新弹幕
    await sendMessageToContentScript({
      action: 'ADD_BULLET_TEXT',
      payload: text
    });

    // 清空输入框
    newBulletText.value = '';

  } catch (e) {
    maLogger.error('添加弹幕失败:', e);
  }
};

// 移除弹幕
const removeBullet = (index: number): void => {
  customBullets.value.splice(index, 1);
  localStorage.setItem('customBulletTexts', JSON.stringify(customBullets.value));
};

// 组件挂载时加载已保存的弹幕
onMounted(() => {
  try {
    const savedBullets = localStorage.getItem('customBulletTexts');
    if (savedBullets) {
      customBullets.value = JSON.parse(savedBullets);
    }
  } catch (e) {
    maLogger.error('加载已保存弹幕失败:', e);
  }
});
</script>

<style scoped>
.text-rain-config-component {
  background: rgba(30, 41, 59, 0.7);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.card-title {
  color: #f8fafc;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px 0;
}

.section-subtitle {
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 500;
  margin: 16px 0 10px 0;
}

/* 开关样式 */
.toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.toggle-label {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #475569;
  transition: .4s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked+.toggle-slider {
  background-color: #3b82f6;
}

input:checked+.toggle-slider:before {
  transform: translateX(24px);
}

/* 滑块样式 */
.slider-container {
  margin-bottom: 20px;
}

.slider-label {
  display: block;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #475569;
  outline: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.slider::-moz-range-thumb:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.slider-value {
  color: #3b82f6;
  font-weight: 600;
  min-width: 30px;
  text-align: center;
}

.slider-info {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

/* 输入框样式 */
.bullet-input-section {
  margin-bottom: 16px;
}

.input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.text-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.5);
  color: #f8fafc;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.text-input:focus {
  border-color: #3b82f6;
  background: rgba(15, 23, 42, 0.8);
}

.text-input::placeholder {
  color: #94a3b8;
}

.send-btn {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
}

.send-btn:active:not(:disabled) {
  transform: translateY(0);
}

.send-btn:disabled {
  background: #475569;
  cursor: not-allowed;
  opacity: 0.6;
}

.char-count {
  font-size: 12px;
  color: #94a3b8;
  text-align: right;
}

/* 弹幕标签样式 */
.bullet-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 120px;
  overflow-y: auto;
  padding-right: 4px;
}

.bullet-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bullet-tag:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}

.remove-icon {
  font-size: 16px;
  font-weight: bold;
  color: #fca5a5;
  transition: color 0.2s ease;
}

.bullet-tag:hover .remove-icon {
  color: #ef4444;
}

/* 滚动条样式 */
.bullet-tags::-webkit-scrollbar {
  width: 4px;
}

.bullet-tags::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}

.bullet-tags::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.bullet-tags::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>