/**
 * @file src/pages/options/views/McpToolsView.tsx
 * @description MCP 工具列表页面 —— 只读展示 AI 可以调用的所有内置工具
 */
import { LOCAL_MCP_TOOLS } from "@/service-worker/background/mcp-tools";

/** 参数 schema 的精简展示 */
interface ParameterField {
  name: string;
  type: string;
  description?: string;
  required: boolean;
}

/** 从 JSON Schema parameters 提取可读的参数字段列表 */
function extractParameters(schema: any): ParameterField[] {
  if (!schema || !schema.properties) return [];
  const required = new Set(schema.required || []);
  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop?.type ?? "unknown",
    description: prop?.description,
    required: required.has(name),
  }));
}

const McpToolsView = () => {
  return (
    <section className="options-view mcp-tools-view">
      <div className="mcp-tools-grid">
        {LOCAL_MCP_TOOLS.map((tool) => {
          const fn = tool.function;
          const params = extractParameters(fn.parameters);

          return (
            <article key={fn.name} className="mcp-tool-card">
              {/* 头部：工具名 + 类型标签 */}
              <header className="mcp-tool-card__header">
                <code className="mcp-tool-card__name">{fn.name}</code>
                <span className="mcp-tool-card__badge">function</span>
              </header>

              {/* 描述 */}
              <p className="mcp-tool-card__desc">{fn.description}</p>

              {/* 参数列表 */}
              <div className="mcp-tool-card__params">
                <h4>Parameters</h4>
                {params.length === 0 ? (
                  <p className="mcp-tool-card__empty">（无参数）</p>
                ) : (
                  <ul className="mcp-tool-card__param-list">
                    {params.map((p) => (
                      <li key={p.name} className="mcp-tool-card__param">
                        <div className="mcp-tool-card__param-head">
                          <code>{p.name}</code>
                          <span className="mcp-tool-card__param-type">
                            {p.type}
                          </span>
                          {p.required && (
                            <span className="mcp-tool-card__param-req">
                              required
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="mcp-tool-card__param-desc">
                            {p.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default McpToolsView;
