/**
 * @description AI 助手 DevTools 面板主应用组件
 */
import React from 'react';
import { Tabs } from 'antd';
import { useAIAssistant } from './hooks/useAIAssistant';
import { TABS } from './types';
import { NotificationStack } from './components/NotificationStack';
import { ChatTab } from './components/ChatTab';
import { CodeTab } from './components/CodeTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { HelpTab } from './components/HelpTab';
import './styles/panel.scss';

export const PanelApp: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    notifications,
    instructionInput,
    setInstructionInput,
    executionResult,
    executionError,
    executionLoading,
    generatedCode,
    codeInput,
    setCodeInput,
    codeExecutionResult,
    codeExecutionLoading,
    codeLoadingText,
    chatHistory,
    settingsForm,
    setSettingsForm,
    modelPresets,
    selectedPresetId,
    setSelectedPresetId,
    presetName,
    setPresetName,
    executionSettings,
    setExecutionSettings,
    handleInstructionKeydown,
    executeNaturalLanguageCommand,
    clearInstruction,
    saveCurrentInstruction,
    runCode,
    clearCodeOutput,
    explainCode,
    clearChatHistory,
    clearDeepSeekSession,
    exportChatHistory,
    saveSettings,
    handlePresetChange,
    saveCurrentAsModelPreset,
    deleteSelectedModelPreset,
    isCustomProviderSelected,
    isBuiltInProviderSelected,
  } = useAIAssistant();

  const tabItems = [
    {
      key: 'chat',
      label: '对话模式',
      children: (
        <ChatTab
          instructionInput={instructionInput}
          setInstructionInput={setInstructionInput}
          executionResult={executionResult}
          executionError={executionError}
          executionLoading={executionLoading}
          generatedCode={generatedCode}
          showGeneratedCode={executionSettings.showGeneratedCode}
          onKeyDown={handleInstructionKeydown}
          onExecute={() => void executeNaturalLanguageCommand()}
          onClear={clearInstruction}
          onSave={saveCurrentInstruction}
        />
      ),
    },
    {
      key: 'code',
      label: '代码模式',
      children: (
        <CodeTab
          codeInput={codeInput}
          setCodeInput={setCodeInput}
          codeExecutionResult={codeExecutionResult}
          codeExecutionLoading={codeExecutionLoading}
          codeLoadingText={codeLoadingText}
          onRun={() => void runCode(undefined)}
          onClear={clearCodeOutput}
          onExplain={() => void explainCode()}
        />
      ),
    },
    {
      key: 'history',
      label: '历史记录',
      children: (
        <HistoryTab
          chatHistory={chatHistory}
          onClearHistory={clearChatHistory}
          onClearSession={() => void clearDeepSeekSession()}
          onExport={exportChatHistory}
        />
      ),
    },
    {
      key: 'settings',
      label: '设置',
      children: (
        <SettingsTab
          settingsForm={settingsForm}
          setSettingsForm={setSettingsForm}
          modelPresets={modelPresets}
          selectedPresetId={selectedPresetId}
          setSelectedPresetId={setSelectedPresetId}
          presetName={presetName}
          setPresetName={setPresetName}
          executionSettings={executionSettings}
          setExecutionSettings={setExecutionSettings}
          isCustomProviderSelected={isCustomProviderSelected}
          isBuiltInProviderSelected={isBuiltInProviderSelected}
          onSaveSettings={saveSettings}
          onPresetChange={handlePresetChange}
          onSavePreset={saveCurrentAsModelPreset}
          onDeletePreset={deleteSelectedModelPreset}
        />
      ),
    },
    {
      key: 'help',
      label: '帮助',
      children: <HelpTab />,
    },
  ];

  return (
    <div className="container">
      <NotificationStack notifications={notifications} />

      <div className="header">
        <h1>AI助手</h1>
        <div className="version">v1.1.0</div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as any)}
        items={tabItems}
        className="ai-tabs"
      />

      <div className="footer">
        AI助手 v1.1.0 | 通过自然语言指令操控浏览器的智能助手
      </div>
    </div>
  );
};

export default PanelApp;
