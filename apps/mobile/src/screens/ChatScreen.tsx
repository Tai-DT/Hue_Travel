import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, {
  ChatMessage as APIChatMessage,
  ChatRoom as APIChatRoom,
} from '@/services/api';

type ChatRoom = {
  id: string;
  room_type: string;
  other_name: string;
  other_avatar?: string;
  other_role: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: string;
  is_mine: boolean;
  created_at: string;
};

type ChatSocketPayload = {
  type: string;
  room_id?: string;
  sender_id?: string;
  content?: string;
  data?: APIChatMessage;
};

function formatRelativeTime(value?: string) {
  if (!value) return 'Vừa xong';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
}

function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function normalizeRoom(room: APIChatRoom): ChatRoom {
  const fallbackGroupName = room.participant_names?.length
    ? room.participant_names.join(', ')
    : 'Nhóm chuyến đi';

  return {
    id: room.id,
    room_type: room.room_type,
    other_name: room.group_name || room.other_participant?.full_name || fallbackGroupName,
    other_avatar: room.other_participant?.avatar_url,
    other_role: room.other_participant?.role || 'support',
    last_message: room.last_message,
    last_message_time: formatRelativeTime(room.last_message_at || room.updated_at),
    unread_count: room.unread_count || 0,
  };
}

function normalizeMessage(message: APIChatMessage, currentUserId: string | null): ChatMessage {
  return {
    id: message.id,
    sender_id: message.sender_id,
    sender_name: message.sender_name,
    content: message.content,
    message_type: message.message_type,
    is_mine: currentUserId === message.sender_id,
    created_at: formatClock(message.created_at),
  };
}

function getConversationStatusLabel(roomType: string, role: string) {
  if (roomType === 'group') return 'Nhóm chuyến đi';
  if (role === 'guide') return 'Guide Huế Travel';
  if (role === 'traveler') return 'Bạn bè';
  return 'Hỗ trợ';
}

type ChatScreenProps = {
  recipientUserId?: string | null;
  initialRoomId?: string | null;
};

export default function ChatScreen({ recipientUserId = null, initialRoomId = null }: ChatScreenProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const scrollRef = useRef<FlatList>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRoomIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const filteredRooms = useMemo(
    () => rooms.filter((room) => room.other_name.toLowerCase().includes(search.trim().toLowerCase())),
    [rooms, search]
  );

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    const [meResult, roomsResult] = await Promise.all([api.getMe(), api.getChatRooms()]);

    if (meResult.success && meResult.data) {
      const me = (meResult.data as any).user || meResult.data;
      setCurrentUserId(me.id);
    }

    if (roomsResult.success && roomsResult.data?.rooms) {
      setRooms(roomsResult.data.rooms.map(normalizeRoom));
      setError('');
    } else {
      setError(roomsResult.error?.message || 'Không thể tải danh sách chat');
    }

    setLoadingRooms(false);
  }, []);

  const loadMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true);

    const result = await api.getChatMessages(roomId);
    const activeRoomId = selectedRoomIdRef.current;
    if (activeRoomId && activeRoomId !== roomId) return;

    if (result.success && result.data?.messages) {
      const normalized = [...result.data.messages]
        .reverse()
        .map((item) => normalizeMessage(item, currentUserId));
      setMessages(normalized);
      setError('');
    } else {
      setError(result.error?.message || 'Không thể tải tin nhắn');
    }

    setLoadingMessages(false);
    setTimeout(() => scrollRef.current?.scrollToEnd(), 80);
  }, [currentUserId]);

  const markRoomRead = useCallback(async (roomId: string) => {
    const result = await api.markChatRead(roomId);
    if (!result.success) return;

    setRooms((prev) => prev.map((room) => (
      room.id === roomId ? { ...room, unread_count: 0 } : room
    )));
    setSelectedRoom((prev) => (
      prev?.id === roomId ? { ...prev, unread_count: 0 } : prev
    ));
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedRoom.id);
  }, [loadMessages, selectedRoom]);

  useEffect(() => {
    if (!selectedRoom?.id || selectedRoom.unread_count <= 0) return;
    void markRoomRead(selectedRoom.id);
  }, [markRoomRead, selectedRoom]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoom?.id || null;
  }, [selectedRoom]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!recipientUserId) return;

    let cancelled = false;

    (async () => {
      setLoadingRooms(true);
      const roomResult = await api.getOrCreateRoom(recipientUserId);
      if (cancelled) return;

      if (roomResult.success && roomResult.data?.room) {
        const nextRoom = normalizeRoom(roomResult.data.room);
        setRooms((prev) => {
          const existing = prev.filter((room) => room.id !== nextRoom.id);
          return [nextRoom, ...existing];
        });
        setSelectedRoom(nextRoom);
        setError('');
      } else {
        setError(roomResult.error?.message || 'Không thể mở cuộc trò chuyện');
      }

      setLoadingRooms(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [recipientUserId]);

  useEffect(() => {
    if (!initialRoomId || rooms.length === 0) return;
    if (selectedRoom?.id === initialRoomId) return;

    const room = rooms.find((item) => item.id === initialRoomId);
    if (room) {
      setSelectedRoom(room);
      setError('');
    }
  }, [initialRoomId, rooms, selectedRoom?.id]);

  const upsertRoomPreview = useCallback((roomId: string, incoming: APIChatMessage, unreadDelta: number) => {
    setRooms((prev) => {
      const nextRooms = [...prev];
      const roomIndex = nextRooms.findIndex((room) => room.id === roomId);

      if (roomIndex === -1) {
        void loadRooms();
        return prev;
      }

      const [room] = nextRooms.splice(roomIndex, 1);
      nextRooms.unshift({
        ...room,
        last_message: incoming.content,
        last_message_time: formatRelativeTime(incoming.created_at),
        unread_count: Math.max(0, (room.unread_count || 0) + unreadDelta),
      });
      return nextRooms;
    });
  }, [loadRooms]);

  const handleSocketEvent = useCallback((payload: ChatSocketPayload) => {
    if (payload.type !== 'message' || !payload.room_id || !payload.data) return;

    const incoming = payload.data;
    const isOwnMessage = Boolean(currentUserIdRef.current) && incoming.sender_id === currentUserIdRef.current;
    const isSelectedRoom = selectedRoomIdRef.current === payload.room_id;

    if (isSelectedRoom) {
      const normalized = normalizeMessage(incoming, currentUserIdRef.current);
      setMessages((prev) => (
        prev.some((item) => item.id === normalized.id) ? prev : [...prev, normalized]
      ));

      if (!isOwnMessage) {
        void api.markChatRead(payload.room_id);
      }
    }

    if (isSelectedRoom) {
      upsertRoomPreview(payload.room_id, incoming, 0);
      return;
    }

    upsertRoomPreview(payload.room_id, incoming, isOwnMessage ? 0 : 1);
  }, [upsertRoomPreview]);

  useEffect(() => {
    const socketUrl = api.getWebSocketUrl();
    if (!socketUrl) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        const roomId = selectedRoomIdRef.current;
        if (roomId) {
          socket.send(JSON.stringify({ type: 'join', room_id: roomId }));
        }
      };

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
          reconnectTimerRef.current = setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [handleSocketEvent]);

  useEffect(() => {
    const roomId = selectedRoom?.id;
    const socket = socketRef.current;
    if (!roomId || !socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({ type: 'join', room_id: roomId }));

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'leave', room_id: roomId }));
      }
    };
  }, [selectedRoom?.id]);

  const sendMessage = async () => {
    if (!selectedRoom || !message.trim() || sending) return;

    setSending(true);
    const result = await api.sendChatMessage(selectedRoom.id, message.trim());
    setSending(false);

    if (result.success && result.data?.message) {
      const normalized = normalizeMessage(result.data.message, currentUserId);
      setMessages((prev) => (
        prev.some((item) => item.id === normalized.id) ? prev : [...prev, normalized]
      ));
      setMessage('');
      setTimeout(() => scrollRef.current?.scrollToEnd(), 80);
      await loadRooms();
      return;
    }

    setError(result.error?.message || 'Không thể gửi tin nhắn');
  };

  if (selectedRoom) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.convHeader}>
          <TouchableOpacity onPress={() => setSelectedRoom(null)} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.convHeaderAvatar}>
            <Text style={styles.convHeaderInitial}>{selectedRoom.other_name[0]}</Text>
          </View>
          <View style={styles.convHeaderInfo}>
            <Text style={styles.convHeaderName}>{selectedRoom.other_name}</Text>
            <Text style={styles.convHeaderStatus}>
              {getConversationStatusLabel(selectedRoom.room_type, selectedRoom.other_role)}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loadingMessages ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
          </View>
        ) : (
          <FlatList
            ref={scrollRef}
            data={messages}
            renderItem={({ item }) => <MessageBubble item={item} />}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={{ paddingVertical: Spacing.md }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
                <Text style={styles.emptyText}>Hãy gửi lời chào đầu tiên để bắt đầu cuộc trò chuyện.</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.msgInput}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={Colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color={Colors.textOnPrimary} size="small" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tin nhắn</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{rooms.reduce((sum, room) => sum + room.unread_count, 0)}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm tin nhắn..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loadingRooms ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải phòng chat...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filteredRooms.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện nào</Text>
              <Text style={styles.emptyText}>Khi bạn nhắn với guide hoặc hỗ trợ, phòng chat sẽ xuất hiện ở đây.</Text>
            </View>
          ) : (
            filteredRooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={styles.roomItem}
                onPress={() => setSelectedRoom(room)}
                activeOpacity={0.7}
              >
                <View style={styles.roomAvatar}>
                  <Text style={styles.roomInitial}>{room.other_name[0]}</Text>
                  {room.other_role === 'guide' ? <View style={styles.guideDot} /> : null}
                </View>

                <View style={styles.roomInfo}>
                  <View style={styles.roomHeader}>
                    <Text style={styles.roomName} numberOfLines={1}>{room.other_name}</Text>
                    <Text style={styles.roomTime}>{room.last_message_time}</Text>
                  </View>
                  <View style={styles.roomFooter}>
                    <Text style={[styles.roomLastMsg, room.unread_count > 0 && styles.roomLastMsgUnread]} numberOfLines={1}>
                      {room.last_message || 'Chưa có tin nhắn nào'}
                    </Text>
                    {room.unread_count > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{room.unread_count}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function MessageBubble({ item }: { item: ChatMessage }) {
  return (
    <View style={[msgStyles.bubble, item.is_mine ? msgStyles.mine : msgStyles.other]}>
      {!item.is_mine ? (
        <View style={msgStyles.avatarSmall}>
          <Text style={msgStyles.avatarSmallText}>{item.sender_name[0]}</Text>
        </View>
      ) : null}
      <View style={[msgStyles.content, item.is_mine ? msgStyles.contentMine : msgStyles.contentOther]}>
        <Text style={[msgStyles.text, item.is_mine ? msgStyles.textMine : msgStyles.textOther]}>
          {item.content}
        </Text>
        <Text style={[msgStyles.time, item.is_mine ? msgStyles.timeMine : msgStyles.timeOther]}>
          {item.created_at}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  headerBadge: {
    backgroundColor: Colors.error,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: { fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.bold as any, color: '#FFF' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: Spacing.md, color: Colors.text, fontSize: Fonts.sizes.md },
  errorBanner: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.base,
    backgroundColor: 'rgba(244,67,54,0.12)',
    borderRadius: BorderRadius.lg,
  },
  errorText: { color: Colors.error, fontSize: Fonts.sizes.sm },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginBottom: Spacing.sm },
  emptyText: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: 'center' },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  roomAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  roomInitial: { fontSize: 22, fontWeight: Fonts.weights.bold as any, color: Colors.primary },
  guideDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  roomInfo: { flex: 1 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text, flex: 1 },
  roomTime: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginLeft: Spacing.sm },
  roomFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  roomLastMsg: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, flex: 1 },
  roomLastMsgUnread: { color: Colors.text, fontWeight: Fonts.weights.medium as any },
  unreadBadge: {
    backgroundColor: Colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: Fonts.weights.bold as any, color: Colors.textOnPrimary },
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: 55,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.sm },
  backIcon: { fontSize: 24, color: Colors.text },
  convHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  convHeaderInitial: { fontSize: 18, fontWeight: Fonts.weights.bold as any, color: Colors.primary },
  convHeaderInfo: { flex: 1 },
  convHeaderName: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  convHeaderStatus: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  messageList: { flex: 1, paddingHorizontal: Spacing.base },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    paddingBottom: 34,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  msgInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: Fonts.sizes.md,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceLight },
  sendIcon: { fontSize: 18, color: Colors.textOnPrimary },
});

const msgStyles = StyleSheet.create({
  bubble: { flexDirection: 'row', marginBottom: Spacing.sm, maxWidth: '80%' },
  mine: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  other: { alignSelf: 'flex-start' },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
    marginTop: 4,
  },
  avatarSmallText: { fontSize: 12, fontWeight: Fonts.weights.bold as any, color: Colors.primary },
  content: { borderRadius: 18, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  contentMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  contentOther: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: { fontSize: Fonts.sizes.md, lineHeight: 20 },
  textMine: { color: Colors.textOnPrimary },
  textOther: { color: Colors.text },
  time: { fontSize: 10, marginTop: 4 },
  timeMine: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' as const },
  timeOther: { color: Colors.textMuted },
});
