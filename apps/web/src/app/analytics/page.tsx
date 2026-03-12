'use client';

import { useState } from 'react';

const PERIODS = ['7 ngày', '30 ngày', '3 tháng', '6 tháng', '1 năm'];

const METRICS = [
  { label: 'Tổng doanh thu', value: '1.2B₫', change: '+18.5%', up: true, icon: '💰' },
  { label: 'Số booking', value: '3,847', change: '+12.3%', up: true, icon: '📋' },
  { label: 'Người dùng mới', value: '1,256', change: '+24.7%', up: true, icon: '👥' },
  { label: 'Tỷ lệ huỷ', value: '3.2%', change: '-0.8%', up: true, icon: '📉' },
  { label: 'Đánh giá TB', value: '4.72', change: '-0.02', up: false, icon: '⭐' },
  { label: 'Revenue/user', value: '312K₫', change: '+5.4%', up: true, icon: '💎' },
];

const TOP_CATEGORIES = [
  { name: 'Tour di sản', revenue: '420M₫', bookings: 1245, pct: 35, color: '#F9A825' },
  { name: 'Ẩm thực', revenue: '312M₫', bookings: 987, pct: 26, color: '#4CAF50' },
  { name: 'Thiên nhiên', revenue: '216M₫', bookings: 623, pct: 18, color: '#42A5F5' },
  { name: 'Thủ công', revenue: '132M₫', bookings: 534, pct: 11, color: '#E040FB' },
  { name: 'Tâm linh', revenue: '120M₫', bookings: 458, pct: 10, color: '#FF7043' },
];

const MONTHLY_DATA = [
  { month: 'T1', revenue: 65, bookings: 320 },
  { month: 'T2', revenue: 72, bookings: 380 },
  { month: 'T3', revenue: 100, bookings: 450 },
  { month: 'T4', revenue: 58, bookings: 280 },
  { month: 'T5', revenue: 92, bookings: 420 },
  { month: 'T6', revenue: 78, bookings: 360 },
  { month: 'T7', revenue: 95, bookings: 440 },
  { month: 'T8', revenue: 88, bookings: 410 },
  { month: 'T9', revenue: 76, bookings: 350 },
  { month: 'T10', revenue: 82, bookings: 380 },
  { month: 'T11', revenue: 90, bookings: 430 },
  { month: 'T12', revenue: 85, bookings: 400 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30 ngày');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>📈 Analytics</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              className="btn"
              onClick={() => setPeriod(p)}
              style={{
                background: period === p ? 'var(--primary)' : 'var(--card-bg)',
                color: period === p ? '#000' : 'var(--text-primary)',
                fontWeight: period === p ? 700 : 400,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {METRICS.map((m, i) => (
          <div key={i} className="chart-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{m.icon}</span>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                background: m.up ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                color: m.up ? '#4CAF50' : '#F44336',
              }}>
                {m.up ? '↑' : '↓'} {m.change}
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{m.value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="chart-container">
        <div className="chart-card">
          <div className="chart-title">📊 Doanh thu theo tháng (triệu VNĐ)</div>
          <div className="mini-bars">
            {MONTHLY_DATA.map((d, i) => (
              <div
                key={i}
                className="mini-bar"
                style={{
                  height: `${d.revenue}%`,
                  background: d.revenue >= 90
                    ? 'linear-gradient(180deg, #F9A825, #FF6F00)'
                    : 'linear-gradient(180deg, #333, #222)',
                }}
              >
                <span className="mini-bar-label">{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">🏛️ Phân bổ theo danh mục</div>
          <div style={{ padding: 20 }}>
            {TOP_CATEGORIES.map((cat, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: cat.color }} />
                    <span style={{ fontSize: 14 }}>{cat.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>{cat.revenue}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{cat.bookings} bookings</span>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${cat.pct}%`, background: cat.color, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="data-card" style={{ marginTop: 24 }}>
        <div className="data-card-header">
          <h2 className="data-card-title">🔄 Conversion Funnel</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, padding: 20 }}>
          {[
            { stage: 'Visits', value: '45,280', pct: 100, color: '#42A5F5' },
            { stage: 'Search', value: '28,450', pct: 63, color: '#66BB6A' },
            { stage: 'View Detail', value: '12,380', pct: 27, color: '#FFA726' },
            { stage: 'Add to Cart', value: '5,640', pct: 12, color: '#EF5350' },
            { stage: 'Completed', value: '3,847', pct: 8.5, color: '#F9A825' },
          ].map((f, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{f.stage}</div>
              <div style={{
                height: f.pct * 1.5, background: f.color, borderRadius: 8,
                minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'height 0.5s',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{f.pct}%</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
