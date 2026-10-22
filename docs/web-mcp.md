# 角色与任务
你是一个资深的 Chrome 扩展（Manifest V3）开发专家和前端架构师。
请帮我在侧边栏添加一个新的功能：自动发现当前网页中注册的 AI 工具（WEB-MCP），并在侧边栏中通过大语言模型（LLM）或手动的方式执行这些工具。

# 核心模块与职责说明

## 1. 内容脚本 (src/sfs/web-mcp.js)
- **职责**：注入到每个页面的顶层及所有 iframe 中，负责与页面的 `window.modelContext`（或类似的自定义工具注册表）通信。
- **触发时机**：
  - 页面加载完成时（`onInstalled` 时通过 `chrome.scripting` 注入，或匹配特定 URL 注入）。
  - 页面动态注册/注销工具时（通过 MutationObserver 或事件监听）。
- **消息交互**：
  - 接收侧边栏发来的 `LIST_TOOLS`：调用 `document.modelContext.getTools()` 获取当前页面工具列表。必须包含 `name, description, inputSchema, frameId`（如果是 iframe，需通过 postMessage 或 runtime 获取 frameId）。
  - 接收侧边栏发来的 `EXECUTE_TOOL`：根据传入的工具名和参数，调用 `document.modelContext.executeTool(name, args)`，并将执行结果回传给侧边栏。

## 2. 后台脚本 (src/service-worker/background - Service Worker)
- **职责**：扩展的中枢神经，处理跨域、跨 Tab 通信，维护工具状态，以及对接 AI 流式接口。
- **触发时机与逻辑**：
  - 扩展安装时（`chrome.runtime.onInstalled`）：向所有已打开的 Tab 注入 `web-mcp.js`。
  - Tab 切换或更新时（`chrome.tabs.onActivated`, `chrome.tabs.onUpdated`）：向当前 Active Tab 发送 `LIST_TOOLS`，收到回复后更新扩展图标上的 Badge（显示当前页面工具数量）。
  - 端口通信（`chrome.runtime.onConnect`）：监听来自侧边栏的 `ai-conversation-*` 端口。接收侧边栏的 LLM 请求，向第三方大模型 API（如 OpenAI 格式）发起流式请求（SSE）。将流式数据透传给侧边栏，并在流结束时，解析并聚合 `tool_calls` 字段，回传给侧边栏。

## 3. 侧边栏 (src/pages/sidepanel)
- **职责**：用户交互界面。展示工具列表、提供手动测试面板、提供 AI 对话面板。
- **触发时机与逻辑**：
  - 侧边栏打开时，当切换到web-mcp标签页时：主动向后台发送消息，触发 `LIST_TOOLS`，获取并渲染当前页面的工具列表。
  - 用户点击执行时：组装参数，通过 `chrome.tabs.sendMessage` 发给 web-mcp.js 执行工具。
  - 用户发送 Prompt 时：调用后台的 AI 端口进行流式对话。
  - **AFC（自动函数调用）循环**：如果 AI 返回了 `tool_calls`，侧边栏解析 `tool_calls`，自动调用相应工具，将工具结果组装成 `role: tool` 的消息，再次发给后台请求 AI，直到 AI 返回最终文本。

# 消息传递机制（架构规范）

请重点说明各个模块之间的消息传递结构和时序：

1. **背景 -> 内容脚本**：`chrome.tabs.sendMessage`
   - `{ action: 'LIST_TOOLS' }`
   - `{ action: 'EXECUTE_TOOL', name: string, inputArgs: string, frameId: number }`
2. **内容脚本 -> 背景 -> 侧边栏**：`chrome.runtime.sendMessage`
   - `{ type: 'TOOLS_UPDATED', tools: Array, url: string }`
3. **侧边栏 <-> 背景（AI 流式通信）**：`chrome.runtime.connect`
   - 建立长连接 `ai-conversation-${messageId}`
   - 侧边栏发送：`{ type: 'START_AI_CONVERSATION', payload: { prompt, systemPrompt, tools, messages } }`
   - 背景回传流：`{ type: 'AI_CONVERSATION_STREAM_DATA', payload: { content: '...' } }`
   - 背景回传结束：`{ type: 'AI_CONVERSATION_COMPLETE', payload: { functionCalls: [{ name, args }] } }`

# 关键技术难点与要求

1. **多 Frame 工具发现**：如果工具在 iframe 中，如何准确获取 `frameId` 并在后续执行时定位到该 frame？（提示：使用 `chrome.webNavigation` 或让 content.js 向 background 请求自己的 frameId）。
2. **工具命名防冲突**：不同 iframe 可能有同名工具。侧边栏在将工具发给 LLM 时，必须对工具名进行重命名（如 `${frameId}_${toolName}`），在解析 tool_calls 时再逆向解析出真实的 frameId 和 name。
3. **LLM 提示词设计**：请提供让 LLM 能够主动使用工具的 `systemPrompt` 模板。
4. **流式工具调用解析**：后台处理大模型 SSE 流时，如果遇到 `delta.tool_calls`，它可能是分片返回的（arguments 被拆成多段字符串），后台必须实现聚合逻辑，在流结束时拼成完整的 JSON 对象返回给侧边栏。

# 输出要求
请按以下结构输出：
2. **核心流程图** (文字描述)
4. **后台脚本的核心代码** (特别是 AI 流式解析和 tool_calls 聚合)
5. **侧边栏 (前端REACT组件) 的核心代码** (特别是 AFC 循环逻辑)
6. **推荐的 System Prompt**
