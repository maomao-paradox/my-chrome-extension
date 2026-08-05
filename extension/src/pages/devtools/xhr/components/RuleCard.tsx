/**
 * @description 规则卡片组件
 */
import React from 'react';
import { Button } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { XhrRule } from '../types';

interface RuleCardProps {
  rule: XhrRule;
  onEdit: () => void;
  onDelete: () => void;
}

export const RuleCard: React.FC<RuleCardProps> = React.memo(({ rule, onEdit, onDelete }) => {
  const openRulesCount = rule.openRules?.length || 0;
  const sendRulesCount = rule.sendRules?.length || 0;
  const responseRulesCount = rule.responseRules?.length || 0;

  return (
    <div className="rule-card">
      <div className="rule-header">
        <div className="rule-path">
          <span className="path-icon">📡</span>
          <span className="path-text">{rule.api}</span>
        </div>
        <div className="rule-actions">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            title="编辑规则"
            onClick={onEdit}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            title="删除规则"
            onClick={onDelete}
          />
        </div>
      </div>

      <div className="rule-details">
        {openRulesCount > 0 && (
          <div className="handler-item">
            <span className="handler-label">Open处理器:</span>
            <span className="handler-status active">{openRulesCount}个子规则</span>
          </div>
        )}
        {sendRulesCount > 0 && (
          <div className="handler-item">
            <span className="handler-label">Send处理器:</span>
            <span className="handler-status active">{sendRulesCount}个子规则</span>
          </div>
        )}
        {responseRulesCount > 0 && (
          <div className="handler-item">
            <span className="handler-label">响应拦截:</span>
            <span className="handler-status active">{responseRulesCount}个子规则</span>
          </div>
        )}
      </div>
    </div>
  );
});

RuleCard.displayName = 'RuleCard';
