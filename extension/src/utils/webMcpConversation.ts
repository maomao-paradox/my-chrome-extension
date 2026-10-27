import type { ChatHistoryMessage } from "@/types/web-mcp";

export const MAX_PRIOR_CONVERSATION_CHARACTERS = 16000;
export const MAX_TOOL_RESULT_CHARACTERS = 6000;

export const buildToolContinuationPrompt = (
  originalRequest: string,
  toolResults: Array<{ name: string; content: string }>,
): string =>
  [
    "继续完成下面的用户原始请求，不要只汇报工具结果。",
    "[原始用户请求]",
    originalRequest,
    "[本轮网页工具执行结果]",
    ...toolResults.map(
      ({ name, content }) =>
        `工具 ${name} 返回：\n${limitToolResultForContext(content)}`,
    ),
    "根据这些结果继续执行所有尚未完成的要求；如果用户要求在页面上展示、填写或修改内容，必须调用相应工具完成该页面操作。完成后简洁确认结果。",
  ].join("\n\n");

export const buildTaskReminder = (originalRequest: string): string =>
  [
    "继续完成这项任务，保留并满足用户请求中的每一项要求：",
    originalRequest,
    "工具调用只是完成任务的步骤；不要把工具结果当作最终答复。若用户要求页面操作，必须完成该操作。",
  ].join("\n\n");

export const limitToolResultForContext = (content: string): string => {
  if (content.length <= MAX_TOOL_RESULT_CHARACTERS) {
    return content;
  }

  return `${content.slice(0, MAX_TOOL_RESULT_CHARACTERS)}\n[工具结果过长，后续内容已省略]`;
};

export const trimPriorConversationHistory = (
  history: ChatHistoryMessage[],
  maxCharacters = MAX_PRIOR_CONVERSATION_CHARACTERS,
): ChatHistoryMessage[] => {
  const turns: ChatHistoryMessage[][] = [];

  for (const message of history) {
    if (message.role === "user" || turns.length === 0) {
      turns.push([]);
    }
    turns[turns.length - 1].push(message);
  }

  const retainedTurns: ChatHistoryMessage[][] = [];
  let retainedCharacters = 0;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const turnCharacters = JSON.stringify(turn).length;
    if (
      retainedTurns.length > 0 &&
      retainedCharacters + turnCharacters > maxCharacters
    ) {
      break;
    }
    retainedTurns.unshift(turn);
    retainedCharacters += turnCharacters;
  }

  return retainedTurns.flat();
};
