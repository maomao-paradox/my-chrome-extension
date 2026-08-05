/**
 * @description XHR 补丁管理主应用组件
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useXhrManager } from './hooks/useXhrManager';
import { HeaderSection } from './components/HeaderSection';
import { RuleList } from './components/RuleList';
import { RuleDialog } from './components/RuleDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import './styles/xhr.scss';

export const XhrApp: React.FC = () => {
  const {
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
    showRuleDialog,
    closeRuleDialog,
    updateCurrentRule,
    addSubRule,
    removeSubRule,
  } = useXhrManager();

  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  /** 显示确认对话框 */
  const showConfirm = useCallback((message: string, action: () => void): void => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmDialog(true);
  }, []);

  /** 关闭确认对话框 */
  const closeConfirmDialog = useCallback((): void => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, []);

  /** 确认操作 */
  const handleConfirm = useCallback((): void => {
    if (confirmAction) {
      confirmAction();
    }
    closeConfirmDialog();
  }, [confirmAction, closeConfirmDialog]);

  /** 处理删除规则 */
  const handleDeleteRule = useCallback((api: string): void => {
    showConfirm(`确定要删除规则 "${api}" 吗？`, () => {
      void deleteRule(api);
    });
  }, [deleteRule, showConfirm]);

  /** 处理清空所有规则 */
  const handleClearAllRules = useCallback((): void => {
    showConfirm('确定要清空所有规则吗？此操作不可恢复。', () => {
      void clearAllRules();
    });
  }, [clearAllRules, showConfirm]);

  /** 处理保存规则 */
  const handleSaveRule = useCallback(async (rule: typeof currentRule): Promise<void> => {
    if (!rule) return;
    await saveRule(rule);
  }, [saveRule]);

  return (
    <div className="xhr-patch-container fade-in">
      <HeaderSection
        isXhrEnabled={isXhrEnabled}
        isXhrPatched={isXhrPatched}
        isLoading={isLoading}
        rulesCount={rules.length}
        onRefresh={() => void refreshRules()}
        onAddRule={addNewRule}
        onClearAll={handleClearAllRules}
        onToggle={() => void toggleXhrPatch()}
      />

      <RuleList
        rules={rules}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddRule={addNewRule}
        onEditRule={editRule}
        onDeleteRule={handleDeleteRule}
      />

      <RuleDialog
        visible={showRuleDialog}
        isEditing={isEditing}
        currentRule={currentRule}
        isLoading={isLoading}
        onClose={closeRuleDialog}
        onSave={(rule) => void handleSaveRule(rule)}
        onUpdateCurrentRule={updateCurrentRule}
        onAddSubRule={addSubRule}
        onRemoveSubRule={removeSubRule}
      />

      <ConfirmDialog
        visible={showConfirmDialog}
        title="确认操作"
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
};

export default XhrApp;
