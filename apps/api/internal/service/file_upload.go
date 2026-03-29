package service

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// ============================================
// File Upload Service (MinIO S3-compatible)
// ============================================

type FileUploadService struct {
	endpoint        string
	bucket          string
	accessKey       string
	secretKey       string
	useSSL          bool
	client          *minio.Client
	httpClient      *http.Client
	fallbackEnabled bool
	mu              sync.RWMutex
}

func NewFileUploadService(endpoint, accessKey, secretKey, bucket string, useSSL bool) *FileUploadService {
	return NewFileUploadServiceWithFallback(endpoint, accessKey, secretKey, bucket, useSSL, true)
}

func NewFileUploadServiceWithFallback(endpoint, accessKey, secretKey, bucket string, useSSL bool, fallbackEnabled bool) *FileUploadService {
	svc := &FileUploadService{
		endpoint:        endpoint,
		bucket:          bucket,
		accessKey:       accessKey,
		secretKey:       secretKey,
		useSSL:          useSSL,
		httpClient:      &http.Client{Timeout: 30 * time.Second},
		fallbackEnabled: fallbackEnabled,
	}

	svc.client = svc.newMinIOClient(endpoint, accessKey, secretKey, bucket)

	return svc
}

func (s *FileUploadService) UpdateConfig(endpoint, bucket, accessKey, secretKey string) {
	client := s.newMinIOClient(endpoint, accessKey, secretKey, bucket)

	s.mu.Lock()
	defer s.mu.Unlock()
	s.endpoint = endpoint
	s.bucket = bucket
	s.accessKey = accessKey
	s.secretKey = secretKey
	s.client = client
}

type fileUploadSnapshot struct {
	endpoint        string
	bucket          string
	client          *minio.Client
	useSSL          bool
	fallbackEnabled bool
}

func (s *FileUploadService) snapshot() fileUploadSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return fileUploadSnapshot{
		endpoint:        s.endpoint,
		bucket:          s.bucket,
		client:          s.client,
		useSSL:          s.useSSL,
		fallbackEnabled: s.fallbackEnabled,
	}
}

func (s *FileUploadService) newMinIOClient(endpoint, accessKey, secretKey, bucket string) *minio.Client {
	if endpoint == "" || accessKey == "" {
		log.Println("⚠️ MinIO not configured — file upload will use mock mode")
		return nil
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: s.useSSL,
	})
	if err != nil {
		log.Printf("⚠️ MinIO client init failed: %v (falling back to mock)", err)
		return nil
	}

	log.Printf("✅ MinIO connected: %s (bucket: %s)", endpoint, bucket)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		log.Printf("⚠️ MinIO bucket check failed: %v", err)
		return client
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			log.Printf("⚠️ MinIO create bucket failed: %v", err)
		} else {
			log.Printf("✅ MinIO bucket created: %s", bucket)
		}
	}

	return client
}

// UploadResult represents the result of a file upload
type UploadResult struct {
	Key        string    `json:"key"`
	URL        string    `json:"url"`
	FileName   string    `json:"file_name"`
	FileSize   int64     `json:"file_size"`
	MimeType   string    `json:"mime_type"`
	UploadedAt time.Time `json:"uploaded_at"`
}

// GenerateKey creates a unique key for storage
func (s *FileUploadService) GenerateKey(folder, originalFilename string) string {
	ext := filepath.Ext(originalFilename)
	id := uuid.New().String()[:8]
	timestamp := time.Now().Format("20060102")
	safeName := strings.ReplaceAll(originalFilename, " ", "-")
	safeName = strings.TrimSuffix(safeName, ext)

	if len(safeName) > 30 {
		safeName = safeName[:30]
	}

	return fmt.Sprintf("%s/%s/%s-%s%s", folder, timestamp, id, safeName, ext)
}

// GetPublicURL returns the public URL for a file
func (s *FileUploadService) GetPublicURL(key string) string {
	cfg := s.snapshot()
	scheme := "http"
	if cfg.useSSL {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, cfg.endpoint, cfg.bucket, key)
}

// ValidateUpload checks file size and MIME type
func (s *FileUploadService) ValidateUpload(filename string, size int64, allowedTypes []string) error {
	if size > 10*1024*1024 { // 10MB max
		return fmt.Errorf("file quá lớn (tối đa 10MB)")
	}

	ext := strings.ToLower(filepath.Ext(filename))
	allowed := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
		".mp4": true, ".mov": true,
	}

	if len(allowedTypes) > 0 {
		allowed = make(map[string]bool)
		for _, t := range allowedTypes {
			allowed[t] = true
		}
	}

	if !allowed[ext] {
		return fmt.Errorf("loại file không được hỗ trợ: %s", ext)
	}

	return nil
}

// Upload uploads a file to MinIO (or mock if not configured)
func (s *FileUploadService) Upload(ctx context.Context, folder string, filename string, reader io.Reader, size int64) (*UploadResult, error) {
	key := s.GenerateKey(folder, filename)
	mimeType := getMimeType(filename)
	cfg := s.snapshot()

	// Real MinIO upload
	if cfg.client != nil {
		_, err := cfg.client.PutObject(ctx, cfg.bucket, key, reader, size, minio.PutObjectOptions{
			ContentType: mimeType,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: MinIO upload failed: %v", ErrServiceUnavailable, err)
		}

		log.Printf("📁 [MinIO] Uploaded: %s (%d bytes)", key, size)

		return &UploadResult{
			Key:        key,
			URL:        formatPublicUploadURL(cfg.useSSL, cfg.endpoint, cfg.bucket, key),
			FileName:   filename,
			FileSize:   size,
			MimeType:   mimeType,
			UploadedAt: time.Now(),
		}, nil
	}

	if !cfg.fallbackEnabled {
		return nil, fmt.Errorf("%w: object storage is not configured", ErrServiceNotConfigured)
	}

	// Mock mode — return generated URL without actual upload
	log.Printf("📁 [MOCK] Would upload: %s (%d bytes)", key, size)
	return &UploadResult{
		Key:        key,
		URL:        formatPublicUploadURL(cfg.useSSL, cfg.endpoint, cfg.bucket, key),
		FileName:   filename,
		FileSize:   size,
		MimeType:   mimeType,
		UploadedAt: time.Now(),
	}, nil
}

// Delete removes a file from MinIO
func (s *FileUploadService) Delete(ctx context.Context, key string) error {
	cfg := s.snapshot()
	if cfg.client != nil {
		if err := cfg.client.RemoveObject(ctx, cfg.bucket, key, minio.RemoveObjectOptions{}); err != nil {
			return fmt.Errorf("%w: MinIO delete failed: %v", ErrServiceUnavailable, err)
		}
		return nil
	}
	if !cfg.fallbackEnabled {
		return fmt.Errorf("%w: object storage is not configured", ErrServiceNotConfigured)
	}
	log.Printf("📁 [MOCK] Would delete: %s", key)
	return nil
}

func getMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	mimeTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".mp4":  "video/mp4",
		".mov":  "video/quicktime",
	}
	if mt, ok := mimeTypes[ext]; ok {
		return mt
	}
	return "application/octet-stream"
}

func formatPublicUploadURL(useSSL bool, endpoint, bucket, key string) string {
	scheme := "http"
	if useSSL {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, endpoint, bucket, key)
}
