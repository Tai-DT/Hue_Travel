import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

// ============================================
// Chat Room List Screen
// ============================================

type ChatRoom = {
  id: string;
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

// Mock Data
const mockRooms: ChatRoom[] = [
  { id: '1', other_name: 'Nguyễn Văn Minh', other_role: 'guide', last_message: 'Chào bạn! Mình sẽ đón bạn lúc 9h sáng nhé 🙌', last_message_time: '2 phút trước', unread_count: 2 },
  { id: '2', other_name: 'Trần Thị Lan', other_role: 'guide', last_message: 'Tour ẩm thực rất tuyệt vời ạ!', last_message_time: '1 giờ trước', unread_count: 0 },
  { id: '3', other_name: 'Hỗ trợ Huế Travel', other_role: 'admin', last_message: 'Cảm ơn bạn đã liên hệ. Chúng tôi sẽ xử lý ngay ạ.', last_message_time: 'Hôm qua', unread_count: 0 },
  { id: '4', other_name: 'Lê Hoàng Dũng', other_role: 'guide', last_message: 'Điểm hẹn tại cổng Ngọ Môn nhé bạn 📍', last_message_time: '2 ngày trước', unread_count: 0 },
];

const mockMessages: ChatMessage[] = [
  { id: '1', sender_id: 'other', sender_name: 'Nguyễn Văn Minh', content: 'Chào bạn! Mình là guide của bạn cho tour ngày mai 👋', message_type: 'text', is_mine: false, created_at: '08:30' },
  { id: '2', sender_id: 'me', sender_name: 'Tôi', content: 'Chào anh Minh! Em rất mong chờ ạ', message_type: 'text', is_mine: true, created_at: '08:32' },
  { id: '3', sender_id: 'other', sender_name: 'Nguyễn Văn Minh', content: 'Mình sẽ đón bạn tại 15 Lê Lợi lúc 9h sáng. Bạn nhớ mặc đồ thoải mái nhé!', message_type: 'text', is_mine: false, created_at: '08:33' },
  { id: '4', sender_id: 'me', sender_name: 'Tôi', content: 'Dạ em sẽ đến đúng giờ ạ. Em có cần chuẩn bị gì không anh?', message_type: 'text', is_mine: true, created_at: '08:35' },
  { id: '5', sender_id: 'other', sender_name: 'Nguyễn Văn Minh', content: 'Bạn chỉ cần mang theo nước uống và camera thôi nhé. Đồ ăn mình sẽ lo hết 🍜', message_type: 'text', is_mine: false, created_at: '08:36' },
  { id: '6', sender_id: 'other', sender_name: 'Nguyễn Văn Minh', content: 'Chào bạn! Mình sẽ đón bạn lúc 9h sáng nhé 🙌', message_type: 'text', is_mine: false, created_at: '09:00' },
];

export function ChatListScreen({ onSelectRoom }: { onSelectRoom: (room: ChatRoom) => void }) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tin nhắn</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>2</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm tin nhắn..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Room List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {mockRooms.map((room) => (
          <TouchableOpacity
            key={room.id}
            style={styles.roomItem}
            onPress={() => onSelectRoom(room)}
            activeOpacity={0.7}
          >
            <View style={styles.roomAvatar}>
              <Text style={styles.roomInitial}>{room.other_name[0]}</Text>
              {room.other_role === 'guide' && (
                <View style={styles.guideDot} />
              )}
            </View>

            <View style={styles.roomInfo}>
              <View style={styles.roomHeader}>
                <Text style={styles.roomName} numberOfLines={1}>{room.other_name}</Text>
                <Text style={styles.roomTime}>{room.last_message_time}</Text>
              </View>
              <View style={styles.roomFooter}>
                <Text style={[styles.roomLastMsg, room.unread_count > 0 && styles.roomLastMsgUnread]} numberOfLines={1}>
                  {room.last_message}
                </Text>
                {room.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{room.unread_count}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// Chat Conversation Screen
// ============================================

export function ChatConversationScreen({ room, onBack }: { room: ChatRoom; onBack: () => void }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(mockMessages);
  const scrollRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (!message.trim()) return;

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      sender_id: 'me',
      sender_name: 'Tôi',
      content: message.trim(),
      message_type: 'text',
      is_mine: true,
      created_at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setMessage('');
    setTimeout(() => scrollRef.current?.scrollToEnd(), 100);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[msgStyles.bubble, item.is_mine ? msgStyles.mine : msgStyles.other]}>
      {!item.is_mine && (
        <View style={msgStyles.avatarSmall}>
          <Text style={msgStyles.avatarSmallText}>{item.sender_name[0]}</Text>
        </View>
      )}
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.convHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.convHeaderAvatar}>
          <Text style={styles.convHeaderInitial}>{room.other_name[0]}</Text>
        </View>
        <View style={styles.convHeaderInfo}>
          <Text style={styles.convHeaderName}>{room.other_name}</Text>
          <Text style={styles.convHeaderStatus}>
            {room.other_role === 'guide' ? '🟢 Đang hoạt động' : 'Hỗ trợ'}
          </Text>
        </View>
        <TouchableOpacity style={styles.convHeaderAction}>
          <Text style={{ fontSize: 20 }}>📞</Text>
        </TouchableOpacity>
      </View>

      {/* Booking Context Card */}
      <View style={styles.contextCard}>
        <Text style={styles.contextEmoji}>🏛️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.contextTitle}>Khám phá Đại Nội Huế</Text>
          <Text style={styles.contextMeta}>📅 Ngày mai, 09:00 • 3 khách</Text>
        </View>
        <TouchableOpacity style={styles.contextBtn}>
          <Text style={styles.contextBtnText}>Chi tiết</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={scrollRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={{ paddingVertical: Spacing.md }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
      />

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {['📍 Gửi vị trí', '📷 Ảnh', '⏰ Đổi giờ'].map((action, i) => (
          <TouchableOpacity key={i} style={styles.quickChip}>
            <Text style={styles.quickChipText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachBtn}>
          <Text style={{ fontSize: 22 }}>+</Text>
        </TouchableOpacity>
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
          style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!message.trim()}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  headerBadge: {
    backgroundColor: Colors.error, width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  headerBadgeText: { fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.bold as any, color: '#FFF' },

  // Search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: Spacing.md, color: Colors.text, fontSize: Fonts.sizes.md },

  // Room List
  roomItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md, gap: Spacing.md,
  },
  roomAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  roomInitial: { fontSize: 22, fontWeight: Fonts.weights.bold as any, color: Colors.primary },
  guideDot: {
    position: 'absolute', bottom: 2, right: 2, width: 12, height: 12,
    borderRadius: 6, backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.background,
  },
  roomInfo: { flex: 1 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text, flex: 1 },
  roomTime: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginLeft: Spacing.sm },
  roomFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  roomLastMsg: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, flex: 1 },
  roomLastMsgUnread: { color: Colors.text, fontWeight: Fonts.weights.medium as any },
  unreadBadge: {
    backgroundColor: Colors.primary, minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: Fonts.weights.bold as any, color: Colors.textOnPrimary },

  // Conversation Header
  convHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base,
    paddingTop: 55, paddingBottom: Spacing.md, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.sm },
  backIcon: { fontSize: 24, color: Colors.text },
  convHeaderAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },
  convHeaderInitial: { fontSize: 18, fontWeight: Fonts.weights.bold as any, color: Colors.primary },
  convHeaderInfo: { flex: 1 },
  convHeaderName: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  convHeaderStatus: { fontSize: Fonts.sizes.xs, color: Colors.success },
  convHeaderAction: { padding: Spacing.sm },

  // Context Card
  contextCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,168,37,0.1)',
    marginHorizontal: Spacing.base, marginTop: Spacing.sm, padding: Spacing.md,
    borderRadius: BorderRadius.lg, gap: Spacing.sm, borderWidth: 1, borderColor: 'rgba(249,168,37,0.2)',
  },
  contextEmoji: { fontSize: 24 },
  contextTitle: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  contextMeta: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  contextBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md,
    paddingVertical: 6, borderRadius: BorderRadius.sm,
  },
  contextBtnText: { fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.bold as any, color: Colors.textOnPrimary },

  // Messages
  messageList: { flex: 1, paddingHorizontal: Spacing.base },

  // Quick Actions
  quickActions: {
    flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  quickChip: {
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  quickChipText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },

  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm, paddingBottom: 34, backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm,
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },
  msgInput: {
    flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 20,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, color: Colors.text,
    fontSize: Fonts.sizes.md, maxHeight: 100, borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceLight },
  sendIcon: { fontSize: 18, color: Colors.textOnPrimary },
});

const msgStyles = StyleSheet.create({
  bubble: { flexDirection: 'row', marginBottom: Spacing.sm, maxWidth: '80%' },
  mine: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  other: { alignSelf: 'flex-start' },

  avatarSmall: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.xs,
    marginTop: 4,
  },
  avatarSmallText: { fontSize: 12, fontWeight: Fonts.weights.bold as any, color: Colors.primary },

  content: { borderRadius: 18, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  contentMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  contentOther: {
    backgroundColor: Colors.surface, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.border,
  },

  text: { fontSize: Fonts.sizes.md, lineHeight: 20 },
  textMine: { color: Colors.textOnPrimary },
  textOther: { color: Colors.text },

  time: { fontSize: 10, marginTop: 4 },
  timeMine: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' as const },
  timeOther: { color: Colors.textMuted },
});

// ============================================
// Default Export — combined screen
// ============================================
export default function ChatScreen() {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);

  if (selectedRoom) {
    return <ChatConversationScreen room={selectedRoom} onBack={() => setSelectedRoom(null)} />;
  }

  return <ChatListScreen onSelectRoom={setSelectedRoom} />;
}
