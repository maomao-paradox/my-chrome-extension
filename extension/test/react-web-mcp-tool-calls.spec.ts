import {
  appendOpenAIToolCallDeltas,
  finalizeOpenAIToolCalls,
} from "@/service-worker/deepseek/openai-tool-calls";
import { buildOpenAICompatibleRequestBody } from "@/service-worker/deepseek/openai-request";
import { buildConfig } from "@/utils/config";
import {
  buildTaskReminder,
  buildToolContinuationPrompt,
  limitToolResultForContext,
  trimPriorConversationHistory,
} from "@/utils/webMcpConversation";

describe("WebMCP OpenAI tool-call stream aggregation", () => {
  it("joins fragmented names and JSON arguments across SSE deltas", () => {
    const calls = new Map();
    appendOpenAIToolCallDeltas(
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_",
                  function: { name: "_12_", arguments: '{"url":' },
                },
              ],
            },
          },
        ],
      },
      calls,
    );
    appendOpenAIToolCallDeltas(
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "abc",
                  function: { name: "openPage", arguments: '"https://example.com"}' },
                },
              ],
            },
          },
        ],
      },
      calls,
    );

    expect(finalizeOpenAIToolCalls(calls)).toEqual([
      {
        id: "call_abc",
        name: "_12_openPage",
        args: { url: "https://example.com" },
      },
    ]);
  });

  it("preserves multiple calls in provider order", () => {
    const calls = new Map();
    appendOpenAIToolCallDeltas(
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 1, id: "b", function: { name: "second", arguments: "{}" } },
                { index: 0, id: "a", function: { name: "first", arguments: "{}" } },
              ],
            },
          },
        ],
      },
      calls,
    );

    expect(finalizeOpenAIToolCalls(calls).map(({ name }) => name)).toEqual([
      "first",
      "second",
    ]);
  });

  it("rejects malformed JSON arguments instead of returning an empty object", () => {
    const calls = new Map();
    appendOpenAIToolCallDeltas(
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, function: { name: "broken", arguments: "{" } },
              ],
            },
          },
        ],
      },
      calls,
    );

    expect(() => finalizeOpenAIToolCalls(calls)).toThrow(
      '工具 "broken" 返回了无效的 JSON 参数。',
    );
  });

  it("assigns distinct model names to duplicate tools across frames", () => {
    const config = buildConfig([
      {
        name: "getInfo",
        description: "Get page information",
        inputSchema: '{"type":"object","properties":{}}',
        frameId: 0,
      },
      {
        name: "getInfo",
        description: "Get iframe information",
        inputSchema: '{"type":"object","properties":{}}',
        frameId: 12,
      },
    ]);

    expect(config.tools.map(({ function: fn }) => fn.name)).toEqual([
      "_frame_0_tool_0",
      "_frame_12_tool_1",
    ]);
    expect(config.toolByName.get("_frame_12_tool_1")).toMatchObject({
      name: "getInfo",
      frameId: 12,
    });
  });

  it("includes MCP tools and complete history in the OpenAI-compatible request", () => {
    const tool = {
      type: "function" as const,
      function: {
        name: "_frame_0_tool_0",
        description: "Search flights",
        parameters: { type: "object", properties: {} },
      },
    };
    const body = buildOpenAICompatibleRequestBody(
      "deepseek-chat",
      "find flights",
      "Use the current page tools.",
      {
        messages: [{ role: "user", content: "find flights" }],
        tools: [tool],
      },
    );

    expect(body).toMatchObject({
      model: "deepseek-chat",
      stream: true,
      tool_choice: "auto",
      tools: [tool],
      messages: [
        { role: "system", content: "Use the current page tools." },
        { role: "user", content: "find flights" },
      ],
    });
  });

  it("repeats the complete original task in tool continuation prompts", () => {
    const prompt = buildToolContinuationPrompt(
      "计算 9 和 2 的结果，并将结果打印在页面上。",
      [{ name: "coculate", content: '{"result":83}' }],
    );

    expect(prompt).toContain("计算 9 和 2 的结果，并将结果打印在页面上。");
    expect(prompt).toContain('工具 coculate 返回：\n{"result":83}');
    expect(prompt).toContain("必须调用相应工具完成该页面操作");
    expect(
      buildTaskReminder("计算结果并打印在页面上。"),
    ).toContain("打印在页面上");
  });

  it("bounds tool results included in model context", () => {
    const limited = limitToolResultForContext("x".repeat(7000));

    expect(limited.length).toBeLessThan(7000);
    expect(limited).toContain("[工具结果过长，后续内容已省略]");
  });

  it("trims old history by complete user turns and keeps the newest turn", () => {
    const history = [
      { role: "user" as const, content: "old request" },
      { role: "assistant" as const, content: "old response".repeat(10) },
      { role: "user" as const, content: "new request" },
      { role: "assistant" as const, content: "new response" },
    ];

    expect(trimPriorConversationHistory(history, 100)).toEqual(
      history.slice(2),
    );
  });
});
