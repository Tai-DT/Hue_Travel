'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

type User = {
  id: string;
  phone: string;
  email?: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  is_active: boolean;
  xp: number;
  level: string;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getUsers({ search, role: roleFilter, page });
    if (res.success && res.data) {
      setUsers(res.data);
    }
    setLoading(false);
  }, [search, roleFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleBan = async (user: User) => {
    if (!confirm(`${user.is_active ? 'Ban' : 'Unban'} ${user.full_name}?`)) return;
    await adminApi.banUser(user.id, !user.is_active);
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, role: string) => {
    await adminApi.changeRole(userId, role);
    fetchUsers();
  };

  const roleColors: Record<string, string> = {
    admin: '#F44336',
    guide: '#4CAF50',
    traveler: '#42A5F5',
    blogger: '#E040FB',
    merchant: '#FF9800',
    expert: '#00BCD4',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>👥 Quản lý người dùng</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="topbar-search">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Tìm theo tên, SĐT..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value="">Tất cả vai trò</option>
            <option value="admin">Admin</option>
            <option value="guide">Hướng dẫn viên</option>
            <option value="traveler">Du khách</option>
            <option value="blogger">Blogger</option>
            <option value="merchant">Merchant</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="data-card">
        <table>
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Vai trò</th>
              <th>Level</th>
              <th>XP</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                ⏳ Đang tải...
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Không tìm thấy người dùng
              </td></tr>
            ) : users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar" style={{
                      background: roleColors[user.role] || '#666',
                      color: 'white',
                    }}>
                      {user.full_name?.[0] || '?'}
                    </div>
                    <div>
                      <div className="user-name">{user.full_name}</div>
                      <div className="user-email">{user.phone || user.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    style={{
                      background: roleColors[user.role] + '22',
                      color: roleColors[user.role],
                      border: `1px solid ${roleColors[user.role]}44`,
                      borderRadius: 6, padding: '4px 8px', fontWeight: 600, fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="traveler">Du khách</option>
                    <option value="guide">Hướng dẫn viên</option>
                    <option value="blogger">Blogger</option>
                    <option value="merchant">Merchant</option>
                    <option value="expert">Expert</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td><span style={{ fontWeight: 600 }}>{user.level}</span></td>
                <td style={{ color: 'var(--primary)' }}>{user.xp} XP</td>
                <td>
                  <span className={`badge-status ${user.is_active ? 'confirmed' : 'cancelled'}`}>
                    {user.is_active ? '✅ Active' : '🚫 Banned'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => setSelectedUser(user)}>👁️</button>
                    <button
                      className="btn"
                      onClick={() => handleBan(user)}
                      style={{
                        background: user.is_active ? '#F4433622' : '#4CAF5022',
                        color: user.is_active ? '#F44336' : '#4CAF50',
                      }}
                    >
                      {user.is_active ? '🚫' : '✅'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Trước</button>
          <span style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>Trang {page}</span>
          <button className="btn" onClick={() => setPage(p => p + 1)}>Sau →</button>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setSelectedUser(null)}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: 480,
            maxHeight: '80vh', overflow: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Chi tiết người dùng</h2>
              <button onClick={() => setSelectedUser(null)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)',
              }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <div className="user-avatar" style={{
                width: 64, height: 64, fontSize: 24, minWidth: 64,
                background: roleColors[selectedUser.role], color: 'white',
              }}>
                {selectedUser.full_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedUser.full_name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedUser.phone || selectedUser.email}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{
                    background: roleColors[selectedUser.role] + '22',
                    color: roleColors[selectedUser.role],
                    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                  }}>{selectedUser.role}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['ID', selectedUser.id.slice(0, 8) + '...'],
                ['Level', selectedUser.level],
                ['XP', `${selectedUser.xp} XP`],
                ['Status', selectedUser.is_active ? '✅ Active' : '🚫 Banned'],
              ].map(([label, value]) => (
                <div key={label} style={{
                  background: 'var(--bg-secondary)', borderRadius: 8, padding: 12,
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
