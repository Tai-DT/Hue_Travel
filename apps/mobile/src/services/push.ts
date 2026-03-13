// ============================================
// Push Notifications — Foreground Handling
// ============================================
// Handles push notifications when app is in foreground.
// Shows in-app toast/banner instead of system notification.
// ============================================

import { Alert, Vibration } from 'react-native';

export type PushNotification = {
  title: string;
  body: string;
  data?: {
    type?: string; // 'booking_confirmed' | 'new_message' | 'review_received' | etc.
    booking_id?: string;
    experience_id?: string;
    room_id?: string;
    [key: string]: any;
  };
};

type NotificationHandler = (notification: PushNotification) => void;

class PushNotificationService {
  private handlers: NotificationHandler[] = [];
  private enabled = true;

  /**
   * Register a handler for incoming notifications
   */
  onNotification(handler: NotificationHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  /**
   * Handle an incoming push notification (called from native bridge)
   */
  handleForegroundNotification(notification: PushNotification): void {
    if (!this.enabled) return;

    // Haptic feedback
    Vibration.vibrate(100);

    // Notify all registered handlers
    this.handlers.forEach(handler => {
      try {
        handler(notification);
      } catch {
        // Prevent handler errors from crashing
      }
    });

    // Show in-app alert as fallback
    if (this.handlers.length === 0) {
      this.showAlert(notification);
    }
  }

  /**
   * Show a native alert for the notification
   */
  private showAlert(notification: PushNotification): void {
    const { title, body, data } = notification;

    const buttons: Array<{ text: string; onPress?: () => void }> = [
      { text: 'Đóng' },
    ];

    if (data?.type === 'new_message' && data.room_id) {
      buttons.unshift({
        text: '💬 Xem tin nhắn',
        onPress: () => this.navigateTo('chat', data.room_id!),
      });
    } else if (data?.type === 'booking_confirmed' && data.booking_id) {
      buttons.unshift({
        text: '📋 Xem booking',
        onPress: () => this.navigateTo('booking', data.booking_id!),
      });
    }

    Alert.alert(title || 'Thông báo', body || '', buttons);
  }

  /**
   * Navigate to a specific screen based on notification data
   */
  private navigateTo(type: string, id: string): void {
    // This will be connected to the app's navigation
    // via deeplink or navigation ref
    const event = new CustomEvent('navigate', { detail: { type, id } });
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).__pushNavigation = { type, id };
    }
  }

  /**
   * Simulate a notification (for testing in development)
   */
  simulateNotification(notification: PushNotification): void {
    console.log('[Push] Simulating notification:', notification);
    this.handleForegroundNotification(notification);
  }

  /**
   * Enable/disable notification handling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get notification type label
   */
  static getTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      booking_confirmed: '📋 Booking xác nhận',
      booking_cancelled: '❌ Booking bị huỷ',
      booking_completed: '🎉 Tour hoàn thành',
      new_message: '💬 Tin nhắn mới',
      review_received: '⭐ Đánh giá mới',
      payment_success: '💰 Thanh toán thành công',
      guide_accepted: '✅ Guide chấp nhận',
      system: '🔔 Hệ thống',
    };
    return labels[type || ''] || '🔔 Thông báo';
  }
}

export const pushService = new PushNotificationService();
export default pushService;
