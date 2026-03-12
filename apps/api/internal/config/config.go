package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	App      AppConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	MinIO    MinIOConfig
	Google   GoogleConfig
	VNPay    VNPayConfig
	AI       AIConfig
}

type AppConfig struct {
	Env  string
	Port string
	Name string
	URL  string
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
	Endpoint  string
	User      string
	Password  string
	Bucket    string
	UseSSL    bool
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
	}

	if cfg.Database.URL == "" {
		cfg.Database.URL = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=disable",
			cfg.Database.User, cfg.Database.Password,
			cfg.Database.Host, cfg.Database.Port, cfg.Database.DBName,
		)
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
