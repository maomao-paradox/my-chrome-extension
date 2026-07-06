package app

import (
	"log/slog"
	"net/http"

	"backend/internal/config"
	"backend/internal/handlers"
	"backend/internal/httpx"
)

func NewServer(cfg config.Config, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	handler := handlers.New(cfg, logger)

	mux.HandleFunc("GET /health", handler.Health)
	mux.HandleFunc("GET /api/health", handler.Health)
	mux.HandleFunc("GET /api/deepseek/health", handler.Health)
	mux.HandleFunc("GET /readyz", handler.Ready)
	mux.HandleFunc("GET /api/v1/extension/config", handler.ExtensionConfig)
	mux.HandleFunc("GET /api/automation/sessions", handler.ListAutomationSessions)
	mux.HandleFunc("POST /api/automation/sessions", handler.CreateAutomationSession)
	mux.HandleFunc("POST /api/automation/sessions/{id}/navigate", handler.NavigateAutomationSession)
	mux.HandleFunc("POST /api/automation/sessions/{id}/click", handler.ClickAutomationSession)
	mux.HandleFunc("POST /api/automation/sessions/{id}/fill", handler.FillAutomationSession)
	mux.HandleFunc("POST /api/automation/sessions/{id}/press", handler.PressAutomationSession)
	mux.HandleFunc("POST /api/automation/sessions/{id}/wait", handler.WaitAutomationSession)
	mux.HandleFunc("POST /api/automation/sessions/{id}/extract", handler.ExtractAutomationSession)
	mux.HandleFunc("POST /api/automation/sessions/{id}/screenshot", handler.ScreenshotAutomationSession)
	mux.HandleFunc("DELETE /api/automation/sessions/{id}", handler.CloseAutomationSession)
	mux.HandleFunc("GET /v1/models", handler.Models)
	mux.HandleFunc("POST /v1/chat/completions", handler.ChatCompletions)
	mux.HandleFunc("POST /api/v1/chat/completions", handler.ChatCompletions)
	mux.HandleFunc("POST /api/deepseek/chat", handler.ChatCompletions)
	mux.HandleFunc("POST /api/deepseek/chat/completions", handler.ChatCompletions)
	mux.HandleFunc("POST /api/deepseek/session/clear", handler.ClearSession)

	return httpx.Chain(
		mux,
		httpx.Recover(logger),
		httpx.RequestID,
		httpx.AccessLog(logger),
		httpx.SecurityHeaders,
		httpx.CORS(cfg),
		httpx.OptionalBearerAuth(cfg.APIToken),
	)
}
