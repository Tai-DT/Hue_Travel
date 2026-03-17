package handler

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/service"
)

func TestUploadHandlerReturnsServiceUnavailableWhenStrictStorageIsNotConfigured(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", uuid.New())
		c.Next()
	})

	h := NewUploadHandler(service.NewFileUploadServiceWithFallback("", "", "", "", false, false))
	router.POST("/upload", h.UploadFile)
	router.POST("/upload/avatar", h.UploadAvatar)

	t.Run("file upload", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "photo.jpg")
		if err != nil {
			t.Fatalf("CreateFormFile() error = %v", err)
		}
		if _, err := part.Write([]byte("fake-image")); err != nil {
			t.Fatalf("Write() error = %v", err)
		}
		_ = writer.Close()

		req, _ := http.NewRequest(http.MethodPost, "/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		router.ServeHTTP(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected status 503, got %d", w.Code)
		}
	})

	t.Run("avatar upload", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "avatar.jpg")
		if err != nil {
			t.Fatalf("CreateFormFile() error = %v", err)
		}
		if _, err := part.Write([]byte("fake-avatar")); err != nil {
			t.Fatalf("Write() error = %v", err)
		}
		_ = writer.Close()

		req, _ := http.NewRequest(http.MethodPost, "/upload/avatar", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		router.ServeHTTP(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected status 503, got %d", w.Code)
		}
	})
}
