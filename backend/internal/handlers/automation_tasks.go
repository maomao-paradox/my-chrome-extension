package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"backend/internal/ai"
	"backend/internal/automation"
	"backend/internal/httpx"
)

func (h *Handler) CreateAutomationTask(w http.ResponseWriter, r *http.Request) {
	var body automation.CreateTaskRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	task, err := h.tasks.CreateTask(body)
	if err != nil {
		writeAutomationTaskError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"ok":   true,
		"task": task,
	})
}

func (h *Handler) GetAutomationTask(w http.ResponseWriter, r *http.Request) {
	task, runs, err := h.tasks.GetTask(r.PathValue("id"))
	if err != nil {
		writeAutomationTaskError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"task": task,
		"runs": runs,
	})
}

func (h *Handler) SaveAutomationTaskSteps(w http.ResponseWriter, r *http.Request) {
	var body automation.SaveStepsRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	task, err := h.tasks.SaveSteps(r.PathValue("id"), body)
	if err != nil {
		writeAutomationTaskError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"task": task,
	})
}

func (h *Handler) CreateAutomationRun(w http.ResponseWriter, r *http.Request) {
	var body automation.CreateRunRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
			return
		}
	}

	run, err := h.tasks.CreateRun(r.PathValue("id"), body)
	if err != nil {
		writeAutomationTaskError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"ok":  true,
		"run": run,
	})
}

func (h *Handler) CreateAutomationRunEvent(w http.ResponseWriter, r *http.Request) {
	var body automation.CreateRunEventRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	event, run, err := h.tasks.AddRunEvent(r.PathValue("id"), body)
	if err != nil {
		writeAutomationTaskError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"event": event,
		"run":   run,
	})
}

func (h *Handler) CreateAutomationRunScreenshot(w http.ResponseWriter, r *http.Request) {
	var body automation.CreateRunScreenshotRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	screenshot, run, err := h.tasks.AddRunScreenshot(r.PathValue("id"), body)
	if err != nil {
		writeAutomationTaskError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"ok":         true,
		"screenshot": screenshot,
		"run":        run,
	})
}

func (h *Handler) GenerateAutomationSteps(w http.ResponseWriter, r *http.Request) {
	var body automation.GenerateStepsRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}
	if strings.TrimSpace(body.Intent) == "" {
		httpx.WriteError(w, http.StatusBadRequest, "intent is required")
		return
	}

	upstreamReq, err := h.aiClient.CreateCompletionRequest(r.Context(), ai.ChatRequest{
		SystemPrompt: automationGenerateSystemPrompt(),
		Prompt:       automationGenerateUserPrompt(body),
		Stream:       false,
	})
	if err != nil {
		status := http.StatusBadRequest
		if !h.aiClient.Enabled() {
			status = http.StatusServiceUnavailable
		}
		httpx.WriteError(w, status, err.Error())
		return
	}

	upstreamResp, err := h.aiClient.Do(upstreamReq)
	if err != nil {
		h.logger.Warn("AI automation generation failed", "error", err)
		httpx.WriteError(w, http.StatusBadGateway, "AI upstream request failed")
		return
	}
	defer upstreamResp.Body.Close()

	if upstreamResp.StatusCode < 200 || upstreamResp.StatusCode >= 300 {
		err := ai.DecodeUpstreamError(upstreamResp)
		httpx.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	var payload map[string]any
	if err := json.NewDecoder(upstreamResp.Body).Decode(&payload); err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "invalid AI upstream JSON response")
		return
	}

	generated, err := parseGeneratedSteps(ai.ExtractContent(payload))
	if err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "invalid AI generated steps: "+err.Error())
		return
	}
	if err := automation.ValidateSteps(generated.Steps); err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "invalid AI generated steps: "+err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"steps": generated.Steps,
		"raw":   payload,
	})
}

func automationGenerateSystemPrompt() string {
	return strings.Join([]string{
		"You generate safe Chrome extension automation steps.",
		"Return only JSON with this shape: {\"steps\":[...]}",
		"Allowed step types: goto, click, fill, press, wait, extract, screenshot, verifyText.",
		"Allowed target kinds: role, label, placeholder, text, testid, css.",
		"Do not output JavaScript, eval, cookies, history, bookmark, filesystem, or network-exfiltration instructions.",
		"For destructive, payment, submission, deletion, or message-sending actions, add a wait/verifyText step before the risky click instead of performing it directly.",
	}, "\n")
}

func automationGenerateUserPrompt(request automation.GenerateStepsRequest) string {
	actions := request.AvailableActions
	if len(actions) == 0 {
		actions = []string{"goto", "click", "fill", "press", "wait", "extract", "screenshot", "verifyText"}
	}

	payload := map[string]any{
		"intent":           strings.TrimSpace(request.Intent),
		"pageSnapshot":     strings.TrimSpace(request.PageSnapshot),
		"availableActions": actions,
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}

func parseGeneratedSteps(content string) (automation.GeneratedStepsResponse, error) {
	content = strings.TrimSpace(content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var generated automation.GeneratedStepsResponse
	if err := json.Unmarshal([]byte(content), &generated); err != nil {
		return automation.GeneratedStepsResponse{}, err
	}
	if len(generated.Steps) == 0 {
		return automation.GeneratedStepsResponse{}, errors.New("steps are required")
	}
	return generated, nil
}

func writeAutomationTaskError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, automation.ErrTaskNotFound), errors.Is(err, automation.ErrRunNotFound):
		httpx.WriteError(w, http.StatusNotFound, err.Error())
	default:
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
	}
}
