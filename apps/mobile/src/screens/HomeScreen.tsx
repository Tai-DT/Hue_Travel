import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import api, { Experience, Guide } from '@/services/api';
import { useTranslation } from '@/hooks/useTranslation';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

type Props = {
  onSelectExperience: (experience: Experience) => void;
  onOpenExplore: () => void;
  onOpenAI: () => void;
  userName?: string;
};

type GuideCardItem = {
  id: string;
  name: string;
  rating: string;
  badge: string;
};

// Category keys — labels from i18n
const CATEGORY_KEYS = [
  { key: 'all', i18nKey: 'categories.all', icon: '🌟' },
  { key: 'food', i18nKey: 'categories.food', icon: '🍜' },
  { key: 'tour', i18nKey: 'categories.tour', icon: '🏛️' },
  { key: 'experience', i18nKey: 'categories.experience', icon: '🎭' },
  { key: 'sightseeing', i18nKey: 'categories.sightseeing', icon: '📸' },
  { key: 'stay', i18nKey: 'categories.stay', icon: '🏨' },
];

function formatGuideBadge(level?: string) {
  switch (level) {
    case 'platinum':
      return '💎 Platinum';
    case 'gold':
      return '🥇 Gold';
    case 'silver':
      return '🥈 Silver';
    case 'bronze':
      return '🥉 Bronze';
    default:
      return '⭐ Huế Travel';
  }
}

function toGuideCard(guide: Guide, defaultName: string): GuideCardItem {
  return {
    id: guide.id,
    name: guide.user?.full_name || defaultName,
    rating: (guide.avg_rating || 0).toFixed(1),
    badge: formatGuideBadge(guide.badge_level),
  };
}

function getGreetingName(userName: string | undefined, defaultUser: string, defaultGreeting: string) {
  if (!userName || userName === defaultUser) return defaultGreeting;
  return userName.trim().split(' ').slice(-1)[0];
}

export default function HomeScreen({ onSelectExperience, onOpenExplore, onOpenAI, userName }: Props) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [guides, setGuides] = useState<GuideCardItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [experiencesError, setExperiencesError] = useState('');
  const [guidesError, setGuidesError] = useState('');

  const categories = useMemo(() => CATEGORY_KEYS.map((c) => ({ ...c, label: t(c.i18nKey) })), [t]);

  useEffect(() => {
    loadExperiences();
  }, [selectedCategory]);

  useEffect(() => {
    loadTopGuides();
  }, []);

  const loadExperiences = async () => {
    const params = selectedCategory !== 'all' ? { category: selectedCategory } : {};
    const result = await api.getExperiences(params);
    if (result.success && result.data) {
      setExperiences(result.data);
      setExperiencesError('');
      return;
    }
    setExperiences([]);
    setExperiencesError(result.error?.message || t('home.noExperiences'));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadExperiences(), loadTopGuides()]);
    setRefreshing(false);
  };

  const loadTopGuides = async () => {
    const result = await api.getTopGuides();
    if (result.success && result.data?.guides?.length) {
      setGuides(result.data.guides.map((g: Guide) => toGuideCard(g, t('home.defaultGuideName'))));
      setGuidesError('');
      return;
    }
    setGuides([]);
    setGuidesError(result.error?.message || t('home.noGuides'));
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
            <Text style={styles.greeting}>{t('home.greeting', { name: getGreetingName(userName, t('home.defaultUser'), t('home.greetingDefault')) })}</Text>
            <Text style={styles.headerTitle}>{t('home.headerTitle')}</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Text style={styles.profileEmoji}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.7} onPress={onOpenExplore}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{t('home.searchPlaceholder')}</Text>
        </TouchableOpacity>

        {/* AI Trip Planner Banner */}
        <TouchableOpacity style={styles.aiBanner} activeOpacity={0.85} onPress={onOpenAI}>
          <View style={styles.aiBannerContent}>
            <View style={styles.aiIconContainer}>
              <Text style={styles.aiIcon}>🤖</Text>
            </View>
            <View style={styles.aiBannerText}>
              <Text style={styles.aiBannerTitle}>{t('home.aiTitle')}</Text>
              <Text style={styles.aiBannerSubtitle}>
                {t('home.aiSubtitle')}
              </Text>
            </View>
            <Text style={styles.aiBannerArrow}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Categories */}
        <Text style={styles.sectionTitle}>{t('home.categories')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((cat) => (
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
          <Text style={styles.sectionTitle}>{t('home.featuredExperiences')}</Text>
          <TouchableOpacity onPress={onOpenExplore}>
            <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        {experiences.length > 0 ? (
          <FlatList
            data={experiences}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.experiencesList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ExperienceCard experience={item} onPress={() => onSelectExperience(item)} />
            )}
          />
        ) : (
          <EmptyStateCard
            title={t('home.noExperiences')}
            description={experiencesError || t('home.noExperiencesDesc')}
            actionLabel={t('home.exploreNow')}
            onPress={onOpenExplore}
          />
        )}

        {/* Top Guides */}
        <Text style={styles.sectionTitle}>{t('home.topGuides')}</Text>
        {guides.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.guidesContainer}
          >
            {guides.map((guide) => (
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
        ) : (
          <EmptyStateCard
            title={t('home.noGuides')}
            description={guidesError || t('home.noGuidesDesc')}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function EmptyStateCard({
  title,
  description,
  actionLabel,
  onPress,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onPress ? (
        <TouchableOpacity style={styles.emptyAction} onPress={onPress}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Experience Card Component
function ExperienceCard({
  experience,
  onPress,
}: {
  experience: Experience;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };

  return (
    <TouchableOpacity style={styles.expCard} activeOpacity={0.85} onPress={onPress}>
      {/* Image */}
      <View style={styles.expImageContainer}>
        {experience.image_urls?.length > 0 ? (
          <Image
            source={{ uri: experience.image_urls[0] }}
            style={styles.expImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.expImagePlaceholder}>
            <Text style={styles.expImageEmoji}>
              {experience.category === 'food' ? '🍜' :
               experience.category === 'sightseeing' ? '📸' :
               experience.category === 'tour' ? '🏛️' :
               experience.category === 'stay' ? '🏨' : '🎭'}
            </Text>
          </View>
        )}
        {experience.is_instant && (
          <View style={styles.instantBadge}>
            <Text style={styles.instantText}>{t('home.bookNow')}</Text>
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
          <Text style={styles.expPriceUnit}>{t('common.perPerson')}</Text>
        </View>
      </View>
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
  emptyCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.bold as any,
  },
  emptyDescription: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    lineHeight: 20,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  emptyActionText: {
    color: Colors.textOnPrimary,
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold as any,
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
  expImage: {
    width: '100%',
    height: '100%',
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
