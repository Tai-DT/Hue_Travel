import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

type BookingStatus = 'upcoming' | 'completed' | 'cancelled';

type Booking = {
  id: string;
  title: string;
  category: string;
  guide_name: string;
  date: string;
  time: string;
  guests: number;
  total_price: number;
  status: BookingStatus;
};

const mockBookings: Booking[] = [
  { id: '1', title: 'Khám phá Ẩm thực Hoàng Cung', category: 'food', guide_name: 'Nguyễn Văn Minh', date: '15/03/2026', time: '09:00', guests: 2, total_price: 630000, status: 'upcoming' },
  { id: '2', title: 'Tour Đại Nội buổi sáng', category: 'tour', guide_name: 'Lê Hoàng Dũng', date: '18/03/2026', time: '07:00', guests: 4, total_price: 1260000, status: 'upcoming' },
  { id: '3', title: 'Chèo thuyền sông Hương', category: 'experience', guide_name: 'Trần Thị Lan', date: '10/03/2026', time: '17:00', guests: 2, total_price: 420000, status: 'completed' },
  { id: '4', title: 'Lăng Tự Đức & Khải Định', category: 'tour', guide_name: 'Phạm Quốc Bảo', date: '05/03/2026', time: '14:00', guests: 1, total_price: 350000, status: 'cancelled' },
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const statusConfig: Record<BookingStatus, { label: string; color: string; bg: string; icon: string }> = {
  upcoming: { label: 'Sắp tới', color: Colors.primary, bg: 'rgba(249,168,37,0.15)', icon: '📅' },
  completed: { label: 'Hoàn thành', color: Colors.success, bg: 'rgba(76,175,80,0.15)', icon: '✅' },
  cancelled: { label: 'Đã huỷ', color: Colors.error, bg: 'rgba(244,67,54,0.15)', icon: '❌' },
};

const categoryEmojis: Record<string, string> = {
  food: '🍜', tour: '🏛️', experience: '🎭', sightseeing: '🌸',
};

export default function BookingScreen() {
  const [activeTab, setActiveTab] = useState<BookingStatus>('upcoming');

  const filtered = mockBookings.filter((b) => b.status === activeTab);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đặt chỗ</Text>
        <TouchableOpacity style={styles.calendarBtn}>
          <Text style={{ fontSize: 22 }}>📅</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['upcoming', 'completed', 'cancelled'] as BookingStatus[]).map((tab) => {
          const count = mockBookings.filter((b) => b.status === tab).length;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {statusConfig[tab].label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Booking List */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Chưa có booking nào</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'upcoming' ? 'Hãy khám phá và đặt trải nghiệm đầu tiên!' : 'Không có booking trong mục này.'}
            </Text>
          </View>
        ) : (
          filtered.map((booking) => (
            <TouchableOpacity key={booking.id} style={styles.bookingCard} activeOpacity={0.8}>
              {/* Status Badge */}
              <View style={[styles.statusBadge, { backgroundColor: statusConfig[booking.status].bg }]}>
                <Text style={[styles.statusText, { color: statusConfig[booking.status].color }]}>
                  {statusConfig[booking.status].icon} {statusConfig[booking.status].label}
                </Text>
              </View>

              {/* Main Content */}
              <View style={styles.cardContent}>
                <View style={styles.cardImage}>
                  <Text style={{ fontSize: 32 }}>{categoryEmojis[booking.category] || '🎭'}</Text>
                </View>

                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{booking.title}</Text>
                  <Text style={styles.cardGuide}>👤 {booking.guide_name}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardMetaText}>📅 {booking.date}</Text>
                    <Text style={styles.cardMetaText}>🕐 {booking.time}</Text>
                    <Text style={styles.cardMetaText}>👥 {booking.guests}</Text>
                  </View>
                </View>
              </View>

              {/* Price & Actions */}
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.priceLabel}>Tổng cộng</Text>
                  <Text style={styles.price}>{formatPrice(booking.total_price)}</Text>
                </View>

                <View style={styles.actions}>
                  {booking.status === 'upcoming' && (
                    <>
                      <TouchableOpacity style={styles.chatBtn}>
                        <Text style={styles.chatBtnText}>💬 Chat</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Huỷ</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {booking.status === 'completed' && (
                    <TouchableOpacity style={styles.reviewBtn}>
                      <Text style={styles.reviewBtnText}>⭐ Đánh giá</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  calendarBtn: { padding: Spacing.sm },

  // Tabs
  tabs: {
    flexDirection: 'row', marginHorizontal: Spacing.xl, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl, padding: 4, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, gap: 4,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.medium as any, color: Colors.textMuted },
  tabTextActive: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.bold as any },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: 'rgba(0,0,0,0.2)' },
  tabBadgeText: { fontSize: 10, fontWeight: Fonts.weights.bold as any, color: Colors.textMuted },
  tabBadgeTextActive: { color: Colors.textOnPrimary },

  // List
  list: { paddingHorizontal: Spacing.xl },

  // Empty State
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginBottom: Spacing.sm },
  emptyText: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: 'center' },

  // Booking Card
  bookingCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.base, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderRadius: BorderRadius.full, marginBottom: Spacing.sm,
  },
  statusText: { fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.semibold as any },

  cardContent: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  cardImage: {
    width: 64, height: 64, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text, lineHeight: 20 },
  cardGuide: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 4 },
  cardMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: 6 },
  cardMetaText: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md,
  },
  priceLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  price: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.primary },

  actions: { flexDirection: 'row', gap: Spacing.sm },
  chatBtn: {
    backgroundColor: 'rgba(249,168,37,0.15)', paddingHorizontal: Spacing.md,
    paddingVertical: 8, borderRadius: BorderRadius.md,
  },
  chatBtnText: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  cancelBtn: {
    backgroundColor: 'rgba(244,67,54,0.1)', paddingHorizontal: Spacing.md,
    paddingVertical: 8, borderRadius: BorderRadius.md,
  },
  cancelBtnText: { fontSize: Fonts.sizes.sm, color: Colors.error, fontWeight: Fonts.weights.semibold as any },
  reviewBtn: {
    backgroundColor: 'rgba(249,168,37,0.15)', paddingHorizontal: Spacing.md,
    paddingVertical: 8, borderRadius: BorderRadius.md,
  },
  reviewBtnText: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
});
