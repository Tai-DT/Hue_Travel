package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ============================================
// File Upload Service (MinIO S3-compatible)
// ============================================

type FileUploadService struct {
	endpoint   string
	bucket     string
	accessKey  string
	secretKey  string
	useSSL     bool
	httpClient *http.Client
}

func NewFileUploadService(endpoint, accessKey, secretKey, bucket string, useSSL bool) *FileUploadService {
	return &FileUploadService{
		endpoint:   endpoint,
		bucket:     bucket,
		accessKey:  accessKey,
		secretKey:  secretKey,
		useSSL:     useSSL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// UploadResult represents the result of a file upload
type UploadResult struct {
	Key       string `json:"key"`
	URL       string `json:"url"`
	FileName  string `json:"file_name"`
	FileSize  int64  `json:"file_size"`
	MimeType  string `json:"mime_type"`
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

// Upload simulates file upload (actual MinIO SDK would be used in production)
func (s *FileUploadService) Upload(ctx context.Context, folder string, filename string, reader io.Reader, size int64) (*UploadResult, error) {
	key := s.GenerateKey(folder, filename)

	// In production, this would use the MinIO SDK:
	// client, _ := minio.New(s.endpoint, &minio.Options{
	//     Creds:  credentials.NewStaticV4(s.accessKey, s.secretKey, ""),
	//     Secure: s.useSSL,
	// })
	// _, err := client.PutObject(ctx, s.bucket, key, reader, size, minio.PutObjectOptions{
	//     ContentType: mime.TypeByExtension(filepath.Ext(filename)),
	// })

	return &UploadResult{
		Key:       key,
		URL:       s.GetPublicURL(key),
		FileName:  filename,
		FileSize:  size,
		MimeType:  getMimeType(filename),
		UploadedAt: time.Now(),
	}, nil
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
