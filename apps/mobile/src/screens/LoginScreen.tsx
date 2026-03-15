import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
  ScrollView,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import api, { User } from '@/services/api';

// ============================================
// Google OAuth Config
// ============================================
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

const googleConfigured = Boolean(
  GOOGLE_WEB_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID,
);

type Props = {
  onLoginSuccess: (token: string, user?: User, isNewUser?: boolean) => void;
};

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [mode, setMode] = useState<'main' | 'phone' | 'otp'>('main');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const otpRefs = useRef<(TextInput | null)[]>([]);

  // ── Google Sign-In ──────────────────────────
  const handleGoogleLogin = useCallback(async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError('');

    try {
      // Use a demo flow for development:
      // In production, you'd use expo-auth-session or react-native-google-signin
      // For now, simulate a Google login by calling the API with a test token
      if (!googleConfigured) {
        // Demo mode — show info
        Alert.alert(
          '🔐 Google Sign-In',
          'Để bật đăng nhập Google, cần cấu hình:\n\n' +
          '1. Tạo Google Cloud project\n' +
          '2. Bật Google Identity API\n' +
          '3. Tạo OAuth 2.0 Client IDs\n' +
          '4. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID trong .env\n\n' +
          'Sau khi cấu hình, nút này sẽ tự kích hoạt.',
          [
            { text: 'Đã hiểu', style: 'cancel' },
            {
              text: 'Demo Login',
              onPress: async () => {
                // Demo: simulate Google login with a test account
                await demoGoogleLogin();
              },
            },
          ],
        );
        setGoogleLoading(false);
        return;
      }

      // Production: Open Google OAuth
      const clientId = Platform.select({
        ios: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
        android: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
        default: GOOGLE_WEB_CLIENT_ID,
      }) || GOOGLE_WEB_CLIENT_ID;

      const redirectUri = Platform.select({
        web: `${window.location.origin}/auth/callback`,
        default: 'huetravel://auth/callback',
      });

      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri || '')}` +
        '&response_type=id_token' +
        '&scope=openid%20email%20profile' +
        `&nonce=${Date.now()}`;

      const supported = await Linking.canOpenURL(authUrl);
      if (supported) {
        await Linking.openURL(authUrl);
      } else {
        setError('Không thể mở Google Sign-In');
      }
    } catch (err) {
      setError('Lỗi đăng nhập Google');
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLoading]);

  const demoGoogleLogin = async () => {
    setGoogleLoading(true);
    // In demo mode, call API with a test token
    // The backend's GoogleLogin will verify with Google — this will fail in demo
    // Instead, use OTP login with demo credentials
    const result = await api.sendOTP('0900000000');
    if (result.success) {
      // Auto-verify with dev OTP code
      const verifyResult = await api.verifyOTP('0900000000', '123456');
      if (verifyResult.success && verifyResult.data) {
        await api.setSession(verifyResult.data.token, verifyResult.data.refresh_token);
        onLoginSuccess(verifyResult.data.token, verifyResult.data.user, verifyResult.data.is_new_user);
      } else {
        Alert.alert('Demo', 'Demo login thất bại. Vui lòng đảm bảo API server đang chạy.');
      }
    } else {
      Alert.alert('Demo', 'Không thể kết nối API server.');
    }
    setGoogleLoading(false);
  };

  // ── Handle deep link callback for Google OAuth ──
  React.useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (url.includes('auth/callback') && url.includes('id_token=')) {
        const idToken = url.split('id_token=')[1]?.split('&')[0];
        if (idToken) {
          setGoogleLoading(true);
          setError('');
          const result = await api.googleLogin(idToken);
          if (result.success && result.data) {
            const data = result.data as {
              token: string;
              refresh_token: string;
              user: User;
              is_new_user: boolean;
            };
            await api.setSession(data.token, data.refresh_token);
            onLoginSuccess(data.token, data.user, data.is_new_user);
          } else {
            setError('Đăng nhập Google thất bại');
          }
          setGoogleLoading(false);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [onLoginSuccess]);

  // ── OTP Handlers ────────────────────────────
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
      setMode('otp');
    } else {
      setError(result.error?.message || 'Không thể gửi OTP');
    }
  };

  const handleOTPChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (index === 5 && value) {
      const code = newOtp.join('');
      if (code.length === 6) handleVerifyOTP(code);
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
      await api.setSession(result.data.token, result.data.refresh_token);
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

  // ── Main Screen (Login options) ─────────────
  if (mode === 'main') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.heroSection}>
            <Text style={styles.heroEmoji}>🌏</Text>
            <Text style={styles.heroTitle}>Huế Travel</Text>
            <Text style={styles.heroSubtitle}>
              Khám phá cố đô, trải nghiệm văn hóa
            </Text>
          </View>

          {/* Login Buttons */}
          <View style={styles.buttonsSection}>
            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color="#333" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>
                    Đăng nhập bằng Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Phone Login Button */}
            <TouchableOpacity
              style={styles.phoneButton}
              onPress={() => { setMode('phone'); setError(''); }}
              activeOpacity={0.85}
            >
              <Text style={styles.phoneIcon}>📱</Text>
              <Text style={styles.phoneButtonText}>
                Đăng nhập bằng số điện thoại
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Terms */}
          <Text style={styles.termsText}>
            Bằng việc đăng nhập, bạn đồng ý với{' '}
            <Text style={styles.termsLink}>Điều khoản sử dụng</Text> và{' '}
            <Text style={styles.termsLink}>Chính sách bảo mật</Text> của chúng tôi.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ── Phone / OTP Screen ──────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { setMode(mode === 'otp' ? 'phone' : 'main'); setError(''); }}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>🌏</Text>
        <Text style={styles.title}>
          {mode === 'phone' ? 'Đăng nhập' : 'Xác thực OTP'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'phone'
            ? 'Nhập số điện thoại để tiếp tục'
            : `Nhập mã 6 số đã gửi đến ${phone}`}
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {mode === 'phone' ? (
          <>
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
                onChangeText={(text) => { setPhone(text); setError(''); }}
                maxLength={11}
                autoFocus
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
          </>
        ) : (
          <>
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref: TextInput | null) => { otpRefs.current[index] = ref; }}
                  style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                  value={digit}
                  onChangeText={(value) => handleOTPChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleOTPKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={index === 0}
                  selectTextOnFocus
                />
              ))}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.resendButton} onPress={handleResendOTP} disabled={loading}>
              <Text style={styles.resendText}>
                Không nhận được mã? <Text style={styles.resendLink}>Gửi lại</Text>
              </Text>
            </TouchableOpacity>
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

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // ── Hero ──
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl + 16,
  },
  heroEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    fontSize: Fonts.sizes.hero,
    fontWeight: Fonts.weights.extrabold,
    color: Colors.primary,
    letterSpacing: -1,
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: Fonts.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },

  // ── Buttons ──
  buttonsSection: {
    gap: Spacing.base,
    marginBottom: Spacing.lg,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    ...Shadows.small,
  },
  googleIcon: {
    fontSize: 22,
    fontWeight: Fonts.weights.bold,
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.semibold,
    color: '#333333',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.md,
    marginHorizontal: Spacing.base,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  phoneIcon: {
    fontSize: 20,
  },
  phoneButtonText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.semibold,
    color: Colors.text,
  },

  // ── Terms ──
  termsText: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: Fonts.weights.medium,
  },

  // ── Phone / OTP screen ──
  header: {
    paddingTop: 100,
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: Spacing.xl,
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
    paddingHorizontal: Spacing.xl,
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
