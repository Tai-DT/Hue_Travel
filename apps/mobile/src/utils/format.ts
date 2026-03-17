/**
 * Shared formatting utilities for Hue Travel mobile app.
 * Eliminates duplicate formatPrice, formatDuration, formatDate across screens.
 */

/** Format VND price: 350000 → "350,000₫" */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + '₫';
}

/** Format duration from minutes: 180 → "3h", 150 → "2h30m" */
export function formatDuration(durationMins: number): string {
  const hours = Math.floor(durationMins / 60);
  const minutes = durationMins % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`;
}

/** Format date to Vietnamese locale: "16/03/2026" */
export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format date to relative time: "2 giờ trước", "3 ngày trước" */
export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  return formatDate(date);
}

/** Format rating: 4.85 → "4.9" */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** Truncate text with ellipsis: "Very long..." */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + '…';
}

/** Generate initials from name: "Nguyễn Văn Minh" → "NM" */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Validate Vietnamese phone number */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return /^(0|84|\+84)(3|5|7|8|9)\d{8}$/.test(cleaned);
}

/** Validate email */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
