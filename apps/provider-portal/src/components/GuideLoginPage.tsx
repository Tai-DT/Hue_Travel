'use client';

import { useEffect, useState } from 'react';
import { providerApi } from '@/lib/api';

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

export default function GuideLoginPage({ onLoginSuccess }: LoginPageProps) {
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
      const res = await providerApi.googleLogin(idToken);
      if (cancelled) {
        return;
      }

      setGoogleLoading(false);
      if (res.success && res.data) {
        if (res.data.user?.role !== 'guide') {
          providerApi.clearToken();
          setError('Tài khoản Google này không phải hướng dẫn viên.');
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

    const res = await providerApi.sendOTP(nextPhone);
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

    const res = await providerApi.login(phone, otp.trim());
    setOtpLoading(false);

    if (!res.success || !res.data) {
      setError(res.error?.message || 'Xác thực OTP thất bại.');
      return;
    }

    if (res.data.user?.role !== 'guide') {
      providerApi.clearToken();
      setError('Số điện thoại này không phải tài khoản hướng dẫn viên.');
      return;
    }

    onLoginSuccess();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fafafa',
      backgroundImage: 'radial-gradient(ellipse at 30% 40%, rgba(46,125,50,0.06) 0%, transparent 50%)',
    }}>
      <div style={{
        width: 420,
        background: '#fff',
        borderRadius: 20,
        padding: '48px 40px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        border: '1px solid #e0e0e0',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px', borderRadius: 16,
            background: 'linear-gradient(135deg, #2E7D32, #1B5E20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, boxShadow: '0 8px 24px rgba(46,125,50,0.25)',
          }}>🧭</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a' }}>Huế Travel</h1>
          <p style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>Provider Portal — Dành cho Hướng dẫn viên</p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ textAlign: 'center', fontSize: 14, color: '#666', lineHeight: 1.6 }}>
            Đăng nhập bằng số điện thoại + OTP hoặc dùng Google nếu email đã được gán cho tài khoản hướng dẫn viên.
          </p>

          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0907778888 hoặc +84907778888"
            disabled={otpSent || otpLoading || googleLoading}
            style={{
              padding: 14,
              borderRadius: 12,
              border: '1px solid #d9d9d9',
              fontSize: 15,
              outline: 'none',
            }}
          />

          {otpSent ? (
            <>
              <p style={{ textAlign: 'center', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                Nhập mã OTP đã gửi đến <strong>{phone}</strong>
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                placeholder="123456"
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #d9d9d9',
                  fontSize: 24,
                  letterSpacing: 8,
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleVerifyOTP}
                disabled={otpLoading || googleLoading}
                style={{
                  padding: 14,
                  background: 'linear-gradient(135deg, #2E7D32, #1B5E20)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: otpLoading || googleLoading ? 'not-allowed' : 'pointer',
                  opacity: otpLoading || googleLoading ? 0.6 : 1,
                }}
              >
                {otpLoading ? 'Đang xác thực...' : 'Đăng nhập với OTP'}
              </button>
              <button
                onClick={() => {
                  resetOTPFlow();
                  setError('');
                }}
                disabled={otpLoading || googleLoading}
                style={{
                  padding: 12,
                  background: '#fff',
                  color: '#555',
                  border: '1px solid #d9d9d9',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: otpLoading || googleLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Dùng số khác
              </button>
            </>
          ) : (
            <button
              onClick={handleSendOTP}
              disabled={otpLoading || googleLoading}
              style={{
                padding: 14,
                background: 'linear-gradient(135deg, #2E7D32, #1B5E20)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                cursor: otpLoading || googleLoading ? 'not-allowed' : 'pointer',
                opacity: otpLoading || googleLoading ? 0.6 : 1,
              }}
            >
              {otpLoading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
            </button>
          )}

          <p style={{ textAlign: 'center', fontSize: 12, color: '#999', lineHeight: 1.6 }}>
            Local dev: nếu ESMS chưa cấu hình, OTP sẽ được log ở terminal API.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
            <span style={{ fontSize: 12, color: '#aaa' }}>hoặc</span>
            <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading || otpLoading}
            style={{
              padding: 14,
              background: '#fff',
              color: '#1a1a1a',
              border: '1px solid #d9d9d9',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: googleLoading || otpLoading ? 'not-allowed' : 'pointer',
              opacity: googleLoading || otpLoading ? 0.6 : 1,
            }}
          >
            {googleLoading ? 'Đang chuyển đến Google...' : 'Đăng nhập với Google'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#999', lineHeight: 1.6 }}>
            Redirect URI Google local: <strong>http://localhost:3001</strong>
          </p>

          {error && (
            <div style={{
              background: '#FFEBEE', border: '1px solid #EF9A9A', color: '#C62828',
              padding: '10px 14px', borderRadius: 8, fontSize: 13, textAlign: 'center',
            }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: '#aaa' }}>
          © 2026 Huế Travel — Provider Portal
        </div>
      </div>
    </div>
  );
}
