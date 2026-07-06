package app

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/internal/config"
)

func TestHealth(t *testing.T) {
	server := NewServer(config.Load(), slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"ok":true`)) {
		t.Fatalf("expected ok response, got %s", rec.Body.String())
	}
}

func TestOptionsCORS(t *testing.T) {
	cfg := config.Load()
	server := NewServer(cfg, slog.Default())
	req := httptest.NewRequest(http.MethodOptions, "/api/deepseek/chat/completions", nil)
	req.Header.Set("Origin", "chrome-extension://example")
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "chrome-extension://example" {
		t.Fatalf("expected chrome extension origin, got %q", got)
	}
}

func TestChatRequiresAIConfig(t *testing.T) {
	t.Setenv("AI_BASE_URL", "")
	t.Setenv("AI_API_KEY", "")
	server := NewServer(config.Load(), slog.Default())
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/deepseek/chat/completions",
		bytes.NewBufferString(`{"prompt":"hello"}`),
	)
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestListAutomationSessions(t *testing.T) {
	server := NewServer(config.Load(), slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/api/automation/sessions", nil)
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"sessions":[]`)) {
		t.Fatalf("expected empty sessions, got %s", rec.Body.String())
	}
}

func TestAutomationTaskLifecycle(t *testing.T) {
	server := NewServer(config.Load(), slog.Default())

	createTask := postJSON(t, server, "/api/automation/tasks", `{
		"name":"登录并导出报表",
		"description":"记录真实标签页自动化步骤"
	}`)
	if createTask.Code != http.StatusCreated {
		t.Fatalf("expected create task status 201, got %d: %s", createTask.Code, createTask.Body.String())
	}
	taskID := jsonPathString(t, createTask.Body.Bytes(), "task", "id")
	if taskID == "" {
		t.Fatalf("expected task id, got %s", createTask.Body.String())
	}

	saveSteps := postJSON(t, server, "/api/automation/tasks/"+taskID+"/steps", `{
		"steps":[
			{"type":"goto","url":"https://example.com/login"},
			{"type":"fill","target":{"kind":"label","text":"用户名"},"value":"admin"},
			{"type":"click","target":{"kind":"role","role":"button","name":"登录"}}
		]
	}`)
	if saveSteps.Code != http.StatusOK {
		t.Fatalf("expected save steps status 200, got %d: %s", saveSteps.Code, saveSteps.Body.String())
	}

	createRun := postJSON(t, server, "/api/automation/tasks/"+taskID+"/runs", `{
		"mode":"dry-run",
		"page":{"url":"https://example.com/login","title":"Login"}
	}`)
	if createRun.Code != http.StatusCreated {
		t.Fatalf("expected create run status 201, got %d: %s", createRun.Code, createRun.Body.String())
	}
	runID := jsonPathString(t, createRun.Body.Bytes(), "run", "id")
	if runID == "" {
		t.Fatalf("expected run id, got %s", createRun.Body.String())
	}

	event := postJSON(t, server, "/api/automation/runs/"+runID+"/events", `{
		"stepId":"step_001",
		"status":"passed",
		"durationMs":530,
		"page":{"url":"https://example.com/dashboard","title":"Dashboard"}
	}`)
	if event.Code != http.StatusCreated {
		t.Fatalf("expected event status 201, got %d: %s", event.Code, event.Body.String())
	}

	screenshot := postJSON(t, server, "/api/automation/runs/"+runID+"/screenshots", `{
		"stepId":"step_001",
		"base64":"iVBORw0KGgo=",
		"page":{"url":"https://example.com/dashboard","title":"Dashboard"}
	}`)
	if screenshot.Code != http.StatusCreated {
		t.Fatalf("expected screenshot status 201, got %d: %s", screenshot.Code, screenshot.Body.String())
	}

	getTask := httptest.NewRecorder()
	server.ServeHTTP(getTask, httptest.NewRequest(http.MethodGet, "/api/automation/tasks/"+taskID, nil))
	if getTask.Code != http.StatusOK {
		t.Fatalf("expected get task status 200, got %d: %s", getTask.Code, getTask.Body.String())
	}
	if !bytes.Contains(getTask.Body.Bytes(), []byte(`"runs":[`)) {
		t.Fatalf("expected task detail to include runs, got %s", getTask.Body.String())
	}
}

func TestAutomationTaskRejectsInvalidStep(t *testing.T) {
	server := NewServer(config.Load(), slog.Default())

	rec := postJSON(t, server, "/api/automation/tasks", `{
		"name":"bad task",
		"steps":[{"type":"eval","value":"alert(1)"}]
	}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAutomationGenerateRequiresAIConfig(t *testing.T) {
	t.Setenv("AI_BASE_URL", "")
	t.Setenv("AI_API_KEY", "")
	server := NewServer(config.Load(), slog.Default())

	rec := postJSON(t, server, "/api/automation/generate", `{"intent":"登录系统"}`)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d: %s", rec.Code, rec.Body.String())
	}
}

func postJSON(t *testing.T, server http.Handler, path string, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)
	return rec
}

func jsonPathString(t *testing.T, raw []byte, keys ...string) string {
	t.Helper()
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		t.Fatalf("invalid JSON response: %v: %s", err, string(raw))
	}
	for _, key := range keys {
		object, ok := value.(map[string]any)
		if !ok {
			return ""
		}
		value = object[key]
	}
	text, _ := value.(string)
	return text
}
