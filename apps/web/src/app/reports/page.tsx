'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<number>(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [statsRes, bookingsRes] = await Promise.all([
      adminApi.getDashboardOverview({ days: period }),
      adminApi.getBookings({ days: period, perPage: 100 }),
    ]);
    if (statsRes.success && statsRes.data) setStats(statsRes.data.stats);
    if (bookingsRes.success && bookingsRes.data) setBookings(bookingsRes.data);
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatVND = (n: number) => {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B₫';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M₫';
    return new Intl.NumberFormat('vi-VN').format(n) + '₫';
  };

  // Compute revenue stats
  const completedBookings = bookings.filter(b => ['completed', 'confirmed'].includes(b.status));
  const totalRevenue = completedBookings.reduce((s, b) => s + (b.total_price || 0), 0);
  const totalServiceFee = completedBookings.reduce((s, b) => s + (b.service_fee || 0), 0);
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;
  const avgOrderValue = completedBookings.length > 0 ? Math.round(totalRevenue / completedBookings.length) : 0;

  // Revenue by category
  const byCat: Record<string, { count: number; revenue: number }> = {};
  completedBookings.forEach(b => {
    const cat = b.experience?.category || b.category || 'other';
    if (!byCat[cat]) byCat[cat] = { count: 0, revenue: 0 };
    byCat[cat].count++;
    byCat[cat].revenue += b.total_price || 0;
  });

  // Revenue by day for chart
  const byDay: Record<string, number> = {};
  completedBookings.forEach(b => {
    const date = b.booking_date || b.created_at;
    if (!date) return;
    const key = new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    byDay[key] = (byDay[key] || 0) + (b.total_price || 0);
  });
  const dayEntries = Object.entries(byDay).slice(-14);
  const maxDay = Math.max(...dayEntries.map(([, v]) => v), 1);

  const catEmoji: Record<string, string> = {
    food: '🍜', tour: '🏛️', experience: '🎭',
    sightseeing: '📸', stay: '🏨', transport: '🚐', other: '📦',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>💰 Báo cáo Doanh thu</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            [7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày'], [365, 'Năm nay'],
          ].map(([days, label]) => (
            <button key={days} onClick={() => setPeriod(Number(days))} className="btn"
              style={{
                background: period === days ? 'var(--primary)' : 'var(--card-bg)',
                color: period === days ? '#000' : 'var(--text)',
                fontWeight: period === days ? 700 : 400,
                border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="stats-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: '60%', height: 32, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '40%', height: 16 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card success">
              <div className="stat-icon">💰</div>
              <div className="stat-value">{formatVND(totalRevenue)}</div>
              <div className="stat-label">Tổng doanh thu</div>
            </div>
            <div className="stat-card info">
              <div className="stat-icon">🏦</div>
              <div className="stat-value">{formatVND(totalServiceFee)}</div>
              <div className="stat-label">Phí nền tảng (5%)</div>
            </div>
            <div className="stat-card primary">
              <div className="stat-icon">📊</div>
              <div className="stat-value">{formatVND(avgOrderValue)}</div>
              <div className="stat-label">Giá trị TB/booking</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-icon">📋</div>
              <div className="stat-value">{completedBookings.length}<span style={{ fontSize: 14, color: '#999' }}>/{bookings.length}</span></div>
              <div className="stat-label">Hoàn thành / Tổng</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginTop: 24 }}>
            {/* Revenue chart */}
            <div className="data-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>📈 Doanh thu theo ngày</h3>
              {dayEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200 }}>
                  {dayEntries.map(([date, value]) => (
                    <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: 9, color: '#888', marginBottom: 4 }}>
                        {formatVND(value)}
                      </div>
                      <div style={{
                        width: '100%', maxWidth: 40,
                        height: `${Math.max((value / maxDay) * 160, 4)}px`,
                        background: 'linear-gradient(180deg, #667eea, #764ba2)',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.5s ease',
                      }} />
                      <div style={{ fontSize: 10, color: '#888', marginTop: 6, whiteSpace: 'nowrap' }}>{date}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By category */}
            <div className="data-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>🏷️ Doanh thu theo loại</h3>
              {Object.keys(byCat).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Chưa có dữ liệu</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(byCat)
                    .sort((a, b) => b[1].revenue - a[1].revenue)
                    .map(([cat, data]) => {
                      const pct = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 14 }}>
                              {catEmoji[cat] || '📦'} {cat}
                              <span style={{ color: '#888', fontSize: 12, marginLeft: 6 }}>
                                ({data.count} bookings)
                              </span>
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{formatVND(data.revenue)}</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: 'linear-gradient(90deg, #667eea, #764ba2)',
                              borderRadius: 4, transition: 'width 0.5s',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Cancellation rate */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 24 }}>
            <div className="stat-card" style={{ borderLeft: '3px solid #F44336' }}>
              <div className="stat-icon">❌</div>
              <div className="stat-value">{cancelledCount}</div>
              <div className="stat-label">Bookings bị huỷ</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #4CAF50' }}>
              <div className="stat-icon">📈</div>
              <div className="stat-value">
                {bookings.length > 0 ? ((completedBookings.length / bookings.length) * 100).toFixed(0) : 0}%
              </div>
              <div className="stat-label">Tỉ lệ hoàn thành</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #2196F3' }}>
              <div className="stat-icon">👥</div>
              <div className="stat-value">
                {completedBookings.reduce((s, b) => s + (b.guest_count || 0), 0)}
              </div>
              <div className="stat-label">Tổng khách phục vụ</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
