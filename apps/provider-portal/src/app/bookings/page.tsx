'use client';

import { useState, useEffect, useCallback } from 'react';
import { providerApi } from '@/lib/api';

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
  special_notes?: string;
};

export default function GuideBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const res = await providerApi.getMyBookings(statusFilter);
    if (res.success && res.data) setBookings(res.data);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleConfirm = async (id: string) => {
    if (!confirm('Xác nhận booking này?')) return;
    await providerApi.confirmBooking(id);
    fetchBookings();
  };

  const handleComplete = async (id: string) => {
    if (!confirm('Đánh dấu hoàn thành?')) return;
    await providerApi.completeBooking(id);
    fetchBookings();
  };

  const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>📋 Bookings của tôi</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: '', label: 'Tất cả' },
            { key: 'pending', label: '⏳ Chờ xác nhận' },
            { key: 'confirmed', label: '✅ Đã xác nhận' },
            { key: 'completed', label: '🎉 Hoàn thành' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className="p-btn"
              style={{
                background: statusFilter === f.key ? 'var(--primary)' : 'var(--card-bg)',
                color: statusFilter === f.key ? '#000' : 'var(--text-primary)',
                fontWeight: statusFilter === f.key ? 700 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>⏳ Đang tải...</div>
      ) : bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          Không có booking nào
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {bookings.map((b) => (
            <div key={b.id} className="p-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                    {b.experience_title || 'Tour'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>
                    {b.booking_code || b.id.slice(0, 8)} • {b.user_name || 'Khách'}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                    <span>📅 {b.booking_date ? new Date(b.booking_date).toLocaleDateString('vi-VN') : '—'}</span>
                    <span>🕐 {b.start_time || '—'}</span>
                    <span>👥 {b.guest_count || 1} khách</span>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{b.total_price ? formatVND(b.total_price) : '—'}</span>
                  </div>
                  {b.special_notes && (
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      📝 {b.special_notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {b.status === 'pending' && (
                    <button className="p-btn p-btn-primary" onClick={() => handleConfirm(b.id)}>
                      ✅ Xác nhận
                    </button>
                  )}
                  {b.status === 'confirmed' && (
                    <button className="p-btn p-btn-primary" onClick={() => handleComplete(b.id)}>
                      🎉 Hoàn thành
                    </button>
                  )}
                  <span className={`p-badge ${
                    b.status === 'confirmed' ? 'green' :
                    b.status === 'completed' ? 'blue' :
                    b.status === 'cancelled' ? 'red' : 'yellow'
                  }`}>
                    {b.status === 'confirmed' ? '✅ Xác nhận' :
                     b.status === 'completed' ? '🎉 Xong' :
                     b.status === 'cancelled' ? '❌ Huỷ' : '⏳ Chờ'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
