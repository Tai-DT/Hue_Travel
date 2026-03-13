'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

type ChatRoom = {
  id: string;
  participants: string[];
  room_type: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  participant_names?: string[];
  booking_id?: string;
};

type ChatMessage = {
  id: string;
  sender_name: string;
  content: string;
  message_type: string;
  created_at: string;
  is_read: boolean;
};

export default function SupportPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getChatRooms();
    if (res.success && res.data) {
      setRooms((res.data as any).rooms || res.data || []);
    }
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true);
    const res = await adminApi.getChatMessages(roomId);
    if (res.success && res.data) {
      setMessages((res.data as any).messages || res.data || []);
    }
    setLoadingMessages(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  useEffect(() => {
    if (selectedRoom) fetchMessages(selectedRoom);
  }, [selectedRoom, fetchMessages]);

  const formatTime = (d: string) => {
    try {
      const date = new Date(d);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      if (diff < 60000) return 'Vừa xong';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ`;
      return date.toLocaleDateString('vi-VN');
    } catch { return '—'; }
  };

  const filteredRooms = filter === 'unread'
    ? rooms.filter(r => r.unread_count > 0)
    : rooms;

  const totalUnread = rooms.reduce((s, r) => s + (r.unread_count || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>💬 Chat Support</h2>
          <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 14 }}>
            {rooms.length} phòng chat • {totalUnread} chưa đọc
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFilter('all')} className="btn"
            style={{
              background: filter === 'all' ? 'var(--primary)' : 'var(--card-bg)',
              color: filter === 'all' ? '#000' : 'var(--text)',
              fontWeight: filter === 'all' ? 700 : 400,
              border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px',
            }}>Tất cả</button>
          <button onClick={() => setFilter('unread')} className="btn"
            style={{
              background: filter === 'unread' ? 'var(--primary)' : 'var(--card-bg)',
              color: filter === 'unread' ? '#000' : 'var(--text)',
              fontWeight: filter === 'unread' ? 700 : 400,
              border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px',
            }}>
            🔴 Chưa đọc ({totalUnread})
          </button>
          <button onClick={fetchRooms} className="btn"
            style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px' }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, height: 600 }}>
        {/* Room list */}
        <div className="data-card" style={{ overflowY: 'auto', padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>⏳ Đang tải...</div>
          ) : filteredRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              {filter === 'unread' ? 'Không có tin nhắn chưa đọc' : 'Chưa có phòng chat nào'}
            </div>
          ) : (
            filteredRooms.map(room => (
              <div key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                style={{
                  padding: '14px 18px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: selectedRoom === room.id ? 'rgba(255,193,7,0.08)' : 'transparent',
                  transition: 'background 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14,
                      }}>
                        {(room.participant_names?.[0] || 'K')[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {room.participant_names?.join(', ') || `Phòng ${room.id.slice(0, 6)}`}
                        </div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          {room.room_type === 'booking' ? '📋 Booking' : '💬 Chat'}
                        </div>
                      </div>
                    </div>
                    {room.last_message && (
                      <div style={{
                        fontSize: 13, color: '#888', marginTop: 4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 240,
                      }}>
                        {room.last_message}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {room.last_message_at ? formatTime(room.last_message_at) : ''}
                    </div>
                    {room.unread_count > 0 && (
                      <div style={{
                        marginTop: 4, background: '#F44336', color: 'white',
                        borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                        display: 'inline-block',
                      }}>
                        {room.unread_count}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message panel */}
        <div className="data-card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          {!selectedRoom ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <div>Chọn một phòng chat để xem tin nhắn</div>
              </div>
            </div>
          ) : loadingMessages ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ⏳ Đang tải tin nhắn...
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                  Chưa có tin nhắn nào
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} style={{
                    display: 'flex', gap: 10,
                    alignSelf: msg.sender_name === 'Admin' ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                  }}>
                    {msg.sender_name !== 'Admin' && (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: '#4CAF50', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>
                        {msg.sender_name[0]}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                        {msg.sender_name} • {formatTime(msg.created_at)}
                      </div>
                      <div style={{
                        padding: '10px 14px', borderRadius: 12,
                        background: msg.sender_name === 'Admin'
                          ? 'rgba(255,193,7,0.15)'
                          : 'var(--bg)',
                        fontSize: 14,
                        borderBottomLeftRadius: msg.sender_name !== 'Admin' ? 2 : 12,
                        borderBottomRightRadius: msg.sender_name === 'Admin' ? 2 : 12,
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
