import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { SUPPORTED_LOCALES, SupportedLocale } from '@/i18n';

// ============================================
// Settings Screen — with i18n
// ============================================

export default function SettingsScreen({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout?: () => void;
}) {
  const { t, locale, setLocale, supportedLocales } = useTranslation();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

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

  const handleLanguageSelect = (code: SupportedLocale) => {
    setLocale(code);
    setShowLanguagePicker(false);
  };

  const handleLogout = () => {
    if (!onLogout) return;
    Alert.alert(t('settings.logout'), t('common.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: onLogout },
    ]);
  };

  const currentLang = supportedLocales.find((l) => l.code === locale);

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
        { icon: '🌙', label: t('settings.darkMode'), type: 'toggle', key: 'darkMode' },
        {
          icon: '🌐',
          label: t('settings.language'),
          type: 'value',
          value: `${currentLang?.flag} ${currentLang?.nativeName}`,
          onPress: () => setShowLanguagePicker(true),
        },
        { icon: '💱', label: t('settings.currency'), type: 'value', value: t('settings.currencyName') },
        { icon: '📍', label: t('settings.region'), type: 'value', value: t('settings.regionName') },
      ],
    },
    {
      title: t('settings.security'),
      items: [
        { icon: '🔐', label: t('settings.changePassword'), type: 'link' },
        { icon: '📱', label: t('settings.twoFactor'), type: 'toggle', key: 'twoFactor' },
        { icon: '👤', label: t('settings.sessions'), type: 'value', value: t('settings.devices', { count: 2 }) },
        { icon: '🔑', label: t('settings.connectedGoogle'), type: 'value', value: t('settings.connected'), color: '#4CAF50' },
      ],
    },
    {
      title: t('settings.app'),
      items: [
        { icon: '💾', label: t('settings.cacheSize'), type: 'value', value: '24.5 MB' },
        { icon: '📊', label: t('settings.version'), type: 'value', value: '1.0.0' },
        { icon: '📋', label: t('settings.terms'), type: 'link' },
        { icon: '🔒', label: t('settings.privacy'), type: 'link' },
        { icon: '⭐', label: t('settings.rateApp'), type: 'link' },
      ],
    },
    {
      title: t('settings.danger'),
      items: [
        { icon: '🚪', label: t('settings.logout'), type: 'link', danger: true, onPress: handleLogout },
        { icon: '🗑️', label: t('settings.deleteAccount'), type: 'link', danger: true },
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
                    activeOpacity={item.type === 'toggle' ? 1 : 0.6}
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
});
