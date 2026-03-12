'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

type Booking = {
  id: string;
  booking_code: string;
  user_name: string;
  experience_title: string;
  booking_date: string;
  start_time: string;
  guest_count: number;
  total_price: number;
  status: string;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; emoji: string; color: string }> = {
  pending: { label: 'Chờ xử lý', emoji: '⏳', color: '#FF9800' },
  confirmed: { label: 'Đã xác nhận', emoji: '✅', color: '#4CAF50' },
  cancelled: { label: 'Đã huỷ', emoji: '❌', color: '#F44336' },
  completed: { label: 'Hoàn thành', emoji: '🎉', color: '#2196F3' },
  refunded: { label: 'Đã hoàn tiền', emoji: '💸', color: '#9E9E9E' },
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getBookings({ status: statusFilter, page });
    if (res.success && res.data) {
      setBookings(res.data);
    }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleStatusChange = async (id: string, status: string) => {
    if (!confirm(`Chuyển trạng thái sang "${STATUS_MAP[status]?.label}"?`)) return;
    await adminApi.updateBookingStatus(id, status);
    fetchBookings();
  };

  const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>📋 Quản lý Bookings</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          {['', 'pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="btn"
              style={{
                background: statusFilter === s
                  ? 'var(--primary)' : 'var(--card-bg)',
                color: statusFilter === s ? '#000' : 'var(--text-primary)',
                fontWeight: statusFilter === s ? 700 : 400,
              }}
            >
              {s ? (STATUS_MAP[s]?.emoji + ' ' + STATUS_MAP[s]?.label) : '📊 Tất cả'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {Object.entries(STATUS_MAP).map(([key, val]) => {
          const count = bookings.filter(b => b.status === key).length;
          return (
            <div key={key} className="stat-card" style={{ borderLeft: `3px solid ${val.color}` }}>
              <div className="stat-icon">{val.emoji}</div>
              <div className="stat-value">{count}</div>
              <div className="stat-label">{val.label}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="data-card">
        <table>
          <thead>
            <tr>
              <th>Mã booking</th>
              <th>Khách hàng</th>
              <th>Trải nghiệm</th>
              <th>Ngày</th>
              <th>Khách</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>⏳ Đang tải...</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Không có booking nào
              </td></tr>
            ) : bookings.map((b) => {
              const st = STATUS_MAP[b.status] || STATUS_MAP.pending;
              return (
                <tr key={b.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--primary)' }}>{b.booking_code || b.id.slice(0, 8)}</span></td>
                  <td>{b.user_name || '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.experience_title || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {b.booking_date ? new Date(b.booking_date).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>{b.guest_count || 1}</td>
                  <td style={{ fontWeight: 600 }}>{b.total_price ? formatVND(b.total_price) : '—'}</td>
                  <td>
                    <span className={`badge-status ${b.status}`} style={{ borderColor: st.color + '44', color: st.color }}>
                      {st.emoji} {st.label}
                    </span>
                  </td>
                  <td>
                    <select
                      value=""
                      onChange={(e) => e.target.value && handleStatusChange(b.id, e.target.value)}
                      style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)',
                        fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      <option value="">⚡ Thay đổi</option>
                      {Object.entries(STATUS_MAP).filter(([k]) => k !== b.status).map(([k, v]) => (
                        <option key={k} value={k}>{v.emoji} {v.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Trước</button>
          <span style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>Trang {page}</span>
          <button className="btn" onClick={() => setPage(p => p + 1)}>Sau →</button>
        </div>
      </div>
    </div>
  );
}
