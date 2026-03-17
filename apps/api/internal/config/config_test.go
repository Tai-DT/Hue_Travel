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

func TestValidateRequiresFCMServerKeyInStrictMode(t *testing.T) {
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
			ReturnURL:  "https://api.huetravel.vn/api/v1/payment/callback",
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
		OpenWeather: OpenWeatherConfig{
			APIKey: "weather-key",
		},
	}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected strict validation to fail when FCM_SERVER_KEY is missing")
	}
	if !strings.Contains(err.Error(), "FCM_SERVER_KEY") {
		t.Fatalf("expected FCM_SERVER_KEY in validation error, got %v", err)
	}
}

func TestValidateRequiresVNPayReturnURLInStrictMode(t *testing.T) {
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
			ReturnURL:  "http://localhost:8080/api/v1/payment/callback",
		},
		AI: AIConfig{
			GeminiAPIKey: "gemini-key",
		},
		FCM: FCMConfig{
			ServerKey: "fcm-key",
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
		OpenWeather: OpenWeatherConfig{
			APIKey: "weather-key",
		},
	}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("expected strict validation to fail when VNPAY_RETURN_URL is left at local default")
	}
	if !strings.Contains(err.Error(), "VNPAY_RETURN_URL") {
		t.Fatalf("expected VNPAY_RETURN_URL in validation error, got %v", err)
	}
}
