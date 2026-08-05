/**
 * @description 设置 Tab 组件
 */
import React from 'react';
import { Card, Input, Select, Button, Checkbox } from 'antd';
import type {
  AIModelSettingsForm,
  AIModelPreset,
  ExecutionSettings,
  ProviderSelectValue,
} from '../types';
import { PROVIDER_OPTIONS } from '../types';

interface SettingsTabProps {
  settingsForm: AIModelSettingsForm;
  setSettingsForm: React.Dispatch<React.SetStateAction<AIModelSettingsForm>>;
  modelPresets: AIModelPreset[];
  selectedPresetId: string;
  setSelectedPresetId: (id: string) => void;
  presetName: string;
  setPresetName: (name: string) => void;
  executionSettings: ExecutionSettings;
  setExecutionSettings: React.Dispatch<React.SetStateAction<ExecutionSettings>>;
  isCustomProviderSelected: boolean;
  isBuiltInProviderSelected: boolean;
  onSaveSettings: () => void;
  onPresetChange: () => void;
  onSavePreset: () => void;
  onDeletePreset: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settingsForm,
  setSettingsForm,
  modelPresets,
  selectedPresetId,
  setSelectedPresetId,
  presetName,
  setPresetName,
  executionSettings,
  setExecutionSettings,
  isCustomProviderSelected,
  isBuiltInProviderSelected,
  onSaveSettings,
  onPresetChange,
  onSavePreset,
  onDeletePreset,
}) => {
  const handleProviderChange = (value: ProviderSelectValue): void => {
    setSettingsForm((prev) => ({ ...prev, providerSelect: value }));
    if (value === 'default') {
      setSettingsForm((prev) => ({ ...prev, modelId: 'deepseek-chat' }));
    }
  };

  return (
    <>
      {/* AI 模型配置 */}
      <Card size="small" title="AI模型配置" className="ai-card">
        <div className="form-group">
          <label htmlFor="model-preset-select">预设配置</label>
          <div className="inline-fields">
            <Select
              id="model-preset-select"
              value={selectedPresetId}
              onChange={(value) => {
                setSelectedPresetId(value);
                onPresetChange();
              }}
              style={{ flex: 1, minWidth: 220 }}
            >
              <Select.Option value="">当前使用手动配置</Select.Option>
              {modelPresets.map((preset) => (
                <Select.Option key={preset.id} value={preset.id}>
                  {preset.name}
                </Select.Option>
              ))}
            </Select>
            <Button onClick={onDeletePreset}>删除预设</Button>
          </div>
          <div className="form-hint">选择预设后会立即切换当前模型配置。</div>
        </div>

        <div className="form-group">
          <label htmlFor="preset-name">保存为预设</label>
          <div className="inline-fields">
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="输入预设名称，例如：OpenAI GPT-4.1"
              style={{ flex: 1, minWidth: 220 }}
            />
            <Button onClick={onSavePreset}>保存预设</Button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="provider-select">模型提供商</label>
          <div className="inline-fields">
            <Select
              id="provider-select"
              value={settingsForm.providerSelect}
              onChange={handleProviderChange}
              style={{ flex: 1, minWidth: 220 }}
            >
              {PROVIDER_OPTIONS.map((provider) => (
                <Select.Option key={provider.value} value={provider.value}>
                  {provider.label}
                </Select.Option>
              ))}
            </Select>
            {isCustomProviderSelected && (
              <Input
                value={settingsForm.customProvider}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    customProvider: e.target.value,
                  }))
                }
                placeholder="自定义提供商名称"
                style={{ flex: 1, minWidth: 220 }}
              />
            )}
          </div>
          {isBuiltInProviderSelected && (
            <div className="form-hint">
              内置模式会直接走扩展默认的 DeepSeek 链路，固定使用 `deepseek-chat`，无需填写 API 信息。
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="model-id">模型ID</label>
          <Input
            id="model-id"
            value={settingsForm.modelId}
            onChange={(e) =>
              setSettingsForm((prev) => ({ ...prev, modelId: e.target.value }))
            }
            disabled={isBuiltInProviderSelected}
            placeholder="输入模型ID，例如：gpt-4, claude-3-opus-20240229, gemini-pro"
          />
        </div>

        <div className="form-group">
          <label htmlFor="api-base-url">API基础URL</label>
          <Input
            id="api-base-url"
            value={settingsForm.apiBaseUrl}
            onChange={(e) =>
              setSettingsForm((prev) => ({ ...prev, apiBaseUrl: e.target.value }))
            }
            disabled={isBuiltInProviderSelected}
            placeholder="输入API基础URL，例如：https://api.openai.com/v1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="api-key">API密钥</label>
          <Input.Password
            id="api-key"
            value={settingsForm.apiKey}
            onChange={(e) =>
              setSettingsForm((prev) => ({ ...prev, apiKey: e.target.value }))
            }
            disabled={isBuiltInProviderSelected}
            placeholder="输入API密钥"
          />
        </div>

        <Button type="primary" onClick={onSaveSettings}>
          保存设置
        </Button>
      </Card>

      {/* 执行设置 */}
      <Card size="small" title="执行设置" className="ai-card">
        <div className="form-group">
          <label htmlFor="execution-mode">执行模式</label>
          <Select
            id="execution-mode"
            value={executionSettings.executionMode}
            onChange={(value) =>
              setExecutionSettings((prev) => ({
                ...prev,
                executionMode: value,
              }))
            }
          >
            <Select.Option value="auto">自动执行</Select.Option>
            <Select.Option value="preview">预览代码后执行</Select.Option>
            <Select.Option value="manual">手动复制执行</Select.Option>
          </Select>
        </div>

        <div className="form-group">
          <Checkbox
            checked={executionSettings.showGeneratedCode}
            onChange={(e) =>
              setExecutionSettings((prev) => ({
                ...prev,
                showGeneratedCode: e.target.checked,
              }))
            }
          >
            显示生成的代码
          </Checkbox>
        </div>

        <div className="form-group">
          <Checkbox
            checked={executionSettings.saveHistory}
            onChange={(e) =>
              setExecutionSettings((prev) => ({
                ...prev,
                saveHistory: e.target.checked,
              }))
            }
          >
            保存执行历史
          </Checkbox>
        </div>
      </Card>
    </>
  );
};
