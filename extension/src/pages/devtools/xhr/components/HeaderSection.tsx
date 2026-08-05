/**
 * @description 头部区域组件
 */
import React from 'react';
import { Button } from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';

interface HeaderSectionProps {
  isXhrEnabled: boolean;
  isXhrPatched: boolean;
  isLoading: boolean;
  rulesCount: number;
  onRefresh: () => void;
  onAddRule: () => void;
  onClearAll: () => void;
  onToggle: () => void;
}

export const HeaderSection: React.FC<HeaderSectionProps> = ({
  isXhrEnabled,
  isXhrPatched,
  isLoading,
  rulesCount,
  onRefresh,
  onAddRule,
  onClearAll,
  onToggle,
}) => {
  const statusText = isXhrEnabled && isXhrPatched
    ? 'XHR补丁已启用并应用规则'
    : isXhrEnabled
      ? 'XHR补丁已启用但未应用规则'
      : 'XHR补丁已禁用';

  return (
    <div className="header-action-container">
      {/* 左侧：标题和状态 */}
      <div className="header-section">
        <h1>XHR补丁管理</h1>
        <p className="subtitle">控制和监控页面的XHR请求拦截规则</p>

        {/* 状态指示器 */}
        <div className={`status-indicator ${isXhrEnabled && isXhrPatched ? 'active' : ''}`}>
          <div className="status-dot"></div>
          <span>{statusText}</span>
        </div>
      </div>

      {/* 右侧：操作按钮组 */}
      <div className="action-buttons">
        <Button
          className="action-btn action-btn--primary"
          disabled={isLoading}
          onClick={onRefresh}
          icon={<ReloadOutlined />}
        >
          刷新规则
        </Button>
        <Button
          className="action-btn action-btn--secondary"
          disabled={isLoading}
          onClick={onAddRule}
          icon={<PlusOutlined />}
        >
          添加规则
        </Button>
        <Button
          className="action-btn action-btn--danger"
          disabled={isLoading || rulesCount === 0}
          onClick={onClearAll}
          icon={<DeleteOutlined />}
        >
          清空规则
        </Button>
        <Button
          className={`action-btn ${isXhrEnabled ? 'action-btn--outline' : 'action-btn--primary'}`}
          disabled={isLoading}
          onClick={onToggle}
          icon={isXhrEnabled ? <PoweroffOutlined /> : <DisconnectOutlined />}
        >
          {isXhrEnabled ? '禁用补丁' : '启用补丁'}
        </Button>
      </div>
    </div>
  );
};
