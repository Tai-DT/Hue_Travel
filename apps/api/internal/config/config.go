package config

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	App         AppConfig
	Database    DatabaseConfig
	Redis       RedisConfig
	JWT         JWTConfig
	MinIO       MinIOConfig
	Google      GoogleConfig
	VNPay       VNPayConfig
	AI          AIConfig
	ESMS        ESMSConfig
	FCM         FCMConfig
	Meilisearch MeilisearchConfig
}

type AppConfig struct {
	Env               string
	Port              string
	Name              string
	URL               string
	StrictMode        bool
	AllowMockServices bool
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	URL      string
}

type RedisConfig struct {
	URL string
}

type JWTConfig struct {
	Secret        string
	Expiry        time.Duration
	RefreshExpiry time.Duration
}

type MinIOConfig struct {
	Endpoint string
	User     string
	Password string
	Bucket   string
	UseSSL   bool
}

type GoogleConfig struct {
	MapsAPIKey   string
	ClientID     string
	ClientSecret string
}

type VNPayConfig struct {
	TmnCode    string
	HashSecret string
	ReturnURL  string
	Sandbox    bool
}

type AIConfig struct {
	GeminiAPIKey string
}

type ESMSConfig struct {
	APIKey    string
	SecretKey string
	BrandName string
}

type FCMConfig struct {
	ServerKey string
}

type MeilisearchConfig struct {
	URL       string
	MasterKey string
}

func Load() (*Config, error) {
	// Load .env file (optional in production)
	_ = godotenv.Load("../../.env")

	jwtExpiry, _ := time.ParseDuration(getEnv("JWT_EXPIRY", "24h"))
	refreshExpiry, _ := time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "720h"))

	cfg := &Config{
		App: AppConfig{
			Env:  getEnv("APP_ENV", "development"),
			Port: getEnv("APP_PORT", "8080"),
			Name: getEnv("APP_NAME", "hue-travel-api"),
			URL:  getEnv("APP_URL", "http://localhost:8080"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("POSTGRES_HOST", "localhost"),
			Port:     getEnv("POSTGRES_PORT", "5432"),
			User:     getEnv("POSTGRES_USER", "huetravel"),
			Password: getEnv("POSTGRES_PASSWORD", "huetravel_dev_2026"),
			DBName:   getEnv("POSTGRES_DB", "hue_travel"),
			URL:      getEnv("DATABASE_URL", ""),
		},
		Redis: RedisConfig{
			URL: getEnv("REDIS_URL", "redis://localhost:6379/0"),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", "change-me-in-production"),
			Expiry:        jwtExpiry,
			RefreshExpiry: refreshExpiry,
		},
		MinIO: MinIOConfig{
			Endpoint: getEnv("MINIO_ENDPOINT", "localhost:9000"),
			User:     getEnv("MINIO_ROOT_USER", "huetravel"),
			Password: getEnv("MINIO_ROOT_PASSWORD", "huetravel_minio_2026"),
			Bucket:   getEnv("MINIO_BUCKET", "hue-travel"),
			UseSSL:   getEnv("MINIO_USE_SSL", "false") == "true",
		},
		Google: GoogleConfig{
			MapsAPIKey:   getEnv("GOOGLE_MAPS_API_KEY", ""),
			ClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
			ClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		},
		VNPay: VNPayConfig{
			TmnCode:    getEnv("VNPAY_TMN_CODE", ""),
			HashSecret: getEnv("VNPAY_HASH_SECRET", ""),
			ReturnURL:  getEnv("VNPAY_RETURN_URL", "http://localhost:8080/api/v1/payment/callback"),
			Sandbox:    getEnv("VNPAY_SANDBOX", "true") == "true",
		},
		AI: AIConfig{
			GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		},
		ESMS: ESMSConfig{
			APIKey:    getEnv("ESMS_API_KEY", ""),
			SecretKey: getEnv("ESMS_SECRET_KEY", ""),
			BrandName: getEnv("ESMS_BRAND_NAME", "HueTravel"),
		},
		FCM: FCMConfig{
			ServerKey: getEnv("FCM_SERVER_KEY", ""),
		},
		Meilisearch: MeilisearchConfig{
			URL:       getEnvAny([]string{"MEILISEARCH_URL", "MEILI_HOST"}, ""),
			MasterKey: getEnvAny([]string{"MEILISEARCH_MASTER_KEY", "MEILI_MASTER_KEY"}, ""),
		},
	}

	cfg.App.StrictMode = getEnv("APP_STRICT_MODE", "false") == "true" || cfg.App.Env == "production"
	cfg.App.AllowMockServices = getAllowMockServices(cfg.App.Env, cfg.App.StrictMode)

	if cfg.Database.URL == "" {
		cfg.Database.URL = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=disable",
			cfg.Database.User, cfg.Database.Password,
			cfg.Database.Host, cfg.Database.Port, cfg.Database.DBName,
		)
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	var missing []string

	if isDefaultSecret(c.JWT.Secret) {
		missing = append(missing, "JWT_SECRET")
	}

	if c.App.StrictMode {
		required := map[string]string{
			"GOOGLE_MAPS_API_KEY":    c.Google.MapsAPIKey,
			"GEMINI_API_KEY":         c.AI.GeminiAPIKey,
			"VNPAY_TMN_CODE":         c.VNPay.TmnCode,
			"VNPAY_HASH_SECRET":      c.VNPay.HashSecret,
			"ESMS_API_KEY":           c.ESMS.APIKey,
			"ESMS_SECRET_KEY":        c.ESMS.SecretKey,
			"MEILISEARCH_URL":        c.Meilisearch.URL,
			"MEILISEARCH_MASTER_KEY": c.Meilisearch.MasterKey,
			"MINIO_ENDPOINT":         c.MinIO.Endpoint,
			"MINIO_ROOT_USER":        c.MinIO.User,
			"MINIO_ROOT_PASSWORD":    c.MinIO.Password,
			"MINIO_BUCKET":           c.MinIO.Bucket,
		}
		for key, value := range required {
			if strings.TrimSpace(value) == "" {
				missing = append(missing, key)
			}
		}
	}

	if len(missing) == 0 {
		return nil
	}

	return fmt.Errorf("missing required configuration: %s", strings.Join(missing, ", "))
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvAny(keys []string, fallback string) string {
	for _, key := range keys {
		if val := os.Getenv(key); val != "" {
			return val
		}
	}
	return fallback
}

func getAllowMockServices(env string, strictMode bool) bool {
	if val := os.Getenv("ALLOW_MOCK_SERVICES"); val != "" {
		return val == "true"
	}
	return env != "production" && !strictMode
}

func isDefaultSecret(secret string) bool {
	trimmed := strings.TrimSpace(secret)
	if trimmed == "" {
		return true
	}

	defaults := map[string]bool{
		"change-me-in-production":                        true,
		"your-super-secret-jwt-key-change-in-production": true,
	}

	return defaults[trimmed]
}
