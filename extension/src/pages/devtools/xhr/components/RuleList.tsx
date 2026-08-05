/**
 * @description 规则列表组件
 */
import React, { useMemo } from 'react';
import { Input, Button } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import type { XhrRulesArray, XhrRule } from '../types';
import { RuleCard } from './RuleCard';

interface RuleListProps {
  rules: XhrRulesArray;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddRule: () => void;
  onEditRule: (rule: XhrRule, index: number) => void;
  onDeleteRule: (api: string) => void;
}

export const RuleList: React.FC<RuleListProps> = ({
  rules,
  isLoading,
  searchQuery,
  onSearchChange,
  onAddRule,
  onEditRule,
  onDeleteRule,
}) => {
  const filteredRules = useMemo((): XhrRulesArray => {
    if (!searchQuery.trim()) {
      return rules;
    }

    const query = searchQuery.toLowerCase();
    return rules.filter((rule) => rule.api?.toLowerCase().includes(query));
  }, [rules, searchQuery]);

  return (
    <div className="rules-section">
      <div className="section-header">
        <h2>当前规则 ({rules.length})</h2>
        <div className="search-box">
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索规则路径..."
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
          />
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>正在获取规则...</p>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && filteredRules.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🌐</div>
          <p>暂无规则配置</p>
          <Button
            className="empty-btn"
            icon={<PlusOutlined />}
            onClick={onAddRule}
          >
            添加第一条规则
          </Button>
        </div>
      )}

      {/* 规则列表 */}
      {!isLoading && filteredRules.length > 0 && (
        <div className="rules-list">
          {filteredRules.map((rule, index) => (
            <RuleCard
              key={rule.api}
              rule={rule}
              onEdit={() => onEditRule(rule, rules.indexOf(rule))}
              onDelete={() => rule.api && onDeleteRule(rule.api)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
