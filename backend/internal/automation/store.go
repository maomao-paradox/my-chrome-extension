package automation

import (
	"errors"
	"strings"
	"sync"
	"time"
)

type TaskStore struct {
	mu    sync.RWMutex
	tasks map[string]*Task
	runs  map[string]*Run
	now   func() time.Time
	newID func() string
}

func NewTaskStore() *TaskStore {
	return &TaskStore{
		tasks: make(map[string]*Task),
		runs:  make(map[string]*Run),
		now:   func() time.Time { return time.Now().UTC() },
		newID: newID,
	}
}

func (s *TaskStore) CreateTask(request CreateTaskRequest) (Task, error) {
	name := strings.TrimSpace(request.Name)
	if name == "" {
		return Task{}, errors.New("name is required")
	}
	if len(request.Steps) > 0 {
		if err := ValidateSteps(request.Steps); err != nil {
			return Task{}, err
		}
	}

	now := s.now()
	task := &Task{
		ID:          s.newID(),
		Name:        name,
		Description: strings.TrimSpace(request.Description),
		Steps:       normalizeSteps(request.Steps, s.newID),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	s.mu.Lock()
	s.tasks[task.ID] = task
	s.mu.Unlock()

	return cloneTask(task), nil
}

func (s *TaskStore) GetTask(id string) (Task, []Run, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	task, ok := s.tasks[id]
	if !ok {
		return Task{}, nil, ErrTaskNotFound
	}

	runs := make([]Run, 0)
	for _, run := range s.runs {
		if run.TaskID == id {
			runs = append(runs, cloneRun(run))
		}
	}
	return cloneTask(task), runs, nil
}

func (s *TaskStore) SaveSteps(taskID string, request SaveStepsRequest) (Task, error) {
	if err := ValidateSteps(request.Steps); err != nil {
		return Task{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	task, ok := s.tasks[taskID]
	if !ok {
		return Task{}, ErrTaskNotFound
	}

	steps := normalizeSteps(request.Steps, s.newID)
	if request.Replace {
		task.Steps = steps
	} else {
		task.Steps = append(task.Steps, steps...)
	}
	task.UpdatedAt = s.now()
	return cloneTask(task), nil
}

func (s *TaskStore) CreateRun(taskID string, request CreateRunRequest) (Run, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.tasks[taskID]; !ok {
		return Run{}, ErrTaskNotFound
	}

	now := s.now()
	status := strings.TrimSpace(request.Status)
	if status == "" {
		status = "queued"
	}
	mode := strings.TrimSpace(request.Mode)
	if mode == "" {
		mode = "real-run"
	}

	run := &Run{
		ID:        s.newID(),
		TaskID:    taskID,
		Status:    status,
		Mode:      mode,
		Page:      clonePageSnapshot(request.Page),
		Events:    []RunEvent{},
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.runs[run.ID] = run
	return cloneRun(run), nil
}

func (s *TaskStore) AddRunEvent(runID string, request CreateRunEventRequest) (RunEvent, Run, error) {
	status := strings.TrimSpace(request.Status)
	if status == "" {
		return RunEvent{}, Run{}, errors.New("status is required")
	}
	if request.DurationMS < 0 {
		return RunEvent{}, Run{}, errors.New("durationMs must be non-negative")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	run, ok := s.runs[runID]
	if !ok {
		return RunEvent{}, Run{}, ErrRunNotFound
	}

	event := RunEvent{
		ID:         s.newID(),
		StepID:     strings.TrimSpace(request.StepID),
		Status:     status,
		Message:    strings.TrimSpace(request.Message),
		DurationMS: request.DurationMS,
		Page:       clonePageSnapshot(request.Page),
		Result:     request.Result,
		CreatedAt:  s.now(),
	}
	run.Events = append(run.Events, event)
	run.Status = deriveRunStatus(run.Status, status)
	if event.Page != nil {
		run.Page = clonePageSnapshot(event.Page)
	}
	run.UpdatedAt = s.now()

	return event, cloneRun(run), nil
}

func (s *TaskStore) AddRunScreenshot(runID string, request CreateRunScreenshotRequest) (RunScreenshot, Run, error) {
	contentType := strings.TrimSpace(request.ContentType)
	if contentType == "" {
		contentType = "image/png"
	}
	if strings.TrimSpace(request.Base64) == "" && strings.TrimSpace(request.Path) == "" {
		return RunScreenshot{}, Run{}, errors.New("base64 or path is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	run, ok := s.runs[runID]
	if !ok {
		return RunScreenshot{}, Run{}, ErrRunNotFound
	}

	screenshot := RunScreenshot{
		ID:          s.newID(),
		StepID:      strings.TrimSpace(request.StepID),
		ContentType: contentType,
		Base64:      strings.TrimSpace(request.Base64),
		Path:        strings.TrimSpace(request.Path),
		Page:        clonePageSnapshot(request.Page),
		CreatedAt:   s.now(),
	}
	run.Screenshots = append(run.Screenshots, screenshot)
	if screenshot.Page != nil {
		run.Page = clonePageSnapshot(screenshot.Page)
	}
	run.UpdatedAt = s.now()

	return screenshot, cloneRun(run), nil
}

func normalizeSteps(steps []Step, newID func() string) []Step {
	normalized := make([]Step, len(steps))
	for i, step := range steps {
		step.ID = strings.TrimSpace(step.ID)
		if step.ID == "" {
			step.ID = "step_" + newID()
		}
		step.Type = strings.ToLower(strings.TrimSpace(step.Type))
		step.URL = strings.TrimSpace(step.URL)
		step.Key = strings.TrimSpace(step.Key)
		if step.Target != nil {
			target := *step.Target
			target.Kind = strings.ToLower(strings.TrimSpace(target.Kind))
			target.Role = strings.TrimSpace(target.Role)
			target.Name = strings.TrimSpace(target.Name)
			target.Text = strings.TrimSpace(target.Text)
			target.Selector = strings.TrimSpace(target.Selector)
			target.Placeholder = strings.TrimSpace(target.Placeholder)
			target.TestID = strings.TrimSpace(target.TestID)
			step.Target = &target
		}
		normalized[i] = step
	}
	return normalized
}

func deriveRunStatus(current, eventStatus string) string {
	switch strings.ToLower(strings.TrimSpace(eventStatus)) {
	case "failed", "error":
		return "failed"
	case "completed":
		return "completed"
	case "running", "started":
		if current == "queued" {
			return "running"
		}
	case "passed":
		if current == "queued" || current == "running" {
			return "running"
		}
	}
	return current
}

func cloneTask(task *Task) Task {
	cloned := *task
	cloned.Steps = cloneSteps(task.Steps)
	return cloned
}

func cloneSteps(steps []Step) []Step {
	cloned := make([]Step, len(steps))
	for i, step := range steps {
		cloned[i] = step
		if step.Target != nil {
			target := *step.Target
			cloned[i].Target = &target
		}
	}
	return cloned
}

func cloneRun(run *Run) Run {
	cloned := *run
	cloned.Page = clonePageSnapshot(run.Page)
	cloned.Events = make([]RunEvent, len(run.Events))
	for i, event := range run.Events {
		cloned.Events[i] = event
		cloned.Events[i].Page = clonePageSnapshot(event.Page)
	}
	cloned.Screenshots = make([]RunScreenshot, len(run.Screenshots))
	for i, screenshot := range run.Screenshots {
		cloned.Screenshots[i] = screenshot
		cloned.Screenshots[i].Page = clonePageSnapshot(screenshot.Page)
	}
	return cloned
}

func clonePageSnapshot(page *PageSnapshot) *PageSnapshot {
	if page == nil {
		return nil
	}
	cloned := *page
	return &cloned
}
