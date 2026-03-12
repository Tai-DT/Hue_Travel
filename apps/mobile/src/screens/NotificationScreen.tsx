import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { NotificationItem as APINotificationItem } from '@/services/api';

// ============================================
// Notification Screen
// ============================================

type NotificationType =
  | 'booking_confirmed'
  | 'new_message'
  | 'payment_success'
  | 'level_up'
  | 'promotion'
  | 'booking_reminder'
  | 'new_review';

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

const NOTIF_ICON: Record<NotificationType, string> = {
  booking_confirmed: '✅',
  new_message: '💬',
  payment_success: '💳',
  level_up: '🎉',
  promotion: '🎁',
  booking_reminder: '⏰',
  new_review: '📝',
};

const NOTIF_COLOR: Record<NotificationType, string> = {
  booking_confirmed: '#4CAF50',
  new_message: '#42A5F5',
  payment_success: '#F9A825',
  level_up: '#E040FB',
  promotion: '#FF7043',
  booking_reminder: '#FFB300',
  new_review: '#26A69A',
};

type FilterTab = 'all' | 'unread';

function formatRelativeTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
}

function normalizeNotification(item: APINotificationItem): NotificationItem {
  const knownTypes = new Set<NotificationType>([
    'booking_confirmed',
    'new_message',
    'payment_success',
    'level_up',
    'promotion',
    'booking_reminder',
    'new_review',
  ]);

  return {
    id: item.id,
    type: knownTypes.has(item.type as NotificationType)
      ? (item.type as NotificationType)
      : 'promotion',
    title: item.title,
    body: item.body,
    isRead: item.is_read,
    createdAt: formatRelativeTime(item.created_at),
  };
}

export default function NotificationScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    const result = await api.getNotifications();

    if (result.success && result.data) {
      setNotifications(result.data.notifications.map(normalizeNotification));
      setError('');
      return;
    }

    setError(result.error?.message || 'Không thể tải thông báo');
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const displayNotifs = filter === 'all' ? notifications : notifications.filter((n) => !n.isRead);

  const markRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllRead = async () => {
    await api.markNotificationRead('all');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Thông báo</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} chưa đọc</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Đọc tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Tất cả ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
            Chưa đọc ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notification List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {displayNotifs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Không có thông báo mới</Text>
            <Text style={styles.emptyText}>Tất cả đã đọc!</Text>
          </View>
        ) : (
          displayNotifs.map((notif) => (
            <TouchableOpacity
              key={notif.id}
              style={[styles.notifItem, !notif.isRead && styles.notifItemUnread]}
              onPress={() => markRead(notif.id)}
              activeOpacity={0.7}
            >
              {/* Indicator dot */}
              {!notif.isRead && <View style={styles.unreadDot} />}

              {/* Icon */}
              <View style={[styles.notifIcon, { backgroundColor: (NOTIF_COLOR[notif.type] || Colors.primary) + '20' }]}>
                <Text style={styles.notifEmoji}>{NOTIF_ICON[notif.type] || '🔔'}</Text>
              </View>

              {/* Content */}
              <View style={styles.notifContent}>
                <Text
                  style={[styles.notifTitle, !notif.isRead && styles.notifTitleUnread]}
                  numberOfLines={1}
                >
                  {notif.title}
                </Text>
                <Text style={styles.notifBody} numberOfLines={2}>
                  {notif.body}
                </Text>
                <Text style={styles.notifTime}>{notif.createdAt}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base,
    paddingTop: 55, paddingBottom: Spacing.md, gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.sm },
  backIcon: { fontSize: 24, color: Colors.text },
  headerTitle: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  headerSub: { fontSize: Fonts.sizes.xs, color: Colors.primary, marginTop: 2 },
  markAllBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceLight,
  },
  markAllText: { fontSize: Fonts.sizes.xs, color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  errorBanner: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255, 112, 67, 0.14)',
  },
  errorText: { fontSize: Fonts.sizes.sm, color: Colors.text },

  // Filter
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.base, marginBottom: Spacing.md, gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.base, paddingVertical: 8,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  filterTextActive: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.semibold as any },

  // Notification Item
  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md, gap: Spacing.md, position: 'relative',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  notifItemUnread: {
    backgroundColor: 'rgba(249, 168, 37, 0.05)',
  },
  unreadDot: {
    position: 'absolute', left: 8, top: Spacing.md + 16,
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary,
  },
  notifIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  notifEmoji: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifTitle: {
    fontSize: Fonts.sizes.md, color: Colors.text,
    fontWeight: Fonts.weights.medium as any,
  },
  notifTitleUnread: { fontWeight: Fonts.weights.bold as any },
  notifBody: {
    fontSize: Fonts.sizes.sm, color: Colors.textSecondary,
    marginTop: 4, lineHeight: 18,
  },
  notifTime: {
    fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 6,
  },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: { fontSize: 48, opacity: 0.5 },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  emptyText: { fontSize: Fonts.sizes.md, color: Colors.textMuted },
});
