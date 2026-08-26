/**
 * MikuChatWindow - Miku 角色对话窗口（React 版）
 *
 * 从 MikuChatWindow.vue 迁移而来。
 *
 * 关键变更：
 * - defineEmits('close') → props.onClose
 * - ref → useState
 * - computed → useMemo
 * - Draggable 从 Vue 版 @components/index → React 版 @/assets/components/react-index
 * - IconPreviousMusic/IconPlay/IconPause/IconNextMusic (?component svg)
 *   → Ant Design 图标（StepBackwardOutlined / CaretRightOutlined / PauseOutlined / StepForwardOutlined）
 * - AIConversation (Vue 组件, 1474 行) → AIConversationPlaceholder 占位组件
 *   TODO: 后续将 AIConversation.vue 完整迁移到 React 后替换占位组件
 *
 * 保留的特性：
 * - 音乐播放器三按钮（上一首/播放暂停/下一首）
 * - 播放时旋转光盘动画
 * - 可拖拽窗口（通过 .dialog-header 拖拽）
 * - 关闭按钮回调
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, { useState, useMemo, useCallback } from "react";
import {
  StepBackwardOutlined,
  StepForwardOutlined,
  CaretRightOutlined,
  PauseOutlined,
} from "@ant-design/icons";
import { Draggable } from "@/assets/components/react-index";
import AIConversationPlaceholder from "./components/AIConversationPlaceholder";
import type { AIRole } from "./components/AIConversationPlaceholder";
import "./styles/miku-chat-window.scss";

/** MikuChatWindow Props */
export interface MikuChatWindowProps {
  /** 关闭窗口回调 */
  onClose?: () => void;
}

/** 音乐控制动作类型 */
type MusicControlAction = "previous" | "toggle" | "next";

/** 音乐控制按钮配置 */
interface MusicControlConfig {
  action: MusicControlAction;
  label: string;
  isPrimary: boolean;
  icon: React.ReactNode;
}

/** Miku 角色系统提示词（与原 Vue 版保持一致） */
const MIKU_SYSTEM_PROMPT = [
  "你正在进行角色扮演：你是初音未来风格的虚拟歌姬 Miku，在一个安静、温暖的酒馆式对话窗口里和用户聊天。",
  "用中文为主回应，语气轻快、亲切、有一点舞台感，但不要过度卖萌，不要刷屏。",
  "你可以谈音乐、创作、日常陪伴、学习和编程想法；当用户需要严肃帮助时，保持清晰、实用、可靠。",
  "不要声称自己是真实人物或真人偶像；你是一个由 AI 模拟的角色。",
  "回答尽量自然，短句优先。需要步骤时用简洁列表。",
].join("\n");

/** Miku 角色选项 */
const MIKU_ROLES: AIRole[] = [
  {
    value: "hatsune_miku_tavern",
    label: "Hatsune Miku",
    avatar: "MK",
    systemPrompt: MIKU_SYSTEM_PROMPT,
  },
];

/**
 * Miku 角色对话窗口组件
 * - 左侧角色面板：音乐播放器 + 旋转光盘 + Miku 图片 + 状态栏
 * - 右侧对话面板：标题栏 + AIConversation 占位组件
 * - 整个窗口可拖拽（通过 .dialog-header）
 */
const MikuChatWindow: React.FC<MikuChatWindowProps> = ({ onClose }) => {
  // 默认自动播放
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);

  // Miku 图片资源
  const mikuSrc = chrome.runtime.getURL("static/imgs/miku.png");

  // Draggable 容器样式
  const draggableContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      ["--z-index" as string]: "10000",
      cursor: "default",
    }),
    [],
  );

  // 音乐控制按钮配置（根据播放状态动态切换图标和文案）
  const musicControls = useMemo<MusicControlConfig[]>(() => {
    return [
      {
        action: "previous",
        label: "上一首",
        isPrimary: false,
        icon: <StepBackwardOutlined />,
      },
      {
        action: "toggle",
        label: isMusicPlaying ? "暂停" : "播放",
        isPrimary: true,
        icon: isMusicPlaying ? <PauseOutlined /> : <CaretRightOutlined />,
      },
      {
        action: "next",
        label: "下一首",
        isPrimary: false,
        icon: <StepForwardOutlined />,
      },
    ];
  }, [isMusicPlaying]);

  // 处理音乐控制按钮点击
  // 依赖空：setIsMusicPlaying 是 setState 函数，引用稳定，无需放入依赖列表
  const handleMusicControl = useCallback((action: MusicControlAction) => {
    if (action === "toggle") {
      setIsMusicPlaying((prev) => !prev);
    }
    // previous / next 暂无实际音频逻辑，仅切换状态
  }, []);

  return (
    <Draggable
      initialPosition="right"
      adsorbMargin={112}
      enableAdsorption={false}
      canOverflow={false}
      dragHandle=".dialog-header"
      containerStyle={draggableContainerStyle}
    >
      <div
        className="miku-chat-window"
        role="dialog"
        aria-modal="false"
        aria-label="Miku 角色对话"
      >
        <div className="chat-stage">
          <div className="character-panel">
            {/* 音乐播放器 */}
            <div
              className="music-player"
              role="group"
              aria-label="Miku 音乐播放器"
            >
              {musicControls.map((control) => (
                <button
                  key={control.action}
                  type="button"
                  className={`music-control-button ${
                    control.isPrimary ? "is-primary" : ""
                  }`}
                  aria-label={control.label}
                  aria-pressed={
                    control.action === "toggle" ? isMusicPlaying : undefined
                  }
                  onClick={() => handleMusicControl(control.action)}
                >
                  {control.icon}
                </button>
              ))}
            </div>

            {/* 旋转光盘 */}
            <div
              className={`music-disc ${isMusicPlaying ? "is-playing" : ""}`}
              aria-hidden="true"
            >
              <span className="disc-ring"></span>
              <span className="disc-label"></span>
              <span className="disc-hole"></span>
            </div>

            {/* Miku 角色图片 */}
            <img
              src={mikuSrc}
              alt=""
              aria-hidden="true"
              className="character-image"
            />

            {/* 状态栏 */}
            <div className="character-status">
              <span className="status-light"></span>
              <span>MIKU ONLINE</span>
            </div>
          </div>

          <section className="dialog-panel">
            {/* 标题栏（可拖拽区域） */}
            <header className="dialog-header">
              <div className="dialog-title-group">
                <span className="dialog-kicker">TAVERN ROLE CHAT</span>
                <h3>Hatsune Miku</h3>
              </div>

              <button
                type="button"
                className="close-button"
                aria-label="关闭 Miku 对话"
                onClick={onClose}
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.7"
                  />
                </svg>
              </button>
            </header>

            {/* AIConversation 占位组件 */}
            <AIConversationPlaceholder
              className="miku-conversation"
              title="Miku"
              welcomeTitle="今晚想聊点什么？"
              welcomeMessage="这里是 Miku 的小酒馆席位。告诉她你的想法、歌词灵感、代码烦恼或日常碎碎念。"
              welcomeIcon="MK"
              userIcon="YOU"
              aiIcon="MK"
              typingMessage="Miku 正在组织语言..."
              inputPlaceholder="和 Miku 说点什么..."
              sendButtonText="发送"
              inputHint="Enter 发送，Shift + Enter 换行。"
              defaultRole="hatsune_miku_tavern"
              showToolbar={false}
              roleOptions={MIKU_ROLES}
            />
          </section>
        </div>
      </div>
    </Draggable>
  );
};

export default MikuChatWindow;
