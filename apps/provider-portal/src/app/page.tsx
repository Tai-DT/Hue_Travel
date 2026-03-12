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
// Provider Portal — Guide Dashboard
// ============================================

const STATS = [
  { icon: '📋', label: 'Tours tháng này', value: '24', change: '+6', up: true, bg: 'rgba(46,125,50,0.1)' },
  { icon: '⭐', label: 'Đánh giá TB', value: '4.87', change: '+0.05', up: true, bg: 'rgba(249,168,37,0.1)' },
  { icon: '💰', label: 'Thu nhập (VNĐ)', value: '18.5M', change: '+32%', up: true, bg: 'rgba(66,165,245,0.1)' },
  { icon: '👥', label: 'Khách phục vụ', value: '67', change: '+12', up: true, bg: 'rgba(156,39,176,0.1)' },
];

const UPCOMING_TOURS = [
  { time: '09:00', period: 'AM', title: 'Khám phá Đại Nội Huế', guests: 4, status: 'confirmed', meetPoint: 'Cổng Ngọ Môn' },
  { time: '14:00', period: 'PM', title: 'Tour Ẩm thực đường phố', guests: 6, status: 'confirmed', meetPoint: 'Chợ Đông Ba' },
  { time: '16:30', period: 'PM', title: 'Chèo thuyền sông Hương', guests: 2, status: 'pending', meetPoint: 'Bến thuyền Tòa Khâm' },
];

const RECENT_REVIEWS = [
  { name: 'Nguyễn Văn An', avatar: '#4CAF50', stars: 5, date: '2 giờ trước', text: 'Tour tuyệt vời! Anh Minh rất am hiểu lịch sử và kể chuyện rất hấp dẫn. Sẽ quay lại!' },
  { name: 'Trần Thị Bình', avatar: '#42A5F5', stars: 5, date: '1 ngày trước', text: 'Ẩm thực Huế đa dạng quá. Cảm ơn anh guide đã giới thiệu những quán ngon nhất 🙌' },
  { name: 'Lê Minh Cường', avatar: '#E040FB', stars: 4, date: '3 ngày trước', text: 'Tour rất ok, chỉ hơi ngắn thôi. Nhưng guide nhiệt tình, kiến thức vững.' },
];

const EARNINGS_BREAKDOWN = [
  { label: 'Tour di sản', amount: '8,200,000₫', pct: 44, color: '#2E7D32' },
  { label: 'Tour ẩm thực', amount: '5,400,000₫', pct: 29, color: '#F9A825' },
  { label: 'Tour thiên nhiên', amount: '3,100,000₫', pct: 17, color: '#42A5F5' },
  { label: 'Workshop', amount: '1,800,000₫', pct: 10, color: '#E040FB' },
];

const RECENT_BOOKINGS = [
  { id: 'HT-A1B2', guest: 'Nguyễn Văn An', tour: 'Đại Nội Huế', date: '12/03', guests: 4, amount: '1,000,000₫', status: 'confirmed' },
  { id: 'HT-C3D4', guest: 'Trần Thị Bình', tour: 'Ẩm thực đường phố', date: '12/03', guests: 6, amount: '2,700,000₫', status: 'confirmed' },
  { id: 'HT-E5F6', guest: 'Lê Minh Cường', tour: 'Sông Hương', date: '12/03', guests: 2, amount: '700,000₫', status: 'pending' },
  { id: 'HT-G7H8', guest: 'Phạm Đức', tour: 'Workshop nón', date: '13/03', guests: 3, amount: '600,000₫', status: 'pending' },
  { id: 'HT-I9J0', guest: 'Võ Thị Em', tour: 'Lăng Tự Đức', date: '14/03', guests: 5, amount: '2,500,000₫', status: 'confirmed' },
];

const NAV: NavSection[] = [
  { section: 'Tổng quan', items: [
    { icon: '📊', label: 'Dashboard', key: 'dashboard', active: true },
    { icon: '📅', label: 'Lịch trình', key: 'schedule' },
  ]},
  { section: 'Quản lý', items: [
    { icon: '🏛️', label: 'Tours của tôi', key: 'my-tours' },
    { icon: '📋', label: 'Bookings', key: 'bookings', badge: 3 },
    { icon: '💬', label: 'Tin nhắn', key: 'messages', badge: 2 },
    { icon: '⭐', label: 'Đánh giá', key: 'reviews' },
  ]},
  { section: 'Tài chính', items: [
    { icon: '💰', label: 'Thu nhập', key: 'earnings' },
    { icon: '🧾', label: 'Hoá đơn', key: 'invoices' },
  ]},
  { section: 'Tài khoản', items: [
    { icon: '👤', label: 'Hồ sơ', key: 'profile' },
    { icon: '⚙️', label: 'Cài đặt', key: 'settings' },
  ]},
];

export default function ProviderDashboard() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <div className="portal-layout">
      {/* ---- Sidebar ---- */}
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
        </nav>

        <div className="p-profile-card">
          <div className="p-profile-avatar">NM</div>
          <div>
            <div className="p-profile-name">Nguyễn Minh</div>
            <div className="p-profile-status">● Online</div>
          </div>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <main className="p-main">
        <header className="p-topbar">
          <h1 className="p-topbar-title">👋 Xin chào, Minh!</h1>
          <div className="p-topbar-actions">
            <div className="p-topbar-btn">🔔<span className="dot"></span></div>
            <div className="p-topbar-btn">💬<span className="dot"></span></div>
          </div>
        </header>

        <div className="p-page">
          {/* Stats */}
          <div className="p-stats">
            {STATS.map((s, i) => (
              <div key={i} className="p-stat">
                <div className="p-stat-top">
                  <div className="p-stat-icon" style={{ background: s.bg }}>{s.icon}</div>
                  <span className={`p-stat-change ${s.up ? 'up' : 'down'}`}>
                    {s.up ? '↑' : '↓'} {s.change}
                  </span>
                </div>
                <div className="p-stat-value">{s.value}</div>
                <div className="p-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Two-col: Schedule + Reviews */}
          <div className="p-grid-2">
            {/* Today's Schedule */}
            <div className="p-card">
              <div className="p-card-header">
                <span className="p-card-title">📅 Lịch trình hôm nay</span>
                <button className="p-btn">Xem tất cả</button>
              </div>
              {UPCOMING_TOURS.map((tour, i) => (
                <div key={i} className="p-schedule">
                  <div className="p-schedule-time">
                    <div className="p-schedule-hour">{tour.time}</div>
                    <div className="p-schedule-period">{tour.period}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="p-schedule-title">{tour.title}</div>
                    <div className="p-schedule-meta">
                      👥 {tour.guests} khách • 📍 {tour.meetPoint}
                    </div>
                  </div>
                  <span className={`p-badge ${tour.status === 'confirmed' ? 'green' : 'yellow'}`}>
                    {tour.status === 'confirmed' ? '✅ Xác nhận' : '⏳ Chờ'}
                  </span>
                </div>
              ))}
            </div>

            {/* Recent Reviews */}
            <div className="p-card">
              <div className="p-card-header">
                <span className="p-card-title">⭐ Đánh giá mới nhất</span>
                <button className="p-btn">Xem tất cả</button>
              </div>
              {RECENT_REVIEWS.map((rv, i) => (
                <div key={i} className="p-review">
                  <div className="p-review-avatar" style={{ background: rv.avatar, color: 'white' }}>
                    {rv.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="p-review-name">{rv.name}</span>
                      <span className="p-review-date">{rv.date}</span>
                    </div>
                    <div className="p-review-stars">{'⭐'.repeat(rv.stars)}</div>
                    <div className="p-review-text">{rv.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="p-grid-2" style={{ marginBottom: 28 }}>
            <div className="p-card">
              <div className="p-card-header">
                <span className="p-card-title">💰 Thu nhập tháng 3/2026</span>
                <span style={{ fontSize: 24, fontWeight: 800 }}>18,500,000₫</span>
              </div>
              <div style={{ padding: 20 }}>
                <div className="p-earning-bar">
                  {EARNINGS_BREAKDOWN.map((e, i) => (
                    <div key={i} className="p-earning-segment" style={{ width: `${e.pct}%`, background: e.color }} />
                  ))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {EARNINGS_BREAKDOWN.map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: e.color }} />
                      <span style={{ flex: 1, fontSize: 14, color: '#666' }}>{e.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{e.amount}</span>
                      <span style={{ fontSize: 12, color: '#999', minWidth: 36, textAlign: 'right' }}>{e.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="p-card">
              <div className="p-card-header">
                <span className="p-card-title">📊 Hiệu suất</span>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <PerfMetric label="Tỉ lệ hoàn thành" value="98%" color="#4CAF50" pct={98} />
                <PerfMetric label="Đánh giá 5 sao" value="82%" color="#F9A825" pct={82} />
                <PerfMetric label="Tỉ lệ đặt lại" value="45%" color="#42A5F5" pct={45} />
                <PerfMetric label="Phản hồi chat" value="95%" color="#9C27B0" pct={95} />
              </div>
            </div>
          </div>

          {/* Recent Bookings Table */}
          <div className="p-card">
            <div className="p-card-header">
              <span className="p-card-title">📋 Bookings gần đây</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="p-btn">🔽 Export</button>
                <button className="p-btn p-btn-primary">+ Tạo tour</button>
              </div>
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
                {RECENT_BOOKINGS.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{b.id}</td>
                    <td>{b.guest}</td>
                    <td>{b.tour}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{b.date}</td>
                    <td>{b.guests}</td>
                    <td style={{ fontWeight: 600 }}>{b.amount}</td>
                    <td>
                      <span className={`p-badge ${b.status === 'confirmed' ? 'green' : 'yellow'}`}>
                        {b.status === 'confirmed' ? '✅ Xác nhận' : '⏳ Chờ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
