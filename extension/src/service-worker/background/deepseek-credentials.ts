import {
  loadAIConfig,
  saveAIConfig,
  type AIModelConfig,
} from "../chrome-api";

const DEEPSEEK_CHAT_URL = "https://chat.deepseek.com/";
const DEEPSEEK_COOKIE_DOMAIN = "chat.deepseek.com";
const CREDENTIAL_TIMEOUT_MS = 5 * 60 * 1000;
const CREDENTIAL_POLL_INTERVAL_MS = 1000;

let initializationPromise: Promise<AIModelConfig> | null = null;

const hasCredentials = (config: AIModelConfig): boolean =>
  !!config.deepseekAuthToken.trim() && !!config.deepseekCookies.trim();

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const updateCredentialConfig = async (
  values: Partial<AIModelConfig>,
): Promise<AIModelConfig> => {
  const current = await loadAIConfig();
  return saveAIConfig({ ...current, ...values });
};

const createLoginTab = (): Promise<number> =>
  new Promise((resolve, reject) => {
    chrome.tabs.create({ url: DEEPSEEK_CHAT_URL, active: true }, (tab) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      if (typeof tab.id !== "number") {
        reject(new Error("无法创建 DeepSeek 登录标签页"));
        return;
      }

      resolve(tab.id);
    });
  });

const getTab = (tabId: number): Promise<chrome.tabs.Tab> =>
  new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error("DeepSeek 登录标签页已关闭"));
        return;
      }

      resolve(tab);
    });
  });

const closeTab = (tabId: number): Promise<void> =>
  new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });

const readPageAuthToken = async (tabId: number): Promise<string> => {
  const [injectionResult] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (): string => {
      const rawToken = localStorage.getItem("userToken");
      if (!rawToken) {
        return "";
      }

      try {
        const parsed = JSON.parse(rawToken) as unknown;
        if (typeof parsed === "string") {
          return parsed.trim();
        }

        if (parsed && typeof parsed === "object") {
          const value = (parsed as { value?: unknown }).value;
          return typeof value === "string" ? value.trim() : "";
        }
      } catch {
        return rawToken.trim();
      }

      return "";
    },
  });

  const token = typeof injectionResult?.result === "string"
    ? injectionResult.result.trim()
    : "";
  if (!token) {
    return "";
  }

  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
};

const getDeepSeekCookies = (): Promise<chrome.cookies.Cookie[]> =>
  new Promise((resolve, reject) => {
    chrome.cookies.getAll({ domain: DEEPSEEK_COOKIE_DOMAIN }, (cookies) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(cookies);
    });
  });

const serializeCookies = (cookies: chrome.cookies.Cookie[]): string =>
  cookies.map(({ name, value }) => `${name}=${value}`).join("; ");

const waitForCredentials = async (tabId: number): Promise<{
  authToken: string;
  cookies: string;
}> => {
  const deadline = Date.now() + CREDENTIAL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const tab = await getTab(tabId);
    const isDeepSeekChat = (() => {
      try {
        return new URL(tab.url || "").hostname === DEEPSEEK_COOKIE_DOMAIN;
      } catch {
        return false;
      }
    })();

    if (isDeepSeekChat && tab.status === "complete") {
      try {
        const authToken = await readPageAuthToken(tabId);
        if (authToken) {
          const cookies = serializeCookies(await getDeepSeekCookies());
          if (cookies) {
            return { authToken, cookies };
          }
        }
      } catch {
        // 登录和页面跳转期间脚本上下文可能暂时不可用，继续等待。
      }
    }

    await wait(CREDENTIAL_POLL_INTERVAL_MS);
  }

  throw new Error("等待 DeepSeek 登录超时（5 分钟）");
};

const initializeDeepSeekCredentials = async (): Promise<AIModelConfig> => {
  await updateCredentialConfig({
    deepseekCredentialStatus: "pending",
    deepseekCredentialError: undefined,
  });

  let tabId: number | null = null;
  try {
    tabId = await createLoginTab();
    const { authToken, cookies } = await waitForCredentials(tabId);

    return await updateCredentialConfig({
      deepseekAuthToken: authToken,
      deepseekCookies: cookies,
      deepseekCredentialStatus: "ready",
      deepseekCredentialSource: "captured",
      deepseekCredentialUpdatedAt: Date.now(),
      deepseekCredentialError: undefined,
    });
  } catch (error) {
    await updateCredentialConfig({
      deepseekCredentialStatus: "error",
      deepseekCredentialError: toErrorMessage(error),
    });
    throw error;
  } finally {
    if (tabId !== null) {
      await closeTab(tabId);
    }
  }
};

export const ensureDeepSeekCredentials = async (): Promise<AIModelConfig> => {
  const config = await loadAIConfig();
  if (hasCredentials(config)) {
    return config;
  }

  if (!initializationPromise) {
    initializationPromise = initializeDeepSeekCredentials().finally(() => {
      initializationPromise = null;
    });
  }

  return initializationPromise;
};
