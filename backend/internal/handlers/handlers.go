package handlers

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"backend/internal/ai"
	"backend/internal/automation"
	"backend/internal/config"
	"backend/internal/httpx"
	"backend/internal/totp"
)

type Handler struct {
	cfg      config.Config
	logger   *slog.Logger
	aiClient *ai.Client
	sessions *SessionStore
	auto     *automation.Service
	tasks    *automation.TaskStore
	totp     *totp.Store
}

type SessionStore struct {
	mu       sync.Mutex
	cleared  map[string]time.Time
	modified time.Time
}

func New(cfg config.Config, logger *slog.Logger) *Handler {
	return &Handler{
		cfg:      cfg,
		logger:   logger,
		aiClient: ai.NewClient(cfg.AIBaseURL, cfg.AIAPIKey, cfg.AIModel, cfg.AITimeout),
		sessions: &SessionStore{
			cleared:  make(map[string]time.Time),
			modified: time.Now().UTC(),
		},
		auto:  automation.NewService(),
		tasks: automation.NewTaskStore(),
		totp:  totp.NewStore(),
	}
}

func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"service":   "kria-nove-extension-backend",
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (h *Handler) Ready(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"aiEnabled":  h.aiClient.Enabled(),
		"defaultAI":  h.aiClient.DefaultModel(),
		"automation": true,
		"sessionTTL": "memory",
	})
}

func (h *Handler) ExtensionConfig(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "private, max-age="+formatSeconds(h.cfg.ExtensionConfigTTL))
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"ai": map[string]any{
			"enabled":      h.aiClient.Enabled(),
			"defaultModel": h.aiClient.DefaultModel(),
			"endpoints": map[string]string{
				"chat":         "/api/deepseek/chat/completions",
				"sessionClear": "/api/deepseek/session/clear",
			},
		},
		"automation": map[string]any{
			"enabled": true,
			"endpoints": map[string]string{
				"sessions": "/api/automation/sessions",
				"tasks":    "/api/automation/tasks",
				"generate": "/api/automation/generate",
			},
		},
	})
}

func (h *Handler) Models(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"object": "list",
		"data": []map[string]any{
			{
				"id":      h.aiClient.DefaultModel(),
				"object":  "model",
				"ownedBy": "configured-upstream",
			},
		},
	})
}

func (h *Handler) ChatCompletions(w http.ResponseWriter, r *http.Request) {
	var body ai.ChatRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	upstreamReq, err := h.aiClient.CreateCompletionRequest(r.Context(), body)
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
		h.logger.Warn("AI upstream request failed", "error", err)
		httpx.WriteError(w, http.StatusBadGateway, "AI upstream request failed")
		return
	}
	defer upstreamResp.Body.Close()

	if upstreamResp.StatusCode < 200 || upstreamResp.StatusCode >= 300 {
		err := ai.DecodeUpstreamError(upstreamResp)
		httpx.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	if body.Stream {
		h.streamUpstream(w, upstreamResp)
		return
	}

	var payload map[string]any
	if err := json.NewDecoder(upstreamResp.Body).Decode(&payload); err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "invalid AI upstream JSON response")
		return
	}

	if acceptsOpenAIShape(r.URL.Path) {
		httpx.WriteJSON(w, http.StatusOK, payload)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, ai.ChatResponse{
		OK:      true,
		Role:    defaultRole(body.Role),
		Content: ai.ExtractContent(payload),
		Raw:     payload,
	})
}

func (h *Handler) ClearSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Role string `json:"role"`
	}

	if r.Body != nil && r.ContentLength != 0 {
		if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
			return
		}
	}

	role := defaultRole(body.Role)
	h.sessions.Clear(role)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"role": role,
	})
}

func (h *Handler) streamUpstream(w http.ResponseWriter, upstreamResp *http.Response) {
	for key, values := range upstreamResp.Header {
		lowerKey := strings.ToLower(key)
		if lowerKey == "content-length" || lowerKey == "content-encoding" {
			continue
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.WriteHeader(http.StatusOK)

	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	_, _ = io.Copy(w, upstreamResp.Body)
}

func (s *SessionStore) Clear(role string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cleared[role] = time.Now().UTC()
	s.modified = time.Now().UTC()
}

func defaultRole(role string) string {
	role = strings.TrimSpace(role)
	if role == "" {
		return "default_ai_assistant"
	}
	return role
}

func acceptsOpenAIShape(path string) bool {
	return path == "/v1/chat/completions" || path == "/api/v1/chat/completions"
}

func formatSeconds(duration time.Duration) string {
	seconds := int(duration.Seconds())
	if seconds < 0 {
		seconds = 0
	}
	return strconv.Itoa(seconds)
}
