'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

type Story = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  content?: string;
  media_urls: string[];
  media_type: string;
  location_name?: string;
  like_count: number;
  comment_count: number;
  created_at: string;
};

type Report = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description?: string;
  status: string;
  created_at: string;
};

export default function ContentModerationPage() {
  const [tab, setTab] = useState<'feed' | 'reports'>('feed');
  const [stories, setStories] = useState<Story[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.request<any>('/admin/stories');
      if (res.success && res.data) {
        setStories((res.data as any).stories || []);
      }
    } catch {
      setStories([]);
    }
    setLoading(false);
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.request<any>('/admin/reports?status=pending');
      if (res.success && res.data) {
        setReports((res.data as any).reports || []);
      }
    } catch {
      setReports([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'feed') fetchFeed();
    else fetchReports();
  }, [tab, fetchFeed, fetchReports]);

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('Xóa story này?')) return;
    await adminApi.request(`/admin/stories/${storyId}`, { method: 'DELETE' });
    fetchFeed();
  };

  const handleResolveReport = async (reportId: string, action: 'resolved' | 'dismissed') => {
    await adminApi.request(`/admin/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: action }),
    });
    fetchReports();
  };

  const reasonLabels: Record<string, string> = {
    spam: '🚫 Spam',
    harassment: '😡 Quấy rối',
    inappropriate: '⚠️ Nội dung không phù hợp',
    fake: '🤥 Giả mạo',
    other: '📝 Khác',
  };

  const targetLabels: Record<string, string> = {
    user: '👤 User',
    experience: '🏛️ Experience',
    review: '⭐ Review',
    blog: '📝 Blog',
    message: '💬 Message',
    story: '📸 Story',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>🛡️ Quản lý nội dung</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() => setTab('feed')}
            style={{
              background: tab === 'feed' ? 'var(--primary-bg)' : 'transparent',
              color: tab === 'feed' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: tab === 'feed' ? 700 : 400,
              border: tab === 'feed' ? '1px solid var(--primary)' : '1px solid var(--border)',
            }}
          >📸 Feed/Stories</button>
          <button
            className="btn"
            onClick={() => setTab('reports')}
            style={{
              background: tab === 'reports' ? '#F4433622' : 'transparent',
              color: tab === 'reports' ? '#F44336' : 'var(--text-secondary)',
              fontWeight: tab === 'reports' ? 700 : 400,
              border: tab === 'reports' ? '1px solid #F4433644' : '1px solid var(--border)',
            }}
          >🚨 Báo cáo {reports.length > 0 && `(${reports.length})`}</button>
        </div>
      </div>

      {tab === 'feed' ? (
        loading ? (
          <div className="data-card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            ⏳ Đang tải feed...
          </div>
        ) : stories.length === 0 ? (
          <div className="data-card" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <div style={{ color: 'var(--text-muted)' }}>Chưa có story nào</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {stories.map(story => (
              <div key={story.id} className="data-card" style={{ padding: 16, overflow: 'hidden' }}>
                {/* Author */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div className="user-avatar" style={{ background: '#42A5F5', color: 'white', width: 36, height: 36, minWidth: 36, fontSize: 14 }}>
                      {story.author_name?.[0] || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{story.author_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(story.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  <button className="btn" style={{ background: '#F4433611', color: '#F44336', fontSize: 12 }}
                    onClick={() => handleDeleteStory(story.id)}>🗑️</button>
                </div>

                {/* Content */}
                {story.content && (
                  <p style={{ marginBottom: 12, fontSize: 14, lineHeight: 1.5 }}>{story.content}</p>
                )}

                {/* Media */}
                {story.media_urls?.length > 0 && (
                  <div style={{
                    borderRadius: 12, overflow: 'hidden', marginBottom: 12,
                    background: 'var(--bg-secondary)', height: 180,
                  }}>
                    <img
                      src={story.media_urls[0]}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}

                {/* Location */}
                {story.location_name && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    📍 {story.location_name}
                  </div>
                )}

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>❤️ {story.like_count}</span>
                  <span>💬 {story.comment_count}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'monospace' }}>
                    {story.id.slice(0, 8)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Reports Tab */
        loading ? (
          <div className="data-card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            ⏳ Đang tải báo cáo...
          </div>
        ) : reports.length === 0 ? (
          <div className="data-card" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 16 }}>Không có báo cáo nào cần xử lý</div>
          </div>
        ) : (
          <div className="data-card">
            <table>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Mục tiêu</th>
                  <th>Lý do</th>
                  <th>Mô tả</th>
                  <th>Ngày</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.id}>
                    <td>{targetLabels[report.target_type] || report.target_type}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{report.target_id.slice(0, 8)}...</td>
                    <td>{reasonLabels[report.reason] || report.reason}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.description || '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {new Date(report.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn" style={{ background: '#4CAF5022', color: '#4CAF50', fontSize: 12 }}
                          onClick={() => handleResolveReport(report.id, 'resolved')}>
                          ✅ Xử lý
                        </button>
                        <button className="btn" style={{ background: '#9E9E9E22', color: '#9E9E9E', fontSize: 12 }}
                          onClick={() => handleResolveReport(report.id, 'dismissed')}>
                          ❎ Bỏ qua
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
