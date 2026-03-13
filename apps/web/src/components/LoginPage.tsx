'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api';

type LoginPageProps = {
  onLoginSuccess: () => void;
};

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const handleSendOTP = async () => {
    if (!phone.trim()) { setError('Vui lòng nhập số điện thoại'); return; }
    setLoading(true);
    setError('');
    const res = await adminApi.sendOTP(phone);
    setLoading(false);
    if (res.success) {
      setStep('otp');
      // In dev mode, server log will show OTP
      setDevOtp('(Xem console server để lấy OTP)');
    } else {
      setError(res.error?.message || 'Không thể gửi OTP');
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) { setError('Vui lòng nhập mã OTP'); return; }
    setLoading(true);
    setError('');
    const res = await adminApi.login(phone, code);
    setLoading(false);
    if (res.success && res.data) {
      // Check if user is admin
      if (res.data.user?.role !== 'admin') {
        setError('Bạn không có quyền truy cập Admin Dashboard');
        adminApi.clearToken();
        return;
      }
      onLoginSuccess();
    } else {
      setError(res.error?.message || 'Mã OTP không đúng');
    }
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
          {step === 'phone' ? (
            <>
              <label className="login-label">Số điện thoại</label>
              <div className="login-input-group">
                <span className="login-input-prefix">🇻🇳 +84</span>
                <input
                  type="tel"
                  className="login-input"
                  placeholder="901 234 567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                  autoFocus
                />
              </div>
              <button
                className="login-btn"
                onClick={handleSendOTP}
                disabled={loading}
              >
                {loading ? '⏳ Đang gửi...' : '📲 Gửi mã OTP'}
              </button>
            </>
          ) : (
            <>
              <div className="login-otp-info">
                <p>Mã OTP đã gửi đến <strong>{phone}</strong></p>
                {devOtp && <p className="login-dev-note">{devOtp}</p>}
              </div>
              <label className="login-label">Mã xác thực OTP</label>
              <input
                type="text"
                className="login-input login-input-otp"
                placeholder="••••••"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                autoFocus
              />
              <button
                className="login-btn"
                onClick={handleVerify}
                disabled={loading}
              >
                {loading ? '⏳ Đang xác thực...' : '🔐 Đăng nhập'}
              </button>
              <button
                className="login-btn-secondary"
                onClick={() => { setStep('phone'); setCode(''); setError(''); }}
              >
                ← Quay lại
              </button>
            </>
          )}

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
