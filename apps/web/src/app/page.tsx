'use client';

import { useState } from 'react';

type NavItem = {
  icon: string;
  label: string;
  key: string;
  active?: boolean;
  badge?: number;
};

type NavSection = {
  section: string;
  items: NavItem[];
};

// ============================================
// Mock Data
// ============================================
const STATS = [
  { icon: '👥', label: 'Tổng người dùng', value: '12,847', change: '+12.5%', up: true, type: 'primary' },
  { icon: '📋', label: 'Bookings tháng này', value: '1,234', change: '+8.3%', up: true, type: 'success' },
  { icon: '💰', label: 'Doanh thu (VNĐ)', value: '456.8M', change: '+22.1%', up: true, type: 'info' },
  { icon: '⭐', label: 'Đánh giá trung bình', value: '4.72', change: '-0.1', up: false, type: 'warning' },
];

const RECENT_BOOKINGS = [
  { id: 'HT-A1B2C3', user: 'Nguyễn Văn An', email: 'an@gmail.com', experience: 'Khám phá Đại Nội Huế', date: '12/03/2026', amount: '750,000₫', status: 'confirmed', avatar: '#4CAF50' },
  { id: 'HT-D4E5F6', user: 'Trần Thị Bình', email: 'binh@gmail.com', experience: 'Tour Ẩm thực đường phố', date: '12/03/2026', amount: '450,000₫', status: 'pending', avatar: '#42A5F5' },
  { id: 'HT-G7H8I9', user: 'Lê Hoàng Cường', email: 'cuong@gmail.com', experience: 'Chèo thuyền sông Hương', date: '11/03/2026', amount: '350,000₫', status: 'confirmed', avatar: '#E040FB' },
  { id: 'HT-J1K2L3', user: 'Phạm Minh Đức', email: 'duc@gmail.com', experience: 'Lăng Tự Đức & Khải Định', date: '11/03/2026', amount: '500,000₫', status: 'cancelled', avatar: '#FF7043' },
  { id: 'HT-M4N5O6', user: 'Võ Thị Em', email: 'em@gmail.com', experience: 'Workshop làm nón Huế', date: '10/03/2026', amount: '200,000₫', status: 'confirmed', avatar: '#FFB300' },
];

const TOP_EXPERIENCES = [
  { name: 'Khám phá Đại Nội Huế', bookings: 342, revenue: '256.5M₫', rating: 4.9, color: '#F9A825' },
  { name: 'Tour Ẩm thực đường phố', bookings: 287, revenue: '129.2M₫', rating: 4.8, color: '#4CAF50' },
  { name: 'Chèo thuyền sông Hương', bookings: 198, revenue: '69.3M₫', rating: 4.7, color: '#42A5F5' },
  { name: 'Lăng Tự Đức & Khải Định', bookings: 156, revenue: '78.0M₫', rating: 4.6, color: '#E040FB' },
  { name: 'Workshop làm nón Huế', bookings: 134, revenue: '26.8M₫', rating: 4.8, color: '#FF7043' },
];

const BAR_DATA = [
  { label: 'T1', value: 65 }, { label: 'T2', value: 72 },
  { label: 'T3', value: 85 }, { label: 'T4', value: 58 },
  { label: 'T5', value: 92 }, { label: 'T6', value: 78 },
  { label: 'T7', value: 95 }, { label: 'T8', value: 100 },
  { label: 'T9', value: 88 }, { label: 'T10', value: 76 },
  { label: 'T11', value: 82 }, { label: 'T12', value: 90 },
];

const NAV_ITEMS: NavSection[] = [
  { section: 'Tổng quan', items: [
    { icon: '📊', label: 'Dashboard', key: 'dashboard', active: true },
    { icon: '📈', label: 'Analytics', key: 'analytics' },
  ]},
  { section: 'Quản lý', items: [
    { icon: '👥', label: 'Người dùng', key: 'users', badge: 12 },
    { icon: '🏛️', label: 'Trải nghiệm', key: 'experiences' },
    { icon: '📋', label: 'Bookings', key: 'bookings', badge: 5 },
    { icon: '💳', label: 'Thanh toán', key: 'payments' },
    { icon: '🧭', label: 'Hướng dẫn viên', key: 'guides' },
  ]},
  { section: 'Nội dung', items: [
    { icon: '⭐', label: 'Đánh giá', key: 'reviews' },
    { icon: '💬', label: 'Tin nhắn', key: 'messages', badge: 3 },
    { icon: '🔔', label: 'Thông báo', key: 'notifications' },
    { icon: '🤖', label: 'AI Config', key: 'ai-config' },
  ]},
  { section: 'Hệ thống', items: [
    { icon: '⚙️', label: 'Cài đặt', key: 'settings' },
    { icon: '📊', label: 'API Logs', key: 'api-logs' },
  ]},
];

// ============================================
// Dashboard Page
// ============================================
export default function AdminDashboard() {
  const [activePage, setActivePage] = useState('dashboard');

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
        </nav>
      </aside>

      {/* ---- Main Content ---- */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">📊 Dashboard</h1>
          </div>
          <div className="topbar-right">
            <div className="topbar-search">
              <span>🔍</span>
              <input type="text" placeholder="Tìm kiếm..." />
            </div>
            <div className="topbar-btn">
              🔔
              <span className="badge">3</span>
            </div>
            <div className="topbar-btn">⚙️</div>
            <div className="topbar-avatar">TA</div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {/* Stats Grid */}
          <div className="stats-grid">
            {STATS.map((stat, i) => (
              <div key={i} className={`stat-card ${stat.type}`}>
                <div className="stat-header">
                  <div className="stat-icon">{stat.icon}</div>
                  <span className={`stat-change ${stat.up ? 'up' : 'down'}`}>
                    {stat.up ? '↑' : '↓'} {stat.change}
                  </span>
                </div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="chart-container">
            {/* Revenue Chart */}
            <div className="chart-card">
              <div className="chart-title">📈 Doanh thu theo tháng (2026)</div>
              <div className="mini-bars">
                {BAR_DATA.map((bar, i) => (
                  <div
                    key={i}
                    className="mini-bar"
                    style={{
                      height: `${bar.value}%`,
                      background: i === 7
                        ? 'linear-gradient(180deg, #F9A825, #FF6F00)'
                        : 'linear-gradient(180deg, #333, #222)',
                    }}
                  >
                    <span className="mini-bar-label">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Experience Breakdown */}
            <div className="chart-card">
              <div className="chart-title">🏛️ Top trải nghiệm</div>
              <div className="donut-list">
                {TOP_EXPERIENCES.map((exp, i) => (
                  <div key={i} className="donut-item">
                    <div className="donut-dot" style={{ background: exp.color }} />
                    <span className="donut-label">{exp.name}</span>
                    <span className="donut-value">{exp.bookings}</span>
                    <span className="donut-pct">⭐{exp.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Bookings Table */}
          <div className="data-card">
            <div className="data-card-header">
              <h2 className="data-card-title">📋 Bookings gần đây</h2>
              <div className="data-card-actions">
                <button className="btn">🔽 Export</button>
                <button className="btn btn-primary">+ Tạo mới</button>
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
                {RECENT_BOOKINGS.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {booking.id}
                      </span>
                    </td>
                    <td>
                      <div className="user-cell">
                        <div
                          className="user-avatar"
                          style={{ background: booking.avatar, color: 'white' }}
                        >
                          {booking.user[0]}
                        </div>
                        <div>
                          <div className="user-name">{booking.user}</div>
                          <div className="user-email">{booking.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{booking.experience}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{booking.date}</td>
                    <td style={{ fontWeight: 600 }}>{booking.amount}</td>
                    <td>
                      <span className={`badge-status ${booking.status}`}>
                        {booking.status === 'confirmed' && '✅ Đã xác nhận'}
                        {booking.status === 'pending' && '⏳ Chờ xử lý'}
                        {booking.status === 'cancelled' && '❌ Đã huỷ'}
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
                <span style={{ color: 'var(--success)' }}>● Online</span> — 39 endpoints
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
