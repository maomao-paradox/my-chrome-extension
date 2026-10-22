/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

if (!window.__WEB_MCP_CONTENT_SCRIPT__) {
window.__WEB_MCP_CONTENT_SCRIPT__ = true;
console.debug(`[WebMCP] Content script injected in ${window.location.href}`);

chrome.runtime.onMessage.addListener((message, _, reply) => {
  const { action, name, inputArgs, fromOrigins } = message ?? {};
  if (action === 'LIST_TOOLS') {
    if (!document.modelContext) {
      reply({ success: false, error: '当前页面未启用 WebMCP。' });
      return false;
    }
    debouncedListTools(fromOrigins);
    if (window === window.top) {
      document.modelContext.ontoolchange = debouncedListTools.bind(null, fromOrigins);
    }
    reply({ success: true });
    return false;
  }
  if (action === 'EXECUTE_TOOL') {
    if (!document.modelContext) {
      reply({ success: false, error: '当前页面未启用 WebMCP。' });
      return false;
    }
    executeTool(name, inputArgs)
      .then((result) => reply({ success: true, result }))
      .catch((error) => reply({ success: false, error: error.message || String(error) }));
    return true;
  }
  if (action === 'GET_CROSS_DOCUMENT_SCRIPT_TOOL_RESULT') {
    reply(document.querySelector('script[type="application/ld+json"]')?.textContent);
  }
  return false;
});

window.addEventListener('message', (event) => {
  if (
    window === window.top ||
    event.data?.action !== 'GET_FRAME_ID'
  ) {
    return;
  }
  chrome.runtime.sendMessage({ action: 'WEB_MCP_GET_FRAME_ID' }).then(({ frameId }) => {
    event.source?.postMessage(
      { action: 'GET_FRAME_ID_RESPONSE', frameId },
      event.origin === 'null' ? '*' : event.origin,
    );
  }).catch((error) => {
    console.warn('[WebMCP] Failed to get frame ID:', error);
  });
});

async function executeTool(name, inputArgs) {
  console.debug(`[WebMCP] Execute tool "${name}" in ${window.location.href}`);
  let targetFrame;
  let loadPromise;
  const formTarget = document.querySelector(`form[toolname="${name}"]`)?.target;
  if (formTarget) {
    targetFrame = document.querySelector(`[name="${CSS.escape(formTarget)}"]`);
  }
  if (targetFrame) {
    loadPromise = new Promise((resolve) => {
      targetFrame.addEventListener('load', resolve, { once: true });
    });
  }

  const tools = await document.modelContext.getTools();
  const tool = tools.find((item) => item.name === name && item.window === window);
  if (!tool) {
    throw new Error(`找不到工具 "${name}"。`);
  }

  let result;
  const args = typeof inputArgs === 'string' ? JSON.parse(inputArgs) : inputArgs;
  try {
    result = await document.modelContext.executeTool(tool, args);
  } catch (error) {
    if (error.message?.startsWith('Failed to parse input')) {
      result = await document.modelContext.executeTool(tool, JSON.stringify(args));
    } else {
      throw error;
    }
  }

  if (result === null && targetFrame) {
    await loadPromise;
    result = targetFrame.contentWindow.document.querySelector(
      'script[type="application/ld+json"]',
    )?.textContent;
  }
  return result;
}

let timeout;
function debouncedListTools(fromOrigins) {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    listTools(fromOrigins).catch((error) => {
      chrome.runtime.sendMessage({
        type: 'TOOLS_UPDATED',
        tools: [],
        url: window.location.href,
        error: error instanceof Error ? error.message : String(error),
      }).catch((sendError) => {
        console.warn('[WebMCP] Failed to report tool discovery error:', sendError);
      });
    });
  }, 100);
}

async function listTools(fromOrigins) {
  let tools = [];
  for (const tool of await document.modelContext.getTools({ fromOrigins })) {
    if (!tool || typeof tool.name !== 'string' || !tool.name) {
      console.warn('[WebMCP] Skipping a tool without a valid name.');
      continue;
    }
    const frameId = tool.window == window ? 0 : await getFrameId(tool.window);
    if (frameId === null) {
      console.warn(`[WebMCP] Unable to resolve frame for tool "${tool.name}".`);
      continue;
    }
    const inputSchema = typeof tool.inputSchema === 'string'
      ? tool.inputSchema
      : JSON.stringify(tool.inputSchema ?? { type: 'object', properties: {} });
    tools.push({
      description: tool.description || '',
      inputSchema,
      annotations: Object.keys(tool.annotations || {})
        .filter((k) => tool.annotations[k])
        .join(', '),
      name: tool.name,
      frameId,
    });
  }
  console.debug(`[WebMCP] Got ${tools.length} tools`, tools);
  chrome.runtime.sendMessage({
    type: 'TOOLS_UPDATED',
    tools,
    url: window.location.href,
  }).catch((error) => console.warn('[WebMCP] Failed to publish tools:', error));
}

async function getFrameId(targetWindow) {
  const promise = new Promise((resolve) => {
    let timeoutId;
    const listener = ({ source, data }) => {
      if (source === targetWindow && data.action === 'GET_FRAME_ID_RESPONSE') {
        window.removeEventListener('message', listener);
        clearTimeout(timeoutId);
        resolve(Number.isInteger(data.frameId) ? data.frameId : null);
      }
    };
    window.addEventListener('message', listener);
    timeoutId = setTimeout(() => {
      window.removeEventListener('message', listener);
      resolve(null);
    }, 2000);
  });
  targetWindow.postMessage({ action: 'GET_FRAME_ID' }, '*');
  return promise;
}

// TODO: Remove when window.ontoolactivated and window.ontoolcancel are removed in Chrome Stable.
const targetFor = (type, listener, options) => {
  // TODO: Remove about:blank check when https://issues.chromium.org/536794096 is fixed.
  if (location.href === 'about:blank') return;
  (`on${type}` in (document.modelContext ?? {}) ? document.modelContext : window)
    .addEventListener(type, listener, options);
};

targetFor('toolactivated', ({ toolName }) => {
  console.debug(`[WebMCP] Tool "${toolName}" started execution.`);
});

targetFor('toolcancel', ({ toolName }) => {
  console.debug(`[WebMCP] Tool "${toolName}" execution is cancelled.`);
});

if (window === window.top) {
  chrome.runtime.sendMessage({ type: 'contentScriptReady' }).catch(() => {});
}
}
