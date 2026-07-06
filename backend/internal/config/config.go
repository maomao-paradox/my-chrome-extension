package config

import (
	"log/slog"
	"net"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env                string
	Host               string
	Port               string
	LogLevel           slog.Level
	AllowedOrigins     []string
	AllowedHeaders     []string
	AIBaseURL          string
	AIAPIKey           string
	AIModel            string
	AITimeout          time.Duration
	MaxRequestBytes    int64
	WriteTimeout       time.Duration
	ExtensionConfigTTL time.Duration
	APIToken           string
}

func Load() Config {
	return Config{
		Env:                getEnv("APP_ENV", "development"),
		Host:               getEnv("SERVER_HOST", "127.0.0.1"),
		Port:               getEnv("SERVER_PORT", "8787"),
		LogLevel:           parseLogLevel(getEnv("LOG_LEVEL", "info")),
		AllowedOrigins:     splitCSV(getEnv("CORS_ALLOWED_ORIGINS", "chrome-extension://*,http://127.0.0.1:5173,http://localhost:5173")),
		AllowedHeaders:     splitCSV(getEnv("CORS_ALLOWED_HEADERS", "Content-Type,Authorization,X-Request-ID")),
		AIBaseURL:          strings.TrimRight(getEnv("AI_BASE_URL", ""), "/"),
		AIAPIKey:           getEnv("AI_API_KEY", ""),
		AIModel:            getEnv("AI_MODEL", "deepseek-chat"),
		AITimeout:          parseDuration(getEnv("AI_TIMEOUT", "60s"), 60*time.Second),
		MaxRequestBytes:    parseInt64(getEnv("MAX_REQUEST_BYTES", "1048576"), 1048576),
		WriteTimeout:       parseDuration(getEnv("SERVER_WRITE_TIMEOUT", "120s"), 120*time.Second),
		ExtensionConfigTTL: parseDuration(getEnv("EXTENSION_CONFIG_TTL", "5m"), 5*time.Minute),
		APIToken:           getEnv("API_TOKEN", ""),
	}
}

func (c Config) Addr() string {
	return net.JoinHostPort(c.Host, c.Port)
}

func (c Config) AIEnabled() bool {
	return c.AIBaseURL != "" && c.AIAPIKey != ""
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}

func parseDuration(value string, fallback time.Duration) time.Duration {
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseInt64(value string, fallback int64) int64 {
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func parseLogLevel(value string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
