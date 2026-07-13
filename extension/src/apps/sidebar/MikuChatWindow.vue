<template>
  <Draggable
    initial-position="right"
    :adsorb-margin="112"
    :enable-adsorption="false"
    :can-overflow="false"
    drag-handle=".dialog-header"
    :container-style="draggableContainerStyle"
  >
    <div
      class="miku-chat-window"
      role="dialog"
      aria-modal="false"
      aria-label="Miku 角色对话"
    >
      <div class="chat-stage">
        <div class="character-panel">
          <img
            :src="mikuSrc"
            alt=""
            aria-hidden="true"
            class="character-image"
          />
          <div class="character-status">
            <span class="status-light"></span>
            <span>MIKU ONLINE</span>
          </div>
        </div>

        <section class="dialog-panel">
          <header class="dialog-header">
            <div class="dialog-title-group">
              <span class="dialog-kicker">TAVERN ROLE CHAT</span>
              <h3>Hatsune Miku</h3>
            </div>

            <button
              type="button"
              class="close-button"
              aria-label="关闭 Miku 对话"
              @click="$emit('close')"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M5 5L15 15M15 5L5 15"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="1.7"
                />
              </svg>
            </button>
          </header>

          <AIConversation
            class="miku-conversation"
            title="Miku"
            welcome-title="今晚想聊点什么？"
            welcome-message="这里是 Miku 的小酒馆席位。告诉她你的想法、歌词灵感、代码烦恼或日常碎碎念。"
            welcome-icon="MK"
            user-icon="YOU"
            ai-icon="MK"
            typing-message="Miku 正在组织语言..."
            input-placeholder="和 Miku 说点什么..."
            send-button-text="发送"
            input-hint="Enter 发送，Shift + Enter 换行。"
            default-role="hatsune_miku_tavern"
            :show-toolbar="false"
            :role-options="mikuRoles"
          />
        </section>
      </div>
    </div>
  </Draggable>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Draggable } from "@components/index";
import AIConversation from "../floatingball/views/AIConversation.vue";

defineEmits<{
  close: [];
}>();

const mikuSrc = chrome.runtime.getURL("static/img/miku.png");

const draggableContainerStyle = computed<Record<string, string>>(() => ({
  "--z-index": "10000",
  cursor: "default",
}));

const mikuSystemPrompt = [
  "你正在进行角色扮演：你是初音未来风格的虚拟歌姬 Miku，在一个安静、温暖的酒馆式对话窗口里和用户聊天。",
  "用中文为主回应，语气轻快、亲切、有一点舞台感，但不要过度卖萌，不要刷屏。",
  "你可以谈音乐、创作、日常陪伴、学习和编程想法；当用户需要严肃帮助时，保持清晰、实用、可靠。",
  "不要声称自己是真实人物或真人偶像；你是一个由 AI 模拟的角色。",
  "回答尽量自然，短句优先。需要步骤时用简洁列表。",
].join("\n");

const mikuRoles = [
  {
    value: "hatsune_miku_tavern",
    label: "Hatsune Miku",
    avatar: "MK",
    systemPrompt: mikuSystemPrompt,
  },
];
</script>

<style scoped lang="scss">
.miku-chat-window {
  width: min(720px, calc(100vw - 32px));
  height: min(620px, calc(100vh - 48px));
  color: rgba(248, 251, 255, 0.94);
  font-family: "Noto Sans JP", "SF Pro Text", "Segoe UI", sans-serif;
  cursor: default;
}

.chat-stage {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(130, 220, 255, 0.28);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(16, 24, 38, 0.94), rgba(31, 40, 57, 0.92)),
    rgba(9, 14, 24, 0.94);
  box-shadow:
    0 24px 72px rgba(2, 6, 23, 0.44),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
}

.character-panel {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  padding: 18px 12px 54px;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 45% 22%,
      rgba(90, 230, 224, 0.22),
      transparent 34%
    ),
    linear-gradient(180deg, rgba(15, 118, 110, 0.2), rgba(15, 23, 42, 0.28));
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.character-panel::before {
  content: "";
  position: absolute;
  inset: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  pointer-events: none;
}

.character-image {
  position: relative;
  display: block;
  width: 160px;
  height: 300px;
  object-fit: contain;
  filter: drop-shadow(0 18px 26px rgba(0, 0, 0, 0.34));
  user-select: none;
  -webkit-user-drag: none;
}

.character-status {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 28px;
  border-radius: 6px;
  background: rgba(3, 7, 18, 0.42);
  color: rgba(236, 254, 255, 0.84);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.status-light {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #5eead4;
  box-shadow: 0 0 12px rgba(94, 234, 212, 0.72);
}

.dialog-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 14px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  cursor: grab;
  user-select: none;
}

.dialog-header:active {
  cursor: grabbing;
}

.dialog-title-group {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.dialog-kicker {
  color: rgba(125, 211, 252, 0.72);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.dialog-title-group h3 {
  margin: 0;
  color: rgba(248, 251, 255, 0.96);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}

.close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.66);
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
}

.close-button:hover,
.close-button:focus-visible {
  color: rgba(255, 255, 255, 0.94);
  background: rgba(248, 113, 113, 0.16);
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.1);
}

.close-button svg {
  width: 18px;
  height: 18px;
}

.miku-conversation {
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 0;
  padding-top: 12px;
}

@media (max-width: 680px) {
  .miku-chat-window {
    width: calc(100vw - 24px);
    height: min(680px, calc(100vh - 24px));
  }

  .chat-stage {
    grid-template-columns: 1fr;
  }

  .character-panel {
    min-height: 132px;
    align-items: center;
    padding: 14px 78px 14px 14px;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .character-image {
    position: absolute;
    right: 10px;
    bottom: -18px;
    width: 100px;
    height: 170px;
  }

  .character-status {
    position: static;
    max-width: 180px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .close-button {
    transition-duration: 0.01ms;
  }
}
</style>
