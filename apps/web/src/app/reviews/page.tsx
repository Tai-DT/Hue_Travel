'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

type Review = {
  id: string;
  traveler_name: string;
  experience_title: string;
  overall_rating: number;
  guide_rating: number;
  value_rating: number;
  comment: string;
  is_featured: boolean;
  created_at: string;
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'featured' | 'low'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string | number> = { page };
    if (filter === 'featured') params.featured = 1;
    if (filter === 'low') params.max_rating = 3;
    const res = await adminApi.getReviews(params);
    if (res.success && res.data) {
      setReviews(res.data);
      setTotal(res.meta?.total || res.data.length);
    }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return '—'; }
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
      <span style={{ color: '#FFC107', fontSize: 14, letterSpacing: 1 }}>
        {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
        <span style={{ color: '#666', fontSize: 12, marginLeft: 4 }}>{rating.toFixed(1)}</span>
      </span>
    );
  };

  const handleToggleFeatured = async (review: Review) => {
    await adminApi.toggleFeaturedReview(review.id, !review.is_featured);
    fetchReviews();
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm('Xoá đánh giá này?')) return;
    await adminApi.deleteReview(id);
    fetchReviews();
  };

  // Summary stats
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.overall_rating, 0) / reviews.length).toFixed(1) : '0';
  const featuredCount = reviews.filter(r => r.is_featured).length;
  const lowCount = reviews.filter(r => r.overall_rating < 3).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>⭐ Quản lý Đánh giá</h2>
          <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 14 }}>
            {total} đánh giá • TB {avgRating}⭐ • {featuredCount} nổi bật • {lowCount} thấp
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['all', 'Tất cả'], ['featured', '⭐ Nổi bật'], ['low', '⚠️ Đánh giá thấp']] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setFilter(k); setPage(1); }} className="btn"
              style={{
                background: filter === k ? 'var(--primary)' : 'var(--card-bg)',
                color: filter === k ? '#000' : 'var(--text)',
                fontWeight: filter === k ? 700 : 400,
                border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>⏳ Đang tải...</div>
      ) : reviews.length === 0 ? (
        <div className="data-card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
          <h3>Chưa có đánh giá nào</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map(r => (
            <div key={r.id} className="data-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 16,
                    }}>
                      {r.traveler_name?.[0] || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.traveler_name || 'Khách'}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        🏛️ {r.experience_title || '—'} • {formatDate(r.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Ratings */}
                  <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Tổng thể</div>
                      {renderStars(r.overall_rating)}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Hướng dẫn</div>
                      {renderStars(r.guide_rating)}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Giá trị</div>
                      {renderStars(r.value_rating)}
                    </div>
                  </div>

                  {r.comment && (
                    <div style={{
                      fontSize: 14, color: 'var(--text-secondary)',
                      background: 'var(--bg)', padding: 12, borderRadius: 10,
                      borderLeft: '3px solid var(--primary)', marginTop: 8,
                    }}>
                      "{r.comment}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                  <button onClick={() => handleToggleFeatured(r)}
                    className="btn" style={{
                      fontSize: 12, padding: '6px 12px', borderRadius: 6,
                      background: r.is_featured ? 'rgba(255,193,7,0.15)' : 'var(--card-bg)',
                      color: r.is_featured ? '#F57F17' : '#888',
                      border: '1px solid var(--border)',
                    }}>
                    {r.is_featured ? '⭐ Nổi bật' : '☆ Đánh dấu'}
                  </button>
                  <button onClick={() => handleDeleteReview(r.id)}
                    className="btn" style={{
                      fontSize: 12, padding: '6px 12px', borderRadius: 6,
                      background: 'rgba(244,67,54,0.08)', color: '#F44336',
                      border: '1px solid rgba(244,67,54,0.2)',
                    }}>
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8 }}>
            ← Trước
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: '#888' }}>
            Trang {page}/{Math.ceil(total / 20)}
          </span>
          <button className="btn" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8 }}>
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
