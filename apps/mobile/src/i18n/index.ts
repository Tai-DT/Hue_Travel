// ============================================
// i18n Configuration — Huế Travel Mobile
// Supports: vi 🇻🇳 | en 🇺🇸 | ja 🇯🇵 | ko 🇰🇷 | zh 🇨🇳 | hi 🇮🇳
//           th 🇹🇭 | id 🇮🇩 | ms 🇲🇾 | km 🇰🇭 | lo 🇱🇦 | tl 🇵🇭 | my 🇲🇲
// ============================================

import vi from './locales/vi.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import th from './locales/th.json';
import id from './locales/id.json';
import ms from './locales/ms.json';
import km from './locales/km.json';
import lo from './locales/lo.json';
import tl from './locales/tl.json';
import my from './locales/my.json';

export type SupportedLocale = 'vi' | 'en' | 'ja' | 'ko' | 'zh' | 'hi' | 'th' | 'id' | 'ms' | 'km' | 'lo' | 'tl' | 'my';

export const SUPPORTED_LOCALES: {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
}[] = [
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ', flag: '🇰🇭' },
  { code: 'lo', name: 'Lao', nativeName: 'ພາສາລາວ', flag: '🇱🇦' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
  { code: 'my', name: 'Myanmar', nativeName: 'မြန်မာ', flag: '🇲🇲' },
];

export const DEFAULT_LOCALE: SupportedLocale = 'vi';

// All translations
const translations: Record<SupportedLocale, typeof vi> = {
  vi, en, ja, ko, zh, hi, th, id, ms, km, lo, tl, my,
};

export default translations;
