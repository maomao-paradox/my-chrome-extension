package automation

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/mxschmitt/playwright-go"
)

type Service struct {
	mu       sync.RWMutex
	pw       *playwright.Playwright
	sessions map[string]*Session
	now      func() time.Time
}

type Session struct {
	ID        string    `json:"id"`
	Browser   string    `json:"browser"`
	Headless  bool      `json:"headless"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	browser playwright.Browser
	context playwright.BrowserContext
	page    playwright.Page
	mu      sync.Mutex
}

type CreateSessionRequest struct {
	Browser          string            `json:"browser,omitempty"`
	Headless         *bool             `json:"headless,omitempty"`
	URL              string            `json:"url,omitempty"`
	Viewport         *Viewport         `json:"viewport,omitempty"`
	UserAgent        string            `json:"userAgent,omitempty"`
	ExtraHTTPHeaders map[string]string `json:"extraHTTPHeaders,omitempty"`
}

type Viewport struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type NavigateRequest struct {
	URL       string  `json:"url"`
	WaitUntil string  `json:"waitUntil,omitempty"`
	TimeoutMS float64 `json:"timeoutMs,omitempty"`
}

type SelectorRequest struct {
	Selector  string  `json:"selector"`
	TimeoutMS float64 `json:"timeoutMs,omitempty"`
	Force     bool    `json:"force,omitempty"`
}

type FillRequest struct {
	Selector  string  `json:"selector"`
	Value     string  `json:"value"`
	TimeoutMS float64 `json:"timeoutMs,omitempty"`
	Force     bool    `json:"force,omitempty"`
}

type PressRequest struct {
	Selector  string  `json:"selector"`
	Key       string  `json:"key"`
	TimeoutMS float64 `json:"timeoutMs,omitempty"`
	DelayMS   float64 `json:"delayMs,omitempty"`
}

type WaitRequest struct {
	Selector  string  `json:"selector"`
	TimeoutMS float64 `json:"timeoutMs,omitempty"`
}

type ExtractRequest struct {
	Selector string `json:"selector"`
	All      bool   `json:"all,omitempty"`
}

type ScreenshotRequest struct {
	FullPage bool `json:"fullPage,omitempty"`
}

type PageState struct {
	SessionID string `json:"sessionId"`
	URL       string `json:"url"`
	Title     string `json:"title"`
}

func NewService() *Service {
	return &Service{
		sessions: make(map[string]*Session),
		now:      func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) CreateSession(ctx context.Context, request CreateSessionRequest) (*Session, PageState, error) {
	pw, err := s.playwright()
	if err != nil {
		return nil, PageState{}, err
	}

	browserName := normalizeBrowser(request.Browser)
	headless := true
	if request.Headless != nil {
		headless = *request.Headless
	}

	browserType, err := browserType(pw, browserName)
	if err != nil {
		return nil, PageState{}, err
	}

	browser, err := browserType.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(headless),
	})
	if err != nil {
		return nil, PageState{}, fmt.Errorf("launch %s browser: %w", browserName, err)
	}

	contextOptions := playwright.BrowserNewContextOptions{}
	if request.Viewport != nil {
		if request.Viewport.Width <= 0 || request.Viewport.Height <= 0 {
			_ = browser.Close()
			return nil, PageState{}, errors.New("viewport width and height must be positive")
		}
		contextOptions.Viewport = &playwright.Size{
			Width:  request.Viewport.Width,
			Height: request.Viewport.Height,
		}
	}
	if strings.TrimSpace(request.UserAgent) != "" {
		contextOptions.UserAgent = playwright.String(strings.TrimSpace(request.UserAgent))
	}
	if len(request.ExtraHTTPHeaders) > 0 {
		contextOptions.ExtraHttpHeaders = request.ExtraHTTPHeaders
	}

	browserContext, err := browser.NewContext(contextOptions)
	if err != nil {
		_ = browser.Close()
		return nil, PageState{}, fmt.Errorf("create browser context: %w", err)
	}

	page, err := browserContext.NewPage()
	if err != nil {
		_ = browserContext.Close()
		_ = browser.Close()
		return nil, PageState{}, fmt.Errorf("create page: %w", err)
	}

	session := &Session{
		ID:        newID(),
		Browser:   browserName,
		Headless:  headless,
		CreatedAt: s.now(),
		UpdatedAt: s.now(),
		browser:   browser,
		context:   browserContext,
		page:      page,
	}

	s.mu.Lock()
	s.sessions[session.ID] = session
	s.mu.Unlock()

	if strings.TrimSpace(request.URL) != "" {
		if _, err := s.Navigate(ctx, session.ID, NavigateRequest{URL: request.URL}); err != nil {
			_ = s.CloseSession(session.ID)
			return nil, PageState{}, err
		}
	}

	state, err := session.state()
	if err != nil {
		_ = s.CloseSession(session.ID)
		return nil, PageState{}, err
	}
	return session, state, nil
}

func (s *Service) ListSessions() []Session {
	s.mu.RLock()
	defer s.mu.RUnlock()

	items := make([]Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		session.mu.Lock()
		items = append(items, Session{
			ID:        session.ID,
			Browser:   session.Browser,
			Headless:  session.Headless,
			CreatedAt: session.CreatedAt,
			UpdatedAt: session.UpdatedAt,
		})
		session.mu.Unlock()
	}
	return items
}

func (s *Service) Navigate(_ context.Context, id string, request NavigateRequest) (PageState, error) {
	if err := validateURL(request.URL); err != nil {
		return PageState{}, err
	}

	session, err := s.getSession(id)
	if err != nil {
		return PageState{}, err
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	options := playwright.PageGotoOptions{}
	if request.TimeoutMS > 0 {
		options.Timeout = playwright.Float(request.TimeoutMS)
	}
	if request.WaitUntil != "" {
		waitUntil, err := waitUntilState(request.WaitUntil)
		if err != nil {
			return PageState{}, err
		}
		options.WaitUntil = &waitUntil
	}

	if _, err := session.page.Goto(request.URL, options); err != nil {
		return PageState{}, err
	}
	session.UpdatedAt = s.now()
	return session.stateLocked()
}

func (s *Service) Click(id string, request SelectorRequest) (PageState, error) {
	session, err := s.getSession(id)
	if err != nil {
		return PageState{}, err
	}
	if strings.TrimSpace(request.Selector) == "" {
		return PageState{}, errors.New("selector is required")
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	options := playwright.LocatorClickOptions{
		Force: playwright.Bool(request.Force),
	}
	if request.TimeoutMS > 0 {
		options.Timeout = playwright.Float(request.TimeoutMS)
	}

	if err := session.page.Locator(request.Selector).Click(options); err != nil {
		return PageState{}, err
	}
	session.UpdatedAt = s.now()
	return session.stateLocked()
}

func (s *Service) Fill(id string, request FillRequest) (PageState, error) {
	session, err := s.getSession(id)
	if err != nil {
		return PageState{}, err
	}
	if strings.TrimSpace(request.Selector) == "" {
		return PageState{}, errors.New("selector is required")
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	options := playwright.LocatorFillOptions{
		Force: playwright.Bool(request.Force),
	}
	if request.TimeoutMS > 0 {
		options.Timeout = playwright.Float(request.TimeoutMS)
	}

	if err := session.page.Locator(request.Selector).Fill(request.Value, options); err != nil {
		return PageState{}, err
	}
	session.UpdatedAt = s.now()
	return session.stateLocked()
}

func (s *Service) Press(id string, request PressRequest) (PageState, error) {
	session, err := s.getSession(id)
	if err != nil {
		return PageState{}, err
	}
	if strings.TrimSpace(request.Selector) == "" {
		return PageState{}, errors.New("selector is required")
	}
	if strings.TrimSpace(request.Key) == "" {
		return PageState{}, errors.New("key is required")
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	options := playwright.LocatorPressOptions{}
	if request.TimeoutMS > 0 {
		options.Timeout = playwright.Float(request.TimeoutMS)
	}
	if request.DelayMS > 0 {
		options.Delay = playwright.Float(request.DelayMS)
	}

	if err := session.page.Locator(request.Selector).Press(request.Key, options); err != nil {
		return PageState{}, err
	}
	session.UpdatedAt = s.now()
	return session.stateLocked()
}

func (s *Service) WaitForSelector(id string, request WaitRequest) (PageState, error) {
	session, err := s.getSession(id)
	if err != nil {
		return PageState{}, err
	}
	if strings.TrimSpace(request.Selector) == "" {
		return PageState{}, errors.New("selector is required")
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	options := playwright.LocatorWaitForOptions{}
	if request.TimeoutMS > 0 {
		options.Timeout = playwright.Float(request.TimeoutMS)
	}

	if err := session.page.Locator(request.Selector).WaitFor(options); err != nil {
		return PageState{}, err
	}
	session.UpdatedAt = s.now()
	return session.stateLocked()
}

func (s *Service) ExtractText(id string, request ExtractRequest) (any, PageState, error) {
	session, err := s.getSession(id)
	if err != nil {
		return nil, PageState{}, err
	}
	if strings.TrimSpace(request.Selector) == "" {
		return nil, PageState{}, errors.New("selector is required")
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	locator := session.page.Locator(request.Selector)
	var result any
	if request.All {
		texts, err := locator.AllTextContents()
		if err != nil {
			return nil, PageState{}, err
		}
		result = texts
	} else {
		text, err := locator.TextContent()
		if err != nil {
			return nil, PageState{}, err
		}
		result = text
	}

	session.UpdatedAt = s.now()
	state, err := session.stateLocked()
	return result, state, err
}

func (s *Service) Screenshot(id string, request ScreenshotRequest) ([]byte, PageState, error) {
	session, err := s.getSession(id)
	if err != nil {
		return nil, PageState{}, err
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	bytes, err := session.page.Screenshot(playwright.PageScreenshotOptions{
		FullPage: playwright.Bool(request.FullPage),
	})
	if err != nil {
		return nil, PageState{}, err
	}

	session.UpdatedAt = s.now()
	state, err := session.stateLocked()
	return bytes, state, err
}

func (s *Service) CloseSession(id string) error {
	s.mu.Lock()
	session, ok := s.sessions[id]
	if ok {
		delete(s.sessions, id)
	}
	s.mu.Unlock()

	if !ok {
		return ErrSessionNotFound
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	contextErr := session.context.Close()
	browserErr := session.browser.Close()
	if contextErr != nil {
		return contextErr
	}
	return browserErr
}

func (s *Service) CloseAll() {
	s.mu.Lock()
	ids := make([]string, 0, len(s.sessions))
	for id := range s.sessions {
		ids = append(ids, id)
	}
	s.mu.Unlock()

	for _, id := range ids {
		_ = s.CloseSession(id)
	}

	s.mu.Lock()
	pw := s.pw
	s.pw = nil
	s.mu.Unlock()
	if pw != nil {
		_ = pw.Stop()
	}
}

var ErrSessionNotFound = errors.New("automation session not found")

func (s *Service) playwright() (*playwright.Playwright, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pw != nil {
		return s.pw, nil
	}

	pw, err := playwright.Run()
	if err != nil {
		return nil, fmt.Errorf("start playwright: %w", err)
	}

	s.pw = pw
	return pw, nil
}

func (s *Service) getSession(id string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrSessionNotFound
	}
	return session, nil
}

func (s *Session) state() (PageState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stateLocked()
}

func (s *Session) stateLocked() (PageState, error) {
	title, err := s.page.Title()
	if err != nil {
		return PageState{}, err
	}

	return PageState{
		SessionID: s.ID,
		URL:       s.page.URL(),
		Title:     title,
	}, nil
}

func normalizeBrowser(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "firefox":
		return "firefox"
	case "webkit":
		return "webkit"
	default:
		return "chromium"
	}
}

func browserType(pw *playwright.Playwright, name string) (playwright.BrowserType, error) {
	switch name {
	case "chromium":
		return pw.Chromium, nil
	case "firefox":
		return pw.Firefox, nil
	case "webkit":
		return pw.WebKit, nil
	default:
		return nil, fmt.Errorf("unsupported browser %q", name)
	}
}

func waitUntilState(value string) (playwright.WaitUntilState, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "load":
		return playwright.WaitUntilState("load"), nil
	case "domcontentloaded":
		return playwright.WaitUntilState("domcontentloaded"), nil
	case "networkidle":
		return playwright.WaitUntilState("networkidle"), nil
	case "commit":
		return playwright.WaitUntilState("commit"), nil
	default:
		return "", fmt.Errorf("unsupported waitUntil %q", value)
	}
}

func validateURL(rawURL string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("url must use http or https")
	}
	if parsed.Host == "" {
		return errors.New("url host is required")
	}
	return nil
}

func newID() string {
	bytes := make([]byte, 18)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return base64.RawURLEncoding.EncodeToString(bytes)
}
