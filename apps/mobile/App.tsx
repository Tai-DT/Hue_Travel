import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing } from './src/constants/theme';
import api, { Booking, Experience, User } from './src/services/api';
import { getInitialDeepLink, onDeepLink, DeepLinkRoute } from './src/services/deeplink';
import { offlineCache, CacheKeys } from './src/services/cache';
import { pushService } from './src/services/push';
import { I18nProvider, useTranslation } from './src/hooks/useTranslation';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import BookingScreen from './src/screens/BookingScreen';
import ChatScreen from './src/screens/ChatScreen';
import AIGuideScreen from './src/screens/AIGuideScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import ExperienceDetailScreen from './src/screens/ExperienceDetailScreen';
import PaymentScreen from './src/screens/PaymentScreen';

// ============================================
// App State & Types
// ============================================
type AppScreen = 'welcome' | 'login' | 'main';
type MainTab = 'home' | 'explore' | 'ai' | 'bookings' | 'profile';

const TAB_KEYS: Array<{
  key: MainTab;
  icon: string;
  activeIcon: string;
  i18nKey: string;
  badge?: number;
}> = [
  { key: 'home', icon: '🏠', activeIcon: '🏡', i18nKey: 'nav.home' },
  { key: 'explore', icon: '🔍', activeIcon: '🗺️', i18nKey: 'nav.explore' },
  { key: 'ai', icon: '🤖', activeIcon: '✨', i18nKey: 'nav.aiGuide' },
  { key: 'bookings', icon: '📋', activeIcon: '📅', i18nKey: 'nav.bookings' },
  { key: 'profile', icon: '👤', activeIcon: '😊', i18nKey: 'nav.profile' },
];

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileNeedsAttention, setProfileNeedsAttention] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);

  const requiresProfileCompletion = useCallback((user: User | null | undefined) => {
    if (!user) return true;
    return user.full_name === 'Người dùng mới' || !user.email;
  }, []);

  const handleGetStarted = useCallback(() => {
    setScreen('login');
  }, []);

  const applyAuthenticatedUser = useCallback((user?: User | null, isNewUser?: boolean) => {
    setCurrentUser(user || null);
    const needsAttention = Boolean(isNewUser) || requiresProfileCompletion(user);
    setProfileNeedsAttention(needsAttention);
    setActiveTab(needsAttention ? 'profile' : 'home');
  }, [requiresProfileCompletion]);

  const resetLoggedOutState = useCallback(async (nextScreen: AppScreen) => {
    setToken(null);
    setCurrentUser(null);
    setProfileNeedsAttention(false);
    setActiveTab('home');
    setShowChat(false);
    setShowNotifs(false);
    setShowSettings(false);
    setSelectedExperience(null);
    setPaymentBooking(null);
    setChatUnread(0);
    setNotifUnread(0);
    setScreen(nextScreen);
    await offlineCache.clear();
  }, []);

  const handleLoginSuccess = useCallback((t: string, user?: User, isNewUser?: boolean) => {
    setToken(t);
    applyAuthenticatedUser(user, isNewUser);
    setScreen('main');
  }, [applyAuthenticatedUser]);

  const handleLogout = useCallback(async () => {
    await api.logout();
    await api.clearSession();
    await resetLoggedOutState('login');
  }, [resetLoggedOutState]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await api.restoreSession();
      if (cancelled) return;

      if (!session) {
        setScreen('welcome');
        setIsBootstrapping(false);
        return;
      }

      setToken(session.token);
      setScreen('main');

      const cachedUser = await offlineCache.get<User>(CacheKeys.USER_PROFILE);
      if (!cancelled && cachedUser) {
        applyAuthenticatedUser(cachedUser);
      }

      const res = await api.getMe();
      if (cancelled) return;

      if (res.success && res.data) {
        const nextUser = (res.data as any).user || res.data;
        applyAuthenticatedUser(nextUser);
        await offlineCache.set(CacheKeys.USER_PROFILE, nextUser, 30 * 60 * 1000);
      } else if (!cachedUser) {
        await api.clearSession();
        await resetLoggedOutState('welcome');
      }

      setIsBootstrapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAuthenticatedUser, resetLoggedOutState]);

  useEffect(() => api.onAuthFailure(() => {
    void resetLoggedOutState('login');
  }), [resetLoggedOutState]);

  const handleOpenChat = useCallback(() => {
    setShowChat(true);
  }, []);

  const handleOpenExperience = useCallback((experience: Experience) => {
    setSelectedExperience(experience);
  }, []);

  const handleBookingCreated = useCallback((booking: Booking) => {
    setSelectedExperience(null);
    setPaymentBooking(booking);
  }, []);

  const handleClosePayment = useCallback(() => {
    setPaymentBooking(null);
    setActiveTab('bookings');
  }, []);

  const refreshBadges = useCallback(async () => {
    if (screen !== 'main' || !token) return;

    const [roomsRes, notifRes] = await Promise.all([
      api.getChatRooms(),
      api.getUnreadNotificationCount(),
    ]);

    if (roomsRes.success && roomsRes.data?.rooms) {
      setChatUnread(roomsRes.data.rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0));
    }

    if (notifRes.success && notifRes.data) {
      setNotifUnread(notifRes.data.unread_count || 0);
    }
  }, [screen, token]);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges, activeTab, showChat, showNotifs]);

  // Deep Linking handler
  const handleDeepLinkRoute = useCallback(async (route: DeepLinkRoute) => {
    if (screen !== 'main') return;
    switch (route.type) {
      case 'experience':
        const expRes = await api.getExperience(route.id);
        if (expRes.success && expRes.data) setSelectedExperience(expRes.data);
        break;
      case 'booking':
        setActiveTab('bookings');
        break;
      case 'chat':
        setShowChat(true);
        break;
      case 'profile':
        setActiveTab('profile');
        break;
    }
  }, [screen]);

  // Deep linking — initial URL (cold start)
  useEffect(() => {
    if (screen !== 'main') return;
    getInitialDeepLink().then(route => {
      if (route) handleDeepLinkRoute(route);
    });
  }, [screen, handleDeepLinkRoute]);

  // Deep linking — incoming URLs (warm start)
  useEffect(() => {
    if (screen !== 'main') return;
    return onDeepLink(handleDeepLinkRoute);
  }, [screen, handleDeepLinkRoute]);

  // Push notification foreground handler
  useEffect(() => {
    if (screen !== 'main') return;
    return pushService.onNotification((notification) => {
      // Refresh badges when a notification arrives
      refreshBadges();

      // Auto-navigate for certain notification types
      const type = notification.data?.type;
      if (type === 'new_message') {
        setChatUnread(prev => prev + 1);
      } else if (type === 'booking_confirmed' || type === 'booking_cancelled') {
        // Invalidate booking cache
        offlineCache.invalidate(CacheKeys.BOOKINGS);
        setNotifUnread(prev => prev + 1);
      }
    });
  }, [screen, refreshBadges]);

  useEffect(() => {
    if (screen !== 'main' || !token || currentUser) return;

    let cancelled = false;
    (async () => {
      // Try cached user first
      const cached = await offlineCache.get<User>(CacheKeys.USER_PROFILE);
      if (!cancelled && cached) {
        setCurrentUser(cached);
        setProfileNeedsAttention(requiresProfileCompletion(cached));
      }

      // Then fetch fresh
      const res = await api.getMe();
      if (!cancelled && res.success && res.data) {
        const nextUser = (res.data as any).user || res.data;
        setCurrentUser(nextUser);
        setProfileNeedsAttention(requiresProfileCompletion(nextUser));
        void offlineCache.set(CacheKeys.USER_PROFILE, nextUser, 30 * 60 * 1000);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, token, currentUser, requiresProfileCompletion]);

  if (isBootstrapping) {
    return (
      <View style={styles.bootContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.bootText}>{t('common.loading')}</Text>
      </View>
    );
  }

  // Auth screens
  if (screen === 'welcome') {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <WelcomeScreen onGetStarted={handleGetStarted} />
      </>
    );
  }

  if (screen === 'login') {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  if (paymentBooking) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <PaymentScreen booking={paymentBooking} onBack={handleClosePayment} />
      </>
    );
  }

  if (selectedExperience) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <ExperienceDetailScreen
          experience={selectedExperience}
          onBack={() => setSelectedExperience(null)}
          onBookingCreated={handleBookingCreated}
        />
      </>
    );
  }

  // Chat overlay
  if (showChat) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <ChatScreen />
        <TouchableOpacity
          style={styles.chatBackBtn}
          onPress={() => setShowChat(false)}
        >
          <Text style={styles.chatBackText}>← {t('common.back')}</Text>
        </TouchableOpacity>
      </>
    );
  }

  // Notification overlay
  if (showNotifs) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <NotificationScreen onBack={() => setShowNotifs(false)} />
      </>
    );
  }

  // Settings overlay
  if (showSettings) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <SettingsScreen
          onBack={() => setShowSettings(false)}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // Main app with bottom tabs
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === 'home' && (
          <HomeScreen
            onOpenExplore={() => setActiveTab('explore')}
            onOpenAI={() => setActiveTab('ai')}
            onSelectExperience={handleOpenExperience}
            userName={currentUser?.full_name}
          />
        )}
        {activeTab === 'explore' && <MapScreen />}
        {activeTab === 'ai' && <AIGuideScreen />}
        {activeTab === 'bookings' && (
          <BookingScreen onOpenPayment={setPaymentBooking} />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen
            highlightIncompleteProfile={profileNeedsAttention}
            onProfileUpdated={(user) => {
              setCurrentUser(user);
              setProfileNeedsAttention(requiresProfileCompletion(user));
            }}
            onOpenSettings={() => setShowSettings(true)}
            onLogout={handleLogout}
          />
        )}
      </View>

      {/* Floating Buttons */}
      <TouchableOpacity style={styles.floatingNotif} onPress={() => setShowNotifs(true)}>
        <Text style={styles.floatingNotifIcon}>🔔</Text>
        {notifUnread > 0 ? (
          <View style={styles.floatingChatBadge}>
            <Text style={styles.floatingChatBadgeText}>{notifUnread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity style={styles.floatingChat} onPress={handleOpenChat}>
        <Text style={styles.floatingChatIcon}>💬</Text>
        {chatUnread > 0 ? (
          <View style={styles.floatingChatBadge}>
            <Text style={styles.floatingChatBadgeText}>{chatUnread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {TAB_KEYS.map((tab) => (
          <TabItem
            key={tab.key}
            icon={activeTab === tab.key ? tab.activeIcon : tab.icon}
            label={t(tab.i18nKey)}
            tab={tab.key}
            active={activeTab === tab.key}
            onPress={setActiveTab}
            badge={tab.badge}
            isCenter={tab.key === 'ai'}
          />
        ))}
      </View>
    </View>
  );
}

// ============================================
// Tab Item Component
// ============================================
function TabItem({
  icon, label, tab, active, onPress, badge, isCenter,
}: {
  icon: string;
  label: string;
  tab: MainTab;
  active: boolean;
  onPress: (tab: MainTab) => void;
  badge?: number;
  isCenter?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabItem, isCenter && styles.tabItemCenter]}
      onPress={() => onPress(tab)}
      activeOpacity={0.7}
    >
      {isCenter ? (
        <View style={[styles.centerTabBtn, active && styles.centerTabBtnActive]}>
          <Text style={styles.centerTabIcon}>{icon}</Text>
        </View>
      ) : (
        <View style={styles.tabIconContainer}>
          <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
          {badge ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
      )}
      <Text style={[
        styles.tabLabel,
        active && styles.tabLabelActive,
        isCenter && styles.centerTabLabel,
      ]}>{label}</Text>
      {active && !isCenter && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  bootText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: Fonts.weights.medium,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 24,
    paddingTop: Spacing.xs,
    alignItems: 'flex-end',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    position: 'relative',
  },
  tabItemCenter: {
    marginTop: -20,
  },
  tabIconContainer: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: Fonts.weights.medium as any,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold as any,
  },
  tabIndicator: {
    position: 'absolute',
    top: -Spacing.xs,
    width: 20,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.error,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: Fonts.weights.bold as any,
    color: '#FFF',
  },

  // Center AI Tab
  centerTabBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  centerTabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  centerTabIcon: {
    fontSize: 24,
  },
  centerTabLabel: {
    marginTop: 4,
  },

  // Floating Chat
  floatingChat: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  floatingChatIcon: {
    fontSize: 24,
  },

  // Floating Notification
  floatingNotif: {
    position: 'absolute',
    right: 20,
    bottom: 168,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  floatingNotifIcon: {
    fontSize: 20,
  },
  floatingChatBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.error,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  floatingChatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },

  // Chat back button
  chatBackBtn: {
    position: 'absolute',
    top: 55,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 200,
  },
  chatBackText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
