import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { Experience } from '@/services/api';

const { width, height } = Dimensions.get('window');

type Props = {
  experience: Experience;
  onBack: () => void;
};

export default function ExperienceDetailScreen({ experience, onBack }: Props) {
  const [showBooking, setShowBooking] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('vi-VN').format(price) + '₫';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <View style={styles.heroImage}>
            <Text style={styles.heroEmoji}>
              {experience.category === 'food' ? '🍜' : experience.category === 'tour' ? '🏛️' : '🎭'}
            </Text>
          </View>

          {/* Top Navigation */}
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.navButton} onPress={onBack}>
              <Text style={styles.navIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.navRight}>
              <TouchableOpacity style={styles.navButton}>
                <Text style={styles.navIcon}>↗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => setIsFavorited(!isFavorited)}
              >
                <Text style={styles.navIcon}>{isFavorited ? '❤️' : '♡'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Instant Badge */}
          {experience.is_instant && (
            <View style={styles.instantBadge}>
              <Text style={styles.instantText}>⚡ Đặt ngay • Xác nhận tức thì</Text>
            </View>
          )}

          {/* Image Dots */}
          <View style={styles.imageDots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[styles.dot, i === activeImageIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title & Rating */}
          <Text style={styles.title}>{experience.title}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.star}>⭐</Text>
            <Text style={styles.ratingText}>{experience.rating}</Text>
            <Text style={styles.ratingCount}>({experience.rating_count} đánh giá)</Text>
            <View style={styles.dot2} />
            <Text style={styles.duration}>🕐 {Math.floor(experience.duration_mins / 60)}h{experience.duration_mins % 60 > 0 ? `${experience.duration_mins % 60}m` : ''}</Text>
            <View style={styles.dot2} />
            <Text style={styles.guests}>👥 Tối đa {experience.max_guests}</Text>
          </View>

          {/* Guide Card */}
          {experience.guide && (
            <TouchableOpacity style={styles.guideCard}>
              <View style={styles.guideAvatar}>
                <Text style={styles.guideInitial}>{experience.guide.full_name[0]}</Text>
              </View>
              <View style={styles.guideInfo}>
                <Text style={styles.guideName}>{experience.guide.full_name}</Text>
                <Text style={styles.guideRole}>Hướng dẫn viên</Text>
              </View>
              <View style={styles.guideBadge}>
                <Text style={styles.guideBadgeText}>🥇 Gold</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.description}>
              {experience.description ||
                'Trải nghiệm đặc biệt tại Huế, được dẫn dắt bởi người bản địa am hiểu văn hoá và lịch sử. Bạn sẽ được khám phá những điều thú vị mà ít du khách biết đến, thưởng thức ẩm thực authentic, và tạo những kỷ niệm đáng nhớ.'}
            </Text>
          </View>

          {/* Highlights */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Điểm nổi bật</Text>
            {(experience.highlights?.length
              ? experience.highlights
              : ['Trải nghiệm văn hoá authentic', 'Hướng dẫn viên bản địa', 'Đồ ăn & nước uống miễn phí', 'Chụp ảnh kỷ niệm']
            ).map((hl, i) => (
              <View key={i} style={styles.highlightItem}>
                <Text style={styles.highlightIcon}>✦</Text>
                <Text style={styles.highlightText}>{hl}</Text>
              </View>
            ))}
          </View>

          {/* Includes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bao gồm</Text>
            <View style={styles.includesGrid}>
              {(experience.includes?.length
                ? experience.includes
                : ['Đồ ăn', 'Nước uống', 'Xe đưa đón', 'Vé tham quan']
              ).map((inc, i) => (
                <View key={i} style={styles.includeChip}>
                  <Text style={styles.includeIcon}>✓</Text>
                  <Text style={styles.includeText}>{inc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Meeting Point */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Điểm hẹn</Text>
            <View style={styles.meetingCard}>
              <Text style={styles.meetingIcon}>📍</Text>
              <View>
                <Text style={styles.meetingText}>
                  {experience.meeting_point || '15 Lê Lợi, Phú Hội, TP Huế'}
                </Text>
                <Text style={styles.meetingHint}>Guide sẽ đón bạn tại đây</Text>
              </View>
            </View>
          </View>

          {/* Reviews Preview */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Đánh giá</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Xem tất cả →</Text>
              </TouchableOpacity>
            </View>

            {/* Rating Summary */}
            <View style={styles.ratingSummary}>
              <View style={styles.ratingBig}>
                <Text style={styles.ratingBigNumber}>{experience.rating}</Text>
                <Text style={styles.ratingBigStar}>⭐</Text>
              </View>
              <View style={styles.ratingBars}>
                {[5, 4, 3, 2, 1].map((star) => (
                  <View key={star} style={styles.ratingBar}>
                    <Text style={styles.ratingBarLabel}>{star}</Text>
                    <View style={styles.ratingBarTrack}>
                      <View
                        style={[
                          styles.ratingBarFill,
                          { width: `${star === 5 ? 70 : star === 4 ? 20 : 5}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Sample Reviews */}
            <View style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerAvatar}>
                  <Text style={styles.reviewerInitial}>L</Text>
                </View>
                <View>
                  <Text style={styles.reviewerName}>Linh Nguyễn</Text>
                  <Text style={styles.reviewDate}>2 ngày trước • ⭐ 5.0</Text>
                </View>
              </View>
              <Text style={styles.reviewText}>
                Trải nghiệm tuyệt vời! Guide rất thân thiện và am hiểu, đồ ăn rất ngon. Highly recommend! 🔥
              </Text>
            </View>
          </View>

          {/* Cancel Policy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chính sách huỷ</Text>
            <View style={styles.policyCard}>
              <Text style={styles.policyIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.policyTitle}>Huỷ miễn phí trước 24h</Text>
                <Text style={styles.policyText}>
                  Hoàn 100% nếu huỷ trước 24 giờ. Sau đó hoàn 50%.
                </Text>
              </View>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Từ</Text>
          <Text style={styles.price}>{formatPrice(experience.price)}</Text>
          <Text style={styles.priceUnit}>/người</Text>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => setShowBooking(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.bookButtonText}>Đặt ngay</Text>
        </TouchableOpacity>
      </View>

      {/* Booking Modal */}
      <BookingModal
        visible={showBooking}
        experience={experience}
        onClose={() => setShowBooking(false)}
      />
    </View>
  );
}

// ============================================
// Booking Modal
// ============================================
function BookingModal({
  visible,
  experience,
  onClose,
}: {
  visible: boolean;
  experience: Experience;
  onClose: () => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [guests, setGuests] = useState(1);
  const [notes, setNotes] = useState('');

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('vi-VN').format(price) + '₫';

  const totalPrice = experience.price * guests;
  const serviceFee = Math.floor(totalPrice * 0.05);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          {/* Header */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>Đặt trải nghiệm</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Experience Summary */}
            <View style={modalStyles.summary}>
              <View style={modalStyles.summaryImage}>
                <Text style={{ fontSize: 28 }}>
                  {experience.category === 'food' ? '🍜' : '🏛️'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.summaryTitle} numberOfLines={2}>
                  {experience.title}
                </Text>
                <Text style={modalStyles.summaryMeta}>
                  ⭐ {experience.rating} • 🕐 {Math.floor(experience.duration_mins / 60)}h
                </Text>
              </View>
            </View>

            {/* Date Selection */}
            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>📅 Ngày</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="YYYY-MM-DD (VD: 2026-03-15)"
                placeholderTextColor={Colors.textMuted}
                value={date}
                onChangeText={setDate}
              />
            </View>

            {/* Time Selection */}
            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>🕐 Giờ bắt đầu</Text>
              <View style={modalStyles.timeRow}>
                {['07:00', '09:00', '14:00', '17:00', '19:00'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[modalStyles.timeChip, time === t && modalStyles.timeChipActive]}
                    onPress={() => setTime(t)}
                  >
                    <Text style={[modalStyles.timeText, time === t && modalStyles.timeTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Guest Count */}
            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>
                👥 Số khách (tối đa {experience.max_guests})
              </Text>
              <View style={modalStyles.guestRow}>
                <TouchableOpacity
                  style={modalStyles.guestBtn}
                  onPress={() => setGuests(Math.max(1, guests - 1))}
                >
                  <Text style={modalStyles.guestBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={modalStyles.guestCount}>{guests}</Text>
                <TouchableOpacity
                  style={modalStyles.guestBtn}
                  onPress={() => setGuests(Math.min(experience.max_guests, guests + 1))}
                >
                  <Text style={modalStyles.guestBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Special Notes */}
            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>📝 Ghi chú (tuỳ chọn)</Text>
              <TextInput
                style={[modalStyles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Dị ứng thực phẩm, yêu cầu đặc biệt..."
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>

            {/* Price Breakdown */}
            <View style={modalStyles.priceBreakdown}>
              <View style={modalStyles.priceRow}>
                <Text style={modalStyles.priceLabel}>
                  {formatPrice(experience.price)} × {guests} khách
                </Text>
                <Text style={modalStyles.priceValue}>{formatPrice(totalPrice)}</Text>
              </View>
              <View style={modalStyles.priceRow}>
                <Text style={modalStyles.priceLabel}>Phí dịch vụ (5%)</Text>
                <Text style={modalStyles.priceValue}>{formatPrice(serviceFee)}</Text>
              </View>
              <View style={[modalStyles.priceRow, modalStyles.totalRow]}>
                <Text style={modalStyles.totalLabel}>Tổng cộng</Text>
                <Text style={modalStyles.totalValue}>
                  {formatPrice(totalPrice + serviceFee)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity style={modalStyles.confirmButton} activeOpacity={0.85}>
            <Text style={modalStyles.confirmText}>
              Xác nhận đặt — {formatPrice(totalPrice + serviceFee)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Hero
  heroContainer: { height: 300, position: 'relative' },
  heroImage: {
    flex: 1, backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  heroEmoji: { fontSize: 72 },
  topNav: {
    position: 'absolute', top: 50, left: Spacing.base, right: Spacing.base,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  navRight: { flexDirection: 'row', gap: Spacing.sm },
  navButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  navIcon: { fontSize: 18, color: '#FFF' },
  instantBadge: {
    position: 'absolute', bottom: Spacing.xxxl, left: Spacing.base,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  instantText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold, color: Colors.textOnPrimary },
  imageDots: {
    position: 'absolute', bottom: Spacing.base,
    flexDirection: 'row', alignSelf: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFF', width: 18 },

  // Content
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  title: { fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.bold, color: Colors.text, lineHeight: 30 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, gap: 4, flexWrap: 'wrap' },
  star: { fontSize: 14 },
  ratingText: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.bold, color: Colors.text },
  ratingCount: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  dot2: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted, marginHorizontal: 4 },
  duration: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  guests: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },

  // Guide
  guideCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  guideAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.primary,
  },
  guideInitial: { fontSize: 20, fontWeight: Fonts.weights.bold, color: Colors.primary },
  guideInfo: { flex: 1 },
  guideName: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold, color: Colors.text },
  guideRole: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  guideBadge: {
    backgroundColor: 'rgba(249, 168, 37, 0.15)', paddingHorizontal: Spacing.sm,
    paddingVertical: 4, borderRadius: BorderRadius.sm,
  },
  guideBadgeText: { fontSize: Fonts.sizes.xs, color: Colors.primary, fontWeight: Fonts.weights.semibold },

  // Sections
  section: { marginTop: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold, color: Colors.text, marginBottom: Spacing.md },
  seeAll: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.semibold },
  description: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, lineHeight: 22 },

  // Highlights
  highlightItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  highlightIcon: { fontSize: 14, color: Colors.primary },
  highlightText: { fontSize: Fonts.sizes.md, color: Colors.text },

  // Includes
  includesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  includeChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.1)',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full,
    gap: 4, borderWidth: 1, borderColor: 'rgba(76,175,80,0.2)',
  },
  includeIcon: { fontSize: 12, color: Colors.success, fontWeight: Fonts.weights.bold },
  includeText: { fontSize: Fonts.sizes.sm, color: Colors.success },

  // Meeting
  meetingCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  meetingIcon: { fontSize: 24 },
  meetingText: { fontSize: Fonts.sizes.md, color: Colors.text, fontWeight: Fonts.weights.medium },
  meetingHint: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

  // Rating Summary
  ratingSummary: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    padding: Spacing.base, borderRadius: BorderRadius.lg, gap: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
  },
  ratingBig: { alignItems: 'center' },
  ratingBigNumber: { fontSize: 36, fontWeight: Fonts.weights.bold, color: Colors.primary },
  ratingBigStar: { fontSize: 18 },
  ratingBars: { flex: 1, gap: 3 },
  ratingBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ratingBarLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, width: 12, textAlign: 'center' },
  ratingBarTrack: { flex: 1, height: 4, backgroundColor: Colors.surfaceLight, borderRadius: 2, overflow: 'hidden' },
  ratingBarFill: { height: '100%', backgroundColor: Colors.star, borderRadius: 2 },

  // Review Item
  reviewItem: {
    backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  reviewerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },
  reviewerInitial: { fontSize: 16, fontWeight: Fonts.weights.bold, color: Colors.primary },
  reviewerName: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.semibold, color: Colors.text },
  reviewDate: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  reviewText: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, lineHeight: 20 },

  // Policy
  policyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(66,165,245,0.1)',
    padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(66,165,245,0.2)',
  },
  policyIcon: { fontSize: 28 },
  policyTitle: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.semibold, color: Colors.info },
  policyText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 34,
  },
  priceSection: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  priceLabel: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  price: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.bold, color: Colors.primary },
  priceUnit: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  bookButton: {
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.xl,
  },
  bookButtonText: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.bold, color: Colors.textOnPrimary },
});

// ============================================
// Modal Styles
// ============================================
const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: height * 0.9, paddingHorizontal: Spacing.xl, paddingBottom: 34,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  headerTitle: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.bold, color: Colors.text },
  closeIcon: { fontSize: 20, color: Colors.textMuted, padding: Spacing.sm },

  summary: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl,
  },
  summaryImage: {
    width: 56, height: 56, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  summaryTitle: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.semibold, color: Colors.text },
  summaryMeta: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },

  field: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.semibold, color: Colors.text, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    color: Colors.text, fontSize: Fonts.sizes.md,
  },

  timeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  timeChip: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  timeChipActive: { backgroundColor: 'rgba(249,168,37,0.15)', borderColor: Colors.primary },
  timeText: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, fontWeight: Fonts.weights.medium },
  timeTextActive: { color: Colors.primary, fontWeight: Fonts.weights.semibold },

  guestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  guestBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  guestBtnText: { fontSize: 22, color: Colors.text, fontWeight: Fonts.weights.medium },
  guestCount: { fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.bold, color: Colors.text, minWidth: 40, textAlign: 'center' },

  priceBreakdown: {
    backgroundColor: Colors.surface, padding: Spacing.base, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: Fonts.sizes.md, color: Colors.textSecondary },
  priceValue: { fontSize: Fonts.sizes.md, color: Colors.text, fontWeight: Fonts.weights.medium },
  totalRow: {
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs,
  },
  totalLabel: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold, color: Colors.text },
  totalValue: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold, color: Colors.primary },

  confirmButton: {
    backgroundColor: Colors.primary, paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl, alignItems: 'center', marginTop: Spacing.sm,
  },
  confirmText: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold, color: Colors.textOnPrimary },
});
