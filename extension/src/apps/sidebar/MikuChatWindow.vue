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
          <div
            class="music-player"
            role="group"
            aria-label="Miku 音乐播放器"
          >
            <button
              v-for="control in musicControls"
              :key="control.action"
              type="button"
              class="music-control-button"
              :class="{ 'is-primary': control.action === 'toggle' }"
              :aria-label="control.label"
              :aria-pressed="control.action === 'toggle' ? isMusicPlaying : undefined"
              @click="handleMusicControl(control.action)"
            >
              <component :is="control.icon" aria-hidden="true" />
            </button>
          </div>

          <div
            class="music-disc"
            :class="{ 'is-playing': isMusicPlaying }"
            aria-hidden="true"
          >
            <span class="disc-ring"></span>
            <span class="disc-label"></span>
            <span class="disc-hole"></span>
          </div>

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
import { computed, ref } from 'vue';
import { Draggable } from '@components/index';
import {
  IconNextMusic,
  IconPause,
  IconPlay,
  IconPreviousMusic
} from '@icons/index';
import AIConversation from '../floatingball/views/AIConversation.vue';

defineEmits<{
  close: [];
}>();

const mikuSrc = chrome.runtime.getURL('static/img/miku.png');
const isMusicPlaying = ref(false);

const draggableContainerStyle = computed<Record<string, string>>(() => ({
  '--z-index': '10000',
  cursor: 'default'
}));

type MusicControlAction = 'previous' | 'toggle' | 'next';

const musicControls = computed(() => [
  {
    action: 'previous' as const,
    label: '上一首',
    icon: IconPreviousMusic
  },
  {
    action: 'toggle' as const,
    label: isMusicPlaying.value ? '暂停' : '播放',
    icon: isMusicPlaying.value ? IconPause : IconPlay
  },
  {
    action: 'next' as const,
    label: '下一首',
    icon: IconNextMusic
  }
]);

const handleMusicControl = (action: MusicControlAction) => {
  if (action === 'toggle') {
    isMusicPlaying.value = !isMusicPlaying.value;
  }
};

const mikuSystemPrompt = [
  '你正在进行角色扮演：你是初音未来风格的虚拟歌姬 Miku，在一个安静、温暖的酒馆式对话窗口里和用户聊天。',
  '用中文为主回应，语气轻快、亲切、有一点舞台感，但不要过度卖萌，不要刷屏。',
  '你可以谈音乐、创作、日常陪伴、学习和编程想法；当用户需要严肃帮助时，保持清晰、实用、可靠。',
  '不要声称自己是真实人物或真人偶像；你是一个由 AI 模拟的角色。',
  '回答尽量自然，短句优先。需要步骤时用简洁列表。'
].join('\n');

const mikuRoles = [
  {
    value: 'hatsune_miku_tavern',
    label: 'Hatsune Miku',
    avatar: 'MK',
    systemPrompt: mikuSystemPrompt
  }
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

.music-player {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(94, 234, 212, 0.2);
  border-radius: 8px;
  background: rgba(3, 7, 18, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 14px 26px rgba(2, 6, 23, 0.22);
  backdrop-filter: blur(12px);
}

.music-control-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  aspect-ratio: 1;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #5eead4;
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
}

.music-control-button:hover,
.music-control-button:focus-visible {
  color: rgba(236, 254, 255, 0.96);
  background: rgba(94, 234, 212, 0.16);
  box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.1);
}

.music-control-button:focus-visible {
  outline: 0;
}

.music-control-button.is-primary {
  background: rgba(94, 234, 212, 0.18);
  color: rgba(236, 254, 255, 0.98);
  box-shadow: inset 0 0 0 1px rgba(94, 234, 212, 0.22);
}

.music-control-button :deep(svg) {
  width: 18px;
  height: 18px;
}

.music-disc {
  position: absolute;
  top: 92px;
  left: 50%;
  z-index: 0;
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border-radius: 999px;
  background:
    radial-gradient(circle at center, rgba(3, 7, 18, 0.98) 0 9px, transparent 10px),
    conic-gradient(
      from 18deg,
      rgba(236, 254, 255, 0.22),
      rgba(34, 211, 238, 0.14),
      rgba(15, 23, 42, 0.88),
      rgba(94, 234, 212, 0.24),
      rgba(236, 254, 255, 0.2)
    );
  box-shadow:
    0 16px 28px rgba(2, 6, 23, 0.34),
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    inset 0 0 22px rgba(3, 7, 18, 0.84);
  opacity: 0.9;
  transform: translateX(-50%);
  animation: miku-disc-spin 3.8s linear infinite;
  animation-play-state: paused;
}

.music-disc.is-playing {
  animation-play-state: running;
}

.music-disc::before,
.music-disc::after {
  content: "";
  position: absolute;
  border-radius: inherit;
  pointer-events: none;
}

.music-disc::before {
  inset: 8px;
  border: 1px solid rgba(94, 234, 212, 0.18);
  box-shadow:
    inset 0 0 0 12px rgba(255, 255, 255, 0.025),
    inset 0 0 0 24px rgba(255, 255, 255, 0.018);
}

.music-disc::after {
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 8%,
    rgba(255, 255, 255, 0.2) 18%,
    transparent 30%
  );
  mix-blend-mode: screen;
}

.disc-ring {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(94, 234, 212, 0.16);
  box-shadow:
    inset 0 0 0 1px rgba(94, 234, 212, 0.28),
    0 0 18px rgba(94, 234, 212, 0.18);
}

.disc-label,
.disc-hole {
  position: absolute;
  border-radius: 999px;
}

.disc-label {
  width: 28px;
  height: 28px;
  background:
    radial-gradient(circle, rgba(236, 254, 255, 0.82) 0 2px, transparent 3px),
    linear-gradient(135deg, rgba(34, 211, 238, 0.9), rgba(20, 184, 166, 0.76));
  box-shadow: inset 0 0 0 1px rgba(236, 254, 255, 0.26);
}

.disc-hole {
  width: 7px;
  height: 7px;
  background: rgba(3, 7, 18, 0.9);
}

@keyframes miku-disc-spin {
  from {
    transform: translateX(-50%) rotate(0deg);
  }

  to {
    transform: translateX(-50%) rotate(360deg);
  }
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
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    padding: 14px 78px 14px 14px;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .music-player {
    position: static;
    width: min(180px, 100%);
    max-width: 180px;
    padding: 7px;
  }

  .music-control-button :deep(svg) {
    width: 16px;
    height: 16px;
  }

  .music-disc {
    position: static;
    width: 58px;
    height: 58px;
    transform: none;
    animation: miku-disc-spin-mobile 3.8s linear infinite;
    animation-play-state: paused;
  }

  .music-disc.is-playing {
    animation-play-state: running;
  }

  .disc-ring {
    width: 24px;
    height: 24px;
  }

  .disc-label {
    width: 18px;
    height: 18px;
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
  .close-button,
  .music-control-button {
    transition-duration: 0.01ms;
  }

  .music-disc {
    animation: none;
  }
}

@keyframes miku-disc-spin-mobile {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
