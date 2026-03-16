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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

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
          setGoogleLoading(false);
          setError('Google đã huỷ hoặc từ chối phiên đăng nhập.');
        }
        return;
      }

      if (!idToken) {
        setGoogleLoading(false);
        return;
      }

      setGoogleLoading(true);
      setError('');

      const res = await adminApi.googleLogin(idToken);
      if (cancelled) {
        return;
      }

      setGoogleLoading(false);
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
    setGoogleLoading(true);
    window.location.href = buildGoogleLoginUrl(GOOGLE_CLIENT_ID, window.location.origin);
  };

  const sanitizePhone = (value: string) => value.replace(/[^\d+]/g, '').trim();

  const resetOTPFlow = () => {
    setOtpSent(false);
    setOtp('');
  };

  const handleSendOTP = async () => {
    const nextPhone = sanitizePhone(phone);
    if (!nextPhone) {
      setError('Vui lòng nhập số điện thoại.');
      return;
    }

    setOtpLoading(true);
    setError('');

    const res = await adminApi.sendOTP(nextPhone);
    setOtpLoading(false);

    if (!res.success) {
      setError(res.error?.message || 'Không thể gửi mã OTP.');
      return;
    }

    setPhone(nextPhone);
    setOtpSent(true);
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      setError('Vui lòng nhập mã OTP.');
      return;
    }

    setOtpLoading(true);
    setError('');

    const res = await adminApi.login(phone, otp.trim());
    setOtpLoading(false);

    if (!res.success || !res.data) {
      setError(res.error?.message || 'Xác thực OTP thất bại.');
      return;
    }

    if (res.data.user?.role !== 'admin') {
      adminApi.clearToken();
      setError('Số điện thoại này không có quyền truy cập Admin Dashboard.');
      return;
    }

    onLoginSuccess();
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
            Đăng nhập bằng số điện thoại + OTP hoặc dùng Google nếu email admin đã được gán trong hệ thống.
          </p>
          <div>
            <div className="login-input-group">
              <span className="login-input-prefix">SĐT</span>
              <input
                className="login-input"
                type="tel"
                placeholder="0901234567 hoặc +84901234567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={otpSent || otpLoading || googleLoading}
              />
            </div>
          </div>

          {otpSent ? (
            <>
              <p className="login-otp-info">
                Nhập mã OTP đã gửi đến <strong>{phone}</strong>
              </p>
              <input
                className="login-input login-input-otp"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                maxLength={6}
              />
              <button className="login-btn" onClick={handleVerifyOTP} disabled={otpLoading || googleLoading}>
                {otpLoading ? 'Đang xác thực...' : 'Đăng nhập với OTP'}
              </button>
              <button
                className="login-btn-secondary"
                onClick={() => {
                  resetOTPFlow();
                  setError('');
                }}
                disabled={otpLoading || googleLoading}
              >
                Dùng số khác
              </button>
            </>
          ) : (
            <button className="login-btn" onClick={handleSendOTP} disabled={otpLoading || googleLoading}>
              {otpLoading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
            </button>
          )}

          <p className="login-dev-note">
            Local dev: nếu ESMS chưa cấu hình, OTP sẽ được log ở terminal API.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hoặc</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button
            className="login-btn-secondary"
            onClick={handleGoogleLogin}
            disabled={googleLoading || otpLoading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14 }}
          >
            <span style={{ fontSize: 18 }}>G</span>
            <span>{googleLoading ? 'Đang chuyển đến Google...' : 'Đăng nhập với Google'}</span>
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
            Redirect URI Google local: <strong>http://localhost:3000</strong>
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
