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

构建时可以通过 `.env` 控制扩展页面是否打包。页面开关同时控制 Rollup 入口和 Manifest 声明，避免生成无效页面引用；默认值均为 `true`：

```env
VITE_BUILD_POPUP=false
VITE_BUILD_OPTIONS=true
VITE_BUILD_SIDEPANEL=false
VITE_BUILD_DEVTOOLS=false
```

支持的变量：`VITE_BUILD_POPUP`、`VITE_BUILD_OPTIONS`、`VITE_BUILD_SIDEPANEL`、`VITE_BUILD_DEVTOOLS`。设置为 `false` 后，对应页面不会加入构建产物，Manifest 中也不会声明该页面。

扩展加载: 打开 `chrome://extensions` → 开启开发者模式 → 加载已解压的扩展程序 → 选择 `dist` 文件夹

## 测试

项目使用 [Vitest](https://vitest.dev/) + [happy-dom](https://github.com/capricorn86/happy-dom) + [Vue Test Utils](https://test-utils.vuejs.org/) 进行单元测试和组件测试。

```bash
# 运行全部测试（一次性）
npm test -- run

# 进入 watch 模式
npm test

# 指定测试文件
npx vitest run test/element-control.spec.ts
npx vitest run test/BookmarkPage.spec.ts
```

### 测试框架说明

- **Vitest**：与 Vite 深度集成的下一代测试框架，速度极快，完全兼容 Jest API
- **Vue Test Utils**：Vue 官方推荐的组件测试库，提供 `mount`/`shallowMount` 方法来渲染和交互组件
- **happy-dom**：轻量级 DOM 模拟环境，替代 jsdom 以获得更好的性能

### 测试基础设施

- `vitest.config.ts` — 独立的 Vitest 配置，复用 `@` 路径别名、启用 Vue SFC 支持和 happy-dom 环境
- `test/setup.ts` — 全局 setup，注入 `maLogger`、`chrome.*` API、`requestIdleCallback` 等 chrome 扩展运行时依赖
- `test/**/*.spec.ts` — 测试用例目录

### 已覆盖模块

| 模块 | 测试文件 | 类型 | 用例数 |
| --- | --- | --- | --- |
| `src/utils/element-control.ts` | `test/element-control.spec.ts` | 单元测试 | 91 |
| `src/pages/popup/composables/useDomainState.ts` | `test/useDomainState.spec.ts` | 单元测试 | 15 |
| `src/pages/popup/views/BookmarkPage.vue` | `test/BookmarkPage.spec.ts` | 组件测试 | 36 |
| `src/message/index.ts` | `test/message.spec.ts` | 单元测试 | 32 |

## 核心功能

### 内容脚本功能配置
- `Radius`、`MRIA`、`QA Pro`、`Teach`、`蓝湖`、`Portainer` 和 `禅道` 内容脚本支持网页内功能注册和独立开关。
- 首次进入未保存过配置的内容脚本页面时，面板默认关闭全部功能并引导用户配置。
- 使用 `Ctrl+Shift+K`（macOS 使用 `Command+Shift+K`）打开当前页面的配置面板。
- 配置保存在当前网页的 `localStorage`，键名为 `kria-nove:content-script-config:{contentScriptId}`；保存配置后重新启用功能需要刷新页面。

### 自定义组件展示页
- 新增独立组件展示页，可在浏览器中浏览 `src/assets/components` 下的自研组件
- 页面采用左侧目录、中间预览、右侧信息面板的结构，风格参考组件库文档站
- 入口为 `src/pages/components.html`，开发模式下可直接访问 `/pages/components.html`

### AI 智能助手
- 集成 DeepSeek 对话能力，基于当前页面上下文提供智能建议
- 支持流式响应，会话持久化

### 文本选择增强
- 选中文字弹出工具栏：复制、搜索、翻译、书签、AI 分析、留言
- 工具栏、翻译面板、替换弹窗和留言浮层采用统一的轻量浮层样式，支持键盘焦点与低动效偏好

### 鼠标拖尾
- Popup 设置页可开启页面鼠标拖尾，移动时生成随机音符，点击时触发少量音符爆发效果

### 菜单自动点击工具
- 菜单工具支持打开 `AutoClick` 连点器，录制页面点击坐标后按统一间隔循环播放
- 录制期间会在当前光标位置显示十字线和 `clientX` / `clientY`，悬停按钮时显示按钮轮廓并让十字线避开按钮内部
- `src/apps/menu/tools/AutoClick.vue` 已压缩为约 50% 尺寸，更适合悬浮在页面上辅助操作

### Popup 锚点管理
- Popup 顶部导航改为紧凑分段样式，保留原有图标并增加文字标签、选中态和键盘焦点反馈，便于在小窗口内快速识别功能入口
- 锚点页使用紧凑布局，搜索、导入、导出和列表操作都适配浏览器扩展的小窗口宽度
- `src/pages/popup/views/TableContainer.vue` 支持 `density`、`sectionGap`、`contentGap`、`heroGap`、`rightMaxWidth` 等公共布局参数，页面可按需要复用同一头部/内容容器

### Popup 动态令牌
- Popup 新增“令牌”标签页，在扩展本地生成 TOTP 动态码，不依赖后端服务
- 令牌数据保存到 `chrome.storage.local`；新增表单提交后会清空输入框
- 支持粘贴 `otpauth://totp/...` 链接，也支持手动填写发行方、账户和 Base32 secret
- 支持上传二维码图片，通过 `jsqr` 解析出 `otpauth://totp/...` 后填入表单
- 倒计时每秒刷新，到达周期边界后自动生成新动态码

### 后台页签脚本执行
- 后台脚本监听 `CREATE_TAB_WITH_SCRIPT` 消息，可新建页签并在目标页面开始加载后立即注入扩展内脚本
- `payload.url` 仅支持 `http` / `https` 页面，`payload.scriptPath` 建议使用 `file-map` key，例如 `js/runtime/bookmark-highlight`
- 后台会自动解析构建后的真实脚本路径；如果 `file-map` 尚未由内容脚本同步，会懒加载 `file-map.json`

### DOM 结构提取
- `src/runtime/dom-structure-extractor.ts` 可注入当前网页，提取 title、url、语义区块、标题层级、表单字段、图片 alt/id/title 以及裁剪后的 DOM 树，输出适合 AI 理解的 Markdown 和 JSON
- 注入后会把 Markdown 摘要打印到控制台并尝试复制到剪贴板，同时暴露 `window.extractDomStructure(options)` 和最近一次结果 `window.lastDomStructureSummary`
- 常用参数：`rootSelector` 指定根节点，`maxDepth` 控制层级深度，`maxChildrenPerNode` 控制每层子节点数量，`includeHidden` 控制是否包含隐藏元素

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
- 浏览器插件环境下访问插件的 options 页面；当前已将 `PanelNav`、星舰总览弹层 `TacticalOverview`、玻璃星轨光标 `GlassCursor`、浏览器变量查看器迁移为 React 组件

### 战役选择页
- 新增 React + Tailwind CSS 战役选择 UI，入口为 `src/pages/campaign.html`
- 页面采用三栏战术面板布局：左侧战役档案列表、中间战区全息投影、右侧任务状态与难度选择
- 中间主视图使用 `@react-three/fiber`、`@react-three/drei` 和 Three.js 渲染线框全息地球，包含星点背景、地表点阵、陆地海岸线、国家边界线、区域环线、自转与鼠标拖拽旋转；点击地球任务点可在右侧面板查看任务信息
- 开发模式可访问 `http://127.0.0.1:5173/pages/campaign.html`

### 双手异色空间 Demo
- 新增全屏摄像头互动页 `src/pages/hand-portals.html`，使用 MediaPipe Tasks Vision 在浏览器端识别双手。
- 页面取左右手的拇指、食指、中指和小指指尖，相邻指尖连接出红、蓝、绿三片四边形空间；每片空间通过 Canvas 四边形蒙版裁切一套不同滤镜风格的实时摄像头画面。
- 指尖位置使用指数平滑跟随，降低手部检测抖动；开发模式可访问 `http://127.0.0.1:5173/pages/hand-portals.html`。

### 3D 旋转展示页
- `src/pages/index.html` 已封装为 Vue 3 入口，页面逻辑集中在 `src/pages/index/App.vue`
- 保留旧版 `rotation3D` 插件的底座、节点、连线、点击和拖拽旋转行为，并改为加载本地脚本资源
- Options 主页仍使用星舰指挥中心布局，中间全息投影区域保留原 2D 星舰投影，并复用 3D 旋转组件替代中心模块面板
- Options 主页左侧雷达卡片重绘为状态展示仪表，增加同心脉冲、错峰目标回波和低动效降级，不再承担点击导航
- Options 主页 Hero 统一动效节奏，增加舰桥舷窗框架、中心主视窗厚边和顶部控制梁，强化前窗式指挥舱观感
- Options 主页左上角状态区域替换为“星舰智能 AI”动态图标，包含星舰轮廓、AI 核心、轨道环和低动效降级
- Options 主页顶部标题区改为动态舰桥信号解析条，展示链路、坐标、AI 状态和波形信号

### 悬浮球光谱效应
- 悬浮球工具箱新增“光谱效应”，内置棱镜折射、极光幕布、光谱环和衍射薄膜四种视觉组件
- 支持在抽屉内切换预览、调节光谱强度、暂停动效，并复制当前效果的 CSS 片段用于开发参考

### 滚动时间轴组件
- 新增可复用 React 组件 `src/assets/components/ScrollingTimeline.tsx`
- 样式位于 `src/assets/components/ScrollingTimeline.scss`，使用项目已有的 `lucide-react` 图标
- 支持横向滚动、左右导航、节点/卡片点击、键盘方向键与 Home/End 导航
- 通过 `items` 传入时间轴数据；使用 `activeId` + `onActiveIdChange` 受控，或省略 `activeId` 使用组件内部状态

```tsx
<ScrollingTimeline
  activeId={activeId}
  items={timelineItems}
  onActiveIdChange={setActiveId}
  onSelect={handleTimelineSelect}
/>
```

## License

MIT
