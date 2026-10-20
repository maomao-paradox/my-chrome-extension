import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllFrameOrigins } from '@/utils';

export function useTools() {
  const [tools, setTools] = useState([]);
  const [status, setStatus] = useState(null);
  const toolsRef = useRef([]);

  const refresh = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const fromOrigins = await getAllFrameOrigins(tab.id);
      await chrome.tabs.sendMessage(tab.id, { action: 'LIST_TOOLS', fromOrigins }, { frameId: 0 });
    } catch (error) {
      setStatus(String(error));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const listener = ({ message, tools: incoming, url, type, tabId }, sender) => {
      if (type) return;
      if (sender.frameId && sender.frameId !== 0) return;
      if (!message && !incoming) return;

      (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (sender.tab && sender.tab.id !== tab.id) return;
        if (tabId && tabId !== tab.id) return;

        setStatus(message || null);
        const haveNewTools =
          JSON.stringify(toolsRef.current) !== JSON.stringify(incoming);
        toolsRef.current = incoming;
        setTools(incoming);
        if (haveNewTools) {
          // 供 Live / prompt 建议等订阅者感知
          window.dispatchEvent(
            new CustomEvent('webmcp:tools-changed', { detail: incoming })
          );
        }
      })();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return { tools, status, refresh };
}