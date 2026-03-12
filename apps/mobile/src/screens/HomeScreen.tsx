import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import api, { Experience } from '@/services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

// Categories
const CATEGORIES = [
  { key: 'all', label: 'Tất cả', icon: '🌟' },
  { key: 'food', label: 'Ẩm thực', icon: '🍜' },
  { key: 'tour', label: 'Tour', icon: '🏛️' },
  { key: 'experience', label: 'Trải nghiệm', icon: '🎭' },
  { key: 'sightseeing', label: 'Tham quan', icon: '📸' },
  { key: 'stay', label: 'Lưu trú', icon: '🏨' },
];

export default function HomeScreen() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadExperiences();
  }, [selectedCategory]);

  const loadExperiences = async () => {
    const params = selectedCategory !== 'all' ? { category: selectedCategory } : {};
    const result = await api.getExperiences(params);
    if (result.success && result.data) {
      setExperiences(result.data);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExperiences();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Xin chào! 👋</Text>
            <Text style={styles.headerTitle}>Khám phá Huế</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Text style={styles.profileEmoji}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.7}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Tìm tour, quán ăn, trải nghiệm...</Text>
        </TouchableOpacity>

        {/* AI Trip Planner Banner */}
        <TouchableOpacity style={styles.aiBanner} activeOpacity={0.85}>
          <View style={styles.aiBannerContent}>
            <View style={styles.aiIconContainer}>
              <Text style={styles.aiIcon}>🤖</Text>
            </View>
            <View style={styles.aiBannerText}>
              <Text style={styles.aiBannerTitle}>AI Trip Planner</Text>
              <Text style={styles.aiBannerSubtitle}>
                Tạo lịch trình thông minh trong 30 giây
              </Text>
            </View>
            <Text style={styles.aiBannerArrow}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Categories */}
        <Text style={styles.sectionTitle}>Danh mục</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryChip,
                selectedCategory === cat.key && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  selectedCategory === cat.key && styles.categoryLabelActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Popular Experiences */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trải nghiệm nổi bật</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Xem tất cả →</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={experiences.length > 0 ? experiences : MOCK_EXPERIENCES}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.experiencesList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ExperienceCard experience={item} />}
        />

        {/* Top Guides */}
        <Text style={styles.sectionTitle}>Hướng dẫn viên hàng đầu</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.guidesContainer}
        >
          {MOCK_GUIDES.map((guide) => (
            <TouchableOpacity key={guide.id} style={styles.guideCard} activeOpacity={0.7}>
              <View style={styles.guideAvatar}>
                <Text style={styles.guideAvatarText}>{guide.name[0]}</Text>
              </View>
              <Text style={styles.guideName} numberOfLines={1}>{guide.name}</Text>
              <View style={styles.guideRating}>
                <Text style={styles.guideStar}>⭐</Text>
                <Text style={styles.guideRatingText}>{guide.rating}</Text>
              </View>
              <Text style={styles.guideBadge}>{guide.badge}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// Experience Card Component
function ExperienceCard({ experience }: { experience: Experience }) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };

  return (
    <TouchableOpacity style={styles.expCard} activeOpacity={0.85}>
      {/* Image */}
      <View style={styles.expImageContainer}>
        <View style={styles.expImagePlaceholder}>
          <Text style={styles.expImageEmoji}>
            {experience.category === 'food' ? '🍜' : '🏛️'}
          </Text>
        </View>
        {experience.is_instant && (
          <View style={styles.instantBadge}>
            <Text style={styles.instantText}>⚡ Đặt ngay</Text>
          </View>
        )}
        <TouchableOpacity style={styles.heartButton}>
          <Text style={styles.heartIcon}>♡</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.expInfo}>
        <Text style={styles.expTitle} numberOfLines={2}>{experience.title}</Text>

        <View style={styles.expMeta}>
          <View style={styles.expRating}>
            <Text style={styles.expStar}>⭐</Text>
            <Text style={styles.expRatingText}>{experience.rating}</Text>
            <Text style={styles.expReviews}>({experience.rating_count})</Text>
          </View>
          <Text style={styles.expDuration}>
            🕐 {Math.floor(experience.duration_mins / 60)}h
          </Text>
        </View>

        <View style={styles.expFooter}>
          <Text style={styles.expPrice}>{formatPrice(experience.price)}</Text>
          <Text style={styles.expPriceUnit}>/người</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================
// Mock Data (will be replaced by API)
// ============================================

const MOCK_EXPERIENCES: Experience[] = [
  {
    id: '1',
    title: 'Food Tour Đêm Huế — Ẩm thực đường phố',
    description: '',
    category: 'food',
    price: 350000,
    max_guests: 6,
    duration_mins: 180,
    meeting_point: '',
    meeting_lat: 0,
    meeting_lng: 0,
    rating: 4.9,
    rating_count: 89,
    image_urls: [],
    is_instant: true,
    guide: { id: '1', full_name: 'Minh Tuấn', role: 'guide' },
  },
  {
    id: '2',
    title: 'Di sản Cung đình Huế — Khám phá lịch sử',
    description: '',
    category: 'tour',
    price: 500000,
    max_guests: 10,
    duration_mins: 300,
    meeting_point: '',
    meeting_lat: 0,
    meeting_lng: 0,
    rating: 4.8,
    rating_count: 38,
    image_urls: [],
    is_instant: false,
    guide: { id: '2', full_name: 'Thanh Hà', role: 'guide' },
  },
  {
    id: '3',
    title: 'Workshop Nón Lá — Làm nón truyền thống',
    description: '',
    category: 'experience',
    price: 250000,
    max_guests: 8,
    duration_mins: 120,
    meeting_point: '',
    meeting_lat: 0,
    meeting_lng: 0,
    rating: 4.7,
    rating_count: 52,
    image_urls: [],
    is_instant: true,
  },
];

const MOCK_GUIDES = [
  { id: '1', name: 'Minh Tuấn', rating: 4.9, badge: '🥇 Gold' },
  { id: '2', name: 'Thanh Hà', rating: 4.8, badge: '🥈 Silver' },
  { id: '3', name: 'Bảo Long', rating: 4.7, badge: '🥈 Silver' },
  { id: '4', name: 'Hoa Mai', rating: 4.6, badge: '🥉 Bronze' },
];

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.base,
  },
  greeting: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
  },
  headerTitle: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold,
    color: Colors.text,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileEmoji: {
    fontSize: 20,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchIcon: {
    fontSize: 18,
  },
  searchPlaceholder: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.md,
  },

  // AI Banner
  aiBanner: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  aiBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiIcon: {
    fontSize: 24,
  },
  aiBannerText: {
    flex: 1,
  },
  aiBannerTitle: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.bold,
    color: Colors.primary,
  },
  aiBannerSubtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  aiBannerArrow: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: Fonts.weights.bold,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold,
    color: Colors.text,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  seeAll: {
    fontSize: Fonts.sizes.sm,
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold,
  },

  // Categories
  categoriesContainer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    borderColor: Colors.primary,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Fonts.weights.medium,
  },
  categoryLabelActive: {
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold,
  },

  // Experience Cards
  experiencesList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.base,
  },
  expCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  expImageContainer: {
    height: 160,
    position: 'relative',
  },
  expImagePlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expImageEmoji: {
    fontSize: 48,
  },
  instantBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  instantText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.bold,
    color: Colors.textOnPrimary,
  },
  heartButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartIcon: {
    fontSize: 16,
    color: Colors.text,
  },
  expInfo: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  expTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold,
    color: Colors.text,
    lineHeight: 20,
  },
  expMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  expRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  expStar: {
    fontSize: 12,
  },
  expRatingText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold,
    color: Colors.text,
  },
  expReviews: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
  },
  expDuration: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
  },
  expFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.xs,
  },
  expPrice: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold,
    color: Colors.primary,
  },
  expPriceUnit: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginLeft: 2,
  },

  // Guides
  guidesContainer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  guideCard: {
    alignItems: 'center',
    width: 80,
    gap: Spacing.xs,
  },
  guideAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  guideAvatarText: {
    fontSize: 22,
    fontWeight: Fonts.weights.bold,
    color: Colors.primary,
  },
  guideName: {
    fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.medium,
    color: Colors.text,
    textAlign: 'center',
  },
  guideRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  guideStar: {
    fontSize: 10,
  },
  guideRatingText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: Fonts.weights.medium,
  },
  guideBadge: {
    fontSize: Fonts.sizes.xs,
    color: Colors.primaryLight,
  },
});
