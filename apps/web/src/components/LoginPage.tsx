'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

type LoginPageProps = {
  onLoginSuccess: () => void;
};

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

function buildGoogleLoginUrl(clientID: string, redirectURI: string) {
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

function clearOAuthRedirectState() {
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const processGoogleRedirect = async () => {
      const params = extractOAuthParams(window.location.href);
      const googleError = params.get('error');
      const idToken = params.get('id_token');

      if (!googleError && !idToken) {
        return;
      }

      clearOAuthRedirectState();

      if (googleError) {
        if (!cancelled) {
          setError('Google đã huỷ hoặc từ chối phiên đăng nhập.');
        }
        return;
      }

      if (!idToken) {
        return;
      }

      setLoading(true);
      setError('');

      const res = await adminApi.googleLogin(idToken);
      if (cancelled) {
        return;
      }

      setLoading(false);
      if (res.success && res.data) {
        if (res.data.user?.role !== 'admin') {
          adminApi.clearToken();
          setError('Tài khoản Google này không có quyền truy cập Admin Dashboard.');
          return;
        }
        onLoginSuccess();
        return;
      }

      setError(res.error?.message || 'Đăng nhập Google thất bại.');
    };

    void processGoogleRedirect();

    return () => {
      cancelled = true;
    };
  }, [onLoginSuccess]);

  const handleGoogleLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Thiếu NEXT_PUBLIC_GOOGLE_CLIENT_ID. Hãy cấu hình Google OAuth trước khi đăng nhập.');
      return;
    }

    setError('');
    setLoading(true);
    window.location.href = buildGoogleLoginUrl(GOOGLE_CLIENT_ID, window.location.origin);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🏯</div>
          <h1 className="login-title">Huế Travel</h1>
          <p className="login-subtitle">Admin Dashboard</p>
        </div>

        {/* Form */}
        <div className="login-form">
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 16 }}>
            Đăng nhập bằng tài khoản Google đã được gán email admin trong hệ thống.
          </p>
          <button
            className="login-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <span style={{ fontSize: 18 }}>G</span>
            <span>{loading ? 'Đang chuyển đến Google...' : 'Đăng nhập với Google'}</span>
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
            Redirect URI cần được khai báo trong Google Cloud Console. Ví dụ local: <strong>http://localhost:3000</strong>
          </p>

          {error && <div className="login-error">{error}</div>}
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>© 2026 Huế Travel. Admin access only.</p>
        </div>
      </div>
    </div>
  );
}
