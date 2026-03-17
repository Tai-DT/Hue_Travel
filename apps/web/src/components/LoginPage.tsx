'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api';

type LoginPageProps = {
  onLoginSuccess: () => void;
};

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
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

    const res = await adminApi.loginWithPassword(nextEmail, password);
    setPasswordLoading(false);

    if (!res.success || !res.data) {
      setError(res.error?.message || 'Đăng nhập thất bại.');
      return;
    }

    if (res.data.user?.role !== 'admin') {
      adminApi.clearToken();
      setError('Tài khoản này không có quyền truy cập Admin Dashboard.');
      return;
    }

    onLoginSuccess();
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🏯</div>
          <h1 className="login-title">Huế Travel</h1>
          <p className="login-subtitle">Admin Dashboard</p>
        </div>

        <div className="login-form">
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 16 }}>
            Đăng nhập admin chỉ dùng email và mật khẩu nội bộ.
          </p>

          <div style={{ display: 'grid', gap: 12 }}>
            <input
              className="login-input"
              type="email"
              placeholder="Email admin"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={passwordLoading}
            />
            <input
              className="login-input"
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={passwordLoading}
            />
            <button className="login-btn" onClick={handlePasswordLogin} disabled={passwordLoading}>
              {passwordLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </div>

          {error && <div className="login-error">{error}</div>}
        </div>

        <div className="login-footer">
          <p>© 2026 Huế Travel. Admin access only.</p>
        </div>
      </div>
    </div>
  );
}
