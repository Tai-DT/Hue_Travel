import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native';
import { Colors, Fonts, Spacing } from './src/constants/theme';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import MapScreen from './src/screens/MapScreen';
import BookingScreen from './src/screens/BookingScreen';
import ChatScreen from './src/screens/ChatScreen';
import AIGuideScreen from './src/screens/AIGuideScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationScreen from './src/screens/NotificationScreen';

// ============================================
// App State & Types
// ============================================
type AppScreen = 'welcome' | 'login' | 'main';
type MainTab = 'home' | 'explore' | 'ai' | 'bookings' | 'profile';

const TAB_CONFIG: Array<{
  key: MainTab;
  icon: string;
  activeIcon: string;
  label: string;
  badge?: number;
}> = [
  { key: 'home', icon: '🏠', activeIcon: '🏡', label: 'Trang chủ' },
  { key: 'explore', icon: '🔍', activeIcon: '🗺️', label: 'Khám phá' },
  { key: 'ai', icon: '🤖', activeIcon: '✨', label: 'AI Guide' },
  { key: 'bookings', icon: '📋', activeIcon: '📅', label: 'Đặt chỗ' },
  { key: 'profile', icon: '👤', activeIcon: '😊', label: 'Tôi' },
];

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [token, setToken] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const handleGetStarted = useCallback(() => {
    setScreen('login');
  }, []);

  const handleLoginSuccess = useCallback((t: string) => {
    setToken(t);
    setScreen('main');
  }, []);

  const handleOpenChat = useCallback(() => {
    setShowChat(true);
  }, []);

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
          <Text style={styles.chatBackText}>← Quay lại</Text>
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

  // Main app with bottom tabs
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === 'home' && <HomeScreen />}
        {activeTab === 'explore' && <MapScreen />}
        {activeTab === 'ai' && <AIGuideScreen />}
        {activeTab === 'bookings' && <BookingScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Floating Buttons */}
      <TouchableOpacity style={styles.floatingNotif} onPress={() => setShowNotifs(true)}>
        <Text style={styles.floatingNotifIcon}>🔔</Text>
        <View style={styles.floatingChatBadge}>
          <Text style={styles.floatingChatBadgeText}>2</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.floatingChat} onPress={handleOpenChat}>
        <Text style={styles.floatingChatIcon}>💬</Text>
        <View style={styles.floatingChatBadge}>
          <Text style={styles.floatingChatBadgeText}>2</Text>
        </View>
      </TouchableOpacity>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {TAB_CONFIG.map((tab) => (
          <TabItem
            key={tab.key}
            icon={activeTab === tab.key ? tab.activeIcon : tab.icon}
            label={tab.label}
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
