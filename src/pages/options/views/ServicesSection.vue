<template>
  <!-- 服务区域 -->
  <section class="services" id="services">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">我们的服务</h2>
        <p class="section-subtitle">为您提供全方位的浏览器增强服务，满足您的各种需求。</p>
      </div>
      <div class="services-grid">
        <div class="service-card" v-for="(service, index) in services" :key="index">
          <div class="service-icon">{{ service.icon }}</div>
          <h3 class="service-title">{{ service.title }}</h3>
          <p class="service-description">{{ service.description }}</p>
          <a href="#" class="service-link">了解更多 →</a>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// 定义Service接口
interface Service {
  icon: string;
  title: string;
  description: string;
}

// 接收props
const props = defineProps<{
  services: Service[];
}>();
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

/* 服务区域 */
.services {
  padding: 120px 0;
  background: linear-gradient(135deg, #00003331 0%, #00006631 50%, #00009931 100%);
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 40px;
}

.service-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 1px solid #e0e0e0;
}

.service-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
}

.service-icon {
  font-size: 2.5rem;
  margin-bottom: 20px;
  color: #667eea;
}

.service-title {
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: #333;
}

.service-description {
  color: #666;
  margin-bottom: 25px;
  line-height: 1.6;
}

.service-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.service-link:hover {
  color: #764ba2;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .services-grid {
    grid-template-columns: 1fr;
  }
}
</style>