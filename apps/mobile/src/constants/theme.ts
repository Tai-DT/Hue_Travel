// ============================================
// Huế Travel — Design System
// Dark premium theme with gold accents
// ============================================

export const Colors = {
  // Primary
  primary: '#F9A825',
  primaryLight: '#FFD54F',
  primaryDark: '#F57F17',
  secondary: '#FFB300',

  // Background
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceLight: '#242424',
  surfaceElevated: '#2A2A2A',

  // Text
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#666666',
  textOnPrimary: '#0A0A0A',

  // Status
  success: '#4CAF50',
  error: '#EF5350',
  warning: '#FF9800',
  info: '#42A5F5',

  // Others
  border: '#333333',
  borderLight: '#444444',
  overlay: 'rgba(0, 0, 0, 0.7)',
  star: '#FFB300',
  heart: '#EF5350',

  // Gradient
  gradientStart: '#F9A825',
  gradientEnd: '#FF6F00',
} as const;

export const Fonts = {
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    hero: 42,
  },
  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  glow: {
    shadowColor: '#F9A825',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};
