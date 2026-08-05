/**
 * @description 子规则编辑器组件
 */
import React, { useCallback, useEffect } from 'react';
import { Input, Select, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { RuleInstruction } from '../types';
import { SUB_RULE_TYPE_OPTIONS } from '../types';

interface SubRuleEditorProps {
  index: number;
  subRule: RuleInstruction;
  onChange: (subRule: RuleInstruction) => void;
  onRemove: () => void;
}

/**
 * 初始化子规则参数
 */
const initSubRuleParams = (type: string, params?: RuleInstruction['params']): RuleInstruction['params'] => {
  const newParams = { ...(params || {}) };

  // 根据类型设置默认参数
  if (type === 'replaceUrl') {
    if (newParams.path) {
      newParams.value = newParams.path;
      delete newParams.path;
    }
    if (newParams.search === undefined) newParams.search = '';
    if (newParams.value === undefined) newParams.value = '';
  } else if (type === 'setParam' || type === 'deleteParam') {
    if (!newParams.path) newParams.path = '';
    if (type === 'setParam' && !newParams.value) newParams.value = '';
  } else if (type === 'setField' || type === 'appendArray') {
    if (!newParams.path) newParams.path = '';
    if (!newParams.value) newParams.value = '';
  } else if (type === 'deleteField') {
    if (!newParams.path) newParams.path = '';
  } else if (type === 'setStatus') {
    if (newParams.statusCode === undefined) newParams.statusCode = 200;
  }

  return newParams;
};

export const SubRuleEditor: React.FC<SubRuleEditorProps> = ({
  index,
  subRule,
  onChange,
  onRemove,
}) => {
  // 确保 params 对象存在并根据类型初始化
  useEffect(() => {
    if (!subRule.params) {
      onChange({ ...subRule, params: {} });
    }
  }, [subRule, onChange]);

  const handleTypeChange = useCallback((type: string): void => {
    const newParams = initSubRuleParams(type, subRule.params);
    onChange({ ...subRule, type, params: newParams });
  }, [subRule, onChange]);

  const handleParamChange = useCallback((key: string, value: any): void => {
    onChange({
      ...subRule,
      params: { ...subRule.params, [key]: value },
    });
  }, [subRule, onChange]);

  const handleValueChange = useCallback((inputValue: string): void => {
    let parsedValue: any = inputValue;
    try {
      parsedValue = JSON.parse(inputValue);
    } catch {
      // 如果不是有效的 JSON，则保持为字符串
      parsedValue = inputValue;
    }
    handleParamChange('value', parsedValue);
  }, [handleParamChange]);

  const valueDisplay = (() => {
    const value = subRule.params?.value;
    if (value !== null && typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return value !== undefined ? String(value) : '';
  })();

  const showSearchInput = subRule.type === 'replaceUrl';
  const showValueInput = ['setField', 'appendArray', 'setParam'].includes(subRule.type);
  const showPathInput = !['replaceUrl', 'setStatus'].includes(subRule.type);
  const showStatusInput = subRule.type === 'setStatus';
  const pathLabel = subRule.type === 'setParam' || subRule.type === 'deleteParam' ? '参数名' : '字段路径';

  return (
    <div className="subrule-card">
      <div className="subrule-header">
        <span className="subrule-index">#{index + 1}</span>
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={onRemove}
        />
      </div>

      <div className="subrule-content">
        <div className="form-group subrule-form-group">
          <label>操作类型:</label>
          <Select
            value={subRule.type}
            onChange={handleTypeChange}
            options={SUB_RULE_TYPE_OPTIONS}
            style={{ width: '100%' }}
          />
        </div>

        {showSearchInput && (
          <div className="form-group subrule-form-group">
            <label>搜索字符串:</label>
            <Input
              value={subRule.params?.search || ''}
              onChange={(e) => handleParamChange('search', e.target.value)}
              placeholder="可选，指定要替换的URL部分"
            />
          </div>
        )}

        {showSearchInput && (
          <div className="form-group subrule-form-group">
            <label>替换值(新URL):</label>
            <Input
              value={subRule.params?.value || ''}
              onChange={(e) => handleParamChange('value', e.target.value)}
              placeholder="输入新URL"
            />
          </div>
        )}

        {showPathInput && (
          <div className="form-group subrule-form-group">
            <label>{pathLabel}:</label>
            <Input
              value={subRule.params?.path || ''}
              onChange={(e) => handleParamChange('path', e.target.value)}
              placeholder={pathLabel === '参数名' ? '输入参数名' : '输入字段路径'}
            />
          </div>
        )}

        {showValueInput && (
          <div className="form-group subrule-form-group">
            <label>值:</label>
            <Input.TextArea
              value={valueDisplay}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="输入值 (支持JSON格式)"
              autoSize={{ minRows: 1, maxRows: 4 }}
            />
          </div>
        )}

        {showStatusInput && (
          <div className="form-group subrule-form-group">
            <label>状态码:</label>
            <Input
              type="number"
              value={subRule.params?.statusCode ?? 200}
              onChange={(e) => handleParamChange('statusCode', Number(e.target.value))}
              placeholder="例如: 200"
            />
          </div>
        )}
      </div>
    </div>
  );
};
