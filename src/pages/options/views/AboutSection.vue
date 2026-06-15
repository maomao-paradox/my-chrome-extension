<template>
  <!-- 关于我们区域 -->
  <section class="about" id="about">
    <div class="container">
      <div class="about-content">
        <div class="about-text">
          <h2 class="section-title">关于 MRIA 星空探索计划</h2>
          <p class="about-paragraph">
            MRIA 星空探索计划是一项由国际顶尖科学家和工程师共同发起的宇宙探索项目，致力于探索未知星系，发现宇宙奥秘，为人类的星际移民奠定基础。
          </p>
          <p class="about-paragraph">
            我们的团队由来自世界各地的天文学家、物理学家、工程师和探险家组成，拥有丰富的宇宙探索经验和尖端技术设备。我们坚信，宇宙的奥秘等待着人类去探索，星际旅行将成为现实。
          </p>
          <div class="about-values">
            <div class="value-item">
              <div class="value-icon">🌌</div>
              <h4 class="value-title">探索无限</h4>
              <p class="value-description">探索未知宇宙，发现新的星系和文明</p>
            </div>
            <div class="value-item">
              <div class="value-icon">🚀</div>
              <h4 class="value-title">技术领先</h4>
              <p class="value-description">拥有尖端的宇宙探索技术和设备</p>
            </div>
            <div class="value-item">
              <div class="value-icon">🤝</div>
              <h4 class="value-title">团队协作</h4>
              <p class="value-description">国际顶尖科学家和工程师的紧密合作</p>
            </div>
          </div>
        </div>
        <div class="about-visual">
          <div class="about-image">
            <div class="image-container">
              <div class="image-shape"></div>
              <div class="image-content">
                <div class="team-photo"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// AboutSection组件不需要额外的props，主要是展示内容
</script>

<style scoped>
/* 通用容器 */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 通用区块样式 */
.section-header {
  text-align: center;
  margin-bottom: 60px;
}

.about-visual {
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transform: translateX(30px);
  transition: all 0.8s ease 0.3s;
}

.section-visible .about-visual {
  opacity: 1;
  transform: translateX(0);
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 15px;
}

.section-subtitle {
  font-size: 1.1rem;
  color: #666;
  max-width: 700px;
  margin: 0 auto;
}

/* 关于我们区域 */
.about {
  padding: 120px 0;
  background: linear-gradient(135deg, #00003331 0%, #00006631 50%, #00009931 100%);
}

.about-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.about-text .section-title {
  text-align: left;
}

.about-paragraph {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 25px;
  line-height: 1.8;
}

.about-values {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  margin-top: 40px;
}

.value-item {
  background: white;
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
}

.value-icon {
  font-size: 2rem;
  margin-bottom: 15px;
}

.value-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
}

.value-description {
  font-size: 0.9rem;
  color: #666;
}

.about-image {
  display: flex;
  justify-content: center;
  align-items: center;
}

.image-container {
  position: relative;
}

.image-shape {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);
}

.image-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 250px;
  height: 250px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border: 5px solid white;
}

.team-photo {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 70%, transparent 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 4rem;
  color: white;
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 992px) {
  .about-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .about-values {
    grid-template-columns: 1fr;
  }
}
</style>