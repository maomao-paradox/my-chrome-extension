/**
 * @file src/pages/sidepanel/views/BrowserVarInspector.tsx
 * @description React 版页面变量查看与修改工具。
 */
import { useMemo, useState } from 'react';
import messenger from '@/message';
import './browser-var-inspector.scss';

const formatJsonForDisplay = (data: unknown): string => {
  try {
    return JSON.stringify(data, null, 2)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"([^"\\]*(\\.[^"\\]*)*)":/g, '<span class="json-key">"$1":</span>')
      .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="json-string">"$1"</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="json-boolean">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
  } catch {
    return String(data);
  }
};

const getValueType = (value: unknown) => {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'Array';
  }
  return typeof value === 'object' ? 'Object' : typeof value;
};

const evaluateVariablePath = (path: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    if (!path.trim()) {
      reject(new Error('变量路径不能为空'));
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        reject(new Error('无法找到当前活动标签页'));
        return;
      }

      chrome.tabs.sendMessage(tabId, {
        action: 'GET_PAGE_VARIABLE',
        data: { varPath: path },
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`无法连接到页面: ${chrome.runtime.lastError.message}`));
          return;
        }
        if (response?.success) {
          resolve(response.data);
          return;
        }
        reject(new Error(response?.msg || '获取变量失败'));
      });
    });
  });
};

const setPageVariable = (path: string, value: unknown): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!path.trim()) {
      reject(new Error('变量路径不能为空'));
      return;
    }

    messenger.ext.send({
      action: 'SET_PAGE_VARIABLE',
      payload: { path, value },
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`无法连接到页面: ${chrome.runtime.lastError.message}`));
        return;
      }
      if (response?.success) {
        resolve();
        return;
      }
      reject(new Error(response?.msg || '设置变量失败'));
    });
  });
};

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  chrome.runtime.sendMessage({
    action: 'SHOW_TOAST',
    text: message,
    type,
  });
};

const BrowserVarInspector = () => {
  const [variablePath, setVariablePath] = useState('');
  const [variableData, setVariableData] = useState<unknown>(null);
  const [variableString, setVariableString] = useState('');
  const [isJson, setIsJson] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const variableType = useMemo(() => (variableData === null ? '' : getValueType(variableData)), [variableData]);
  const formattedJson = useMemo(() => (isJson && variableData !== null ? formatJsonForDisplay(variableData) : ''), [isJson, variableData]);

  const syncLoadedValue = (data: unknown) => {
    setVariableData(data);
    try {
      setVariableString(JSON.stringify(data, null, 2));
      setIsJson(true);
    } catch {
      setVariableString(String(data));
      setIsJson(false);
    }
  };

  const getVariable = async () => {
    if (!variablePath.trim()) {
      setError('请输入变量路径');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      syncLoadedValue(await evaluateVariablePath(variablePath));
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取变量失败');
    } finally {
      setIsLoading(false);
    }
  };

  const updateVariableFromText = async () => {
    if (!variablePath.trim()) {
      setError('请输入变量路径');
      return;
    }

    let nextValue: unknown = variableString;
    try {
      nextValue = JSON.parse(variableString);
      setIsJson(true);
    } catch {
      setIsJson(false);
    }

    setVariableData(nextValue);
    setIsLoading(true);
    setError('');

    try {
      await setPageVariable(variablePath, nextValue);
      showToast('变量更新成功', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新变量失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePathChange = (value: string) => {
    setVariablePath(value);
    if (!value.trim()) {
      setVariableData(null);
      setVariableString('');
      setIsJson(false);
      setError('');
    }
  };

  return (
    <div className="browser-var-inspector">
      <div className="browser-var-inspector__header">
        <h2>JS调试工具</h2>
        <p>实时查看和修改页面中的 JS 变量</p>
      </div>

      <label className="browser-var-inspector__field" htmlFor="variablePath">
        <span>变量路径</span>
        <div className="browser-var-inspector__input-group">
          <input
            id="variablePath"
            value={variablePath}
            type="text"
            placeholder="例如: window.document.title 或 appState.user"
            onChange={(event) => handlePathChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void getVariable();
              }
            }}
          />
          <button type="button" onClick={() => void getVariable()}>获取变量</button>
        </div>
      </label>

      {isLoading ? (
        <div className="browser-var-inspector__loading">
          <span className="browser-var-inspector__spinner" />
          <span>正在处理变量...</span>
        </div>
      ) : error ? (
        <div className="browser-var-inspector__error">
          <strong>!</strong>
          <span>{error}</span>
          <button type="button" onClick={() => void getVariable()}>重试</button>
        </div>
      ) : variableData !== null ? (
        <section className="browser-var-inspector__result">
          <header>
            <span>{variableType}</span>
            <button type="button" onClick={() => void getVariable()}>刷新</button>
          </header>

          <div className="browser-var-inspector__editor">
            <textarea
              value={variableString}
              placeholder="在这里编辑变量值..."
              onChange={(event) => setVariableString(event.target.value)}
              onBlur={() => void updateVariableFromText()}
            />
            <button type="button" onClick={() => void updateVariableFromText()}>更新变量</button>
          </div>

          <div className="browser-var-inspector__formatted">
            {isJson ? (
              <div className="json-tree" dangerouslySetInnerHTML={{ __html: formattedJson }} />
            ) : (
              <pre>{variableString}</pre>
            )}
          </div>
        </section>
      ) : (
        <div className="browser-var-inspector__empty">请输入变量路径并点击“获取变量”按钮</div>
      )}
    </div>
  );
};

export default BrowserVarInspector;
