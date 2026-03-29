'use client';

import { useState, useEffect, useCallback } from 'react';
import { providerApi } from '@/lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    bio: '',
    languages: '',
    specialties: '',
    experience_years: '0',
    response_time_mins: '30',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState('');

  const loadProfile = useCallback(async () => {
    setError('');
    const res = await providerApi.getMe();
    if (res.success && res.data) {
      const user = (res.data as any).user || res.data;
      const guideRes = await providerApi.getGuideProfile(user.id);
      const guide = guideRes.success && guideRes.data ? guideRes.data.guide : null;

      setProfile(user);
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        bio: user.bio || '',
        languages: (user.languages || []).join(', '),
        specialties: (guide?.specialties || []).join(', '),
        experience_years: String(guide?.experience_years || 0),
        response_time_mins: String(guide?.response_time_mins || 30),
      });
      return;
    }

    setError(res.error?.message || 'Không thể tải hồ sơ');
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    const profileRes = await providerApi.updateProfile({
      full_name: form.full_name,
      email: form.email || undefined,
      bio: form.bio,
      languages: form.languages.split(',').map((l: string) => l.trim()).filter(Boolean),
    });

    const guideRes = await providerApi.updateGuideProfile({
      specialties: form.specialties.split(',').map((item: string) => item.trim()).filter(Boolean),
      experience_years: Number(form.experience_years) || 0,
      response_time_mins: Math.max(1, Number(form.response_time_mins) || 30),
    });

    setSaving(false);
    if (!profileRes.success) {
      setError(profileRes.error?.message || 'Không thể cập nhật hồ sơ');
      return;
    }
    if (!guideRes.success) {
      setError(guideRes.error?.message || 'Không thể cập nhật hồ sơ hướng dẫn viên');
      return;
    }

    setSaved(true);
    setEditing(false);
    loadProfile();
  };

  const handleCancelEdit = async () => {
    setEditing(false);
    setSaved(false);
    setError('');
    await loadProfile();
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
    if (profile?.has_password && !passwordForm.currentPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSaved('');

    const res = await providerApi.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
    setPasswordLoading(false);

    if (!res.success) {
      setPasswordError(res.error?.message || 'Không thể cập nhật mật khẩu.');
      return;
    }

    setProfile((prev: any) => ({ ...(prev || {}), has_password: true }));
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordSaved('Đã cập nhật mật khẩu hướng dẫn viên.');
  };

  const displayName = profile?.full_name || 'Guide';

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>👤 Hồ sơ của tôi</h2>

      {error ? (
        <div className="p-card" style={{ padding: 16, marginBottom: 16, color: '#F44336' }}>
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="p-card" style={{ padding: 16, marginBottom: 16, color: '#4CAF50' }}>
          Đã cập nhật thông tin guide và hồ sơ cá nhân.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* Left — Avatar Card */}
        <div className="p-card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{
            width: 100, height: 100, borderRadius: 50, margin: '0 auto 16px',
            background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, fontWeight: 700, color: '#000',
          }}>
            {displayName[0]}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{displayName}</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
            {profile?.phone || profile?.email || '—'}
          </div>
          <div style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: 12,
            background: 'rgba(76,175,80,0.15)', color: '#4CAF50', fontSize: 12, fontWeight: 600,
          }}>
            🧭 Hướng dẫn viên
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16, fontSize: 13 }}>
            <div><div style={{ fontWeight: 700, fontSize: 18 }}>{profile?.xp || 0}</div>XP</div>
            <div><div style={{ fontWeight: 700, fontSize: 18 }}>{profile?.level || '—'}</div>Level</div>
          </div>
        </div>

        {/* Right - Form */}
        <div className="p-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Thông tin cá nhân</h3>
            {!editing ? (
              <button className="p-btn p-btn-primary" onClick={() => setEditing(true)}>✏️ Chỉnh sửa</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="p-btn" onClick={handleCancelEdit}>Huỷ</button>
                <button className="p-btn p-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? '⏳...' : '💾 Lưu'}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Họ và tên
              </label>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                disabled={!editing}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: editing ? 'var(--bg-secondary)' : 'transparent',
                  border: editing ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Email
              </label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={!editing}
                placeholder="email@example.com"
                style={{
                  width: '100%', padding: '10px 14px',
                  background: editing ? 'var(--bg-secondary)' : 'transparent',
                  border: editing ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Ngôn ngữ (phân cách bằng dấu phẩy)
              </label>
              <input
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
                disabled={!editing}
                placeholder="Tiếng Việt, English, 日本語"
                style={{
                  width: '100%', padding: '10px 14px',
                  background: editing ? 'var(--bg-secondary)' : 'transparent',
                  border: editing ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Chuyên môn
              </label>
              <input
                value={form.specialties}
                onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                disabled={!editing}
                placeholder="Ẩm thực, di sản, trekking..."
                style={{
                  width: '100%', padding: '10px 14px',
                  background: editing ? 'var(--bg-secondary)' : 'transparent',
                  border: editing ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Số năm kinh nghiệm
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={form.experience_years}
                onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                disabled={!editing}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: editing ? 'var(--bg-secondary)' : 'transparent',
                  border: editing ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Thời gian phản hồi (phút)
              </label>
              <input
                type="number"
                min={1}
                value={form.response_time_mins}
                onChange={(e) => setForm({ ...form, response_time_mins: e.target.value })}
                disabled={!editing}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: editing ? 'var(--bg-secondary)' : 'transparent',
                  border: editing ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Giới thiệu bản thân
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              disabled={!editing}
              rows={4}
              placeholder="Mô tả kinh nghiệm, sở thích, phong cách tour của bạn..."
              style={{
                width: '100%', padding: '10px 14px',
                background: editing ? 'var(--bg-secondary)' : 'transparent',
                border: editing ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      </div>

      <div className="p-card" style={{ padding: 24, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🔐 Bảo mật đăng nhập</h3>
          <span style={{ fontSize: 13, color: profile?.has_password ? '#4CAF50' : '#888' }}>
            {profile?.has_password ? 'Đã có mật khẩu' : 'Chưa đặt mật khẩu'}
          </span>
        </div>

        <p style={{ color: '#666', lineHeight: 1.6, marginTop: 0 }}>
          {profile?.has_password
            ? 'Đổi mật khẩu guide để tiếp tục đăng nhập bằng email và mật khẩu nội bộ.'
            : 'Tài khoản guide này chưa có mật khẩu nội bộ. Đặt mật khẩu để bật local login.'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {profile?.has_password ? (
            <input
              type="password"
              placeholder="Mật khẩu hiện tại"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
              }}
            />
          ) : <div />}
          <input
            type="password"
            placeholder="Mật khẩu mới"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
            }}
          />
          <input
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 14, color: 'var(--text-primary)',
            }}
          />
        </div>

        {passwordError ? <div style={{ marginTop: 12, color: '#F44336', fontSize: 13 }}>{passwordError}</div> : null}
        {passwordSaved ? <div style={{ marginTop: 12, color: '#4CAF50', fontSize: 13 }}>{passwordSaved}</div> : null}

        <div style={{ marginTop: 16 }}>
          <button className="p-btn p-btn-primary" onClick={handlePasswordSave} disabled={passwordLoading}>
            {passwordLoading ? '⏳ Đang lưu...' : profile?.has_password ? 'Cập nhật mật khẩu' : 'Đặt mật khẩu guide'}
          </button>
        </div>
      </div>
    </div>
  );
}
