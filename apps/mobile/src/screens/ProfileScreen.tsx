import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { User } from '@/services/api';

type EditForm = {
  full_name: string;
  email: string;
  bio: string;
};

type Props = {
  highlightIncompleteProfile?: boolean;
  onProfileUpdated?: (user: User) => void;
  onLogout?: () => void;
};

export default function ProfileScreen({
  highlightIncompleteProfile = false,
  onProfileUpdated,
  onLogout,
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<EditForm>({
    full_name: '',
    email: '',
    bio: '',
  });

  const syncForm = useCallback((nextUser: User | null) => {
    setForm({
      full_name: nextUser?.full_name || '',
      email: nextUser?.email || '',
      bio: nextUser?.bio || '',
    });
  }, []);

  const loadProfile = useCallback(async () => {
    const res = await api.getMe();
    if (res.success && res.data) {
      const nextUser = (res.data as any).user || res.data;
      setUser(nextUser);
      syncForm(nextUser);
      setError('');
      return;
    }

    setError(res.error?.message || 'Không thể tải hồ sơ');
  }, [syncForm]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await api.logout();
          api.setToken(null);
          onLogout?.();
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!form.full_name.trim()) {
      setError('Vui lòng nhập họ tên');
      return;
    }

    setSaving(true);
    const res = await api.updateProfile({
      full_name: form.full_name.trim(),
      email: form.email.trim() || undefined,
      bio: form.bio.trim() || undefined,
    });
    setSaving(false);

    if (res.success && res.data?.user) {
      setUser(res.data.user);
      syncForm(res.data.user);
      setEditing(false);
      setError('');
      onProfileUpdated?.(res.data.user);
      return;
    }

    setError(res.error?.message || 'Không thể cập nhật hồ sơ');
  };

  const displayName = user?.full_name || 'Traveler';
  const displayLevel = user?.level || 'Khách mới';
  const displayXP = user?.xp || 0;
  const displayRole = user?.role ? user.role.toUpperCase() : 'TRAVELER';

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName[0]}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>🏆 {displayLevel}</Text>
          </View>
          <Text style={styles.xpText}>{displayXP} XP</Text>
        </View>

        <View style={styles.contactCard}>
          {highlightIncompleteProfile ? (
            <View style={styles.profileBanner}>
              <Text style={styles.profileBannerTitle}>Hoàn thiện hồ sơ</Text>
              <Text style={styles.profileBannerText}>
                Thêm tên thật và email để nhận đề xuất phù hợp hơn và dễ khôi phục tài khoản.
              </Text>
            </View>
          ) : null}

          <View style={styles.contactHeader}>
            <View>
              <Text style={styles.contactTitle}>Thông tin tài khoản</Text>
              <Text style={styles.contactSub}>Role: {displayRole}</Text>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
              <Text style={styles.editButtonText}>{user?.email ? 'Chỉnh sửa' : 'Thêm email'}</Text>
            </TouchableOpacity>
          </View>

          <InfoRow label="Số điện thoại" value={user?.phone || 'Chưa có'} />
          <InfoRow label="Email" value={user?.email || 'Chưa thêm email'} highlight={!user?.email} />
          <InfoRow label="Giới thiệu" value={user?.bio || 'Chưa có mô tả'} />
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statsContainer}>
          <StatItem value={String(displayXP)} label="XP" />
          <View style={styles.statDivider} />
          <StatItem value={user?.is_verified ? 'Có' : 'Chưa'} label="Xác minh" />
          <View style={styles.statDivider} />
          <StatItem value={user?.email ? 'Đủ' : 'Thiếu'} label="Hồ sơ" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Tài khoản</Text>
          <MenuItem icon="👤" label="Chỉnh sửa hồ sơ" onPress={() => setEditing(true)} />
          <MenuItem icon="📧" label="Bổ sung email" value={user?.email ? 'Đã có' : 'Cần cập nhật'} onPress={() => setEditing(true)} />
          <MenuItem icon="📋" label="Lịch sử đặt chỗ" />
          <MenuItem icon="💬" label="Tin nhắn" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Khác</Text>
          <MenuItem icon="⭐" label="Đánh giá ứng dụng" />
          <MenuItem icon="📜" label="Điều khoản sử dụng" />
          <MenuItem icon="🛡️" label="Chính sách bảo mật" />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Huế Travel v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={editing} animationType="slide" transparent onRequestClose={() => setEditing(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cập nhật hồ sơ</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Họ tên</Text>
            <TextInput
              style={styles.input}
              value={form.full_name}
              onChangeText={(value) => setForm((prev) => ({ ...prev, full_name: value }))}
              placeholder="Nguyễn Văn A"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>Giới thiệu</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.bio}
              onChangeText={(value) => setForm((prev) => ({ ...prev, bio: value }))}
              placeholder="Chia sẻ một chút về bạn..."
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.textOnPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Lưu hồ sơ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.menuRight}>
        {value ? <Text style={styles.menuValue}>{value}</Text> : null}
        <Text style={styles.menuArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: Spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.primary,
  },
  name: {
    fontSize: Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
  },
  levelBadge: {
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  levelText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold as any,
  },
  xpText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  contactCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  profileBanner: {
    backgroundColor: 'rgba(249, 168, 37, 0.14)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    gap: Spacing.xs,
    marginBottom: Spacing.base,
  },
  profileBannerTitle: {
    color: Colors.text,
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.bold as any,
  },
  profileBannerText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    lineHeight: 20,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  contactTitle: {
    fontSize: Fonts.sizes.base,
    color: Colors.text,
    fontWeight: Fonts.weights.semibold as any,
  },
  contactSub: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  editButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  editButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold as any,
  },
  infoRow: {
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: Fonts.sizes.sm,
    color: Colors.text,
  },
  infoValueHighlight: {
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold as any,
  },
  errorBanner: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(244,67,54,0.12)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
  },
  errorText: {
    color: Colors.error,
    fontSize: Fonts.sizes.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
  },
  statLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  menuSection: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  menuTitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  menuIcon: {
    width: 28,
    fontSize: Fonts.sizes.base,
  },
  menuLabel: {
    flex: 1,
    fontSize: Fonts.sizes.base,
    color: Colors.text,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  menuValue: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
  },
  menuArrow: {
    fontSize: 22,
    color: Colors.textMuted,
  },
  logoutButton: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutText: {
    color: Colors.error,
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
  },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: Fonts.sizes.xs,
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize: Fonts.sizes.lg,
    color: Colors.text,
    fontWeight: Fonts.weights.bold as any,
  },
  modalClose: {
    fontSize: 22,
    color: Colors.textMuted,
  },
  inputLabel: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: Fonts.sizes.base,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.bold as any,
  },
});
