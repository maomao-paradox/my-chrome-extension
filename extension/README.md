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

### 菜单自动点击工具
- 菜单工具支持打开 `AutoClick` 连点器，录制页面点击坐标后按统一间隔循环播放
- 录制期间会在当前光标位置显示十字线和 `clientX` / `clientY`，悬停按钮时显示按钮轮廓并让十字线避开按钮内部
- `src/apps/menu/tools/AutoClick.vue` 已压缩为约 50% 尺寸，更适合悬浮在页面上辅助操作

### Popup 锚点管理
- Popup 顶部导航改为紧凑分段样式，保留原有图标并增加文字标签、选中态和键盘焦点反馈，便于在小窗口内快速识别功能入口
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

### 真实标签页自动化
- Side Panel 新增“自动化”页，可连接当前真实 Chrome 标签页，读取 title/url，执行截图，录制用户操作并生成结构化步骤
- 支持结构化步骤：`goto`、`click`、`fill`、`press`、`wait`、`extract`、`screenshot`、`verifyText`
- 后台通过 `chrome.scripting.executeScript` 在当前页执行步骤，优先使用 `role`、`label`、`placeholder`、`text`、`testid` 定位，`css` 作为 fallback
- 面板可创建/加载后端任务，保存步骤，创建 run，并逐条上报 event 和 screenshot
- 默认后端地址为 `http://127.0.0.1:8787`，可在面板中修改并保存到 `chrome.storage.local`
- `real-run` 会在执行前要求用户确认；提交、删除、支付、发送等高风险点击默认需要明确确认
- 当前实现不依赖 `debugger` 权限；如果后续切换为 `@playwright-repl/playwright-crx`，再启用 `debugger` 权限和 Playwright page/context runtime

最小使用流程：

```text
打开目标网页
  -> 打开扩展 Side Panel 的“自动化”
  -> 点击“连接当前页”
  -> 手动添加 JSON 步骤，或点击“开始录制”生成步骤
  -> 保存任务和步骤
  -> 选择 dry-run 或 real-run
  -> 执行并上报到 Go 后端
```

### 个人主页
- 提供独立创意个人主页，包含动漫赛博主视觉、幻想展柜、技法展示、丰富动画交互与静态模式切换
- 开发模式可访问 `http://127.0.0.1:5173/pages/profile.html`
- 浏览器插件环境下访问插件的options页面

### 3D 旋转展示页
- `src/pages/index.html` 已封装为 Vue 3 入口，页面逻辑集中在 `src/pages/index/App.vue`
- 保留旧版 `rotation3D` 插件的底座、节点、连线、点击和拖拽旋转行为，并改为加载本地脚本资源
- Options 主页仍使用星舰指挥中心布局，中间全息投影区域复用同一个 3D 旋转组件，并通过 `projection` 模式替代原 2D 星舰图

## License

MIT
