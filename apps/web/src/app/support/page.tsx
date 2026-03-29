'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { adminApi } from '@/lib/api';

type ChatParticipant = {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
};

type ChatRoom = {
  id: string;
  participants: string[];
  room_type: string;
  group_name?: string;
  participant_names?: string[];
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  booking_id?: string;
  other_participant?: ChatParticipant;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: string;
  created_at: string;
  is_read: boolean;
};

type ChatSocketPayload = {
  type: string;
  room_id?: string;
  sender_id?: string;
  content?: string;
  data?: ChatMessage;
};

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getRoomLabel(room: ChatRoom) {
  if (room.group_name) return room.group_name;
  if (room.other_participant?.full_name) return room.other_participant.full_name;
  if (room.participant_names?.length) return room.participant_names.join(', ');
  return `Phòng ${room.id.slice(0, 6)}`;
}

function getRoomInitial(room: ChatRoom) {
  return getRoomLabel(room).trim().charAt(0).toUpperCase() || 'K';
}

export default function SupportPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [currentAdminName, setCurrentAdminName] = useState('');
  const [currentAdminId, setCurrentAdminId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const selectedRoomIdRef = useRef<string | null>(null);
  const currentAdminIdRef = useRef('');

  const fetchRooms = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);

    const res = await adminApi.getChatRooms();
    if (res.success && res.data) {
      const payload = res.data as any;
      setRooms(toArray<ChatRoom>(payload?.rooms ?? payload));
      setError('');
    } else {
      setRooms([]);
      setError(res.error?.message || 'Không thể tải danh sách chat');
    }

    setLoading(false);
  }, []);

  const fetchAdminProfile = useCallback(async () => {
    const res = await adminApi.getMe();
    if (res.success && res.data) {
      const profile = res.data as any;
      setCurrentAdminId(profile.id || '');
      setCurrentAdminName(profile.full_name || profile.email || 'Admin');
    }
  }, []);

  const fetchMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true);

    const res = await adminApi.getChatMessages(roomId);
    if (res.success && res.data) {
      const payload = res.data as any;
      setMessages(toArray<ChatMessage>(payload?.messages ?? payload).slice().reverse());
      setError('');
      await fetchRooms(false);
    } else {
      setMessages([]);
      setError(res.error?.message || 'Không thể tải tin nhắn');
    }

    setLoadingMessages(false);
  }, [fetchRooms]);

  const markRoomRead = useCallback(async (roomId: string) => {
    const res = await adminApi.markChatRead(roomId);
    if (!res.success) return;

    setRooms((prev) => prev.map((room) => (
      room.id === roomId ? { ...room, unread_count: 0 } : room
    )));
  }, []);

  useEffect(() => {
    void fetchRooms();
    void fetchAdminProfile();
  }, [fetchAdminProfile, fetchRooms]);

  useEffect(() => {
    if (!selectedRoomId) return;

    setDraft('');
    void fetchMessages(selectedRoomId);
  }, [fetchMessages, selectedRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    currentAdminIdRef.current = currentAdminId;
  }, [currentAdminId]);

  useEffect(() => {
    if (!selectedRoomId) return;

    const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
    if (!selectedRoom || selectedRoom.unread_count <= 0) return;

    void markRoomRead(selectedRoomId);
  }, [markRoomRead, rooms, selectedRoomId]);

  const upsertLiveRoomState = useCallback((roomId: string, message: ChatMessage, unreadDelta: number) => {
    setRooms((prev) => {
      const nextRooms = [...prev];
      const roomIndex = nextRooms.findIndex((room) => room.id === roomId);
      if (roomIndex === -1) {
        void fetchRooms(false);
        return prev;
      }

      const [room] = nextRooms.splice(roomIndex, 1);
      nextRooms.unshift({
        ...room,
        last_message: message.content,
        last_message_at: message.created_at,
        unread_count: Math.max(0, (room.unread_count || 0) + unreadDelta),
      });
      return nextRooms;
    });
  }, [fetchRooms]);

  const handleSocketEvent = useCallback((payload: ChatSocketPayload) => {
    if (payload.type !== 'message' || !payload.room_id || !payload.data) return;

    const incoming = payload.data;
    const isOwnMessage = Boolean(currentAdminIdRef.current) && incoming.sender_id === currentAdminIdRef.current;
    const isSelectedRoom = selectedRoomIdRef.current === payload.room_id;

    if (isSelectedRoom) {
      setMessages((prev) => (
        prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]
      ));

      if (!isOwnMessage) {
        void adminApi.markChatRead(payload.room_id);
      }
    }

    if (isSelectedRoom) {
      upsertLiveRoomState(payload.room_id, incoming, 0);
      return;
    }

    upsertLiveRoomState(payload.room_id, incoming, isOwnMessage ? 0 : 1);
  }, [upsertLiveRoomState]);

  useEffect(() => {
    const socketUrl = adminApi.getWebSocketUrl();
    if (!socketUrl || typeof window === 'undefined') return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          handleSocketEvent(JSON.parse(event.data) as ChatSocketPayload);
        } catch {
          // Ignore malformed payloads.
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (!cancelled) {
          reconnectTimerRef.current = window.setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [handleSocketEvent]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedRoomId || !draft.trim() || sending) return;

    setSending(true);
    const content = draft.trim();
    const res = await adminApi.sendChatMessage(selectedRoomId, content);
    setSending(false);

    if (res.success && res.data) {
      const payload = res.data as any;
      const nextMessage = payload?.message as ChatMessage | undefined;
      if (nextMessage) {
        setMessages((prev) => [...prev, nextMessage]);
      }
      setDraft('');
      setError('');
      await fetchRooms(false);
      return;
    }

    setError(res.error?.message || 'Không thể gửi tin nhắn');
  }, [draft, fetchRooms, selectedRoomId, sending]);

  const formatTime = (value: string) => {
    try {
      const date = new Date(value);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      if (diff < 60000) return 'Vừa xong';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ`;
      return date.toLocaleDateString('vi-VN');
    } catch {
      return '—';
    }
  };

  const filteredRooms = filter === 'unread'
    ? rooms.filter((room) => room.unread_count > 0)
    : rooms;

  const totalUnread = rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;

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
          <button
            onClick={() => setFilter('all')}
            className="btn"
            style={{
              background: filter === 'all' ? 'var(--primary)' : 'var(--card-bg)',
              color: filter === 'all' ? '#000' : 'var(--text)',
              fontWeight: filter === 'all' ? 700 : 400,
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 16px',
            }}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilter('unread')}
            className="btn"
            style={{
              background: filter === 'unread' ? 'var(--primary)' : 'var(--card-bg)',
              color: filter === 'unread' ? '#000' : 'var(--text)',
              fontWeight: filter === 'unread' ? 700 : 400,
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 16px',
            }}
          >
            🔴 Chưa đọc ({totalUnread})
          </button>
          <button
            onClick={() => void fetchRooms()}
            className="btn"
            style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(244, 67, 54, 0.25)',
            background: 'rgba(244, 67, 54, 0.08)',
            color: '#ff8a80',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, height: 640 }}>
        <div className="data-card" style={{ overflowY: 'auto', padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>⏳ Đang tải...</div>
          ) : filteredRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              {filter === 'unread' ? 'Không có tin nhắn chưa đọc' : 'Chưa có phòng chat nào'}
            </div>
          ) : (
            filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                style={{
                  padding: '14px 18px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: selectedRoomId === room.id ? 'rgba(255,193,7,0.08)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {getRoomInitial(room)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{getRoomLabel(room)}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          {room.room_type === 'group'
                            ? '👥 Nhóm'
                            : room.other_participant?.role === 'guide'
                            ? '🧭 Guide'
                            : room.room_type === 'booking'
                              ? '📋 Booking'
                              : '💬 Chat'}
                        </div>
                      </div>
                    </div>
                    {room.last_message ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: '#888',
                          marginTop: 4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 240,
                        }}
                      >
                        {room.last_message}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {room.last_message_at ? formatTime(room.last_message_at) : ''}
                    </div>
                    {room.unread_count > 0 ? (
                      <div
                        style={{
                          marginTop: 4,
                          background: '#F44336',
                          color: 'white',
                          borderRadius: 10,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-block',
                        }}
                      >
                        {room.unread_count}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="data-card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          {!selectedRoom ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <div>Chọn một phòng chat để xem tin nhắn</div>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '18px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {getRoomInitial(selectedRoom)}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{getRoomLabel(selectedRoom)}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {selectedRoom.other_participant?.role === 'guide' ? 'Guide Huế Travel' : 'Khách hàng'}
                  </div>
                </div>
              </div>

              {loadingMessages ? (
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
                    messages.map((msg) => {
                      const isOwnMessage = currentAdminId
                        ? msg.sender_id === currentAdminId
                        : currentAdminName
                          ? msg.sender_name === currentAdminName
                          : /admin/i.test(msg.sender_name);

                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                            maxWidth: '70%',
                          }}
                        >
                          {!isOwnMessage ? (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#4CAF50',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {msg.sender_name[0]}
                            </div>
                          ) : null}
                          <div>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                              {msg.sender_name} • {formatTime(msg.created_at)}
                            </div>
                            <div
                              style={{
                                padding: '10px 14px',
                                borderRadius: 12,
                                background: isOwnMessage ? 'rgba(255,193,7,0.15)' : 'var(--bg)',
                                fontSize: 14,
                                borderBottomLeftRadius: !isOwnMessage ? 2 : 12,
                                borderBottomRightRadius: isOwnMessage ? 2 : 12,
                              }}
                            >
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}

              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  padding: 16,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-end',
                }}
              >
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Nhập phản hồi cho khách..."
                  rows={2}
                  style={{
                    flex: 1,
                    resize: 'none',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    padding: '12px 14px',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => void handleSendMessage()}
                  disabled={!draft.trim() || sending}
                  style={{
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 18px',
                    background: !draft.trim() || sending ? 'rgba(255,193,7,0.35)' : 'var(--primary)',
                    color: '#000',
                    fontWeight: 700,
                    cursor: !draft.trim() || sending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {sending ? 'Đang gửi...' : 'Gửi'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
