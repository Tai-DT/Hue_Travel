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
  meeting_point: string;
  meeting_lat: number;
  meeting_lng: number;
  includes?: string[];
  highlights?: string[];
  image_urls?: string[];
  rating: number;
  rating_count: number;
  is_active: boolean;
  is_instant: boolean;
};

type TourForm = {
  title: string;
  description: string;
  category: string;
  price: string;
  duration_mins: string;
  max_guests: string;
  meeting_point: string;
  meeting_lat: string;
  meeting_lng: string;
  includes: string;
  highlights: string;
  image_urls: string;
  is_instant: boolean;
  is_active: boolean;
};

const CATEGORY_OPTIONS = [
  { value: 'tour', label: '🏛️ Tour di sản' },
  { value: 'food', label: '🍜 Ẩm thực' },
  { value: 'experience', label: '🎭 Trải nghiệm' },
  { value: 'sightseeing', label: '📸 Tham quan' },
  { value: 'stay', label: '🏨 Lưu trú' },
  { value: 'transport', label: '🚐 Di chuyển' },
];

const EMPTY_FORM: TourForm = {
  title: '',
  description: '',
  category: 'tour',
  price: '250000',
  duration_mins: '180',
  max_guests: '8',
  meeting_point: '15 Lê Lợi, Huế',
  meeting_lat: '16.4637',
  meeting_lng: '107.5909',
  includes: '',
  highlights: '',
  image_urls: '',
  is_instant: false,
  is_active: true,
};

const splitList = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const toFormState = (tour: Experience): TourForm => ({
  title: tour.title || '',
  description: tour.description || '',
  category: tour.category || 'tour',
  price: String(tour.price || 0),
  duration_mins: String(tour.duration_mins || 60),
  max_guests: String(tour.max_guests || 1),
  meeting_point: tour.meeting_point || '',
  meeting_lat: String(tour.meeting_lat || 16.4637),
  meeting_lng: String(tour.meeting_lng || 107.5909),
  includes: (tour.includes || []).join(', '),
  highlights: (tour.highlights || []).join(', '),
  image_urls: (tour.image_urls || []).join(', '),
  is_instant: Boolean(tour.is_instant),
  is_active: Boolean(tour.is_active),
});

export default function MyToursPage() {
  const [tours, setTours] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [form, setForm] = useState<TourForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchTours = useCallback(async () => {
    setLoading(true);
    setError('');

    const meRes = await providerApi.getMe();
    if (!meRes.success || !meRes.data?.id) {
      setTours([]);
      setError(meRes.error?.message || 'Không thể xác định tài khoản guide');
      setLoading(false);
      return;
    }

    const res = await providerApi.getMyExperiences(meRes.data.id);
    if (res.success && res.data) {
      setTours(res.data);
    } else {
      setTours([]);
      setError(res.error?.message || 'Không thể tải danh sách tour');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTours(); }, [fetchTours]);

  const resetEditor = () => {
    setEditorOpen(false);
    setEditingTourId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const openCreate = () => {
    setEditingTourId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormSuccess('');
    setEditorOpen(true);
  };

  const openEdit = (tour: Experience) => {
    setEditingTourId(tour.id);
    setForm(toFormState(tour));
    setFormError('');
    setFormSuccess('');
    setEditorOpen(true);
  };

  const updateForm = <K extends keyof TourForm>(key: K, value: TourForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      price: Number(form.price),
      duration_mins: Number(form.duration_mins),
      max_guests: Number(form.max_guests),
      meeting_point: form.meeting_point.trim(),
      meeting_lat: Number(form.meeting_lat),
      meeting_lng: Number(form.meeting_lng),
      includes: splitList(form.includes),
      highlights: splitList(form.highlights),
      image_urls: splitList(form.image_urls),
      is_instant: form.is_instant,
      is_active: form.is_active,
    };

    if (!payload.title || !payload.description || !payload.meeting_point) {
      setFormError('Vui lòng nhập đủ tiêu đề, mô tả và điểm hẹn.');
      setSubmitting(false);
      return;
    }

    if (payload.price < 10000 || payload.duration_mins < 30 || payload.max_guests < 1) {
      setFormError('Giá tối thiểu là 10.000đ, thời lượng tối thiểu 30 phút và số khách phải lớn hơn 0.');
      setSubmitting(false);
      return;
    }

    if (!Number.isFinite(payload.meeting_lat) || !Number.isFinite(payload.meeting_lng)) {
      setFormError('Toạ độ điểm hẹn không hợp lệ.');
      setSubmitting(false);
      return;
    }

    const result = editingTourId
      ? await providerApi.updateExperience(editingTourId, payload)
      : await providerApi.createExperience({
          ...payload,
          is_active: undefined,
        });

    setSubmitting(false);

    if (!result.success) {
      setFormError(result.error?.message || 'Không thể lưu tour');
      return;
    }

    setFormSuccess(editingTourId ? 'Đã cập nhật tour.' : 'Đã tạo tour mới.');
    await fetchTours();
    if (!editingTourId) {
      setForm(EMPTY_FORM);
    }
    setEditorOpen(false);
    setEditingTourId(null);
  };

  const handleDelete = async (tour: Experience) => {
    if (!confirm(`Xoá "${tour.title}"?`)) return;
    await providerApi.deleteExperience(tour.id);
    if (editingTourId === tour.id) {
      resetEditor();
    }
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
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>🏛️ Tours của tôi</h2>
          <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
            Danh sách này giờ chỉ hiển thị tour thuộc tài khoản guide hiện tại.
          </p>
        </div>
        <button className="p-btn p-btn-primary" onClick={openCreate}>
          + Tạo tour mới
        </button>
      </div>

      {formSuccess ? (
        <div className="p-card" style={{ padding: 16, marginBottom: 16, color: '#4CAF50' }}>
          {formSuccess}
        </div>
      ) : null}

      {editorOpen ? (
        <div className="p-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                {editingTourId ? '✏️ Chỉnh sửa tour' : '✨ Tạo tour mới'}
              </h3>
              <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 14 }}>
                Nhập thông tin cốt lõi để guide có thể publish tour ngay trên hệ thống.
              </p>
            </div>
            <button className="p-btn" onClick={resetEditor}>Đóng</button>
          </div>

          {formError ? (
            <div style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(239,83,80,0.08)',
              color: '#EF5350',
            }}>
              {formError}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Tiêu đề tour
              </label>
              <input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Tour ẩm thực đêm Huế"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Mô tả
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={4}
                placeholder="Mô tả trải nghiệm, hành trình, điểm khác biệt..."
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', resize: 'vertical',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Danh mục
              </label>
              <select
                value={form.category}
                onChange={(e) => updateForm('category', e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text)',
                }}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Giá mỗi khách (VND)
              </label>
              <input
                type="number"
                min={10000}
                value={form.price}
                onChange={(e) => updateForm('price', e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Thời lượng (phút)
              </label>
              <input
                type="number"
                min={30}
                value={form.duration_mins}
                onChange={(e) => updateForm('duration_mins', e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Số khách tối đa
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.max_guests}
                onChange={(e) => updateForm('max_guests', e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Điểm hẹn
              </label>
              <input
                value={form.meeting_point}
                onChange={(e) => updateForm('meeting_point', e.target.value)}
                placeholder="15 Lê Lợi, Huế"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={form.meeting_lat}
                onChange={(e) => updateForm('meeting_lat', e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={form.meeting_lng}
                onChange={(e) => updateForm('meeting_lng', e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Bao gồm
              </label>
              <textarea
                value={form.includes}
                onChange={(e) => updateForm('includes', e.target.value)}
                rows={2}
                placeholder="Đồ ăn, nước uống, vé tham quan"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Điểm nổi bật
              </label>
              <textarea
                value={form.highlights}
                onChange={(e) => updateForm('highlights', e.target.value)}
                rows={2}
                placeholder="Guide bản địa, lịch trình tối ưu, chụp ảnh đẹp"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Image URLs
              </label>
              <textarea
                value={form.image_urls}
                onChange={(e) => updateForm('image_urls', e.target.value)}
                rows={2}
                placeholder="https://..., https://..."
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={form.is_instant}
                onChange={(e) => updateForm('is_instant', e.target.checked)}
              />
              Cho phép đặt ngay
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => updateForm('is_active', e.target.checked)}
              />
              Đang mở bán
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button className="p-btn" onClick={resetEditor} disabled={submitting}>Huỷ</button>
            <button className="p-btn p-btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '⏳ Đang lưu...' : editingTourId ? '💾 Lưu thay đổi' : '✨ Tạo tour'}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>⏳ Đang tải...</div>
      ) : error ? (
        <div className="p-card" style={{ textAlign: 'center', padding: 40, color: '#F44336' }}>
          {error}
        </div>
      ) : tours.length === 0 ? (
        <div className="p-card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏛️</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Chưa có tour nào</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Bắt đầu tạo tour đầu tiên của bạn</p>
          <button className="p-btn p-btn-primary" onClick={openCreate}>
            + Tạo tour mới
          </button>
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
                    <button className="p-btn" style={{ fontSize: 12 }} onClick={() => openEdit(tour)}>
                      ✏️
                    </button>
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
