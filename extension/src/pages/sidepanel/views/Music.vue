<template>
  <div class="music-container">
    <h1 class="music-title">🎵 音乐</h1>
    <div class="music-content">
      <p class="placeholder-text">音乐播放器功能开发中...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Music page component
</script>

<style scoped>
.music-container {
  padding: 20px;
  height: 100%;
  background: var(--bg-primary);
}

.music-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--primary-color);
  display: inline-block;
}

.music-content {
  margin-top: 20px;
}

.placeholder-text {
  color: var(--text-secondary);
  font-size: 14px;
  text-align: center;
  padding: 40px;
}
</style>
