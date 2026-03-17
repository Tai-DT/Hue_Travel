package service

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
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

	// Initialize MinIO client
	if endpoint != "" && accessKey != "" {
		client, err := minio.New(endpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
			Secure: useSSL,
		})
		if err != nil {
			log.Printf("⚠️ MinIO client init failed: %v (falling back to mock)", err)
		} else {
			svc.client = client
			log.Printf("✅ MinIO connected: %s (bucket: %s)", endpoint, bucket)

			// Ensure bucket exists
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			exists, err := client.BucketExists(ctx, bucket)
			if err != nil {
				log.Printf("⚠️ MinIO bucket check failed: %v", err)
			} else if !exists {
				if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
					log.Printf("⚠️ MinIO create bucket failed: %v", err)
				} else {
					log.Printf("✅ MinIO bucket created: %s", bucket)
				}
			}
		}
	} else {
		log.Println("⚠️ MinIO not configured — file upload will use mock mode")
	}

	return svc
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
	scheme := "http"
	if s.useSSL {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, s.endpoint, s.bucket, key)
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

	// Real MinIO upload
	if s.client != nil {
		_, err := s.client.PutObject(ctx, s.bucket, key, reader, size, minio.PutObjectOptions{
			ContentType: mimeType,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: MinIO upload failed: %v", ErrServiceUnavailable, err)
		}

		log.Printf("📁 [MinIO] Uploaded: %s (%d bytes)", key, size)

		return &UploadResult{
			Key:        key,
			URL:        s.GetPublicURL(key),
			FileName:   filename,
			FileSize:   size,
			MimeType:   mimeType,
			UploadedAt: time.Now(),
		}, nil
	}

	if !s.fallbackEnabled {
		return nil, fmt.Errorf("%w: object storage is not configured", ErrServiceNotConfigured)
	}

	// Mock mode — return generated URL without actual upload
	log.Printf("📁 [MOCK] Would upload: %s (%d bytes)", key, size)
	return &UploadResult{
		Key:        key,
		URL:        s.GetPublicURL(key),
		FileName:   filename,
		FileSize:   size,
		MimeType:   mimeType,
		UploadedAt: time.Now(),
	}, nil
}

// Delete removes a file from MinIO
func (s *FileUploadService) Delete(ctx context.Context, key string) error {
	if s.client != nil {
		if err := s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{}); err != nil {
			return fmt.Errorf("%w: MinIO delete failed: %v", ErrServiceUnavailable, err)
		}
		return nil
	}
	if !s.fallbackEnabled {
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
