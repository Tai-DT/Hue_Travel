'use client';

import { useMemo, useState } from 'react';
import { providerApi, ProviderNotification } from '@/lib/api';

export type ProviderSettingsPageProps = {
  currentUser: any;
  notifications: ProviderNotification[];
  notifLoading: boolean;
  notifError: string;
  desktopAlerts: boolean;
  onRefreshNotifications: () => void | Promise<void>;
  onMarkNotificationRead: (id: string) => void | Promise<void>;
  onMarkAllNotificationsRead: () => void | Promise<void>;
  onDesktopAlertsChange: (enabled: boolean) => Promise<boolean>;
};

const formatRelativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
};

export default function ProviderSettingsPage({
  currentUser,
  notifications,
  notifLoading,
  notifError,
  desktopAlerts,
  onRefreshNotifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDesktopAlertsChange,
}: ProviderSettingsPageProps) {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState('');
  const [desktopAlertError, setDesktopAlertError] = useState('');

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  const browserNotificationStatus = useMemo(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'Trình duyệt hiện tại không hỗ trợ browser notifications.';
    }
    if (window.Notification.permission === 'granted') {
      return 'Trình duyệt đã cấp quyền thông báo.';
    }
    if (window.Notification.permission === 'denied') {
      return 'Quyền thông báo đã bị chặn trong trình duyệt.';
    }
    return 'Chưa cấp quyền thông báo.';
  }, []);

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

    const res = await providerApi.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
    setPasswordLoading(false);

    if (!res.success) {
      setPasswordError(res.error?.message || 'Không thể cập nhật mật khẩu.');
      return;
    }

    setPasswordSaved('Đã cập nhật mật khẩu hướng dẫn viên.');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleDesktopAlertsToggle = async () => {
    setDesktopAlertError('');
    const enabled = await onDesktopAlertsChange(!desktopAlerts);
    if (!enabled && !desktopAlerts) {
      setDesktopAlertError('Trình duyệt chưa cấp quyền thông báo.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>⚙️ Cài đặt portal</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Quản lý bảo mật đăng nhập và cách portal gửi thông báo trên trình duyệt này.
        </p>
      </div>

      <div className="p-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🔔 Notification Center</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="p-btn" onClick={() => void onRefreshNotifications()}>
              🔄 Làm mới
            </button>
            {unreadCount > 0 ? (
              <button className="p-btn p-btn-primary" onClick={() => void onMarkAllNotificationsRead()}>
                Đọc tất cả
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Thông báo chưa đọc</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{unreadCount}</div>
          </div>
          <button
            type="button"
            onClick={() => void handleDesktopAlertsToggle()}
            style={{
              textAlign: 'left',
              padding: 16,
              borderRadius: 12,
              background: desktopAlerts ? 'rgba(46,125,50,0.08)' : 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Browser alerts</span>
              <span style={{ fontSize: 13, color: desktopAlerts ? '#2E7D32' : 'var(--text-muted)' }}>
                {desktopAlerts ? 'Bật' : 'Tắt'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {browserNotificationStatus}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              Chỉ áp dụng trên trình duyệt hiện tại.
            </div>
          </button>
        </div>

        {desktopAlertError ? (
          <div style={{ marginBottom: 12, color: '#F44336', fontSize: 13 }}>{desktopAlertError}</div>
        ) : null}

        {notifLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải thông báo...</div>
        ) : notifError ? (
          <div style={{ padding: 16, color: '#F44336', fontSize: 13 }}>{notifError}</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
            Chưa có thông báo nào cho tài khoản guide này.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {notifications.slice(0, 12).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void onMarkNotificationRead(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: item.is_read ? 'var(--bg-card)' : 'rgba(249,168,37,0.08)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: item.is_read ? 600 : 700, color: 'var(--text)' }}>
                    {item.title}
                  </div>
                  {!item.is_read ? (
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />
                  ) : null}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {item.body}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  {formatRelativeTime(item.created_at)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🔐 Bảo mật đăng nhập</h3>
          <span style={{ fontSize: 13, color: currentUser?.has_password ? '#4CAF50' : '#888' }}>
            {currentUser?.has_password ? 'Đã có mật khẩu' : 'Chưa đặt mật khẩu'}
          </span>
        </div>

        <div style={{ marginBottom: 16, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div>Tài khoản: {currentUser?.email || currentUser?.phone || '—'}</div>
          <div>Role: {currentUser?.role || 'guide'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {currentUser?.has_password ? (
            <input
              type="password"
              placeholder="Mật khẩu hiện tại"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
                color: 'var(--text-primary)',
              }}
            />
          ) : <div />}
          <input
            type="password"
            placeholder="Mật khẩu mới"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 14,
              color: 'var(--text-primary)',
            }}
          />
          <input
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 14,
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {passwordError ? <div style={{ marginTop: 12, color: '#F44336', fontSize: 13 }}>{passwordError}</div> : null}
        {passwordSaved ? <div style={{ marginTop: 12, color: '#4CAF50', fontSize: 13 }}>{passwordSaved}</div> : null}

        <div style={{ marginTop: 16 }}>
          <button className="p-btn p-btn-primary" onClick={() => void handlePasswordSave()} disabled={passwordLoading}>
            {passwordLoading ? '⏳ Đang lưu...' : currentUser?.has_password ? 'Cập nhật mật khẩu' : 'Đặt mật khẩu guide'}
          </button>
        </div>
      </div>
    </div>
  );
}
