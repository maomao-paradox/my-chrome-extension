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
- 工具栏、翻译面板、替换弹窗和留言浮层采用统一的轻量浮层样式，支持键盘焦点与低动效偏好

### Popup 锚点管理
- 锚点页使用紧凑布局，搜索、导入、导出和列表操作都适配浏览器扩展的小窗口宽度
- `src/pages/popup/views/TableContainer.vue` 支持 `density`、`sectionGap`、`contentGap`、`heroGap`、`rightMaxWidth` 等公共布局参数，页面可按需要复用同一头部/内容容器

### 后台页签脚本执行
- 后台脚本监听 `CREATE_TAB_WITH_SCRIPT` 消息，可新建页签并在目标页面开始加载后立即注入扩展内脚本
- `payload.url` 仅支持 `http` / `https` 页面，`payload.scriptPath` 建议使用 `file-map` key，例如 `js/runtime/bookmark-highlight`
- 后台会自动解析构建后的真实脚本路径；如果 `file-map` 尚未由内容脚本同步，会懒加载 `file-map.json`

```typescript
await chrome.runtime.sendMessage({
  type: 'CREATE_TAB_WITH_SCRIPT',
  target: 'background',
  payload: {
    url: 'https://example.com',
    scriptPath: 'js/runtime/bookmark-highlight'
  }
});
```

可选参数：`active` 控制新页签是否激活，默认 `true`；`world` 支持 `ISOLATED` 或 `MAIN`，默认 `ISOLATED`；`allFrames` 默认 `false`；`waitUntil` 支持 `loading` 或 `complete`，默认 `loading`；`timeoutMs` 默认 `30000`。

### 个人主页
- 提供独立创意个人主页，包含动漫赛博主视觉、幻想展柜、技法展示、丰富动画交互与静态模式切换
- 开发模式可访问 `http://127.0.0.1:5173/pages/profile.html`
- 浏览器插件环境下访问插件的options页面

## License

MIT
