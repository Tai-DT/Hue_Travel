import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { SUPPORTED_LOCALES, SupportedLocale } from '@/i18n';
import api, { TravelerCurrency, TravelerPreferencesPayload } from '@/services/api';
import { offlineCache } from '@/services/cache';
import { pushService } from '@/services/push';
import { CURRENCY_OPTIONS } from '@/utils/currency';

// ============================================
// Settings Screen — synced traveler preferences
// ============================================

export default function SettingsScreen({
  onBack,
  onLogout,
  preferences,
  onPreferencesUpdated,
}: {
  onBack: () => void;
  onLogout?: () => void;
  preferences: TravelerPreferencesPayload;
  onPreferencesUpdated: (preferences: TravelerPreferencesPayload) => void;
}) {
  const { t, locale, setLocale, supportedLocales } = useTranslation();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [prefs, setPrefs] = useState<TravelerPreferencesPayload>(preferences);
  const [regionDraft, setRegionDraft] = useState(preferences.preferences.region || '');
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [cacheSummary, setCacheSummary] = useState('0 mục trong phiên');

  const refreshCacheSummary = useCallback(() => {
    const stats = offlineCache.getStats();
    setCacheSummary(`${stats.memoryEntries} mục trong phiên`);
  }, []);

  useEffect(() => {
    setPrefs(preferences);
    setRegionDraft(preferences.preferences.region || '');
  }, [preferences]);

  useEffect(() => {
    refreshCacheSummary();
    api.getMe().then((res) => {
      if (res.success && res.data) {
        const user = (res.data as any).user || res.data;
        setHasPassword(Boolean(user?.has_password));
      }
    });
  }, [refreshCacheSummary]);

  const syncPreferences = useCallback(async (next: TravelerPreferencesPayload, key: string) => {
    setSyncingKey(key);
    const result = await api.updateMyPreferences({
      locale: next.preferences.locale,
      currency: next.preferences.currency,
      region: next.preferences.region,
      notification_preferences: next.preferences.notification_preferences,
    });
    setSyncingKey(null);

    if (!result.success || !result.data) {
      Alert.alert('Không thể lưu cài đặt', result.error?.message || 'Vui lòng thử lại.');
      return false;
    }

    setPrefs(result.data);
    onPreferencesUpdated(result.data);

    if (result.data.preferences.notification_preferences.push_enabled) {
      void pushService.initialize();
    }

    return true;
  }, [onPreferencesUpdated]);

  const handleToggle = useCallback(async (key: 'pushNotif' | 'emailNotif' | 'chatNotif' | 'promoNotif') => {
    const previous = prefs;
    const nextNotifications = {
      ...prefs.preferences.notification_preferences,
      push_enabled: key === 'pushNotif'
        ? !prefs.preferences.notification_preferences.push_enabled
        : prefs.preferences.notification_preferences.push_enabled,
      email_enabled: key === 'emailNotif'
        ? !prefs.preferences.notification_preferences.email_enabled
        : prefs.preferences.notification_preferences.email_enabled,
      chat_enabled: key === 'chatNotif'
        ? !prefs.preferences.notification_preferences.chat_enabled
        : prefs.preferences.notification_preferences.chat_enabled,
      promo_enabled: key === 'promoNotif'
        ? !prefs.preferences.notification_preferences.promo_enabled
        : prefs.preferences.notification_preferences.promo_enabled,
    };

    const next = {
      ...prefs,
      preferences: {
        ...prefs.preferences,
        notification_preferences: nextNotifications,
      },
    };

    setPrefs(next);
    const ok = await syncPreferences(next, key);
    if (!ok) {
      setPrefs(previous);
    }
  }, [prefs, syncPreferences]);

  const handleLanguageSelect = (code: SupportedLocale) => {
    const previous = prefs;
    const next = {
      ...prefs,
      preferences: {
        ...prefs.preferences,
        locale: code,
      },
    };

    setLocale(code);
    setPrefs(next);
    setShowLanguagePicker(false);
    void syncPreferences(next, 'locale').then((ok) => {
      if (!ok) {
        setPrefs(previous);
        setLocale(previous.preferences.locale as SupportedLocale);
      }
    });
  };

  const handleCurrencySelect = (currency: TravelerCurrency) => {
    const previous = prefs;
    const next = {
      ...prefs,
      preferences: {
        ...prefs.preferences,
        currency,
      },
    };

    setPrefs(next);
    setShowCurrencyPicker(false);
    void syncPreferences(next, 'currency').then((ok) => {
      if (!ok) {
        setPrefs(previous);
      }
    });
  };

  const openRegionModal = useCallback(() => {
    setRegionDraft(prefs.preferences.region || t('settings.regionName'));
    setShowRegionModal(true);
  }, [prefs.preferences.region, t]);

  const handleRegionSave = useCallback(async () => {
    const normalizedRegion = regionDraft.trim();
    if (!normalizedRegion) {
      Alert.alert('Thiếu khu vực', 'Vui lòng nhập khu vực ưu tiên của bạn.');
      return;
    }

    const previous = prefs;
    const next = {
      ...prefs,
      preferences: {
        ...prefs.preferences,
        region: normalizedRegion,
      },
    };

    setPrefs(next);
    const ok = await syncPreferences(next, 'region');
    if (!ok) {
      setPrefs(previous);
      setRegionDraft(previous.preferences.region || '');
      return;
    }

    setRegionDraft(normalizedRegion);
    setShowRegionModal(false);
  }, [prefs, regionDraft, syncPreferences]);

  const handleLogout = () => {
    if (!onLogout) return;
    Alert.alert(t('settings.logout'), t('common.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: onLogout },
    ]);
  };

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setPasswordSuccess('');
    setShowPasswordModal(true);
  };

  const openExternalLink = useCallback(async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Không thể mở liên kết', url);
      return;
    }
    await Linking.openURL(url);
  }, []);

  const openTerms = useCallback(() => {
    void openExternalLink('https://huetravel.vn/terms');
  }, [openExternalLink]);

  const openPrivacy = useCallback(() => {
    void openExternalLink('https://huetravel.vn/privacy');
  }, [openExternalLink]);

  const openRateApp = useCallback(() => {
    const url = Platform.select({
      ios: 'https://apps.apple.com',
      android: 'https://play.google.com/store',
      default: 'https://huetravel.vn',
    }) || 'https://huetravel.vn';
    void openExternalLink(url);
  }, [openExternalLink]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      t('settings.cacheSize'),
      'Xóa dữ liệu cache cục bộ của ứng dụng trên thiết bị này?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Xóa cache',
          style: 'destructive',
          onPress: async () => {
            await offlineCache.clear();
            refreshCacheSummary();
            Alert.alert('Đã dọn cache', 'Cache cục bộ trong phiên hiện tại đã được xóa.');
          },
        },
      ],
    );
  }, [refreshCacheSummary, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('settings.deleteAccount'),
      'Tài khoản sẽ bị vô hiệu hóa và bạn sẽ bị đăng xuất khỏi thiết bị này.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            const res = await api.deleteAccount();
            if (!res.success) {
              Alert.alert('Không thể xoá tài khoản', res.error?.message || 'Vui lòng thử lại.');
              return;
            }

            Alert.alert('Đã xoá tài khoản', res.data?.message || 'Tài khoản của bạn đã được vô hiệu hóa.');

            if (onLogout) {
              onLogout();
              return;
            }

            await api.clearSession();
          },
        },
      ],
    );
  }, [onLogout, t]);

  const handlePasswordSave = async () => {
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (hasPassword && !passwordForm.currentPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    const res = await api.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
    setPasswordLoading(false);

    if (!res.success) {
      setPasswordError(res.error?.message || 'Không thể cập nhật mật khẩu.');
      return;
    }

    setHasPassword(true);
    setPasswordSuccess('Đã cập nhật mật khẩu thành công.');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const currentLang = supportedLocales.find((l) => l.code === prefs.preferences.locale) || supportedLocales.find((l) => l.code === locale);
  const currentCurrency = CURRENCY_OPTIONS.find((item) => item.code === prefs.preferences.currency) || CURRENCY_OPTIONS[0];

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
    onPress?: () => void;
  };

  const SETTINGS: SettingGroup[] = [
    {
      title: t('settings.notifications'),
      items: [
        { icon: '🔔', label: t('settings.pushNotifications'), type: 'toggle', key: 'pushNotif' },
        { icon: '📧', label: t('settings.emailNotifications'), type: 'toggle', key: 'emailNotif' },
        { icon: '💬', label: t('settings.newMessages'), type: 'toggle', key: 'chatNotif' },
        { icon: '🎁', label: t('settings.promotions'), type: 'toggle', key: 'promoNotif' },
      ],
    },
    {
      title: t('settings.customization'),
      items: [
        {
          icon: '🌐',
          label: t('settings.language'),
          type: 'value',
          value: `${currentLang?.flag} ${currentLang?.nativeName}`,
          onPress: () => setShowLanguagePicker(true),
        },
        {
          icon: '💱',
          label: t('settings.currency'),
          type: 'value',
          value: `${currentCurrency.symbol} ${currentCurrency.label}`,
          onPress: () => setShowCurrencyPicker(true),
        },
        {
          icon: '📍',
          label: t('settings.region'),
          type: 'value',
          value: prefs.preferences.region || t('settings.regionName'),
          onPress: openRegionModal,
        },
      ],
    },
    {
      title: t('settings.security'),
      items: [
        { icon: '🔐', label: t('settings.changePassword'), type: 'link', onPress: openPasswordModal },
        { icon: '📱', label: t('settings.twoFactor'), type: 'value', value: 'Sắp hỗ trợ' },
        { icon: '👤', label: t('settings.sessions'), type: 'value', value: t('settings.devices', { count: prefs.device_count }) },
        {
          icon: '🔑',
          label: 'Mật khẩu nội bộ',
          type: 'value',
          value: hasPassword ? 'Đã có mật khẩu' : 'Chưa đặt mật khẩu',
          color: hasPassword ? '#4CAF50' : Colors.textMuted,
        },
      ],
    },
    {
      title: t('settings.app'),
      items: [
        { icon: '💾', label: t('settings.cacheSize'), type: 'value', value: cacheSummary, onPress: handleClearCache },
        { icon: '📊', label: t('settings.version'), type: 'value', value: '1.0.0' },
        { icon: '📋', label: t('settings.terms'), type: 'link', onPress: openTerms },
        { icon: '🔒', label: t('settings.privacy'), type: 'link', onPress: openPrivacy },
        { icon: '⭐', label: t('settings.rateApp'), type: 'link', onPress: openRateApp },
      ],
    },
    {
      title: t('settings.danger'),
      items: [
        { icon: '🚪', label: t('settings.logout'), type: 'link', danger: true, onPress: handleLogout },
        { icon: '🗑️', label: t('settings.deleteAccount'), type: 'link', danger: true, onPress: handleDeleteAccount },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
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
                    activeOpacity={item.type === 'toggle' || !item.onPress ? 1 : 0.6}
                    onPress={item.onPress}
                  >
                    <Text style={styles.settingIcon}>{item.icon}</Text>
                    <Text style={[
                      styles.settingLabel,
                      item.danger && styles.settingLabelDanger,
                    ]}>
                      {item.label}
                    </Text>

                    {item.type === 'toggle' && item.key && (
                      syncingKey === item.key ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Switch
                          value={
                            item.key === 'pushNotif'
                              ? prefs.preferences.notification_preferences.push_enabled
                              : item.key === 'emailNotif'
                                ? prefs.preferences.notification_preferences.email_enabled
                                : item.key === 'chatNotif'
                                  ? prefs.preferences.notification_preferences.chat_enabled
                                  : prefs.preferences.notification_preferences.promo_enabled
                          }
                          onValueChange={() => handleToggle(item.key as any)}
                          trackColor={{ false: Colors.border, true: 'rgba(249,168,37,0.4)' }}
                          thumbColor={
                            (
                              item.key === 'pushNotif'
                                ? prefs.preferences.notification_preferences.push_enabled
                                : item.key === 'emailNotif'
                                  ? prefs.preferences.notification_preferences.email_enabled
                                  : item.key === 'chatNotif'
                                    ? prefs.preferences.notification_preferences.chat_enabled
                                    : prefs.preferences.notification_preferences.promo_enabled
                            ) ? Colors.primary : Colors.textMuted
                          }
                        />
                      )
                    )}

                    {item.type === 'value' && (
                      <Text style={[
                        styles.settingValue,
                        item.color ? { color: item.color } : {},
                      ]}>
                        {item.value}
                      </Text>
                    )}

                    {item.type !== 'toggle' && item.onPress && !item.danger && (
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
          <Text style={styles.footerText}>{t('settings.footer')}</Text>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguagePicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('settings.language')}</Text>
            {supportedLocales.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langOption,
                  locale === lang.code && styles.langOptionActive,
                ]}
                onPress={() => handleLanguageSelect(lang.code)}
                activeOpacity={0.7}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={styles.langInfo}>
                  <Text style={[
                    styles.langNative,
                    locale === lang.code && styles.langNativeActive,
                  ]}>
                    {lang.nativeName}
                  </Text>
                  <Text style={styles.langName}>{lang.name}</Text>
                </View>
                {locale === lang.code && (
                  <Text style={styles.langCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCurrencyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencyPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('settings.currency')}</Text>
            {CURRENCY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.code}
                style={[
                  styles.langOption,
                  prefs.preferences.currency === option.code && styles.langOptionActive,
                ]}
                onPress={() => handleCurrencySelect(option.code)}
                activeOpacity={0.7}
              >
                <Text style={styles.langFlag}>{option.symbol}</Text>
                <View style={styles.langInfo}>
                  <Text style={[
                    styles.langNative,
                    prefs.preferences.currency === option.code && styles.langNativeActive,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.langName}>{option.code}</Text>
                </View>
                {prefs.preferences.currency === option.code ? (
                  <Text style={styles.langCheck}>✓</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPasswordModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu lần đầu'}</Text>

            <Text style={styles.passwordHint}>
              {hasPassword
                ? 'Nhập mật khẩu hiện tại rồi chọn mật khẩu mới.'
                : 'Tài khoản của bạn chưa có mật khẩu nội bộ. Đặt mật khẩu để lần sau đăng nhập bằng email.'}
            </Text>

            {hasPassword ? (
              <TextInput
                style={styles.passwordInput}
                value={passwordForm.currentPassword}
                onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))}
                secureTextEntry
                placeholder="Mật khẩu hiện tại"
                placeholderTextColor={Colors.textMuted}
              />
            ) : null}

            <TextInput
              style={styles.passwordInput}
              value={passwordForm.newPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
              secureTextEntry
              placeholder="Mật khẩu mới"
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              style={styles.passwordInput}
              value={passwordForm.confirmPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
              secureTextEntry
              placeholder="Nhập lại mật khẩu mới"
              placeholderTextColor={Colors.textMuted}
            />

            {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}
            {passwordSuccess ? <Text style={styles.passwordSuccess}>{passwordSuccess}</Text> : null}

            <TouchableOpacity
              style={styles.passwordButton}
              onPress={handlePasswordSave}
              disabled={passwordLoading}
              activeOpacity={0.85}
            >
              {passwordLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.passwordButtonText}>{hasPassword ? 'Cập nhật mật khẩu' : 'Đặt mật khẩu'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showRegionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRegionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRegionModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('settings.region')}</Text>
            <Text style={styles.passwordHint}>
              Khu vực này được dùng để cá nhân hóa nội dung traveler như ưu tiên ngôn ngữ và đề xuất địa phương.
            </Text>

            <TextInput
              style={styles.passwordInput}
              value={regionDraft}
              onChangeText={setRegionDraft}
              placeholder={t('settings.regionName')}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.passwordButton}
              onPress={handleRegionSave}
              disabled={syncingKey === 'region'}
              activeOpacity={0.85}
            >
              {syncingKey === 'region' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.passwordButtonText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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

  // Language Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    paddingTop: Spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  langOptionActive: {
    backgroundColor: 'rgba(249, 168, 37, 0.1)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  langFlag: { fontSize: 28 },
  langInfo: { flex: 1 },
  langNative: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
  },
  langNativeActive: { color: Colors.primary },
  langName: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  langCheck: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: Fonts.weights.bold as any,
  },
  passwordHint: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  passwordInput: {
    width: '100%',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: Fonts.sizes.base,
    marginBottom: Spacing.sm,
  },
  passwordButton: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  passwordButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
  },
  passwordError: {
    color: Colors.error,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  passwordSuccess: {
    color: '#4CAF50',
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
});
