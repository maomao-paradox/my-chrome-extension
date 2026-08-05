/**
 * @description 对话模式 Tab 组件
 */
import React from 'react';
import { Card, Input, Button } from 'antd';

interface ChatTabProps {
  instructionInput: string;
  setInstructionInput: (input: string) => void;
  executionResult: string;
  executionError: string;
  executionLoading: boolean;
  generatedCode: string;
  showGeneratedCode: boolean;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onExecute: () => void;
  onClear: () => void;
  onSave: () => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  instructionInput,
  setInstructionInput,
  executionResult,
  executionError,
  executionLoading,
  generatedCode,
  showGeneratedCode,
  onKeyDown,
  onExecute,
  onClear,
  onSave,
}) => {
  return (
    <>
      <Card
        size="small"
        title="指令输入"
        className="ai-card"
      >
        <div className="form-group">
          <label htmlFor="instruction-input">输入自然语言指令</label>
          <Input.TextArea
            id="instruction-input"
            value={instructionInput}
            onChange={(e) => setInstructionInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="例如：点击页面上的登录按钮，然后输入用户名和密码"
            rows={4}
          />
        </div>
        <div className="flex">
          <Button
            type="primary"
            onClick={onExecute}
            loading={executionLoading}
          >
            执行指令
          </Button>
          <Button onClick={onClear}>清空</Button>
          <Button onClick={onSave}>保存指令</Button>
        </div>
      </Card>

      <Card
        size="small"
        title="执行结果"
        className="ai-card"
      >
        <div className="result-area">
          {executionLoading && !executionResult && (
            <div className="result-placeholder">
              <span className="loading" />
              <span>正在处理...</span>
            </div>
          )}
          {!executionLoading && executionResult && (
            <pre className="result-pre">{executionResult}</pre>
          )}
          {!executionLoading && !executionResult && executionError && (
            <div className="alert alert-warning">
              执行失败: {executionError}
            </div>
          )}
          {!executionLoading && !executionResult && !executionError && (
            <div className="alert alert-info">
              欢迎使用AI助手！请在上方输入自然语言指令，我将帮您操控浏览器。
            </div>
          )}
        </div>
      </Card>

      {showGeneratedCode && (
        <Card
          size="small"
          title="生成的代码"
          className="ai-card"
        >
          <div className="code-editor">
            {generatedCode || '// 生成的代码将显示在这里'}
          </div>
        </Card>
      )}
    </>
  );
};
