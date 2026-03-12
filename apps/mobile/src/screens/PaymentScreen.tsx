import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

// ============================================
// Payment Screen — VNPay Flow
// ============================================

type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  icon: string;
  description: string;
  recommended?: boolean;
};

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: '1', code: 'VNPAYQR', name: 'VNPay QR', icon: '📱', description: 'Quét mã QR để thanh toán', recommended: true },
  { id: '2', code: 'VNBANK', name: 'ATM / Internet Banking', icon: '🏦', description: 'Thẻ ATM nội địa' },
  { id: '3', code: 'INTCARD', name: 'Visa / Mastercard', icon: '💳', description: 'Thẻ quốc tế' },
  { id: '4', code: 'MOMO', name: 'Ví MoMo', icon: '🟣', description: 'Thanh toán qua MoMo' },
  { id: '5', code: 'ZALOPAY', name: 'ZaloPay', icon: '🔵', description: 'Thanh toán qua ZaloPay' },
];

type BookingInfo = {
  id: string;
  experienceTitle: string;
  date: string;
  time: string;
  guests: number;
  price: number;
  guideName: string;
};

const MOCK_BOOKING: BookingInfo = {
  id: 'HT-A1B2C3',
  experienceTitle: 'Khám phá Đại Nội Huế',
  date: '12/03/2026',
  time: '09:00',
  guests: 3,
  price: 750000,
  guideName: 'Nguyễn Văn Minh',
};

type PaymentStep = 'review' | 'method' | 'processing' | 'success';

export default function PaymentScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<PaymentStep>('review');
  const [selectedMethod, setSelectedMethod] = useState<string>('VNPAYQR');
  const booking = MOCK_BOOKING;

  const serviceFee = Math.round(booking.price * 0.05);
  const total = booking.price + serviceFee;

  const handlePay = () => {
    setStep('processing');
    // Simulating payment
    setTimeout(() => setStep('success'), 2500);
  };

  // ---- Success Screen ----
  if (step === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={{ fontSize: 48 }}>✅</Text>
          </View>
          <Text style={styles.successTitle}>Thanh toán thành công!</Text>
          <Text style={styles.successSub}>
            Booking {booking.id} đã được xác nhận
          </Text>

          <View style={styles.successCard}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Trải nghiệm</Text>
              <Text style={styles.successValue}>{booking.experienceTitle}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Ngày</Text>
              <Text style={styles.successValue}>{booking.date} • {booking.time}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Số tiền</Text>
              <Text style={[styles.successValue, { color: Colors.primary }]}>
                {total.toLocaleString()}₫
              </Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Mã giao dịch</Text>
              <Text style={styles.successValue}>VNP-{Date.now().toString().slice(-8)}</Text>
            </View>
          </View>

          <Text style={styles.successXP}>🏆 +25 XP đã được cộng vào tài khoản!</Text>

          <TouchableOpacity style={styles.successBtn} onPress={onBack}>
            <Text style={styles.successBtnText}>Quay về Trang chủ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---- Processing Screen ----
  if (step === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.processingTitle}>Đang xử lý thanh toán...</Text>
          <Text style={styles.processingSub}>Vui lòng không tắt ứng dụng</Text>
          <View style={styles.processingSteps}>
            <ProcessingStep icon="✅" text="Kiểm tra thông tin" done />
            <ProcessingStep icon="✅" text="Kết nối VNPay" done />
            <ProcessingStep icon="⏳" text="Xác nhận giao dịch" />
            <ProcessingStep icon="⏳" text="Cập nhật booking" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'review' ? 'Xác nhận đặt chỗ' : 'Chọn thanh toán'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Steps indicator */}
      <View style={styles.stepsRow}>
        <StepDot active={step === 'review'} done={step === 'method'} label="Xác nhận" num={1} />
        <View style={[styles.stepLine, step === 'method' && styles.stepLineActive]} />
        <StepDot active={step === 'method'} label="Thanh toán" num={2} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {step === 'review' ? (
          <>
            {/* Booking Summary */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>🏛️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{booking.experienceTitle}</Text>
                  <Text style={styles.cardSub}>Với guide {booking.guideName}</Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <MetaItem icon="📅" label={booking.date} />
                <MetaItem icon="⏰" label={booking.time} />
                <MetaItem icon="👥" label={`${booking.guests} khách`} />
              </View>
            </View>

            {/* Price Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>💰 Chi tiết giá</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  Giá tour × {booking.guests} khách
                </Text>
                <Text style={styles.priceValue}>{booking.price.toLocaleString()}₫</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Phí dịch vụ (5%)</Text>
                <Text style={styles.priceValue}>{serviceFee.toLocaleString()}₫</Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={styles.priceTotalLabel}>Tổng cộng</Text>
                <Text style={styles.priceTotalValue}>{total.toLocaleString()}₫</Text>
              </View>
            </View>

            {/* Policies */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>📋 Chính sách</Text>
              <Text style={styles.policyText}>• Huỷ miễn phí trước 24 giờ</Text>
              <Text style={styles.policyText}>• Đổi lịch 1 lần không mất phí</Text>
              <Text style={styles.policyText}>• Hoàn tiền trong 3 ngày làm việc</Text>
              <Text style={styles.policyText}>• Bảo hiểm du lịch đã bao gồm</Text>
            </View>
          </>
        ) : (
          <>
            {/* Payment Methods */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>💳 Chọn phương thức thanh toán</Text>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodItem,
                    selectedMethod === method.code && styles.methodItemActive,
                  ]}
                  onPress={() => setSelectedMethod(method.code)}
                >
                  <Text style={styles.methodIcon}>{method.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.methodName}>{method.name}</Text>
                      {method.recommended && (
                        <View style={styles.recommendBadge}>
                          <Text style={styles.recommendText}>Đề xuất</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.methodDesc}>{method.description}</Text>
                  </View>
                  <View style={[
                    styles.methodRadio,
                    selectedMethod === method.code && styles.methodRadioActive,
                  ]}>
                    {selectedMethod === method.code && <View style={styles.methodRadioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Order Summary */}
            <View style={styles.card}>
              <View style={styles.priceRow}>
                <Text style={styles.priceTotalLabel}>Tổng thanh toán</Text>
                <Text style={styles.priceTotalValue}>{total.toLocaleString()}₫</Text>
              </View>
            </View>
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>Tổng cộng</Text>
          <Text style={styles.bottomPrice}>{total.toLocaleString()}₫</Text>
        </View>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => step === 'review' ? setStep('method') : handlePay()}
        >
          <Text style={styles.ctaBtnText}>
            {step === 'review' ? 'Tiếp tục →' : '💳 Thanh toán ngay'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// Sub Components
// ============================================
function StepDot({ active, done, label, num }: { active: boolean; done?: boolean; label: string; num: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
        <Text style={[styles.stepNum, (active || done) && styles.stepNumActive]}>
          {done ? '✓' : num}
        </Text>
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
}

function MetaItem({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function ProcessingStep({ icon, text, done }: { icon: string; text: string; done?: boolean }) {
  return (
    <View style={styles.pStep}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[styles.pStepText, done && styles.pStepDone]}>{text}</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingTop: 55, paddingBottom: Spacing.md,
  },
  backBtn: { padding: Spacing.sm, width: 40 },
  backIcon: { fontSize: 24, color: Colors.text },
  headerTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text },

  // Steps
  stepsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 60, paddingVertical: Spacing.md,
  },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  stepDotActive: { borderColor: Colors.primary, backgroundColor: 'rgba(249,168,37,0.15)' },
  stepDotDone: { borderColor: Colors.success, backgroundColor: Colors.success },
  stepNum: { fontSize: 13, fontWeight: Fonts.weights.bold as any, color: Colors.textMuted },
  stepNumActive: { color: Colors.primary },
  stepLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  stepLabelActive: { color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  stepLine: {
    flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: Spacing.sm,
  },
  stepLineActive: { backgroundColor: Colors.success },

  // Card
  card: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.base,
    marginBottom: Spacing.md, padding: Spacing.base, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  cardEmoji: { fontSize: 32 },
  cardTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  cardSub: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 2 },
  cardSectionTitle: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginBottom: Spacing.md },
  cardMeta: { flexDirection: 'row', gap: Spacing.md },

  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },

  // Price
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  priceLabel: { fontSize: Fonts.sizes.md, color: Colors.textSecondary },
  priceValue: { fontSize: Fonts.sizes.md, color: Colors.text, fontWeight: Fonts.weights.medium as any },
  priceDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  priceTotalLabel: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  priceTotalValue: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.extrabold as any, color: Colors.primary },

  // Policy
  policyText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginBottom: 6, lineHeight: 20 },

  // Payment Methods
  methodItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  methodItemActive: { borderColor: Colors.primary, backgroundColor: 'rgba(249,168,37,0.08)' },
  methodIcon: { fontSize: 24 },
  methodName: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  methodDesc: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  recommendBadge: {
    backgroundColor: 'rgba(249,168,37,0.15)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  recommendText: { fontSize: 10, color: Colors.primary, fontWeight: Fonts.weights.bold as any },
  methodRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
  },
  methodRadioActive: { borderColor: Colors.primary },
  methodRadioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },

  // Bottom
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 34,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  bottomLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  bottomPrice: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.extrabold as any, color: Colors.primary },
  ctaBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
  ctaBtnText: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.bold as any, color: Colors.textOnPrimary },

  // Success
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  successIcon: { marginBottom: Spacing.lg },
  successTitle: { fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginBottom: 4 },
  successSub: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  successCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
  },
  successRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  successLabel: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  successValue: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  successDivider: { height: 1, backgroundColor: Colors.border },
  successXP: {
    fontSize: Fonts.sizes.md, color: Colors.secondary, fontWeight: Fonts.weights.semibold as any,
    marginBottom: Spacing.xl,
  },
  successBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: BorderRadius.lg, width: '100%', alignItems: 'center',
  },
  successBtnText: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.bold as any, color: Colors.textOnPrimary },

  // Processing
  processingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  processingTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginTop: Spacing.xl },
  processingSub: { fontSize: Fonts.sizes.md, color: Colors.textMuted, marginTop: 4 },
  processingSteps: { marginTop: Spacing.xxl, width: '100%', gap: Spacing.md },
  pStep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pStepText: { fontSize: Fonts.sizes.md, color: Colors.textMuted },
  pStepDone: { color: Colors.text },
});
