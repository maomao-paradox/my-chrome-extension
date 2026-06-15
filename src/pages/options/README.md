# Options Page 功能介绍

## 1. 页面概述

Options Page 是一个基于 Vue 3 + TypeScript 开发的现代化浏览器扩展选项页面，采用科技感十足的 UI 设计风格，集成了个人主页、登录管理、扩展配置等核心功能模块。

## 2. 核心功能

### 2.1 个人主页 (HomeView)
- **功能描述**：展示用户个人信息和快捷操作入口
- **主要特性**：
  - 个性化头像与登录状态展示
  - 管理后台快捷访问入口
  - 流畅的滚动动画效果
  - 完全响应式设计，适配各种屏幕尺寸

### 2.2 登录管理
- **功能描述**：处理用户登录、登出及状态管理
- **主要特性**：
  - 基于 localStorage 的登录状态存储
  - JWT Token 管理机制
  - 智能页面重定向
  - 登录状态实时检测

### 2.3 扩展配置
- **功能描述**：管理浏览器扩展的各项核心设置
- **主要模块**：
  - 内容脚本域名配置
  - 前端选项自定义
  - 浏览器变量管理
  - XHR 规则配置

### 2.4 用户选项
- **功能描述**：管理用户个性化设置和偏好

## 3. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.x | 核心前端框架 |
| TypeScript | 5.x | 类型安全支持 |
| Vue Router | 4.x | 路由管理 |
| Element Plus | 2.x | UI 组件库 |
| GSAP | 3.x | 高级动画效果 |

## 4. 项目结构

```
src/pages/options/
├── App.vue                         # 主应用组件
├── main.ts                         # 应用入口文件
├── README.md                       # 项目说明文档
└── views/                          # 页面视图目录
    ├── components/                 # 可复用子组件
    │   ├── DomainConfigItem.vue    # 域名配置项组件
    │   ├── RuleForm.vue            # 规则表单组件
    │   ├── RuleList.vue            # 规则列表组件
    │   └── TestTool.vue            # 测试工具组件
    ├── BrowserVarView.vue          # 浏览器变量配置视图
    ├── ContentScriptDomainConfig.vue # 内容脚本域名配置视图
    ├── ExtensionSettings.vue       # 扩展设置视图
    ├── FrontEndOption.vue          # 前端选项配置视图
    ├── HomeView.vue                # 个人主页视图
    ├── LoginView.vue               # 登录页面视图
    ├── router.ts                   # 路由配置文件
    ├── UserOption.vue              # 用户选项配置视图
    └── XHRuleOption.vue            # XHR 规则配置视图
```

## 5. 路由配置

| 路径 | 组件 | 权限要求 | 描述 |
|------|------|----------|------|
| /home | HomeView | 公开访问 | 个人主页 |
| /login | LoginView | 公开访问 | 用户登录页面 |
| /user | UserOption | 需要登录 | 用户选项配置 |
| /domain-config | ContentScriptDomainConfig | 需要登录 | 内容脚本域名配置 |
| /extension-settings | ExtensionSettings | 需要登录 | 扩展全局设置 |
| /front-end-option | FrontEndOption | 需要登录 | 前端选项配置 |
| /browser-var | BrowserVarView | 需要登录 | 浏览器变量配置 |
| /xhr-rule | XHRuleOption | 需要登录 | XHR 规则配置 |
| / | - | - | 默认重定向到 /home |
| /* | - | - | 404 页面重定向到 /home |

## 6. 登录状态管理

### 6.1 状态存储
- 登录状态存储在浏览器 localStorage 中
- 存储键：`mria-logged-in`
- 值：`true` 表示已登录，其他值或不存在表示未登录

### 6.2 路由守卫机制
- **公开页面**：`/home`、`/login`
- **受保护页面**：除公开页面外的所有其他页面
- **未登录处理**：访问受保护页面时自动重定向到 `/login`

## 7. UI 设计规范

### 7.1 主题风格
- 主色调：科技蓝 (#00BFFF, #1E90FF)
- 背景：深色渐变，营造深邃科技感
- 视觉效果：玻璃质感、卡片式布局
- 交互：平滑过渡、微动画反馈

### 7.2 动画效果
- 页面切换过渡动画
- 滚动触发的渐显效果
- 鼠标跟随粒子效果
- 元素悬停反馈动画

### 7.3 响应式设计
- 采用移动优先设计理念
- 适配多种屏幕尺寸
- 断点设计：移动端、平板、桌面端

## 8. 开发与构建

### 8.1 启动开发服务器
```bash
npm run dev
```

### 8.2 构建生产版本
```bash
npm run build
```

### 8.3 代码规范
- ESLint + Prettier 代码检查与格式化
- TypeScript 严格模式
- Vue 3 Composition API 语法规范
- 组件化开发最佳实践

## 9. 浏览器兼容性

| 浏览器 | 版本要求 |
|--------|----------|
| Chrome | 最新 2 个稳定版本 |
| Firefox | 最新 2 个稳定版本 |
| Safari | 最新 2 个稳定版本 |
| Edge | 最新 2 个稳定版本 |

## 10. 注意事项

1. 登录状态存储在 localStorage 中，请注意相关安全风险
2. 页面使用了自定义鼠标样式，可能与部分网站存在兼容性冲突
3. 粒子背景效果可能对低配置设备性能产生影响
4. 路由守卫仅在客户端生效，服务端渲染场景需额外处理
5. 扩展权限变更可能导致部分功能异常，需重新授权

## 11. 更新日志

### v1.0.0
- ✨ 初始版本发布
- ✨ 实现个人主页核心功能
- ✨ 完成登录管理系统
- ✨ 集成扩展配置模块
- ✨ 采用科技感 UI 设计

## 12. 联系与反馈

如有问题或建议，欢迎联系开发团队。

---

**文档版本**：v1.0.0  
**更新日期**：2025-12-19  
**适用范围**：Options Page 所有相关开发与维护工作