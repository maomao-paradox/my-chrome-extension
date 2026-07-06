<template>
  <div class="common-layout">
    <GlassCursor />
    <div class="background-decoration">
      <Push />
    </div>
    <div class="page-container">
      <transition name="page-transition" mode="out-in">
        <Layout :is-logged-in="isLoggedIn" @scroll-to-section="scrollToSection" @scroll-to-top="scrollToTop"
          @avatar-click="handleAvatarClick" @admin-click="handleAdminClick">
          <!-- 英雄区域 -->
          <HeroSection />

          <!-- 特色功能区域 -->
          <FeaturesSection :features="features" />

          <!-- 关于我们区域 -->
          <AboutSection />

          <!-- 服务区域 -->
          <ServicesSection :services="services" />

          <!-- 合作伙伴区域 -->
          <PartnersSection :partners="partners" />

          <!-- 联系我们区域 -->
          <ContactSection />
        </Layout>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import GlassCursor from '@components/cursors/GlassCursor.vue';
import Push from '@components/particles/push.vue'
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import Layout from '@components/layout/Layout.vue';
import HeroSection from './views/HeroSection.vue';
import FeaturesSection from './views/FeaturesSection.vue';
import AboutSection from './views/AboutSection.vue';
import ServicesSection from './views/ServicesSection.vue';
import PartnersSection from './views/PartnersSection.vue';
import ContactSection from './views/ContactSection.vue';

// 登录状态
const isLoggedIn = computed(() => localStorage.getItem('mria-logged-in') === 'true');

// 滚动到指定区域
const scrollToSection = (sectionId: string) => {
  const section = document.getElementById(sectionId);
  if (section) {
    const offsetTop = section.offsetTop - 80; // 考虑导航栏高度
    window.scrollTo({
      top: offsetTop,
      behavior: 'smooth'
    });
  }
};

// 滚动到顶部
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

// 头像点击处理
const handleAvatarClick = () => {
  if (!isLoggedIn.value) {
    // 跳转到登录页面
    window.location.href = '#/login';
    ElMessage.info('跳转到登录页面');
  } else {
    // 已登录，可以显示用户菜单
    ElMessage.info('显示用户菜单');
  }
};

// 管理后台点击处理
const handleAdminClick = () => {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录');
    return;
  }
  // 已登录，跳转到管理后台
  window.location.href = '#/admin';
  ElMessage.info('跳转到管理后台');
};

// 功能数据
const features = [
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
];

// 服务数据
const services = [
  {
    icon: '👨🚀',
    title: '星际探险队',
    description: '加入我们的星际探险队，探索未知宇宙'
  },
  {
    icon: '📡',
    title: '卫星部署',
    description: '部署专属卫星，实时观测宇宙'
  },
  {
    icon: '🌍',
    title: '行星开发',
    description: '开发新行星，建立星际殖民地'
  },
  {
    icon: '🔬',
    title: '宇宙研究',
    description: '参与宇宙科学研究，探索宇宙奥秘'
  }
];

// 合作伙伴数据
const partners = [
  { name: '星际联盟' },
  { name: '银河探索局' },
  { name: '宇宙科技公司' },
  { name: '星际贸易联盟' },
  { name: '宇宙研究中心' }
];

// 定义响应式状态
// const isLoggedIn = ref(false);
// const router = useRouter();

// 处理登出函数
// const handleLogout = async (): Promise<void> => {
//   try {
//     // 显示确认对话框
//     await ElMessageBox.confirm(
//       '确定要退出登录吗？',
//       '确认退出',
//       {
//         confirmButtonText: '确定',
//         cancelButtonText: '取消',
//         type: 'warning',
//         center: true
//       }
//     );

//     // 用户确认后执行登出操作
//     // 清除登录状态
//     clearLoginState();
//     isLoggedIn.value = false;
//     // 重定向到个人主页
//     router.push('/home');
//   } catch (error) {
//     // 用户取消登出，不执行任何操作
//     // 可以添加日志或其他处理
//   }
// };

// 检查登录状态的函数
// const checkLoginStatus = (): void => {
//   isLoggedIn.value = verifyLoginState();
// };

// // 监听路由变化，更新登录状态
// const unsubscribe = router.afterEach(() => {
//   checkLoginStatus();
// });

// // 组件挂载时执行
// onMounted(() => {
//   // 检查登录状态
//   checkLoginStatus();
// });

// // 组件卸载时执行
// onUnmounted(() => {
//   // 取消路由监听
//   // unsubscribe();
// });

</script>

<style>
/* CSS变量定义 - 星空宇宙主题 */
:root {
  /* 主色调 - 宇宙蓝 */
  --primary-color: #00BFFF;
  --primary-light: #1E90FF;
  --primary-dark: #0000FF;

  /* 宇宙辅助色 */
  --cosmic-purple: #8A2BE2;
  --cosmic-pink: #FF1493;
  --cosmic-green: #39FF14;
  --cosmic-orange: #FF4500;

  /* 渐变色 */
  --gradient-primary: linear-gradient(135deg, #00BFFF 0%, #1E90FF 100%);
  --gradient-secondary: linear-gradient(135deg, #000000 0%, #0A0A2A 50%, #1A1A2E 100%);
  --gradient-stars: radial-gradient(2px 2px at 20px 30px, #eee, rgba(0, 0, 0, 0)), radial-gradient(2px 2px at 40px 70px, #fff, rgba(0, 0, 0, 0)), radial-gradient(1px 1px at 90px 40px, #fff, rgba(0, 0, 0, 0)), radial-gradient(1px 1px at 130px 80px, #fff, rgba(0, 0, 0, 0)), radial-gradient(2px 2px at 160px 30px, #fff, rgba(0, 0, 0, 0));

  /* 背景色 */
  --bg-primary: #000000;
  --bg-secondary: #0A0A2A;
  --bg-card: rgba(10, 10, 42, 0.85);
  --bg-hover: rgba(0, 191, 255, 0.15);

  /* 文本色 */
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-tertiary: #484F58;

  /* 边框和分隔线 */
  --border-color: #1A1A2E;
  --border-light: rgba(26, 26, 46, 0.6);

  /* 阴影 */
  --shadow-sm: 0 1px 3px rgba(0, 191, 255, 0.2);
  --shadow-md: 0 4px 8px rgba(0, 191, 255, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 191, 255, 0.4);

  /* 发光效果 */
  --glow-primary: 0 0 12px rgba(0, 191, 255, 0.6);
  --glow-secondary: 0 0 20px rgba(30, 144, 255, 0.3);
  --glow-cosmic: 0 0 25px rgba(138, 43, 226, 0.5), 0 0 40px rgba(0, 191, 255, 0.3);

  /* 动画时间 */
  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;
}

/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body,
html {
  /* cursor: none !important; */
  min-height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: var(--text-primary);
  background: var(--gradient-secondary);
  line-height: 1.6;
  margin: 0;
  overflow-x: hidden;
  /* cursor: none !important; */
}

#app {
  min-height: 100%;
  overflow: auto;
}

.common-layout {
  min-height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
  position: relative;
  background: var(--bg-primary);
}


router-view {
  flex: 1;
  overflow-y: auto;
}

/* 背景装饰 */
.background-decoration {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

/* 页面过渡效果 */
.page-transition-enter-active,
.page-transition-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.page-transition-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.page-transition-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 布局相关样式 */
.el-header {
  background: var(--bg-secondary) !important;
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
}

.el-header span {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 16px;
}

/* fullpage.js 自定义样式 */
.page-container {
  width: 100% !important;
  height: 100% !important;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.section {
  width: 100% !important;
  height: 100% !important;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: auto;
  padding: 0;
  /* 透明背景 */
  background: rgba(22, 27, 34, 0.8) !important;
  margin: 0;
}

.el-aside {
  background: var(--bg-secondary) !important;
  border-right: 1px solid var(--border-color);
}

.el-main {
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 20px;
  overflow-y: auto;
  height: calc(100vh - 60px);
  /* 减去头部高度 */
}

/* 自定义Element UI样式 */
.el-menu {
  border-right: none;
  background: var(--bg-secondary) !important;
}

.el-menu-item {
  padding: 0 20px !important;
  color: var(--text-secondary) !important;
  transition: all var(--transition-fast) !important;
  border-left: 3px solid transparent !important;
}

.el-menu-item:hover {
  background: var(--bg-hover) !important;
  color: var(--text-primary) !important;
}

.el-menu-item.is-active {
  background: var(--gradient-primary) !important;
  color: white !important;
  border-left-color: var(--primary-light) !important;
  box-shadow: var(--glow-primary);
}

.el-button {
  border-radius: 8px !important;
  transition: all var(--transition-fast) !important;
}

.el-button--text {
  color: var(--text-secondary) !important;
}

.el-button--text:hover {
  color: var(--primary-light) !important;
  background: var(--bg-hover) !important;
}

/* 卡片样式 */
.el-card {
  background: var(--bg-card) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 12px !important;
  box-shadow: var(--shadow-md) !important;
}

.el-card__header {
  background: rgba(22, 93, 255, 0.05) !important;
  border-bottom: 1px solid var(--border-light) !important;
  color: var(--text-primary) !important;
}

.el-card__body {
  color: var(--text-secondary) !important;
}

/* 表单样式 */
.el-form {
  color: var(--text-primary) !important;
}

.el-form-item__label {
  color: var(--text-primary) !important;
}

.el-input,
.el-input-number,
.el-select {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 8px !important;
}

.el-input__inner,
.el-input-number__input {
  background: var(--bg-secondary) !important;
  border: none !important;
  color: var(--text-primary) !important;
}

.el-input__inner:focus,
.el-input-number__input:focus {
  border-color: var(--primary-light) !important;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2) !important;
}

.el-input-group__append,
.el-input-group__prepend {
  background: var(--bg-hover) !important;
  border-color: var(--border-color) !important;
}

.el-input-group__append .el-button,
.el-input-group__prepend .el-button {
  background: transparent !important;
  border: none !important;
  color: var(--text-secondary) !important;
}

/* 开关样式 */
.el-switch__core {
  background-color: var(--border-color) !important;
}

.el-switch.is-checked .el-switch__core {
  background-color: var(--primary-color) !important;
}

/* 选择器样式 */
.el-select .el-input__suffix {
  color: var(--text-tertiary) !important;
}

.el-select-dropdown {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 8px !important;
}

.el-select-dropdown__item {
  color: var(--text-secondary) !important;
}

.el-select-dropdown__item:hover,
.el-select-dropdown__item.selected {
  background: var(--bg-hover) !important;
  color: var(--text-primary) !important;
}

/* 对话框样式 */
.el-dialog {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 12px !important;
}

.el-dialog__header {
  border-bottom: 1px solid var(--border-color) !important;
}

.el-dialog__title {
  color: var(--text-primary) !important;
}

.el-dialog__body {
  color: var(--text-secondary) !important;
}

/* 提示框样式 */
.el-message {
  min-width: 280px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-primary);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-md);
}

.el-message__content {
  color: var(--text-primary);
}

/* 错误提示样式 */
.el-message--error {
  background-color: rgba(245, 34, 45, 0.1) !important;
  border-color: rgba(245, 34, 45, 0.3) !important;
}

.el-message--error .el-message__content {
  color: #f56c6c !important;
}

/* 确认对话框样式（适用于ElMessageBox） */
.el-message-box {
  background-color: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 12px !important;
  box-shadow: var(--shadow-lg) !important;
}

.el-message-box__header {
  border-bottom: 1px solid var(--border-color) !important;
}

.el-message-box__title {
  color: var(--text-primary) !important;
}

.el-message-box__content {
  color: var(--text-secondary) !important;
}

.el-message-box__btns {
  border-top: 1px solid var(--border-light) !important;
}

.el-message-box__input input {
  background-color: var(--bg-primary) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
}

.el-message-box__input input:focus {
  border-color: var(--primary-color) !important;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2) !important;
}

/* 颜色选择器样式 */
.el-color-picker {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
}

/* 表格样式 */
.el-table {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
}

.el-table th {
  background: rgba(22, 93, 255, 0.05) !important;
  color: var(--text-primary) !important;
  border-bottom: 1px solid var(--border-color) !important;
}

.el-table tr {
  color: var(--text-secondary) !important;
  border-bottom: 1px solid var(--border-light) !important;
}

.el-table tr:hover>td {
  background: var(--bg-hover) !important;
}

.el-table--enable-row-hover .el-table__body tr:hover>td {
  background: var(--bg-hover) !important;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
}

::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.el-main>* {
  animation: fadeIn 0.4s ease-out;
}
</style>