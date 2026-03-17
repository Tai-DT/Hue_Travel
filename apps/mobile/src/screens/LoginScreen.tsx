import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import api, { User } from '@/services/api';

type Props = {
  onLoginSuccess: (token: string, user?: User, isNewUser?: boolean) => void;
};

type CredentialMode = 'login' | 'register';

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [credentialMode, setCredentialMode] = useState<CredentialMode>('login');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');

  const [registerFullName, setRegisterFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const finishAuth = useCallback(async (payload: {
    token: string;
    refresh_token: string;
    user: User;
    is_new_user: boolean;
  }) => {
    await api.setSession(payload.token, payload.refresh_token);
    onLoginSuccess(payload.token, payload.user, payload.is_new_user);
  }, [onLoginSuccess]);

  const handlePasswordLogin = useCallback(async () => {
    const email = loginEmail.trim().toLowerCase();
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setPasswordLoading(true);
    setError('');

    const result = await api.loginWithPassword(email, password);
    if (result.success && result.data) {
      await finishAuth(result.data);
    } else {
      setError(result.error?.message || 'Đăng nhập thất bại.');
    }

    setPasswordLoading(false);
  }, [finishAuth, loginEmail, password]);

  const handleRegister = useCallback(async () => {
    const fullName = registerFullName.trim();
    const email = registerEmail.trim().toLowerCase();

    if (!fullName) {
      setError('Vui lòng nhập họ tên.');
      return;
    }
    if (!email) {
      setError('Vui lòng nhập email.');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setPasswordLoading(true);
    setError('');

    const result = await api.register({
      full_name: fullName,
      email,
      password,
    });

    if (result.success && result.data) {
      await finishAuth(result.data);
    } else {
      setError(result.error?.message || 'Đăng ký thất bại.');
    }

    setPasswordLoading(false);
  }, [confirmPassword, finishAuth, password, registerEmail, registerFullName]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🔐</Text>
          <Text style={styles.heroTitle}>Huế Travel</Text>
          <Text style={styles.heroSubtitle}>
            Đăng nhập và đăng ký chỉ dùng email với mật khẩu nội bộ, tương thích tốt với Expo.
          </Text>
        </View>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, credentialMode === 'login' && styles.segmentButtonActive]}
            onPress={() => {
              setCredentialMode('login');
              setError('');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentButtonText, credentialMode === 'login' && styles.segmentButtonTextActive]}>
              Đăng nhập
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, credentialMode === 'register' && styles.segmentButtonActive]}
            onPress={() => {
              setCredentialMode('register');
              setError('');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentButtonText, credentialMode === 'register' && styles.segmentButtonTextActive]}>
              Đăng ký
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          {credentialMode === 'register' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Họ và tên"
                value={registerFullName}
                onChangeText={setRegisterFullName}
                placeholderTextColor={Colors.textMuted}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={registerEmail}
                onChangeText={setRegisterEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.textMuted}
              />
            </>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={loginEmail}
              onChangeText={setLoginEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={Colors.textMuted}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor={Colors.textMuted}
          />

          {credentialMode === 'register' ? (
            <TextInput
              style={styles.input}
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholderTextColor={Colors.textMuted}
            />
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={credentialMode === 'login' ? handlePasswordLogin : handleRegister}
            disabled={passwordLoading}
            activeOpacity={0.85}
          >
            {passwordLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {credentialMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helperText}>
            {credentialMode === 'login'
              ? 'Dùng email của tài khoản và mật khẩu nội bộ để vào app.'
              : 'Tài khoản mới chỉ cần họ tên, email và mật khẩu.'}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <Text style={styles.termsText}>
          Bằng việc tiếp tục, bạn đồng ý với <Text style={styles.termsLink}>Điều khoản sử dụng</Text> và{' '}
          <Text style={styles.termsLink}>Chính sách bảo mật</Text>.
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
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: Fonts.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F4F6FA',
    borderRadius: BorderRadius.xl,
    padding: 6,
    marginBottom: Spacing.lg,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.small,
  },
  segmentButtonText: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.medium,
    color: Colors.textSecondary,
  },
  segmentButtonTextActive: {
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold,
  },
  formSection: {
    gap: Spacing.base,
    marginBottom: Spacing.lg,
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
  helperText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    color: Colors.error,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    lineHeight: 22,
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
