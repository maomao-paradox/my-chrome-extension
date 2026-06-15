<template>
    <div v-if="visible" class="control-panel-wrapper">
        <div class="mask" @click="close"></div>

        <Draggable :initial-position="'center'" :enable-adsorption="false" :drag-handle="'.drag-area'"
            :container-style="draggableContainerStyle" ref="draggableRef">
            <div
                :class="['ma-collapse-container', { 'is-fullscreen': isFullscreen, 'is-transitioning': isFullscreenTransitioning }]">
                <div class="drag-area">
                    <div class="title-shell">
                        <div class="title-emblem">
                            <span class="title-emblem-core"></span>
                        </div>
                        <div class="title-copy">
                            <div class="title-eyebrow">FLOATING CONSOLE</div>
                            <div class="title-line">
                                <div class="title-wrapper">{{ props.title }}</div>
                                <div class="title-subtitle">
                                    AI Chat 与 Skills (MCP开发中)
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="header-actions">
                        <div class="header-pills">
                            <button v-for="(panel, index) in panelMeta" :key="panel.key" type="button"
                                :class="['header-pill', { 'is-active': activePanel === index }]" :title="panel.label"
                                :aria-label="panel.label" @click.stop="togglePanel(index)">
                                <span class="pill-code">{{ panel.code }}</span>
                                <span class="pill-label">{{ panel.label }}</span>
                            </button>
                        </div>

                        <div class="top-buttons">
                            <el-button type="text" size="small" :disabled="isFullscreenTransitioning"
                                @click.stop="toggleFullscreen"
                                :class="['fullscreen-btn', { 'is-busy': isFullscreenTransitioning }]">
                                <IconFullScreen v-if="!isFullscreen" />
                                <IconOffScreen v-else />
                            </el-button>
                            <el-button type="text" size="small" @click.stop="close" class="close-btn">
                                <IconClose />
                            </el-button>
                        </div>
                    </div>
                </div>

                <div class="push-panel-container">
                    <div :class="['push-panel', 'panel-ai', { active: activePanel === 0, collapsed: activePanel !== 0 }]"
                        @click="togglePanel(0)">
                        <div class="panel-surface">
                            <div v-show="activePanel === 0" class="panel-content">
                                <AIConversation />
                            </div>

                            <div v-show="activePanel !== 0" class="panel-handle">
                                <span class="handle-code">{{ panelMeta[0].code }}</span>
                                <span class="handle-label">{{ panelMeta[0].shortLabel }}</span>
                            </div>
                        </div>
                    </div>

                    <div :class="['push-panel', 'panel-tools', { active: activePanel === 1, collapsed: activePanel !== 1 }]"
                        @click="togglePanel(1)">
                        <div class="panel-surface">
                            <div v-show="activePanel === 1" class="panel-content">
                                <el-collapse accordion>
                                    <el-collapse-item v-for="item in tools" :key="item.id" :name="item.label">
                                        <template #title="{ isActive }">
                                            <div :class="['item-wrapper', { 'is-active': isActive }]">
                                                <span class="item-title">{{ item.label }}</span>
                                                <span class="item-tag">{{ isActive ? 'OPEN' : 'TOOL' }}</span>
                                            </div>
                                        </template>

                                        <div class="content-row">
                                            <div class="description-text">
                                                {{ item.details || item.label }}
                                            </div>
                                            <el-button type="primary" size="small" @click.stop="handleClick(item)"
                                                class="execute-button">
                                                执行
                                            </el-button>
                                        </div>
                                    </el-collapse-item>
                                </el-collapse>
                            </div>

                            <div v-show="activePanel !== 1" class="panel-handle">
                                <span class="handle-code">{{ panelMeta[1].code }}</span>
                                <span class="handle-label">{{ panelMeta[1].shortLabel }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Draggable>
    </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { Tool } from '@/assets/types';
import AIConversation from './views/AIConversation.vue';
import { Draggable } from '@components/index';
import { IconFullScreen, IconOffScreen, IconClose } from '@icons/index';

interface Props {
    tools: Tool[];
    title: string;
    visible?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    'update:visible': [visible: boolean],
    'click-tool': [item: Tool],
    'close-panel': [],
}>();

const activePanel = ref(0);
const draggableRef = ref<any>(null);
const isFullscreen = ref(false);
const isFullscreenTransitioning = ref(false);
const panelMeta = [
    { key: 'chat', code: 'AI', label: 'AI 对话', shortLabel: 'AI CHAT', description: '页面会话、上下文分析与即时协作' },
    { key: 'skill', code: 'SK', label: '技能列表', shortLabel: 'SKILLS', description: '快速执行悬浮工具与页面动作' },
];
const savedPosition = ref({
    x: 0,
    y: 0,
});
const FULLSCREEN_TRANSITION_MS = 440;
let fullscreenTimer: number | null = null;
let fullscreenAnimationFrame: number | null = null;

const draggableContainerStyle = computed<Record<string, string>>(() => ({
    pointerEvents: isFullscreenTransitioning.value ? 'none' : 'auto',
}));

const clearFullscreenTimer = () => {
    if (fullscreenTimer !== null) {
        window.clearTimeout(fullscreenTimer);
        fullscreenTimer = null;
    }
};

const clearFullscreenAnimation = () => {
    if (fullscreenAnimationFrame !== null) {
        cancelAnimationFrame(fullscreenAnimationFrame);
        fullscreenAnimationFrame = null;
    }
};

const easeInOutCubic = (progress: number) => {
    return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
};

const animateDraggablePosition = (targetX: number, targetY: number) => {
    const draggableApi = draggableRef.value;
    if (!draggableApi?.getCurrentPosition || !draggableApi?.setPositionImmediate) {
        return;
    }

    const startPosition = draggableApi.getCurrentPosition() as { x: number; y: number };
    const deltaX = targetX - startPosition.x;
    const deltaY = targetY - startPosition.y;

    clearFullscreenAnimation();

    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
        draggableApi.setPositionImmediate(targetX, targetY);
        return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
        const rawProgress = Math.min((now - startTime) / FULLSCREEN_TRANSITION_MS, 1);
        const easedProgress = easeInOutCubic(rawProgress);

        draggableApi.setPositionImmediate(
            startPosition.x + deltaX * easedProgress,
            startPosition.y + deltaY * easedProgress,
        );

        if (rawProgress < 1) {
            fullscreenAnimationFrame = requestAnimationFrame(step);
            return;
        }

        draggableApi.setPositionImmediate(targetX, targetY);
        fullscreenAnimationFrame = null;
    };

    fullscreenAnimationFrame = requestAnimationFrame(step);
};

const finishFullscreenTransition = () => {
    clearFullscreenTimer();
    isFullscreenTransitioning.value = false;
};

const scheduleFullscreenTransitionEnd = () => {
    clearFullscreenTimer();
    fullscreenTimer = window.setTimeout(() => {
        finishFullscreenTransition();
    }, FULLSCREEN_TRANSITION_MS + 80);
};

const toggleFullscreen = () => {
    const draggableApi = draggableRef.value;
    if (!draggableApi?.getCurrentPosition) {
        return;
    }

    if (isFullscreenTransitioning.value) {
        return;
    }

    isFullscreenTransitioning.value = true;

    if (!isFullscreen.value) {
        savedPosition.value = draggableApi.getCurrentPosition() as { x: number; y: number };
        isFullscreen.value = true;
        animateDraggablePosition(0, 0);
    } else {
        isFullscreen.value = false;
        animateDraggablePosition(savedPosition.value.x, savedPosition.value.y);
    }

    scheduleFullscreenTransitionEnd();
};

const handleClick = (item: Tool) => {
    emit('click-tool', item);
};

const close = () => {
    emit('close-panel');
    emit('update:visible', false);
};

const togglePanel = (panelIndex: number) => {
    activePanel.value = panelIndex;
};

onUnmounted(() => {
    clearFullscreenTimer();
    clearFullscreenAnimation();
});
</script>

<style scoped>
.control-panel-wrapper {
    position: fixed;
    inset: 0;
    display: flex;
    z-index: 1000;
}

.mask {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 16% 18%, rgba(56, 189, 248, 0.1), transparent 28%),
        radial-gradient(circle at 82% 14%, rgba(245, 158, 11, 0.08), transparent 22%),
        radial-gradient(circle at 70% 82%, rgba(129, 140, 248, 0.08), transparent 24%),
        rgba(4, 8, 18, 0.2);
    backdrop-filter: blur(10px) saturate(120%);
    -webkit-backdrop-filter: blur(10px) saturate(120%);
    z-index: 1001;
}

.ma-collapse-container {
    --panel-text-strong: #f8fbff;
    --panel-text-soft: rgba(216, 227, 242, 0.74);
    width: clamp(860px, 68vw, 1140px);
    height: clamp(520px, 70vh, 780px);
    position: fixed;
    z-index: 1002;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    isolation: isolate;
    color: var(--panel-text-strong);
    border-radius: 20px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
        linear-gradient(160deg, rgba(10, 19, 37, 0.78), rgba(11, 18, 31, 0.58));
    backdrop-filter: blur(22px) saturate(150%);
    -webkit-backdrop-filter: blur(22px) saturate(150%);
    box-shadow:
        0 24px 72px rgba(2, 6, 23, 0.24),
        0 12px 28px rgba(2, 6, 23, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition:
        width 440ms cubic-bezier(0.22, 1, 0.36, 1),
        height 440ms cubic-bezier(0.22, 1, 0.36, 1),
        border-radius 380ms cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 440ms cubic-bezier(0.22, 1, 0.36, 1),
        background 440ms cubic-bezier(0.22, 1, 0.36, 1),
        backdrop-filter 440ms cubic-bezier(0.22, 1, 0.36, 1),
        -webkit-backdrop-filter 440ms cubic-bezier(0.22, 1, 0.36, 1);
    font-family: "Avenir Next", "Segoe UI", sans-serif;
    will-change: width, height, border-radius, box-shadow;
}

.ma-collapse-container.is-fullscreen {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025)),
        linear-gradient(160deg, rgba(8, 15, 30, 0.88), rgba(10, 17, 29, 0.68));
    backdrop-filter: blur(26px) saturate(165%);
    -webkit-backdrop-filter: blur(26px) saturate(165%);
    box-shadow:
        0 18px 56px rgba(2, 6, 23, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.ma-collapse-container.is-transitioning {
    overflow: hidden;
}

.ma-collapse-container::before,
.ma-collapse-container::after {
    content: '';
    position: absolute;
    pointer-events: none;
    filter: blur(10px);
    transition:
        width 440ms cubic-bezier(0.22, 1, 0.36, 1),
        height 440ms cubic-bezier(0.22, 1, 0.36, 1),
        top 440ms cubic-bezier(0.22, 1, 0.36, 1),
        left 440ms cubic-bezier(0.22, 1, 0.36, 1),
        right 440ms cubic-bezier(0.22, 1, 0.36, 1),
        bottom 440ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 320ms ease;
}

.ma-collapse-container::before {
    top: -70px;
    left: -12px;
    width: 220px;
    height: 220px;
    background: radial-gradient(circle, rgba(125, 211, 252, 0.2), transparent 68%);
}

.ma-collapse-container::after {
    right: -48px;
    bottom: -72px;
    width: 240px;
    height: 240px;
    background: radial-gradient(circle, rgba(251, 191, 36, 0.1), transparent 72%);
}

.ma-collapse-container.is-fullscreen::before {
    top: -92px;
    left: -40px;
    width: 320px;
    height: 320px;
    opacity: 0.9;
}

.ma-collapse-container.is-fullscreen::after {
    right: -96px;
    bottom: -128px;
    width: 340px;
    height: 340px;
    opacity: 0.88;
}

:deep(.draggable-container) {
    position: relative;
    width: 100%;
}

.drag-area {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 12px;
    color: var(--panel-text-strong);
    cursor: move;
    user-select: none;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)),
        rgba(6, 11, 22, 0.16);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition:
        padding 440ms cubic-bezier(0.22, 1, 0.36, 1),
        background 320ms ease,
        border-color 320ms ease,
        backdrop-filter 320ms ease,
        -webkit-backdrop-filter 320ms ease;
}

.drag-area:hover {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.015)),
        rgba(6, 11, 22, 0.2);
}

.ma-collapse-container.is-fullscreen .drag-area {
    padding: 18px 20px 14px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.012)),
        rgba(6, 11, 22, 0.24);
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
    border-bottom-color: rgba(255, 255, 255, 0.08);
}

.title-shell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.title-emblem {
    position: relative;
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    border-radius: 12px;
    background:
        linear-gradient(145deg, rgba(125, 211, 252, 0.22), rgba(255, 255, 255, 0.04)),
        rgba(255, 255, 255, 0.04);
    box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.08),
        0 8px 20px rgba(6, 13, 27, 0.14);
}

.title-emblem-core {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, #f8fbff 0%, #7dd3fc 55%, rgba(125, 211, 252, 0.12) 100%);
    box-shadow: 0 0 24px rgba(125, 211, 252, 0.45);
}

.title-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.title-eyebrow {
    font-size: 11px;
    line-height: 1;
    letter-spacing: 0.26em;
    color: rgba(216, 227, 242, 0.58);
}

.title-line {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
    flex-wrap: wrap;
}

.title-wrapper {
    font-size: 20px;
    line-height: 1.1;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: var(--panel-text-strong);
}

.title-subtitle {
    min-width: 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--panel-text-soft);
}

.header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
    margin-left: auto;
}

.header-pills {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
}

.header-pill {
    display: inline-flex;
    align-items: center;
    gap: 0;
    min-height: 36px;
    padding: 4px;
    border: none;
    border-radius: 14px;
    color: var(--panel-text-soft);
    background: rgba(255, 255, 255, 0.035);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: all 0.22s ease;
}

.header-pill:hover {
    color: var(--panel-text-strong);
    background: rgba(125, 211, 252, 0.08);
    transform: translateY(-1px);
}

.header-pill.is-active {
    color: #08111d;
    background: linear-gradient(135deg, rgba(125, 211, 252, 0.96), rgba(251, 191, 36, 0.92));
    box-shadow: 0 10px 24px rgba(125, 211, 252, 0.14);
}

.pill-code {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    background: rgba(255, 255, 255, 0.12);
}

.pill-label {
    max-width: 0;
    overflow: hidden;
    opacity: 0;
    margin-left: 0;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 600;
    transition: max-width 0.22s ease, opacity 0.18s ease, margin-left 0.22s ease;
}

.header-pill:hover .pill-label,
.header-pill.is-active .pill-label {
    max-width: 92px;
    opacity: 1;
    margin-left: 8px;
}

.header-pill.is-active .pill-code {
    background: rgba(255, 255, 255, 0.28);
}

.top-buttons {
    display: flex;
    gap: 8px;
}

.close-btn,
.fullscreen-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: var(--panel-text-soft);
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.035);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    transition: all 0.2s ease;
}

.fullscreen-btn:hover {
    color: var(--panel-text-strong);
    background: rgba(125, 211, 252, 0.12);
    transform: translateY(-1px);
}

.fullscreen-btn.is-busy,
.fullscreen-btn:disabled {
    opacity: 0.72;
    cursor: wait;
    transform: none;
}

.close-btn:hover {
    color: #fff4f4;
    background: rgba(248, 113, 113, 0.12);
    transform: translateY(-1px);
}

.close-btn :deep(.el-icon),
.fullscreen-btn :deep(.el-icon) {
    font-size: 16px;
    font-weight: 700;
}

.push-panel-container {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 10px;
    padding: 10px 12px 12px;
    overflow: hidden;
    transition: padding 440ms cubic-bezier(0.22, 1, 0.36, 1), gap 440ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ma-collapse-container.is-fullscreen .push-panel-container {
    gap: 12px;
    padding: 12px 14px 14px;
}

.push-panel {
    position: relative;
    display: flex;
    flex: 1;
    min-width: 40px;
    max-width: calc(100% - 40px);
    height: 100%;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s ease;
}

.push-panel:hover {
    transform: translateY(-2px);
}

.push-panel.active {
    min-width: 280px;
    cursor: default;
}

.push-panel.collapsed {
    flex: 0 0 40px;
    min-width: 40px;
    max-width: 40px;
}

.panel-surface {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 10px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.012)),
        rgba(255, 255, 255, 0.02);
    box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.05),
        0 16px 36px rgba(2, 6, 23, 0.1);
    transition:
        border-radius 440ms cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 260ms ease,
        background 320ms ease;
}

.push-panel:hover .panel-surface {
    box-shadow:
        inset 0 0 0 1px rgba(125, 211, 252, 0.1),
        0 16px 36px rgba(2, 6, 23, 0.12);
}

.push-panel.active .panel-surface {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.012)),
        rgba(9, 17, 31, 0.16);
}

.panel-ai.active .panel-surface {
    box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.06),
        0 18px 40px rgba(56, 189, 248, 0.08);
}

.panel-tools.active .panel-surface {
    box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.06),
        0 18px 40px rgba(251, 191, 36, 0.08);
}

.panel-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 12px 12px 10px;
    overflow: hidden;
    transition: padding 440ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ma-collapse-container.is-fullscreen .panel-content {
    padding: 14px 14px 12px;
}

.panel-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 32px;
    padding: 0 2px 10px;
    min-width: 0;
}

.badge-code {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: #08111d;
    background: linear-gradient(135deg, rgba(125, 211, 252, 0.96), rgba(251, 191, 36, 0.9));
}

.badge-title {
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--panel-text-strong);
}

.badge-description {
    min-width: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--panel-text-soft);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.panel-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.02);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.035);
    transition:
        border-radius 440ms cubic-bezier(0.22, 1, 0.36, 1),
        background 320ms ease,
        box-shadow 320ms ease;
}

.ma-collapse-container.is-fullscreen .panel-body {
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.024);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.042);
}

.panel-body-fill {
    display: flex;
    flex-direction: column;
}

.panel-body-scroll {
    overflow: auto;
}

.tools-panel-body {
    padding: 8px;
}

.panel-handle {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 14px 0;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015)),
        rgba(8, 14, 26, 0.18);
    transition:
        background 320ms ease,
        padding 440ms cubic-bezier(0.22, 1, 0.36, 1),
        gap 440ms cubic-bezier(0.22, 1, 0.36, 1);
}

.push-panel.collapsed:hover .panel-handle {
    background:
        linear-gradient(180deg, rgba(125, 211, 252, 0.12), rgba(255, 255, 255, 0.025)),
        rgba(8, 14, 26, 0.24);
}

.handle-code {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 25px;
    height: 25px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: #08111d;
    background: linear-gradient(135deg, rgba(125, 211, 252, 0.96), rgba(251, 191, 36, 0.9));
}

.handle-label {
    font-size: 11px;
    letter-spacing: 0.22em;
    color: rgba(216, 227, 242, 0.62);
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    opacity: 0.76;
    transition: opacity 0.2s ease, color 0.2s ease;
}

.push-panel.collapsed:hover .handle-label {
    color: rgba(216, 227, 242, 0.84);
    opacity: 1;
}

.item-wrapper {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--panel-text-strong);
}

.item-title {
    min-width: 0;
}

.item-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: rgba(216, 227, 242, 0.78);
    background: rgba(255, 255, 255, 0.05);
}

.item-wrapper.is-active .item-tag {
    color: #08111d;
    background: linear-gradient(135deg, rgba(125, 211, 252, 0.96), rgba(251, 191, 36, 0.9));
}

.content-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin: 2px 0 0;
    padding: 0 14px 14px;
    flex-wrap: wrap;
}

.description-text {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(216, 227, 242, 0.74);
    overflow: hidden;
    word-break: break-word;
    white-space: normal;
}

.execute-button {
    flex-shrink: 0;
    height: 30px;
    padding: 0 14px;
    margin: 0;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, #38bdf8, #f59e0b);
    color: #08111d;
    font-size: 12px;
    font-weight: 700;
    transition: all 0.2s ease;
}

.execute-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(56, 189, 248, 0.14);
}

:deep(.el-collapse) {
    border: none;
    background: transparent;
}

:deep(.el-collapse-item) {
    margin-bottom: 8px;
    overflow: hidden;
    border-radius: 14px;
    border: none;
    background: rgba(255, 255, 255, 0.028);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.045);
}

:deep(.el-collapse-item__header) {
    height: auto;
    line-height: normal;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--panel-text-strong) !important;
}

:deep(.el-collapse-item__wrap) {
    border: none;
    background: transparent;
}

:deep(.el-collapse-item__content) {
    padding-bottom: 0;
    color: rgba(216, 227, 242, 0.74);
}

:deep(.el-collapse-item__arrow) {
    margin-right: 14px;
    color: rgba(216, 227, 242, 0.64);
}

.panel-body :deep(.ai-conversation) {
    height: 100%;
}

.panel-content::-webkit-scrollbar,
.panel-body-scroll::-webkit-scrollbar,
:deep(.el-collapse-item__wrap::-webkit-scrollbar) {
    width: 8px;
}

.panel-content::-webkit-scrollbar-track,
.panel-body-scroll::-webkit-scrollbar-track,
:deep(.el-collapse-item__wrap::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb,
.panel-body-scroll::-webkit-scrollbar-thumb,
:deep(.el-collapse-item__wrap::-webkit-scrollbar-thumb) {
    background: rgba(148, 163, 184, 0.36);
    border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb:hover,
.panel-body-scroll::-webkit-scrollbar-thumb:hover,
:deep(.el-collapse-item__wrap::-webkit-scrollbar-thumb:hover) {
    background: rgba(148, 163, 184, 0.56);
}

@media (max-width: 1280px) {
    .ma-collapse-container {
        width: min(94vw, 1040px);
    }

    .header-pills {
        justify-content: flex-start;
    }
}

@media (max-width: 900px) {
    .ma-collapse-container {
        width: 94vw;
        height: 82vh;
        border-radius: 18px;
    }

    .drag-area {
        flex-direction: column;
        align-items: stretch;
    }

    .title-line {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }

    .header-actions {
        width: 100%;
        justify-content: space-between;
    }

    .top-buttons {
        justify-content: flex-end;
    }

    .push-panel-container {
        gap: 10px;
        padding: 12px;
    }

    .push-panel.collapsed {
        flex-basis: 52px;
        min-width: 52px;
        max-width: 52px;
    }

    .push-panel.active {
        min-width: 0;
    }

    .badge-description {
        display: none;
    }
}

@media (max-width: 640px) {
    .title-subtitle {
        display: none;
    }

    .header-actions {
        gap: 8px;
    }

    .header-pills {
        width: 100%;
    }

    .header-pill:hover .pill-label,
    .header-pill.is-active .pill-label {
        max-width: 64px;
    }
}
</style>
