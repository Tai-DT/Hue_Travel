'use client';

import { useState, useEffect, useCallback } from 'react';
import { providerApi } from '@/lib/api';

type Booking = {
  id: string;
  booking_code: string;
  experience_title: string;
  user_name: string;
  booking_date: string;
  start_time: string;
  guest_count: number;
  total_price: number;
  status: string;
};

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];

  // Fill empty slots before first day
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function toDateKey(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await providerApi.getMyBookings();
    if (res.success && res.data) setBookings(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getMonthDays(year, month);
  const today = toDateKey(new Date());

  // Map bookings to date keys
  const bookingsByDate: Record<string, Booking[]> = {};
  bookings.forEach(b => {
    if (!b.booking_date) return;
    const key = toDateKey(b.booking_date);
    if (!bookingsByDate[key]) bookingsByDate[key] = [];
    bookingsByDate[key].push(b);
  });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => { setViewDate(new Date()); setSelectedDate(today); };

  const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';

  const selectedBookings = selectedDate ? (bookingsByDate[selectedDate] || []) : [];

  const statusDot: Record<string, string> = {
    pending: '#FF9800',
    confirmed: '#4CAF50',
    completed: '#2196F3',
    cancelled: '#F44336',
  };

  // Summary stats
  const monthBookings = bookings.filter(b => {
    const d = new Date(b.booking_date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const confirmCount = monthBookings.filter(b => b.status === 'confirmed').length;
  const pendingCount = monthBookings.filter(b => b.status === 'pending').length;

  const monthName = new Date(year, month).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>📅 Lịch Bookings</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#888', display: 'flex', alignItems: 'center', gap: 16, marginRight: 16 }}>
            <span>📋 {monthBookings.length} bookings</span>
            <span>✅ {confirmCount} xác nhận</span>
            <span>⏳ {pendingCount} chờ</span>
          </span>
          <button className="p-btn" onClick={goToday}>Hôm nay</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Calendar */}
        <div className="p-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button className="p-btn" onClick={prevMonth}>←</button>
            <h3 style={{ fontSize: 18, fontWeight: 700, textTransform: 'capitalize' }}>{monthName}</h3>
            <button className="p-btn" onClick={nextMonth}>→</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>⏳ Đang tải...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
                {WEEKDAYS.map(d => (
                  <div key={d} style={{
                    textAlign: 'center', fontSize: 12, fontWeight: 700,
                    color: '#999', padding: '8px 0',
                  }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {days.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />;
                  const key = toDateKey(day);
                  const dayBookings = bookingsByDate[key] || [];
                  const isToday = key === today;
                  const isSelected = key === selectedDate;
                  const hasPending = dayBookings.some(b => b.status === 'pending');
                  const hasConfirmed = dayBookings.some(b => b.status === 'confirmed');

                  return (
                    <div key={key} onClick={() => setSelectedDate(key)}
                      style={{
                        padding: '8px 4px', textAlign: 'center', borderRadius: 10,
                        cursor: 'pointer', minHeight: 56,
                        background: isSelected ? 'var(--primary)' : isToday ? 'rgba(255,193,7,0.1)' : 'transparent',
                        color: isSelected ? '#000' : 'var(--text)',
                        border: isToday && !isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 14, fontWeight: isToday || isSelected ? 700 : 400 }}>
                        {day.getDate()}
                      </div>
                      {dayBookings.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 4 }}>
                          {hasPending && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF9800' }} />}
                          {hasConfirmed && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50' }} />}
                          {dayBookings.length > 2 && (
                            <span style={{ fontSize: 9, color: isSelected ? '#000' : '#888' }}>
                              +{dayBookings.length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16, fontSize: 12, color: '#888' }}>
            <span>🟠 Chờ xác nhận</span>
            <span>🟢 Đã xác nhận</span>
            <span>🔵 Hoàn thành</span>
          </div>
        </div>

        {/* Side panel — selected date */}
        <div className="p-card" style={{ padding: 24, maxHeight: 520, overflowY: 'auto' }}>
          {selectedDate ? (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                📋 Ngày {new Date(selectedDate).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              {selectedBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  Không có booking nào
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedBookings.map(b => (
                    <div key={b.id} style={{
                      padding: 14, borderRadius: 12,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {b.experience_title || 'Tour'}
                        </div>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: statusDot[b.status] || '#999',
                        }} />
                      </div>
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                        👤 {b.user_name || 'Khách'} • 👥 {b.guest_count || 1} khách
                      </div>
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                        🕐 {b.start_time || 'Chưa xác định'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>
                          {formatVND(b.total_price || 0)}
                        </span>
                        <span className={`p-badge ${
                          b.status === 'confirmed' ? 'green' :
                          b.status === 'completed' ? 'blue' :
                          b.status === 'cancelled' ? 'red' : 'yellow'
                        }`} style={{ fontSize: 11 }}>
                          {b.status === 'confirmed' ? '✅' :
                           b.status === 'completed' ? '🎉' :
                           b.status === 'cancelled' ? '❌' : '⏳'}
                          {' '}
                          {b.status === 'confirmed' ? 'Xác nhận' :
                           b.status === 'completed' ? 'Xong' :
                           b.status === 'cancelled' ? 'Huỷ' : 'Chờ'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <div>Chọn một ngày để xem chi tiết</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
