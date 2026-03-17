import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Experience, Booking } from '@/services/api';

// ============================================
// Navigation Context — Centralized navigation
// ============================================

export type MainTab = 'home' | 'social' | 'ai' | 'bookings' | 'more';
export type AppScreen = 'welcome' | 'login' | 'main';

type NavigationState = {
  screen: AppScreen;
  activeTab: MainTab;
  showChat: boolean;
  showNotifs: boolean;
  showSettings: boolean;
  showProfile: boolean;
  selectedExperience: Experience | null;
  paymentBooking: Booking | null;

  setScreen: (s: AppScreen) => void;
  setActiveTab: (t: MainTab) => void;
  openChat: () => void;
  closeChat: () => void;
  openNotifs: () => void;
  closeNotifs: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openProfile: () => void;
  closeProfile: () => void;
  openExperience: (exp: Experience) => void;
  closeExperience: () => void;
  openPayment: (booking: Booking) => void;
  closePayment: () => void;
  resetToMain: () => void;
};

const NavigationContext = createContext<NavigationState | null>(null);

export function useNavigation(): NavigationState {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within <NavigationProvider>');
  return ctx;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [showChat, setShowChat] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);

  const openChat = useCallback(() => setShowChat(true), []);
  const closeChat = useCallback(() => setShowChat(false), []);
  const openNotifs = useCallback(() => setShowNotifs(true), []);
  const closeNotifs = useCallback(() => setShowNotifs(false), []);
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const openProfile = useCallback(() => setShowProfile(true), []);
  const closeProfile = useCallback(() => setShowProfile(false), []);

  const openExperience = useCallback((exp: Experience) => setSelectedExperience(exp), []);
  const closeExperience = useCallback(() => setSelectedExperience(null), []);

  const openPayment = useCallback((booking: Booking) => {
    setSelectedExperience(null);
    setPaymentBooking(booking);
  }, []);

  const closePayment = useCallback(() => {
    setPaymentBooking(null);
    setActiveTab('bookings');
  }, []);

  const resetToMain = useCallback(() => {
    setActiveTab('home');
    setShowChat(false);
    setShowNotifs(false);
    setShowSettings(false);
    setShowProfile(false);
    setSelectedExperience(null);
    setPaymentBooking(null);
  }, []);

  const value = useMemo<NavigationState>(
    () => ({
      screen, activeTab, showChat, showNotifs, showSettings,
      showProfile, selectedExperience, paymentBooking,
      setScreen, setActiveTab, openChat, closeChat,
      openNotifs, closeNotifs, openSettings, closeSettings,
      openProfile, closeProfile, openExperience, closeExperience,
      openPayment, closePayment, resetToMain,
    }),
    [
      screen, activeTab, showChat, showNotifs, showSettings,
      showProfile, selectedExperience, paymentBooking,
      openChat, closeChat, openNotifs, closeNotifs,
      openSettings, closeSettings, openProfile, closeProfile,
      openExperience, closeExperience, openPayment, closePayment, resetToMain,
    ],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
