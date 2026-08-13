import "./AutomationPanel.scss";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { sendMessageToBackground } from "@/utils/message";
import type {
  AutomationMessageResponse,
  AutomationPageSnapshot,
  AutomationRun,
  AutomationRunStepsResult,
  AutomationStep,
  AutomationStepResult,
  AutomationTask,
} from "@/types/automation";
import {
  createAutomationRun,
  createAutomationRunEvent,
  createAutomationRunScreenshot,
  createAutomationTask,
  generateAutomationSteps,
  getAutomationBackendBaseURL,
  getAutomationTask,
  saveAutomationTaskSteps,
  setAutomationBackendBaseURL,
} from "@/services/api/automation-api";

interface LogItem {
  id: string;
  time: string;
  level: "info" | "success" | "error";
  message: string;
}

const SAMPLE_STEP = `{
  "type": "click",
  "target": {
    "kind": "role",
    "role": "button",
    "name": "登录"
  },
  "timeoutMs": 10000
}`;

const AutomationPanel: React.FC = () => {
  // 状态定义
  const [backendUrl, setBackendUrl] = useState("http://127.0.0.1:8787");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [attachedTabId, setAttachedTabId] = useState<number | null>(null);
  const [page, setPage] = useState<Required<AutomationPageSnapshot>>({
    title: "",
    url: "",
  });
  const [taskName, setTaskName] = useState("真实标签页自动化任务");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskId, setTaskId] = useState("");
  const [steps, setSteps] = useState<AutomationStep[]>([]);
  const [stepDraft, setStepDraft] = useState(SAMPLE_STEP);
  const [intent, setIntent] = useState("");
  const [pageSnapshot, setPageSnapshot] = useState("");
  const [runMode, setRunMode] = useState<"dry-run" | "real-run">("dry-run");
  const [activeRun, setActiveRun] = useState<AutomationRun | null>(null);
  const [lastScreenshot, setLastScreenshot] = useState("");
  const [logs, setLogs] = useState<LogItem[]>([]);

  // 计算属性
  const isConnected = attachedTabId !== null;

  // 工具函数
  const addLog = useCallback(
    (message: string, level: LogItem["level"] = "info") => {
      setLogs((prev) => {
        const newLog: LogItem = {
          id: `${Date.now()}_${Math.random()}`,
          time: new Date().toLocaleTimeString(),
          level,
          message,
        };
        return [newLog, ...prev].slice(0, 60);
      });
    },
    [],
  );

  const sendAutomationMessage = useCallback(
    async <T,>(type: string, payload?: unknown): Promise<T> => {
      const response = (await sendMessageToBackground({
        type,
        payload,
      })) as AutomationMessageResponse<T>;
      if (!response.success) {
        throw new Error(response.error || "自动化消息执行失败");
      }
      return response.payload as T;
    },
    [],
  );

  const runBusy = useCallback(
    async (task: () => Promise<void>) => {
      setBusy(true);
      try {
        await task();
      } catch (error) {
        addLog(error instanceof Error ? error.message : String(error), "error");
      } finally {
        setBusy(false);
      }
    },
    [addLog],
  );

  // 业务逻辑函数
  const attachCurrentTab = useCallback(async () => {
    await runBusy(async () => {
      const result = await sendAutomationMessage<{
        tabId: number;
        page: Required<AutomationPageSnapshot>;
      }>("AUTOMATION_ATTACH");
      setAttachedTabId(result.tabId);
      setPage(result.page);
      setPageSnapshot(`title: ${result.page.title}\nurl: ${result.page.url}`);
      addLog(`已连接标签页 ${result.tabId}`, "success");
    });
  }, [runBusy, sendAutomationMessage, addLog]);

  const captureScreenshot = useCallback(async () => {
    await runBusy(async () => {
      const result = await sendAutomationMessage<AutomationStepResult>(
        "AUTOMATION_RUN_STEP",
        {
          step: { type: "screenshot" },
          allowRisky: true,
        },
      );
      if (result.screenshot) {
        setLastScreenshot(result.screenshot);
        addLog("截图完成", "success");
      }
      setPage(result.page);
    });
  }, [runBusy, sendAutomationMessage, addLog]);

  const toggleRecording = useCallback(async () => {
    await runBusy(async () => {
      if (!recording) {
        await sendAutomationMessage("AUTOMATION_RECORD_START");
        setRecording(true);
        addLog("开始录制当前页操作", "success");
        return;
      }
      await sendAutomationMessage("AUTOMATION_RECORD_STOP");
      setRecording(false);
      addLog("录制已停止", "info");
    });
  }, [runBusy, sendAutomationMessage, addLog, recording]);

  const saveBackendUrl = useCallback(async () => {
    await runBusy(async () => {
      await setAutomationBackendBaseURL(backendUrl);
      addLog("后端地址已保存", "success");
    });
  }, [runBusy, backendUrl, addLog]);

  const ensureStepId = useCallback((step: AutomationStep): AutomationStep => {
    return {
      ...step,
      id:
        step.id ||
        `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
  }, []);

  const createOrSaveTask = useCallback(async () => {
    await runBusy(async () => {
      let task: AutomationTask;
      if (!taskId.trim()) {
        task = await createAutomationTask({
          name: taskName.trim() || "真实标签页自动化任务",
          description: taskDescription.trim(),
        });
        setTaskId(task.id);
      }

      task = await saveAutomationTaskSteps(taskId.trim(), {
        steps,
        replace: true,
      });
      setSteps(task.steps);
      addLog(`任务已保存：${task.id}`, "success");
    });
  }, [runBusy, taskId, taskName, taskDescription, steps, addLog]);

  const loadTask = useCallback(async () => {
    await runBusy(async () => {
      const result = await getAutomationTask(taskId.trim());
      setTaskName(result.task.name);
      setTaskDescription(result.task.description || "");
      setSteps(result.task.steps || []);
      setActiveRun(result.runs[0] || null);
      addLog(`已加载任务：${result.task.id}`, "success");
    });
  }, [runBusy, taskId, addLog]);

  const appendDraftStep = useCallback(() => {
    try {
      const parsed = JSON.parse(stepDraft) as
        | AutomationStep
        | { steps?: AutomationStep[] };
      const nextSteps = Array.isArray(
        (parsed as { steps?: AutomationStep[] }).steps,
      )
        ? (parsed as { steps: AutomationStep[] }).steps
        : [parsed as AutomationStep];
      setSteps((prev) => [...prev, ...nextSteps.map(ensureStepId)]);
      addLog(`已添加 ${nextSteps.length} 个步骤`, "success");
    } catch (error) {
      addLog(error instanceof Error ? error.message : "JSON 解析失败", "error");
    }
  }, [stepDraft, ensureStepId, addLog]);

  const resetDraft = useCallback(() => {
    setStepDraft(SAMPLE_STEP);
  }, []);

  const generateSteps = useCallback(async () => {
    await runBusy(async () => {
      const generated = await generateAutomationSteps({
        intent,
        pageSnapshot,
        availableActions: [
          "goto",
          "click",
          "fill",
          "press",
          "wait",
          "extract",
          "screenshot",
          "verifyText",
        ],
      });
      setSteps((prev) => [...prev, ...generated.map(ensureStepId)]);
      addLog(`AI 生成 ${generated.length} 个步骤`, "success");
    });
  }, [runBusy, intent, pageSnapshot, ensureStepId, addLog]);

  const ensureSavedTask = useCallback(async (): Promise<AutomationTask> => {
    if (!taskId.trim()) {
      const task = await createAutomationTask({
        name: taskName.trim() || "真实标签页自动化任务",
        description: taskDescription.trim(),
      });
      setTaskId(task.id);
    }
    return saveAutomationTaskSteps(taskId.trim(), {
      steps,
      replace: true,
    });
  }, [taskId, taskName, taskDescription, steps]);

  const reportStepResult = useCallback(
    async (runId: string, item: AutomationStepResult) => {
      await createAutomationRunEvent(runId, {
        stepId: item.step.id,
        status: "passed",
        durationMs: item.durationMs,
        page: item.page,
        result: item.result,
      });

      if (item.screenshot) {
        await createAutomationRunScreenshot(runId, {
          stepId: item.step.id,
          contentType: "image/png",
          base64: item.screenshot,
          page: item.page,
        });
        setLastScreenshot(item.screenshot);
      }
    },
    [],
  );

  const runCurrentSteps = useCallback(async () => {
    if (runMode === "real-run") {
      const confirmed = window.confirm(
        "real-run 会真实操作当前页面，可能提交表单或触发页面副作用。确认继续？",
      );
      if (!confirmed) {
        addLog("已取消 real-run", "info");
        return;
      }
    }

    await runBusy(async () => {
      const task = await ensureSavedTask();
      const run = await createAutomationRun(task.id, {
        mode: runMode,
        status: "running",
        page,
      });
      setActiveRun(run);

      const result = await sendAutomationMessage<AutomationRunStepsResult>(
        "AUTOMATION_RUN_STEPS",
        {
          steps,
          allowRisky: runMode === "real-run",
        },
      );
      setPage(result.page);

      for (const item of result.results) {
        await reportStepResult(run.id, item);
      }
      await createAutomationRunEvent(run.id, {
        status: "completed",
        page: result.page,
        message: `执行完成：${result.results.length} 步`,
      });
      addLog(`执行完成并上报 run：${run.id}`, "success");
    });
  }, [
    runMode,
    runBusy,
    ensureSavedTask,
    page,
    steps,
    sendAutomationMessage,
    reportStepResult,
    addLog,
  ]);

  const clearSteps = useCallback(() => {
    setSteps([]);
    sendAutomationMessage("AUTOMATION_RECORDED_STEPS_CLEAR").catch(
      () => undefined,
    );
    addLog("步骤已清空", "info");
  }, [sendAutomationMessage, addLog]);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const summarizeStep = useCallback((step: AutomationStep): string => {
    if (step.type === "goto") {
      return step.url || "";
    }
    if (step.type === "fill") {
      return step.value || "填充输入";
    }
    if (step.type === "press") {
      return step.key || "Enter";
    }
    return (
      step.target?.name ||
      step.target?.text ||
      step.target?.selector ||
      step.target?.placeholder ||
      step.type
    );
  }, []);

  // 监听来自 Chrome 扩展的消息
  const handleRuntimeMessage = useCallback(
    (message: any) => {
      if (
        message?.target !== "sidepanel" ||
        message.type !== "AUTOMATION_RECORDED_ACTION"
      ) {
        return;
      }
      const step = message.payload?.step as AutomationStep | undefined;
      if (!step) {
        return;
      }
      setSteps((prev) => [...prev, ensureStepId(step)]);
      if (message.payload?.page) {
        setPage((prev) => ({
          title: message.payload.page.title || prev.title,
          url: message.payload.page.url || prev.url,
        }));
      }
      addLog(`录制步骤：${step.type}`, "success");
    },
    [ensureStepId, addLog],
  );

  // 生命周期 - 组件挂载
  useEffect(() => {
    const initBackendUrl = async () => {
      const url = await getAutomationBackendBaseURL();
      setBackendUrl(url);
    };
    initBackendUrl();

    chrome?.runtime?.onMessage.addListener(handleRuntimeMessage);

    return () => {
      chrome?.runtime?.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [handleRuntimeMessage]);

  return (
    <section className="automation-panel">
      <header className="automation-header">
        <div>
          <p className="eyebrow">Chrome Tab Automation</p>
          <h1>真实标签页自动化</h1>
        </div>
        <span className={`connection-pill ${isConnected ? "connected" : ""}`}>
          <span className="connection-dot"></span>
          {isConnected ? "已连接" : "未连接"}
        </span>
      </header>

      <div className="toolbar">
        <button
          className="primary"
          type="button"
          disabled={busy}
          onClick={attachCurrentTab}
        >
          连接当前页
        </button>
        <button
          type="button"
          disabled={!isConnected || busy}
          onClick={captureScreenshot}
        >
          截图
        </button>
        <button
          type="button"
          disabled={!isConnected || busy}
          onClick={toggleRecording}
        >
          {recording ? "停止录制" : "开始录制"}
        </button>
      </div>

      <div className="page-strip">
        <span className="label">页面</span>
        <strong>{page.title || "未连接页面"}</strong>
        <small>{page.url || "连接后显示当前标签页地址"}</small>
      </div>

      <div className="backend-row">
        <label htmlFor="automation-backend">后端地址</label>
        <div className="input-action">
          <input
            id="automation-backend"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            type="url"
            spellCheck={false}
          />
          <button type="button" onClick={saveBackendUrl}>
            保存
          </button>
        </div>
      </div>

      <div className="task-grid">
        <label>
          任务名称
          <input
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            type="text"
            placeholder="登录并导出报表"
          />
        </label>
        <label>
          任务 ID
          <input
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            type="text"
            placeholder="保存后自动生成，可粘贴历史 ID 加载"
          />
        </label>
      </div>

      <label className="stacked">
        任务说明
        <textarea
          value={taskDescription}
          onChange={(e) => setTaskDescription(e.target.value)}
          rows={2}
          placeholder="说明录制目标和执行边界"
        />
      </label>

      <div className="toolbar secondary">
        <button
          type="button"
          disabled={busy || steps.length === 0}
          onClick={createOrSaveTask}
        >
          保存任务和步骤
        </button>
        <button
          type="button"
          disabled={busy || !taskId.trim()}
          onClick={loadTask}
        >
          加载任务
        </button>
        <button
          type="button"
          disabled={busy || steps.length === 0}
          onClick={clearSteps}
        >
          清空步骤
        </button>
      </div>

      <section className="composer">
        <div className="section-title">
          <h2>添加步骤</h2>
          <span>{steps.length} steps</span>
        </div>
        <textarea
          value={stepDraft}
          onChange={(e) => setStepDraft(e.target.value)}
          rows={5}
          spellCheck={false}
        />
        <div className="toolbar secondary">
          <button type="button" disabled={busy} onClick={appendDraftStep}>
            添加 JSON 步骤
          </button>
          <button type="button" onClick={resetDraft}>
            重置示例
          </button>
        </div>
      </section>

      <section className="composer">
        <div className="section-title">
          <h2>AI 生成</h2>
          <span>结构化输出</span>
        </div>
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={3}
          placeholder="例如：登录系统并打开销售报表"
        />
        <textarea
          value={pageSnapshot}
          onChange={(e) => setPageSnapshot(e.target.value)}
          rows={3}
          placeholder="可粘贴页面摘要、可见控件、表单字段"
        />
        <button
          type="button"
          disabled={busy || !intent.trim()}
          onClick={generateSteps}
        >
          生成并追加步骤
        </button>
      </section>

      <section className="steps-section">
        <div className="section-title">
          <h2>步骤列表</h2>
          <div className="run-controls">
            <select
              value={runMode}
              onChange={(e) =>
                setRunMode(e.target.value as "dry-run" | "real-run")
              }
              aria-label="运行模式"
            >
              <option value="dry-run">dry-run</option>
              <option value="real-run">real-run</option>
            </select>
            <button
              className="primary"
              type="button"
              disabled={busy || !isConnected || steps.length === 0}
              onClick={runCurrentSteps}
            >
              执行并上报
            </button>
          </div>
        </div>

        <ol className="step-list">
          {steps.map((step, index) => (
            <li key={step.id || index}>
              <div className="step-main">
                <span className="step-type">{step.type}</span>
                <strong>{summarizeStep(step)}</strong>
                <small>
                  {JSON.stringify(step.target || { url: step.url })}
                </small>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`删除第 ${index + 1} 步`}
                onClick={() => removeStep(index)}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      </section>

      {lastScreenshot && (
        <section className="screenshot-preview">
          <div className="section-title">
            <h2>最近截图</h2>
            <span>PNG</span>
          </div>
          <img
            src={`data:image/png;base64,${lastScreenshot}`}
            alt="当前标签页截图预览"
          />
        </section>
      )}

      <section className="log-section">
        <div className="section-title">
          <h2>执行日志</h2>
          <span>{logs.length}</span>
        </div>
        <div className="logs" role="log" aria-live="polite">
          {logs.map((log) => (
            <p key={log.id} className={log.level}>
              <time>{log.time}</time>
              <span>{log.message}</span>
            </p>
          ))}
        </div>
      </section>
    </section>
  );
};

export default AutomationPanel;
