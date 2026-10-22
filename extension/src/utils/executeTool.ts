const waitForPageLoad = (tabId: number): Promise<void> =>
  new Promise<void>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const done = (): void => {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ): void => {
      if (updatedTabId === tabId && changeInfo.status === "complete") done();
    };
    timeoutId = setTimeout(done, 5000);
    chrome.tabs.onUpdated.addListener(listener);
    void chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === "complete") done();
      })
      .catch(() => done());
  });

export async function executeTool(
  tabId: number,
  name: string,
  inputArgs: string,
  frameId: number,
): Promise<unknown> {
  let targetTabId = tabId;
  let resolveToolsReady!: () => void;
  let resolveContentScriptReady!: () => void;
  const toolsReady = new Promise<void>((resolve) => {
    resolveToolsReady = resolve;
  });
  const contentScriptReady = new Promise<void>((resolve) => {
    resolveContentScriptReady = resolve;
  });

  const listener = (
    rawMessage: unknown,
    sender: chrome.runtime.MessageSender,
  ): void => {
    if (!rawMessage || typeof rawMessage !== "object") return;
    const message = rawMessage as {
      type?: string;
      tools?: unknown[];
    };
    if (
      message.type === "contentScriptReady" &&
      sender.tab &&
      (sender.tab.id === tabId || sender.tab.openerTabId === tabId)
    ) {
      targetTabId = sender.tab.id ?? tabId;
      resolveContentScriptReady();
    }
    if (
      message.type === "TOOLS_UPDATED" &&
      sender.tab?.id === targetTabId &&
      Array.isArray(message.tools)
    ) {
      resolveToolsReady();
    }
  };
  chrome.runtime.onMessage.addListener(listener);

  try {
    try {
      const response: unknown = await chrome.tabs.sendMessage(
        tabId,
        { action: "EXECUTE_TOOL", name, inputArgs, frameId },
        { frameId },
      );
      if (response && typeof response === "object" && "success" in response) {
        const result = response as {
          success: boolean;
          result?: unknown;
          error?: string;
        };
        if (!result.success) {
          throw new Error(result.error || `工具 "${name}" 执行失败。`);
        }
        return result.result;
      }
      if (response !== null) return response;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/message channel (is )?closed/i.test(error.message)
      ) {
        throw error;
      }
    }

    await Promise.race([
      contentScriptReady,
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
    await Promise.race([
      toolsReady,
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
    await waitForPageLoad(targetTabId);

    return await chrome.tabs.sendMessage(
      targetTabId,
      { action: "GET_CROSS_DOCUMENT_SCRIPT_TOOL_RESULT" },
      { frameId: targetTabId === tabId ? frameId : 0 },
    );
  } finally {
    chrome.runtime.onMessage.removeListener(listener);
  }
}
