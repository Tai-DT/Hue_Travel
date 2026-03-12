import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api from '@/services/api';

type UserProfile = {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  role: string;
  level: string;
  xp: number;
  avatar_url?: string;
};

export default function ProfileScreen() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await api.getMe();
    if (res.success && res.data) {
      setUser((res.data as any).user || res.data);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

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
          api.setToken('');
        },
      },
    ]);
  };

  const displayName = user?.full_name || 'Traveler';
  const displayLevel = user?.level || 'Khách mới';
  const displayXP = user?.xp || 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName[0]}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>🏆 {displayLevel}</Text>
          </View>
          <Text style={styles.xpText}>{displayXP} XP — Đặt trải nghiệm để nhận XP!</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <StatItem value="0" label="Bookings" />
          <View style={styles.statDivider} />
          <StatItem value="0" label="Reviews" />
          <View style={styles.statDivider} />
          <StatItem value="0" label="Favorites" />
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Tài khoản</Text>
          <MenuItem icon="👤" label="Chỉnh sửa hồ sơ" />
          <MenuItem icon="📋" label="Lịch sử đặt chỗ" />
          <MenuItem icon="❤️" label="Yêu thích" />
          <MenuItem icon="💬" label="Tin nhắn" badge="2" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Cài đặt</Text>
          <MenuItem icon="🔔" label="Thông báo" />
          <MenuItem icon="🌙" label="Giao diện tối" value="Bật" />
          <MenuItem icon="🌐" label="Ngôn ngữ" value="Tiếng Việt" />
          <MenuItem icon="❓" label="Trợ giúp & Hỗ trợ" />
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

function MenuItem({
  icon, label, value, badge,
}: {
  icon: string; label: string; value?: string; badge?: string;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.menuRight}>
        {value && <Text style={styles.menuValue}>{value}</Text>}
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: Fonts.weights.bold,
    color: Colors.primary,
  },
  name: {
    fontSize: Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold,
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
    fontWeight: Fonts.weights.semibold,
  },
  xpText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },

  // Stats
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
    fontWeight: Fonts.weights.bold,
    color: Colors.text,
  },
  statLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },

  // Menu
  menuSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  menuTitle: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  menuIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.text,
    fontWeight: Fonts.weights.medium,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  menuValue: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
  },
  badge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: Fonts.weights.bold,
    color: Colors.textOnPrimary,
  },
  menuArrow: {
    fontSize: 20,
    color: Colors.textMuted,
  },

  // Logout
  logoutButton: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error + '40',
    marginTop: Spacing.sm,
  },
  logoutText: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold,
    color: Colors.error,
  },
  version: {
    textAlign: 'center',
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
});
