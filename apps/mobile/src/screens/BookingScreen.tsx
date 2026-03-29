import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { Booking, TravelerCurrency } from '@/services/api';
import { formatCurrencyFromVND } from '@/utils/currency';

type BookingTab = 'all' | 'upcoming' | 'completed' | 'cancelled';

type Props = {
  onOpenPayment: (booking: Booking) => void;
  currency: TravelerCurrency;
};

const STATUS_CONFIG: Record<Booking['status'], { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Chờ thanh toán', color: '#FF9800', bg: 'rgba(255,152,0,0.14)', icon: '💳' },
  confirmed: { label: 'Đã xác nhận', color: Colors.success, bg: 'rgba(76,175,80,0.15)', icon: '✅' },
  active: { label: 'Đang diễn ra', color: '#42A5F5', bg: 'rgba(66,165,245,0.14)', icon: '🚀' },
  completed: { label: 'Hoàn thành', color: Colors.success, bg: 'rgba(76,175,80,0.15)', icon: '🎉' },
  cancelled: { label: 'Đã huỷ', color: Colors.error, bg: 'rgba(244,67,54,0.15)', icon: '❌' },
  refunded: { label: 'Đã hoàn tiền', color: Colors.textSecondary, bg: 'rgba(158,158,158,0.16)', icon: '↩️' },
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

function matchesTab(tab: BookingTab, booking: Booking) {
  if (tab === 'all') return true;
  if (tab === 'completed') return booking.status === 'completed';
  if (tab === 'cancelled') return booking.status === 'cancelled' || booking.status === 'refunded';
  return booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'active';
}

export default function BookingScreen({ onOpenPayment, currency }: Props) {
  const [activeTab, setActiveTab] = useState<BookingTab>('all');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async () => {
    const result = await api.getBookings();
    if (result.success && result.data) {
      setBookings(result.data);
      setError('');
    } else {
      setError(result.error?.message || 'Không thể tải booking');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const filtered = useMemo(
    () => bookings.filter((booking) => matchesTab(activeTab, booking)),
    [activeTab, bookings]
  );

  const handleCancelBooking = async (booking: Booking) => {
    const result = await api.cancelBooking(booking.id, 'Huỷ từ ứng dụng mobile');
    if (!result.success) {
      setError(result.error?.message || 'Không thể huỷ booking');
      return;
    }

    await loadBookings();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đặt chỗ</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['all', 'upcoming', 'completed', 'cancelled'] as BookingTab[]).map((tab) => {
          const count = bookings.filter((booking) => matchesTab(tab, booking)).length;
          const label =
            tab === 'all' ? 'Tất cả' : tab === 'upcoming' ? 'Sắp tới' : tab === 'completed' ? 'Hoàn thành' : 'Đã huỷ';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
              <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải booking...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Chưa có booking nào</Text>
              <Text style={styles.emptyText}>Tạo booking từ một trải nghiệm để thấy dữ liệu thật ở đây.</Text>
            </View>
          ) : (
            filtered.map((booking) => {
              const status = STATUS_CONFIG[booking.status];
              return (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>
                      {status.icon} {status.label}
                    </Text>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.cardImage}>
                      <Text style={{ fontSize: 30 }}>
                        {booking.experience?.category === 'food'
                          ? '🍜'
                          : booking.experience?.category === 'tour'
                            ? '🏛️'
                            : '🎭'}
                      </Text>
                    </View>

                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {booking.experience?.title || 'Trải nghiệm Huế Travel'}
                      </Text>
                      <Text style={styles.cardGuide}>
                        👤 {booking.guide?.full_name || booking.experience?.guide?.full_name || 'Guide Huế Travel'}
                      </Text>
                      <View style={styles.cardMeta}>
                        <Text style={styles.cardMetaText}>📅 {formatDate(booking.booking_date)}</Text>
                        <Text style={styles.cardMetaText}>🕐 {booking.start_time}</Text>
                        <Text style={styles.cardMetaText}>👥 {booking.guest_count}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.priceLabel}>Tổng cộng</Text>
                      <Text style={styles.price}>{formatCurrencyFromVND(booking.total_price, currency)}</Text>
                    </View>

                    <View style={styles.actions}>
                      {booking.status === 'pending' ? (
                        <>
                          <TouchableOpacity style={styles.payBtn} onPress={() => onOpenPayment(booking)}>
                            <Text style={styles.payBtnText}>Thanh toán</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelBooking(booking)}>
                            <Text style={styles.cancelBtnText}>Huỷ</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}

                      {booking.status === 'confirmed' || booking.status === 'active' ? (
                        <TouchableOpacity style={styles.refreshInlineBtn} onPress={onRefresh}>
                          <Text style={styles.refreshInlineText}>Làm mới</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
  },
  refreshBtn: { padding: Spacing.sm },
  refreshIcon: { fontSize: 22, color: Colors.primary },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, fontWeight: Fonts.weights.medium as any },
  tabTextActive: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.bold as any },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: 'rgba(0,0,0,0.2)' },
  tabBadgeText: { fontSize: 10, color: Colors.textMuted, fontWeight: Fonts.weights.bold as any },
  tabBadgeTextActive: { color: Colors.textOnPrimary },
  errorBanner: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(244,67,54,0.12)',
    padding: Spacing.base,
  },
  errorText: { color: Colors.error, fontSize: Fonts.sizes.sm },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
  list: { paddingHorizontal: Spacing.xl },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginBottom: Spacing.sm },
  emptyText: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: 'center' },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  statusText: { fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.semibold as any },
  cardContent: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text, lineHeight: 20 },
  cardGuide: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 4 },
  cardMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: 6, flexWrap: 'wrap' },
  cardMetaText: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  price: { fontSize: Fonts.sizes.lg, color: Colors.text, fontWeight: Fonts.weights.bold as any, marginTop: 4 },
  actions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  payBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  payBtnText: { color: Colors.textOnPrimary, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any },
  cancelBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any },
  refreshInlineBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  refreshInlineText: { color: Colors.primary, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any },
});
