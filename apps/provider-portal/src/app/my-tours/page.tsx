'use client';

import { useState, useEffect, useCallback } from 'react';
import { providerApi } from '@/lib/api';

type Experience = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  duration_mins: number;
  max_guests: number;
  rating: number;
  rating_count: number;
  is_active: boolean;
  is_instant: boolean;
};

export default function MyToursPage() {
  const [tours, setTours] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTours = useCallback(async () => {
    setLoading(true);
    const res = await providerApi.getMyExperiences();
    if (res.success && res.data) setTours(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTours(); }, [fetchTours]);

  const handleDelete = async (tour: Experience) => {
    if (!confirm(`Xoá "${tour.title}"?`)) return;
    await providerApi.deleteExperience(tour.id);
    fetchTours();
  };

  const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';

  const categoryEmoji: Record<string, string> = {
    'food': '🍜', 'tour': '🏛️', 'experience': '🎭',
    'sightseeing': '📸', 'stay': '🏨', 'transport': '🚐',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>🏛️ Tours của tôi</h2>
        <button className="p-btn p-btn-primary">+ Tạo tour mới</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>⏳ Đang tải...</div>
      ) : tours.length === 0 ? (
        <div className="p-card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏛️</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Chưa có tour nào</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Bắt đầu tạo tour đầu tiên của bạn</p>
          <button className="p-btn p-btn-primary">+ Tạo tour mới</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {tours.map((tour) => (
            <div key={tour.id} className="p-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                height: 120, background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
                position: 'relative',
              }}>
                {categoryEmoji[tour.category] || '🏛️'}
                {tour.is_instant && (
                  <span style={{
                    position: 'absolute', top: 8, left: 8, background: 'var(--primary)',
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#000',
                  }}>⚡ Đặt ngay</span>
                )}
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  background: tour.is_active ? 'rgba(76,175,80,0.9)' : 'rgba(244,67,54,0.9)',
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#fff',
                }}>
                  {tour.is_active ? '● Active' : '● Inactive'}
                </span>
              </div>
              <div style={{ padding: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{tour.title}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span>⭐ {tour.rating?.toFixed(1)} ({tour.rating_count})</span>
                  <span>🕐 {tour.duration_mins} phút</span>
                  <span>👥 max {tour.max_guests}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{formatVND(tour.price)}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="p-btn" style={{ fontSize: 12 }}>✏️</button>
                    <button className="p-btn" onClick={() => handleDelete(tour)}
                      style={{ fontSize: 12, background: 'rgba(244,67,54,0.1)', color: '#F44336' }}>🗑️</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
