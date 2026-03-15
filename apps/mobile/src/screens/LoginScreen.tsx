import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import api, { User } from '@/services/api';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

const googleConfigured = Boolean(
  GOOGLE_WEB_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID,
);

type Props = {
  onLoginSuccess: (token: string, user?: User, isNewUser?: boolean) => void;
};

function buildGoogleLoginURL(clientID: string, redirectURI: string) {
  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: redirectURI,
    response_type: 'id_token',
    scope: 'openid email profile',
    prompt: 'select_account',
    nonce: `${Date.now()}`,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function extractOAuthParams(url: string) {
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    return new URLSearchParams(url.slice(hashIndex + 1));
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0) {
    return new URLSearchParams(url.slice(queryIndex + 1));
  }

  return new URLSearchParams();
}

function clearWebOAuthState() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const completeGoogleLogin = useCallback(async (idToken: string) => {
    setGoogleLoading(true);
    setError('');

    const result = await api.googleLogin(idToken);
    if (result.success && result.data) {
      await api.setSession(result.data.token, result.data.refresh_token);
      onLoginSuccess(result.data.token, result.data.user, result.data.is_new_user);
      setGoogleLoading(false);
      return;
    }

    setGoogleLoading(false);
    setError(result.error?.message || 'Đăng nhập Google thất bại.');
  }, [onLoginSuccess]);

  const handleOAuthCallback = useCallback(async (url: string) => {
    if (!url || (!url.includes('auth/callback') && !url.includes('id_token='))) {
      return;
    }

    const params = extractOAuthParams(url);
    const googleError = params.get('error');
    const idToken = params.get('id_token');

    if (!googleError && !idToken) {
      return;
    }

    clearWebOAuthState();

    if (googleError) {
      setError('Google đã huỷ hoặc từ chối phiên đăng nhập.');
      return;
    }

    if (!idToken) {
      setError('Không nhận được Google ID token.');
      return;
    }

    await completeGoogleLogin(idToken);
  }, [completeGoogleLogin]);

  useEffect(() => {
    let active = true;

    const processInitialURL = async () => {
      const initialURL = await Linking.getInitialURL();
      if (!active) {
        return;
      }
      if (initialURL) {
        await handleOAuthCallback(initialURL);
        return;
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        await handleOAuthCallback(window.location.href);
      }
    };

    void processInitialURL();

    const subscription = Linking.addEventListener('url', (event) => {
      if (!active) {
        return;
      }
      void handleOAuthCallback(event.url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleOAuthCallback]);

  const handleGoogleLogin = useCallback(async () => {
    if (googleLoading) {
      return;
    }
    if (!googleConfigured) {
      Alert.alert(
        'Thiếu cấu hình Google',
        'Cần cấu hình EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID hoặc EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID trước khi đăng nhập.',
      );
      return;
    }

    const clientID = Platform.select({
      ios: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
      android: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
      default: GOOGLE_WEB_CLIENT_ID,
    }) || GOOGLE_WEB_CLIENT_ID;

    if (!clientID) {
      setError('Thiếu Google OAuth client ID cho nền tảng hiện tại.');
      return;
    }

    const redirectURI = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'huetravel://auth/callback';

    setGoogleLoading(true);
    setError('');

    try {
      await Linking.openURL(buildGoogleLoginURL(clientID, redirectURI));
      setGoogleLoading(false);
    } catch {
      setGoogleLoading(false);
      setError('Không thể mở trang đăng nhập Google.');
    }
  }, [googleLoading]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🌏</Text>
          <Text style={styles.heroTitle}>Huế Travel</Text>
          <Text style={styles.heroSubtitle}>
            Đăng nhập nhanh bằng Gmail để tiếp tục hành trình của bạn.
          </Text>
        </View>

        <View style={styles.buttonsSection}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
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
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.helperText}>
          Dùng đúng Gmail đã liên kết với tài khoản Huế Travel của bạn. Với Expo Web, redirect URI là{' '}
          <Text style={styles.helperTextStrong}>http://localhost:19006</Text>
          {' '}và với mobile native là{' '}
          <Text style={styles.helperTextStrong}>huetravel://auth/callback</Text>
          .
        </Text>

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
