import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

// ============================================
// Settings Screen
// ============================================

type SettingGroup = {
  title: string;
  items: SettingItem[];
};

type SettingItem = {
  icon: string;
  label: string;
  type: 'toggle' | 'link' | 'value';
  value?: string;
  key?: string;
  color?: string;
  danger?: boolean;
};

const SETTINGS: SettingGroup[] = [
  {
    title: 'Thông báo',
    items: [
      { icon: '🔔', label: 'Push Notifications', type: 'toggle', key: 'pushNotif' },
      { icon: '📧', label: 'Email thông báo', type: 'toggle', key: 'emailNotif' },
      { icon: '💬', label: 'Tin nhắn mới', type: 'toggle', key: 'chatNotif' },
      { icon: '🎁', label: 'Khuyến mãi', type: 'toggle', key: 'promoNotif' },
    ],
  },
  {
    title: 'Tùy chỉnh',
    items: [
      { icon: '🌙', label: 'Dark Mode', type: 'toggle', key: 'darkMode' },
      { icon: '🌐', label: 'Ngôn ngữ', type: 'value', value: 'Tiếng Việt' },
      { icon: '💱', label: 'Đơn vị tiền', type: 'value', value: 'VNĐ' },
      { icon: '📍', label: 'Khu vực', type: 'value', value: 'Huế, Việt Nam' },
    ],
  },
  {
    title: 'Bảo mật',
    items: [
      { icon: '🔐', label: 'Đổi mật khẩu', type: 'link' },
      { icon: '📱', label: 'Xác thực 2 bước', type: 'toggle', key: 'twoFactor' },
      { icon: '👤', label: 'Phiên đăng nhập', type: 'value', value: '2 thiết bị' },
      { icon: '🔑', label: 'Kết nối Google', type: 'value', value: 'Đã kết nối', color: '#4CAF50' },
    ],
  },
  {
    title: 'Ứng dụng',
    items: [
      { icon: '💾', label: 'Bộ nhớ cache', type: 'value', value: '24.5 MB' },
      { icon: '📊', label: 'Phiên bản', type: 'value', value: '1.0.0' },
      { icon: '📋', label: 'Điều khoản sử dụng', type: 'link' },
      { icon: '🔒', label: 'Chính sách bảo mật', type: 'link' },
      { icon: '⭐', label: 'Đánh giá ứng dụng', type: 'link' },
    ],
  },
  {
    title: 'Nguy hiểm',
    items: [
      { icon: '🚪', label: 'Đăng xuất', type: 'link', danger: true },
      { icon: '🗑️', label: 'Xoá tài khoản', type: 'link', danger: true },
    ],
  },
];

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    pushNotif: true,
    emailNotif: true,
    chatNotif: true,
    promoNotif: false,
    darkMode: true,
    twoFactor: false,
  });

  const handleToggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {SETTINGS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.groupCard}>
              {group.items.map((item, idx) => (
                <View key={item.label}>
                  <TouchableOpacity
                    style={styles.settingItem}
                    activeOpacity={item.type === 'toggle' ? 1 : 0.6}
                  >
                    <Text style={styles.settingIcon}>{item.icon}</Text>
                    <Text style={[
                      styles.settingLabel,
                      item.danger && styles.settingLabelDanger,
                    ]}>
                      {item.label}
                    </Text>

                    {item.type === 'toggle' && item.key && (
                      <Switch
                        value={toggles[item.key] || false}
                        onValueChange={() => handleToggle(item.key!)}
                        trackColor={{ false: Colors.border, true: 'rgba(249,168,37,0.4)' }}
                        thumbColor={toggles[item.key!] ? Colors.primary : Colors.textMuted}
                      />
                    )}

                    {item.type === 'value' && (
                      <Text style={[
                        styles.settingValue,
                        item.color ? { color: item.color } : {},
                      ]}>
                        {item.value}
                      </Text>
                    )}

                    {item.type === 'link' && !item.danger && (
                      <Text style={styles.settingArrow}>›</Text>
                    )}
                  </TouchableOpacity>
                  {idx < group.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Huế Travel v1.0.0</Text>
          <Text style={styles.footerText}>Made with ❤️ in Huế</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingTop: 55, paddingBottom: Spacing.md,
  },
  backBtn: { padding: Spacing.sm, width: 40 },
  backIcon: { fontSize: 24, color: Colors.text },
  headerTitle: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.bold as any, color: Colors.text },

  group: { marginBottom: Spacing.lg, paddingHorizontal: Spacing.base },
  groupTitle: {
    fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.bold as any,
    color: Colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: Spacing.sm, paddingLeft: 4,
  },
  groupCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },

  settingItem: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    gap: Spacing.md,
  },
  settingIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  settingLabel: { flex: 1, fontSize: Fonts.sizes.md, color: Colors.text, fontWeight: Fonts.weights.medium as any },
  settingLabelDanger: { color: Colors.error },
  settingValue: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  settingArrow: { fontSize: 20, color: Colors.textMuted },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 60 },

  footer: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: 4 },
  footerText: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
});
