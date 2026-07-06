import type {
  AutomationRun,
  AutomationRunEvent,
  AutomationRunScreenshot,
  AutomationStep,
  AutomationTask,
  CreateAutomationRunEventRequest,
  CreateAutomationRunRequest,
  CreateAutomationRunScreenshotRequest,
  CreateAutomationTaskRequest,
  GenerateAutomationStepsRequest,
  SaveAutomationStepsRequest,
} from '@/types/automation';

const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:8787';
const BACKEND_BASE_URL_STORAGE_KEY = 'automationBackendBaseUrl';

interface ApiEnvelope<T> {
  ok?: boolean;
  task?: AutomationTask;
  runs?: AutomationRun[];
  run?: AutomationRun;
  event?: AutomationRunEvent;
  screenshot?: AutomationRunScreenshot;
  steps?: AutomationStep[];
  error?: string;
  raw?: unknown;
  [key: string]: unknown;
}

async function getStoredBackendBaseURL(): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return DEFAULT_BACKEND_BASE_URL;
  }

  const stored = await chrome.storage.local.get(BACKEND_BASE_URL_STORAGE_KEY);
  const value = stored[BACKEND_BASE_URL_STORAGE_KEY];
  return typeof value === 'string' && value.trim() ? value.trim().replace(/\/+$/, '') : DEFAULT_BACKEND_BASE_URL;
}

export async function setAutomationBackendBaseURL(baseURL: string): Promise<void> {
  const normalized = baseURL.trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('后端地址不能为空');
  }
  await chrome.storage.local.set({ [BACKEND_BASE_URL_STORAGE_KEY]: normalized });
}

export async function getAutomationBackendBaseURL(): Promise<string> {
  return getStoredBackendBaseURL();
}

async function requestJSON<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseURL = await getStoredBackendBaseURL();
  const response = await fetch(`${baseURL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}${text ? `: ${text}` : ''}`);
  }

  return payload as T;
}

export async function createAutomationTask(
  body: CreateAutomationTaskRequest
): Promise<AutomationTask> {
  const response = await requestJSON<ApiEnvelope<AutomationTask>>('/api/automation/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.task) {
    throw new Error('后端未返回任务');
  }
  return response.task;
}

export async function getAutomationTask(id: string): Promise<{ task: AutomationTask; runs: AutomationRun[] }> {
  const response = await requestJSON<ApiEnvelope<AutomationTask>>(`/api/automation/tasks/${encodeURIComponent(id)}`);
  if (!response.task) {
    throw new Error('后端未返回任务');
  }
  return {
    task: response.task,
    runs: response.runs || [],
  };
}

export async function saveAutomationTaskSteps(
  taskId: string,
  body: SaveAutomationStepsRequest
): Promise<AutomationTask> {
  const response = await requestJSON<ApiEnvelope<AutomationTask>>(`/api/automation/tasks/${encodeURIComponent(taskId)}/steps`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.task) {
    throw new Error('后端未返回任务');
  }
  return response.task;
}

export async function createAutomationRun(
  taskId: string,
  body: CreateAutomationRunRequest
): Promise<AutomationRun> {
  const response = await requestJSON<ApiEnvelope<AutomationRun>>(`/api/automation/tasks/${encodeURIComponent(taskId)}/runs`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.run) {
    throw new Error('后端未返回运行记录');
  }
  return response.run;
}

export async function createAutomationRunEvent(
  runId: string,
  body: CreateAutomationRunEventRequest
): Promise<{ event: AutomationRunEvent; run: AutomationRun }> {
  const response = await requestJSON<ApiEnvelope<AutomationRunEvent>>(`/api/automation/runs/${encodeURIComponent(runId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.event || !response.run) {
    throw new Error('后端未返回执行事件');
  }
  return {
    event: response.event,
    run: response.run,
  };
}

export async function createAutomationRunScreenshot(
  runId: string,
  body: CreateAutomationRunScreenshotRequest
): Promise<{ screenshot: AutomationRunScreenshot; run: AutomationRun }> {
  const response = await requestJSON<ApiEnvelope<AutomationRunScreenshot>>(`/api/automation/runs/${encodeURIComponent(runId)}/screenshots`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.screenshot || !response.run) {
    throw new Error('后端未返回截图记录');
  }
  return {
    screenshot: response.screenshot,
    run: response.run,
  };
}

export async function generateAutomationSteps(
  body: GenerateAutomationStepsRequest
): Promise<AutomationStep[]> {
  const response = await requestJSON<ApiEnvelope<AutomationStep[]>>('/api/automation/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response.steps || [];
}
