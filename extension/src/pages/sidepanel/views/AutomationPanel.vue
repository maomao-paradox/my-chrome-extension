<template>
  <section class="automation-panel">
    <header class="automation-header">
      <div>
        <p class="eyebrow">Chrome Tab Automation</p>
        <h1>真实标签页自动化</h1>
      </div>
      <span :class="['connection-pill', { connected: isConnected }]">
        <span class="connection-dot"></span>
        {{ isConnected ? '已连接' : '未连接' }}
      </span>
    </header>

    <div class="toolbar">
      <button class="primary" type="button" :disabled="busy" @click="attachCurrentTab">
        连接当前页
      </button>
      <button type="button" :disabled="!isConnected || busy" @click="captureScreenshot">
        截图
      </button>
      <button type="button" :disabled="!isConnected || busy" @click="toggleRecording">
        {{ recording ? '停止录制' : '开始录制' }}
      </button>
    </div>

    <div class="page-strip">
      <span class="label">页面</span>
      <strong>{{ page.title || '未连接页面' }}</strong>
      <small>{{ page.url || '连接后显示当前标签页地址' }}</small>
    </div>

    <div class="backend-row">
      <label for="automation-backend">后端地址</label>
      <div class="input-action">
        <input id="automation-backend" v-model="backendUrl" type="url" spellcheck="false" />
        <button type="button" @click="saveBackendUrl">保存</button>
      </div>
    </div>

    <div class="task-grid">
      <label>
        任务名称
        <input v-model="taskName" type="text" placeholder="登录并导出报表" />
      </label>
      <label>
        任务 ID
        <input v-model="taskId" type="text" placeholder="保存后自动生成，可粘贴历史 ID 加载" />
      </label>
    </div>
    <label class="stacked">
      任务说明
      <textarea v-model="taskDescription" rows="2" placeholder="说明录制目标和执行边界"></textarea>
    </label>

    <div class="toolbar secondary">
      <button type="button" :disabled="busy || steps.length === 0" @click="createOrSaveTask">
        保存任务和步骤
      </button>
      <button type="button" :disabled="busy || !taskId.trim()" @click="loadTask">
        加载任务
      </button>
      <button type="button" :disabled="busy || steps.length === 0" @click="clearSteps">
        清空步骤
      </button>
    </div>

    <section class="composer">
      <div class="section-title">
        <h2>添加步骤</h2>
        <span>{{ steps.length }} steps</span>
      </div>
      <textarea v-model="stepDraft" rows="5" spellcheck="false"></textarea>
      <div class="toolbar secondary">
        <button type="button" :disabled="busy" @click="appendDraftStep">
          添加 JSON 步骤
        </button>
        <button type="button" @click="resetDraft">
          重置示例
        </button>
      </div>
    </section>

    <section class="composer">
      <div class="section-title">
        <h2>AI 生成</h2>
        <span>结构化输出</span>
      </div>
      <textarea v-model="intent" rows="3" placeholder="例如：登录系统并打开销售报表"></textarea>
      <textarea v-model="pageSnapshot" rows="3" placeholder="可粘贴页面摘要、可见控件、表单字段"></textarea>
      <button type="button" :disabled="busy || !intent.trim()" @click="generateSteps">
        生成并追加步骤
      </button>
    </section>

    <section class="steps-section">
      <div class="section-title">
        <h2>步骤列表</h2>
        <div class="run-controls">
          <select v-model="runMode" aria-label="运行模式">
            <option value="dry-run">dry-run</option>
            <option value="real-run">real-run</option>
          </select>
          <button class="primary" type="button" :disabled="busy || !isConnected || steps.length === 0" @click="runCurrentSteps">
            执行并上报
          </button>
        </div>
      </div>

      <ol class="step-list">
        <li v-for="(step, index) in steps" :key="step.id || index">
          <div class="step-main">
            <span class="step-type">{{ step.type }}</span>
            <strong>{{ summarizeStep(step) }}</strong>
            <small>{{ JSON.stringify(step.target || { url: step.url }) }}</small>
          </div>
          <button type="button" class="icon-button" :aria-label="`删除第 ${index + 1} 步`" @click="removeStep(index)">
            ×
          </button>
        </li>
      </ol>
    </section>

    <section v-if="lastScreenshot" class="screenshot-preview">
      <div class="section-title">
        <h2>最近截图</h2>
        <span>PNG</span>
      </div>
      <img :src="`data:image/png;base64,${lastScreenshot}`" alt="当前标签页截图预览" />
    </section>

    <section class="log-section">
      <div class="section-title">
        <h2>执行日志</h2>
        <span>{{ logs.length }}</span>
      </div>
      <div class="logs" role="log" aria-live="polite">
        <p v-for="log in logs" :key="log.id" :class="log.level">
          <time>{{ log.time }}</time>
          <span>{{ log.message }}</span>
        </p>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sendMessageToBackground } from '@/utils/message';
import type {
  AutomationMessageResponse,
  AutomationPageSnapshot,
  AutomationRun,
  AutomationRunStepsResult,
  AutomationStep,
  AutomationStepResult,
  AutomationTask
} from '@/types/automation';
import {
  createAutomationRun,
  createAutomationRunEvent,
  createAutomationRunScreenshot,
  createAutomationTask,
  generateAutomationSteps,
  getAutomationBackendBaseURL,
  getAutomationTask,
  saveAutomationTaskSteps,
  setAutomationBackendBaseURL
} from '@/services/api/automation-api';

interface LogItem {
  id: string;
  time: string;
  level: 'info' | 'success' | 'error';
  message: string;
}

const sampleStep = `{
  "type": "click",
  "target": {
    "kind": "role",
    "role": "button",
    "name": "登录"
  },
  "timeoutMs": 10000
}`;

const backendUrl = ref('http://127.0.0.1:8787');
const busy = ref(false);
const recording = ref(false);
const attachedTabId = ref<number | null>(null);
const page = ref<Required<AutomationPageSnapshot>>({ title: '', url: '' });
const taskName = ref('真实标签页自动化任务');
const taskDescription = ref('');
const taskId = ref('');
const steps = ref<AutomationStep[]>([]);
const stepDraft = ref(sampleStep);
const intent = ref('');
const pageSnapshot = ref('');
const runMode = ref<'dry-run' | 'real-run'>('dry-run');
const activeRun = ref<AutomationRun | null>(null);
const lastScreenshot = ref('');
const logs = ref<LogItem[]>([]);

const isConnected = computed(() => attachedTabId.value !== null);

function addLog(message: string, level: LogItem['level'] = 'info'): void {
  logs.value.unshift({
    id: `${Date.now()}_${Math.random()}`,
    time: new Date().toLocaleTimeString(),
    level,
    message
  });
  logs.value = logs.value.slice(0, 60);
}

async function sendAutomationMessage<T>(type: string, payload?: unknown): Promise<T> {
  const response = await sendMessageToBackground({ type, payload }) as AutomationMessageResponse<T>;
  if (!response.success) {
    throw new Error(response.error || '自动化消息执行失败');
  }
  return response.payload as T;
}

async function attachCurrentTab(): Promise<void> {
  await runBusy(async () => {
    const result = await sendAutomationMessage<{ tabId: number; page: Required<AutomationPageSnapshot> }>('AUTOMATION_ATTACH');
    attachedTabId.value = result.tabId;
    page.value = result.page;
    pageSnapshot.value = `title: ${result.page.title}\nurl: ${result.page.url}`;
    addLog(`已连接标签页 ${result.tabId}`, 'success');
  });
}

async function captureScreenshot(): Promise<void> {
  await runBusy(async () => {
    const result = await sendAutomationMessage<AutomationStepResult>('AUTOMATION_RUN_STEP', {
      step: { type: 'screenshot' },
      allowRisky: true
    });
    if (result.screenshot) {
      lastScreenshot.value = result.screenshot;
      addLog('截图完成', 'success');
    }
    page.value = result.page;
  });
}

async function toggleRecording(): Promise<void> {
  await runBusy(async () => {
    if (!recording.value) {
      await sendAutomationMessage('AUTOMATION_RECORD_START');
      recording.value = true;
      addLog('开始录制当前页操作', 'success');
      return;
    }
    await sendAutomationMessage('AUTOMATION_RECORD_STOP');
    recording.value = false;
    addLog('录制已停止', 'info');
  });
}

async function saveBackendUrl(): Promise<void> {
  await runBusy(async () => {
    await setAutomationBackendBaseURL(backendUrl.value);
    addLog('后端地址已保存', 'success');
  });
}

async function createOrSaveTask(): Promise<void> {
  await runBusy(async () => {
    let task: AutomationTask;
    if (!taskId.value.trim()) {
      task = await createAutomationTask({
        name: taskName.value.trim() || '真实标签页自动化任务',
        description: taskDescription.value.trim()
      });
      taskId.value = task.id;
    }

    task = await saveAutomationTaskSteps(taskId.value.trim(), {
      steps: steps.value,
      replace: true
    });
    steps.value = task.steps;
    addLog(`任务已保存：${task.id}`, 'success');
  });
}

async function loadTask(): Promise<void> {
  await runBusy(async () => {
    const result = await getAutomationTask(taskId.value.trim());
    taskName.value = result.task.name;
    taskDescription.value = result.task.description || '';
    steps.value = result.task.steps || [];
    activeRun.value = result.runs[0] || null;
    addLog(`已加载任务：${result.task.id}`, 'success');
  });
}

function appendDraftStep(): void {
  try {
    const parsed = JSON.parse(stepDraft.value) as AutomationStep | { steps?: AutomationStep[] };
    const nextSteps = Array.isArray((parsed as { steps?: AutomationStep[] }).steps)
      ? (parsed as { steps: AutomationStep[] }).steps
      : [parsed as AutomationStep];
    steps.value.push(...nextSteps.map(ensureStepId));
    addLog(`已添加 ${nextSteps.length} 个步骤`, 'success');
  } catch (error) {
    addLog(error instanceof Error ? error.message : 'JSON 解析失败', 'error');
  }
}

function resetDraft(): void {
  stepDraft.value = sampleStep;
}

async function generateSteps(): Promise<void> {
  await runBusy(async () => {
    const generated = await generateAutomationSteps({
      intent: intent.value,
      pageSnapshot: pageSnapshot.value,
      availableActions: ['goto', 'click', 'fill', 'press', 'wait', 'extract', 'screenshot', 'verifyText']
    });
    steps.value.push(...generated.map(ensureStepId));
    addLog(`AI 生成 ${generated.length} 个步骤`, 'success');
  });
}

async function runCurrentSteps(): Promise<void> {
  if (runMode.value === 'real-run') {
    const confirmed = window.confirm('real-run 会真实操作当前页面，可能提交表单或触发页面副作用。确认继续？');
    if (!confirmed) {
      addLog('已取消 real-run', 'info');
      return;
    }
  }

  await runBusy(async () => {
    const task = await ensureSavedTask();
    const run = await createAutomationRun(task.id, {
      mode: runMode.value,
      status: 'running',
      page: page.value
    });
    activeRun.value = run;

    const result = await sendAutomationMessage<AutomationRunStepsResult>('AUTOMATION_RUN_STEPS', {
      steps: steps.value,
      allowRisky: runMode.value === 'real-run'
    });
    page.value = result.page;

    for (const item of result.results) {
      await reportStepResult(run.id, item);
    }
    await createAutomationRunEvent(run.id, {
      status: 'completed',
      page: result.page,
      message: `执行完成：${result.results.length} 步`
    });
    addLog(`执行完成并上报 run：${run.id}`, 'success');
  });
}

async function ensureSavedTask(): Promise<AutomationTask> {
  if (!taskId.value.trim()) {
    const task = await createAutomationTask({
      name: taskName.value.trim() || '真实标签页自动化任务',
      description: taskDescription.value.trim()
    });
    taskId.value = task.id;
  }
  return saveAutomationTaskSteps(taskId.value.trim(), {
    steps: steps.value,
    replace: true
  });
}

async function reportStepResult(runId: string, item: AutomationStepResult): Promise<void> {
  await createAutomationRunEvent(runId, {
    stepId: item.step.id,
    status: 'passed',
    durationMs: item.durationMs,
    page: item.page,
    result: item.result
  });

  if (item.screenshot) {
    await createAutomationRunScreenshot(runId, {
      stepId: item.step.id,
      contentType: 'image/png',
      base64: item.screenshot,
      page: item.page
    });
    lastScreenshot.value = item.screenshot;
  }
}

function clearSteps(): void {
  steps.value = [];
  void sendAutomationMessage('AUTOMATION_RECORDED_STEPS_CLEAR').catch(() => undefined);
  addLog('步骤已清空', 'info');
}

function removeStep(index: number): void {
  steps.value.splice(index, 1);
}

function summarizeStep(step: AutomationStep): string {
  if (step.type === 'goto') {
    return step.url || '';
  }
  if (step.type === 'fill') {
    return step.value || '填充输入';
  }
  if (step.type === 'press') {
    return step.key || 'Enter';
  }
  return step.target?.name || step.target?.text || step.target?.selector || step.target?.placeholder || step.type;
}

function ensureStepId(step: AutomationStep): AutomationStep {
  return {
    ...step,
    id: step.id || `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  };
}

async function runBusy(task: () => Promise<void>): Promise<void> {
  busy.value = true;
  try {
    await task();
  } catch (error) {
    addLog(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}

function handleRuntimeMessage(message: any): void {
  if (message?.target !== 'sidepanel' || message.type !== 'AUTOMATION_RECORDED_ACTION') {
    return;
  }
  const step = message.payload?.step as AutomationStep | undefined;
  if (!step) {
    return;
  }
  steps.value.push(ensureStepId(step));
  if (message.payload?.page) {
    page.value = {
      title: message.payload.page.title || page.value.title,
      url: message.payload.page.url || page.value.url
    };
  }
  addLog(`录制步骤：${step.type}`, 'success');
}

onMounted(async () => {
  backendUrl.value = await getAutomationBackendBaseURL();
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
});

onBeforeUnmount(() => {
  chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
});
</script>

<style lang="scss" scoped>
.automation-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #f8fafc;
}

.automation-header,
.section-title,
.toolbar,
.page-strip,
.backend-row,
.composer,
.steps-section,
.screenshot-preview,
.log-section {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.72);
  border-radius: 8px;
}

.automation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;

  h1 {
    margin: 2px 0 0;
    font-size: 18px;
    line-height: 1.2;
  }
}

.eyebrow {
  margin: 0;
  color: #22c55e;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: uppercase;
}

.connection-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  padding: 6px 9px;
  color: #cbd5e1;
  font-size: 12px;

  &.connected {
    border-color: rgba(34, 197, 94, 0.45);
    color: #bbf7d0;
  }
}

.connection-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #64748b;

  .connected & {
    background: #22c55e;
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.7);
  }
}

.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px;

  &.secondary {
    border: 0;
    background: transparent;
    padding: 0;
  }
}

button,
select,
input,
textarea {
  font: inherit;
}

button {
  min-height: 34px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 6px;
  background: #1e293b;
  color: #e2e8f0;
  padding: 7px 10px;
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease, color 180ms ease;

  &:hover:not(:disabled) {
    background: #334155;
    border-color: rgba(34, 197, 94, 0.45);
  }

  &:focus-visible {
    outline: 2px solid #22c55e;
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.primary {
    background: #16a34a;
    border-color: #22c55e;
    color: #f8fafc;
  }
}

.page-strip {
  display: grid;
  gap: 5px;
  padding: 10px;

  .label {
    color: #94a3b8;
    font-size: 12px;
  }

  strong,
  small {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  small {
    color: #94a3b8;
  }
}

.backend-row,
.task-grid label,
.stacked,
.composer {
  display: grid;
  gap: 7px;
}

.backend-row,
.composer,
.steps-section,
.screenshot-preview,
.log-section {
  padding: 12px;
}

label {
  color: #cbd5e1;
  font-size: 12px;
}

.input-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.task-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 6px;
  background: rgba(2, 6, 23, 0.58);
  color: #f8fafc;
  padding: 9px 10px;

  &:focus {
    border-color: rgba(34, 197, 94, 0.58);
    outline: none;
  }
}

textarea {
  resize: vertical;
  min-height: 72px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 0;
  background: transparent;
  padding: 0 0 10px;

  h2 {
    margin: 0;
    font-size: 14px;
  }

  span {
    color: #94a3b8;
    font-size: 12px;
  }
}

.run-controls {
  display: grid;
  grid-template-columns: 92px auto;
  gap: 8px;
}

.step-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 30px;
    gap: 8px;
    align-items: center;
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: 6px;
    background: rgba(30, 41, 59, 0.6);
    padding: 9px;
  }
}

.step-main {
  display: grid;
  gap: 4px;
  min-width: 0;

  strong,
  small {
    overflow-wrap: anywhere;
  }

  small {
    color: #94a3b8;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 11px;
  }
}

.step-type {
  width: max-content;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.14);
  color: #86efac;
  padding: 2px 7px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
}

.icon-button {
  width: 30px;
  min-height: 30px;
  padding: 0;
}

.screenshot-preview img {
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: #020617;
}

.logs {
  display: grid;
  gap: 6px;
  max-height: 180px;
  overflow: auto;

  p {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 8px;
    margin: 0;
    color: #cbd5e1;
    font-size: 12px;
  }

  time {
    color: #64748b;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }

  .success span {
    color: #86efac;
  }

  .error span {
    color: #fca5a5;
  }
}

@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}
</style>
