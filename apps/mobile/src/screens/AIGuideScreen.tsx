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
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api from '@/services/api';

// ============================================
// AI Trip Planner Screen
// ============================================

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: string[];
};

const QUICK_PROMPTS = [
  { emoji: '📅', text: 'Lên lịch trình 3 ngày' },
  { emoji: '🍜', text: 'Gợi ý quán ăn ngon' },
  { emoji: '🏛️', text: 'Đại Nội có gì hay?' },
  { emoji: '📸', text: 'Điểm check-in HOT' },
  { emoji: '💰', text: 'Du lịch tiết kiệm' },
  { emoji: '🌅', text: 'Hoạt động buổi tối' },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: '0',
    role: 'assistant',
    content: 'Chào bạn! 🌏 Mình là **Huế AI Guide** — trợ lý du lịch AI chuyên về thành phố Huế.\n\nMình có thể giúp bạn:\n• 📅 Lên lịch trình chi tiết\n• 🍜 Gợi ý ẩm thực & quán ăn\n• 🏛️ Thông tin di sản, lịch sử\n• 💰 Tối ưu ngân sách\n\nBạn muốn khám phá gì nào? 😊',
    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  },
];

export default function AIGuideScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<FlatList>(null);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;

    // Add user message
    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev: Message[]) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError('');
    setTimeout(() => scrollRef.current?.scrollToEnd(), 100);

    const chatHistory = [...messages, userMsg]
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

    const result = await api.aiChat(chatHistory);

    if (result.success && result.data) {
      const aiResponse: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: result.data.reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev: Message[]) => [...prev, aiResponse]);
    } else {
      setError(result.error?.message || 'Không thể kết nối AI Guide');
    }

    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd(), 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>🤖</Text>
          </View>
        )}
        <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.msgText, isUser ? styles.userText : styles.aiText]}>
            {item.content}
          </Text>
          <Text style={[styles.msgTime, isUser ? styles.userTime : styles.aiTime]}>
            {item.timestamp}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 24 }}>🤖</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Huế AI Guide</Text>
            <Text style={styles.headerSubtitle}>
              {isLoading ? '⌛ Đang suy nghĩ...' : '🟢 Sẵn sàng hỗ trợ'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <Text style={{ fontSize: 18 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={scrollRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item: Message) => item.id}
        style={styles.messageList}
        contentContainerStyle={{ paddingVertical: Spacing.md, paddingHorizontal: Spacing.base }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loadingRow}>
              <View style={styles.aiAvatar}>
                <Text style={styles.aiAvatarText}>🤖</Text>
              </View>
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Đang phân tích...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Quick Prompts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickPrompts}
        contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.sm }}
      >
        {QUICK_PROMPTS.map((prompt, i) => (
          <TouchableOpacity
            key={i}
            style={styles.quickChip}
            onPress={() => sendMessage(prompt.text)}
          >
            <Text style={styles.quickEmoji}>{prompt.emoji}</Text>
            <Text style={styles.quickText}>{prompt.text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Hỏi bất cứ gì về Huế..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || isLoading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || isLoading}
        >
          <Text style={styles.sendIcon}>✨</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingTop: 55, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(249,168,37,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  headerSubtitle: { fontSize: Fonts.sizes.xs, color: Colors.success, marginTop: 2 },
  headerAction: { padding: Spacing.sm },

  errorBanner: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255, 112, 67, 0.14)',
    borderRadius: BorderRadius.lg,
  },
  errorText: {
    color: Colors.text,
    fontSize: Fonts.sizes.sm,
  },

  // Messages
  messageList: { flex: 1 },
  msgRow: {
    flexDirection: 'row', marginBottom: Spacing.md, maxWidth: '85%',
    alignItems: 'flex-end',
  },
  msgRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },

  aiAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(249,168,37,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.xs,
  },
  aiAvatarText: { fontSize: 16 },

  msgBubble: { borderRadius: 18, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, maxWidth: '90%' },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: {
    backgroundColor: Colors.surface, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.border,
  },

  msgText: { fontSize: Fonts.sizes.md, lineHeight: 22 },
  userText: { color: Colors.textOnPrimary },
  aiText: { color: Colors.text },

  msgTime: { fontSize: 10, marginTop: 6 },
  userTime: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' as const },
  aiTime: { color: Colors.textMuted },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  loadingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: 18,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  loadingText: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },

  // Quick Prompts
  quickPrompts: { maxHeight: 48, marginBottom: Spacing.xs },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  quickEmoji: { fontSize: 14 },
  quickText: { fontSize: Fonts.sizes.xs, color: Colors.text, fontWeight: Fonts.weights.medium as any },

  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, paddingBottom: 34,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  input: {
    flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 22,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    color: Colors.text, fontSize: Fonts.sizes.md, maxHeight: 100,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceLight },
  sendIcon: { fontSize: 20, color: Colors.textOnPrimary },
});
