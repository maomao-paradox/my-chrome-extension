package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model        string        `json:"model,omitempty"`
	Messages     []ChatMessage `json:"messages,omitempty"`
	Prompt       string        `json:"prompt,omitempty"`
	Role         string        `json:"role,omitempty"`
	SystemPrompt string        `json:"systemPrompt,omitempty"`
	Stream       bool          `json:"stream,omitempty"`
}

type ChatResponse struct {
	OK      bool   `json:"ok"`
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
	Raw     any    `json:"raw,omitempty"`
}

func NewClient(baseURL, apiKey, model string, timeout time.Duration) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		model:   model,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) Enabled() bool {
	return c.baseURL != "" && c.apiKey != ""
}

func (c *Client) DefaultModel() string {
	return c.model
}

func (c *Client) CreateCompletionRequest(ctx context.Context, request ChatRequest) (*http.Request, error) {
	if !c.Enabled() {
		return nil, errors.New("AI proxy is not configured")
	}

	messages := request.Messages
	if len(messages) == 0 {
		if strings.TrimSpace(request.SystemPrompt) != "" {
			messages = append(messages, ChatMessage{
				Role:    "system",
				Content: strings.TrimSpace(request.SystemPrompt),
			})
		}
		if strings.TrimSpace(request.Prompt) != "" {
			messages = append(messages, ChatMessage{
				Role:    "user",
				Content: strings.TrimSpace(request.Prompt),
			})
		}
	}

	if len(messages) == 0 {
		return nil, errors.New("messages or prompt is required")
	}

	model := strings.TrimSpace(request.Model)
	if model == "" {
		model = c.model
	}

	body := map[string]any{
		"model":    model,
		"messages": messages,
		"stream":   request.Stream,
	}

	rawBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(rawBody))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream, application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	return req, nil
}

func (c *Client) Do(req *http.Request) (*http.Response, error) {
	return c.httpClient.Do(req)
}

func ExtractContent(payload map[string]any) string {
	choices, _ := payload["choices"].([]any)
	if len(choices) == 0 {
		return ""
	}

	first, _ := choices[0].(map[string]any)
	message, _ := first["message"].(map[string]any)
	content, _ := message["content"].(string)
	return content
}

func DecodeUpstreamError(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	text := strings.TrimSpace(string(body))
	if text == "" {
		text = resp.Status
	}
	return fmt.Errorf("AI upstream returned %d: %s", resp.StatusCode, text)
}
