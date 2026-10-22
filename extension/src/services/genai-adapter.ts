// services/genai-adapter.js
import { requestAI } from '@/service-worker/deepseek/ai-request';

// ---- 把你的 requestAI 适配成 sidebar 需要的接口 ----

export function createClient(apiKey: string) {
  // 你的 requestAI 内部从 chrome storage 读 config，这里的 apiKey 可以忽略，
  // 或者你可以改成把 apiKey 塞进 requestAI 的 options。
  return { apiKey };
}

export async function generateContent({ model, contents, systemPrompt, onDelta }) {
  const prompt = Array.isArray(contents)
    ? contents.map(toText).join('\n')
    : String(contents);

  const result = await requestAI(prompt, {
    model,
    systemPrompt,
    onDelta,          // 你新加的参数
  });

  return {
    text: result.success ? result.content : '',
    functionCalls: result.functionCalls || [],
    candidates: result.success ? undefined : [{ error: result.error }],
  };
}

function toText(c) {
  if (typeof c === 'string') return c;
  return c?.text ?? JSON.stringify(c);
}

// ---- Chat：维护多轮 history ----
export function createChat({ model, systemPrompt }) {
  const history = [];   // { role, content, tool_call_id? }

  return {
    async sendMessage({ message, config, onDelta }) {
      // message 可能是：用户字符串 / toolResponses 数组
      const isToolRound = Array.isArray(message);

      if (!isToolRound) {
        history.push({ role: 'user', content: String(message) });
      } else {
        // Gemini 风格 functionResponse → 你后台能接受的 tool 消息
        for (const tr of message) {
          const fr = tr.functionResponse;
          history.push({
            role: 'tool',
            name: fr.name,
            content: JSON.stringify(fr.response),
          });
        }
      }

      // 取最后一条 user 内容作为 prompt（requestAI 只收单条 prompt）
      // 更严谨的做法是：让 requestAI 支持 messages 数组（见上面第 1 节）
      const lastUser = [...history].reverse().find((m) => m.role === 'user');
      const prompt = lastUser?.content ?? '';

      const result = await requestAI(prompt, {
        model,
        systemPrompt: systemPrompt ?? joinSystem(config),
        onDelta,
        // 如果后台支持：
        // messages: history,
        // tools: config?.tools?.[0]?.functionDeclarations,
      });

      // 记录 assistant 回复
      history.push({
        role: 'assistant',
        content: result.content,
        tool_calls: result.functionCalls,
      });

      return {
        text: result.success ? result.content : '',
        functionCalls: result.functionCalls || [],
        candidates: result.success ? undefined : [{ error: result.error }],
      };
    },
  };
}

function joinSystem(config) {
  const si = config?.systemInstruction;
  if (!si) return undefined;
  return Array.isArray(si) ? si.join('\n') : si;
}