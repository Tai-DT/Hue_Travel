'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';

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
    title: '📱 ESMS Configuration',
    settings: [
      { key: 'esms_api_key', label: 'API Key', type: 'password', placeholder: 'your-esms-key' },
      { key: 'esms_secret_key', label: 'Secret Key', type: 'password', placeholder: 'your-secret' },
      { key: 'esms_brand_name', label: 'Brand Name', type: 'text', placeholder: 'HueTravel' },
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
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    adminApi.getHealth().then(res => {
      if (res.success) setHealth(res.data);
    });
  }, []);

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
          {saved ? '✅ Đã lưu!' : '💾 Lưu thay đổi'}
        </button>
      </div>

      {/* System Health */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card success">
          <div className="stat-icon">🟢</div>
          <div className="stat-value">{health?.status === 'ok' ? 'Online' : 'Checking...'}</div>
          <div className="stat-label">API Server</div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon">🐘</div>
          <div className="stat-value">{health?.database ? 'Connected' : '...'}</div>
          <div className="stat-label">PostgreSQL</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">⚡</div>
          <div className="stat-value">{health?.redis ? 'Connected' : '...'}</div>
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
                    type={setting.type === 'password' ? 'password' : 'text'}
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
