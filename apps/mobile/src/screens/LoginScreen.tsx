import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { User } from '@/services/api';

type Props = {
  onLoginSuccess: (token: string, user?: User, isNewUser?: boolean) => void;
};

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  );

  const handleSendOTP = async () => {
    if (phone.length < 9) {
      setError('Vui lòng nhập số điện thoại hợp lệ');
      return;
    }

    setLoading(true);
    setError('');

    const formattedPhone = phone.startsWith('0') ? phone : `0${phone}`;
    const result = await api.sendOTP(formattedPhone);

    setLoading(false);
    if (result.success) {
      setStep('otp');
    } else {
      setError(result.error?.message || 'Không thể gửi OTP');
    }
  };

  const handleOTPChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (index === 5 && value) {
      const code = newOtp.join('');
      if (code.length === 6) {
        handleVerifyOTP(code);
      }
    }
  };

  const handleOTPKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (code: string) => {
    setLoading(true);
    setError('');

    const formattedPhone = phone.startsWith('0') ? phone : `0${phone}`;
    const result = await api.verifyOTP(formattedPhone, code);

    setLoading(false);
    if (result.success && result.data) {
      api.setToken(result.data.token);
      onLoginSuccess(result.data.token, result.data.user, result.data.is_new_user);
    } else {
      setError(result.error?.message || 'Mã OTP không đúng');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  };

  const handleResendOTP = async () => {
    if (loading) return;
    setOtp(['', '', '', '', '', '']);
    await handleSendOTP();
    otpRefs.current[0]?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        {step === 'otp' && (
          <TouchableOpacity onPress={() => setStep('phone')} style={styles.backButton}>
            <Text style={styles.backText}>← Quay lại</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.logo}>🌏</Text>
        <Text style={styles.title}>
          {step === 'phone' ? 'Đăng nhập' : 'Xác thực OTP'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'phone'
            ? 'Nhập số điện thoại để tiếp tục'
            : `Nhập mã 6 số đã gửi đến ${phone}`}
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {step === 'phone' ? (
          <>
            {/* Phone Input */}
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.flag}>🇻🇳</Text>
                <Text style={styles.codeText}>+84</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Số điện thoại"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setError('');
                }}
                maxLength={11}
                autoFocus
              />
            </View>

            {/* Error */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSendOTP}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitText}>Gửi mã OTP</Text>
              )}
            </TouchableOpacity>

            <View style={styles.socialNotice}>
              <Text style={styles.socialNoticeTitle}>Đăng nhập xã hội</Text>
              <Text style={styles.socialNoticeText}>
                {googleConfigured
                  ? 'Backend đã sẵn sàng cho Google token. Hãy thêm OAuth client IDs của app để bật nút đăng nhập.'
                  : 'Google/Apple login sẽ được bật khi môi trường production được cấu hình OAuth client IDs.'}
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* OTP Input */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref: TextInput | null) => { otpRefs.current[index] = ref; }}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOTPChange(value, index)}
                  onKeyPress={({ nativeEvent }) =>
                    handleOTPKeyPress(nativeEvent.key, index)
                  }
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={index === 0}
                  selectTextOnFocus
                />
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Resend */}
            <TouchableOpacity style={styles.resendButton} onPress={handleResendOTP} disabled={loading}>
              <Text style={styles.resendText}>
                Không nhận được mã? <Text style={styles.resendLink}>Gửi lại</Text>
              </Text>
            </TouchableOpacity>

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={() => handleVerifyOTP(otp.join(''))}
              disabled={loading || otp.join('').length < 6}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitText}>Xác nhận</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    paddingTop: 100,
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 0,
  },
  backText: {
    color: Colors.primary,
    fontSize: Fonts.sizes.base,
  },
  logo: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.lg,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    gap: Spacing.xs,
  },
  flag: {
    fontSize: 20,
  },
  codeText: {
    color: Colors.text,
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.medium,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    color: Colors.text,
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.medium,
  },
  errorText: {
    color: Colors.error,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold,
    color: Colors.textOnPrimary,
  },
  socialNotice: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.xs,
  },
  socialNoticeTitle: {
    color: Colors.text,
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold,
  },
  socialNoticeText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    lineHeight: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold,
    color: Colors.text,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceLight,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  resendText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
  },
  resendLink: {
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold,
  },
});
