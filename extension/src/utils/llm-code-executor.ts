export interface CodeExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  description?: string;
  executionTime: number;
}

export interface ParsedCodeBlock {
  code: string;
  description: string;
  isAsync: boolean;
  language: string;
}

const DANGEROUS_PATTERNS = [
  /\beval\s*\(/gi,
  /\bnew\s+Function\s*\(/gi,
  /\bdocument\.write\s*\(/gi,
  /\bwindow\.open\s*\(/gi,
  /\bwindow\.close\s*\(/gi,
  /\bwindow\.alert\s*\(/gi,
  /\bwindow\.confirm\s*\(/gi,
  /\bwindow\.prompt\s*\(/gi,
  /\bchrome\.cookies\b/gi,
  /\bchrome\.history\b/gi,
  /\bchrome\.bookmarks\b/gi,
  /\blocation\.href\s*=/gi,
  /\blocalStorage\b/gi,
  /\bsessionStorage\b/gi,
];

const SANDBOX_GLOBALS = {
  console: {
    log: (...args: unknown[]) => maLogger.log("[Sandboxed]", ...args),
    error: (...args: unknown[]) => maLogger.error("[Sandboxed]", ...args),
    warn: (...args: unknown[]) => maLogger.warn("[Sandboxed]", ...args),
    info: (...args: unknown[]) => maLogger.info("[Sandboxed]", ...args),
  },
  document,
  window: {
    location: { href: window.location.href, origin: window.location.origin },
    navigator: { userAgent: window.navigator.userAgent },
  },
  chrome: {
    runtime: {
      sendMessage: (...args: unknown[]) => chrome.runtime.sendMessage(...args),
    },
    tabs: {
      query: (...args: unknown[]) => chrome.tabs.query(...args),
    },
    storage: {
      local: {
        get: (...args: unknown[]) => chrome.storage.local.get(...args),
      },
    },
  },
};

export class LLMCodeExecutor {
  private static instance: LLMCodeExecutor;

  private constructor() {}

  public static getInstance(): LLMCodeExecutor {
    if (!LLMCodeExecutor.instance) {
      LLMCodeExecutor.instance = new LLMCodeExecutor();
    }
    return LLMCodeExecutor.instance;
  }

  public parseMarkdownCodeBlock(markdown: string): ParsedCodeBlock | null {
    const codeBlockMatch = markdown.match(/```(\w+)?\s*([\s\S]*?)```/);
    if (!codeBlockMatch) {
      return null;
    }

    const [, language = "javascript", code] = codeBlockMatch;

    const descriptionMatch = code.match(/\/\/\s*\[DESCRIPTION\]\s*([^\n]*)/);
    const description = descriptionMatch
      ? descriptionMatch[1].trim()
      : "No description";

    const isAsync = code.includes("async function") || code.includes("async(");

    return {
      code: code.trim(),
      description,
      isAsync,
      language: language.toLowerCase(),
    };
  }

  public validateCode(code: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        errors.push(`Potentially dangerous code detected: ${pattern.source}`);
      }
    }

    if (code.length > 5000) {
      errors.push("Code exceeds maximum allowed length (5000 characters)");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private createSandboxedContext(): Record<string, unknown> {
    return { ...SANDBOX_GLOBALS };
  }

  public async executeCode(
    parsed: ParsedCodeBlock,
  ): Promise<CodeExecutionResult> {
    const startTime = performance.now();

    try {
      const validation = this.validateCode(parsed.code);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Security validation failed:\n${validation.errors.join("\n")}`,
          description: parsed.description,
          executionTime: 0,
        };
      }

      const sandbox = this.createSandboxedContext();

      let result: unknown;
      if (parsed.isAsync) {
        const asyncWrapper = new Function(
          ...Object.keys(sandbox),
          `return (async function() { ${parsed.code} })()`,
        );
        result = await asyncWrapper(...Object.values(sandbox));
      } else {
        const syncWrapper = new Function(
          ...Object.keys(sandbox),
          `return (function() { ${parsed.code} })()`,
        );
        result = syncWrapper(...Object.values(sandbox));
      }

      const executionTime = performance.now() - startTime;

      return {
        success: true,
        result,
        description: parsed.description,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        description: parsed.description,
        executionTime,
      };
    }
  }

  public async executeMarkdown(markdown: string): Promise<CodeExecutionResult> {
    const parsed = this.parseMarkdownCodeBlock(markdown);
    if (!parsed) {
      return {
        success: false,
        error: "No valid code block found in markdown",
        executionTime: 0,
      };
    }
    return this.executeCode(parsed);
  }

  public extractDescription(markdown: string): string {
    const parsed = this.parseMarkdownCodeBlock(markdown);
    return parsed?.description || "No description";
  }

  public async executeWithRetry(
    markdown: string,
    maxRetries: number = 2,
  ): Promise<CodeExecutionResult> {
    let result = await this.executeMarkdown(markdown);

    for (let attempt = 1; attempt <= maxRetries && !result.success; attempt++) {
      maLogger.warn(`Retrying execution (attempt ${attempt}/${maxRetries})...`);
      result = await this.executeMarkdown(markdown);
    }

    return result;
  }
}

export const llmCodeExecutor = LLMCodeExecutor.getInstance();

export async function executeLLMResponse(
  response: string,
): Promise<CodeExecutionResult> {
  return llmCodeExecutor.executeMarkdown(response);
}

export async function executeLLMCode(
  code: string,
  description?: string,
): Promise<CodeExecutionResult> {
  const parsed: ParsedCodeBlock = {
    code,
    description: description || "No description",
    isAsync: code.includes("async"),
    language: "javascript",
  };
  return llmCodeExecutor.executeCode(parsed);
}
