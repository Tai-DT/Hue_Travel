'use client';

import { useState, useEffect, useCallback } from 'react';
import { providerApi } from '@/lib/api';

type Booking = {
  id: string;
  booking_code: string;
  experience_title: string;
  booking_date: string;
  total_price: number;
  service_fee: number;
  guest_count: number;
  status: string;
};

export default function RevenuePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await providerApi.getMyBookings();
    if (res.success && res.data) setBookings(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';
  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return '—'; }
  };

  const now = new Date();
  const filteredBookings = bookings.filter(b => {
    if (!['completed', 'confirmed'].includes(b.status)) return false;
    if (period === 'all') return true;
    const d = new Date(b.booking_date);
    if (period === 'week') return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });

  const totalRevenue = filteredBookings.reduce((s, b) => s + (b.total_price || 0), 0);
  const totalFee = filteredBookings.reduce((s, b) => s + (b.service_fee || 0), 0);
  const netRevenue = totalRevenue - totalFee;
  const totalGuests = filteredBookings.reduce((s, b) => s + (b.guest_count || 0), 0);
  const avgPerBooking = filteredBookings.length > 0 ? Math.round(totalRevenue / filteredBookings.length) : 0;

  // Group by month for chart
  const monthlyData: Record<string, number> = {};
  bookings.filter(b => ['completed', 'confirmed'].includes(b.status)).forEach(b => {
    const d = new Date(b.booking_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = (monthlyData[key] || 0) + (b.total_price || 0);
  });
  const chartEntries = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const maxRevenue = Math.max(...chartEntries.map(([, v]) => v), 1);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>💰 Doanh thu</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['week', '7 ngày'], ['month', 'Tháng này'], ['all', 'Tất cả']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)} className="p-btn"
              style={{
                background: period === k ? 'var(--primary)' : 'var(--card-bg)',
                color: period === k ? '#000' : 'var(--text-primary)',
                fontWeight: period === k ? 700 : 400,
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="p-stats" style={{ marginBottom: 24 }}>
        <div className="p-stat">
          <div className="p-stat-icon" style={{ background: 'rgba(76,175,80,0.1)' }}>💰</div>
          <div className="p-stat-value" style={{ color: '#4CAF50' }}>{formatVND(totalRevenue)}</div>
          <div className="p-stat-label">Tổng doanh thu</div>
        </div>
        <div className="p-stat">
          <div className="p-stat-icon" style={{ background: 'rgba(255,152,0,0.1)' }}>💸</div>
          <div className="p-stat-value">{formatVND(totalFee)}</div>
          <div className="p-stat-label">Phí nền tảng (5%)</div>
        </div>
        <div className="p-stat">
          <div className="p-stat-icon" style={{ background: 'rgba(33,150,243,0.1)' }}>🏦</div>
          <div className="p-stat-value" style={{ color: '#2196F3' }}>{formatVND(netRevenue)}</div>
          <div className="p-stat-label">Thực nhận</div>
        </div>
        <div className="p-stat">
          <div className="p-stat-icon" style={{ background: 'rgba(156,39,176,0.1)' }}>📊</div>
          <div className="p-stat-value">{formatVND(avgPerBooking)}</div>
          <div className="p-stat-label">TB/booking</div>
        </div>
      </div>

      {/* Simple bar chart */}
      {chartEntries.length > 0 && (
        <div className="p-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📈 Doanh thu theo tháng</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180 }}>
            {chartEntries.map(([month, value]) => (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%', maxWidth: 60,
                  height: `${Math.max((value / maxRevenue) * 150, 8)}px`,
                  background: 'linear-gradient(180deg, #4CAF50, #81C784)',
                  borderRadius: '8px 8px 0 0',
                  transition: 'height 0.5s ease',
                }} />
                <div style={{ fontSize: 11, color: '#888', marginTop: 8, fontWeight: 600 }}>
                  {month.split('-')[1]}/{month.split('-')[0].slice(2)}
                </div>
                <div style={{ fontSize: 10, color: '#666' }}>{formatVND(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="p-card">
        <div className="p-card-header">
          <span className="p-card-title">📋 Chi tiết giao dịch ({filteredBookings.length})</span>
          <span style={{ fontSize: 13, color: '#888' }}>
            👥 Tổng {totalGuests} khách
          </span>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>⏳ Đang tải...</div>
        ) : filteredBookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            Chưa có giao dịch nào trong kỳ này
          </div>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tour</th>
                <th>Ngày</th>
                <th>SL khách</th>
                <th>Tổng tiền</th>
                <th>Phí NTT</th>
                <th>Thực nhận</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    {b.booking_code || b.id?.slice(0, 8)}
                  </td>
                  <td>{b.experience_title || '—'}</td>
                  <td style={{ color: '#666', fontSize: 13 }}>{formatDate(b.booking_date)}</td>
                  <td>{b.guest_count || 1}</td>
                  <td style={{ fontWeight: 600 }}>{formatVND(b.total_price || 0)}</td>
                  <td style={{ color: '#FF9800' }}>{formatVND(b.service_fee || 0)}</td>
                  <td style={{ fontWeight: 700, color: '#4CAF50' }}>
                    {formatVND((b.total_price || 0) - (b.service_fee || 0))}
                  </td>
                  <td>
                    <span className={`p-badge ${b.status === 'completed' ? 'blue' : 'green'}`}>
                      {b.status === 'completed' ? '🎉 Xong' : '✅ Xác nhận'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
