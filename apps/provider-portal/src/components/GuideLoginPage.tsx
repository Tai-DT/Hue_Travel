'use client';

import { useState } from 'react';
import { providerApi } from '@/lib/api';

type LoginPageProps = {
  onLoginSuccess: () => void;
};

export default function GuideLoginPage({ onLoginSuccess }: LoginPageProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (!phone.trim()) { setError('Vui lòng nhập số điện thoại'); return; }
    setLoading(true);
    setError('');
    const res = await providerApi.sendOTP(phone);
    setLoading(false);
    if (res.success) {
      setStep('otp');
    } else {
      setError(res.error?.message || 'Không thể gửi OTP');
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) { setError('Vui lòng nhập mã OTP'); return; }
    setLoading(true);
    setError('');
    const res = await providerApi.login(phone, code);
    setLoading(false);
    if (res.success && res.data) {
      if (res.data.user?.role !== 'guide') {
        setError('Tài khoản của bạn không phải hướng dẫn viên');
        providerApi.clearToken();
        return;
      }
      onLoginSuccess();
    } else {
      setError(res.error?.message || 'Mã OTP không đúng');
    }
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
          {step === 'phone' ? (
            <>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>Số điện thoại</label>
              <div style={{
                display: 'flex', alignItems: 'center', border: '1px solid #ddd',
                borderRadius: 12, overflow: 'hidden', background: '#f5f5f5',
              }}>
                <span style={{ padding: '12px 14px', color: '#888', borderRight: '1px solid #ddd' }}>🇻🇳 +84</span>
                <input
                  type="tel"
                  placeholder="901 234 567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                  autoFocus
                  style={{
                    flex: 1, padding: '14px 16px', border: 'none', background: 'transparent',
                    fontSize: 16, outline: 'none', color: '#1a1a1a',
                  }}
                />
              </div>
              <button
                onClick={handleSendOTP}
                disabled={loading}
                style={{
                  padding: 14, background: 'linear-gradient(135deg, #2E7D32, #1B5E20)',
                  color: '#fff', border: 'none', borderRadius: 12, fontSize: 15,
                  fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '⏳ Đang gửi...' : '📲 Gửi mã OTP'}
              </button>
            </>
          ) : (
            <>
              <p style={{ textAlign: 'center', fontSize: 14, color: '#666' }}>
                Mã OTP đã gửi đến <strong>{phone}</strong>
              </p>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>Mã xác thực</label>
              <input
                type="text"
                placeholder="••••••"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                autoFocus
                style={{
                  padding: '14px 16px', textAlign: 'center', fontSize: 28,
                  letterSpacing: 12, fontWeight: 700, border: '1px solid #ddd',
                  borderRadius: 12, outline: 'none', background: '#f5f5f5', color: '#1a1a1a',
                }}
              />
              <button
                onClick={handleVerify}
                disabled={loading}
                style={{
                  padding: 14, background: 'linear-gradient(135deg, #2E7D32, #1B5E20)',
                  color: '#fff', border: 'none', borderRadius: 12, fontSize: 15,
                  fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '⏳ Đang xác thực...' : '🔐 Đăng nhập'}
              </button>
              <button
                onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                style={{
                  padding: 10, background: 'transparent', color: '#666',
                  border: '1px solid #ddd', borderRadius: 12, fontSize: 13, cursor: 'pointer',
                }}
              >
                ← Quay lại
              </button>
            </>
          )}

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
