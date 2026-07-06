<template>
  <!-- 特色功能区域 -->
  <section class="features" id="features">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">强大功能</h2>
        <p class="section-subtitle">为您提供全方位的浏览器增强体验，让您的上网更加高效、安全、便捷。</p>
      </div>
      <div class="features-grid">
        <div class="feature-card" v-for="(feature, index) in features" :key="index">
          <div class="feature-icon" :style="{ background: feature.color }">{{ feature.icon }}</div>
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-description">{{ feature.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// 定义Feature接口
interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

// 接收props
const props = withDefaults(defineProps<{
  features?: Feature[];
}>(), {
  features: () => [
    {
      icon: '🌌',
      title: '星系探索',
      description: '探索未知星系，发现宇宙奥秘',
      color: 'linear-gradient(135deg, #000033 0%, #000066 100%)'
    },
    {
      icon: '🛰️',
      title: '星际导航',
      description: '智能星际导航系统，指引您的宇宙之旅',
      color: 'linear-gradient(135deg, #00BFFF 0%, #1E90FF 100%)'
    },
    {
      icon: '🛡️',
      title: '宇宙防护',
      description: '全方位保护您的星际探索安全',
      color: 'linear-gradient(135deg, #8A2BE2 100%)'
    },
    {
      icon: '🔭',
      title: '天体观测',
      description: '实时观测宇宙天体，探索星空奇观',
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      icon: '📊',
      title: '星空数据',
      description: '详细的宇宙数据统计，了解星系运行规律',
      color: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
    },
    {
      icon: '🔄',
      title: '时空扭曲',
      description: '扭曲时空，实现星际穿越',
      color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
    }
  ]
});
</script>

<style scoped>
/* 通用区块样式 */
.section-header {
  text-align: center;
  margin-bottom: 60px;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 15px;
}

/* 通用容器 */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.section-subtitle {
  font-size: 1.1rem;
  color: #666;
  max-width: 700px;
  margin: 0 auto;
}

/* 特色功能区域 */
.features {
  padding: 120px 0;
  background: linear-gradient(135deg, #00003331 0%, #00006631 50%, #00009931 100%);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 30px;
}

.feature-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 1px solid #e0e0e0;
}

.feature-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
}

.feature-icon {
  width: 60px;
  height: 60px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin-bottom: 20px;
}

.feature-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: #333;
}

.feature-description {
  color: #666;
  line-height: 1.6;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>