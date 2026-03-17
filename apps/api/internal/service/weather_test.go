package service

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestWeatherServiceGetCurrentWeatherReturnsTypedErrorWhenStrictAndMissingAPIKey(t *testing.T) {
	svc := NewWeatherServiceWithFallback("", false)

	_, err := svc.GetCurrentWeather()
	if !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured, got %v", err)
	}
}

func TestWeatherServiceGetForecastReturnsTypedErrorWhenStrictAndMissingAPIKey(t *testing.T) {
	svc := NewWeatherServiceWithFallback("", false)

	_, err := svc.GetForecast()
	if !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured, got %v", err)
	}
}

func TestWeatherServiceGetCurrentWeatherReturnsMockWhenFallbackEnabled(t *testing.T) {
	svc := NewWeatherServiceWithFallback("", true)

	weather, err := svc.GetCurrentWeather()
	if err != nil {
		t.Fatalf("expected mock weather without error, got %v", err)
	}
	if weather == nil {
		t.Fatal("expected mock weather response")
	}
	if weather.Location == "" {
		t.Fatal("expected mock weather to contain location")
	}
}

func TestWeatherServiceGetCurrentWeatherReturnsUnavailableOnUpstreamFailureInStrictMode(t *testing.T) {
	svc := NewWeatherServiceWithFallback("test-key", false)
	svc.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return nil, io.ErrUnexpectedEOF
		}),
	}

	_, err := svc.GetCurrentWeather()
	if !errors.Is(err, ErrServiceUnavailable) {
		t.Fatalf("expected ErrServiceUnavailable, got %v", err)
	}
}

func TestWeatherServiceGetForecastReturnsUnavailableOnBadStatusInStrictMode(t *testing.T) {
	svc := NewWeatherServiceWithFallback("test-key", false)
	svc.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusBadGateway,
				Body:       io.NopCloser(strings.NewReader(`{"message":"bad gateway"}`)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	_, err := svc.GetForecast()
	if !errors.Is(err, ErrServiceUnavailable) {
		t.Fatalf("expected ErrServiceUnavailable, got %v", err)
	}
}
