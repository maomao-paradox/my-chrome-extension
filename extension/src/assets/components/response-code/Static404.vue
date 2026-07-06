<template>
  <div class="static-404">
    <div class="container">
      <div class="error-code">404</div>
      <div class="error-message">页面未找到</div>
      <div class="error-description">抱歉，您访问的页面不存在或已被移除。</div>
      <!-- <button class="back-button" @click="goBack">返回首页</button> -->
    </div>
  </div>
</template>

<script setup lang="ts">
const goBack = () => {
  window.history.back();
};
</script>

<style scoped>
.static-404 {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.container {
  text-align: center;
  color: white;
  padding: 2rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.error-code {
  font-size: 10rem;
  font-weight: 900;
  margin: 0;
  line-height: 1;
  background: linear-gradient(45deg, #ffffff, #f0f0f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.error-message {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 1rem 0 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.error-description {
  font-size: 1.2rem;
  margin: 1rem 0 2.5rem;
  opacity: 0.9;
  max-width: 400px;
  line-height: 1.5;
}

.back-button {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #667eea;
  background: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.back-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.back-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .error-code {
    font-size: 7rem;
  }
  
  .error-message {
    font-size: 2rem;
  }
  
  .error-description {
    font-size: 1rem;
    padding: 0 1rem;
  }
  
  .back-button {
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
  }
}
</style>