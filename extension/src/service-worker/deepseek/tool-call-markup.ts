/**
 * WebMCP 工具调用标记的文本清理工具。
 *
 * 独立成纯函数模块：连续回复、主动消息等链路都需要它，
 * 但这些链路（及其测试）只依赖 `../deepseek` 的 AI 调用入口，
 * 不应该为了一个字符串处理函数去耦合或 mock 整个 deepseek 模块。
 */

/**
 * 移除正文里的工具调用标记，只保留 AI 真正要说的话。
 *
 * 无 tools 的调用（连续回复 / 主动消息）也可能受会话上下文影响而吐出
 * `<webmcp_tool_calls>` 标记；这些标记只应由后台解析，绝不能显示在聊天框，
 * 也不应写进记忆。
 */
export function stripToolCallMarkup(content: string): string {
    if (!content) return "";
    return content
        .replace(/<webmcp_tool_calls>[\s\S]*?<\/webmcp_tool_calls>/gi, "")
        .replace(/<｜｜DSML｜｜[\s\S]*?<\/｜｜DSML｜｜\s*invoke\s*>/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
