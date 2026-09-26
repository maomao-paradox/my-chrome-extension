import { FileMapDecryptor } from "@/utils";
import {
  createTabAndWaitForLoad,
  type TabWaitUntil,
} from "./chrome-tabs";

export type ExtensionScriptWorld = "ISOLATED" | "MAIN";

export interface CreateTabWithScriptPayload {
  url?: string;
  scriptPath?: string;
  scriptSrc?: string;
  path?: string;
  data?: {
    url?: string;
    scriptPath?: string;
    scriptSrc?: string;
    path?: string;
  };
  active?: boolean;
  allFrames?: boolean;
  world?: ExtensionScriptWorld;
  timeoutMs?: number;
  waitUntil?: TabWaitUntil;
}

interface NormalizedCreateTabWithScriptPayload {
  url: string;
  scriptPath: string;
  active: boolean;
  allFrames: boolean;
  world: ExtensionScriptWorld;
  timeoutMs: number;
  waitUntil: TabWaitUntil;
}

export interface InjectExtensionScriptOptions {
  allFrames?: boolean;
  world?: ExtensionScriptWorld;
  injectImmediately?: boolean;
}

const DEFAULT_CREATE_TAB_TIMEOUT_MS = 30000;

let fileMap: Map<string, string> | null = null;
let fileMapLoadPromise: Promise<Map<string, string>> | null = null;

const viteEnv = (
  import.meta as ImportMeta & { env?: Record<string, string | undefined> }
).env;
const FILE_MAP_KEY =
  viteEnv?.VITE_FILE_MAP_KEY ||
  "mria_extension_default_key_32bytes_1234567890abcdef";
const backgroundFileMapDecryptor = new FileMapDecryptor(FILE_MAP_KEY);

export const getFileMap = (): Map<string, string> | null => fileMap;

const normalizeExtensionPath = (path: string): string => {
  return path
    .replace(/^chrome-extension:\/\/[^/]+\//, "")
    .replace(/^\//, "")
    .replace(/^dist\//, "");
};

const stripScriptExtension = (path: string): string =>
  path.replace(/\.(?:m?js|ts)$/, "");

const createScriptPathCandidates = (scriptPath: string): string[] => {
  const normalizedPath = normalizeExtensionPath(scriptPath.trim());
  const withoutExtension = stripScriptExtension(normalizedPath);
  const withoutSourcePrefix = stripScriptExtension(
    normalizedPath.replace(/^src\//, ""),
  );
  const candidates = [
    normalizedPath,
    withoutExtension,
    withoutSourcePrefix,
    withoutSourcePrefix.startsWith("js/")
      ? withoutSourcePrefix
      : `js/${withoutSourcePrefix}`,
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
};

const ensureBackgroundFileMap = async (): Promise<Map<string, string>> => {
  if (fileMap) {
    return fileMap;
  }

  if (!fileMapLoadPromise) {
    fileMapLoadPromise = backgroundFileMapDecryptor
      .decryptAndLoad(chrome.runtime.getURL("file-map.json"))
      .then((map) => {
        fileMap = new Map(Object.entries(map));
        console.log("background 懒加载 file_map 成功，条目数:", fileMap.size);
        return fileMap;
      })
      .finally(() => {
        fileMapLoadPromise = null;
      });
  }

  return fileMapLoadPromise;
};

export const resolveExtensionScriptPath = async (
  scriptPath: string,
): Promise<string> => {
  const candidates = createScriptPathCandidates(scriptPath);

  try {
    const map = await ensureBackgroundFileMap();
    for (const candidate of candidates) {
      const mappedPath = map.get(candidate);
      if (mappedPath) {
        return mappedPath;
      }
    }
  } catch (error) {
    console.warn("解析 file_map 失败，尝试直接使用脚本路径:", error);
  }

  return candidates[0];
};

export async function injectExtensionScript(
  tabId: number,
  scriptPath: string,
  options: InjectExtensionScriptOptions = {},
): Promise<{
  resolvedScriptPath: string;
  results: chrome.scripting.InjectionResult[];
}> {
  const resolvedScriptPath = await resolveExtensionScriptPath(scriptPath);
  const results = await chrome.scripting.executeScript({
    target: {
      tabId,
      allFrames: options.allFrames ?? false,
    },
    files: [resolvedScriptPath],
    world: options.world ?? "ISOLATED",
    injectImmediately: options.injectImmediately ?? true,
  });

  return { resolvedScriptPath, results };
}

const isSupportedScriptWorld = (
  world: unknown,
): world is ExtensionScriptWorld => {
  return world === "ISOLATED" || world === "MAIN";
};

const isSupportedWaitUntil = (
  waitUntil: unknown,
): waitUntil is TabWaitUntil => {
  return waitUntil === "loading" || waitUntil === "complete";
};

const normalizeCreateTabWithScriptPayload = (
  payload: CreateTabWithScriptPayload | undefined,
): NormalizedCreateTabWithScriptPayload => {
  const data = payload?.data || {};
  const url =
    typeof payload?.url === "string"
      ? payload.url.trim()
      : (data.url || "").trim();
  const scriptPath =
    typeof payload?.scriptPath === "string"
      ? payload.scriptPath.trim()
      : typeof payload?.scriptSrc === "string"
        ? payload.scriptSrc.trim()
        : typeof payload?.path === "string"
          ? payload.path.trim()
          : typeof data.scriptPath === "string"
            ? data.scriptPath.trim()
            : typeof data.scriptSrc === "string"
              ? data.scriptSrc.trim()
              : typeof data.path === "string"
                ? data.path.trim()
                : "";

  if (!url) {
    throw new Error("缺少 url 参数");
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error("url 仅支持 http 或 https 页面");
  }

  if (!scriptPath) {
    throw new Error("缺少 scriptPath 参数");
  }

  const timeoutMs =
    typeof payload?.timeoutMs === "number" && payload.timeoutMs > 0
      ? payload.timeoutMs
      : DEFAULT_CREATE_TAB_TIMEOUT_MS;

  return {
    url,
    scriptPath,
    active: payload?.active ?? true,
    allFrames: payload?.allFrames ?? false,
    world: isSupportedScriptWorld(payload?.world) ? payload.world : "ISOLATED",
    timeoutMs,
    waitUntil: isSupportedWaitUntil(payload?.waitUntil)
      ? payload.waitUntil
      : "loading",
  };
};

export const createTabWithScript = async (
  payload: CreateTabWithScriptPayload | undefined,
): Promise<{
  tabId: number;
  scriptPath: string;
  resolvedScriptPath: string;
  injectionTime: number;
  results: chrome.scripting.InjectionResult[];
}> => {
  const options = normalizeCreateTabWithScriptPayload(payload);
  const tabId = await createTabAndWaitForLoad(options.url, {
    active: options.active,
    timeoutMs: options.timeoutMs,
    waitUntil: options.waitUntil,
  });
  const injectionStart = Date.now();
  const { resolvedScriptPath, results } = await injectExtensionScript(
    tabId,
    options.scriptPath,
    {
      allFrames: options.allFrames,
      world: options.world,
      injectImmediately: true,
    },
  );

  return {
    tabId,
    scriptPath: options.scriptPath,
    resolvedScriptPath,
    injectionTime: Date.now() - injectionStart,
    results,
  };
};
