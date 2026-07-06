export type AutomationStepType =
  | 'goto'
  | 'click'
  | 'fill'
  | 'press'
  | 'wait'
  | 'extract'
  | 'screenshot'
  | 'verifyText';

export type AutomationTargetKind = 'role' | 'label' | 'placeholder' | 'text' | 'testid' | 'css';

export interface AutomationTarget {
  kind: AutomationTargetKind;
  role?: string;
  name?: string;
  text?: string;
  selector?: string;
  placeholder?: string;
  testId?: string;
}

export interface AutomationStep {
  id?: string;
  type: AutomationStepType;
  target?: AutomationTarget;
  url?: string;
  value?: string;
  key?: string;
  timeoutMs?: number;
  all?: boolean;
}

export interface AutomationPageSnapshot {
  url?: string;
  title?: string;
}

export interface AutomationTask {
  id: string;
  name: string;
  description?: string;
  steps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRunEvent {
  id: string;
  stepId?: string;
  status: string;
  message?: string;
  durationMs?: number;
  page?: AutomationPageSnapshot;
  result?: unknown;
  createdAt: string;
}

export interface AutomationRunScreenshot {
  id: string;
  stepId?: string;
  contentType: string;
  base64?: string;
  path?: string;
  page?: AutomationPageSnapshot;
  createdAt: string;
}

export interface AutomationRun {
  id: string;
  taskId: string;
  status: string;
  mode: 'dry-run' | 'real-run' | string;
  page?: AutomationPageSnapshot;
  events: AutomationRunEvent[];
  screenshots: AutomationRunScreenshot[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationAttachResult {
  tabId: number;
  windowId?: number;
  page: Required<AutomationPageSnapshot>;
}

export interface AutomationStepResult {
  step: AutomationStep;
  page: Required<AutomationPageSnapshot>;
  result?: unknown;
  screenshot?: string;
  durationMs: number;
}

export interface AutomationRunStepsResult {
  page: Required<AutomationPageSnapshot>;
  results: AutomationStepResult[];
}

export interface AutomationMessageResponse<T = unknown> {
  success: boolean;
  payload?: T;
  error?: string;
}

export interface CreateAutomationTaskRequest {
  name: string;
  description?: string;
  steps?: AutomationStep[];
}

export interface SaveAutomationStepsRequest {
  steps: AutomationStep[];
  replace?: boolean;
}

export interface CreateAutomationRunRequest {
  mode?: 'dry-run' | 'real-run';
  status?: string;
  page?: AutomationPageSnapshot;
}

export interface CreateAutomationRunEventRequest {
  stepId?: string;
  status: string;
  message?: string;
  durationMs?: number;
  page?: AutomationPageSnapshot;
  result?: unknown;
}

export interface CreateAutomationRunScreenshotRequest {
  stepId?: string;
  contentType?: string;
  base64?: string;
  path?: string;
  page?: AutomationPageSnapshot;
}

export interface GenerateAutomationStepsRequest {
  intent: string;
  pageSnapshot?: string;
  availableActions?: AutomationStepType[];
}
