/**
 * AIConversationPlaceholder - AIConversation 占位组件
 *
 * TODO: 此组件是临时占位实现，用于替代 floatingball/views/AIConversation.vue
 * 后续应将 AIConversation.vue 完整迁移到 React 并替换此文件。
 *
 * 保留与原组件相同的 Props 接口，方便后续无缝替换。
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React from "react";

/** 角色选项 */
export interface AIRole {
  value: string;
  label: string;
  avatar: string;
  systemPrompt: string;
}

/** AIConversationPlaceholder Props（与原 AIConversation.vue 保持一致） */
export interface AIConversationPlaceholderProps {
  className?: string;
  title?: string;
  welcomeTitle?: string;
  welcomeMessage?: string;
  welcomeIcon?: string;
  userIcon?: string;
  aiIcon?: string;
  typingMessage?: string;
  inputPlaceholder?: string;
  sendButtonText?: string;
  inputHint?: string;
  defaultRole?: string;
  showToolbar?: boolean;
  roleOptions?: AIRole[];
}

/**
 * 占位组件：仅展示欢迎信息和迁移提示，不实现实际对话功能
 */
const AIConversationPlaceholder: React.FC<AIConversationPlaceholderProps> = ({
  className,
  welcomeTitle = "AI 对话",
  welcomeMessage = "",
  defaultRole,
  roleOptions = [],
}) => {
  const currentRole = roleOptions.find((r) => r.value === defaultRole);

  return (
    <div className={`ai-conversation-placeholder ${className || ""}`}>
      <span className="placeholder-kicker">AI CONSOLE</span>
      <h4 className="placeholder-title">{welcomeTitle}</h4>
      {welcomeMessage && <p className="placeholder-hint">{welcomeMessage}</p>}
      <p className="placeholder-hint">
        {currentRole
          ? `当前角色：${currentRole.label}（待迁移完整对话能力）`
          : "对话能力待迁移"}
      </p>
    </div>
  );
};

export default AIConversationPlaceholder;
