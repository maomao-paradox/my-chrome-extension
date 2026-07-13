## 侧边栏工具箱

### 单 Vue 页面插件，通过 shadow dom 隔离

### 入口交互

- 工具入口使用 `public/static/img/miku.png`。
- 鼠标靠近浏览器右侧边缘时，Miku 图片会从右侧滑出，同时展开侧边栏工具。
- 点击图片会打开或收起 Miku 角色对话窗口。
- 对话窗口复用现有 `AIConversation` 流式对话组件，通过角色专用系统提示词模拟 Miku 对话。
