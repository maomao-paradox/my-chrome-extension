/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/pages/options/views/router.ts
 * @date 2026-02-05T02:38:01.695Z
 */

import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import ContentScriptDomainConfig from './ContentScriptDomainConfig.vue';
// @ts-ignore
import ExtensionSettings from './ExtensionSettings.vue';
import LoginView from './LoginView.vue';
// @ts-ignore
import UserOption from './UserOption.vue';
import ErrorMonitorConfig from './ErrorMonitorConfig.vue';

const routes: RouteRecordRaw[] = [
  // 公开页面 - 不需要登录
  { path: '/login', component: LoginView },
  
  // 需要登录的管理页面
  { path: '/user', component: UserOption },
  { path: '/domain-config', component: ContentScriptDomainConfig },
  { path: '/extension-settings', component: ExtensionSettings },
  { path: '/error-monitor', component: ErrorMonitorConfig },
  
  // 重定向规则
  { path: '/', redirect: '/home' },
  { path: '/:pathMatch(.*)*', redirect: '/home' }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 路由守卫
router.beforeEach((to, from, next) => {
  // 公开页面不需要验证
  const publicPages = ['/home', '/login'];
  const isPublicPage = publicPages.includes(to.path);
  
  if (isPublicPage) {
    next();
    return;
  }

  // 检查是否已登录
  const isLoggedIn = localStorage.getItem('mria-logged-in') === 'true';

  if (isLoggedIn) {
    next();
  } else {
    // 未登录，重定向到登录页面
    next('/login');
  }
});

export default router;