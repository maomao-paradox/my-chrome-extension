<template>
  <!-- 合作伙伴区域 -->
  <section class="partners">
    <div class="container">
      <h3 class="partners-title">我们的合作伙伴</h3>
      <div class="partners-grid">
        <div v-for="(partner, index) in partners" :key="index" class="partner-item">
          {{ partner.name }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// 定义Partner接口
interface Partner {
  name: string;
}

// 接收props
defineProps<{
  partners: Partner[];
}>();
</script>

<style scoped>
/* 合作伙伴区域 */
.partners {
  padding: 80px 0;
  background: linear-gradient(135deg, #00003331 0%, #00006631 50%, #00009931 100%);
}

/* 通用容器 */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.partners-title {
  text-align: center;
  font-size: 1.5rem;
  color: #666;
  margin-bottom: 40px;
}

.partners-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 40px;
}

.partner-item {
  text-align: center;
  font-size: 1.2rem;
  font-weight: 600;
  color: #666;
  padding: 20px;
  transition: all 0.3s ease;
  border-radius: 8px;
}

.partner-item:hover {
  background: white;
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  color: #667eea;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .partners-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>