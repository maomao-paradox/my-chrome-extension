/**
 * @description 规则编辑对话框组件
 */
import React, { useCallback } from 'react';
import { Modal, Input, Button } from 'antd';
import type { XhrRule, HandlerType, RuleInstruction } from '../types';
import { HANDLER_TYPE_TITLES } from '../types';
import { SubRuleEditor } from './SubRuleEditor';

interface RuleDialogProps {
  visible: boolean;
  isEditing: boolean;
  currentRule: XhrRule | null;
  isLoading: boolean;
  onClose: () => void;
  onSave: (rule: XhrRule) => void;
  onUpdateCurrentRule: (rule: XhrRule) => void;
  onAddSubRule: (handlerType: HandlerType) => void;
  onRemoveSubRule: (handlerType: HandlerType, index: number) => void;
}

export const RuleDialog: React.FC<RuleDialogProps> = ({
  visible,
  isEditing,
  currentRule,
  isLoading,
  onClose,
  onSave,
  onUpdateCurrentRule,
  onAddSubRule,
  onRemoveSubRule,
}) => {
  const handleApiChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!currentRule) return;
    onUpdateCurrentRule({ ...currentRule, api: e.target.value });
  }, [currentRule, onUpdateCurrentRule]);

  const handleSave = useCallback((): void => {
    if (!currentRule || !currentRule.api) return;
    onSave(currentRule);
  }, [currentRule, onSave]);

  const renderHandlerSection = (handlerType: HandlerType) => {
    if (!currentRule) return null;

    const subRulesKey = `${handlerType}Rules` as 'openRules' | 'sendRules' | 'responseRules';
    const subRules = currentRule[subRulesKey] || [];
    const title = HANDLER_TYPE_TITLES[handlerType];

    return (
      <div key={handlerType} className="handler-section">
        <div className="handler-header">
          <h4>{title}</h4>
          <Button
            size="small"
            icon={<>➕</>}
            onClick={() => onAddSubRule(handlerType)}
          >
            添加子规则
          </Button>
        </div>

        {subRules.length > 0 ? (
          <div className="subrules-list">
            {subRules.map((subRule: RuleInstruction, index: number) => (
              <SubRuleEditor
                key={`${handlerType}-${index}`}
                index={index}
                subRule={subRule}
                onChange={(updatedSubRule) => {
                  const newSubRules = [...subRules];
                  newSubRules[index] = updatedSubRule;
                  onUpdateCurrentRule({
                    ...currentRule,
                    [subRulesKey]: newSubRules,
                  });
                }}
                onRemove={() => onRemoveSubRule(handlerType, index)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-subrules">
            <p>暂无子规则，点击添加按钮创建</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={visible}
      title={isEditing ? '编辑规则' : '添加规则'}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          disabled={!currentRule?.api}
          loading={isLoading}
          onClick={handleSave}
        >
          保存规则
        </Button>,
      ]}
    >
      <div className="rule-dialog-content">
        <div className="form-group">
          <label htmlFor="rulePath">API路径:</label>
          <Input
            id="rulePath"
            value={currentRule?.api || ''}
            onChange={handleApiChange}
            placeholder="例如: /api/get_hospital_list"
          />
        </div>

        {renderHandlerSection('open')}
        {renderHandlerSection('send')}
        {renderHandlerSection('response')}
      </div>
    </Modal>
  );
};
