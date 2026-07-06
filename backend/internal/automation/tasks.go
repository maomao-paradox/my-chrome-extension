package automation

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

type StepTarget struct {
	Kind        string `json:"kind"`
	Role        string `json:"role,omitempty"`
	Name        string `json:"name,omitempty"`
	Text        string `json:"text,omitempty"`
	Selector    string `json:"selector,omitempty"`
	Placeholder string `json:"placeholder,omitempty"`
	TestID      string `json:"testId,omitempty"`
}

type Step struct {
	ID        string      `json:"id"`
	Type      string      `json:"type"`
	Target    *StepTarget `json:"target,omitempty"`
	URL       string      `json:"url,omitempty"`
	Value     string      `json:"value,omitempty"`
	Key       string      `json:"key,omitempty"`
	TimeoutMS int         `json:"timeoutMs,omitempty"`
	All       bool        `json:"all,omitempty"`
}

type Task struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Steps       []Step    `json:"steps"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type PageSnapshot struct {
	URL   string `json:"url,omitempty"`
	Title string `json:"title,omitempty"`
}

type Run struct {
	ID          string          `json:"id"`
	TaskID      string          `json:"taskId"`
	Status      string          `json:"status"`
	Mode        string          `json:"mode"`
	Page        *PageSnapshot   `json:"page,omitempty"`
	Events      []RunEvent      `json:"events"`
	Screenshots []RunScreenshot `json:"screenshots"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

type RunEvent struct {
	ID         string        `json:"id"`
	StepID     string        `json:"stepId,omitempty"`
	Status     string        `json:"status"`
	Message    string        `json:"message,omitempty"`
	DurationMS int           `json:"durationMs,omitempty"`
	Page       *PageSnapshot `json:"page,omitempty"`
	Result     any           `json:"result,omitempty"`
	CreatedAt  time.Time     `json:"createdAt"`
}

type RunScreenshot struct {
	ID          string        `json:"id"`
	StepID      string        `json:"stepId,omitempty"`
	ContentType string        `json:"contentType"`
	Base64      string        `json:"base64,omitempty"`
	Path        string        `json:"path,omitempty"`
	Page        *PageSnapshot `json:"page,omitempty"`
	CreatedAt   time.Time     `json:"createdAt"`
}

type CreateTaskRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Steps       []Step `json:"steps,omitempty"`
}

type SaveStepsRequest struct {
	Steps   []Step `json:"steps"`
	Replace bool   `json:"replace,omitempty"`
}

type CreateRunRequest struct {
	Mode   string        `json:"mode,omitempty"`
	Status string        `json:"status,omitempty"`
	Page   *PageSnapshot `json:"page,omitempty"`
}

type CreateRunEventRequest struct {
	StepID     string        `json:"stepId,omitempty"`
	Status     string        `json:"status"`
	Message    string        `json:"message,omitempty"`
	DurationMS int           `json:"durationMs,omitempty"`
	Page       *PageSnapshot `json:"page,omitempty"`
	Result     any           `json:"result,omitempty"`
}

type CreateRunScreenshotRequest struct {
	StepID      string        `json:"stepId,omitempty"`
	ContentType string        `json:"contentType,omitempty"`
	Base64      string        `json:"base64,omitempty"`
	Path        string        `json:"path,omitempty"`
	Page        *PageSnapshot `json:"page,omitempty"`
}

type GenerateStepsRequest struct {
	Intent           string   `json:"intent"`
	PageSnapshot     string   `json:"pageSnapshot,omitempty"`
	AvailableActions []string `json:"availableActions,omitempty"`
}

type GeneratedStepsResponse struct {
	Steps []Step `json:"steps"`
}

var (
	ErrTaskNotFound = errors.New("automation task not found")
	ErrRunNotFound  = errors.New("automation run not found")
)

func ValidateSteps(steps []Step) error {
	if len(steps) == 0 {
		return errors.New("steps are required")
	}
	for i := range steps {
		if err := validateStep(steps[i]); err != nil {
			return fmt.Errorf("step %d: %w", i, err)
		}
	}
	return nil
}

func validateStep(step Step) error {
	stepType := strings.ToLower(strings.TrimSpace(step.Type))
	switch stepType {
	case "goto":
		if strings.TrimSpace(step.URL) == "" {
			return errors.New("url is required for goto")
		}
		if err := validateURL(step.URL); err != nil {
			return err
		}
	case "click", "wait", "extract", "verifytext":
		return validateTarget(step.Target)
	case "fill":
		if err := validateTarget(step.Target); err != nil {
			return err
		}
	case "press":
		if strings.TrimSpace(step.Key) == "" {
			return errors.New("key is required for press")
		}
		if step.Target != nil {
			return validateTarget(step.Target)
		}
	case "screenshot":
		return nil
	default:
		return fmt.Errorf("unsupported step type %q", step.Type)
	}
	return nil
}

func validateTarget(target *StepTarget) error {
	if target == nil {
		return errors.New("target is required")
	}
	switch strings.ToLower(strings.TrimSpace(target.Kind)) {
	case "role":
		if strings.TrimSpace(target.Role) == "" {
			return errors.New("target.role is required")
		}
	case "label", "text":
		if strings.TrimSpace(target.Text) == "" {
			return errors.New("target.text is required")
		}
	case "css":
		if strings.TrimSpace(target.Selector) == "" {
			return errors.New("target.selector is required")
		}
	case "placeholder":
		if strings.TrimSpace(target.Placeholder) == "" {
			return errors.New("target.placeholder is required")
		}
	case "testid":
		if strings.TrimSpace(target.TestID) == "" {
			return errors.New("target.testId is required")
		}
	default:
		return fmt.Errorf("unsupported target kind %q", target.Kind)
	}
	return nil
}
