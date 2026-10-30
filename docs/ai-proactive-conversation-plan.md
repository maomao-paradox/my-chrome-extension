# AI 主动发起对话功能 · 实现计划

## Summary（概要）

为侧边栏 AI 增加「主动发起对话」能力：一个循环随机定时器（每次 0~10 分钟内随机）触发后——

1. 调用**真实 AI 模型**生成一句主动开场白（上下文 = 记忆系统 + 当前时间）；
2. 把这条消息以 `AI：` 前缀写入记忆系统的 `conversation` 类别（用户下次打开对话窗即可在历史中看到）；
3. 通过既有事件总线触发 dock 的 `active` 滑出动画（与鼠标悬浮完全相同的 CSS 效果），**2 秒后自动隐藏**，仅作提醒、不自动打开对话窗。

### 用户已确认的决策（2026-10-29）

| 决策点 | 选择 |
| --- | --- |
| 消息呈现方式 | **dock 弹出提醒即可**：消息写入对话历史，用户点开窗口才看到 |
| 内容生成方式 | **调用真实 AI 模型**（记忆做 context，失败时需降级） |
| 定时器模式 | **循环触发**：每次触发后重新随机 0~10 分钟，页面刷新重新计时 |

---

## Current State Analysis（现状分析）

### 侧边栏挂载与显隐

- 入口 [index.ts](file:///home/manteia/kria-nove/extension/src/modules/sidebar/index.ts)：L232-L284 等待 body 就绪后创建 Shadow DOM 容器并 `createRoot` 渲染 `SidebarApp`；L305-L320 `enable()` 负责注入/显示；L330-L338 `disable()` 用 `display: none` 隐藏。**定时器的 start/stop 就挂这两个函数**。
- `SidebarApp` → [HoverMenu.tsx](file:///home/manteia/kria-nove/extension/src/modules/sidebar/HoverMenu.tsx) → `MikuChatWindow`（内含 `AIConversation`）。

### dock 滑出机制（本次要复用的「悬浮效果」）

- [hover-menu.scss](file:///home/manteia/kria-nove/extension/src/modules/sidebar/styles/hover-menu.scss) L75-L98：`.dock:hover` **或** `.dock.active` 时，`.miku-trigger` 与 `.dock-cell` 通过 `transform: translate(...)` + `transition` 从屏幕右缘滑出——**纯 CSS transition，加/去 class 即程序可控**。
- [HoverMenu.tsx](file:///home/manteia/kria-nove/extension/src/modules/sidebar/HoverMenu.tsx) L87-L96：`show()` 加 `active` class、`hide()` 移除；L124-L143 已注册 `bus.on("show" / "hide")`。
- [bus.ts](file:///home/manteia/kria-nove/extension/src/event/bus.ts)：`mitt` 事件总线，直接 `bus.emit("show")` / `bus.emit("hide")` 即可程序触发悬浮动画，**HoverMenu 零改动**。

### AI 调用协议（复用，不新增通信通道）

- [AIConversation.tsx](file:///home/manteia/kria-nove/extension/src/modules/sidebar/components/AIConversation.tsx) L546-L557：`chrome.runtime.connect("ai-conversation-${messageId}")` + `postMessage({ type: "START_AI_CONVERSATION", payload: { prompt, role, provider, model, apiKey, apiBaseUrl, systemPrompt } })`；回包为 `AI_CONVERSATION_STREAM_DATA` / `AI_CONVERSATION_COMPLETE` / `AI_CONVERSATION_ERROR`。
- [stream-manager.ts](file:///home/manteia/kria-nove/extension/src/service-worker/background/stream-manager.ts) 头注释 L6：`startStream` 收到 prompt 后**自动**调用 `memoryService.buildContext(role, prompt)` 注入记忆——**记忆上下文在 background 侧免费获得**，content 侧只需把「时间 + 主动开口」指令写进 prompt/systemPrompt。

### 记忆系统读取/写入 API

- [memory-service.ts](file:///home/manteia/kria-nove/extension/src/services/memory/memory-service.ts)：`listRoles()` L218、`getIdentity(role)` L111、`listByCategory(role, category)` L185、`addEntry(params)` L122。
- 记忆类别（[types.ts](file:///home/manteia/kria-nove/extension/src/services/memory/types.ts) L28-L33）：`identity / conversation / preference / fact / episodic`。
- **写回格式关键**：[AIConversation.tsx](file:///home/manteia/kria-nove/extension/src/modules/sidebar/components/AIConversation.tsx) 的 `parseConversationEntry` 只识别 `用户：` / `AI：` 前缀行。主动消息没有用户侧，直接写 `AI：${text}` 单条即可被正确解析为 assistant 历史消息。

---

## Proposed Changes（改动方案）

### 1. 新增 `extension/src/modules/sidebar/proactive-chat.ts`（核心模块，纯 TS 无 UI）

导出两个函数：`startProactiveLoop()` / `stopProactiveLoop()`。内部三个关注点：

**a) 调度器（循环随机 0~10 分钟）**

```ts
const MIN_DELAY = 0;                    // 0 分钟
const MAX_DELAY = 10 * 60 * 1000;       // 10 分钟
const nextDelay = () => MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
// setTimeout 循环：每次触发完成后重新 nextDelay() 排期；stop 时 clearTimeout
```

- 触发瞬间先判 `document.hidden`：页面不可见 → 跳过本次，直接重新排期（不打扰、不浪费 API）。
- 模块级 `timerId` + `running` 标志，重复调用 `startProactiveLoop` 幂等（先 stop 再 start）。

**b) 内容生成（真实 AI 模型 + 失败降级）**

主路径（复用现有 port 协议）：

1. `const config = await loadAIConfig()`（来自 `@/service-worker/chrome-api/ai-config`）；无 config → 直接走降级。
2. 选角色：`const roles = await svc.listRoles()`，取 `roles[0]`，兜底 `"hatsune_miku_tavern"`；`getIdentity(role)` 取 `systemPromptTemplate` 作角色口吻基底。
3. 组装时间上下文：`getTimePeriod(now)` 返回 `清晨/上午/下午/傍晚/晚上/深夜`（按小时分段）+ `HH:mm` 具体时间。
4. `systemPrompt` = 角色模板 + 主动对话指令（「你要主动对用户开口：结合你记忆中的用户偏好/最近话题与当前时间段，说 1~2 句自然简短的话，不要复述最近的对话原文，不要提问式轰炸」）。
5. `prompt` = 固定触发句（如 `（系统：现在是${period} ${hh:mm}，请主动发起对话）`）——记忆注入由 background 的 `buildContext` 自动完成。
6. 收集 `AI_CONVERSATION_STREAM_DATA` 拼接 → `AI_CONVERSATION_COMPLETE` 时取全文，`trim` 并截断到 ~120 字；`AI_CONVERSATION_ERROR` / 空结果 / 超时（30s `setTimeout` 看门狗）→ 抛错进降级。

降级路径（本地模板池，按时间段分桶随机）：

```ts
const FALLBACK_TEMPLATES: Record<TimePeriod, string[]> = {
  清晨: ["早安呀，新的一天开始了，要不要先聊聊今天的计划？"],
  上午: ["上午好~ 工作学习还顺利吗？"],
  // …每个时间段 3~5 条
};
```

**c) 落记忆 + dock 提醒**

```ts
await svc.addEntry({
  role, content: `AI：${text}`, category: "conversation",
  importance: "low", source: "ai-proactive",
});
bus.emit("show");
setTimeout(() => bus.emit("hide"), 2000);   // 2 秒后自动隐藏
```

- `importance: "low"`：主动消息不该污染长期记忆权重。
- dock 弹出走 mitt 总线，HoverMenu 现有的 `bus.on("show"/"hide")` 直接响应，CSS transition 自动播放——**这就是「鼠标悬浮的效果，用 CSS 控制」的程序化复用**。

### 2. 修改 `extension/src/modules/sidebar/index.ts`（接线，~4 行）

- `enable()` 注入/显示完成后调用 `startProactiveLoop()`；
- `disable()` 中调用 `stopProactiveLoop()`；
- 顶部 import 新模块。

### 3. 新增 `extension/test/react-sidebar-proactive-chat.spec.ts`（单元测试）

> 文件名必须匹配 [vitest.config.ts](file:///home/manteia/kria-nove/extension/vitest.config.ts) L31-L43 的 `test/react-*.spec.ts` include 规则。

- **调度器**：`vi.useFakeTimers()` → 触发时刻 ∈ [0, 10min]；触发后自动再排期（循环）；`stopProactiveLoop()` 后推进 20min 不再触发；重复 start 幂等。
- **生成主路径**：mock `chrome.runtime.connect` 返回假 port（`onMessage.addListener` 捕获回调后手动推 STREAM_DATA/COMPLETE）+ mock `@/services/memory` → 断言 `addEntry` 收到 `AI：` 前缀、`category: "conversation"`、`source: "ai-proactive"` 的内容；断言 `bus` 的 show/hide 间隔 2s。
- **降级路径**：port 推 ERROR（或无 config）→ 断言写入了模板池消息且仍发出 show/hide。
- **document.hidden**：mock 为 true → 断言不调用 connect、直接重新排期。

---

## Assumptions & Decisions（假设与决策）

1. **不自动打开 MikuChatWindow、不加气泡预览**——严格按用户选择「dock 弹出提醒即可」。
2. **不做 Options 设置项**：v1 用模块内常量 `PROACTIVE_ENABLED = true` 控制；后续需要再做 UI（非本次范围）。
3. **已打开的对话窗不会实时刷新出这条消息**：`AIConversation` 只在 role 变化/保存回合时重载历史，用户下次打开或发消息时可见。此为「提醒即可」决策下的可接受行为，列入 known limitation。
4. **页面会话级生命周期**：content script 随页面销毁，定时器不跨页面/浏览器重启持久化（与用户选择的「页面刷新重新计时」一致）。
5. **不需要 quiet hours / 频次上限**：用户未要求，循环间隔本身 ≤10 分钟即上限。
6. **主动消息不参与 `observe` 学习**：它不是用户对话回合，跳过 `observe`，仅 `addEntry`。

## Verification（验证步骤）

1. `cd extension && npx vitest run test/react-sidebar-proactive-chat.spec.ts` —— 新测试全绿。
2. `npx vitest run test/react-sidebar-AIConversation.spec.tsx` —— 既有回归不破。
3. `npx tsc --noEmit` —— 涉及文件无类型错误。
4. 手动验证（由主人操作，薇薇不自行起服务）：加载扩展 → 打开任意页面 → 把随机区间临时调小（或等待触发）→ 观察 dock 弹出 2s 后隐藏 → 点开 Miku 对话窗，历史里出现 AI 主动消息。
