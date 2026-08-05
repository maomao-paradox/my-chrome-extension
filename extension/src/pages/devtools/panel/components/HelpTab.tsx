/**
 * @description 帮助 Tab 组件
 */
import React from 'react';
import { Card } from 'antd';
import { EXAMPLE_COMMANDS, FAQ_ITEMS } from '../types';

export const HelpTab: React.FC = () => {
  return (
    <>
      <Card size="small" title="使用指南" className="ai-card">
        <ul className="info-list">
          <li>
            <span className="label">基本用法：</span>
            <span className="value">在对话模式下输入自然语言指令，点击执行按钮</span>
          </li>
          <li>
            <span className="label">示例指令：</span>
            <div className="value">
              <ul className="nested-list">
                {EXAMPLE_COMMANDS.map((example, index) => (
                  <li key={index}>{example}</li>
                ))}
              </ul>
            </div>
          </li>
          <li>
            <span className="label">代码模式：</span>
            <span className="value">直接输入和执行浏览器控制代码</span>
          </li>
          <li>
            <span className="label">历史记录：</span>
            <span className="value">查看和管理之前执行的指令</span>
          </li>
          <li>
            <span className="label">设置：</span>
            <span className="value">配置AI模型参数、执行方式和预设</span>
          </li>
        </ul>
      </Card>

      <Card size="small" title="常见问题" className="ai-card">
        <ul className="info-list">
          {FAQ_ITEMS.map((faq, index) => (
            <li key={index}>
              <span className="label">{faq.question}</span>
              <span className="value">{faq.answer}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
};
