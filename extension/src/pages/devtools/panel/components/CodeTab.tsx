/**
 * @description 代码模式 Tab 组件
 */
import React from 'react';
import { Card, Input, Button } from 'antd';

interface CodeTabProps {
  codeInput: string;
  setCodeInput: (code: string) => void;
  codeExecutionResult: string;
  codeExecutionLoading: boolean;
  codeLoadingText: string;
  onRun: () => void;
  onClear: () => void;
  onExplain: () => void;
}

export const CodeTab: React.FC<CodeTabProps> = ({
  codeInput,
  setCodeInput,
  codeExecutionResult,
  codeExecutionLoading,
  codeLoadingText,
  onRun,
  onClear,
  onExplain,
}) => {
  return (
    <>
      <Card
        size="small"
        title="代码编辑"
        className="ai-card"
      >
        <div className="form-group">
          <label htmlFor="code-input">浏览器控制代码</label>
          <Input.TextArea
            id="code-input"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="输入要执行的浏览器控制代码..."
            rows={8}
          />
        </div>
        <div className="flex">
          <Button
            type="primary"
            onClick={onRun}
            loading={codeExecutionLoading}
          >
            运行代码
          </Button>
          <Button onClick={onClear}>清空</Button>
          <Button onClick={onExplain}>解释代码</Button>
        </div>
      </Card>

      <Card
        size="small"
        title="代码执行结果"
        className="ai-card"
      >
        <div className="result-area">
          {codeExecutionLoading && !codeExecutionResult && (
            <div className="result-placeholder">
              <span className="loading" />
              <span>{codeLoadingText}</span>
            </div>
          )}
          {!codeExecutionLoading && codeExecutionResult && (
            <pre className="result-pre">{codeExecutionResult}</pre>
          )}
          {!codeExecutionLoading && !codeExecutionResult && (
            <div className="result-pre">// 代码执行结果将显示在这里</div>
          )}
        </div>
      </Card>
    </>
  );
};
