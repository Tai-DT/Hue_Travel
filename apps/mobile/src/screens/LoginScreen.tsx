import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import api, { User } from '@/services/api';

// Google OAuth Client IDs
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const activeGoogleClientId = Platform.select({
  web: GOOGLE_WEB_CLIENT_ID,
  android: GOOGLE_ANDROID_CLIENT_ID,
  ios: GOOGLE_IOS_CLIENT_ID,
  default: GOOGLE_WEB_CLIENT_ID,
}) || '';
const googleConfigured = Boolean(activeGoogleClientId);

// Lazy load expo-auth-session (may not be installed)
let Google: any = null;
let WebBrowser: any = null;
try {
  Google = require('expo-auth-session/providers/google');
  WebBrowser = require('expo-web-browser');
  WebBrowser.maybeCompleteAuthSession();
} catch {
  console.log('[Auth] expo-auth-session not available');
}

type Props = {
  onLoginSuccess: (token: string, user?: User, isNewUser?: boolean) => void;
};

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP Login state
  const [loginMode, setLoginMode] = useState<'main' | 'otp'>('main');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // ============================================
  // Google Sign-In using expo-auth-session/providers/google
  // This handles redirect URIs automatically per platform
  // ============================================
  const googleAuth = Google?.useIdTokenAuthRequest?.({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: ['openid', 'email', 'profile'],
    selectAccount: true,
  }) || [null, null, null];

  const [request, response, promptAsync] = googleAuth;

  // Handle Google auth response
  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const { authentication, params } = response;

      // Get the id_token or access_token depending on the flow
      const idToken = params?.id_token || authentication?.idToken;
      const accessToken = authentication?.accessToken;

      if (idToken) {
        completeGoogleLogin(idToken);
      } else {
        if (accessToken) {
          setError('Google chưa trả về id_token. Kiểm tra Google OAuth client ID cho nền tảng hiện tại.');
        } else {
          setError('Không nhận được token từ Google.');
        }
        setGoogleLoading(false);
      }
    } else if (response.type === 'error') {
      setError(response.error?.message || 'Đăng nhập Google thất bại.');
      setGoogleLoading(false);
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      setGoogleLoading(false);
    }
  }, [response]);

  // ============================================
  // Complete login with id_token (preferred)
  // ============================================
  const completeGoogleLogin = useCallback(async (idToken: string) => {
    setGoogleLoading(true);
    setError('');

    try {
      const result = await api.googleLogin(idToken);
      if (result.success && result.data) {
        await api.setSession(result.data.token, result.data.refresh_token);
        onLoginSuccess(result.data.token, result.data.user, result.data.is_new_user);
      } else {
        setError(result.error?.message || 'Đăng nhập Google thất bại.');
      }
    } catch (e: any) {
      setError(e?.message || 'Lỗi kết nối server.');
    }
    setGoogleLoading(false);
  }, [onLoginSuccess]);

  // ============================================
  // Handle Google Login button press
  // ============================================
  const handleGoogleLogin = useCallback(async () => {
    if (googleLoading) return;

    if (!googleConfigured) {
      Alert.alert('Thiếu cấu hình', `Cần Google client ID cho nền tảng ${Platform.OS} trong .env`);
      return;
    }

    if (!promptAsync) {
      setError('Google Sign-In chưa sẵn sàng. Vui lòng thử lại.');
      return;
    }

    setGoogleLoading(true);
    setError('');

    try {
      await promptAsync();
    } catch (e: any) {
      setGoogleLoading(false);
      setError('Không thể mở trang đăng nhập Google.');
    }
  }, [googleLoading, promptAsync]);

  // ============================================
  // OTP Login (Phone)
  // ============================================
  const handleSendOTP = useCallback(async () => {
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại.');
      return;
    }
    setOtpLoading(true);
    setError('');

    const formattedPhone = phone.startsWith('0') ? '+84' + phone.slice(1) : phone;
    const result = await api.sendOTP(formattedPhone);

    if (result.success) {
      setOtpSent(true);
      setPhone(formattedPhone);
    } else {
      setError(result.error?.message || 'Gửi OTP thất bại.');
    }
    setOtpLoading(false);
  }, [phone]);

  const handleVerifyOTP = useCallback(async () => {
    if (!otp.trim()) {
      setError('Vui lòng nhập mã OTP.');
      return;
    }
    setOtpLoading(true);
    setError('');

    const result = await api.verifyOTP(phone, otp.trim());
    if (result.success && result.data) {
      await api.setSession(result.data.token, result.data.refresh_token);
      onLoginSuccess(result.data.token, result.data.user, result.data.is_new_user);
    } else {
      setError(result.error?.message || 'Xác thực OTP thất bại.');
    }
    setOtpLoading(false);
  }, [phone, otp, onLoginSuccess]);

  // ============================================
  // UI
  // ============================================
  if (loginMode === 'otp') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <Text style={styles.heroEmoji}>📱</Text>
            <Text style={styles.heroTitle}>Đăng nhập OTP</Text>
            <Text style={styles.heroSubtitle}>
              {otpSent ? `Nhập mã OTP đã gửi đến ${phone}` : 'Nhập số điện thoại để nhận mã OTP'}
            </Text>
          </View>

          <View style={styles.buttonsSection}>
            {!otpSent ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Số điện thoại (0912345678)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSendOTP}
                  disabled={otpLoading}
                  activeOpacity={0.85}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Gửi mã OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Mã OTP (6 số)"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleVerifyOTP}
                  disabled={otpLoading}
                  activeOpacity={0.85}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Xác nhận</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setLoginMode('main');
                setOtpSent(false);
                setOtp('');
                setError('');
              }}
            >
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🌏</Text>
          <Text style={styles.heroTitle}>Huế Travel</Text>
          <Text style={styles.heroSubtitle}>
            Khám phá cố đô Huế cùng hướng dẫn viên AI thông minh
          </Text>
        </View>

        <View style={styles.buttonsSection}>
          {/* Google Login Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={googleLoading || !request}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#333333" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Đăng nhập bằng Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>hoặc</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Phone OTP Button */}
          <TouchableOpacity
            style={styles.phoneButton}
            onPress={() => { setLoginMode('otp'); setError(''); }}
            activeOpacity={0.85}
          >
            <Text style={styles.phoneIcon}>📱</Text>
            <Text style={styles.phoneButtonText}>Đăng nhập bằng SĐT</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!googleConfigured && (
          <Text style={styles.helperText}>
            💡 Cấu hình{' '}
            <Text style={styles.helperTextStrong}>
              {Platform.OS === 'android'
                ? 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
                : Platform.OS === 'ios'
                  ? 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
                  : 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'}
            </Text>
            {' '}trong .env để bật Google Sign-In
          </Text>
        )}

        <Text style={styles.termsText}>
          Bằng việc đăng nhập, bạn đồng ý với{' '}
          <Text style={styles.termsLink}>Điều khoản sử dụng</Text> và{' '}
          <Text style={styles.termsLink}>Chính sách bảo mật</Text> của chúng tôi.
        </Text>
      </ScrollView>
    </View>
  );
}

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
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border || '#E0E0E0',
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.sm,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
  },
  phoneIcon: {
    fontSize: 20,
  },
  phoneButtonText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.semibold,
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    fontSize: Fonts.sizes.lg,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border || '#E0E0E0',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
  },
  primaryButtonText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.semibold,
    color: '#FFFFFF',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.base,
  },
  errorText: {
    color: Colors.error,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  helperText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.base,
  },
  helperTextStrong: {
    fontWeight: Fonts.weights.semibold,
    color: Colors.text,
  },
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
});
