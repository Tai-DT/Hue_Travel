package i18n

// ============================================
// i18n — Multilingual Error Messages
// Supports: vi|en|ja|ko|zh|hi|th|id|ms|km|lo|tl|my
// ============================================

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// SupportedLocale represents a supported language
type SupportedLocale string

const (
	LocaleVI SupportedLocale = "vi"
	LocaleEN SupportedLocale = "en"
	LocaleJA SupportedLocale = "ja"
	LocaleKO SupportedLocale = "ko"
	LocaleZH SupportedLocale = "zh"
	LocaleHI SupportedLocale = "hi"
	LocaleTH SupportedLocale = "th"
	LocaleID SupportedLocale = "id"
	LocaleMS SupportedLocale = "ms"
	LocaleKM SupportedLocale = "km"
	LocaleLO SupportedLocale = "lo"
	LocaleTL SupportedLocale = "tl"
	LocaleMY SupportedLocale = "my"
)

const DefaultLocale = LocaleVI

// MessageKey identifies a translatable message
type MessageKey string

// Common error message keys
const (
	MsgSystemError     MessageKey = "system_error"
	MsgUnauthorized    MessageKey = "unauthorized"
	MsgForbidden       MessageKey = "forbidden"
	MsgNotFound        MessageKey = "not_found"
	MsgBadRequest      MessageKey = "bad_request"
	MsgValidationError MessageKey = "validation_error"

	// Auth
	MsgLoginSuccess    MessageKey = "login_success"
	MsgLoginFailed     MessageKey = "login_failed"
	MsgTokenExpired    MessageKey = "token_expired"
	MsgTokenInvalid    MessageKey = "token_invalid"
	MsgLogoutSuccess   MessageKey = "logout_success"
	MsgAccountDeleted  MessageKey = "account_deleted"
	MsgProfileUpdated  MessageKey = "profile_updated"

	// Booking
	MsgBookingCreated   MessageKey = "booking_created"
	MsgBookingConfirmed MessageKey = "booking_confirmed"
	MsgBookingCompleted MessageKey = "booking_completed"
	MsgBookingCancelled MessageKey = "booking_cancelled"
	MsgBookingNotFound  MessageKey = "booking_not_found"
	MsgBookingInvalid   MessageKey = "booking_invalid_status"

	// Payment
	MsgPaymentSuccess MessageKey = "payment_success"
	MsgPaymentFailed  MessageKey = "payment_failed"

	// Experience
	MsgExperienceNotFound MessageKey = "experience_not_found"

	// Service unavailable
	MsgServiceDown MessageKey = "service_down"
)

// messages holds all translations
var messages = map[SupportedLocale]map[MessageKey]string{
	LocaleVI: {
		MsgSystemError:     "Lỗi hệ thống. Vui lòng thử lại.",
		MsgUnauthorized:    "Vui lòng đăng nhập để tiếp tục.",
		MsgForbidden:       "Bạn không có quyền thực hiện hành động này.",
		MsgNotFound:        "Không tìm thấy dữ liệu.",
		MsgBadRequest:      "Dữ liệu không hợp lệ.",
		MsgValidationError: "Vui lòng kiểm tra lại thông tin.",

		MsgLoginSuccess:    "Đăng nhập thành công.",
		MsgLoginFailed:     "Email hoặc mật khẩu không đúng.",
		MsgTokenExpired:    "Phiên đăng nhập đã hết hạn.",
		MsgTokenInvalid:    "Token không hợp lệ.",
		MsgLogoutSuccess:   "Đăng xuất thành công.",
		MsgAccountDeleted:  "Tài khoản đã được xoá.",
		MsgProfileUpdated:  "Cập nhật hồ sơ thành công.",

		MsgBookingCreated:   "Đặt chỗ thành công.",
		MsgBookingConfirmed: "Đặt chỗ đã được xác nhận.",
		MsgBookingCompleted: "Đặt chỗ hoàn thành.",
		MsgBookingCancelled: "Đặt chỗ đã huỷ.",
		MsgBookingNotFound:  "Không tìm thấy đặt chỗ.",
		MsgBookingInvalid:   "Trạng thái đặt chỗ không hợp lệ.",

		MsgPaymentSuccess: "Thanh toán thành công.",
		MsgPaymentFailed:  "Thanh toán thất bại.",

		MsgExperienceNotFound: "Không tìm thấy trải nghiệm.",

		MsgServiceDown: "Dịch vụ tạm thời không khả dụng.",
	},
	LocaleEN: {
		MsgSystemError:     "System error. Please try again.",
		MsgUnauthorized:    "Please log in to continue.",
		MsgForbidden:       "You do not have permission for this action.",
		MsgNotFound:        "Data not found.",
		MsgBadRequest:      "Invalid request.",
		MsgValidationError: "Please check your information.",

		MsgLoginSuccess:    "Login successful.",
		MsgLoginFailed:     "Invalid email or password.",
		MsgTokenExpired:    "Session expired.",
		MsgTokenInvalid:    "Invalid token.",
		MsgLogoutSuccess:   "Logged out successfully.",
		MsgAccountDeleted:  "Account has been deleted.",
		MsgProfileUpdated:  "Profile updated.",

		MsgBookingCreated:   "Booking created successfully.",
		MsgBookingConfirmed: "Booking confirmed.",
		MsgBookingCompleted: "Booking completed.",
		MsgBookingCancelled: "Booking cancelled.",
		MsgBookingNotFound:  "Booking not found.",
		MsgBookingInvalid:   "Invalid booking status.",

		MsgPaymentSuccess: "Payment successful.",
		MsgPaymentFailed:  "Payment failed.",

		MsgExperienceNotFound: "Experience not found.",

		MsgServiceDown: "Service temporarily unavailable.",
	},
	LocaleJA: {
		MsgSystemError:     "システムエラー。もう一度お試しください。",
		MsgUnauthorized:    "ログインしてください。",
		MsgForbidden:       "この操作の権限がありません。",
		MsgNotFound:        "データが見つかりません。",
		MsgBadRequest:      "リクエストが無効です。",
		MsgValidationError: "入力内容をご確認ください。",

		MsgLoginSuccess:    "ログイン成功。",
		MsgLoginFailed:     "メールまたはパスワードが間違っています。",
		MsgTokenExpired:    "セッションが期限切れです。",
		MsgTokenInvalid:    "無効なトークンです。",
		MsgLogoutSuccess:   "ログアウトしました。",
		MsgAccountDeleted:  "アカウントが削除されました。",
		MsgProfileUpdated:  "プロフィールを更新しました。",

		MsgBookingCreated:   "予約が完了しました。",
		MsgBookingConfirmed: "予約が確認されました。",
		MsgBookingCompleted: "予約が完了しました。",
		MsgBookingCancelled: "予約がキャンセルされました。",
		MsgBookingNotFound:  "予約が見つかりません。",
		MsgBookingInvalid:   "予約ステータスが無効です。",

		MsgPaymentSuccess: "支払い成功。",
		MsgPaymentFailed:  "支払い失敗。",

		MsgExperienceNotFound: "体験が見つかりません。",

		MsgServiceDown: "サービスが一時的に利用できません。",
	},
	LocaleKO: {
		MsgSystemError:     "시스템 오류. 다시 시도해 주세요.",
		MsgUnauthorized:    "로그인이 필요합니다.",
		MsgForbidden:       "이 작업에 대한 권한이 없습니다.",
		MsgNotFound:        "데이터를 찾을 수 없습니다.",
		MsgBadRequest:      "잘못된 요청입니다.",
		MsgValidationError: "입력 정보를 확인해 주세요.",

		MsgLoginSuccess:    "로그인 성공.",
		MsgLoginFailed:     "이메일 또는 비밀번호가 올바르지 않습니다.",
		MsgTokenExpired:    "세션이 만료되었습니다.",
		MsgTokenInvalid:    "유효하지 않은 토큰입니다.",
		MsgLogoutSuccess:   "로그아웃 되었습니다.",
		MsgAccountDeleted:  "계정이 삭제되었습니다.",
		MsgProfileUpdated:  "프로필이 업데이트되었습니다.",

		MsgBookingCreated:   "예약이 생성되었습니다.",
		MsgBookingConfirmed: "예약이 확인되었습니다.",
		MsgBookingCompleted: "예약이 완료되었습니다.",
		MsgBookingCancelled: "예약이 취소되었습니다.",
		MsgBookingNotFound:  "예약을 찾을 수 없습니다.",
		MsgBookingInvalid:   "잘못된 예약 상태입니다.",

		MsgPaymentSuccess: "결제 성공.",
		MsgPaymentFailed:  "결제 실패.",

		MsgExperienceNotFound: "체험을 찾을 수 없습니다.",

		MsgServiceDown: "서비스를 일시적으로 사용할 수 없습니다.",
	},
	LocaleZH: {
		MsgSystemError:     "系统错误，请重试。",
		MsgUnauthorized:    "请登录后继续。",
		MsgForbidden:       "您没有权限执行此操作。",
		MsgNotFound:        "未找到数据。",
		MsgBadRequest:      "请求无效。",
		MsgValidationError: "请检查您的信息。",

		MsgLoginSuccess:    "登录成功。",
		MsgLoginFailed:     "邮箱或密码错误。",
		MsgTokenExpired:    "会话已过期。",
		MsgTokenInvalid:    "无效的令牌。",
		MsgLogoutSuccess:   "已退出登录。",
		MsgAccountDeleted:  "账号已删除。",
		MsgProfileUpdated:  "个人资料已更新。",

		MsgBookingCreated:   "预订创建成功。",
		MsgBookingConfirmed: "预订已确认。",
		MsgBookingCompleted: "预订已完成。",
		MsgBookingCancelled: "预订已取消。",
		MsgBookingNotFound:  "未找到预订。",
		MsgBookingInvalid:   "预订状态无效。",

		MsgPaymentSuccess: "支付成功。",
		MsgPaymentFailed:  "支付失败。",

		MsgExperienceNotFound: "未找到体验。",

		MsgServiceDown: "服务暂时不可用。",
	},
	LocaleHI: {
		MsgSystemError:     "सिस्टम त्रुटि। कृपया पुनः प्रयास करें।",
		MsgUnauthorized:    "कृपया जारी रखने के लिए लॉग इन करें।",
		MsgForbidden:       "आपको इस क्रिया की अनुमति नहीं है।",
		MsgNotFound:        "डेटा नहीं मिला।",
		MsgBadRequest:      "अमान्य अनुरोध।",
		MsgValidationError: "कृपया अपनी जानकारी जाँचें।",

		MsgLoginSuccess:    "लॉगिन सफल।",
		MsgLoginFailed:     "अमान्य ईमेल या पासवर्ड।",
		MsgTokenExpired:    "सत्र समाप्त हो गया।",
		MsgTokenInvalid:    "अमान्य टोकन।",
		MsgLogoutSuccess:   "सफलतापूर्वक लॉग आउट हो गया।",
		MsgAccountDeleted:  "खाता हटा दिया गया है।",
		MsgProfileUpdated:  "प्रोफाइल अपडेट हो गई।",

		MsgBookingCreated:   "बुकिंग सफलतापूर्वक बनाई गई।",
		MsgBookingConfirmed: "बुकिंग की पुष्टि हो गई।",
		MsgBookingCompleted: "बुकिंग पूर्ण।",
		MsgBookingCancelled: "बुकिंग रद्द कर दी गई।",
		MsgBookingNotFound:  "बुकिंग नहीं मिली।",
		MsgBookingInvalid:   "अमान्य बुकिंग स्थिति।",

		MsgPaymentSuccess: "भुगतान सफल।",
		MsgPaymentFailed:  "भुगतान विफल।",

		MsgExperienceNotFound: "अनुभव नहीं मिला।",

		MsgServiceDown: "सेवा अस्थायी रूप से अनुपलब्ध है।",
	},
	LocaleTH: {
		MsgSystemError: "ข้อผิดพลาดของระบบ กรุณาลองอีกครั้ง", MsgUnauthorized: "กรุณาเข้าสู่ระบบ",
		MsgForbidden: "คุณไม่มีสิทธิ์", MsgNotFound: "ไม่พบข้อมูล",
		MsgBadRequest: "คำขอไม่ถูกต้อง", MsgValidationError: "กรุณาตรวจสอบข้อมูล",
		MsgLoginSuccess: "เข้าสู่ระบบสำเร็จ", MsgLoginFailed: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
		MsgTokenExpired: "เซสชันหมดอายุ", MsgTokenInvalid: "โทเค็นไม่ถูกต้อง",
		MsgLogoutSuccess: "ออกจากระบบแล้ว", MsgAccountDeleted: "ลบบัญชีแล้ว",
		MsgProfileUpdated: "อัปเดตโปรไฟล์แล้ว",
		MsgBookingCreated: "จองสำเร็จ", MsgBookingConfirmed: "ยืนยันการจองแล้ว",
		MsgBookingCompleted: "การจองเสร็จสิ้น", MsgBookingCancelled: "ยกเลิกการจองแล้ว",
		MsgBookingNotFound: "ไม่พบการจอง", MsgBookingInvalid: "สถานะการจองไม่ถูกต้อง",
		MsgPaymentSuccess: "ชำระเงินสำเร็จ", MsgPaymentFailed: "ชำระเงินล้มเหลว",
		MsgExperienceNotFound: "ไม่พบประสบการณ์", MsgServiceDown: "บริการไม่พร้อมใช้งานชั่วคราว",
	},
	LocaleID: {
		MsgSystemError: "Kesalahan sistem. Silakan coba lagi.", MsgUnauthorized: "Silakan masuk.",
		MsgForbidden: "Anda tidak memiliki izin.", MsgNotFound: "Data tidak ditemukan.",
		MsgBadRequest: "Permintaan tidak valid.", MsgValidationError: "Periksa informasi Anda.",
		MsgLoginSuccess: "Login berhasil.", MsgLoginFailed: "Email atau kata sandi salah.",
		MsgTokenExpired: "Sesi berakhir.", MsgTokenInvalid: "Token tidak valid.",
		MsgLogoutSuccess: "Berhasil keluar.", MsgAccountDeleted: "Akun telah dihapus.",
		MsgProfileUpdated: "Profil diperbarui.",
		MsgBookingCreated: "Pemesanan berhasil.", MsgBookingConfirmed: "Pemesanan dikonfirmasi.",
		MsgBookingCompleted: "Pemesanan selesai.", MsgBookingCancelled: "Pemesanan dibatalkan.",
		MsgBookingNotFound: "Pemesanan tidak ditemukan.", MsgBookingInvalid: "Status pemesanan tidak valid.",
		MsgPaymentSuccess: "Pembayaran berhasil.", MsgPaymentFailed: "Pembayaran gagal.",
		MsgExperienceNotFound: "Pengalaman tidak ditemukan.", MsgServiceDown: "Layanan tidak tersedia sementara.",
	},
	LocaleMS: {
		MsgSystemError: "Ralat sistem. Sila cuba lagi.", MsgUnauthorized: "Sila log masuk.",
		MsgForbidden: "Anda tiada kebenaran.", MsgNotFound: "Data tidak dijumpai.",
		MsgBadRequest: "Permintaan tidak sah.", MsgValidationError: "Sila semak maklumat anda.",
		MsgLoginSuccess: "Log masuk berjaya.", MsgLoginFailed: "E-mel atau kata laluan salah.",
		MsgTokenExpired: "Sesi tamat.", MsgTokenInvalid: "Token tidak sah.",
		MsgLogoutSuccess: "Berjaya log keluar.", MsgAccountDeleted: "Akaun telah dipadam.",
		MsgProfileUpdated: "Profil dikemas kini.",
		MsgBookingCreated: "Tempahan berjaya.", MsgBookingConfirmed: "Tempahan disahkan.",
		MsgBookingCompleted: "Tempahan selesai.", MsgBookingCancelled: "Tempahan dibatalkan.",
		MsgBookingNotFound: "Tempahan tidak dijumpai.", MsgBookingInvalid: "Status tempahan tidak sah.",
		MsgPaymentSuccess: "Pembayaran berjaya.", MsgPaymentFailed: "Pembayaran gagal.",
		MsgExperienceNotFound: "Pengalaman tidak dijumpai.", MsgServiceDown: "Perkhidmatan tidak tersedia buat sementara.",
	},
	LocaleKM: {
		MsgSystemError: "កំហុសប្រព័ន្ធ។", MsgUnauthorized: "សូមចូលគណនី។",
		MsgForbidden: "អ្នកមិនមានសិទ្ធិ។", MsgNotFound: "រកមិនឃើញទិន្នន័យ។",
		MsgBadRequest: "សំណើមិនត្រឹមត្រូវ។", MsgValidationError: "សូមពិនិត្យព័ត៌មាន។",
		MsgLoginSuccess: "ចូលបានជោគជ័យ។", MsgLoginFailed: "អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។",
		MsgTokenExpired: "សម័យបានផុតកំណត់។", MsgTokenInvalid: "Token មិនត្រឹមត្រូវ។",
		MsgLogoutSuccess: "បានចេញជោគជ័យ។", MsgAccountDeleted: "គណនីត្រូវបានលុប។",
		MsgProfileUpdated: "បានធ្វើបច្ចុប្បន្នភាពប្រវត្តិរូប។",
		MsgBookingCreated: "ការកក់បានជោគជ័យ។", MsgBookingConfirmed: "ការកក់ត្រូវបានបញ្ជាក់។",
		MsgBookingCompleted: "ការកក់បានបញ្ចប់។", MsgBookingCancelled: "ការកក់ត្រូវបានបោះបង់។",
		MsgBookingNotFound: "រកមិនឃើញការកក់។", MsgBookingInvalid: "ស្ថានភាពកក់មិនត្រឹមត្រូវ។",
		MsgPaymentSuccess: "ការទូទាត់ជោគជ័យ។", MsgPaymentFailed: "ការទូទាត់បរាជ័យ។",
		MsgExperienceNotFound: "រកមិនឃើញបទពិសោធន៍។", MsgServiceDown: "សេវាមិនអាចប្រើបានបណ្ដោះអាសន្ន។",
	},
	LocaleLO: {
		MsgSystemError: "ຂໍ້ຜິດພາດລະບົບ.", MsgUnauthorized: "ກະລຸນາເຂົ້າສູ່ລະບົບ.",
		MsgForbidden: "ທ່ານບໍ່ມີສິດ.", MsgNotFound: "ບໍ່ພົບຂໍ້ມູນ.",
		MsgBadRequest: "ຄຳຂໍບໍ່ຖືກຕ້ອງ.", MsgValidationError: "ກະລຸນາກວດສອບຂໍ້ມູນ.",
		MsgLoginSuccess: "ເຂົ້າສູ່ລະບົບສຳເລັດ.", MsgLoginFailed: "ອີເມວ ຫຼື ລະຫັດບໍ່ຖືກ.",
		MsgTokenExpired: "ເຊສຊັນໝົດອາຍຸ.", MsgTokenInvalid: "Token ບໍ່ຖືກຕ້ອງ.",
		MsgLogoutSuccess: "ອອກຈາກລະບົບແລ້ວ.", MsgAccountDeleted: "ລຶບບັນຊີແລ້ວ.",
		MsgProfileUpdated: "ອັບເດດໂປຣໄຟລ໌ແລ້ວ.",
		MsgBookingCreated: "ການຈອງສຳເລັດ.", MsgBookingConfirmed: "ຢືນຢັນການຈອງແລ້ວ.",
		MsgBookingCompleted: "ການຈອງສຳເລັດ.", MsgBookingCancelled: "ຍົກເລີກການຈອງແລ້ວ.",
		MsgBookingNotFound: "ບໍ່ພົບການຈອງ.", MsgBookingInvalid: "ສະຖານະການຈອງບໍ່ຖືກ.",
		MsgPaymentSuccess: "ຊຳລະສຳເລັດ.", MsgPaymentFailed: "ຊຳລະລົ້ມເຫລວ.",
		MsgExperienceNotFound: "ບໍ່ພົບປະສົບການ.", MsgServiceDown: "ບໍລິການບໍ່ພ້ອມຊົ່ວຄາວ.",
	},
	LocaleTL: {
		MsgSystemError: "System error. Subukan muli.", MsgUnauthorized: "Mag-log in.",
		MsgForbidden: "Walang pahintulot.", MsgNotFound: "Hindi natagpuan.",
		MsgBadRequest: "Hindi valid.", MsgValidationError: "Suriin ang impormasyon.",
		MsgLoginSuccess: "Naka-log in na.", MsgLoginFailed: "Mali ang email o password.",
		MsgTokenExpired: "Nag-expire na.", MsgTokenInvalid: "Hindi valid ang token.",
		MsgLogoutSuccess: "Naka-log out na.", MsgAccountDeleted: "Na-delete ang account.",
		MsgProfileUpdated: "Na-update ang profile.",
		MsgBookingCreated: "Na-book na.", MsgBookingConfirmed: "Nakumpirma ang booking.",
		MsgBookingCompleted: "Tapos na ang booking.", MsgBookingCancelled: "Na-cancel ang booking.",
		MsgBookingNotFound: "Hindi natagpuan ang booking.", MsgBookingInvalid: "Hindi valid ang status.",
		MsgPaymentSuccess: "Matagumpay ang bayad.", MsgPaymentFailed: "Nabigo ang bayad.",
		MsgExperienceNotFound: "Hindi natagpuan.", MsgServiceDown: "Hindi available pansamantala.",
	},
	LocaleMY: {
		MsgSystemError: "စနစ်အမှား။", MsgUnauthorized: "ကျေးဇူးပြု၍ ဝင်ပါ။",
		MsgForbidden: "ခွင့်ပြုချက်မရှိပါ။", MsgNotFound: "ဒေတာမတွေ့ပါ။",
		MsgBadRequest: "တောင်းဆိုမှု မမှန်ပါ။", MsgValidationError: "အချက်အလက် စစ်ဆေးပါ။",
		MsgLoginSuccess: "ဝင်ရောက်ပြီး။", MsgLoginFailed: "အီးမေးလ် သို့ စကားဝှက် မမှန်။",
		MsgTokenExpired: "ဆက်ရှင်ကုန်ဆုံးပြီး။", MsgTokenInvalid: "Token မမှန်ပါ။",
		MsgLogoutSuccess: "ထွက်ပြီး။", MsgAccountDeleted: "အကောင့်ဖျက်ပြီး။",
		MsgProfileUpdated: "ပရိုဖိုင်အပ်ဒိတ်ပြီး။",
		MsgBookingCreated: "ဘွတ်ကင်ပြီး။", MsgBookingConfirmed: "အတည်ပြုပြီး။",
		MsgBookingCompleted: "ပြီးဆုံးပြီး။", MsgBookingCancelled: "ပယ်ဖျက်ပြီး။",
		MsgBookingNotFound: "ဘွတ်ကင်မတွေ့ပါ။", MsgBookingInvalid: "အခြေအနေ မမှန်ပါ။",
		MsgPaymentSuccess: "ငွေပေးချေပြီး။", MsgPaymentFailed: "ငွေပေးချေမှုမအောင်မြင်။",
		MsgExperienceNotFound: "အတွေ့အကြုံမတွေ့ပါ။", MsgServiceDown: "ဝန်ဆောင်မှု ယာယီရပ်ဆိုင်းထားသည်။",
	},
}

// T returns a translated message for the given locale and key.
// Falls back to Vietnamese (default) if translation is missing.
func T(locale SupportedLocale, key MessageKey) string {
	if msgs, ok := messages[locale]; ok {
		if msg, ok := msgs[key]; ok {
			return msg
		}
	}
	// Fallback to default locale
	if msgs, ok := messages[DefaultLocale]; ok {
		if msg, ok := msgs[key]; ok {
			return msg
		}
	}
	return string(key)
}

// GetLocaleFromRequest extracts locale from Accept-Language header or ?lang= query.
func GetLocaleFromRequest(c *gin.Context) SupportedLocale {
	// 1. Check ?lang= query parameter first
	if lang := c.Query("lang"); lang != "" {
		locale := normalizeLocale(lang)
		if _, ok := messages[locale]; ok {
			return locale
		}
	}

	// 2. Check Accept-Language header
	acceptLang := c.GetHeader("Accept-Language")
	if acceptLang != "" {
		// Simple parsing: take the first language tag
		parts := strings.Split(acceptLang, ",")
		if len(parts) > 0 {
			tag := strings.TrimSpace(strings.Split(parts[0], ";")[0])
			locale := normalizeLocale(tag)
			if _, ok := messages[locale]; ok {
				return locale
			}
		}
	}

	return DefaultLocale
}

func normalizeLocale(s string) SupportedLocale {
	s = strings.ToLower(strings.TrimSpace(s))
	// Handle cases like "en-US", "zh-CN", "ja-JP"
	if len(s) > 2 {
		s = s[:2]
	}
	return SupportedLocale(s)
}
