package config

import (
	"strings"
	"testing"
	"time"
)

func TestValidateRequiresOpenWeatherAPIKeyInStrictMode(t *testing.T) {
	cfg := &Config{
		App: AppConfig{
			StrictMode: true,
		},
		JWT: JWTConfig{
			Secret: "test-secret",
		},
		Goong: GoongConfig{
			APIKey: "goong-key",
		},
		VNPay: VNPayConfig{
			TmnCode:    "tmn",
			HashSecret: "hash",
		},
		AI: AIConfig{
			GeminiAPIKey: "gemini-key",
		},
		Meilisearch: MeilisearchConfig{
			URL:       "http://localhost:7700",
			MasterKey: "master-key",
		},
		MinIO: MinIOConfig{
			Endpoint: "localhost:9000",
			User:     "minio",
			Password: "password",
			Bucket:   "bucket",
		},
		OpenWeather: OpenWeatherConfig{},
	}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected strict validation to fail when OPENWEATHER_API_KEY is missing")
	}
	if !strings.Contains(err.Error(), "OPENWEATHER_API_KEY") {
		t.Fatalf("expected OPENWEATHER_API_KEY in validation error, got %v", err)
	}
}

func TestValidateAllowsMissingOpenWeatherAPIKeyOutsideStrictMode(t *testing.T) {
	cfg := &Config{
		App: AppConfig{
			StrictMode: false,
		},
		JWT: JWTConfig{
			Secret: "test-secret",
			Expiry: time.Hour,
		},
		OpenWeather: OpenWeatherConfig{},
	}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected non-strict validation to allow missing OPENWEATHER_API_KEY, got %v", err)
	}
}
