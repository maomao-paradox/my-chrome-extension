function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    let timeoutId;
    const done = () => {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') done();
    };
    timeoutId = setTimeout(done, 5000);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') done();
    }).catch(done);
  });
}

export async function executeTool(tabId, name, inputArgs, frameId) {
  let toolsReady;
  const toolsPromise = new Promise((resolve) => { toolsReady = resolve; });

  let targetTabId = tabId;
  let contentScriptReadyResolve;
  const contentScriptReadyPromise = new Promise((r) => { contentScriptReadyResolve = r; });

  const listener = (msg, sender) => {
    if (msg.type === 'contentScriptReady' && sender.tab) {
      if (sender.tab.id === tabId || sender.tab.openerTabId === tabId) {
        targetTabId = sender.tab.id;
        contentScriptReadyResolve();
      }
    }
    if (msg.tools && sender.tab?.id === targetTabId) {
      toolsReady();
    }
  };
  chrome.runtime.onMessage.addListener(listener);

  try {
    try {
      const result = await chrome.tabs.sendMessage(
        tabId,
        { action: 'EXECUTE_TOOL', name, inputArgs },
        { frameId },
      );
      if (result !== null) return result;
    } catch (error) {
      if (!/message channel (is )?closed/.test(error.message)) throw error;
    }

    await Promise.race([
      contentScriptReadyPromise,
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    await Promise.race([
      toolsPromise,
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    await waitForPageLoad(targetTabId);

    return await chrome.tabs.sendMessage(
      targetTabId,
      { action: 'GET_CROSS_DOCUMENT_SCRIPT_TOOL_RESULT' },
      { frameId: targetTabId === tabId ? frameId : 0 },
    );
  } finally {
    chrome.runtime.onMessage.removeListener(listener);
  }
}