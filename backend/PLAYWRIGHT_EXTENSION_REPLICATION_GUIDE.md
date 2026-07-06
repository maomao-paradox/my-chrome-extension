# Playwright + Chrome Extension 复刻说明

本文档用于后续在 KIRA:NOVE 项目中复刻 `~/playwright-repl` 的核心能力。目标不是完整照搬它的全部产品，而是提取适合当前产品的架构：Chrome 扩展控制用户真实标签页，后端负责任务、AI、记录和编排。

## 参考项目位置

本机参考项目：

```text
/home/manteia/playwright-repl
```

重点阅读文件：

```text
packages/extension/public/manifest.json
packages/extension/src/background.ts
packages/extension/src/panel/lib/bridge.ts
packages/extension/src/panel/lib/commands.ts
packages/extension/src/panel/lib/execute.ts
packages/extension/src/lib/sw-debugger-core.ts
packages/extension/src/content/recorder.ts
packages/extension/src/content/locator.ts
packages/extension/src/offscreen/offscreen.ts
packages/core/src/resolve-command.ts
packages/core/src/command-scripts.ts
packages/core/src/page-scripts.ts
packages/core/src/cdp-relay-server.ts
packages/mcp/src/relay.ts
```

## 核心结论

`playwright-repl` 的核心不是普通的 Node Playwright 服务。

普通 Playwright：

```text
Node process -> Playwright -> 新启动的 Chromium
```

`playwright-repl` 的扩展模式：

```text
Chrome Extension side panel
  -> background service worker
  -> playwright-crx
  -> chrome.debugger
  -> 用户当前真实 Chrome tab
```

它的关键价值是：扩展可以控制用户已经登录、已经打开的真实页面，而不是另起一个干净浏览器。

## 两种运行模式

### 1. 扩展内直接执行

这是最适合当前产品优先复刻的模式。

链路：

```text
Side Panel / Popup UI
  -> chrome.runtime.sendMessage
  -> background.ts
  -> crx.start()
  -> crxApp.attach(tabId)
  -> 得到 Playwright page/context
  -> page.click/fill/screenshot/locator...
```

关键代码在 `packages/extension/src/background.ts`：

```ts
crxApp = await crx.start()
currentPage = await crxApp.attach(tabId)
Object.assign(globalThis, {
  page: currentPage,
  context: crxApp.context(),
  crxApp,
  activeTabId,
  expect,
})
```

这里的 `page` 看起来像 Node Playwright 的 `page`，但实际控制的是 Chrome 里当前 tab。

### 2. CDP Relay 模式

这是给 CLI/MCP/AI agent 远程控制真实 Chrome tab 用的。

链路：

```text
Node / MCP
  -> chromium.connectOverCDP(ws://127.0.0.1:9877/cdp)
  -> CDPRelayServer
  -> WebSocket /relay
  -> extension offscreen document
  -> background service worker
  -> chrome.debugger
  -> 用户当前真实 tab
```

关键文件：

```text
packages/core/src/cdp-relay-server.ts
packages/extension/src/offscreen/offscreen.ts
packages/mcp/src/relay.ts
```

当前项目可以后置实现这部分。先做扩展内直接执行即可。

## 关键依赖

参考项目使用：

```json
"@playwright-repl/playwright-crx": "^1.21.4"
```

它的作用是把 Playwright 的 CDP 通信适配到 Chrome extension 的 `chrome.debugger` API。

Chrome 扩展权限需要重点包含：

```json
{
  "permissions": [
    "activeTab",
    "tabs",
    "sidePanel",
    "debugger",
    "storage",
    "scripting",
    "webNavigation"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "panel/panel.html"
  }
}
```

如果需要录屏或 relay，再增加：

```json
"tabCapture",
"offscreen",
"downloads"
```

## 命令执行原理

参考项目支持两类输入：

1. `.pw` 关键词命令
2. 原生 Playwright JS

例如：

```text
click "提交"
fill "用户名" "admin"
snapshot
await page.title()
```

执行流程：

```text
用户输入
  -> detectMode 判断是 pw 还是 js
  -> parseReplCommand / resolveCommand
  -> 生成 jsExpr
  -> chrome.debugger Runtime.evaluate
  -> 在 service worker 里执行
  -> service worker 全局变量里有 page/context/expect
```

示意：

```text
click "Submit"
  -> await page.getByText("Submit").click()
  -> Runtime.evaluate(expression)
```

关键文件：

```text
packages/extension/src/panel/lib/commands.ts
packages/extension/src/panel/lib/bridge.ts
packages/extension/src/lib/sw-debugger-core.ts
packages/core/src/resolve-command.ts
```

## 录制器原理

录制器是 content script，不直接用 Playwright。

它监听真实页面事件：

```text
click
input
change
keydown
focusout
navigation
```

然后把用户操作转换成：

```ts
{
  pw: 'click "Submit"',
  js: 'await page.getByRole("button", { name: "Submit" }).click();'
}
```

关键文件：

```text
packages/extension/src/content/recorder.ts
packages/extension/src/content/locator.ts
```

设计特点：

- 监听 capture 阶段，但不 `preventDefault`，不影响用户正常操作。
- 对输入框做 fill buffering，避免每输入一个字符都生成一步。
- checkbox/radio/select 用 change 事件记录。
- iframe 通过 frame path 记录 `--frame` 或 `.contentFrame()` 链。
- locator 优先用 role、accessible name、label、上下文文本，而不是脆弱 CSS 路径。

## 当前产品建议架构

当前项目已有：

```text
/home/manteia/kria-nove/extension
/home/manteia/kria-nove/backend
```

建议职责拆分：

```text
Chrome extension
  - 控制真实 tab
  - 录制用户操作
  - 执行自动化步骤
  - 展示执行过程、截图、错误

Go backend
  - 保存任务
  - 保存录制步骤
  - 保存执行日志
  - 调 AI 生成/修复步骤
  - 给扩展下发任务
  - 接收扩展执行结果
```

不要把所有真实 tab 控制都放到 Go 后端的 `playwright-go`。`playwright-go` 启动的是独立浏览器，不能直接复用用户当前 Chrome tab 的登录态。Go 后端适合做任务中心和 AI 编排。

## 最小可用版本范围

第一阶段不要复刻全部功能。先做最小闭环：

### 扩展能力

- attach 当前 tab
- 执行动作：
  - goto
  - click
  - fill
  - press
  - wait
  - extract text
  - screenshot
- 开始录制
- 停止录制
- 上报录制步骤到后端

### 后端能力

- 创建任务
- 保存步骤
- 获取任务详情
- 接收执行结果
- 保存截图 base64 或文件路径
- 可选：AI 根据自然语言生成步骤

## 推荐产品协议

不要直接长期存 `.pw` 字符串。产品化建议存结构化 JSON。

示例：

```json
{
  "id": "step_001",
  "type": "click",
  "target": {
    "kind": "role",
    "role": "button",
    "name": "提交"
  },
  "timeoutMs": 10000
}
```

更多例子：

```json
{
  "type": "fill",
  "target": {
    "kind": "label",
    "text": "用户名"
  },
  "value": "admin"
}
```

```json
{
  "type": "wait",
  "target": {
    "kind": "text",
    "text": "保存成功"
  },
  "timeoutMs": 15000
}
```

```json
{
  "type": "extract",
  "target": {
    "kind": "css",
    "selector": ".result"
  },
  "all": true
}
```

扩展执行时再把 JSON 转成 Playwright 调用：

```ts
if (step.target.kind === 'role') {
  await page.getByRole(step.target.role, { name: step.target.name }).click()
}
```

## 扩展侧实现步骤

### Step 1: 引入 playwright-crx

在扩展项目中安装：

```bash
npm install @playwright-repl/playwright-crx
```

或按项目包管理器使用 `yarn add`。

### Step 2: manifest 增加权限

需要：

```json
"debugger",
"scripting",
"tabs",
"activeTab",
"sidePanel",
"storage",
"webNavigation"
```

以及：

```json
"host_permissions": ["<all_urls>"]
```

注意：`debugger` 权限很敏感，UI 上要明确让用户知道当前扩展会控制页面。

### Step 3: background 建立 CrxRuntime

建议封装成独立模块：

```text
src/service-worker/automation/crx-runtime.ts
```

职责：

- `ensureCrxApp()`
- `getActiveTabId()`
- `attachToTab(tabId)`
- `getCurrentPage()`
- `detach()`
- stale page recovery

伪代码：

```ts
import { crx } from '@playwright-repl/playwright-crx'

let crxApp = null
let currentPage = null
let activeTabId = null

export async function ensureCrxApp() {
  if (crxApp) return crxApp
  crxApp = await crx.start()
  crxApp.on('close', reset)
  return crxApp
}

export async function attachToTab(tabId: number) {
  const app = await ensureCrxApp()
  currentPage = await app.attach(tabId)
  activeTabId = tabId
  Object.assign(globalThis, {
    page: currentPage,
    context: app.context(),
    crxApp: app,
    activeTabId,
  })
  return { ok: true, url: currentPage.url() }
}
```

### Step 4: 实现结构化步骤执行器

建议文件：

```text
src/service-worker/automation/step-runner.ts
```

核心方法：

```ts
runStep(page, step)
runSteps(page, steps)
```

需要支持：

```text
goto
click
fill
press
wait
extract
screenshot
verifyText
```

### Step 5: background message API

建议消息：

```ts
{ type: 'automation.attach', tabId?: number }
{ type: 'automation.runStep', step }
{ type: 'automation.runSteps', steps }
{ type: 'automation.recordStart' }
{ type: 'automation.recordStop' }
{ type: 'automation.health' }
```

返回：

```ts
{
  ok: true,
  result?: unknown,
  screenshot?: string,
  page?: {
    url: string,
    title: string
  }
}
```

错误：

```ts
{
  ok: false,
  error: string,
  code?: string
}
```

### Step 6: 录制器

先复刻 `recorder.ts` 的简化版。

第一版只记录：

- click
- fill
- press Enter
- select
- check/uncheck

先不要处理：

- video
- tracing
- debugger
- object tree
- full iframe chain

录制器通过：

```ts
chrome.runtime.sendMessage({
  type: 'automation.recordedAction',
  action
})
```

把步骤发回 background，再由 panel 展示或上报后端。

## 后端 API 建议

当前后端可以沿用已有 Go HTTP 基建。

建议新增这些产品 API：

```text
POST /api/automation/tasks
GET  /api/automation/tasks/{id}
POST /api/automation/tasks/{id}/steps
POST /api/automation/tasks/{id}/runs
POST /api/automation/runs/{id}/events
POST /api/automation/runs/{id}/screenshots
POST /api/automation/generate
```

### 创建任务

```json
{
  "name": "登录并导出报表",
  "description": "打开系统，登录，进入报表页，导出本月数据"
}
```

### 保存步骤

```json
{
  "steps": [
    {
      "type": "goto",
      "url": "https://example.com/login"
    },
    {
      "type": "fill",
      "target": { "kind": "label", "text": "用户名" },
      "value": "admin"
    },
    {
      "type": "click",
      "target": { "kind": "role", "role": "button", "name": "登录" }
    }
  ]
}
```

### 执行事件

```json
{
  "stepId": "step_001",
  "status": "passed",
  "durationMs": 530,
  "page": {
    "url": "https://example.com/dashboard",
    "title": "Dashboard"
  }
}
```

## AI 接入方式

AI 不应该直接输出可执行 JS。建议 AI 输出结构化步骤 JSON。

输入：

```json
{
  "intent": "登录系统并打开销售报表",
  "pageSnapshot": "...",
  "availableActions": ["goto", "click", "fill", "press", "wait", "extract"]
}
```

输出：

```json
{
  "steps": [
    {
      "type": "fill",
      "target": { "kind": "label", "text": "用户名" },
      "value": "{{username}}"
    },
    {
      "type": "fill",
      "target": { "kind": "label", "text": "密码" },
      "value": "{{password}}"
    },
    {
      "type": "click",
      "target": { "kind": "role", "role": "button", "name": "登录" }
    }
  ]
}
```

安全规则：

- 不让 AI 直接输出 `eval` / 任意 JS。
- 不让 AI 访问 cookies/history/bookmarks。
- 所有动作必须经过 schema 校验。
- 涉及提交、删除、支付、发送消息等动作前要求用户确认。

## 不建议第一阶段复刻的功能

这些功能强，但复杂度高，可以后置：

- JS debugger
- breakpoint / step over / step into
- ObjectTree CDP 懒加载
- video recording
- tracing zip
- MCP relay
- CLI connectOverCDP
- Playwright test runner
- 完整 `.pw` 语言

## 风险点

### debugger 权限敏感

Chrome 会提示扩展可以读取和修改用户访问的网站。产品上要有明确状态提示：

```text
已连接当前标签页
正在录制
正在执行自动化
```

### service worker 生命周期

MV3 service worker 会挂起。需要：

- 每次执行前检查 `currentPage` 是否可用。
- 失败时重新 attach。
- 长任务需要队列化，避免并发操作污染页面状态。

参考项目用：

```text
commandQueue
stale page recovery
```

### 特殊页面无法 attach

这些页面通常不能控制：

```text
chrome://*
edge://*
Chrome Web Store
其他扩展的 chrome-extension:// 页面
```

需要在 attach 前过滤。

### locator 稳定性

不要优先用绝对 CSS path。

优先级建议：

```text
role + accessible name
label
placeholder
text
test id
CSS selector fallback
```

### 用户真实页面副作用

扩展控制的是用户真实页面，点击/提交会真的发生。必须区分：

```text
dry-run / inspect
real-run
```

危险动作前加确认。

## 推荐目录规划

扩展项目中建议新增：

```text
src/service-worker/automation/
  crx-runtime.ts
  step-runner.ts
  message-handlers.ts
  types.ts
  safety.ts

src/content/automation-recorder/
  recorder.ts
  locator.ts
  frame-path.ts

src/pages/sidepanel/views/AutomationPanel.vue
src/services/api/automation-api.ts
src/types/automation.ts
```

Go 后端建议新增：

```text
internal/automation/tasks.go
internal/automation/runs.go
internal/automation/store.go
internal/handlers/automation_tasks.go
```

当前已有的 `internal/automation/service.go` 是 `playwright-go` 独立浏览器控制服务，可以保留为后端批处理能力，但真实用户 tab 自动化应优先在扩展侧通过 `playwright-crx` 实现。

## 最小开发计划

### Milestone 1: 扩展控制真实 tab

- 加 `playwright-crx`
- manifest 加权限
- background 实现 attach
- sidepanel 按钮：连接当前 tab
- sidepanel 按钮：获取 title/url
- sidepanel 按钮：截图

验收：

```text
打开任意网页 -> 点击连接 -> 返回当前页面 title/url -> 截图成功
```

### Milestone 2: 执行结构化步骤

- 定义 `AutomationStep`
- 实现 click/fill/press/wait/extract
- sidepanel 支持手动输入 JSON 步骤并执行

验收：

```text
在 demo 页面执行 fill + click + extract 成功
```

### Milestone 3: 录制

- 注入 recorder content script
- 记录 click/fill/press
- sidepanel 展示步骤列表
- 支持重放步骤

验收：

```text
用户手动操作一次 -> 生成步骤 -> 清空页面状态 -> 重放成功
```

### Milestone 4: 后端保存

- 扩展上报步骤到 Go 后端
- 后端保存 task/run/event
- sidepanel 能加载历史任务

验收：

```text
录制任务 -> 保存 -> 刷新扩展 -> 重新加载并执行
```

### Milestone 5: AI 生成步骤

- 后端接 AI
- 输入用户意图 + 页面 snapshot
- 输出结构化步骤 JSON
- 扩展执行前展示给用户确认

验收：

```text
用户输入“帮我登录并打开报表” -> AI 生成步骤 -> 用户确认 -> 执行
```

## 给后续 Codex 的提示

继续实现时，不要从 Go 后端 Playwright 开始扩展真实 tab 控制。正确方向是：

1. 先在扩展项目里接入 `@playwright-repl/playwright-crx`。
2. 复刻 `background.ts` 中的 `ensureCrxApp`、`attachToTab`、stale recovery。
3. 用结构化 JSON 步骤替代完整 `.pw` 语言。
4. 简化复刻 `recorder.ts` 和 `locator.ts`。
5. Go 后端只做任务存储、AI 编排、执行日志和截图归档。

如果需要参考原项目，优先读：

```text
/home/manteia/playwright-repl/packages/extension/src/background.ts
/home/manteia/playwright-repl/packages/extension/src/content/recorder.ts
/home/manteia/playwright-repl/packages/extension/src/content/locator.ts
/home/manteia/playwright-repl/packages/extension/src/panel/lib/bridge.ts
```

