## 侧边栏工具箱

### 单页 React 插件，通过 Shadow DOM 隔离

> **迁移说明**：本应用已从 Vue 3 单文件组件迁移至 React 18 + TypeScript。
> 入口由 `createApp` 改为 `createRoot`，样式通过 `?inline` SCSS 注入 Shadow DOM，
> 避免 Vite CSS 代码分割创建 `<link>` 标签导致相对路径请求失败。

### 文件结构

```
sidebar/
├── App.tsx                       # 主组件，组合 HoverMenu 与 SimpleCarousel
├── HoverMenu.tsx                 # 侧边悬浮菜单 + Miku trigger
├── MikuChatWindow.tsx            # Miku 角色对话窗口（可拖拽）
├── index.ts                      # 应用入口（React root + Shadow DOM）
├── components/
│   ├── SimpleCarousel.tsx        # 简化版轮播（替代 Element Plus el-carousel）
│   └── AIConversationPlaceholder.tsx  # AIConversation 占位（待迁移）
└── styles/
    ├── index.scss                # 聚合样式入口（通过 ?inline 注入）
    ├── hover-menu.scss           # HoverMenu 样式
    ├── miku-chat-window.scss     # MikuChatWindow 样式
    └── carousel.scss             # SimpleCarousel 样式
```

### 入口交互

- 工具入口使用 `public/static/img/miku.png`。
- 鼠标靠近浏览器右侧边缘时，Miku 图片会从右侧滑出，同时展开侧边栏工具。
- 点击图片会打开或收起 Miku 角色对话窗口。
- 对话窗口原复用 `AIConversation` 流式对话组件，迁移期间以 `AIConversationPlaceholder` 占位，
  后续将 `floatingball/views/AIConversation.vue` 完整迁移到 React 后替换。
- Miku 对话窗口左侧图片上方预留音乐播放器控制区，提供上一首、播放/暂停、下一首三个图标按钮；
  播放器下方有旋转光盘，播放时旋转，暂停时停在当前角度。当前仅维护播放按钮的本地切换状态，
  音频播放逻辑可在后续接入。

### 关键技术决策

| 项目 | Vue 版 | React 版 |
| --- | --- | --- |
| 入口 | `createApp(App, props)` | `createRoot(container).render(<App />)` |
| 样式 | `injectCssDom(chrome-extension://)` | `injectStyles(shadowRoot, scss?inline)` |
| 事件总线 | `eventManager.useBus(name, cb)` | `bus.on(name, cb)` / `bus.off` |
| 拖拽 | `Draggable` (Vue) | `Draggable` (React, `@/assets/components/react-index`) |
| 轮播 | `MACarousel` (Element Plus) | `SimpleCarousel` (原生 React) |
| 图标 | `?component` SVG | Ant Design Icons |
| AI 对话 | `AIConversation.vue` | `AIConversationPlaceholder`（占位） |

### 已知 TODO

- [ ] 将 `floatingball/views/AIConversation.vue`（1474 行）迁移到 React，
  替换 `components/AIConversationPlaceholder.tsx`
- [ ] 接入实际音频播放逻辑（previous/next 当前仅切换状态）
