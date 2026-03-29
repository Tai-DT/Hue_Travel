import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { Booking, PaymentMethod, TravelerCurrency } from '@/services/api';
import { formatCurrencyFromVND } from '@/utils/currency';

type PaymentStep = 'review' | 'method' | 'processing' | 'success';

type Props = {
  booking: Booking;
  onBack: () => void;
  currency: TravelerCurrency;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

export default function PaymentScreen({ booking, onBack, currency }: Props) {
  const [step, setStep] = useState<PaymentStep>('review');
  const [selectedMethod, setSelectedMethod] = useState('VNPAYQR');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [error, setError] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentURL, setPaymentURL] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const basePrice = useMemo(
    () => Math.max(booking.total_price - booking.service_fee, 0),
    [booking.service_fee, booking.total_price]
  );

  const bookingTitle = booking.experience?.title || 'Trải nghiệm Huế Travel';
  const guideName = booking.experience?.guide?.full_name || 'Hướng dẫn viên địa phương';

  useEffect(() => {
    const loadMethods = async () => {
      const result = await api.getPaymentMethods();
      if (result.success && result.data?.methods?.length) {
        setMethods(result.data.methods);
        const preferred = result.data.methods.find((method) => method.recommended) || result.data.methods[0];
        if (preferred) {
          setSelectedMethod(preferred.code);
        }
        setError('');
      } else {
        setMethods([]);
        setError(result.error?.message || 'Không thể tải phương thức thanh toán');
      }
      setLoadingMethods(false);
    };

    loadMethods();
  }, []);

  const handlePay = async () => {
    setStep('processing');
    setError('');

    const result = await api.createPayment(booking.id, selectedMethod);
    if (!result.success || !result.data) {
      setError(result.error?.message || 'Không thể tạo thanh toán');
      setStep('method');
      return;
    }

    setPaymentRef(result.data.txn_ref);
    setPaymentURL(result.data.payment_url);
    setPaymentConfirmed(result.data.status === 'success');

    if (result.data.payment_url && result.data.status !== 'success') {
      try {
        await Linking.openURL(result.data.payment_url);
      } catch {
        // Keep the fallback CTA visible on the success step.
      }
    }

    setStep('success');
  };

  if (step === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.processingTitle}>Đang tạo thanh toán...</Text>
          <Text style={styles.processingSub}>Huế Travel đang chuẩn bị cổng thanh toán cho booking của bạn.</Text>
        </View>
      </View>
    );
  }

  if (step === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.centerState}>
          <View style={[styles.successIcon, paymentConfirmed ? styles.successIconConfirmed : styles.successIconPending]}>
            <Text style={styles.successEmoji}>{paymentConfirmed ? '✅' : '⏳'}</Text>
          </View>
          <Text style={styles.successTitle}>
            {paymentConfirmed ? 'Thanh toán thành công' : 'Đã tạo link thanh toán'}
          </Text>
          <Text style={styles.successSub}>
            {paymentConfirmed
              ? 'Booking của bạn đã được xác nhận trong môi trường test.'
              : 'Nếu trang VNPay chưa mở, bạn có thể bấm nút bên dưới để mở lại.'}
          </Text>

          <View style={styles.summaryCard}>
            <SummaryRow label="Mã booking" value={booking.id.slice(0, 8)} />
            <SummaryRow label="Trải nghiệm" value={bookingTitle} />
            <SummaryRow label="Ngày" value={`${formatDate(booking.booking_date)} • ${booking.start_time}`} />
            <SummaryRow label="Số khách" value={`${booking.guest_count} khách`} />
            <SummaryRow label="Số tiền" value={formatCurrencyFromVND(booking.total_price, currency)} highlight />
            {paymentRef ? <SummaryRow label="Mã giao dịch" value={paymentRef} /> : null}
          </View>

          {!paymentConfirmed && paymentURL ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openURL(paymentURL)}>
              <Text style={styles.secondaryButtonText}>Mở lại VNPay</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
            <Text style={styles.primaryButtonText}>Về danh sách booking</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'review' ? 'Xác nhận đặt chỗ' : 'Chọn thanh toán'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stepsRow}>
        <StepDot active={step === 'review'} done={step === 'method'} label="Xác nhận" num={1} />
        <View style={[styles.stepLine, step === 'method' && styles.stepLineActive]} />
        <StepDot active={step === 'method'} label="Thanh toán" num={2} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {step === 'review' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>🏛️ Thông tin booking</Text>
              <Text style={styles.cardTitle}>{bookingTitle}</Text>
              <Text style={styles.cardSub}>Với guide {guideName}</Text>
              <View style={styles.metaRow}>
                <MetaItem icon="📅" label={formatDate(booking.booking_date)} />
                <MetaItem icon="⏰" label={booking.start_time} />
                <MetaItem icon="👥" label={`${booking.guest_count} khách`} />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>💰 Chi tiết giá</Text>
              <PriceRow label="Giá trải nghiệm" value={formatCurrencyFromVND(basePrice, currency)} />
              <PriceRow label="Phí dịch vụ" value={formatCurrencyFromVND(booking.service_fee, currency)} />
              <View style={styles.priceDivider} />
              <PriceRow label="Tổng cộng" value={formatCurrencyFromVND(booking.total_price, currency)} total />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>📋 Ghi chú</Text>
              <Text style={styles.policyText}>• Booking đang ở trạng thái chờ thanh toán.</Text>
              <Text style={styles.policyText}>• Sau khi thanh toán thành công, booking sẽ được xác nhận.</Text>
              <Text style={styles.policyText}>• Trong môi trường dev, nếu backend bật mock payment thì booking sẽ được xác nhận ngay.</Text>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>💳 Chọn phương thức thanh toán</Text>
            {loadingMethods ? (
              <View style={styles.loadingMethods}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.processingSub}>Đang tải phương thức thanh toán...</Text>
              </View>
            ) : methods.length === 0 ? (
              <View style={styles.loadingMethods}>
                <Text style={styles.processingTitle}>Chưa có cổng thanh toán khả dụng</Text>
                <Text style={styles.processingSub}>
                  Kiểm tra cấu hình payment ở backend hoặc quay lại sau.
                </Text>
              </View>
            ) : (
              methods.map((method) => (
                <TouchableOpacity
                  key={method.code}
                  style={[
                    styles.methodItem,
                    selectedMethod === method.code && styles.methodItemActive,
                  ]}
                  onPress={() => setSelectedMethod(method.code)}
                >
                  <Text style={styles.methodIcon}>{method.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.methodHeader}>
                      <Text style={styles.methodName}>{method.name}</Text>
                      {method.recommended ? (
                        <View style={styles.recommendBadge}>
                          <Text style={styles.recommendText}>Khuyên dùng</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.methodDesc}>{method.description}</Text>
                  </View>
                  <View style={[styles.radio, selectedMethod === method.code && styles.radioActive]} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        {step === 'review' ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('method')}>
            <Text style={styles.primaryButtonText}>Tiếp tục thanh toán</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, methods.length === 0 && styles.primaryButtonDisabled]}
            onPress={handlePay}
            disabled={methods.length === 0}
          >
            <Text style={styles.primaryButtonText}>Thanh toán {formatCurrencyFromVND(booking.total_price, currency)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function StepDot({
  active,
  done,
  label,
  num,
}: {
  active?: boolean;
  done?: boolean;
  label: string;
  num: number;
}) {
  return (
    <View style={styles.stepDotWrap}>
      <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
        <Text style={[styles.stepDotText, (active || done) && styles.stepDotTextActive]}>
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
      <Text style={styles.metaIcon}>{icon}</Text>
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function PriceRow({
  label,
  value,
  total,
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, total && styles.priceLabelTotal]}>{label}</Text>
      <Text style={[styles.priceValue, total && styles.priceValueTotal]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: 55,
    paddingBottom: Spacing.md,
  },
  backBtn: { padding: Spacing.sm },
  backIcon: { fontSize: 24, color: Colors.text },
  headerTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  stepDotWrap: { alignItems: 'center' },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  stepDotText: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, fontWeight: Fonts.weights.bold as any },
  stepDotTextActive: { color: Colors.textOnPrimary },
  stepLabel: { marginTop: 6, fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  stepLabelActive: { color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  stepLine: { width: 64, height: 2, backgroundColor: Colors.border, marginHorizontal: Spacing.sm, marginBottom: 18 },
  stepLineActive: { backgroundColor: Colors.primary },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardSectionTitle: {
    fontSize: Fonts.sizes.base,
    color: Colors.text,
    fontWeight: Fonts.weights.semibold as any,
    marginBottom: Spacing.sm,
  },
  cardTitle: { fontSize: Fonts.sizes.lg, color: Colors.text, fontWeight: Fonts.weights.bold as any },
  cardSub: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base, flexWrap: 'wrap' },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: 6,
  },
  metaIcon: { fontSize: Fonts.sizes.sm },
  metaText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  priceLabel: { fontSize: Fonts.sizes.md, color: Colors.textSecondary },
  priceValue: { fontSize: Fonts.sizes.md, color: Colors.text, fontWeight: Fonts.weights.medium as any },
  priceLabelTotal: { fontWeight: Fonts.weights.bold as any, color: Colors.text },
  priceValueTotal: { fontWeight: Fonts.weights.bold as any, color: Colors.primary },
  priceDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  policyText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginBottom: 6 },
  loadingMethods: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  methodItemActive: { borderColor: Colors.primary, backgroundColor: 'rgba(249,168,37,0.08)' },
  methodHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  methodIcon: { fontSize: 22 },
  methodName: { fontSize: Fonts.sizes.md, color: Colors.text, fontWeight: Fonts.weights.semibold as any },
  methodDesc: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 4 },
  recommendBadge: {
    backgroundColor: 'rgba(76,175,80,0.14)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  recommendText: { fontSize: 10, color: Colors.success, fontWeight: Fonts.weights.bold as any },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  radioActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  errorBanner: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.base,
    backgroundColor: 'rgba(244,67,54,0.12)',
    borderRadius: BorderRadius.lg,
  },
  errorText: { color: Colors.error, fontSize: Fonts.sizes.sm },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: 34,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: { fontSize: Fonts.sizes.base, color: Colors.textOnPrimary, fontWeight: Fonts.weights.bold as any },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.sm,
  },
  secondaryButtonText: { fontSize: Fonts.sizes.base, color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  processingTitle: {
    marginTop: Spacing.base,
    fontSize: Fonts.sizes.xl,
    color: Colors.text,
    fontWeight: Fonts.weights.bold as any,
  },
  processingSub: {
    marginTop: Spacing.sm,
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  successIconConfirmed: { backgroundColor: 'rgba(76,175,80,0.15)' },
  successIconPending: { backgroundColor: 'rgba(249,168,37,0.15)' },
  successEmoji: { fontSize: 42 },
  successTitle: { fontSize: Fonts.sizes.xl, color: Colors.text, fontWeight: Fonts.weights.bold as any },
  successSub: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  summaryLabel: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  summaryValue: { flex: 1.2, fontSize: Fonts.sizes.sm, color: Colors.text, textAlign: 'right' },
  summaryValueHighlight: { color: Colors.primary, fontWeight: Fonts.weights.bold as any },
});
