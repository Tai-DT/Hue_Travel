'use client';

import { useState } from 'react';
import { providerApi } from '@/lib/api';

type LoginPageProps = {
  onLoginSuccess: () => void;
};

export default function GuideLoginPage({ onLoginSuccess }: LoginPageProps) {
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handlePasswordLogin = async () => {
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setPasswordLoading(true);
    setError('');

    const res = await providerApi.loginWithPassword(nextEmail, password);
    setPasswordLoading(false);

    if (!res.success || !res.data) {
      setError(res.error?.message || 'Đăng nhập thất bại.');
      return;
    }

    if (res.data.user?.role !== 'guide') {
      providerApi.clearToken();
      setError('Tài khoản này không phải hướng dẫn viên.');
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ textAlign: 'center', fontSize: 14, color: '#666', lineHeight: 1.6 }}>
            Đăng nhập provider chỉ dùng email và mật khẩu nội bộ.
          </p>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email hướng dẫn viên"
            disabled={passwordLoading}
            style={{
              padding: 14,
              borderRadius: 12,
              border: '1px solid #d9d9d9',
              fontSize: 15,
              outline: 'none',
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mật khẩu"
            disabled={passwordLoading}
            style={{
              padding: 14,
              borderRadius: 12,
              border: '1px solid #d9d9d9',
              fontSize: 15,
              outline: 'none',
            }}
          />
          <button
            onClick={handlePasswordLogin}
            disabled={passwordLoading}
            style={{
              padding: 14,
              background: 'linear-gradient(135deg, #2E7D32, #1B5E20)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: passwordLoading ? 'not-allowed' : 'pointer',
              opacity: passwordLoading ? 0.6 : 1,
            }}
          >
            {passwordLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

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
