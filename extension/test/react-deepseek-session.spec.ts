import {
  buildPromptWithSystemPrompt,
  describeDeepSeekResponseError,
  extractDeepSeekSessionId,
  parseDeepSeekToolCalls,
  type DeepSeekWebTool,
} from "@/service-worker/deepseek/deepseek-core";

describe("DeepSeek session response parsing", () => {
  it("reads the existing nested session ID format", () => {
    expect(
      extractDeepSeekSessionId({
        data: { biz_data: { id: "session-123" } },
      }),
    ).toBe("session-123");
  });

  it("supports alternate session ID fields and numeric IDs", () => {
    expect(
      extractDeepSeekSessionId({
        data: { biz_data: { chat_session_id: 12345 } },
      }),
    ).toBe("12345");
  });

  it("returns a useful service error without exposing the raw response", () => {
    expect(
      describeDeepSeekResponseError({
        code: 401,
        msg: "登录已过期",
        data: { biz_data: {} },
      }),
    ).toBe("code 401: 登录已过期");
  });

  it("does not treat malformed responses as a session ID", () => {
    expect(extractDeepSeekSessionId({ data: { biz_data: { id: " " } } })).toBeNull();
    expect(extractDeepSeekSessionId(null)).toBeNull();
  });

  it("adds WebMCP tools to the DeepSeek web-session prompt without API credentials", () => {
    const tools: DeepSeekWebTool[] = [
      {
        type: "function",
        function: {
          name: "_frame_0_tool_0",
          description: "Search flights",
          parameters: { type: "object", properties: { destination: { type: "string" } } },
        },
      },
    ];

    const prompt = buildPromptWithSystemPrompt(
      "Find a flight to SFO",
      "You are a browser assistant.",
      tools,
    );

    expect(prompt).toContain("AVAILABLE WEBMCP TOOLS");
    expect(prompt).toContain("_frame_0_tool_0");
    expect(prompt).toContain("webmcp_tool_calls");
    expect(prompt).toContain("Find a flight to SFO");
  });

  it("parses valid DeepSeek WebMCP calls and rejects names not in the tool list", () => {
    const tools: DeepSeekWebTool[] = [
      {
        type: "function",
        function: {
          name: "_frame_0_tool_0",
          parameters: { type: "object" },
        },
      },
    ];

    expect(
      parseDeepSeekToolCalls(
        '<webmcp_tool_calls>{"tool_calls":[{"name":"_frame_0_tool_0","arguments":{"destination":"SFO"}}]}</webmcp_tool_calls>',
        tools,
      ),
    ).toEqual([
      {
        id: "deepseek_0",
        name: "_frame_0_tool_0",
        args: { destination: "SFO" },
      },
    ]);

    expect(() =>
      parseDeepSeekToolCalls(
        '<webmcp_tool_calls>{"tool_calls":[{"name":"unknown","arguments":{}}]}</webmcp_tool_calls>',
        tools,
      ),
    ).toThrow("unavailable WebMCP tool");
  });

  it("parses DeepSeek DSML calls blocks", () => {
    const tools: DeepSeekWebTool[] = [
      {
        type: "function",
        function: {
          name: "_frame_0_tool_0",
          parameters: { type: "object" },
        },
      },
    ];

    expect(
      parseDeepSeekToolCalls(
        '<｜｜DSML｜｜ calls>\n<｜｜DSML｜｜ invoke name="webmcp_tool_calls">{"tool_calls":[{"name":"_frame_0_tool_0","arguments":{"origin":"NYC","destination":"SFO","tripType":"one-way","outboundDate":"2026-10-26","inboundDate":"2026-10-26","passengers":1}}]}</｜｜DSML｜｜ parameter>\n</｜｜DSML｜｜ invoke>\n</｜｜DSML｜｜ calls>',
        tools,
      ),
    ).toEqual([
      {
        id: "deepseek_0",
        name: "_frame_0_tool_0",
        args: {
          origin: "NYC",
          destination: "SFO",
          tripType: "one-way",
          outboundDate: "2026-10-26",
          inboundDate: "2026-10-26",
          passengers: 1,
        },
      },
    ]);
  });
});
