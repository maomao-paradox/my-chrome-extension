# KIRA:NOVE 浏览器插件

智能浏览器增强扩展 — 无侵入式功能扩展

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?style=flat-square)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square)](https://www.typescriptlang.org/)


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

# 构建扩展
npm run build

# 构建扩展(file_map加密可选)
npm run build:enc
```

扩展加载: 打开 `chrome://extensions` → 开启开发者模式 → 加载已解压的扩展程序 → 选择 `dist` 文件夹

## 核心功能

### AI 智能助手
- 集成 DeepSeek 对话能力，基于当前页面上下文提供智能建议
- 支持流式响应，会话持久化

### 文本选择增强
- 选中文字弹出工具栏：复制、搜索、翻译、书签、AI 分析、留言

### 个人主页
- 提供独立创意个人主页，包含动漫赛博主视觉、幻想展柜、技法展示、丰富动画交互与静态模式切换
- 开发模式可访问 `http://127.0.0.1:5173/pages/profile.html`
- 浏览器插件环境下访问插件的options页面

## License

MIT
