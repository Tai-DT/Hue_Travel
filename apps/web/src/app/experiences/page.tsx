'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

type Experience = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  duration_mins: number;
  rating: number;
  rating_count: number;
  max_guests: number;
  is_active: boolean;
  guide_name?: string;
  image_urls?: string[];
  created_at: string;
};

const CATEGORIES = [
  { value: 'tour', label: '🏛️ Tour di sản', emoji: '🏛️' },
  { value: 'food', label: '🍜 Ẩm thực', emoji: '🍜' },
  { value: 'experience', label: '🎭 Trải nghiệm', emoji: '🎭' },
  { value: 'sightseeing', label: '📸 Tham quan', emoji: '📸' },
  { value: 'stay', label: '🏨 Lưu trú', emoji: '🏨' },
  { value: 'transport', label: '🚐 Di chuyển', emoji: '🚐' },
] as const;

const getCategoryMeta = (category: string) =>
  CATEGORIES.find((item) => item.value === category) || { value: category, label: category || 'Khác', emoji: '📦' };

export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchExperiences = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getExperiences({ page, category });
    if (res.success && res.data) {
      setExperiences(res.data);
    }
    setLoading(false);
  }, [page, category]);

  useEffect(() => { fetchExperiences(); }, [fetchExperiences]);

  const handleDelete = async (exp: Experience) => {
    if (!confirm(`Xoá trải nghiệm "${exp.title}"?`)) return;
    await adminApi.deleteExperience(exp.id);
    fetchExperiences();
  };

  const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + '₫';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>🏛️ Quản lý trải nghiệm</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() => { setCategory(''); setPage(1); }}
            style={{ background: !category ? 'var(--primary)' : 'var(--card-bg)', color: !category ? '#000' : 'var(--text-primary)' }}
          >
            Tất cả
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className="btn"
              onClick={() => { setCategory(cat.value); setPage(1); }}
              style={{ background: category === cat.value ? 'var(--primary)' : 'var(--card-bg)', color: category === cat.value ? '#000' : 'var(--text-primary)' }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))', gap: 20 }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            ⏳ Đang tải...
          </div>
        ) : experiences.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            Không có trải nghiệm nào
          </div>
        ) : experiences.map((exp) => {
          const categoryMeta = getCategoryMeta(exp.category);

          return (
            <div key={exp.id} className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                height: 140,
                background: `linear-gradient(135deg, #1a1a2e, #16213e)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 48,
              }}>
                {categoryMeta.emoji}
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{exp.title}</h3>
                    <span style={{
                      background: 'var(--primary)', color: '#000',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    }}>{categoryMeta.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatVND(exp.price)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exp.duration_mins} phút</div>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                  {exp.description?.slice(0, 100)}...
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                    <span>⭐ {exp.rating?.toFixed(1) || '—'} ({exp.rating_count || 0})</span>
                    <span>👥 max {exp.max_guests || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className={`badge-status ${exp.is_active ? 'confirmed' : 'cancelled'}`} style={{ fontSize: 11 }}>
                      {exp.is_active ? '✅ Active' : '🚫 Inactive'}
                    </span>
                    <button className="btn" onClick={() => handleDelete(exp)}
                      style={{ background: '#F4433622', color: '#F44336', fontSize: 12 }}>
                      🗑️
                    </button>
                  </div>
                </div>

                {exp.guide_name && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    🧭 {exp.guide_name}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 24 }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Trước</button>
        <span style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>Trang {page}</span>
        <button className="btn" onClick={() => setPage(p => p + 1)}>Sau →</button>
      </div>
    </div>
  );
}
