'use client';

import { useState, useEffect } from 'react';
import { adminApi, SystemHealth } from '@/lib/api';

const SETTINGS_STORAGE_KEY = 'admin_settings_draft';

const SETTINGS_SECTIONS = [
  {
    title: '🤖 AI Configuration',
    settings: [
      { key: 'gemini_api_key', label: 'Gemini API Key', type: 'password', placeholder: 'AIza...' },
      { key: 'ai_temperature', label: 'Temperature', type: 'number', placeholder: '0.7' },
      { key: 'ai_max_tokens', label: 'Max Tokens', type: 'number', placeholder: '2048' },
    ],
  },
  {
    title: '💳 VNPay Configuration',
    settings: [
      { key: 'vnpay_tmn_code', label: 'TMN Code', type: 'text', placeholder: 'DEMO123' },
      { key: 'vnpay_hash_secret', label: 'Hash Secret', type: 'password', placeholder: '...' },
      { key: 'vnpay_url', label: 'Payment URL', type: 'text', placeholder: 'https://sandbox.vnpayment.vn/...' },
    ],
  },
  {
    title: '🔥 Firebase Configuration',
    settings: [
      { key: 'fcm_server_key', label: 'FCM Server Key', type: 'password', placeholder: 'AAAA...' },
    ],
  },
  {
    title: '🗄️ Storage (MinIO)',
    settings: [
      { key: 'minio_endpoint', label: 'Endpoint', type: 'text', placeholder: 'localhost:9000' },
      { key: 'minio_bucket', label: 'Bucket Name', type: 'text', placeholder: 'hue-travel' },
      { key: 'minio_access_key', label: 'Access Key', type: 'password', placeholder: '...' },
      { key: 'minio_secret_key', label: 'Secret Key', type: 'password', placeholder: '...' },
    ],
  },
  {
    title: '🔍 Meilisearch',
    settings: [
      { key: 'meili_url', label: 'URL', type: 'text', placeholder: 'http://localhost:7700' },
      { key: 'meili_master_key', label: 'Master Key', type: 'password', placeholder: '...' },
    ],
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const draft = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (draft) {
        try {
          setValues(JSON.parse(draft));
        } catch {
          localStorage.removeItem(SETTINGS_STORAGE_KEY);
        }
      }
    }

    adminApi.getHealth().then(res => {
      if (res.success && res.data) setHealth(res.data);
    });

    adminApi.getMe().then((res) => {
      if (res.success && res.data) {
        setCurrentUser(res.data);
      }
    });
  }, []);

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(values));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePasswordSave = async () => {
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (currentUser?.has_password && !passwordForm.currentPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSaved('');

    const res = await adminApi.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
    setPasswordLoading(false);

    if (!res.success) {
      setPasswordError(res.error?.message || 'Không thể cập nhật mật khẩu.');
      return;
    }

    setCurrentUser((prev: any) => ({ ...(prev || {}), has_password: true }));
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordSaved('Đã cập nhật mật khẩu admin.');
  };

  const getDependencyStatus = (name: string) =>
    health?.dependencies.find((dependency) => dependency.name === name)?.status;

  const formatDependencyLabel = (status?: string) => {
    if (status === 'connected') return 'Connected';
    if (status === 'error') return 'Error';
    if (status === 'not_configured') return 'Missing';
    return '...';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>⚙️ Cài đặt hệ thống</h1>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          style={{ padding: '10px 24px', fontSize: 14 }}
        >
          {saved ? '✅ Đã lưu nháp!' : '💾 Lưu bản nháp'}
        </button>
      </div>

      <div className="data-card" style={{ padding: 16, marginBottom: 24, color: 'var(--text-secondary)' }}>
        Trang này hiện lưu cấu hình nháp trên trình duyệt. Backend chưa có endpoint để áp dụng các thay đổi này cho hệ thống.
      </div>

      <div className="data-card" style={{ marginBottom: 24 }}>
        <div className="data-card-header">
          <h2 className="data-card-title">🔐 Bảo mật tài khoản</h2>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {currentUser?.has_password
              ? 'Tài khoản admin này đã có mật khẩu nội bộ. Bạn có thể đổi mật khẩu tại đây để tiếp tục dùng email/password.'
              : 'Tài khoản admin này chưa có mật khẩu nội bộ. Đặt mật khẩu để lần sau có thể đăng nhập local.'}
          </p>

          {currentUser?.has_password ? (
            <input
              type="password"
              placeholder="Mật khẩu hiện tại"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 14, color: 'var(--text-primary)', outline: 'none',
              }}
            />
          ) : null}

          <input
            type="password"
            placeholder="Mật khẩu mới"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 14, color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 14, color: 'var(--text-primary)', outline: 'none',
            }}
          />

          {passwordError ? <div style={{ color: '#F44336', fontSize: 13 }}>{passwordError}</div> : null}
          {passwordSaved ? <div style={{ color: '#4CAF50', fontSize: 13 }}>{passwordSaved}</div> : null}

          <div>
            <button className="btn btn-primary" onClick={handlePasswordSave} disabled={passwordLoading}>
              {passwordLoading ? '⏳ Đang lưu...' : currentUser?.has_password ? 'Cập nhật mật khẩu admin' : 'Đặt mật khẩu admin'}
            </button>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card success">
          <div className="stat-icon">🟢</div>
          <div className="stat-value">
            {health?.status === 'healthy' ? 'Online' : health?.status === 'degraded' ? 'Degraded' : 'Checking...'}
          </div>
          <div className="stat-label">API Server</div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon">🐘</div>
          <div className="stat-value">{formatDependencyLabel(getDependencyStatus('postgresql'))}</div>
          <div className="stat-label">PostgreSQL</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">⚡</div>
          <div className="stat-value">{formatDependencyLabel(getDependencyStatus('redis'))}</div>
          <div className="stat-label">Redis</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-icon">📊</div>
          <div className="stat-value">63</div>
          <div className="stat-label">Endpoints</div>
        </div>
      </div>

      {/* Settings Sections */}
      {SETTINGS_SECTIONS.map((section) => (
        <div key={section.title} className="data-card" style={{ marginBottom: 20 }}>
          <div className="data-card-header">
            <h2 className="data-card-title">{section.title}</h2>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {section.settings.map((setting) => (
                <div key={setting.key}>
                  <label style={{
                    display: 'block', fontSize: 13, fontWeight: 600,
                    color: 'var(--text-secondary)', marginBottom: 6,
                  }}>
                    {setting.label}
                  </label>
                  <input
                    type={setting.type}
                    placeholder={setting.placeholder}
                    value={values[setting.key] || ''}
                    onChange={(e) => handleChange(setting.key, e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8, fontSize: 14,
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
