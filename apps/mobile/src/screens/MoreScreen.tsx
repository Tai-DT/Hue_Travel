import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, {
  Achievement, GamificationStats, WeatherCurrent, WeatherDay,
  Promotion, Coupon, EmergencyContact, BlogPost, BlogComment, DiaryEntry, HueEvent, Collection,
} from '@/services/api';

type MoreSection = 'menu' | 'gamification' | 'weather' | 'sos' | 'promotions' | 'blog' | 'diary' | 'map' | 'translate' | 'collections';

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
           section === 'collections' ? '📑 Bộ sưu tập' :
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
      {section === 'collections' && <CollectionsSection />}
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
    { key: 'collections', icon: '📑', label: 'Bộ sưu tập', desc: 'Lưu & tổ chức trải nghiệm yêu thích', color: '#EC407A' },
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
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, BlogComment[]>>({});
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState<string | null>(null);
  const [commentPosting, setCommentPosting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api.getBlogPosts();
      if (res.success && res.data?.posts) setPosts(res.data.posts);
      setLoading(false);
    })();
  }, []);

  const handleLike = async (postId: string) => {
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, is_liked: !p.is_liked, like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1 }
        : p
    ));
    await api.toggleBlogLike(postId);
  };

  const handleToggleComments = async (postId: string) => {
    if (expandedComments === postId) {
      setExpandedComments(null);
      return;
    }
    setExpandedComments(postId);
    setCommentText('');
    if (!commentsByPost[postId]) {
      setCommentLoading(postId);
      const res = await api.getBlogComments(postId);
      if (res.success && res.data?.comments) {
        setCommentsByPost(prev => ({ ...prev, [postId]: res.data!.comments }));
      } else {
        setCommentsByPost(prev => ({ ...prev, [postId]: [] }));
      }
      setCommentLoading(null);
    }
  };

  const handlePostComment = async (postId: string) => {
    if (!commentText.trim()) return;
    setCommentPosting(true);
    const res = await api.addBlogComment(postId, commentText.trim());
    if (res.success) {
      // Refresh comments
      const refreshRes = await api.getBlogComments(postId);
      if (refreshRes.success && refreshRes.data?.comments) {
        setCommentsByPost(prev => ({ ...prev, [postId]: refreshRes.data!.comments }));
      }
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
      ));
      setCommentText('');
    }
    setCommentPosting(false);
  };

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
              <Text style={styles.blogStats}>👁 {post.view_count}</Text>
            </View>
            <View style={styles.blogActions}>
              <TouchableOpacity style={styles.blogActionBtn} onPress={() => handleLike(post.id)}>
                <Text>{post.is_liked ? '❤️' : '🤍'}</Text>
                <Text style={styles.blogActionCount}>{post.like_count}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.blogActionBtn} onPress={() => handleToggleComments(post.id)}>
                <Text>💬</Text>
                <Text style={styles.blogActionCount}>{post.comment_count}</Text>
              </TouchableOpacity>
            </View>

            {expandedComments === post.id && (
              <View style={styles.blogCommentsSection}>
                {commentLoading === post.id ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    {(commentsByPost[post.id] || []).length === 0 ? (
                      <Text style={styles.blogNoComments}>Chưa có bình luận.</Text>
                    ) : (
                      (commentsByPost[post.id] || []).map(c => (
                        <View key={c.id} style={styles.blogCommentItem}>
                          <Text style={styles.blogCommentAuthor}>{c.user?.full_name || 'Người dùng'}</Text>
                          <Text style={styles.blogCommentContent}>{c.content}</Text>
                        </View>
                      ))
                    )}
                    <View style={styles.createForm}>
                      <TextInput
                        style={styles.createInput}
                        placeholder="Viết bình luận..."
                        placeholderTextColor={Colors.textMuted}
                        value={commentText}
                        onChangeText={setCommentText}
                        maxLength={300}
                      />
                      <TouchableOpacity
                        style={[styles.createSubmitBtn, !commentText.trim() && { opacity: 0.5 }]}
                        onPress={() => handlePostComment(post.id)}
                        disabled={!commentText.trim() || commentPosting}
                      >
                        {commentPosting
                          ? <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                          : <Text style={styles.createSubmitText}>Gửi</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
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
// Collections
// ============================================
function CollectionsSection() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getCollections();
    if (res.success && res.data?.collections) setCollections(res.data.collections);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await api.createCollection(newName.trim());
    if (res.success && res.data?.collection) {
      setCollections(prev => [res.data!.collection, ...prev]);
      setNewName('');
      setShowCreate(false);
    } else {
      Alert.alert('Lỗi', res.error?.message || 'Không thể tạo bộ sưu tập');
    }
    setCreating(false);
  };

  if (loading) return <LoadingView />;

  return (
    <ScrollView style={styles.sectionScroll} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => setShowCreate(!showCreate)}
      >
        <Text style={styles.createBtnText}>
          {showCreate ? '✕ Huỷ' : '+ Tạo bộ sưu tập mới'}
        </Text>
      </TouchableOpacity>

      {showCreate && (
        <View style={styles.createForm}>
          <TextInput
            style={styles.createInput}
            placeholder="Tên bộ sưu tập (VD: Ẩm thực Huế)"
            placeholderTextColor={Colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            maxLength={100}
          />
          <TouchableOpacity
            style={[styles.createSubmitBtn, !newName.trim() && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={!newName.trim() || creating}
          >
            {creating
              ? <ActivityIndicator size="small" color={Colors.textOnPrimary} />
              : <Text style={styles.createSubmitText}>Tạo</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {collections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 48 }}>📑</Text>
          <Text style={styles.emptyTitle}>Chưa có bộ sưu tập</Text>
          <Text style={styles.emptyDesc}>Tạo bộ sưu tập để lưu các trải nghiệm yêu thích!</Text>
        </View>
      ) : (
        collections.map(col => (
          <View key={col.id} style={styles.collectionCard}>
            <View style={styles.collectionIcon}>
              <Text style={{ fontSize: 24 }}>📑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.collectionName}>{col.name}</Text>
              {col.description ? (
                <Text style={styles.collectionDesc} numberOfLines={1}>{col.description}</Text>
              ) : null}
              <Text style={styles.collectionMeta}>{col.item_count} mục</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
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
  blogActions: {
    flexDirection: 'row' as const,
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  blogActionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  blogActionCount: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  blogCommentsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  blogNoComments: { color: Colors.textMuted, fontSize: Fonts.sizes.sm, textAlign: 'center' as const, paddingVertical: Spacing.sm },
  blogCommentItem: { marginBottom: Spacing.sm },
  blogCommentAuthor: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  blogCommentContent: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },

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

  // Shared
  sectionScroll: { flex: 1 },
  emptyWrap: { alignItems: 'center' as const, paddingTop: 60 },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  emptyDesc: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: 'center' as const },

  // Create
  createBtn: {
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
  },
  createBtnText: { color: Colors.primary, fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.semibold as any },
  createForm: {
    flexDirection: 'row' as const,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  createInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: Fonts.sizes.sm,
  },
  createSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center' as const,
  },
  createSubmitText: { color: Colors.textOnPrimary, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any },

  // Collections
  collectionCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  collectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(236, 64, 122, 0.15)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  collectionName: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  collectionDesc: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },
  collectionMeta: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
});
