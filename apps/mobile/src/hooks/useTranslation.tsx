// ============================================
// useTranslation Hook — Zero-dependency i18n
// No external packages needed!
// ============================================

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
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
const LOCALE_STORAGE_KEY = 'ht_locale';

function canUseWebStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

async function readStoredLocale(): Promise<SupportedLocale | null> {
  try {
    const raw = canUseWebStorage()
      ? window.localStorage.getItem(LOCALE_STORAGE_KEY)
      : await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
    if (!raw) return null;
    return SUPPORTED_LOCALES.some((item) => item.code === raw) ? (raw as SupportedLocale) : null;
  } catch {
    return null;
  }
}

async function persistLocale(locale: SupportedLocale) {
  try {
    if (canUseWebStorage()) {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      return;
    }
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Keep locale in memory even if persistence fails.
  }
}

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readStoredLocale();
      if (!cancelled && stored) {
        setLocale(stored);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocaleAndPersist = useCallback((nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    void persistLocale(nextLocale);
  }, []);

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
    () => ({ locale, setLocale: setLocaleAndPersist, t, supportedLocales: SUPPORTED_LOCALES }),
    [locale, setLocaleAndPersist, t],
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
