import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, {
  Achievement, GamificationStats, WeatherCurrent, WeatherDay,
  Promotion, Coupon, EmergencyContact, BlogPost, DiaryEntry, HueEvent,
} from '@/services/api';

type MoreSection = 'menu' | 'gamification' | 'weather' | 'sos' | 'promotions' | 'blog' | 'diary' | 'map' | 'translate';

export default function MoreScreen() {
  const [section, setSection] = useState<MoreSection>('menu');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {section !== 'menu' && (
          <TouchableOpacity onPress={() => setSection('menu')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Trở lại</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {section === 'menu' ? 'Thêm' :
           section === 'gamification' ? '🎮 Thành tích' :
           section === 'weather' ? '🌤️ Thời tiết' :
           section === 'sos' ? '🆘 Khẩn cấp' :
           section === 'promotions' ? '🎁 Khuyến mãi' :
           section === 'blog' ? '📝 Blog' :
           section === 'map' ? '🗺️ Bản đồ' :
           section === 'translate' ? '🌍 Dịch thuật' :
           '📔 Nhật ký'}
        </Text>
      </View>

      {section === 'menu' && <MenuGrid onSelect={setSection} />}
      {section === 'gamification' && <GamificationSection />}
      {section === 'weather' && <WeatherSection />}
      {section === 'sos' && <SOSSection />}
      {section === 'promotions' && <PromotionsSection />}
      {section === 'blog' && <BlogSection />}
      {section === 'diary' && <DiarySection />}
      {section === 'map' && <MapSection />}
      {section === 'translate' && <TranslateSection />}
    </View>
  );
}

// ============================================
// Menu Grid
// ============================================
function MenuGrid({ onSelect }: { onSelect: (s: MoreSection) => void }) {
  const items: { key: MoreSection; icon: string; label: string; desc: string; color: string }[] = [
    { key: 'gamification', icon: '🎮', label: 'Thành tích & XP', desc: 'Huy hiệu, bảng xếp hạng, check-in', color: '#FF9800' },
    { key: 'weather', icon: '🌤️', label: 'Thời tiết Huế', desc: 'Dự báo & thời điểm tốt nhất', color: '#42A5F5' },
    { key: 'sos', icon: '🆘', label: 'Khẩn cấp', desc: 'SOS, liên hệ cứu trợ, bệnh viện', color: '#EF5350' },
    { key: 'promotions', icon: '🎁', label: 'Khuyến mãi', desc: 'Mã giảm giá & ưu đãi', color: '#4CAF50' },
    { key: 'blog', icon: '📝', label: 'Blog du lịch', desc: 'Bài viết & chia sẻ kinh nghiệm', color: '#AB47BC' },
    { key: 'diary', icon: '📔', label: 'Nhật ký', desc: 'Ghi lại kỷ niệm tại Huế', color: '#26A69A' },
    { key: 'map', icon: '🗺️', label: 'Bản đồ', desc: 'Khám phá địa điểm & chỉ đường', color: '#5C6BC0' },
    { key: 'translate', icon: '🌍', label: 'Dịch thuật', desc: 'Dịch ngôn ngữ & sổ tay cụm từ', color: '#78909C' },
  ];

  return (
    <ScrollView style={styles.menuGrid} showsVerticalScrollIndicator={false}>
      {items.map((item) => (
        <TouchableOpacity key={item.key} style={styles.menuItem} onPress={() => onSelect(item.key)}>
          <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
            <Text style={{ fontSize: 28 }}>{item.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuDesc}>{item.desc}</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Gamification
// ============================================
function GamificationSection() {
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const load = useCallback(async () => {
    const [statsRes, achRes] = await Promise.all([
      api.getGamificationStats(),
      api.getMyAchievements(),
    ]);
    if (statsRes.success && statsRes.data) setStats(statsRes.data);
    if (achRes.success && achRes.data?.achievements) setAchievements(achRes.data.achievements);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    const res = await api.dailyCheckIn();
    if (res.success && res.data) {
      Alert.alert('🎉 Check-in!', `+${res.data.xp_earned} XP\nStreak: ${res.data.streak} ngày`);
      load();
    } else {
      Alert.alert('Thông báo', res.error?.message || 'Đã check-in hôm nay rồi!');
    }
    setCheckingIn(false);
  };

  if (loading) return <LoadingView />;

  return (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Stats Card */}
      {stats && (
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.xp}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.level}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>🔥 {stats.streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>#{stats.rank || '—'}</Text>
              <Text style={styles.statLabel}>Rank</Text>
            </View>
          </View>

          {/* XP Progress */}
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${Math.min((stats.xp / stats.next_level_xp) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.xpLabel}>{stats.xp} / {stats.next_level_xp} XP</Text>

          <TouchableOpacity style={styles.checkInBtn} onPress={handleCheckIn} disabled={checkingIn}>
            {checkingIn
              ? <ActivityIndicator color={Colors.textOnPrimary} />
              : <Text style={styles.checkInText}>📍 Check-in hôm nay</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Achievements */}
      <Text style={styles.sectionTitle}>🏆 Thành tích</Text>
      {achievements.length === 0 ? (
        <Text style={styles.emptyNote}>Chưa có thành tích nào.</Text>
      ) : (
        achievements.map((ach) => (
          <View key={ach.id} style={[styles.achCard, ach.is_unlocked && styles.achUnlocked]}>
            <Text style={{ fontSize: 28 }}>{ach.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.achTitle}>{ach.title}</Text>
              <Text style={styles.achDesc}>{ach.description}</Text>
              {ach.progress !== undefined && ach.target && (
                <View style={styles.achProgress}>
                  <View style={[styles.achProgressFill, { width: `${Math.min((ach.progress / ach.target) * 100, 100)}%` }]} />
                </View>
              )}
            </View>
            <Text style={styles.achXP}>+{ach.xp_reward} XP</Text>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Weather
// ============================================
function WeatherSection() {
  const [current, setCurrent] = useState<WeatherCurrent | null>(null);
  const [forecast, setForecast] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [curRes, foreRes] = await Promise.all([
        api.getCurrentWeather(),
        api.getWeatherForecast(),
      ]);
      if (curRes.success && curRes.data) setCurrent(curRes.data);
      if (foreRes.success && foreRes.data?.forecast) setForecast(foreRes.data.forecast);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingView />;

  return (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {current && (
        <View style={styles.weatherCard}>
          <Text style={styles.weatherIcon}>{current.icon || '☀️'}</Text>
          <Text style={styles.weatherTemp}>{current.temperature}°C</Text>
          <Text style={styles.weatherDesc}>{current.description}</Text>
          <View style={styles.weatherDetails}>
            <Text style={styles.weatherDetail}>🌡️ Cảm giác {current.feels_like}°C</Text>
            <Text style={styles.weatherDetail}>💧 Độ ẩm {current.humidity}%</Text>
            <Text style={styles.weatherDetail}>💨 Gió {current.wind_speed} km/h</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>📅 Dự báo</Text>
      {forecast.map((day, i) => (
        <View key={i} style={styles.forecastRow}>
          <Text style={styles.forecastDate}>{new Date(day.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: 'short' })}</Text>
          <Text style={{ fontSize: 20 }}>{day.icon || '☁️'}</Text>
          <Text style={styles.forecastTemp}>{day.temp_low}° — {day.temp_high}°</Text>
          <Text style={styles.forecastRain}>🌧 {day.rain_chance}%</Text>
        </View>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// SOS
// ============================================
function SOSSection() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.getEmergencyContacts();
      if (res.success && res.data?.contacts) setContacts(res.data.contacts);
      setLoading(false);
    })();
  }, []);

  const handleSOS = () => {
    Alert.alert(
      '🆘 Gửi tín hiệu SOS',
      'Bạn có chắc chắn muốn gửi tín hiệu khẩn cấp? Vị trí GPS của bạn sẽ được chia sẻ.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'GỬI SOS', style: 'destructive',
          onPress: async () => {
            const res = await api.sendSOS({ lat: 16.4637, lng: 107.5909 });
            if (res.success) Alert.alert('Đã gửi SOS', 'Tín hiệu khẩn cấp đã được gửi.');
          },
        },
      ]
    );
  };

  if (loading) return <LoadingView />;

  return (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
        <Text style={styles.sosBtnIcon}>🆘</Text>
        <Text style={styles.sosBtnText}>GỬI TÍN HIỆU KHẨN CẤP</Text>
        <Text style={styles.sosBtnNote}>Chia sẻ vị trí GPS + cảnh báo</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>📞 Liên hệ khẩn cấp</Text>
      {contacts.map((c, i) => (
        <View key={i} style={styles.contactCard}>
          <View style={styles.contactIcon}>
            <Text style={{ fontSize: 20 }}>
              {c.type === 'police' ? '🚔' : c.type === 'fire' ? '🚒' : c.type === 'ambulance' ? '🚑' : '📞'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactName}>{c.name}</Text>
            {c.description && <Text style={styles.contactDesc}>{c.description}</Text>}
          </View>
          <Text style={styles.contactPhone}>{c.phone}</Text>
        </View>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Promotions
// ============================================
function PromotionsSection() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [promoRes, couponRes] = await Promise.all([
        api.getActivePromotions(),
        api.getMyCoupons(),
      ]);
      if (promoRes.success && promoRes.data?.promotions) setPromos(promoRes.data.promotions);
      if (couponRes.success && couponRes.data?.coupons) setCoupons(couponRes.data.coupons);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingView />;

  return (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>🔥 Đang khuyến mãi</Text>
      {promos.length === 0 ? (
        <Text style={styles.emptyNote}>Chưa có khuyến mãi nào.</Text>
      ) : (
        promos.map((p) => (
          <View key={p.id} style={styles.promoCard}>
            <View style={styles.promoDiscount}>
              <Text style={styles.promoDiscountText}>
                {p.discount_type === 'percentage' ? `-${p.discount_value}%` : `-${p.discount_value.toLocaleString()}₫`}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>{p.title}</Text>
              <Text style={styles.promoDesc}>{p.description}</Text>
              <Text style={styles.promoCode}>Mã: {p.code}</Text>
            </View>
          </View>
        ))
      )}

      {coupons.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>🎫 Mã của bạn</Text>
          {coupons.map((c) => (
            <View key={c.id} style={[styles.couponCard, c.is_used && styles.couponUsed]}>
              <Text style={styles.couponCode}>{c.code}</Text>
              <Text style={styles.couponValue}>
                {c.discount_type === 'percentage' ? `-${c.discount_value}%` : `-${c.discount_value.toLocaleString()}₫`}
              </Text>
              {c.is_used && <Text style={styles.couponUsedText}>Đã sử dụng</Text>}
            </View>
          ))}
        </>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Blog
// ============================================
function BlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.getBlogPosts();
      if (res.success && res.data?.posts) setPosts(res.data.posts);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingView />;

  return (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {posts.length === 0 ? (
        <Text style={styles.emptyNote}>Chưa có bài viết nào.</Text>
      ) : (
        posts.map((post) => (
          <View key={post.id} style={styles.blogCard}>
            <Text style={styles.blogTitle}>{post.title}</Text>
            {post.excerpt && <Text style={styles.blogExcerpt} numberOfLines={3}>{post.excerpt}</Text>}
            <View style={styles.blogMeta}>
              <Text style={styles.blogAuthor}>✍️ {post.author?.full_name || 'Ẩn danh'}</Text>
              <Text style={styles.blogStats}>❤️ {post.like_count} · 💬 {post.comment_count} · 👁 {post.view_count}</Text>
            </View>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Diary
// ============================================
function DiarySection() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.getMyDiary();
      if (res.success && res.data?.entries) setEntries(res.data.entries);
      setLoading(false);
    })();
  }, []);

  const moodIcon = (mood?: string) => {
    const moods: Record<string, string> = { happy: '😊', excited: '🤩', peaceful: '😌', sad: '😢', tired: '😴' };
    return moods[mood || ''] || '📝';
  };

  if (loading) return <LoadingView />;

  return (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {entries.length === 0 ? (
        <Text style={styles.emptyNote}>Chưa có nhật ký nào. Bắt đầu ghi lại kỷ niệm tại Huế!</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.diaryCard}>
            <View style={styles.diaryHeader}>
              <Text style={{ fontSize: 24 }}>{moodIcon(entry.mood)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.diaryTitle}>{entry.title}</Text>
                <Text style={styles.diaryDate}>
                  {new Date(entry.created_at).toLocaleDateString('vi-VN')}
                  {entry.location ? ` · 📍 ${entry.location}` : ''}
                </Text>
              </View>
              {entry.is_public && (
                <View style={styles.publicTag}>
                  <Text style={styles.publicTagText}>Công khai</Text>
                </View>
              )}
            </View>
            <Text style={styles.diaryContent} numberOfLines={4}>{entry.content}</Text>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Map (wraps existing MapScreen)
// ============================================
import MapScreen from '@/screens/MapScreen';

function MapSection() {
  return <MapScreen />;
}

// ============================================
// Translate
// ============================================
function TranslateSection() {
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('en');
  const [result, setResult] = useState('');
  const [translating, setTranslating] = useState(false);
  const [phrasebook, setPhrasebook] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const res = await api.getPhrasebook();
      if (res.success && res.data?.categories) setPhrasebook(res.data.categories);
    })();
  }, []);

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setTranslating(true);
    const res = await api.translateText(text.trim(), targetLang);
    if (res.success && res.data) setResult(res.data.translated);
    setTranslating(false);
  };

  const langs = [
    { code: 'en', label: '🇬🇧 EN' },
    { code: 'ko', label: '🇰🇷 KO' },
    { code: 'ja', label: '🇯🇵 JA' },
    { code: 'zh', label: '🇨🇳 ZH' },
    { code: 'vi', label: '🇻🇳 VI' },
  ];

  return (
    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.translateCard}>
        <TextInput
          style={styles.translateInput}
          placeholder="Nhập văn bản cần dịch..."
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <View style={styles.langRow}>
          {langs.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langBtn, targetLang === l.code && styles.langBtnActive]}
              onPress={() => setTargetLang(l.code)}
            >
              <Text style={[styles.langBtnText, targetLang === l.code && styles.langBtnTextActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.translateBtn, !text.trim() && { opacity: 0.4 }]}
          onPress={handleTranslate}
          disabled={!text.trim() || translating}
        >
          {translating
            ? <ActivityIndicator color={Colors.textOnPrimary} />
            : <Text style={styles.translateBtnText}>Dịch →</Text>
          }
        </TouchableOpacity>
        {result ? (
          <View style={styles.translateResult}>
            <Text style={styles.translateResultText}>{result}</Text>
          </View>
        ) : null}
      </View>

      {phrasebook.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>📖 Sổ tay cụm từ</Text>
          {phrasebook.map((cat, i) => (
            <View key={i} style={styles.phraseCategory}>
              <Text style={styles.phraseCatTitle}>{cat.category}</Text>
              {(cat.phrases || []).slice(0, 5).map((p: any, j: number) => (
                <View key={j} style={styles.phraseRow}>
                  <Text style={styles.phraseVi}>{p.vi}</Text>
                  <Text style={styles.phraseEn}>{p.en}</Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Shared
// ============================================
function LoadingView() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
  },
  backBtn: { marginBottom: Spacing.sm },
  backBtnText: { color: Colors.primary, fontSize: Fonts.sizes.base },
  scrollContent: { flex: 1, paddingHorizontal: Spacing.xl },
  sectionTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  emptyNote: { color: Colors.textMuted, fontSize: Fonts.sizes.sm, textAlign: 'center', paddingVertical: Spacing.xl },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  // Menu Grid
  menuGrid: { flex: 1, paddingHorizontal: Spacing.xl },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  menuIcon: {
    width: 56, height: 56, borderRadius: BorderRadius.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  menuDesc: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  menuArrow: { fontSize: 24, color: Colors.textMuted },

  // Gamification
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.lg },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.bold as any, color: Colors.primary },
  statLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  xpBar: {
    height: 8, backgroundColor: Colors.surfaceElevated,
    borderRadius: 4, overflow: 'hidden', marginBottom: 4,
  },
  xpFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  xpLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, textAlign: 'center' },
  checkInBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  checkInText: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.bold as any, fontSize: Fonts.sizes.base },
  achCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    opacity: 0.5,
  },
  achUnlocked: { opacity: 1, borderColor: Colors.primary },
  achTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  achDesc: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  achProgress: {
    height: 4, backgroundColor: Colors.surfaceElevated,
    borderRadius: 2, overflow: 'hidden', marginTop: 6,
  },
  achProgressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 2 },
  achXP: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.bold as any },

  // Weather
  weatherCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weatherIcon: { fontSize: 48, marginBottom: Spacing.sm },
  weatherTemp: { fontSize: 48, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  weatherDesc: { fontSize: Fonts.sizes.lg, color: Colors.textSecondary, marginBottom: Spacing.lg },
  weatherDetails: { flexDirection: 'row', gap: Spacing.lg },
  weatherDetail: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  forecastDate: { width: 80, fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  forecastTemp: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.text },
  forecastRain: { fontSize: Fonts.sizes.sm, color: Colors.info },

  // SOS
  sosBtn: {
    backgroundColor: '#EF5350',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  sosBtnIcon: { fontSize: 48, marginBottom: Spacing.sm },
  sosBtnText: { color: '#FFF', fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.bold as any },
  sosBtnNote: { color: 'rgba(255,255,255,0.7)', fontSize: Fonts.sizes.sm, marginTop: 4 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  contactIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  contactName: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  contactDesc: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  contactPhone: { fontSize: Fonts.sizes.base, color: Colors.primary, fontWeight: Fonts.weights.bold as any },

  // Promotions
  promoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    alignItems: 'center',
  },
  promoDiscount: {
    backgroundColor: 'rgba(76,175,80,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  promoDiscountText: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.success },
  promoTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  promoDesc: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  promoCode: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.bold as any, marginTop: 4 },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    gap: Spacing.md,
  },
  couponUsed: { opacity: 0.4 },
  couponCode: { flex: 1, fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.bold as any, color: Colors.text, fontFamily: 'monospace' },
  couponValue: { fontSize: Fonts.sizes.base, color: Colors.success, fontWeight: Fonts.weights.bold as any },
  couponUsedText: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },

  // Blog
  blogCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blogTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginBottom: Spacing.sm },
  blogExcerpt: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  blogMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  blogAuthor: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  blogStats: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },

  // Diary
  diaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  diaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  diaryTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  diaryDate: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  publicTag: {
    backgroundColor: 'rgba(66,165,245,0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  publicTagText: { fontSize: Fonts.sizes.xs, color: Colors.info },
  diaryContent: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Translate
  translateCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  translateInput: {
    color: Colors.text,
    fontSize: Fonts.sizes.base,
    minHeight: 80,
    textAlignVertical: 'top' as const,
    marginBottom: Spacing.md,
  },
  langRow: { flexDirection: 'row' as const, gap: Spacing.xs, marginBottom: Spacing.md, flexWrap: 'wrap' as const },
  langBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(249,168,37,0.12)' },
  langBtnText: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  langBtnTextActive: { color: Colors.primary, fontWeight: Fonts.weights.bold as any },
  translateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center' as const,
  },
  translateBtnText: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.bold as any },
  translateResult: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
  },
  translateResultText: { color: Colors.text, fontSize: Fonts.sizes.base, lineHeight: 22 },
  phraseCategory: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phraseCatTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.bold as any, color: Colors.primary, marginBottom: Spacing.sm },
  phraseRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  phraseVi: { fontSize: Fonts.sizes.sm, color: Colors.text, flex: 1 },
  phraseEn: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, flex: 1, textAlign: 'right' as const },
});
