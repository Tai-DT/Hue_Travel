package service

import "errors"

var (
	ErrServiceNotConfigured = errors.New("service not configured")
	ErrServiceUnavailable   = errors.New("service unavailable")
)
