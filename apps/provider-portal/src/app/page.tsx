'use client';

import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { providerApi, ProviderNotification } from '@/lib/api';
import GuideLoginPage from '@/components/GuideLoginPage';

const GuideBookingsPage = lazy(() => import('./bookings/page'));
const ProfilePage = lazy(() => import('./profile/page'));
const MyToursPage = lazy(() => import('./my-tours/page'));
const RevenuePage = lazy(() => import('./revenue/page'));
const CalendarPage = lazy(() => import('./calendar/page'));
const SettingsPage = lazy(() => import('@/components/ProviderSettingsPage'));

const Loader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>⏳ Đang tải...</div>
);

type NavSection = {
  section: string;
  items: { icon: string; label: string; key: string; badge?: number }[];
};

type ProviderPortalPrefs = {
  desktopAlerts: boolean;
};

const PROVIDER_PORTAL_PREFS_KEY = 'provider_portal_settings';

const NAV: NavSection[] = [
  { section: 'Tổng quan', items: [
    { icon: '📊', label: 'Dashboard', key: 'dashboard' },
  ]},
  { section: 'Quản lý', items: [
    { icon: '🏛️', label: 'Tours của tôi', key: 'my-tours' },
    { icon: '📋', label: 'Bookings', key: 'bookings' },
    { icon: '📅', label: 'Lịch', key: 'calendar' },
    { icon: '💰', label: 'Doanh thu', key: 'revenue' },
  ]},
  { section: 'Tài khoản', items: [
    { icon: '👤', label: 'Hồ sơ', key: 'profile' },
    { icon: '⚙️', label: 'Cài đặt', key: 'settings' },
  ]},
];

// ============================================
// Dashboard Content — Connected to API
// ============================================
function DashboardContent() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await providerApi.getMyBookings();
    if (res.success && res.data) setBookings(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';

  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const totalRevenue = bookings.filter(b => ['confirmed', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + (b.total_price || 0), 0);
  const totalGuests = bookings.reduce((sum, b) => sum + (b.guest_count || 0), 0);

  const STATS = [
    { icon: '📋', label: 'Tổng Bookings', value: bookings.length.toString(), bg: 'rgba(46,125,50,0.1)' },
    { icon: '⏳', label: 'Chờ xác nhận', value: pendingCount.toString(), bg: 'rgba(255,152,0,0.1)' },
    { icon: '💰', label: 'Doanh thu', value: formatVND(totalRevenue), bg: 'rgba(66,165,245,0.1)' },
    { icon: '👥', label: 'Tổng khách', value: totalGuests.toString(), bg: 'rgba(156,39,176,0.1)' },
  ];

  if (loading) {
    return (
      <div className="p-stats">
        {[1,2,3,4].map(i => (
          <div key={i} className="p-stat" style={{ background: '#f8f8f8', borderRadius: 16, padding: 24 }}>
            <div style={{ width: 40, height: 40, background: '#eee', borderRadius: 10, marginBottom: 12 }} />
            <div style={{ width: '50%', height: 24, background: '#eee', borderRadius: 6, marginBottom: 8 }} />
            <div style={{ width: '70%', height: 14, background: '#eee', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Stats */}
      <div className="p-stats">
        {STATS.map((s, i) => (
          <div key={i} className="p-stat">
            <div className="p-stat-top">
              <div className="p-stat-icon" style={{ background: s.bg }}>{s.icon}</div>
            </div>
            <div className="p-stat-value">{s.value}</div>
            <div className="p-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending Bookings */}
      {pendingCount > 0 && (
        <div className="p-card" style={{ marginBottom: 20 }}>
          <div className="p-card-header">
            <span className="p-card-title">⏳ Chờ xác nhận ({pendingCount})</span>
            <button className="p-btn" onClick={fetchData}>🔄 Refresh</button>
          </div>
          {bookings.filter(b => b.status === 'pending').map((b) => (
            <div key={b.id} className="p-schedule">
              <div style={{ flex: 1 }}>
                <div className="p-schedule-title">{b.experience_title || 'Tour'}</div>
                <div className="p-schedule-meta">
                  👤 {b.user_name || 'Khách'} • 👥 {b.guest_count || 1} khách •
                  📅 {b.booking_date ? new Date(b.booking_date).toLocaleDateString('vi-VN') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="p-btn p-btn-primary" onClick={async () => {
                  await providerApi.confirmBooking(b.id);
                  fetchData();
                }}>✅ Xác nhận</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Bookings */}
      <div className="p-card">
        <div className="p-card-header">
          <span className="p-card-title">📋 Bookings gần đây</span>
        </div>
        <table className="p-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Khách</th>
              <th>Tour</th>
              <th>Ngày</th>
              <th>SL</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                Chưa có booking nào
              </td></tr>
            ) : bookings.slice(0, 10).map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{b.booking_code || b.id?.slice(0, 8)}</td>
                <td>{b.user_name || '—'}</td>
                <td>{b.experience_title || '—'}</td>
                <td style={{ color: '#666', fontSize: 13 }}>
                  {b.booking_date ? new Date(b.booking_date).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td>{b.guest_count || 1}</td>
                <td style={{ fontWeight: 600 }}>{b.total_price ? formatVND(b.total_price) : '—'}</td>
                <td>
                  <span className={`p-badge ${b.status === 'confirmed' ? 'green' : b.status === 'completed' ? 'blue' : 'yellow'}`}>
                    {b.status === 'confirmed' ? '✅ Xác nhận' : b.status === 'completed' ? '🎉 Hoàn thành' : '⏳ Chờ'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================
// Main Layout with Auth Guard
// ============================================
export default function ProviderDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<ProviderNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [portalPrefs, setPortalPrefs] = useState<ProviderPortalPrefs>({ desktopAlerts: false });

  const notifRef = useRef<HTMLDivElement | null>(null);
  const notificationBootstrapRef = useRef(false);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const recentNotifications = notifications.slice(0, 6);

  const savePortalPrefs = useCallback((next: ProviderPortalPrefs) => {
    setPortalPrefs(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PROVIDER_PORTAL_PREFS_KEY, JSON.stringify(next));
    }
  }, []);

  const updateDesktopAlerts = useCallback(async (enabled: boolean) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (enabled) {
      let permission = window.Notification.permission;
      if (permission === 'default') {
        permission = await window.Notification.requestPermission();
      }
      if (permission !== 'granted') {
        return false;
      }
    }

    savePortalPrefs({ desktopAlerts: enabled });
    return true;
  }, [savePortalPrefs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(PROVIDER_PORTAL_PREFS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<ProviderPortalPrefs>;
      setPortalPrefs({
        desktopAlerts: Boolean(parsed.desktopAlerts),
      });
    } catch {
      window.localStorage.removeItem(PROVIDER_PORTAL_PREFS_KEY);
    }
  }, []);

  const formatRelativeTime = useCallback((value: string) => {
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
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    const res = await providerApi.getNotifications();
    if (res.success && res.data) {
      const nextNotifications = res.data.notifications || [];

      if (!notificationBootstrapRef.current) {
        notificationBootstrapRef.current = true;
        notifiedIdsRef.current = new Set(nextNotifications.map((item) => item.id));
      } else if (
        portalPrefs.desktopAlerts &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        nextNotifications
          .filter((item) => !item.is_read && !notifiedIdsRef.current.has(item.id))
          .forEach((item) => {
            notifiedIdsRef.current.add(item.id);
            new window.Notification(item.title, { body: item.body });
          });
      }

      setNotifications(nextNotifications);
      setNotifError('');
    } else {
      setNotifError(res.error?.message || 'Không thể tải thông báo');
    }
    setNotifLoading(false);
  }, [portalPrefs.desktopAlerts]);

  const markNotificationRead = useCallback(async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.is_read) return;

    const res = await providerApi.markNotificationRead(id);
    if (!res.success) return;

    setNotifications((prev) => prev.map((item) => (
      item.id === id ? { ...item, is_read: true } : item
    )));
  }, [notifications]);

  const markAllNotificationsRead = useCallback(async () => {
    if (unreadCount <= 0) return;

    const res = await providerApi.markNotificationRead('all');
    if (!res.success) return;

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
  }, [unreadCount]);

  useEffect(() => {
    const checkAuth = async () => {
      if (providerApi.isAuthenticated()) {
        const res = await providerApi.getMe();
        if (res.success && res.data) {
          if (res.data.role === 'guide') {
            setCurrentUser(res.data);
            setIsLoggedIn(true);
          } else {
            providerApi.clearToken();
          }
        } else {
          providerApi.clearToken();
        }
      }
      setCheckingAuth(false);
    };
    checkAuth();

    const handleLogout = () => {
      setIsLoggedIn(false);
      setCurrentUser(null);
      setNotifications([]);
      setNotifOpen(false);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [isLoggedIn, loadNotifications]);

  useEffect(() => {
    if (!notifOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const handleLogout = async () => {
    await providerApi.logout();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setNotifications([]);
    setNotifOpen(false);
    setActivePage('dashboard');
  };

  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧭</div>
          <div>Đang kiểm tra đăng nhập...</div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <GuideLoginPage onLoginSuccess={async () => {
      const res = await providerApi.getMe();
      if (res.success && res.data) setCurrentUser(res.data);
      setIsLoggedIn(true);
    }} />;
  }

  return (
    <div className="portal-layout">
      {/* Sidebar */}
      <aside className="p-sidebar">
        <div className="p-sidebar-header">
          <div className="p-sidebar-brand">
            <div className="p-sidebar-logo">🧭</div>
            <div>
              <div className="p-sidebar-name">Huế Travel</div>
              <div className="p-sidebar-role">Provider Portal</div>
            </div>
          </div>
        </div>

        <nav className="p-nav">
          {NAV.map((sec) => (
            <div key={sec.section}>
              <div className="p-nav-section">{sec.section}</div>
              {sec.items.map((item) => (
                <div
                  key={item.key}
                  className={`p-nav-item ${activePage === item.key ? 'active' : ''}`}
                  onClick={() => setActivePage(item.key)}
                >
                  <span className="p-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && <span className="p-nav-badge">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}

          {/* Logout */}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #e0e0e0' }}>
            <div className="p-nav-item" onClick={handleLogout} style={{ color: '#E53935' }}>
              <span className="p-nav-icon">🚪</span>
              <span>Đăng xuất</span>
            </div>
          </div>
        </nav>

        <div className="p-profile-card">
          <div className="p-profile-avatar">{currentUser?.full_name?.[0] || 'G'}</div>
          <div>
            <div className="p-profile-name">{currentUser?.full_name || 'Guide'}</div>
            <div className="p-profile-status">● Online</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="p-main">
        <header className="p-topbar">
          <h1 className="p-topbar-title">👋 Xin chào, {currentUser?.full_name?.split(' ').pop() || 'Guide'}!</h1>
          <div className="p-topbar-actions">
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="p-topbar-btn"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Thông báo"
              >
                🔔
                {unreadCount > 0 ? <span className="dot" /> : null}
              </button>

              {notifOpen ? (
                <div
                  className="p-card"
                  style={{
                    position: 'absolute',
                    top: 48,
                    right: 0,
                    width: 360,
                    maxHeight: 420,
                    overflowY: 'auto',
                    padding: 0,
                    zIndex: 40,
                  }}
                >
                  <div className="p-card-header">
                    <span className="p-card-title">🔔 Thông báo</span>
                    {unreadCount > 0 ? (
                      <button className="p-btn" onClick={() => void markAllNotificationsRead()}>
                        Đọc tất cả
                      </button>
                    ) : null}
                  </div>

                  {notifLoading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải...</div>
                  ) : notifError ? (
                    <div style={{ padding: 16, color: 'var(--error)', fontSize: 13 }}>{notifError}</div>
                  ) : recentNotifications.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không có thông báo nào
                    </div>
                  ) : (
                    recentNotifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void markNotificationRead(item.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: item.is_read ? 'transparent' : 'rgba(46,125,50,0.08)',
                          border: 'none',
                          borderTop: '1px solid var(--border-light)',
                          padding: '14px 16px',
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
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {item.body}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                          {formatRelativeTime(item.created_at)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="p-page">
          {activePage === 'bookings' ? (
            <Suspense fallback={<Loader />}><GuideBookingsPage /></Suspense>
          ) : activePage === 'profile' ? (
            <Suspense fallback={<Loader />}><ProfilePage /></Suspense>
          ) : activePage === 'my-tours' ? (
            <Suspense fallback={<Loader />}><MyToursPage /></Suspense>
          ) : activePage === 'revenue' ? (
            <Suspense fallback={<Loader />}><RevenuePage /></Suspense>
          ) : activePage === 'calendar' ? (
            <Suspense fallback={<Loader />}><CalendarPage /></Suspense>
          ) : activePage === 'settings' ? (
            <Suspense fallback={<Loader />}>
              <SettingsPage
                currentUser={currentUser}
                notifications={notifications}
                notifLoading={notifLoading}
                notifError={notifError}
                desktopAlerts={portalPrefs.desktopAlerts}
                onRefreshNotifications={loadNotifications}
                onMarkNotificationRead={markNotificationRead}
                onMarkAllNotificationsRead={markAllNotificationsRead}
                onDesktopAlertsChange={updateDesktopAlerts}
              />
            </Suspense>
          ) : (
            <DashboardContent />
          )}
        </div>
      </main>
    </div>
  );
}

function PerfMetric({ label, value, color, pct }: { label: string; value: string; color: string; pct: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: '#666' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}
