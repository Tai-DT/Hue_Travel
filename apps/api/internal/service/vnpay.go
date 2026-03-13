package service

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ============================================
// VNPay Payment Service
// ============================================

type VNPayService struct {
	tmnCode         string
	hashSecret      string
	paymentURL      string
	returnURL       string
	sandbox         bool
	fallbackEnabled bool
}

func NewVNPayService(tmnCode, hashSecret, returnURL string, sandbox bool) *VNPayService {
	return NewVNPayServiceWithFallback(tmnCode, hashSecret, returnURL, sandbox, true)
}

func NewVNPayServiceWithFallback(tmnCode, hashSecret, returnURL string, sandbox bool, fallbackEnabled bool) *VNPayService {
	paymentURL := "https://pay.vnpay.vn/vpcpay.html"
	if sandbox {
		paymentURL = "https://sandbox.vnpay.vn/paymentv2/vpcpay.html"
	}

	return &VNPayService{
		tmnCode:         tmnCode,
		hashSecret:      hashSecret,
		paymentURL:      paymentURL,
		returnURL:       returnURL,
		sandbox:         sandbox,
		fallbackEnabled: fallbackEnabled,
	}
}

func (s *VNPayService) IsConfigured() bool {
	return s.tmnCode != "" && s.hashSecret != ""
}

// PaymentRequest represents a VNPay payment request
type PaymentRequest struct {
	BookingID   uuid.UUID
	Amount      int64 // VND (must be integer)
	Description string
	ClientIP    string
	BankCode    string // optional, e.g., "VNPAYQR", "VNBANK"
}

// PaymentResult represents the payment URL to redirect user
type PaymentResult struct {
	PaymentURL string `json:"payment_url"`
	TxnRef     string `json:"txn_ref"`
	Amount     int64  `json:"amount"`
}

// PaymentCallback represents VNPay's callback data
type PaymentCallback struct {
	TxnRef        string `json:"vnp_TxnRef"`
	Amount        int64  `json:"vnp_Amount"`
	ResponseCode  string `json:"vnp_ResponseCode"`
	TransactionNo string `json:"vnp_TransactionNo"`
	BankCode      string `json:"vnp_BankCode"`
	PayDate       string `json:"vnp_PayDate"`
	SecureHash    string `json:"vnp_SecureHash"`
}

// ============================================
// Create Payment URL
// ============================================

func (s *VNPayService) CreatePaymentURL(req PaymentRequest) (*PaymentResult, error) {
	if !s.IsConfigured() {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: VNPay credentials are missing", ErrServiceNotConfigured)
		}
		return s.mockPayment(req), nil
	}

	txnRef := fmt.Sprintf("HT%s%s", time.Now().Format("20060102150405"), req.BookingID.String()[:8])
	createDate := time.Now().Format("20060102150405")

	params := url.Values{}
	params.Set("vnp_Version", "2.1.0")
	params.Set("vnp_Command", "pay")
	params.Set("vnp_TmnCode", s.tmnCode)
	params.Set("vnp_Amount", fmt.Sprintf("%d", req.Amount*100)) // VNPay uses VND * 100
	params.Set("vnp_CurrCode", "VND")
	params.Set("vnp_TxnRef", txnRef)
	params.Set("vnp_OrderInfo", req.Description)
	params.Set("vnp_OrderType", "other")
	params.Set("vnp_Locale", "vn")
	params.Set("vnp_ReturnUrl", s.returnURL)
	params.Set("vnp_IpAddr", req.ClientIP)
	params.Set("vnp_CreateDate", createDate)

	if req.BankCode != "" {
		params.Set("vnp_BankCode", req.BankCode)
	}

	// Create secure hash
	hashData := s.buildHashData(params)
	secureHash := s.hmacSHA512(hashData)
	params.Set("vnp_SecureHash", secureHash)

	paymentURL := s.paymentURL + "?" + params.Encode()

	return &PaymentResult{
		PaymentURL: paymentURL,
		TxnRef:     txnRef,
		Amount:     req.Amount,
	}, nil
}

// ============================================
// Verify Callback
// ============================================

func (s *VNPayService) VerifyCallback(params url.Values) (bool, *PaymentCallback) {
	secureHash := params.Get("vnp_SecureHash")

	// Remove hash fields before verification
	checkParams := url.Values{}
	for key, values := range params {
		if key != "vnp_SecureHash" && key != "vnp_SecureHashType" {
			checkParams[key] = values
		}
	}

	hashData := s.buildHashData(checkParams)
	expectedHash := s.hmacSHA512(hashData)

	if !s.IsConfigured() {
		// In mock mode, always verify
		return true, &PaymentCallback{
			TxnRef:        params.Get("vnp_TxnRef"),
			ResponseCode:  "00",
			TransactionNo: "mock_" + time.Now().Format("150405"),
			BankCode:      "VNPAYQR",
			PayDate:       time.Now().Format("20060102150405"),
		}
	}

	isValid := secureHash == expectedHash
	if !isValid {
		return false, nil
	}

	callback := &PaymentCallback{
		TxnRef:        params.Get("vnp_TxnRef"),
		ResponseCode:  params.Get("vnp_ResponseCode"),
		TransactionNo: params.Get("vnp_TransactionNo"),
		BankCode:      params.Get("vnp_BankCode"),
		PayDate:       params.Get("vnp_PayDate"),
		SecureHash:    secureHash,
	}

	return callback.ResponseCode == "00", callback
}

// IsSuccess checks if payment was successful
func (c *PaymentCallback) IsSuccess() bool {
	return c.ResponseCode == "00"
}

// ============================================
// Payment Status Codes
// ============================================

func VNPayResponseMessage(code string) string {
	messages := map[string]string{
		"00": "Giao dịch thành công",
		"07": "Trừ tiền thành công, giao dịch bị nghi ngờ",
		"09": "Thẻ/TK chưa đăng ký InternetBanking",
		"10": "Xác thực thông tin thẻ/TK không đúng quá 3 lần",
		"11": "Đã hết hạn chờ thanh toán",
		"12": "Thẻ/TK bị khoá",
		"13": "Nhập sai mật khẩu OTP",
		"24": "Khách hàng huỷ giao dịch",
		"51": "TK không đủ số dư để thanh toán",
		"65": "TK đã vượt quá hạn mức giao dịch trong ngày",
		"75": "Ngân hàng đang bảo trì",
		"79": "Nhập sai mật khẩu quá số lần quy định",
		"99": "Lỗi không xác định",
	}
	if msg, ok := messages[code]; ok {
		return msg
	}
	return "Lỗi không xác định"
}

// ============================================
// Helpers
// ============================================

func (s *VNPayService) buildHashData(params url.Values) string {
	// Sort keys alphabetically
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var parts []string
	for _, k := range keys {
		v := params.Get(k)
		if v != "" {
			parts = append(parts, fmt.Sprintf("%s=%s", k, v))
		}
	}

	return strings.Join(parts, "&")
}

func (s *VNPayService) hmacSHA512(data string) string {
	h := hmac.New(sha512.New, []byte(s.hashSecret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *VNPayService) mockPayment(req PaymentRequest) *PaymentResult {
	txnRef := fmt.Sprintf("HT%s%s", time.Now().Format("20060102150405"), req.BookingID.String()[:8])
	return &PaymentResult{
		PaymentURL: fmt.Sprintf("https://sandbox.vnpay.vn/mock?ref=%s&amount=%d&desc=%s", txnRef, req.Amount, url.QueryEscape(req.Description)),
		TxnRef:     txnRef,
		Amount:     req.Amount,
	}
}
