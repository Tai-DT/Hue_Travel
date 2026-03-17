/**
 * Shared constants for Hue Travel app.
 */

/** Booking status labels */
export const BOOKING_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Chờ xác nhận', color: '#F59E0B', icon: '⏳' },
  confirmed: { label: 'Đã xác nhận', color: '#10B981', icon: '✅' },
  active: { label: 'Đang diễn ra', color: '#3B82F6', icon: '🚀' },
  completed: { label: 'Hoàn thành', color: '#8B5CF6', icon: '🏆' },
  cancelled: { label: 'Đã hủy', color: '#EF4444', icon: '❌' },
  refunded: { label: 'Đã hoàn tiền', color: '#6B7280', icon: '💰' },
};

/** Experience category labels */
export const CATEGORIES: Record<string, { label: string; icon: string }> = {
  sightseeing: { label: 'Tham quan', icon: '🏛️' },
  food: { label: 'Ẩm thực', icon: '🍜' },
  experience: { label: 'Trải nghiệm', icon: '✨' },
  tour: { label: 'Tour', icon: '🚐' },
  stay: { label: 'Lưu trú', icon: '🏨' },
  transport: { label: 'Di chuyển', icon: '🛵' },
};

/** Achievement category labels */
export const ACHIEVEMENT_CATEGORIES: Record<string, { label: string; color: string }> = {
  general: { label: 'Chung', color: '#6B7280' },
  explorer: { label: 'Khám phá', color: '#3B82F6' },
  reviewer: { label: 'Đánh giá', color: '#F59E0B' },
  social: { label: 'Xã hội', color: '#EC4899' },
  foodie: { label: 'Ẩm thực', color: '#EF4444' },
};

/** Payment method labels */
export const PAYMENT_METHODS: Record<string, { label: string; icon: string }> = {
  momo: { label: 'MoMo', icon: '📱' },
  vnpay: { label: 'VNPay', icon: '🏦' },
  zalopay: { label: 'ZaloPay', icon: '💳' },
  cash: { label: 'Tiền mặt', icon: '💵' },
};

/** Guide badge levels */
export const BADGE_LEVELS: Record<string, { label: string; color: string; icon: string }> = {
  bronze: { label: 'Đồng', color: '#CD7F32', icon: '🥉' },
  silver: { label: 'Bạc', color: '#C0C0C0', icon: '🥈' },
  gold: { label: 'Vàng', color: '#FFD700', icon: '🥇' },
  platinum: { label: 'Bạch kim', color: '#E5E4E2', icon: '💎' },
};
