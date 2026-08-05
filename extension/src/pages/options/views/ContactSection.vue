<template>
  <!-- 联系我们区域 -->
  <section id="contact" class="contact">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">联系星空探索中心</h2>
        <p class="section-subtitle">加入我们的宇宙探索之旅，一起探索未知的星空。</p>
      </div>
      <div class="contact-content">
        <div class="contact-info">
          <div class="contact-item">
            <div class="contact-icon">📧</div>
            <div class="contact-details">
              <h4>星际通讯</h4>
              <p>contact@mria.star</p>
            </div>
          </div>
          <div class="contact-item">
            <div class="contact-icon">📍</div>
            <div class="contact-details">
              <h4>星际坐标</h4>
              <p>银河象限: 3-1-4</p>
            </div>
          </div>
          <div class="contact-item">
            <div class="contact-icon">📞</div>
            <div class="contact-details">
              <h4>星际热线</h4>
              <p>24/7 宇宙时间服务</p>
            </div>
          </div>
        </div>
        <div class="contact-form">
          <form>
            <div class="form-group">
              <input type="text" class="form-input" placeholder="您的探索者姓名">
            </div>
            <div class="form-group">
              <input type="email" class="form-input" placeholder="您的星际邮箱">
            </div>
            <div class="form-group">
              <textarea class="form-textarea" placeholder="您的探索请求" rows="5"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">发送探索请求</button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// ContactSection组件不需要额外的props，主要是展示内容
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

/* 联系我们区域 */
.contact {
  padding: 120px 0;
  background: linear-gradient(135deg, #00003331 0%, #00006631 50%, #00009931 100%);
}

.contact-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.contact-item {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.contact-icon {
  font-size: 2rem;
  color: #667eea;
  margin-top: 5px;
}

.contact-details h4 {
  font-size: 1.1rem;
  margin-bottom: 5px;
  color: #333;
}

.contact-details p {
  color: #666;
  margin: 0;
}

.contact-form {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e0e0e0;
}

.form-group {
  margin-bottom: 25px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 150px;
}

.btn-block {
  width: 100%;
}

/* 按钮样式 */
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-block;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

/* 响应式设计 */
@media (max-width: 992px) {
  .contact-content {
    grid-template-columns: 1fr;
  }
}
</style>