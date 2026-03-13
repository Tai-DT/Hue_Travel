package service

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"
)

// ============================================
// ESMS.vn SMS Service — OTP & Notifications
// https://developers.esms.vn/
// ============================================

type SMSService struct {
	apiKey          string
	secretKey       string
	brandName       string
	baseURL         string
	client          *http.Client
	fallbackEnabled bool
}

func NewSMSService(apiKey, secretKey, brandName string) *SMSService {
	return NewSMSServiceWithFallback(apiKey, secretKey, brandName, true)
}

func NewSMSServiceWithFallback(apiKey, secretKey, brandName string, fallbackEnabled bool) *SMSService {
	svc := &SMSService{
		apiKey:          apiKey,
		secretKey:       secretKey,
		brandName:       brandName,
		baseURL:         "http://rest.esms.vn/MainService.svc/json",
		client:          &http.Client{Timeout: 10 * time.Second},
		fallbackEnabled: fallbackEnabled,
	}

	if svc.IsConfigured() {
		log.Printf("✅ ESMS.vn SMS configured (brand: %s)", brandName)
	} else {
		log.Println("⚠️ ESMS.vn not configured — OTP will be logged to console")
	}

	return svc
}

func (s *SMSService) IsConfigured() bool {
	return s.apiKey != "" && s.secretKey != ""
}

func (s *SMSService) FallbackEnabled() bool {
	return s.fallbackEnabled
}

// SendOTP sends an OTP code via SMS through ESMS.vn
func (s *SMSService) SendOTP(phone, code string) error {
	if !s.IsConfigured() {
		if !s.fallbackEnabled {
			return fmt.Errorf("%w: ESMS credentials are missing", ErrServiceNotConfigured)
		}
		log.Printf("📱 [MOCK SMS] OTP for %s: %s", phone, code)
		return nil
	}

	content := fmt.Sprintf("Ma xac thuc Hue Travel cua ban la: %s. Ma se het han sau 5 phut.", code)

	return s.sendSMS(phone, content, "2") // Type 2 = OTP
}

// SendNotification sends a notification SMS
func (s *SMSService) SendNotification(phone, content string) error {
	if !s.IsConfigured() {
		if !s.fallbackEnabled {
			return fmt.Errorf("%w: ESMS credentials are missing", ErrServiceNotConfigured)
		}
		log.Printf("📱 [MOCK SMS] Notify %s: %s", phone, content)
		return nil
	}

	return s.sendSMS(phone, content, "2") // Type 2 = CSKH
}

// sendSMS calls the ESMS.vn API
func (s *SMSService) sendSMS(phone, content, smsType string) error {
	params := url.Values{
		"Phone":     {phone},
		"Content":   {content},
		"ApiKey":    {s.apiKey},
		"SecretKey": {s.secretKey},
		"SmsType":   {smsType},
	}

	if s.brandName != "" {
		params.Set("Brandname", s.brandName)
	}

	reqURL := fmt.Sprintf("%s/SendMultipleMessage_V4_get?%s", s.baseURL, params.Encode())
	resp, err := s.client.Get(reqURL)
	if err != nil {
		return fmt.Errorf("ESMS API error: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		CodeResult string `json:"CodeResult"`
		ErrorMsg   string `json:"ErrorMessage"`
		SMSID      string `json:"SMSID"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("ESMS response parse error: %w", err)
	}

	if result.CodeResult != "100" {
		return fmt.Errorf("ESMS error [%s]: %s", result.CodeResult, result.ErrorMsg)
	}

	log.Printf("📱 [ESMS] SMS sent to %s (ID: %s)", phone, result.SMSID)
	return nil
}

// GetBalance returns the ESMS.vn account balance
func (s *SMSService) GetBalance() (int64, error) {
	if !s.IsConfigured() {
		return 0, nil
	}

	reqURL := fmt.Sprintf("%s/GetBalance/%s/%s", s.baseURL, s.apiKey, s.secretKey)
	resp, err := s.client.Get(reqURL)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Balance    int64  `json:"Balance"`
		CodeResult string `json:"CodeResponse"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Balance, nil
}
