'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { adminApi } from '@/lib/api';
import LoginPage from '@/components/LoginPage';

const UsersPage = lazy(() => import('./users/page'));
const BookingsPage = lazy(() => import('./bookings/page'));
const ExperiencesPage = lazy(() => import('./experiences/page'));
const SettingsPage = lazy(() => import('./settings/page'));
const AnalyticsPage = lazy(() => import('./analytics/page'));
const ReviewsPage = lazy(() => import('./reviews/page'));
const ReportsPage = lazy(() => import('./reports/page'));
const SupportPage = lazy(() => import('./support/page'));

const PageFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--text-muted)' }}>
    ⏳ Đang tải trang...
  </div>
);

type NavItem = {
  icon: string;
  label: string;
  key: string;
  badge?: number;
};

type NavSection = {
  section: string;
  items: NavItem[];
};

const NAV_ITEMS: NavSection[] = [
  { section: 'Tổng quan', items: [
    { icon: '📊', label: 'Dashboard', key: 'dashboard' },
    { icon: '📈', label: 'Analytics', key: 'analytics' },
    { icon: '💰', label: 'Doanh thu', key: 'reports' },
  ]},
  { section: 'Quản lý', items: [
    { icon: '👥', label: 'Người dùng', key: 'users' },
    { icon: '🏛️', label: 'Trải nghiệm', key: 'experiences' },
    { icon: '📋', label: 'Bookings', key: 'bookings' },
    { icon: '⭐', label: 'Đánh giá', key: 'reviews' },
    { icon: '💬', label: 'Hỗ trợ', key: 'support' },
  ]},
  { section: 'Hệ thống', items: [
    { icon: '⚙️', label: 'Cài đặt', key: 'settings' },
  ]},
];

// ============================================
// Dashboard Content — Connected to Real API
// ============================================
function DashboardContent() {
  const [stats, setStats] = useState<any>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const overviewRes = await adminApi.getDashboardOverview();
    if (overviewRes.success && overviewRes.data) {
      setStats(overviewRes.data.stats);
      setRecentBookings(overviewRes.data.recent_bookings.slice(0, 5));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const formatVND = (n: number) => {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B₫';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M₫';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K₫';
    return n + '₫';
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return '—'; }
  };

  const STAT_CARDS = stats ? [
    { icon: '👥', label: 'Tổng người dùng', value: stats.total_users?.toLocaleString() || '0', type: 'primary' },
    { icon: '📋', label: 'Bookings tháng này', value: stats.bookings_this_month?.toLocaleString() || '0', type: 'success' },
    { icon: '💰', label: 'Doanh thu', value: formatVND(stats.total_revenue || 0), type: 'info' },
    { icon: '⭐', label: 'Đánh giá TB', value: stats.avg_rating?.toFixed(2) || '0', type: 'warning' },
  ] : [];

  if (loading) {
    return (
      <div>
        <div className="stats-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: '60%', height: 32, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '40%', height: 16 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Stats Grid */}
      <div className="stats-grid">
        {STAT_CARDS.map((stat, i) => (
          <div key={i} className={`stat-card ${stat.type}`}>
            <div className="stat-header">
              <div className="stat-icon">{stat.icon}</div>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 32 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{stats?.pending_bookings || 0}</div>
          <div className="stat-label">Bookings chờ xử lý</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--success)' }}>
          <div className="stat-icon">🆕</div>
          <div className="stat-value">{stats?.new_users_this_month || 0}</div>
          <div className="stat-label">Người dùng mới tháng này</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--info)' }}>
          <div className="stat-icon">💰</div>
          <div className="stat-value">{formatVND(stats?.revenue_this_month || 0)}</div>
          <div className="stat-label">Doanh thu tháng này</div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="data-card">
        <div className="data-card-header">
          <h2 className="data-card-title">📋 Bookings gần đây</h2>
          <div className="data-card-actions">
            <button className="btn" onClick={fetchDashboard}>🔄 Refresh</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Mã booking</th>
              <th>Khách hàng</th>
              <th>Trải nghiệm</th>
              <th>Ngày</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {recentBookings.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Chưa có booking nào
              </td></tr>
            ) : recentBookings.map((b) => (
              <tr key={b.id}>
                <td><span style={{ fontWeight: 600, color: 'var(--primary)' }}>{b.booking_code || b.id?.slice(0, 8)}</span></td>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar" style={{ background: '#4CAF50', color: 'white' }}>
                      {b.user_name?.[0] || '?'}
                    </div>
                    <div>
                      <div className="user-name">{b.user_name || '—'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.experience_title || '—'}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDate(b.booking_date)}</td>
                <td style={{ fontWeight: 600 }}>{b.total_price ? new Intl.NumberFormat('vi-VN').format(b.total_price) + '₫' : '—'}</td>
                <td>
                  <span className={`badge-status ${b.status || 'pending'}`}>
                    {b.status === 'confirmed' && '✅ Đã xác nhận'}
                    {b.status === 'pending' && '⏳ Chờ xử lý'}
                    {b.status === 'cancelled' && '❌ Đã huỷ'}
                    {b.status === 'completed' && '🎉 Hoàn thành'}
                    {!['confirmed','pending','cancelled','completed'].includes(b.status) && (b.status || 'pending')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginTop: 32,
      }}>
        <div className="chart-card" style={{ textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>AI Config</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cấu hình Gemini API</div>
        </div>
        <div className="chart-card" style={{ textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>VNPay Config</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Quản lý thanh toán</div>
        </div>
        <div className="chart-card" style={{ textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>API Health</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--success)' }}>● Online</span> — Backend API
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// Main Admin Layout with Auth Guard
// ============================================
export default function AdminDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Check if already logged in
    const checkAuth = async () => {
      if (adminApi.isAuthenticated()) {
        const res = await adminApi.getMe();
        if (res.success && res.data) {
          if (res.data.role === 'admin') {
            setCurrentUser(res.data);
            setIsLoggedIn(true);
          } else {
            adminApi.clearToken();
          }
        } else {
          adminApi.clearToken();
        }
      }
      setCheckingAuth(false);
    };
    checkAuth();

    // Listen for auth:logout event
    const handleLogout = () => {
      setIsLoggedIn(false);
      setCurrentUser(null);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const handleLogout = async () => {
    await adminApi.logout();
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  if (checkingAuth) {
    return (
      <div className="login-container">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏯</div>
          <div>Đang kiểm tra đăng nhập...</div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={async () => {
      const res = await adminApi.getMe();
      if (res.success && res.data) {
        setCurrentUser(res.data);
      }
      setIsLoggedIn(true);
    }} />;
  }

  const pageTitle = (() => {
    switch (activePage) {
      case 'dashboard': return '📊 Dashboard';
      case 'users': return '👥 Người dùng';
      case 'bookings': return '📋 Bookings';
      case 'experiences': return '🏛️ Trải nghiệm';
      case 'analytics': return '📈 Analytics';
      case 'reviews': return '⭐ Đánh giá';
      case 'reports': return '💰 Doanh thu';
      case 'support': return '💬 Hỗ trợ';
      case 'settings': return '⚙️ Cài đặt';
      default: return '📊 Dashboard';
    }
  })();

  return (
    <div className="admin-layout">
      {/* ---- Sidebar ---- */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">🏯</div>
            <span className="sidebar-logo-text">Huế Travel</span>
            <span className="sidebar-logo-badge">Admin</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((section) => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-label">{section.section}</div>
              {section.items.map((item) => (
                <div
                  key={item.key}
                  className={`nav-item ${activePage === item.key ? 'active' : ''}`}
                  onClick={() => setActivePage(item.key)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}

          {/* Logout */}
          <div className="nav-section" style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--error)' }}>
              <span className="nav-icon">🚪</span>
              <span>Đăng xuất</span>
            </div>
          </div>
        </nav>
      </aside>

      {/* ---- Main Content ---- */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>
          <div className="topbar-right">
            <div className="topbar-search">
              <span>🔍</span>
              <input type="text" placeholder="Tìm kiếm..." />
            </div>
            <div className="topbar-btn">🔔</div>
            <div className="topbar-avatar" title={currentUser?.full_name || 'Admin'}>
              {currentUser?.full_name?.[0] || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {activePage === 'users' ? (
            <Suspense fallback={<PageFallback />}><UsersPage /></Suspense>
          ) : activePage === 'bookings' ? (
            <Suspense fallback={<PageFallback />}><BookingsPage /></Suspense>
          ) : activePage === 'experiences' ? (
            <Suspense fallback={<PageFallback />}><ExperiencesPage /></Suspense>
          ) : activePage === 'settings' ? (
            <Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>
          ) : activePage === 'analytics' ? (
            <Suspense fallback={<PageFallback />}><AnalyticsPage /></Suspense>
          ) : activePage === 'reviews' ? (
            <Suspense fallback={<PageFallback />}><ReviewsPage /></Suspense>
          ) : activePage === 'reports' ? (
            <Suspense fallback={<PageFallback />}><ReportsPage /></Suspense>
          ) : activePage === 'support' ? (
            <Suspense fallback={<PageFallback />}><SupportPage /></Suspense>
          ) : (
            <DashboardContent />
          )}
        </div>
      </main>
    </div>
  );
}
