'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi, DashboardStats } from '@/lib/api';

type AnalyticsData = {
  stats: DashboardStats | null;
  bookings: any[];
};

const PERIODS = [
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: 30 },
  { label: '3 tháng', days: 90 },
  { label: '6 tháng', days: 180 },
  { label: '1 năm', days: 365 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(PERIODS[1]);
  const [data, setData] = useState<AnalyticsData>({ stats: null, bookings: [] });
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    const [statsRes, bookingsRes] = await Promise.all([
      adminApi.getDashboardStats(period.days),
      adminApi.getBookings({ page: 1, perPage: 200, days: period.days }),
    ]);

    setData({
      stats: (statsRes.success && statsRes.data) ? statsRes.data : null,
      bookings: (bookingsRes.success && bookingsRes.data) ? bookingsRes.data : [],
    });
    setLoading(false);
  }, [period.days]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const formatVND = (n: number) => {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B₫';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M₫';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K₫';
    return new Intl.NumberFormat('vi-VN').format(n) + '₫';
  };

  // Compute metrics from real data
  const totalRevenue = data.stats?.total_revenue || 0;
  const totalBookings = data.stats?.total_bookings || 0;
  const totalUsers = data.stats?.total_users || 0;
  const newUsers = data.stats?.new_users_this_month || 0;
  const avgRating = data.stats?.avg_rating || 0;
  const cancelledCount = data.bookings.filter(b => b.status === 'cancelled').length;
  const cancelRate = totalBookings > 0 ? ((cancelledCount / totalBookings) * 100).toFixed(1) : '0';
  const revenuePerUser = totalUsers > 0
    ? Math.round(totalRevenue / totalUsers)
    : 0;

  const METRICS = [
    { label: `Doanh thu ${period.label.toLowerCase()}`, value: formatVND(totalRevenue), icon: '💰' },
    { label: `Bookings ${period.label.toLowerCase()}`, value: totalBookings.toLocaleString(), icon: '📋' },
    { label: 'Người dùng trong kỳ', value: newUsers.toLocaleString(), icon: '👥' },
    { label: 'Tỷ lệ huỷ', value: cancelRate + '%', icon: '📉' },
    { label: `Đánh giá TB ${period.label.toLowerCase()}`, value: avgRating.toFixed(2), icon: '⭐' },
    { label: 'Doanh thu / user', value: formatVND(revenuePerUser), icon: '💎' },
  ];

  // Compute booking status distribution for chart
  const statusCounts: Record<string, number> = {};
  data.bookings.forEach(b => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });

  const STATUS_COLORS: Record<string, string> = {
    confirmed: '#4CAF50',
    pending: '#FF9800',
    cancelled: '#F44336',
    completed: '#2196F3',
    refunded: '#9E9E9E',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>📈 Analytics</h1>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>
            Đang xem dữ liệu trong {period.label.toLowerCase()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIODS.map((p) => (
            <button
              key={p.label}
              className="btn"
              onClick={() => setPeriod(p)}
              style={{
                background: period.days === p.days ? 'var(--primary)' : 'var(--bg-card)',
                color: period.days === p.days ? '#000' : 'var(--text)',
                fontWeight: period.days === p.days ? 700 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
          <button className="btn" onClick={fetchAnalytics}>🔄</button>
        </div>
      </div>

      {loading ? (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="chart-card" style={{ padding: 20 }}>
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '50%', height: 28, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '70%', height: 14 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {METRICS.map((m, i) => (
              <div key={i} className="chart-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <span style={{ fontSize: 28 }}>{m.icon}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{m.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Status Distribution */}
          <div className="chart-container">
            <div className="chart-card">
              <div className="chart-title">📊 Phân bổ trạng thái Booking</div>
              <div className="mini-bars" style={{ height: 180 }}>
                {Object.entries(statusCounts).map(([status, count], i) => {
                  const maxCount = Math.max(...Object.values(statusCounts), 1);
                  return (
                    <div
                      key={status}
                      className="mini-bar"
                      style={{
                        height: `${(count / maxCount) * 100}%`,
                        background: STATUS_COLORS[status] || '#666',
                        minHeight: 20,
                      }}
                    >
                      <span className="mini-bar-label">{status} ({count})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-title">📋 Tổng quan nhanh</div>
              <div style={{ padding: 20 }}>
                <div className="donut-list">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div key={status} className="donut-item">
                      <div className="donut-dot" style={{ background: STATUS_COLORS[status] || '#666' }} />
                      <span className="donut-label" style={{ textTransform: 'capitalize' }}>{status}</span>
                      <span className="donut-value">{count}</span>
                      <span className="donut-pct">
                        {totalBookings > 0 ? ((count / totalBookings) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="data-card" style={{ marginTop: 24 }}>
            <div className="data-card-header">
              <h2 className="data-card-title">🔢 Tổng kết hệ thống</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: 20 }}>
              {[
                { label: 'Users trong kỳ', value: data.stats?.total_users?.toLocaleString() || '0', icon: '👥', color: '#42A5F5' },
                { label: 'Bookings trong kỳ', value: totalBookings.toLocaleString(), icon: '📋', color: '#4CAF50' },
                { label: 'Chờ xử lý', value: (data.stats?.pending_bookings || 0).toLocaleString(), icon: '⏳', color: '#FF9800' },
                { label: `Doanh thu ${period.label.toLowerCase()}`, value: formatVND(totalRevenue), icon: '💰', color: '#F9A825' },
              ].map((item, i) => (
                <div key={i} style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 12,
                  padding: 20,
                  textAlign: 'center',
                  borderLeft: `3px solid ${item.color}`,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{item.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
