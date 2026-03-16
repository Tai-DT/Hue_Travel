'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

type GuideApp = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email?: string;
  specialties: string[];
  experience_years: number;
  languages: string[];
  bio?: string;
  status: string;
  admin_note?: string;
  created_at: string;
};

export default function GuideAppsPage() {
  const [apps, setApps] = useState<GuideApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [reviewModal, setReviewModal] = useState<GuideApp | null>(null);
  const [note, setNote] = useState('');

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.request(`/admin/guide-applications?status=${statusFilter}`);
      if (res.success && res.data) {
        setApps((res.data as { applications?: GuideApp[] }).applications || []);
      }
    } catch {
      // API might return from the existing pending endpoint
      const res = await adminApi.request('/guide-apply/my');
      setApps([]);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleApprove = async (app: GuideApp) => {
    if (!confirm(`Duyệt đơn của ${app.full_name}?`)) return;
    await adminApi.request(`/admin/guide-applications/${app.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    setReviewModal(null);
    setNote('');
    fetchApps();
  };

  const handleReject = async (app: GuideApp) => {
    if (!confirm(`Từ chối đơn của ${app.full_name}?`)) return;
    await adminApi.request(`/admin/guide-applications/${app.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    setReviewModal(null);
    setNote('');
    fetchApps();
  };

  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: '#FF980022', color: '#FF9800', label: '⏳ Chờ duyệt' },
    approved: { bg: '#4CAF5022', color: '#4CAF50', label: '✅ Đã duyệt' },
    rejected: { bg: '#F4433622', color: '#F44336', label: '❌ Từ chối' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>📋 Đơn đăng ký Guide</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pending', 'approved', 'rejected'].map(s => (
            <button
              key={s}
              className="btn"
              onClick={() => setStatusFilter(s)}
              style={{
                background: statusFilter === s ? statusColors[s].color + '22' : 'transparent',
                color: statusFilter === s ? statusColors[s].color : 'var(--text-secondary)',
                border: statusFilter === s ? `1px solid ${statusColors[s].color}44` : '1px solid var(--border)',
                fontWeight: statusFilter === s ? 700 : 400,
              }}
            >
              {statusColors[s].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="data-card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          ⏳ Đang tải đơn đăng ký...
        </div>
      ) : apps.length === 0 ? (
        <div className="data-card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            {statusFilter === 'pending' ? 'Không có đơn nào chờ duyệt' : `Không có đơn ${statusFilter}`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380, 1fr))', gap: 16 }}>
          {apps.map(app => {
            const sc = statusColors[app.status] || statusColors.pending;
            return (
              <div key={app.id} className="data-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="user-avatar" style={{ background: '#4CAF50', color: 'white', width: 48, height: 48, minWidth: 48, fontSize: 18 }}>
                      {app.full_name?.[0] || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{app.full_name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{app.phone}</div>
                    </div>
                  </div>
                  <span style={{
                    background: sc.bg, color: sc.color,
                    padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    alignSelf: 'flex-start',
                  }}>{sc.label}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kinh nghiệm</div>
                    <div style={{ fontWeight: 600 }}>{app.experience_years} năm</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ngôn ngữ</div>
                    <div style={{ fontWeight: 600 }}>{(app.languages || []).join(', ') || 'vi'}</div>
                  </div>
                </div>

                {app.specialties?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {app.specialties.map(s => (
                      <span key={s} style={{
                        background: 'var(--primary-bg)', color: 'var(--primary)',
                        padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                      }}>{s}</span>
                    ))}
                  </div>
                )}

                {app.bio && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
                    {app.bio.length > 100 ? app.bio.slice(0, 100) + '...' : app.bio}
                  </p>
                )}

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  📅 {new Date(app.created_at).toLocaleDateString('vi-VN')}
                </div>

                {app.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ flex: 1, background: '#4CAF5022', color: '#4CAF50', fontWeight: 600 }}
                      onClick={() => setReviewModal(app)}>
                      ✅ Duyệt
                    </button>
                    <button className="btn" style={{ flex: 1, background: '#F4433622', color: '#F44336', fontWeight: 600 }}
                      onClick={() => { setReviewModal(app); }}>
                      ❌ Từ chối
                    </button>
                  </div>
                )}

                {app.admin_note && (
                  <div style={{
                    background: 'var(--bg-secondary)', borderRadius: 8, padding: 8, marginTop: 8,
                    fontSize: 13, color: 'var(--text-secondary)',
                  }}>
                    💬 {app.admin_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setReviewModal(null)}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: 440,
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
              Đánh giá đơn — {reviewModal.full_name}
            </h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú cho ứng viên (không bắt buộc)..."
              style={{
                width: '100%', minHeight: 100, background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: 8, padding: 12,
                color: 'var(--text-primary)', resize: 'vertical', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" style={{ flex: 1, background: '#4CAF50', color: 'white', fontWeight: 700, padding: '12px 16px' }}
                onClick={() => handleApprove(reviewModal)}>
                ✅ Duyệt đơn
              </button>
              <button className="btn" style={{ flex: 1, background: '#F44336', color: 'white', fontWeight: 700, padding: '12px 16px' }}
                onClick={() => handleReject(reviewModal)}>
                ❌ Từ chối
              </button>
              <button className="btn" style={{ flex: 1 }}
                onClick={() => { setReviewModal(null); setNote(''); }}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
