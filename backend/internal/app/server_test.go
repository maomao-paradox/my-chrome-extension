package app

import (
	"bytes"
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
