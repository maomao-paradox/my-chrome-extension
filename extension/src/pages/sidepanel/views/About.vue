<template>
  <div class="panel">
    <div class="panel-title">关于扩展</div>
    <div class="info-display">
      <div class="info-item">
        <span class="info-label">版本:</span>
        <span class="info-value">1.0.0</span>
      </div>
      <div class="info-item">
        <span class="info-label">开发者:</span>
        <span class="info-value">MRIA Team</span>
      </div>
      <div class="info-item">
        <span class="info-label">更新时间:</span>
        <span class="info-value">2023-11-15</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 这里可以添加关于扩展的逻辑
</script>

<style scoped>
.panel {
  background-color: var(--panel-bg);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
  transition: var(--transition);
}

.panel:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.panel-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: var(--text-color);
  position: relative;
  padding-left: 12px;
}

.panel-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  background-color: var(--primary-color);
  border-radius: 2px;
}

.info-display {
  background-color: rgba(64, 158, 255, 0.05);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 4px;
  padding: 12px;
  margin-top: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: var(--text-secondary-color);
}

.info-value {
  color: var(--text-regular-color);
  font-weight: 500;
  word-break: break-all;
  text-align: right;
}
</style>