import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { Experience } from '@/services/api';

const { width } = Dimensions.get('window');

// Quick filters
const QUICK_FILTERS = [
  { key: 'trending', label: '🔥 Trending', active: true },
  { key: 'near', label: '📍 Gần bạn', active: false },
  { key: 'under200k', label: '💰 Dưới 200k', active: false },
  { key: 'instant', label: '⚡ Đặt ngay', active: false },
  { key: 'group', label: '👥 Nhóm', active: false },
];

const EXPLORE_SECTIONS = [
  {
    id: 'culinary',
    title: '🍜 Ẩm thực',
    subtitle: 'Từ bún bò đến bánh khoái',
    color: '#FF6B35',
    items: [
      'Bún bò Huế gốc', 'Cơm hến', 'Bánh khoái', 'Chè Huế',
      'Nem lụi', 'Bánh bèo, nậm, lọc',
    ],
  },
  {
    id: 'heritage',
    title: '🏛️ Di sản',
    subtitle: 'UNESCO World Heritage',
    color: '#4E9AF1',
    items: [
      'Đại Nội', 'Lăng Tự Đức', 'Lăng Khải Định',
      'Chùa Thiên Mụ', 'Cầu Trường Tiền',
    ],
  },
  {
    id: 'nature',
    title: '🌿 Thiên nhiên',
    subtitle: 'Sông, núi, biển',
    color: '#4CAF50',
    items: [
      'Sông Hương', 'Núi Ngự Bình', 'Bãi biển Thuận An',
      'Đầm phá Tam Giang', 'Suối Voi',
    ],
  },
  {
    id: 'culture',
    title: '🎭 Văn hoá',
    subtitle: 'Nghệ thuật & truyền thống',
    color: '#9C27B0',
    items: [
      'Ca Huế sông Hương', 'Nhã nhạc cung đình',
      'Nón lá', 'Áo dài truyền thống',
    ],
  },
];

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('trending');

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Khám phá</Text>
          <Text style={styles.headerSubtitle}>Tìm trải nghiệm hoàn hảo cho bạn</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tour, quán ăn, địa điểm..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Quick Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {QUICK_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                activeFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterLabel,
                  activeFilter === filter.key && styles.filterLabelActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Explore Sections */}
        {EXPLORE_SECTIONS.map((section) => (
          <View key={section.id} style={styles.section}>
            <View style={[styles.sectionCard, { borderColor: section.color + '40' }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                </View>
                <TouchableOpacity>
                  <Text style={[styles.seeMore, { color: section.color }]}>Xem →</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tagGrid}>
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.tag,
                      { borderColor: section.color + '30' },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ))}

        {/* Weather Widget */}
        <View style={styles.weatherCard}>
          <View style={styles.weatherHeader}>
            <Text style={styles.weatherTitle}>🌤️ Thời tiết hôm nay</Text>
            <Text style={styles.weatherLocation}>Thành phố Huế</Text>
          </View>
          <View style={styles.weatherBody}>
            <Text style={styles.weatherTemp}>28°C</Text>
            <View style={styles.weatherDetails}>
              <Text style={styles.weatherDetail}>💧 Độ ẩm: 75%</Text>
              <Text style={styles.weatherDetail}>🌬️ Gió: 12km/h</Text>
              <Text style={styles.weatherDetail}>☀️ Nắng nhẹ</Text>
            </View>
          </View>
          <Text style={styles.weatherTip}>
            💡 Thời tiết phù hợp cho tour ngoài trời
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.base,
  },
  headerTitle: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: Fonts.sizes.md,
  },
  clearIcon: {
    fontSize: 16,
    color: Colors.textMuted,
    padding: Spacing.xs,
  },

  // Filters
  filtersContainer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  filterChip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    borderColor: Colors.primary,
  },
  filterLabel: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Fonts.weights.medium,
  },
  filterLabelActive: {
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold,
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  seeMore: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
  },
  tagText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.text,
    fontWeight: Fonts.weights.medium,
  },

  // Weather
  weatherCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.lg,
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  weatherTitle: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.bold,
    color: Colors.text,
  },
  weatherLocation: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
  },
  weatherBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  weatherTemp: {
    fontSize: Fonts.sizes.hero,
    fontWeight: Fonts.weights.light,
    color: Colors.primary,
  },
  weatherDetails: {
    gap: Spacing.xs,
  },
  weatherDetail: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
  },
  weatherTip: {
    fontSize: Fonts.sizes.sm,
    color: Colors.success,
    fontWeight: Fonts.weights.medium,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
});
