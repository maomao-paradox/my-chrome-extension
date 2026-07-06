<template>
    <div v-if="isRecording && recordingPointerPosition" class="recording-pointer-overlay" aria-hidden="true">
        <div v-for="segment in crosshairSegments" :key="segment.key" class="recording-crosshair-line"
            :class="segment.className" :style="segment.style"></div>
        <div v-if="hoveredButtonRect" class="recording-button-outline" :style="buttonOutlineStyle"></div>
        <div class="recording-coordinate-badge" :style="coordinateBadgeStyle">
            <span>clientX {{ recordingPointerPosition.x }}</span>
            <span>clientY {{ recordingPointerPosition.y }}</span>
        </div>
    </div>
    <Draggable :canOverflow="false">
        <div v-show="visible" class="auto-clicker-card">
            <h1>
                <span>🖱️ 连点器 · 统一间隔</span>
            </h1>
            <div class="subhead">
                录制点击序列 · 统一间隔控制 · 快捷键 <kbd>Ctrl+Shift+L</kbd> 切换播放
            </div>

            <div class="control-group">
                <label for="intervalInput">
                    ⏱️ 间隔 (ms)
                </label>
                <input type="number" id="intervalInput" v-model.number="intervalMs" :min="50" :max="10000" step="50"
                    @change="onIntervalChange">
                <span class="unit-label">ms</span>
            </div>

            <div class="btn-group">
                <button class="btn btn-primary" @click="startPlayback" :disabled="isPlaying || isRecording">
                    ▶ 播放
                </button>
                <button class="btn btn-danger" @click="stopPlayback" :disabled="!isPlaying">
                    ⏹ 停止
                </button>
                <button class="btn btn-success" @click="toggleRecording" :class="{ 'btn-recording': isRecording }">
                    {{ isRecording ? '⏹ 停止录制' : '🔴 录制' }}
                </button>
                <button class="btn btn-outline" @click="resetCounter">
                    ⟳ 重置计数
                </button>
            </div>

            <div class="delay-hint">
                <span>💡</span>
                <span>所有步骤使用统一的间隔时间，适合弹窗延迟较固定的场景</span>
            </div>

            <div class="status-box">
                <div class="status-indicator">
                    <span class="status-dot" :class="statusDotClass"></span>
                    <span style="font-weight: 450; color: #1e2a44;">{{ statusText }}</span>
                    <span class="record-steps">步骤: {{ recordedSteps.length }}</span>
                </div>
                <div class="click-counter">
                    <span>点击</span>
                    <span>{{ clickCounter }}</span>
                </div>
            </div>
            <div class="footer-note">
                <span>⚡ 录制时点击页面任意位置记录坐标</span>
                <span>· 再次点击录制按钮结束</span>
            </div>
        </div>
    </Draggable>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue';
import { Draggable } from '@components/index';  // 拖拽库

const props = defineProps<{
    visible: boolean;
}>();
// ---------- 响应式状态 ----------
const intervalMs = ref(500);           // 间隔时间（毫秒）
const clickCounter = ref(0);          // 累计点击次数
const isPlaying = ref(false);         // 是否正在播放
const isRecording = ref(false);       // 是否正在录制
const recordedSteps = ref<{ x: number; y: number }[]>([]);        // 录制步骤 [{ x, y }]
const currentStepIndex = ref(0);      // 回放当前步骤索引

// ---------- 内部状态 ----------
const intervalId = ref<NodeJS.Timeout | null>(null);               // 播放定时器
const recordingClickListenerTimer = ref<number | null>(null);
type PointerPosition = {
    x: number;
    y: number;
};

type ViewportRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

const recordingPointerPosition = ref<PointerPosition | null>(null);
const hoveredButtonRect = ref<ViewportRect | null>(null);
const buttonSelector = 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]';

// 监听鼠标点击
const recordingListener = function (e: MouseEvent) {
    if (!isRecording.value) return;
    const x = e.clientX;
    const y = e.clientY;
    recordedSteps.value.push({ x, y });
};

// ---------- 计算属性 ----------
const statusText = computed(() => {
    if (isRecording.value) return '录制中';
    if (isPlaying.value) return '播放中';
    return '空闲';
});

const statusDotClass = computed(() => {
    if (isRecording.value) return 'recording';
    if (isPlaying.value) return 'active';
    return 'inactive';
});

const crosshairSegments = computed(() => {
    const pointer = recordingPointerPosition.value;
    if (!pointer) return [];

    const buttonRect = hoveredButtonRect.value;
    const x = `${pointer.x}px`;
    const y = `${pointer.y}px`;

    if (!buttonRect) {
        return [
            {
                key: 'vertical',
                className: 'recording-crosshair-line--vertical',
                style: {
                    left: x,
                    top: '0px',
                    height: '100vh',
                },
            },
            {
                key: 'horizontal',
                className: 'recording-crosshair-line--horizontal',
                style: {
                    left: '0px',
                    top: y,
                    width: '100vw',
                },
            },
        ];
    }

    return [
        {
            key: 'vertical-top',
            className: 'recording-crosshair-line--vertical',
            style: {
                left: x,
                top: '0px',
                height: `${Math.max(0, buttonRect.top)}px`,
            },
        },
        {
            key: 'vertical-bottom',
            className: 'recording-crosshair-line--vertical',
            style: {
                left: x,
                top: `${buttonRect.bottom}px`,
                height: `calc(100vh - ${buttonRect.bottom}px)`,
            },
        },
        {
            key: 'horizontal-left',
            className: 'recording-crosshair-line--horizontal',
            style: {
                left: '0px',
                top: y,
                width: `${Math.max(0, buttonRect.left)}px`,
            },
        },
        {
            key: 'horizontal-right',
            className: 'recording-crosshair-line--horizontal',
            style: {
                left: `${buttonRect.right}px`,
                top: y,
                width: `calc(100vw - ${buttonRect.right}px)`,
            },
        },
    ];
});

const coordinateBadgeStyle = computed(() => {
    const pointer = recordingPointerPosition.value;
    if (!pointer) return {};

    return {
        left: `max(8px, min(calc(100vw - 132px), ${pointer.x + 12}px))`,
        top: `max(8px, min(calc(100vh - 42px), ${pointer.y + 12}px))`,
    };
});

const buttonOutlineStyle = computed(() => {
    const buttonRect = hoveredButtonRect.value;
    if (!buttonRect) return {};

    return {
        left: `${buttonRect.left}px`,
        top: `${buttonRect.top}px`,
        width: `${buttonRect.width}px`,
        height: `${buttonRect.height}px`,
    };
});

// ---------- 核心功能 ----------
// 执行一次点击 (指定坐标)
function performClickAt(x: number, y: number) {
    const eventOptions = {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        screenX: window.screenX + x || x,
        screenY: window.screenY + y || y,
        buttons: 1,
        button: 0,
    };

    // mousedown
    const downEvent = new MouseEvent('mousedown', eventOptions);
    document.dispatchEvent(downEvent);

    // mouseup (buttons: 0)
    const upOptions = { ...eventOptions, buttons: 0 };
    const upEvent = new MouseEvent('mouseup', upOptions);
    document.dispatchEvent(upEvent);

    // click
    const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        screenX: window.screenX + x || x,
        screenY: window.screenY + y || y,
        button: 0,
        buttons: 0,
    });
    document.dispatchEvent(clickEvent);

    clickCounter.value++;
}

// 播放下一个步骤
function playNextStep() {
    if (!isPlaying.value) return;
    if (recordedSteps.value.length === 0) {
        stopPlayback();
        return;
    }

    // 执行当前步骤
    const step = recordedSteps.value[currentStepIndex.value];
    performClickAt(step.x, step.y);

    // 移动到下一步（循环）
    currentStepIndex.value++;
    if (currentStepIndex.value >= recordedSteps.value.length) {
        currentStepIndex.value = 0;
    }
}

// 开始播放
function startPlayback() {
    if (isPlaying.value) return;
    if (isRecording.value) {
        stopRecording();
    }
    if (recordedSteps.value.length === 0) {
        // 可以添加提示
        return;
    }

    // 重置步骤索引
    currentStepIndex.value = 0;
    isPlaying.value = true;

    // 清除旧定时器
    if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
    }

    // 创建新定时器
    intervalId.value = setInterval(playNextStep, intervalMs.value);

    // 立即执行第一步
    playNextStep();
}

// 停止播放
function stopPlayback() {
    if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
    }
    isPlaying.value = false;
}

// ---------- 录制功能 ----------
function getViewportRect(rect: DOMRect): ViewportRect {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);

    return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
}

function getButtonRectAtPoint(x: number, y: number) {
    const pointedElement = document.elementFromPoint(x, y);
    const buttonElement = pointedElement instanceof Element
        ? pointedElement.closest(buttonSelector)
        : null;

    if (!(buttonElement instanceof HTMLElement)) {
        return null;
    }

    const rect = buttonElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        return null;
    }

    return getViewportRect(rect);
}

function updateRecordingPointer(x: number, y: number) {
    const pointer = {
        x: Math.round(x),
        y: Math.round(y),
    };

    recordingPointerPosition.value = pointer;
    hoveredButtonRect.value = getButtonRectAtPoint(pointer.x, pointer.y);
}

function handleRecordingPointerMove(e: MouseEvent) {
    if (!isRecording.value) return;
    updateRecordingPointer(e.clientX, e.clientY);
}

function refreshRecordingPointerTarget() {
    if (!isRecording.value || !recordingPointerPosition.value) return;
    const { x, y } = recordingPointerPosition.value;
    hoveredButtonRect.value = getButtonRectAtPoint(x, y);
}

function addRecordingPointerListeners() {
    document.addEventListener('mousemove', handleRecordingPointerMove, { passive: true });
    document.addEventListener('scroll', refreshRecordingPointerTarget, true);
    window.addEventListener('resize', refreshRecordingPointerTarget);
}

function removeRecordingPointerListeners() {
    document.removeEventListener('mousemove', handleRecordingPointerMove);
    document.removeEventListener('scroll', refreshRecordingPointerTarget, true);
    window.removeEventListener('resize', refreshRecordingPointerTarget);
}

function addRecordingClickListener(defer: boolean) {
    if (recordingClickListenerTimer.value !== null) {
        window.clearTimeout(recordingClickListenerTimer.value);
        recordingClickListenerTimer.value = null;
    }

    if (!defer) {
        document.addEventListener('click', recordingListener);
        return;
    }

    recordingClickListenerTimer.value = window.setTimeout(() => {
        recordingClickListenerTimer.value = null;
        if (isRecording.value) {
            document.addEventListener('click', recordingListener);
        }
    }, 0);
}

function removeRecordingClickListener() {
    if (recordingClickListenerTimer.value !== null) {
        window.clearTimeout(recordingClickListenerTimer.value);
        recordingClickListenerTimer.value = null;
    }
    document.removeEventListener('click', recordingListener);
}

function startRecording(e?: MouseEvent) {
    if (isRecording.value) return;
    if (isPlaying.value) {
        stopPlayback();
    }

    // 清空之前的录制
    recordedSteps.value = [];
    currentStepIndex.value = 0;
    isRecording.value = true;

    if (e) {
        updateRecordingPointer(e.clientX, e.clientY);
    }

    addRecordingClickListener(Boolean(e));
    addRecordingPointerListeners();
}

function stopRecording() {
    if (!isRecording.value) return;
    isRecording.value = false;
    removeRecordingClickListener();
    removeRecordingPointerListeners();
    recordingPointerPosition.value = null;
    hoveredButtonRect.value = null;
    console.warn(recordedSteps.value);
}

function toggleRecording(e?: MouseEvent) {
    if (isRecording.value) {
        stopRecording();
    } else {
        startRecording(e);
    }
}

// ---------- 其他功能 ----------
function resetCounter() {
    clickCounter.value = 0;
}

function onIntervalChange() {
    // 确保值在有效范围内
    if (intervalMs.value < 50) intervalMs.value = 50;
    if (intervalMs.value > 10000) intervalMs.value = 10000;

    // 如果正在播放，重启以应用新间隔
    if (isPlaying.value) {
        stopPlayback();
        startPlayback();
    }
}

// ---------- 键盘快捷键 ----------
function handleKeydown(e: KeyboardEvent) {
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    // Ctrl+Shift+L: 播放/停止
    if (isCtrl && isShift && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (isRecording.value) {
            stopRecording();
        }
        if (isPlaying.value) {
            stopPlayback();
        } else {
            startPlayback();
        }
    }

    // Ctrl+Shift+R: 录制/停止录制
    if (isCtrl && isShift && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        toggleRecording();
    }
}

// ---------- 生命周期 ----------
onBeforeUnmount(() => {
    // 清理定时器和事件监听
    if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
    }
    removeRecordingClickListener();
    removeRecordingPointerListeners();
    document.removeEventListener('keydown', handleKeydown);
});

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
});
</script>

<style scoped lang="scss">
.recording-pointer-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    color: #ef4444;
}

.recording-crosshair-line {
    position: fixed;
    background: rgba(239, 68, 68, 0.78);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.38);
}

.recording-crosshair-line--vertical {
    width: 1px;
}

.recording-crosshair-line--horizontal {
    height: 1px;
}

.recording-button-outline {
    position: fixed;
    border: 2px solid #ef4444;
    border-radius: 8px;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.82), 0 0 18px rgba(239, 68, 68, 0.28);
}

.recording-coordinate-badge {
    position: fixed;
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    min-width: 120px;
    padding: 5px 8px;
    border: 1px solid rgba(239, 68, 68, 0.45);
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.88);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
    color: #f8fafc;
    font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    line-height: 1.2;
    letter-spacing: 0;
    white-space: nowrap;
}

.auto-clicker-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border-radius: 24px;
    box-shadow: 0 10px 20px rgba(0, 10, 30, 0.15), 0 3px 6px rgba(0, 0, 0, 0.05);
    padding: 18px 20px 21px;
    max-width: 280px;
    width: 100%;
    transition: all 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.5);
}

h1 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: #0b1a33;
    letter-spacing: 0;
    display: flex;
    align-items: center;
    gap: 4px;
}

.subhead {
    color: #3a4a62;
    font-size: 11px;
    font-weight: 400;
    margin: 0 0 14px 0;
    border-left: 2px solid #3b82f6;
    padding-left: 7px;
    background: rgba(59, 130, 246, 0.06);
    border-radius: 0 6px 6px 0;
    line-height: 1.35;
}

.control-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    background: rgba(255, 255, 255, 0.5);
    padding: 9px 10px;
    border-radius: 30px;
    margin-bottom: 10px;
    backdrop-filter: blur(2px);
    border: 1px solid rgba(255, 255, 255, 0.8);
}

.control-group label {
    font-weight: 500;
    color: #1e2a44;
    font-size: 11px;
    letter-spacing: 0;
    display: flex;
    align-items: center;
    gap: 3px;
}

.control-group input[type="number"] {
    width: 56px;
    padding: 5px 7px;
    border: 1px solid #cdd9e9;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    background: white;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
    transition: 0.2s;
    color: #0b1a33;
}

.control-group input[type="number"]:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.control-group input[type="number"]::-webkit-inner-spin-button {
    opacity: 0.6;
}

.unit-label {
    margin-left: -2px;
    color: #4a5a72;
    font-size: 11px;
}

.btn-group {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin: 3px 0 8px;
}

.btn {
    flex: 1 1 auto;
    min-width: 40px;
    padding: 7px 9px;
    border: none;
    border-radius: 30px;
    font-weight: 600;
    font-size: 11px;
    background: white;
    color: #1e2a44;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.02);
    cursor: pointer;
    transition: 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: 1px solid #dbe1ed;
    letter-spacing: 0;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.btn-primary {
    background: #1a2a4a;
    color: white;
    border: 1px solid #1a2a4a;
    box-shadow: 0 4px 8px -3px rgba(26, 42, 74, 0.2);
}

.btn-primary:hover:not(:disabled) {
    background: #0f1e38;
    transform: scale(0.97);
}

.btn-danger {
    background: #b91c1c;
    color: white;
    border: 1px solid #b91c1c;
    box-shadow: 0 4px 8px -3px rgba(185, 28, 28, 0.2);
}

.btn-danger:hover:not(:disabled) {
    background: #991b1b;
    transform: scale(0.97);
}

.btn-success {
    background: #0b6e4f;
    color: white;
    border: 1px solid #0b6e4f;
    box-shadow: 0 4px 8px -3px rgba(11, 110, 79, 0.2);
}

.btn-success:hover:not(:disabled) {
    background: #095a40;
    transform: scale(0.97);
}

.btn-outline {
    background: transparent;
    border: 1px solid #b0c2db;
}

.btn-outline:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.5);
}

.btn-recording {
    background: #dc2626;
    color: white;
    border: 1px solid #dc2626;
    animation: pulse-rec 1s infinite;
    box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.3);
}

@keyframes pulse-rec {
    0% {
        box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5);
    }

    70% {
        box-shadow: 0 0 0 4px rgba(220, 38, 38, 0);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
    }
}

.delay-hint {
    background: #fef3c7;
    padding: 5px 8px;
    border-radius: 15px;
    font-size: 10px;
    color: #92400e;
    margin-top: 6px;
    border: 1px solid #fde68a;
    display: flex;
    align-items: center;
    gap: 4px;
    line-height: 1.35;
}

.status-box {
    background: #eef2f8;
    padding: 9px 11px;
    border-radius: 15px;
    margin-top: 9px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.7);
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 450;
    font-size: 11px;
}

.status-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 10px;
    background: #7a8aa3;
    transition: 0.2s;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.status-dot.active {
    background: #22a65e;
    box-shadow: 0 0 0 2px rgba(34, 166, 94, 0.2);
}

.status-dot.recording {
    background: #dc2626;
    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.3);
    animation: pulse-dot 1s infinite;
}

@keyframes pulse-dot {
    0% {
        opacity: 1;
        transform: scale(1);
    }

    50% {
        opacity: 0.6;
        transform: scale(0.9);
    }

    100% {
        opacity: 1;
        transform: scale(1);
    }
}

.status-dot.inactive {
    background: #b0bcca;
}

.click-counter {
    background: white;
    padding: 3px 10px 3px 9px;
    border-radius: 30px;
    font-size: 12px;
    font-weight: 600;
    color: #0b1a33;
    box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.02);
    border: 1px solid #dbe1ed;
    display: flex;
    align-items: center;
    gap: 6px;
}

.click-counter span {
    font-weight: 400;
    font-size: 10px;
    color: #3a4a62;
}

.record-steps {
    font-size: 10px;
    background: rgba(0, 0, 0, 0.02);
    padding: 2px 7px;
    border-radius: 20px;
    color: #2c3e5c;
}

.footer-note {
    margin-top: 12px;
    font-size: 10px;
    color: #5a6e8a;
    text-align: center;
    border-top: 1px dashed #ccd8e8;
    padding-top: 10px;
    letter-spacing: 0;
    display: flex;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
}

.footer-note kbd {
    background: #e2e8f2;
    padding: 1px 5px;
    border-radius: 15px;
    font-size: 10px;
    font-weight: 600;
    color: #1a2a4a;
}

@media (max-width: 480px) {
    .auto-clicker-card {
        padding: 12px 9px;
        max-width: 260px;
    }

    .control-group {
        border-radius: 16px;
        padding: 7px 8px;
    }

    .btn-group .btn {
        min-width: 35px;
        padding: 6px;
        font-size: 10px;
    }
}
</style>
