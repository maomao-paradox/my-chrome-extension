export interface LoggerOptions {
  title?: string;
  enabled?: boolean;
  console?: Console;
}

export type LoggerMethod = (...args: any[]) => Logger;
export type LoggerAssertMethod = (
  condition?: boolean,
  ...args: any[]
) => Logger;

export interface Logger {
  title: string;
  enabled: boolean;
  setTitle: (title: string) => Logger;
  setEnabled: (enabled: boolean) => Logger;
  debug: LoggerMethod;
  error: LoggerMethod;
  info: LoggerMethod;
  log: LoggerMethod;
  trace: LoggerMethod;
  warn: LoggerMethod;
  table: LoggerMethod;
  group: LoggerMethod;
  groupCollapsed: LoggerMethod;
  groupEnd: LoggerMethod;
  time: LoggerMethod;
  timeEnd: LoggerMethod;
  assert: LoggerAssertMethod;
}

const DEFAULT_LOGGER_TITLE = "MRIA";
const LOGGER_STORAGE_KEY = "extensionSettings";
let isStorageListenerInstalled = false;

const prefixArgs = (title: string, args: any[]): any[] => {
  if (args.length === 0) {
    return [`[${title}]`];
  }

  const [firstArg, ...restArgs] = args;
  if (typeof firstArg === "string") {
    return [`[${title}] ${firstArg}`, ...restArgs];
  }

  return [`[${title}]`, firstArg, ...restArgs];
};

const createMethod = (
  baseConsole: Console,
  methodName: keyof Console,
  getTitle: () => string,
  getEnabled: () => boolean,
  getLogger: () => Logger,
  options: { prefixed?: boolean } = { prefixed: true },
): LoggerMethod => {
  return (...args: any[]): Logger => {
    if (!getEnabled()) {
      return getLogger();
    }

    const consoleMethod = baseConsole[methodName] as
      | ((...args: any[]) => void)
      | undefined;
    if (typeof consoleMethod !== "function") {
      return getLogger();
    }

    Reflect.apply(
      consoleMethod,
      baseConsole,
      options.prefixed === false ? args : prefixArgs(getTitle(), args),
    );
    return getLogger();
  };
};

const readDebugMode = async (): Promise<boolean> => {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return false;
    }

    const snapshot = (await chrome.storage.local.get([
      LOGGER_STORAGE_KEY,
      "debugMode",
    ])) as Record<string, any>;
    const extensionSettings = (snapshot[LOGGER_STORAGE_KEY] || {}) as Record<
      string,
      any
    >;
    return extensionSettings.debugMode === true || snapshot.debugMode === true;
  } catch (error) {
    globalThis.console?.warn?.("[Zero] 读取日志配置失败:", error);
    return false;
  }
};

export const createLogger = (options: LoggerOptions = {}): Logger => {
  const baseConsole = options.console || globalThis.console;
  let title = options.title || DEFAULT_LOGGER_TITLE;
  let enabled = options.enabled === true;

  const logger: Logger = {
    get title() {
      return title;
    },
    get enabled() {
      return enabled;
    },
    setTitle: (nextTitle: string) => {
      title = nextTitle || DEFAULT_LOGGER_TITLE;
      return logger;
    },
    setEnabled: (nextEnabled: boolean) => {
      enabled = nextEnabled;
      return logger;
    },
    debug: createMethod(
      baseConsole,
      "debug",
      () => title,
      () => enabled,
      () => logger,
    ),
    error: createMethod(
      baseConsole,
      "error",
      () => title,
      () => enabled,
      () => logger,
    ),
    info: createMethod(
      baseConsole,
      "info",
      () => title,
      () => enabled,
      () => logger,
    ),
    log: createMethod(
      baseConsole,
      "log",
      () => title,
      () => enabled,
      () => logger,
    ),
    trace: createMethod(
      baseConsole,
      "trace",
      () => title,
      () => enabled,
      () => logger,
    ),
    warn: createMethod(
      baseConsole,
      "warn",
      () => title,
      () => enabled,
      () => logger,
    ),
    table: createMethod(
      baseConsole,
      "table",
      () => title,
      () => enabled,
      () => logger,
      { prefixed: false },
    ),
    group: createMethod(
      baseConsole,
      "group",
      () => title,
      () => enabled,
      () => logger,
    ),
    groupCollapsed: createMethod(
      baseConsole,
      "groupCollapsed",
      () => title,
      () => enabled,
      () => logger,
    ),
    groupEnd: (...args: any[]): Logger => {
      if (!enabled || typeof baseConsole.groupEnd !== "function") {
        return logger;
      }
      Reflect.apply(baseConsole.groupEnd, baseConsole, args);
      return logger;
    },
    time: createMethod(
      baseConsole,
      "time",
      () => title,
      () => enabled,
      () => logger,
      { prefixed: false },
    ),
    timeEnd: createMethod(
      baseConsole,
      "timeEnd",
      () => title,
      () => enabled,
      () => logger,
      { prefixed: false },
    ),
    assert: (condition?: boolean, ...args: any[]): Logger => {
      if (!enabled || condition) {
        return logger;
      }

      if (typeof baseConsole.assert === "function") {
        baseConsole.assert(condition, ...prefixArgs(title, args));
      }
      return logger;
    },
  };

  return logger;
};

const installStorageListener = (): void => {
  if (isStorageListenerInstalled) {
    return;
  }

  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (!changes[LOGGER_STORAGE_KEY] && !changes.debugMode) {
      return;
    }

    const extensionSettings = (changes[LOGGER_STORAGE_KEY]?.newValue ||
      {}) as Record<string, any>;
    const hasExtensionDebugMode = Object.prototype.hasOwnProperty.call(
      extensionSettings,
      "debugMode",
    );
    if (!hasExtensionDebugMode && !changes.debugMode) {
      return;
    }

    const nextDebugMode = hasExtensionDebugMode
      ? extensionSettings.debugMode === true
      : changes.debugMode?.newValue === true;
    installGlobalLogger().setEnabled(nextDebugMode);
  });
  isStorageListenerInstalled = true;
};

export const installGlobalLogger = (options: LoggerOptions = {}): Logger => {
  const existingLogger = globalThis.maLogger;
  if (existingLogger) {
    if (options.title) {
      existingLogger.setTitle(options.title);
    }
    if (typeof options.enabled === "boolean") {
      existingLogger.setEnabled(options.enabled);
    }
    installStorageListener();
    return existingLogger;
  }

  const logger = createLogger(options);
  Object.defineProperty(globalThis, "maLogger", {
    value: logger,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  installStorageListener();
  return logger;
};

export const syncGlobalLoggerFromStorage = async (): Promise<Logger> => {
  const logger = installGlobalLogger();
  logger.setEnabled(await readDebugMode());
  return logger;
};

installGlobalLogger();
