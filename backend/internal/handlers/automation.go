package handlers

import (
	"encoding/base64"
	"errors"
	"net/http"

	"backend/internal/automation"
	"backend/internal/httpx"
)

func (h *Handler) ListAutomationSessions(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"sessions": h.auto.ListSessions(),
	})
}

func (h *Handler) CreateAutomationSession(w http.ResponseWriter, r *http.Request) {
	var body automation.CreateSessionRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	session, state, err := h.auto.CreateSession(r.Context(), body)
	if err != nil {
		writeAutomationError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"session": publicSession(session),
		"page":    state,
	})
}

func (h *Handler) NavigateAutomationSession(w http.ResponseWriter, r *http.Request) {
	var body automation.NavigateRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	state, err := h.auto.Navigate(r.Context(), r.PathValue("id"), body)
	if err != nil {
		writeAutomationError(w, err)
		return
	}

	writeActionOK(w, state)
}

func (h *Handler) ClickAutomationSession(w http.ResponseWriter, r *http.Request) {
	var body automation.SelectorRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	state, err := h.auto.Click(r.PathValue("id"), body)
	if err != nil {
		writeAutomationError(w, err)
		return
	}

	writeActionOK(w, state)
}

func (h *Handler) FillAutomationSession(w http.ResponseWriter, r *http.Request) {
	var body automation.FillRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	state, err := h.auto.Fill(r.PathValue("id"), body)
	if err != nil {
		writeAutomationError(w, err)
		return
	}

	writeActionOK(w, state)
}

func (h *Handler) PressAutomationSession(w http.ResponseWriter, r *http.Request) {
	var body automation.PressRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	state, err := h.auto.Press(r.PathValue("id"), body)
	if err != nil {
		writeAutomationError(w, err)
		return
	}

	writeActionOK(w, state)
}

func (h *Handler) WaitAutomationSession(w http.ResponseWriter, r *http.Request) {
	var body automation.WaitRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	state, err := h.auto.WaitForSelector(r.PathValue("id"), body)
	if err != nil {
		writeAutomationError(w, err)
		return
	}

	writeActionOK(w, state)
}

func (h *Handler) ExtractAutomationSession(w http.ResponseWriter, r *http.Request) {
	var body automation.ExtractRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	result, state, err := h.auto.ExtractText(r.PathValue("id"), body)
	if err != nil {
		writeAutomationError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"page":   state,
		"result": result,
	})
}

func (h *Handler) ScreenshotAutomationSession(w http.ResponseWriter, r *http.Request) {
	var body automation.ScreenshotRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
			return
		}
	}

	bytes, state, err := h.auto.Screenshot(r.PathValue("id"), body)
	if err != nil {
		writeAutomationError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"page":        state,
		"contentType": "image/png",
		"base64":      base64.StdEncoding.EncodeToString(bytes),
	})
}

func (h *Handler) CloseAutomationSession(w http.ResponseWriter, r *http.Request) {
	if err := h.auto.CloseSession(r.PathValue("id")); err != nil {
		writeAutomationError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

func publicSession(session *automation.Session) map[string]any {
	return map[string]any{
		"id":        session.ID,
		"browser":   session.Browser,
		"headless":  session.Headless,
		"createdAt": session.CreatedAt,
		"updatedAt": session.UpdatedAt,
	}
}

func writeActionOK(w http.ResponseWriter, state automation.PageState) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"page": state,
	})
}

func writeAutomationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, automation.ErrSessionNotFound):
		httpx.WriteError(w, http.StatusNotFound, err.Error())
	default:
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
	}
}
