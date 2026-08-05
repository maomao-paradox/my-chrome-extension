/**
 * @description AI 助手主业务逻辑 Hook
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ActiveTab,
  ChatHistoryItem,
  NotificationItem,
  NotificationType,
  AIModelConfig,
  AIModelPreset,
  AIModelSettingsForm,
  ExecutionSettings,
  ProviderSelectValue,
  StreamAIConversationOptions,
} from '../types';
import {
  STORAGE_KEYS,
  STANDARD_PROVIDERS,
  DEFAULT_BUILTIN_MODEL_ID,
} from '../types';
import { loadAIConfigSync, saveAIConfig } from '@/utils/ai-config';

interface UseAIAssistantReturn {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  notifications: NotificationItem[];
  instructionInput: string;
  setInstructionInput: (input: string) => void;
  executionResult: string;
  executionError: string;
  executionLoading: boolean;
  generatedCode: string;
  codeInput: string;
  setCodeInput: (code: string) => void;
  codeExecutionResult: string;
  codeExecutionLoading: boolean;
  codeLoadingText: string;
  chatHistory: ChatHistoryItem[];
  settingsForm: AIModelSettingsForm;
  setSettingsForm: React.Dispatch<React.SetStateAction<AIModelSettingsForm>>;
  modelPresets: AIModelPreset[];
  selectedPresetId: string;
  setSelectedPresetId: (id: string) => void;
  presetName: string;
  setPresetName: (name: string) => void;
  executionSettings: ExecutionSettings;
  pushNotification: (title: string, message: string, type?: NotificationType) => void;
  handleInstructionKeydown: (event: React.KeyboardEvent) => void;
  executeNaturalLanguageCommand: () => Promise<void>;
  clearInstruction: () => void;
  saveCurrentInstruction: () => void;
  runCode: (codeOverride?: string, successMessage?: string) => Promise<void>;
  clearCodeOutput: () => void;
  explainCode: () => Promise<void>;
  clearChatHistory: () => void;
  clearDeepSeekSession: () => Promise<void>;
  exportChatHistory: () => void;
  saveSettings: () => void;
  handlePresetChange: () => void;
  saveCurrentAsModelPreset: () => void;
  deleteSelectedModelPreset: () => void;
  isCustomProviderSelected: boolean;
  isBuiltInProviderSelected: boolean;
}

/**
 * 获取默认 AI 配置
 */
const getDefaultAIConfig = (): AIModelConfig => ({
  provider: 'deepseek',
  customProvider: '',
  modelId: DEFAULT_BUILTIN_MODEL_ID,
  apiBaseUrl: '',
  apiKey: '',
});

/**
 * 获取默认执行设置
 */
const getDefaultExecutionSettings = (): ExecutionSettings => ({
  executionMode: 'auto',
  showGeneratedCode: true,
  saveHistory: true,
});

/**
 * 根据配置构建表单数据
 */
const buildFormFromConfig = (config: AIModelConfig): AIModelSettingsForm => {
  if (config.provider === 'deepseek') {
    return {
      providerSelect: 'default',
      customProvider: '',
      modelId: DEFAULT_BUILTIN_MODEL_ID,
      apiBaseUrl: '',
      apiKey: '',
    };
  }

  if (STANDARD_PROVIDERS.includes(config.provider as any)) {
    return {
      providerSelect: config.provider as Exclude<ProviderSelectValue, 'default' | 'custom'>,
      customProvider: '',
      modelId: config.modelId,
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
    };
  }

  return {
    providerSelect: 'custom',
    customProvider: config.customProvider || config.provider,
    modelId: config.modelId,
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,
  };
};

/**
 * 保存聊天历史
 */
const saveChatHistoryToStorage = (history: ChatHistoryItem[]): void => {
  localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(history));
};

/**
 * 加载聊天历史
 */
const loadChatHistoryFromStorage = (): ChatHistoryItem[] => {
  const saved = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    maLogger.error('加载历史记录失败:', error);
    return [];
  }
};

/**
 * 加载模型预设
 */
const loadModelPresetsFromStorage = (): AIModelPreset[] => {
  const saved = localStorage.getItem(STORAGE_KEYS.MODEL_PRESETS);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((preset) => preset && typeof preset === 'object')
      .map((preset: any) => ({
        id: typeof preset.id === 'string' ? preset.id : `preset-${Date.now()}`,
        name: typeof preset.name === 'string' ? preset.name : '未命名预设',
        provider: typeof preset.provider === 'string' ? preset.provider : 'deepseek',
        customProvider: typeof preset.customProvider === 'string' ? preset.customProvider : '',
        modelId: typeof preset.modelId === 'string' ? preset.modelId : DEFAULT_BUILTIN_MODEL_ID,
        apiBaseUrl: typeof preset.apiBaseUrl === 'string' ? preset.apiBaseUrl : '',
        apiKey: typeof preset.apiKey === 'string' ? preset.apiKey : '',
        createdAt: typeof preset.createdAt === 'string' ? preset.createdAt : '',
        updatedAt: typeof preset.updatedAt === 'string' ? preset.updatedAt : '',
      }));
  } catch (error) {
    maLogger.error('加载模型预设失败:', error);
    return [];
  }
};

/**
 * 保存模型预设
 */
const saveModelPresetsToStorage = (presets: AIModelPreset[]): void => {
  localStorage.setItem(STORAGE_KEYS.MODEL_PRESETS, JSON.stringify(presets));
};

/**
 * 获取激活的预设 ID
 */
const getActivePresetId = (): string => {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_PRESET) || '';
};

/**
 * 设置激活的预设 ID
 */
const setActivePresetId = (presetId: string): void => {
  if (presetId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PRESET, presetId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PRESET);
  }
};

/**
 * 生成预设 ID
 */
const createPresetId = (): string => {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * 获取当前表单配置
 */
const getCurrentFormConfig = (
  settingsForm: AIModelSettingsForm,
  notify = true
): AIModelConfig | null => {
  const { providerSelect, customProvider, modelId, apiBaseUrl, apiKey } = settingsForm;

  if (providerSelect === 'default') {
    return {
      provider: 'deepseek',
      customProvider: '',
      modelId: DEFAULT_BUILTIN_MODEL_ID,
      apiBaseUrl: '',
      apiKey: '',
    };
  }

  if (providerSelect === 'custom') {
    if (!customProvider) {
      if (notify) {
        alert('请输入自定义提供商名称');
      }
      return null;
    }

    if (!modelId) {
      if (notify) {
        alert('请输入模型ID');
      }
      return null;
    }

    if (!apiBaseUrl) {
      if (notify) {
        alert('自定义提供商需要填写 API 基础URL');
      }
      return null;
    }

    return {
      provider: customProvider,
      customProvider,
      modelId,
      apiBaseUrl,
      apiKey,
    };
  }

  if (!modelId) {
    if (notify) {
      alert('请输入模型ID');
    }
    return null;
  }

  if (!apiKey) {
    if (notify) {
      alert('当前提供商需要填写 API 密钥');
    }
    return null;
  }

  return {
    provider: providerSelect,
    customProvider: '',
    modelId,
    apiBaseUrl,
    apiKey,
  };
};

/**
 * 判断模型配置是否相同
 */
const isSameModelConfig = (left: AIModelConfig, right: AIModelConfig): boolean => {
  return (
    left.provider === right.provider &&
    left.customProvider === right.customProvider &&
    left.modelId === right.modelId &&
    left.apiBaseUrl === right.apiBaseUrl &&
    left.apiKey === right.apiKey
  );
};

/**
 * 代码安全检查
 */
const isSafeCode = (code: string): boolean => {
  const dangerousPatterns = [
    /eval\(/,
    /new\s+Function/,
    /document\.write/,
    /innerHTML\s*=/,
    /outerHTML\s*=/,
    /execScript/,
    /setTimeout\(["']/,
    /setInterval\(["']/,
    /localStorage\.clear/,
    /sessionStorage\.clear/,
    /cookies?\.clear/,
    /FileReader/,
    /XMLHttpRequest/,
    /ActiveXObject/,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(code));
};

/**
 * 格式化执行结果
 */
const formatExecutionResult = (result: unknown): string => {
  if (typeof result === 'string') return result;
  if (typeof result === 'undefined') return 'undefined';

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
};

/**
 * 在被检查的窗口中执行代码
 */
const executeInInspectedWindow = (code: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    try {
      chrome.devtools.inspectedWindow.eval(code, (result, exception) => {
        if (exception) {
          reject(new Error(exception.description || '代码执行失败'));
          return;
        }
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * 提取生成的代码
 */
const extractGeneratedCode = (aiResponse: string): string => {
  const codeMatch = aiResponse.match(
    /```javascript[\s\S]*?```|```[\s\S]*?```|\/\/ 示例代码[\s\S]*/
  );
  if (!codeMatch) return '';
  return codeMatch[0].replace(/```javascript|```|\/\/ 示例代码/g, '').trim();
};

/**
 * AI 对话流
 */
const streamAIConversation = ({
  prompt,
  role = 'devtools_assistant',
  systemPrompt = '',
  onChunk,
}: StreamAIConversationOptions): Promise<string> => {
  const config = loadAIConfigSync();
  const targetTabId =
    typeof chrome.devtools?.inspectedWindow?.tabId === 'number'
      ? chrome.devtools.inspectedWindow.tabId
      : undefined;

  return new Promise((resolve, reject) => {
    let settled = false;
    let accumulatedResponse = '';
    const messageId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const port = chrome.runtime.connect({ name: `ai-conversation-${messageId}` });

    const cleanup = () => {
      try {
        port.disconnect();
      } catch {
        // ignore
      }
    };

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      cleanup();
      handler();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error('AI响应超时')));
    }, 60000);

    port.onMessage.addListener((message) => {
      if (message.type === 'AI_CONVERSATION_STREAM_DATA') {
        const chunk = message.payload?.content || '';
        accumulatedResponse += chunk;
        onChunk?.(accumulatedResponse, chunk);
        return;
      }

      if (message.type === 'AI_CONVERSATION_COMPLETE') {
        finish(() => resolve(accumulatedResponse));
        return;
      }

      if (message.type === 'AI_CONVERSATION_ERROR') {
        finish(() => reject(new Error(message.payload?.error || 'AI调用失败')));
      }
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      const errorMessage = chrome.runtime.lastError?.message || 'AI连接已断开';
      finish(() => reject(new Error(errorMessage)));
    });

    port.postMessage({
      type: 'START_AI_CONVERSATION',
      payload: {
        prompt,
        role,
        provider: config.provider,
        model: config.modelId,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        systemPrompt,
        targetTabId,
      },
    });
  });
};

export const useAIAssistant = (): UseAIAssistantReturn => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [instructionInput, setInstructionInput] = useState('');
  const [executionResult, setExecutionResult] = useState('');
  const [executionError, setExecutionError] = useState('');
  const [executionLoading, setExecutionLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeExecutionResult, setCodeExecutionResult] = useState('');
  const [codeExecutionLoading, setCodeExecutionLoading] = useState(false);
  const [codeLoadingText, setCodeLoadingText] = useState('正在执行代码...');
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [settingsForm, setSettingsForm] = useState<AIModelSettingsForm>(
    buildFormFromConfig(getDefaultAIConfig())
  );
  const [modelPresets, setModelPresets] = useState<AIModelPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [executionSettings, setExecutionSettings] = useState<ExecutionSettings>(
    getDefaultExecutionSettings()
  );

  // refs for stable references
  const settingsFormRef = useRef(settingsForm);
  settingsFormRef.current = settingsForm;
  const executionSettingsRef = useRef(executionSettings);
  executionSettingsRef.current = executionSettings;

  // 计算属性
  const isCustomProviderSelected = settingsForm.providerSelect === 'custom';
  const isBuiltInProviderSelected = settingsForm.providerSelect === 'default';

  /** 推送通知 */
  const pushNotification = useCallback(
    (title: string, message: string, type: NotificationType = 'info'): void => {
      const notification: NotificationItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        message,
        type,
      };

      setNotifications((prev) => [...prev, notification]);
      window.setTimeout(() => {
        setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      }, 3000);
    },
    []
  );

  /** 键盘事件处理 */
  const handleInstructionKeydown = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void executeNaturalLanguageCommand();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** 清空指令 */
  const clearInstruction = useCallback((): void => {
    setInstructionInput('');
  }, []);

  /** 保存当前指令 */
  const saveCurrentInstruction = useCallback((): void => {
    const draft = instructionInput.trim();
    if (!draft) {
      pushNotification('提示', '没有可保存的指令内容', 'info');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.INSTRUCTION_DRAFT, draft);
    pushNotification('成功', '当前指令已保存为草稿', 'success');
  }, [instructionInput, pushNotification]);

  /** 执行自然语言命令 */
  const executeNaturalLanguageCommand = useCallback(async (): Promise<void> => {
    const command = instructionInput.trim();
    if (!command) {
      pushNotification('提示', '请输入指令', 'info');
      return;
    }

    if (command.length > 1000) {
      pushNotification('错误', '指令长度不能超过1000个字符', 'error');
      return;
    }

    setExecutionLoading(true);
    setExecutionError('');
    setExecutionResult('');
    setGeneratedCode('');

    try {
      const aiResponse = await streamAIConversation({
        prompt: command,
        onChunk: (content) => {
          setExecutionResult(content);
        },
      });

      setExecutionResult(aiResponse || '未能获取响应');

      if (executionSettingsRef.current.saveHistory) {
        setChatHistory((prev) => {
          const newHistory = [
            ...prev,
            { role: 'user' as const, content: command },
            { role: 'assistant' as const, content: aiResponse || '未能获取响应' },
          ];
          saveChatHistoryToStorage(newHistory);
          return newHistory;
        });
      }

      localStorage.setItem(STORAGE_KEYS.INSTRUCTION_DRAFT, instructionInput);

      const extractedCode = extractGeneratedCode(aiResponse);
      setGeneratedCode(extractedCode);

      if (extractedCode) {
        setCodeInput(extractedCode);

        if (executionSettingsRef.current.executionMode === 'auto') {
          await runCodeRef.current(null, extractedCode, '浏览器控制代码执行成功');
        } else {
          setActiveTab('code');
          pushNotification(
            '提示',
            executionSettingsRef.current.executionMode === 'preview'
              ? '已生成代码，请在代码模式中预览后执行'
              : '已生成代码，请在代码模式中手动执行',
            'info'
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败';
      setExecutionError(message);
      setExecutionResult('');
      pushNotification('错误', message, 'error');
    } finally {
      setExecutionLoading(false);
    }
  }, [instructionInput, pushNotification]);

  /** 运行代码 */
  const runCode = useCallback(
    async (_event: any, codeOverride?: string, successMessage = '代码执行成功'): Promise<void> => {
      const code = (codeOverride ?? codeInput).trim();
      if (!code) {
        pushNotification('提示', '请输入代码', 'info');
        return;
      }

      if (!isSafeCode(code)) {
        const message = '代码包含不安全的操作';
        setCodeExecutionResult(`执行失败: ${message}`);
        pushNotification('错误', message, 'error');
        return;
      }

      setCodeExecutionLoading(true);
      setCodeLoadingText('正在执行代码...');

      try {
        const result = await executeInInspectedWindow(code);
        setCodeExecutionResult(`执行成功: ${formatExecutionResult(result)}`);
        pushNotification('成功', successMessage, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : '代码执行失败';
        setCodeExecutionResult(`执行失败: ${message}`);
        pushNotification('错误', `代码执行失败: ${message}`, 'error');
      } finally {
        setCodeExecutionLoading(false);
      }
    },
    [codeInput, pushNotification]
  );

  // ref for runCode to avoid circular dependency
  const runCodeRef = useRef(runCode);
  runCodeRef.current = runCode;

  /** 解释代码 */
  const explainCode = useCallback(async (): Promise<void> => {
    const code = codeInput.trim();
    if (!code) {
      pushNotification('提示', '请输入要解释的代码', 'info');
      return;
    }

    setCodeExecutionLoading(true);
    setCodeLoadingText('正在生成代码解释...');
    setCodeExecutionResult('');

    try {
      const explanation = await streamAIConversation({
        prompt: `请解释以下浏览器控制代码的作用、步骤、潜在风险，并给出更稳妥的建议：\n\n\`\`\`javascript\n${code}\n\`\`\``,
        onChunk: (content) => {
          setCodeExecutionResult(content);
        },
      });

      setCodeExecutionResult(explanation || '未能生成解释');
    } catch (error) {
      const message = error instanceof Error ? error.message : '解释代码失败';
      setCodeExecutionResult(`解释失败: ${message}`);
      pushNotification('错误', `解释代码失败: ${message}`, 'error');
    } finally {
      setCodeExecutionLoading(false);
    }
  }, [codeInput, pushNotification]);

  /** 清空代码输出 */
  const clearCodeOutput = useCallback((): void => {
    setCodeInput('');
    setCodeExecutionResult('');
  }, []);

  /** 清空聊天历史 */
  const clearChatHistory = useCallback((): void => {
    if (!window.confirm('确定要清空所有历史记录吗？')) return;
    setChatHistory([]);
    saveChatHistoryToStorage([]);
    pushNotification('成功', '历史记录已清空', 'success');
  }, [pushNotification]);

  /** 清除 DeepSeek 会话 */
  const clearDeepSeekSession = useCallback(async (): Promise<void> => {
    if (!window.confirm('确定要清除DeepSeek会话吗？这将重置AI的上下文理解。')) return;

    try {
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'CLEAR_AI_SESSION',
            payload: { role: 'devtools_assistant' },
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(response);
          }
        );
      });
      pushNotification('成功', 'DeepSeek会话已清除', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '清除会话失败';
      pushNotification('错误', message, 'error');
    }
  }, [pushNotification]);

  /** 导出聊天历史 */
  const exportChatHistory = useCallback((): void => {
    if (chatHistory.length === 0) {
      pushNotification('提示', '没有历史记录可导出', 'info');
      return;
    }

    const historyJson = JSON.stringify(chatHistory, null, 2);
    const blob = new Blob([historyJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `ai-assistant-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [chatHistory, pushNotification]);

  /** 保存设置 */
  const saveSettings = useCallback((): void => {
    const config = getCurrentFormConfig(settingsFormRef.current);
    if (!config) return;

    void saveAIConfig(config);

    // 同步预设选择
    const matchedPreset = modelPresets.find((preset) => isSameModelConfig(preset, config));
    if (matchedPreset) {
      setSelectedPresetId(matchedPreset.id);
      setPresetName(matchedPreset.name);
      setActivePresetId(matchedPreset.id);
    } else {
      setSelectedPresetId('');
      setPresetName('');
      setActivePresetId('');
    }

    pushNotification('成功', '设置已保存', 'success');
  }, [modelPresets, pushNotification]);

  /** 处理预设切换 */
  const handlePresetChange = useCallback((): void => {
    if (!selectedPresetId) {
      setPresetName('');
      setActivePresetId('');
      return;
    }

    const preset = modelPresets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setSelectedPresetId('');
      setPresetName('');
      setActivePresetId('');
      pushNotification('错误', '未找到所选预设', 'error');
      return;
    }

    const newForm = buildFormFromConfig(preset);
    setSettingsForm(newForm);
    setPresetName(preset.name);
    setActivePresetId(preset.id);

    void saveAIConfig({
      provider: preset.provider,
      customProvider: preset.customProvider,
      modelId: preset.modelId,
      apiBaseUrl: preset.apiBaseUrl,
      apiKey: preset.apiKey,
    });

    pushNotification('成功', `已切换到预设：${preset.name}`, 'success');
  }, [selectedPresetId, modelPresets, pushNotification]);

  /** 保存当前为预设 */
  const saveCurrentAsModelPreset = useCallback((): void => {
    const config = getCurrentFormConfig(settingsFormRef.current);
    if (!config) return;

    const name = presetName.trim();
    if (!name) {
      pushNotification('错误', '请输入预设名称', 'error');
      return;
    }

    const currentPresets = [...modelPresets];
    const selectedPreset = currentPresets.find((preset) => preset.id === selectedPresetId);
    const duplicatedPreset = currentPresets.find((preset) => preset.name === name);

    if (duplicatedPreset && duplicatedPreset.id !== selectedPreset?.id) {
      const shouldOverwrite = window.confirm(`已存在名为"${name}"的预设，是否覆盖？`);
      if (!shouldOverwrite) return;
    }

    const existingPresetIndex = selectedPreset
      ? currentPresets.findIndex((preset) => preset.id === selectedPreset.id)
      : currentPresets.findIndex((preset) => preset.name === name);
    const existingPreset = existingPresetIndex >= 0 ? currentPresets[existingPresetIndex] : null;
    const now = new Date().toISOString();

    const nextPreset: AIModelPreset = {
      ...config,
      id: existingPreset?.id || createPresetId(),
      name,
      createdAt: existingPreset?.createdAt || now,
      updatedAt: now,
    };

    if (existingPresetIndex >= 0) {
      currentPresets[existingPresetIndex] = nextPreset;
    } else {
      currentPresets.unshift(nextPreset);
    }

    saveModelPresetsToStorage(currentPresets);
    void saveAIConfig(config);
    setModelPresets(currentPresets);
    setSelectedPresetId(nextPreset.id);
    setPresetName(nextPreset.name);
    setActivePresetId(nextPreset.id);
    pushNotification('成功', `预设已保存：${nextPreset.name}`, 'success');
  }, [presetName, modelPresets, selectedPresetId, pushNotification]);

  /** 删除选中的预设 */
  const deleteSelectedModelPreset = useCallback((): void => {
    if (!selectedPresetId) {
      pushNotification('提示', '请先选择要删除的预设', 'info');
      return;
    }

    const preset = modelPresets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setSelectedPresetId('');
      setPresetName('');
      setActivePresetId('');
      pushNotification('错误', '未找到要删除的预设', 'error');
      return;
    }

    if (!window.confirm(`确定删除预设"${preset.name}"吗？`)) return;

    const newPresets = modelPresets.filter((item) => item.id !== preset.id);
    saveModelPresetsToStorage(newPresets);
    setModelPresets(newPresets);

    if (getActivePresetId() === preset.id) {
      setActivePresetId('');
    }

    setSelectedPresetId('');
    setPresetName('');
    pushNotification('成功', `预设已删除：${preset.name}`, 'success');
  }, [selectedPresetId, modelPresets, pushNotification]);

  // 监听 provider 变化
  useEffect(() => {
    if (settingsForm.providerSelect === 'default') {
      setSettingsForm((prev) => ({ ...prev, modelId: DEFAULT_BUILTIN_MODEL_ID }));
    }
  }, [settingsForm.providerSelect]);

  // 监听执行设置变化
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.EXECUTION_SETTINGS,
      JSON.stringify(executionSettings)
    );
  }, [executionSettings]);

  // 初始化加载
  useEffect(() => {
    // 加载聊天历史
    setChatHistory(loadChatHistoryFromStorage());

    // 加载执行设置
    const savedExecutionSettings = localStorage.getItem(STORAGE_KEYS.EXECUTION_SETTINGS);
    if (savedExecutionSettings) {
      try {
        const parsed = JSON.parse(savedExecutionSettings);
        setExecutionSettings({
          ...getDefaultExecutionSettings(),
          ...parsed,
        });
      } catch (error) {
        maLogger.error('加载执行设置失败:', error);
      }
    }

    // 加载设置状态
    const config = loadAIConfigSync();
    setSettingsForm(buildFormFromConfig(config));

    const presets = loadModelPresetsFromStorage();
    setModelPresets(presets);

    const activePresetId = getActivePresetId();
    const matchedPreset =
      presets.find((preset) => preset.id === activePresetId) ||
      presets.find((preset) => isSameModelConfig(preset, config));

    if (matchedPreset) {
      setSelectedPresetId(matchedPreset.id);
      setPresetName(matchedPreset.name);
      setActivePresetId(matchedPreset.id);
    }

    // 加载指令草稿
    const draft = localStorage.getItem(STORAGE_KEYS.INSTRUCTION_DRAFT_KEY) || '';
    setInstructionInput(draft);

    maLogger.log('AI助手面板初始化完成');
  }, []);

  return {
    activeTab,
    setActiveTab,
    notifications,
    instructionInput,
    setInstructionInput,
    executionResult,
    executionError,
    executionLoading,
    generatedCode,
    codeInput,
    setCodeInput,
    codeExecutionResult,
    codeExecutionLoading,
    codeLoadingText,
    chatHistory,
    settingsForm,
    setSettingsForm,
    modelPresets,
    selectedPresetId,
    setSelectedPresetId,
    presetName,
    setPresetName,
    executionSettings,
    pushNotification,
    handleInstructionKeydown,
    executeNaturalLanguageCommand,
    clearInstruction,
    saveCurrentInstruction,
    runCode,
    clearCodeOutput,
    explainCode,
    clearChatHistory,
    clearDeepSeekSession,
    exportChatHistory,
    saveSettings,
    handlePresetChange,
    saveCurrentAsModelPreset,
    deleteSelectedModelPreset,
    isCustomProviderSelected,
    isBuiltInProviderSelected,
  };
};
