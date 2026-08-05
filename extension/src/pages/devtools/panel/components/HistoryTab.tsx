/**
 * @description 历史记录 Tab 组件
 */
import React from 'react';
import { Card, Button } from 'antd';
import type { ChatHistoryItem } from '../types';

interface HistoryTabProps {
  chatHistory: ChatHistoryItem[];
  onClearHistory: () => void;
  onClearSession: () => void;
  onExport: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  chatHistory,
  onClearHistory,
  onClearSession,
  onExport,
}) => {
  return (
    <Card size="small" title="指令历史" className="ai-card">
      <div className="history-actions">
        <Button onClick={onClearHistory}>清空历史</Button>
        <Button onClick={onClearSession}>清除会话</Button>
        <Button onClick={onExport}>导出历史</Button>
      </div>

      {chatHistory.length === 0 ? (
        <div className="alert alert-info">
          暂无历史记录，请先执行一些指令。
        </div>
      ) : (
        <div className="history-list">
          {chatHistory.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              className={`history-item ${item.role}`}
            >
              <div className="history-role">
                {item.role === 'user' ? '你' : 'AI'}
              </div>
              <div className="history-content">{item.content}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
