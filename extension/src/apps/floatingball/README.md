## 悬浮球（FloatingBall）

### React 单页应用插件，通过 Shadow DOM 隔离

#### 技术栈

- **框架**：React 18 + TypeScript
- **UI 库**：Ant Design 5（替代 Element Plus）
- **状态管理**：Zustand（替代 Pinia，框架无关）
- **样式**：SCSS，通过 `?inline` 导入并注入 Shadow DOM
- **构建**：Vite 5

#### 组件结构

```
floatingball/
├── App.tsx                # 主组件，组合所有子组件 + store 订阅
├── FloatingBall.tsx       # 悬浮球（可拖拽 + 边缘吸附）
├── GlassCardOverlay.tsx   # 毛玻璃卡片（可拖拽 + 四角缩放 + 样式调节）
├── ControlPanel.tsx       # 控制面板（双面板切换 + 全屏动画）
├── ToolDrawer.tsx         # 工具抽屉（antd Drawer）+ 消息通知中心
├── index.ts               # 入口（createRoot + Shadow DOM + SCSS 注入）
├── styles/                # 主组件样式
│   ├── index.scss          # 聚合入口（?inline 导入用）
│   ├── floating-ball.scss
│   ├── glass-card-overlay.scss
│   ├── control-panel.scss
│   └── tool-drawer.scss
└── views/                 # 工具子组件
    ├── index.ts            # 工具映射表 { image, script }
    ├── ImageDownload.tsx   # 图片扫描/打包下载
    ├── ScriptRunner.tsx    # 脚本执行（code/file/url）
    ├── SpectrumEffects.tsx # 光谱效应组件集（预览/复制 CSS）
    └── styles/
        ├── image-download.scss
        ├── script-runner.scss
        └── spectrum-effects.scss
```

#### 关键设计

- **Shadow DOM 样式注入**：所有 SCSS 通过 `?inline` 导入为字符串，在 `index.ts` 中用 `injectStyles` 注入 shadow root，避免 Vite CSS 代码分割创建 `<link>` 标签导致相对路径请求失败
- **Drawer 容器挂载**：antd Drawer 默认 portal 到 `document.body`，通过 `getContainer` 指向 shadow root 内的容器，确保样式生效
- **Draggable 共享组件**：React 版位于 `@/assets/components/Draggable.tsx`，用 `forwardRef` + `useImperativeHandle` 暴露 `getCurrentPosition/setPosition/setPositionImmediate`，高频更新用 `useRef` 保证 60fps
- **全屏动画**：用 `requestAnimationFrame` + `easeInOutCubic` 缓动函数，通过 Draggable 命令式 API 直接驱动位置，绕过 React 渲染周期
- **状态管理**：Zustand store 位于 `@/stores/floatingball`，React 中用 selector 订阅，非组件代码用 `getState()` 调用
- **光谱效应工具**：`SpectrumEffects.tsx` 提供棱镜折射、极光幕布、光谱环和衍射薄膜四种 CSS 效果，可在抽屉内切换预览、调节强度并复制样式片段

#### 保留的 Vue 文件

以下文件未迁移，仍被其他 Vue 应用依赖：

- `views/AIConversation.vue` → 被 `sidebar/MikuChatWindow.vue` 引用
- `views/HiddenPathScanner.vue` → 被 `pages/sidepanel/App.vue` 引用
