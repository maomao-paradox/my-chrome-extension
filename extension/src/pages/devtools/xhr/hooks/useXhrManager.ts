/**
 * @description XHR 规则管理 Hook
 */
import { useState, useCallback, useEffect } from 'react';
import type { XhrRule, XhrRulesArray, RuleInstruction, HandlerType } from '../types';

interface UseXhrManagerReturn {
  /** 是否加载中 */
  isLoading: boolean;
  /** XHR 补丁是否已启用 */
  isXhrEnabled: boolean;
  /** XHR 补丁是否已应用 */
  isXhrPatched: boolean;
  /** 规则列表 */
  rules: XhrRulesArray;
  /** 刷新规则 */
  refreshRules: () => Promise<void>;
  /** 添加新规则 */
  addNewRule: () => void;
  /** 编辑规则 */
  editRule: (rule: XhrRule, index: number) => void;
  /** 保存规则 */
  saveRule: (rule: XhrRule) => Promise<void>;
  /** 删除规则 */
  deleteRule: (api: string) => Promise<void>;
  /** 清空所有规则 */
  clearAllRules: () => Promise<void>;
  /** 切换 XHR 补丁状态 */
  toggleXhrPatch: () => Promise<void>;
  /** 当前编辑的规则 */
  currentRule: XhrRule | null;
  /** 是否编辑模式 */
  isEditing: boolean;
  /** 当前编辑规则索引 */
  currentRuleIndex: number;
  /** 对话框状态 */
  showRuleDialog: boolean;
  /** 关闭规则对话框 */
  closeRuleDialog: () => void;
  /** 更新当前编辑的规则 */
  updateCurrentRule: (rule: XhrRule) => void;
  /** 添加子规则 */
  addSubRule: (handlerType: HandlerType) => void;
  /** 移除子规则 */
  removeSubRule: (handlerType: HandlerType, index: number) => void;
}

/**
 * 创建空规则
 */
const createEmptyRule = (): XhrRule => ({
  api: '',
  openRules: [],
  sendRules: [],
  responseRules: [],
});

/**
 * 创建默认子规则
 */
const createDefaultSubRule = (handlerType: HandlerType): RuleInstruction => ({
  type: handlerType === 'open' ? 'replaceUrl' : 'setField',
  params: {},
});

export const useXhrManager = (): UseXhrManagerReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [isXhrPatched, setIsXhrPatched] = useState(false);
  const [isXhrEnabled, setIsXhrEnabled] = useState(false);
  const [rules, setRules] = useState<XhrRulesArray>([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRuleIndex, setCurrentRuleIndex] = useState(-1);
  const [currentRule, setCurrentRule] = useState<XhrRule | null>(null);

  /** 从页面获取 XHR 补丁状态 */
  const fetchStatus = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        chrome.devtools.inspectedWindow.eval(
          'window.XHR_PATCH_MANAGER.getStatus();',
          (result: any, isException: boolean) => {
            if (isException) {
              reject(new Error(result?.description || '获取状态失败'));
              return;
            }
            setIsXhrEnabled(result.isEnabled !== undefined ? result.isEnabled : false);
            setIsXhrPatched(result.isPatched !== undefined ? result.isPatched : false);
            resolve();
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  /** 从页面获取规则列表 */
  const fetchRules = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        chrome.devtools.inspectedWindow.eval(
          'window.XHR_PATCH_MANAGER.getCurrentRules();',
          (result: any, isException: boolean) => {
            if (isException) {
              reject(new Error(result?.description || '获取规则失败'));
              return;
            }
            const newRules: XhrRulesArray = [];
            if (result) {
              for (const [api, ruleObj] of Object.entries(result)) {
                const rule: XhrRule = {
                  api,
                  ...JSON.parse(JSON.stringify(ruleObj)),
                };
                newRules.push(rule);
              }
            }
            setRules(newRules);
            resolve();
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  /** 刷新规则（获取状态 + 规则列表） */
  const refreshRules = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await Promise.all([fetchStatus(), fetchRules()]);
    } catch (error) {
      maLogger.error('获取XHR规则失败:', error);
      setIsXhrPatched(false);
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, fetchRules]);

  /** 添加新规则 */
  const addNewRule = useCallback((): void => {
    setIsEditing(false);
    setCurrentRule(createEmptyRule());
    setCurrentRuleIndex(-1);
    setShowRuleDialog(true);
  }, []);

  /** 编辑规则 */
  const editRule = useCallback((rule: XhrRule, index: number): void => {
    setIsEditing(true);
    setCurrentRuleIndex(index);
    const editedRule: XhrRule = { api: rule.api };
    if (rule.openRules && rule.openRules.length > 0) {
      editedRule.openRules = JSON.parse(JSON.stringify(rule.openRules));
    }
    if (rule.sendRules && rule.sendRules.length > 0) {
      editedRule.sendRules = JSON.parse(JSON.stringify(rule.sendRules));
    }
    if (rule.responseRules && rule.responseRules.length > 0) {
      editedRule.responseRules = JSON.parse(JSON.stringify(rule.responseRules));
    }
    setCurrentRule(editedRule);
    setShowRuleDialog(true);
  }, []);

  /** 关闭规则对话框 */
  const closeRuleDialog = useCallback((): void => {
    setShowRuleDialog(false);
    setTimeout(() => {
      setCurrentRule(createEmptyRule());
      setIsEditing(false);
      setCurrentRuleIndex(-1);
    }, 300);
  }, []);

  /** 更新当前编辑的规则 */
  const updateCurrentRule = useCallback((rule: XhrRule): void => {
    setCurrentRule(rule);
  }, []);

  /** 添加子规则 */
  const addSubRule = useCallback((handlerType: HandlerType): void => {
    if (!currentRule) return;

    const newRule = { ...currentRule };
    const subRulesKey = `${handlerType}Rules` as 'openRules' | 'sendRules' | 'responseRules';

    if (!newRule[subRulesKey]) {
      newRule[subRulesKey] = [];
    }
    newRule[subRulesKey]!.push(createDefaultSubRule(handlerType));
    setCurrentRule(newRule);
  }, [currentRule]);

  /** 移除子规则 */
  const removeSubRule = useCallback((handlerType: HandlerType, index: number): void => {
    if (!currentRule) return;

    const newRule = { ...currentRule };
    const subRulesKey = `${handlerType}Rules` as 'openRules' | 'sendRules' | 'responseRules';

    if (newRule[subRulesKey]) {
      newRule[subRulesKey] = [...newRule[subRulesKey]!];
      newRule[subRulesKey]!.splice(index, 1);
    }
    setCurrentRule(newRule);
  }, [currentRule]);

  /** 保存规则到页面 */
  const saveRuleToPage = useCallback(async (rule: XhrRule): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const newXhrRule: XhrRule = JSON.parse(JSON.stringify(rule));
      if (newXhrRule.openRules?.length === 0) {
        delete newXhrRule.openRules;
      }
      if (newXhrRule.sendRules?.length === 0) {
        delete newXhrRule.sendRules;
      }
      if (newXhrRule.responseRules?.length === 0) {
        delete newXhrRule.responseRules;
      }

      const payload = { [newXhrRule.api!]: newXhrRule };
      const payloadStr = JSON.stringify(payload);

      chrome.devtools.inspectedWindow.eval(
        `window.XHR_PATCH_MANAGER.updateRules(${payloadStr});`,
        (result: any, isException: boolean) => {
          if (isException) {
            reject(new Error(result?.description || '更新规则失败'));
          } else {
            resolve();
          }
        }
      );
    });
  }, []);

  /** 保存规则 */
  const saveRule = useCallback(async (rule: XhrRule): Promise<void> => {
    if (!rule.api) return;

    setIsLoading(true);
    try {
      await saveRuleToPage(rule);

      if (isEditing && currentRuleIndex >= 0) {
        setRules((prev) => {
          const next = [...prev];
          next[currentRuleIndex] = rule;
          return next;
        });
      } else {
        setRules((prev) => [...prev, rule]);
      }
      closeRuleDialog();
    } catch (error) {
      maLogger.error('保存规则失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isEditing, currentRuleIndex, saveRuleToPage, closeRuleDialog]);

  /** 删除规则 */
  const deleteRule = useCallback(async (api: string): Promise<void> => {
    setIsLoading(true);
    try {
      const updatedRules: Record<string, any> = {};
      rules.forEach((rule) => {
        if (rule.api !== api) {
          updatedRules[rule.api!] = rule;
        }
      });

      await new Promise<void>((resolve, reject) => {
        const updatedRulesStr = JSON.stringify(updatedRules);
        chrome.devtools.inspectedWindow.eval(
          `window.XHR_PATCH_MANAGER.updateRules(${updatedRulesStr});`,
          (result: any, isException: boolean) => {
            if (isException) {
              reject(new Error(result?.description || '删除规则失败'));
            } else {
              resolve();
            }
          }
        );
      });

      setRules((prev) => prev.filter((rule) => rule.api !== api));
    } catch (error) {
      maLogger.error('删除规则失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [rules]);

  /** 清空所有规则 */
  const clearAllRules = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.devtools.inspectedWindow.eval(
          'window.XHR_PATCH_MANAGER.clearRules();',
          (result: any, isException: boolean) => {
            if (isException) {
              reject(new Error(result?.description || '清空规则失败'));
            } else {
              resolve();
            }
          }
        );
      });
      setRules([]);
    } catch (error) {
      maLogger.error('清空规则失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** 切换 XHR 补丁状态 */
  const toggleXhrPatch = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    const newState = !isXhrEnabled;
    
    // 乐观更新 UI
    setIsXhrEnabled(newState);

    try {
      await new Promise<void>((resolve, reject) => {
        chrome.devtools.inspectedWindow.eval(
          `window.XHR_PATCH_MANAGER.toggleEnabled(${newState})`,
          (result: any, isException: boolean) => {
            if (isException) {
              reject(new Error(result?.description || '切换XHR补丁状态失败'));
            } else {
              const enabled = result.isEnabled !== undefined ? result.isEnabled : newState;
              const patched = result.isPatched !== undefined ? result.isPatched : (newState && rules.length > 0);
              setIsXhrEnabled(enabled);
              setIsXhrPatched(patched);
              resolve();
            }
          }
        );
      });
    } catch (error) {
      // 回滚 UI
      setIsXhrEnabled(!newState);
      maLogger.error('切换XHR补丁状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isXhrEnabled, rules.length]);

  /** 初始化加载 */
  useEffect(() => {
    void refreshRules();
  }, [refreshRules]);

  return {
    isLoading,
    isXhrEnabled,
    isXhrPatched,
    rules,
    refreshRules,
    addNewRule,
    editRule,
    saveRule,
    deleteRule,
    clearAllRules,
    toggleXhrPatch,
    currentRule,
    isEditing,
    currentRuleIndex,
    showRuleDialog,
    closeRuleDialog,
    updateCurrentRule,
    addSubRule,
    removeSubRule,
  };
};
