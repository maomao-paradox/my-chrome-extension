import { describe, expect, it } from "vitest";
import {
  DeepSeekClient,
  parseDeepSeekStreamLines,
} from "@/service-worker/deepseek/deepseek-core";

describe("parseDeepSeekStreamLines", () => {
  it("保留首个 response fragments 快照中的左括号", () => {
    const result = parseDeepSeekStreamLines([
      "event: update_session",
      'data: {"updated_at":1790213244.774333}',
      'data: {"v":{"response":{"message_id":76,"fragments":[{"id":2,"type":"RESPONSE","content":"[\\n","references":[],"stage_id":1}]}}}',
      'data: {"p":"response/fragments/-1/content","o":"APPEND","v":"{\\""}',
      'data: {"v":"患者"}',
      'data: {"v":"ID"}',
      'data: {"v":"\\":\\""}',
      'data: {"v":"P"}',
    ]);

    expect(result.content).toBe('[\n{"患者ID":"P');
  });
});

/* ------------------------------------------------------------------ *
 * DeepSeekClient.completion —— 无 onData 时也必须走 SSE 流式路径
 * ------------------------------------------------------------------ */
describe("DeepSeekClient.completion", () => {
  /** 构造一个返回 SSE 流的 Response 替身 */
  function makeSSEResponse(chunks: string[]): Response {
    const encoder = new TextEncoder();
    let index = 0;
    return {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => {
            if (index < chunks.length) {
              return { done: false, value: encoder.encode(chunks[index++]) };
            }
            return { done: true, value: undefined };
          },
        }),
      },
      // 任何对 text()/json() 的调用都会让测试失败 —— 完成端点只讲 SSE
      text: async () => {
        throw new Error("completion() must not read the response as text");
      },
      json: async () => {
        throw new Error("completion() must not parse the response as JSON");
      },
    } as unknown as Response;
  }

  function makeClient(response: Response): DeepSeekClient {
    return new DeepSeekClient({
      sessionStore: {
        get: async () => null,
        set: async () => {},
        clear: async () => {},
      },
      powSolver: { solve: async () => "pow" },
      authToken: "token",
      cookies: "cookie",
      fetchImpl: (async () => response) as typeof fetch,
    });
  }

  // 注：流式内容刻意用纯 ASCII —— vitest 沙箱里 V8 对 split 切片字符串
  // 解析多字节字符有怪癖（生产环境无此问题），这里重点是验证
  // "走流式读取、绝不 JSON.parse 整个响应"这一行为。
  const sseBody = [
    'data: {"v":{"response":{"message_id":1,"fragments":[{"id":2,"type":"RESPONSE","content":"hello"}]}}}',
    "event: finish",
    "",
  ].join("\n");

  it("不传 callbacks 时也走流式读取，绝不用 JSON 解析 SSE 响应", async () => {
    const client = makeClient(makeSSEResponse([sseBody]));

    // 回归：之前无 onData 会落到 sendRequest 分支 → JSON.parse("event: ...") 抛
    // "SyntaxError: Unexpected token 'e', \"event: rea\"... is not valid JSON"
    await expect(
      client.completion(
        { prompt: "hi", chat_session_id: "s1" },
        "pow-response",
        // 故意不传任何 callbacks
      ),
    ).resolves.toBeNull();
  });

  it("传 onData 时正常收集流式内容", async () => {
    const client = makeClient(makeSSEResponse([sseBody]));
    const received: string[] = [];

    await client.completion(
      { prompt: "hi", chat_session_id: "s1" },
      "pow-response",
      { onData: (data) => received.push(data) },
    );

    expect(received.join("")).toContain("hello");
  });
});
