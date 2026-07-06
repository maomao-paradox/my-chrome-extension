<template>
  <div class="home-container">
    <!-- 导航栏 -->
    <nav class="navbar" :class="{ 'navbar-scrolled': isNavScrolled }">
      <div class="container">
        <div class="navbar-brand">
          <h1 class="logo">MRIA <span class="logo-accent">Extension</span></h1>
        </div>
        <ul class="navbar-menu">
          <li class="navbar-item"><a href="#home" class="navbar-link"
              @click.prevent="$emit('scrollToSection', 'home')">首页</a>
          </li>
          <li class="navbar-item"><a href="#features" class="navbar-link"
              @click.prevent="$emit('scrollToSection', 'features')">功能</a></li>
          <li class="navbar-item"><a href="#about" class="navbar-link"
              @click.prevent="$emit('scrollToSection', 'about')">关于我们</a></li>
          <li class="navbar-item"><a href="#services" class="navbar-link"
              @click.prevent="$emit('scrollToSection', 'services')">服务</a></li>
          <li class="navbar-item"><a href="#contact" class="navbar-link"
              @click.prevent="$emit('scrollToSection', 'contact')">联系我们</a></li>
        </ul>
        <div class="navbar-actions">
          <a href="#admin" class="btn btn-outline" @click.prevent="$emit('adminClick')">管理后台</a>
        </div>
        <div class="navbar-user">
          <div class="avatar" @click="$emit('avatarClick')" :class="{ 'avatar-login': !isLoggedIn }">
            <template v-if="isLoggedIn">
              <img src="https://via.placeholder.com/40" alt="用户头像" class="avatar-img">
            </template>
            <template v-else>
              <span class="login-text">未登录</span>
            </template>
          </div>
        </div>
      </div>
    </nav>

    <!-- 页面内容插槽 -->
    <slot></slot>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-brand">
            <h3 class="logo">MRIA <span class="logo-accent">Extension</span></h3>
            <p class="footer-description">为您带来全新的上网体验，强大功能，简洁设计，让您的浏览器更加强大。</p>
            <div class="footer-social">
              <a href="#" class="social-link">🐱</a>
              <a href="#" class="social-link">🐦</a>
              <a href="#" class="social-link">💼</a>
              <a href="#" class="social-link">📧</a>
            </div>
          </div>
          <div class="footer-links">
            <div class="footer-column">
              <h4 class="footer-title">产品</h4>
              <ul class="footer-list">
                <li><a href="#features" class="footer-link"
                    @click.prevent="$emit('scrollToSection', 'features')">功能特性</a>
                </li>
                <li><a href="#" class="footer-link">下载中心</a></li>
                <li><a href="#" class="footer-link">更新日志</a></li>
                <li><a href="#" class="footer-link">系统要求</a></li>
              </ul>
            </div>
            <div class="footer-column">
              <h4 class="footer-title">公司</h4>
              <ul class="footer-list">
                <li><a href="#about" class="footer-link" @click.prevent="$emit('scrollToSection', 'about')">关于我们</a>
                </li>
                <li><a href="#services" class="footer-link"
                    @click.prevent="$emit('scrollToSection', 'services')">我们的服务</a>
                </li>
                <li><a href="#contact" class="footer-link" @click.prevent="$emit('scrollToSection', 'contact')">联系我们</a>
                </li>
                <li><a href="#" class="footer-link">加入我们</a></li>
              </ul>
            </div>
            <div class="footer-column">
              <h4 class="footer-title">支持</h4>
              <ul class="footer-list">
                <li><a href="#" class="footer-link">帮助中心</a></li>
                <li><a href="#" class="footer-link">常见问题</a></li>
                <li><a href="#" class="footer-link">隐私政策</a></li>
                <li><a href="#" class="footer-link">使用条款</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p class="footer-copyright">© 2025 MRIA Extension. 保留所有权利。</p>
        </div>
      </div>
    </footer>

    <!-- 回到顶部按钮 -->
    <button class="back-to-top" :class="{ 'show': showBackToTop }" @click="$emit('scrollToTop')">
      ↑
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useEventListener } from '@/event'

// Props
const props = defineProps<{
  isLoggedIn: boolean;
}>();

// Emits
const emit = defineEmits<{
  scrollToSection: [sectionId: string];
  scrollToTop: [];
  avatarClick: [];
  adminClick: [];
}>();

// 导航栏滚动状态
const isNavScrolled = ref(false);
// 回到顶部按钮状态
const showBackToTop = ref(false);

// 监听滚动事件
const handleScroll = () => {
  const scrollY = window.scrollY;
  isNavScrolled.value = scrollY > 50;
  showBackToTop.value = scrollY > 300;
};

useEventListener(window, 'scroll', handleScroll, { passive: true })
</script>

<style scoped>
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f8f9fa;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 导航栏样式 */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  z-index: 1000;
  transition: all 0.3s ease;
}

.navbar-scrolled {
  /* background: rgba(255, 255, 255, 0.95); */
  /* 透明度 */
  opacity: 0.5;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
}

.navbar-scrolled:hover {
  opacity: 0.95;
}

.navbar .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  gap: 20px;
}

.logo {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
  color: white;
  transition: color 0.3s ease;
}

.navbar-scrolled .logo {
  color: #333;
}

.navbar-scrolled:hover .logo {
  color: white;
}

.logo-accent {
  color: #667eea;
}

.navbar-menu {
  display: flex;
  list-style: none;
  gap: 30px;
}

.navbar-link {
  text-decoration: none;
  color: white;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
}

.navbar-scrolled .navbar-link {
  color: #666;
}

.navbar-scrolled:hover .navbar-link {
  color: white;
}

.navbar-link:hover {
  color: #667eea;
}

.navbar-link::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 0;
  height: 2px;
  background: #667eea;
  transition: width 0.3s ease;
}

.navbar-link:hover::after {
  width: 100%;
}

.home-container {
  min-height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  color: white;
  overflow-x: hidden;
  position: relative;
}

/* 添加星空背景效果 */
.home-container::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image:
    radial-gradient(2px 2px at 20px 30px, #ffffff, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 40px 70px, #ffffff, rgba(0, 0, 0, 0)),
    radial-gradient(1px 1px at 90px 40px, #ffffff, rgba(0, 0, 0, 0)),
    radial-gradient(1px 1px at 130px 80px, #ffffff, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 160px 30px, #ffffff, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 200px 100px, #ffffff, rgba(0, 0, 0, 0));
  background-repeat: repeat;
  background-size: 200px 200px;
  opacity: 0.15;
  z-index: -1;
  animation: starTwinkle 8s ease-in-out infinite;
}

@keyframes starTwinkle {

  0%,
  100% {
    opacity: 0.5;
  }

  50% {
    opacity: 0.8;
  }
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

.btn-secondary {
  background: transparent;
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background: white;
  color: #667eea;
  transform: translateY(-2px);
}

.btn-lg {
  padding: 15px 30px;
  font-size: 1.1rem;
}

/* 导航栏按钮样式 */
.navbar-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.btn-outline {
  background: transparent;
  color: white;
  border: 2px solid white;
}

.navbar-scrolled .btn-outline {
  color: #667eea;
  border-color: #667eea;
}

.btn-outline:hover {
  background: white;
  color: #667eea;
  transform: translateY(-2px);
}

.navbar-scrolled .btn-outline:hover {
  background: #667eea;
  color: white;
}

/* 用户头像样式 */
.navbar-user {
  display: flex;
  align-items: center;
}

.avatar {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
}

.avatar:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.avatar-login {
  background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.login-text {
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
  text-align: center;
}

/* 响应式导航栏调整 */
@media (max-width: 1200px) {
  .navbar-actions {
    display: none;
  }
}

/* 页脚样式 */
.footer {
  background: #333;
  color: white;
  padding: 80px 0 40px;
}

.footer .container {
  max-width: 1200px;
}

.footer-content {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 60px;
  margin-bottom: 60px;
}

.footer-brand .logo {
  color: white;
  margin-bottom: 20px;
}

.footer-description {
  color: #ccc;
  margin-bottom: 30px;
  line-height: 1.6;
}

.footer-social {
  display: flex;
  gap: 15px;
}

.social-link {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-decoration: none;
  transition: all 0.3s ease;
  font-size: 1.2rem;
}

.social-link:hover {
  background: #667eea;
  transform: translateY(-3px);
}

.footer-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 20px;
  color: white;
}

.footer-list {
  list-style: none;
}

.footer-list li {
  margin-bottom: 15px;
}

.footer-link {
  color: #ccc;
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-link:hover {
  color: #667eea;
}

.footer-bottom {
  border-top: 1px solid #555;
  padding-top: 40px;
  text-align: center;
  color: #999;
}

/* 回到顶部按钮 */
.back-to-top {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 50px;
  height: 50px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
  z-index: 999;
}

.back-to-top.show {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.back-to-top:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

/* 响应式设计 */
@media (max-width: 992px) {
  .footer-content {
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
}

@media (max-width: 768px) {
  .navbar-menu {
    display: none;
  }

  .footer-content {
    grid-template-columns: 1fr;
  }
}
</style>