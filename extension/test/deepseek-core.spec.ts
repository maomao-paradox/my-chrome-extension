import { describe, expect, it } from "vitest";
import { parseDeepSeekStreamLines } from "@/shared/deepseek-core";

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
