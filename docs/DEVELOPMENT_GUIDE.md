# MRIA 扩展开发指南

## 项目概述

MRIA 扩展是一个功能强大的浏览器扩展，旨在为用户提供增强的网页交互体验和开发辅助工具。该扩展采用现代化的技术栈，支持多种功能模块，可根据用户需求进行定制和扩展。

## 技术栈

- **前端框架**: Vue 3
- **构建工具**: Vite
- **浏览器扩展**: Chrome Extension Manifest V3
- **TypeScript**: 类型安全的 JavaScript 超集
- **UI 库**: Element Plus
- **工具库**: 
  - jszip: 文件压缩
  - file-saver: 文件下载
  - pinyin-pro: 拼音转换
  - crypto-js: 加密算法

## 项目结构

```
├── src/                 # 源代码目录
│   ├── api/             # API 相关代码
│   ├── apps/            # 功能模块
│   │   ├── floatingball/ # 悬浮球功能
│   │   ├── sidebar/      # 侧边栏功能
│   │   ├── mcp/          # 浏览器操作助手
│   │   └── ...           # 其他功能模块
│   ├── background/       # 后台脚本
│   ├── components/       # 通用组件
│   ├── config/           # 配置文件
│   ├── content/          # 内容脚本
│   ├── event-bus/        # 事件总线
│   ├── libs/             # 第三方库
│   ├── message/          # 消息通信
│   ├── pages/            # 页面
│   │   ├── options/       # 选项页面
│   │   ├── popup/         # 弹出页面
│   │   └── sidepanel/     # 侧边栏页面
│   ├── patch/            # 补丁和注入脚本
│   ├── stores/           # 状态管理
│   ├── styles/           # 样式文件
│   ├── types/            # TypeScript 类型定义
│   └── utils/            # 工具函数
├── public/               # 静态资源
├── dist/                 # 构建输出目录
├── vite.config.ts        # Vite 配置
└── package.json          # 项目依赖
```

## 核心功能模块

### 1. 悬浮球 (Floating Ball)

悬浮球是一个可拖动的工具栏，提供快速访问各种功能的入口。

**主要功能**:
- 快速访问常用工具
- 支持自定义工具
- 可拖动定位

**开发要点**:
- 使用 `PositionStrategy` 进行精确定位
- 实现拖拽功能
- 管理工具状态

### 2. 侧边栏 (Sidebar)

侧边栏提供更详细的功能操作界面。

**主要功能**:
- 工具管理
- 配置选项
- 操作历史

**开发要点**:
- 使用 Vue 组件构建界面
- 实现响应式布局
- 与后台脚本通信

### 3. 浏览器操作助手 (MCP)

MCP (Mouse Control Panel) 提供高级的鼠标操作功能。

**主要功能**:
- 文本选择工具
- 页面操作
- 自动化脚本

**开发要点**:
- 监听鼠标事件
- 实现文本选择功能
- 处理跨域通信

### 4. 禅道内容替换 (Zentao Content Replace)

为禅道系统提供批量内容替换功能。

**主要功能**:
- 批量替换文本
- 支持 iframe 内容替换
- 自定义替换规则

**开发要点**:
- 使用 Web Components 构建组件
- 处理 iframe 跨域访问
- 实现文本替换算法

## 开发流程

### 1. 环境搭建

```bash
# 安装依赖
npm install

# 插件热开发模式：首次加载 dist 后保持该命令运行
npm run dev

# 单独调试 options 普通页面
npm run dev:options

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

### 2. 扩展加载

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择 `dist` 目录

开发时只需要首次加载 `dist`。保持 `npm run dev` 运行后，Vite 与 CRXJS 会处理大部分热更新；如果修改了 `manifest.config.ts`、Service Worker 或 content script 注册结构，手动点击扩展管理页的刷新按钮，并刷新目标业务页面。

### 3. 调试技巧

- **内容脚本调试**: 在目标页面按 F12，选择 "Sources" -> "Content scripts"
- **后台脚本调试**: 在扩展管理页面点击 "背景页"
- **弹出页面调试**: 右键点击扩展图标，选择 "检查弹出内容"
- **侧边栏调试**: 在侧边栏打开后按 F12

## 常见问题及解决方案

### 1. Web Components 注册问题

**问题**: 组件注入到 DOM 后没有注册成功

**解决方案**:
- 确保 `customElements` API 可用
- 使用定时器重试机制
- 处理 iframe 中的组件注册

**代码示例**:
```typescript
function registerComponent() {
  if (customElements && !customElements.get('zentao-content-replace')) {
    try {
      customElements.define('zentao-content-replace', ZentaoContentReplace);
      return true;
    } catch (error) {
      console.error('注册组件失败:', error);
      return false;
    }
  }
  return false;
}

if (!registerComponent()) {
  let intervalId = setInterval(() => {
    if (registerComponent()) {
      clearInterval(intervalId);
    }
  }, 500);
}
```

### 2. iframe 内容访问问题

**问题**: 无法访问 iframe 中的内容

**解决方案**:
- 确保 iframe 同源或有适当的跨域策略
- 使用 `contentDocument` 或 `contentWindow.document`
- 处理 iframe 加载完成事件

**代码示例**:
```typescript
const iframeElement = document.getElementById('appIframe');
if (iframeElement) {
  const iframeDom = iframeElement.contentWindow?.document;
  if (iframeDom) {
    // 访问 iframe 内容
  }
}
```

### 3. 动态元素捕获问题

**问题**: 无法捕获到动态渲染的元素

**解决方案**:
- 使用 `MutationObserver` 监听 DOM 变化
- 定期检查根节点更新
- 实现智能的元素查找机制

**代码示例**:
```typescript
const observer = new MutationObserver(() => {
  // 检查新元素
  const elements = document.querySelectorAll('.target-element');
  // 处理找到的元素
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### 4. getComputedStyle 类型错误

**问题**: TypeError: Failed to execute 'getComputedStyle' on 'Window'

**解决方案**:
- 确保传入的参数是有效的元素
- 添加错误处理
- 检查元素是否在 DOM 中

**代码示例**:
```typescript
function safeGetComputedStyle(element) {
  if (!element) {
    return null;
  }
  try {
    return window.getComputedStyle(element);
  } catch (error) {
    console.warn('获取样式失败:', error);
    return null;
  }
}
```

## 最佳实践

### 1. 代码组织

- **模块化**: 将功能拆分为独立的模块
- **单一职责**: 每个组件和函数只负责一个功能
- **类型安全**: 使用 TypeScript 类型定义
- **注释完善**: 添加详细的代码注释

### 2. 性能优化

- **懒加载**: 按需加载功能模块
- **防抖节流**: 优化高频事件处理
- **内存管理**: 及时清理定时器和事件监听器
- **DOM 操作**: 减少直接 DOM 操作，使用虚拟 DOM

### 3. 安全性

- **内容安全策略**: 遵循浏览器扩展的安全规则
- **权限管理**: 只请求必要的权限
- **输入验证**: 验证所有用户输入
- **避免 eval**: 尽量避免使用 eval 函数

### 4. 可维护性

- **一致的代码风格**: 使用 ESLint 和 Prettier
- **版本控制**: 合理的 git 提交信息和分支管理
- **文档完善**: 保持文档与代码同步
- **错误处理**: 完善的错误捕获和处理机制

## 扩展开发经验

### 1. Web Components 开发

- **组件设计**: 遵循 Web Components 规范
- **生命周期**: 正确处理组件的生命周期回调
- **样式隔离**: 使用 Shadow DOM 实现样式隔离
- **属性观察**: 使用 observedAttributes 监听属性变化

### 2. 浏览器扩展架构

- **消息通信**: 掌握不同脚本间的通信机制
- **存储管理**: 合理使用不同类型的存储
- **权限管理**: 理解扩展权限的工作原理
- **背景脚本**: 优化后台脚本的性能

### 3. 跨域处理

- **内容脚本**: 利用内容脚本突破跨域限制
- **后台请求**: 使用后台脚本处理跨域请求
- **CORS**: 理解和处理 CORS 问题
- **iframe 通信**: 实现 iframe 与主窗口的安全通信

## 功能模块开发指南

### 开发新功能模块

1. **创建模块目录**: 在 `src/apps/` 下创建新的模块目录
2. **配置入口**: 在 `vite.config.ts` 中添加模块入口
3. **实现功能**: 开发模块的核心功能
4. **注册模块**: 在 `src/content/index.ts` 中注册模块
5. **测试验证**: 测试模块功能是否正常

### 模块配置示例

```typescript
// vite.config.ts
const moduleLoader = new ESMModuleLoader(context);

const appModules = new Map([
  ['your-module', {
    flag: '__MODULE_YOUR_MODULE',
    path: getAppScriptUrl('your-module')
  }]
]);
```

## 部署与发布

### 构建流程

1. **代码检查**: 确保代码符合质量标准
2. **构建优化**: 执行生产构建
3. **测试验证**: 测试构建产物
4. **打包发布**: 生成发布包

### 发布到 Chrome Web Store

1. **准备材料**: 扩展图标、截图、描述等
2. **创建项目**: 在 Chrome Web Store 开发者控制台创建项目
3. **上传扩展**: 上传构建后的扩展包
4. **审核发布**: 等待审核通过后发布

## 开发资源

- [Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions/)
- [Vue 3 文档](https://vuejs.org/guide/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Vite 文档](https://vitejs.dev/guide/)
- [Element Plus 文档](https://element-plus.org/zh-CN/)

## 常见问题排查

### 扩展加载失败

- 检查 `manifest.json` 配置是否正确
- 确认所有必要的文件都已包含
- 检查是否有语法错误或类型错误

### 功能模块不生效

- 检查模块是否正确注册
- 确认权限是否足够
- 查看控制台是否有错误信息
- 检查模块依赖是否完整

### 性能问题

- 使用 Chrome DevTools 分析性能瓶颈
- 检查是否有内存泄漏
- 优化 DOM 操作和事件处理
- 合理使用缓存机制

## 总结

MRIA 扩展是一个功能丰富、架构清晰的浏览器扩展项目。通过本指南，开发者应该能够快速上手项目开发，理解核心功能实现原理，并掌握常见问题的解决方法。

扩展开发是一个不断学习和探索的过程，希望本指南能够为开发者提供有价值的参考，帮助他们构建出更加优秀的浏览器扩展。

---

**文档更新时间**: 2026-02-05
**版本**: 1.0.0
