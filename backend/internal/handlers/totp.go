package handlers

import (
	"errors"
	"net/http"

	"backend/internal/httpx"
	"backend/internal/totp"
)

func (h *Handler) ListTOTPAccounts(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"accounts": h.totp.List(),
	})
}

func (h *Handler) CreateTOTPAccount(w http.ResponseWriter, r *http.Request) {
	var body totp.CreateAccountRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	account, err := h.totp.Create(body)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"account": account,
	})
}

func (h *Handler) UpdateTOTPAccount(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body totp.UpdateAccountRequest
	if err := httpx.DecodeJSON(r, h.cfg.MaxRequestBytes, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}

	account, err := h.totp.Update(id, body)
	if err != nil {
		if errors.Is(err, totp.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"account": account,
	})
}

func (h *Handler) DeleteTOTPAccount(w http.ResponseWriter, r *http.Request) {
	if !h.totp.Delete(r.PathValue("id")) {
		httpx.WriteError(w, http.StatusNotFound, totp.ErrNotFound.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

func (h *Handler) CreateTOTPCode(w http.ResponseWriter, r *http.Request) {
	code, err := h.totp.Code(r.PathValue("id"))
	if err != nil {
		if errors.Is(err, totp.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"code": code,
	})
}
