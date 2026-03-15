// ============================================
// useTranslation Hook — Zero-dependency i18n
// No external packages needed!
// ============================================

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import translations, { SupportedLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';

// ---- Types ----
type TranslationData = typeof translations['vi'];
type NestedKeyOf<T> = T extends object
  ? { [K in keyof T]: K extends string ? (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : K) : never }[keyof T]
  : never;
type TranslationKey = string; // relaxed for simplicity

type I18nContextType = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  supportedLocales: typeof SUPPORTED_LOCALES;
};

// ---- Context ----
const I18nContext = createContext<I18nContextType | null>(null);

// ---- Helper: get nested value ----
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// ---- Helper: interpolate {{params}} ----
function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value)),
    text,
  );
}

// ---- Provider ----
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<SupportedLocale>(DEFAULT_LOCALE);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = getNestedValue(translations[locale], key);
      if (value === undefined) {
        // Fallback: try default locale
        const fallback = getNestedValue(translations[DEFAULT_LOCALE], key);
        if (fallback !== undefined) return interpolate(fallback, params);
        // Last resort: return key
        return key;
      }
      return interpolate(value, params);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, supportedLocales: SUPPORTED_LOCALES }),
    [locale, t],
  );

  return React.createElement(I18nContext.Provider, { value }, children);
}

// ---- Hook ----
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return ctx;
}

export default useTranslation;
