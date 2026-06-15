# Manteia Boost

智能浏览器增强扩展 — 无侵入式功能扩展，为企业内网系统赋能

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?style=flat-square)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square)](https://www.typescriptlang.org/)

## 核心功能

### AI 智能助手
- 集成 DeepSeek 对话能力，基于当前页面上下文提供智能建议
- 支持流式响应，会话持久化

### 悬浮球工具
- Mock 数据构造、JSON 格式化、加解密工具
- 图片批量下载、脚本执行器

### 文本选择增强
- 选中文字弹出工具栏：复制、搜索、翻译、书签、AI 分析

### 业务自动化
- 表单模板一键填充，智能校验规则配置
- 批量数据处理与 CSV 导出

### 系统增强
- Shadow DOM 隔离渲染，零样式冲突
- XHR 请求拦截与修改
- 快捷键导航 (`Alt+M` 召唤悬浮球)

## 支持的系统

| 系统 | 说明 |
|------|------|
| MRIA | 肿瘤放疗信息管理系统 |
| 禅道 | 项目管理 (Bug导出、用例批量操作) |
| RADIUS | 患者数据管理 |
| QAPRO | 测试管理系统 |
| Docker Portainer | 容器管理 |

## 技术栈

- **框架**: Vue 3 + TypeScript + Vite
- **状态管理**: Pinia
- **UI**: Element Plus
- **隔离方案**: Shadow DOM
- **扩展标准**: Chrome Extension Manifest V3
- **AI**: DeepSeek API (含独立 Node 服务)

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev
```

扩展加载: 打开 `chrome://extensions` → 开启开发者模式 → 加载已解压的扩展程序 → 选择 `dist` 文件夹

```bash
# 独立 DeepSeek API 服务 (可选)
npm run serve:deepseek-service
# 监听 http://127.0.0.1:8787
```

## 项目结构

```
src/
├── apps/                  # 独立应用 (悬浮球、侧边栏等)
├── assets/components/    # 通用组件
├── content/              # 内容脚本 (按域名注入)
├── pages/                # 扩展页面 (popup/options/sidepanel)
├── service-worker/       # Service Worker 后台
├── runtime/              # 运行时脚本
└── utils/                # 工具函数
```

## License

MIT
