// ============================================
// Push Notifications — expo-notifications integration
// ============================================
// Full push notification support:
//   - Permission request & FCM/APNs token registration
//   - Foreground notification as in-app toast
//   - Background/killed notification handling
//   - Deep link navigation from notification tap
// ============================================

import { Alert, Platform, Vibration } from 'react-native';
import api from './api';

// expo-notifications is optional — graceful fallback if not installed or on Expo Go
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
let Constants: typeof import('expo-constants') | null = null;

// Load Constants first to check if we're in Expo Go
try {
  Constants = require('expo-constants');
} catch {
  // optional
}

// Check if running in Expo Go (where push notifications are not supported in SDK 53+)
const isExpoGo = Constants?.default?.appOwnership === 'expo' || Constants?.default?.executionEnvironment === 'storeClient';

try {
  if (!isExpoGo) {
    Notifications = require('expo-notifications');
  } else {
    console.log('[Push] Running in Expo Go — push notifications disabled (SDK 53+)');
  }
} catch {
  console.log('[Push] expo-notifications not available — using mock mode');
}

try {
  Device = require('expo-device');
} catch {
  // optional
}

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
  private expoPushToken: string | null = null;
  private initialized = false;
  private preferences = {
    chatEnabled: true,
    promoEnabled: false,
  };

  /**
   * Initialize push notifications — call this once at app startup
   * Requests permissions, gets token, sets up listeners
   */
  async initialize(): Promise<string | null> {
    if (this.initialized) return this.expoPushToken;
    this.initialized = true;

    if (!Notifications) {
      console.log('[Push] Running in mock mode (no expo-notifications)');
      return null;
    }

    try {
      // 1. Request permission
      const token = await this.registerForPushNotifications();

      // 2. Set up notification channels (Android)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Huế Travel',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#F9A825',
          sound: 'default',
        });
      }

      // 3. Handle foreground notifications
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false, // We handle display ourselves
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: true,
        }),
      });

      // 4. Foreground listener
      Notifications.addNotificationReceivedListener((notification) => {
        const content = notification.request.content;
        this.handleForegroundNotification({
          title: content.title || 'Thông báo',
          body: content.body || '',
          data: content.data as PushNotification['data'],
        });
      });

      // 5. Tap response listener (background/killed → user taps notification)
      Notifications.addNotificationResponseReceivedListener((response) => {
        const content = response.notification.request.content;
        const data = content.data as PushNotification['data'];
        if (data?.type) {
          this.navigateTo(data.type, data.booking_id || data.room_id || data.experience_id || '');
        }
      });

      return token;
    } catch (error) {
      console.warn('[Push] Initialization failed:', error);
      return null;
    }
  }

  /**
   * Register for push notifications and get the expo/FCM token
   */
  private async registerForPushNotifications(): Promise<string | null> {
    if (!Notifications) return null;

    // Check device (notifications don't work on simulator)
    if (Device && !Device.isDevice) {
      console.log('[Push] Must use physical device for push notifications');
      return null;
    }

    // Check existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    // Get push token
    try {
      const projectId = Constants?.default?.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      this.expoPushToken = tokenData.data;
      console.log(`[Push] Token: ${this.expoPushToken}`);

      // Register with backend
      await this.registerTokenWithBackend(this.expoPushToken);

      return this.expoPushToken;
    } catch (error) {
      console.warn('[Push] Failed to get token:', error);
      return null;
    }
  }

  /**
   * Send token to backend for server-side push
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      await api.registerDevice({ fcm_token: token, platform: Platform.OS });
      console.log('[Push] Token registered with backend');
    } catch (error) {
      console.warn('[Push] Backend registration failed:', error);
    }
  }

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
   * Handle an incoming push notification (foreground)
   */
  handleForegroundNotification(notification: PushNotification): void {
    if (!this.enabled) return;
    if (!this.shouldDeliver(notification)) return;

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
    // Store navigation intent for the app to pick up
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).__pushNavigation = { type, id };
    }
  }

  /**
   * Get the current push token (if registered)
   */
  getToken(): string | null {
    return this.expoPushToken;
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

  setPreferences(preferences: { chatEnabled?: boolean; promoEnabled?: boolean }): void {
    this.preferences = {
      ...this.preferences,
      ...preferences,
    };
  }

  private shouldDeliver(notification: PushNotification): boolean {
    const type = notification.data?.type;
    if (type === 'new_message' && !this.preferences.chatEnabled) {
      return false;
    }
    if (type === 'promotion' && !this.preferences.promoEnabled) {
      return false;
    }
    return true;
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
