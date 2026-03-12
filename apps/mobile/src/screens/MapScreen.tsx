import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { DirectionResult, PlaceResult } from '@/services/api';

// ============================================
// Map Screen — Discover Huế Locations
// ============================================

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'all', label: '🗺️ Tất cả' },
  { key: 'heritage', label: '🏛️ Di sản' },
  { key: 'food', label: '🍜 Ẩm thực' },
  { key: 'temple', label: '⛩️ Chùa chiền' },
  { key: 'nature', label: '🌿 Thiên nhiên' },
  { key: 'shopping', label: '🛍️ Mua sắm' },
];

type PlaceCategory = typeof CATEGORIES[number]['key'];

type PlaceCard = {
  id: string;
  name: string;
  category: PlaceCategory;
  emoji: string;
  address: string;
  rating: number;
  price: string;
  distance: string;
  description: string;
  openHours: string;
  lat: number;
  lng: number;
  types: string[];
};

const HUE_CENTER = {
  lat: 16.4637,
  lng: 107.5909,
};

const CATEGORY_CONFIG: Record<PlaceCategory, { query: string; emoji: string }> = {
  all: { query: 'địa điểm du lịch Huế', emoji: '🗺️' },
  heritage: { query: 'di sản Huế', emoji: '🏛️' },
  food: { query: 'ẩm thực Huế', emoji: '🍜' },
  temple: { query: 'chùa Huế', emoji: '⛩️' },
  nature: { query: 'thiên nhiên Huế', emoji: '🌿' },
  shopping: { query: 'mua sắm Huế', emoji: '🛍️' },
};

const FALLBACK_PLACES: PlaceCard[] = [
  {
    id: 'fallback-1',
    name: 'Đại Nội Huế',
    category: 'heritage',
    emoji: '🏛️',
    address: 'Đường 23/8, Thuận Hoà',
    rating: 4.8,
    price: '200,000₫',
    distance: '1.2km',
    description: 'Kinh thành triều Nguyễn — Di sản UNESCO',
    openHours: '7:00 - 17:30',
    lat: 16.4698,
    lng: 107.5786,
    types: ['tourist_attraction'],
  },
  {
    id: 'fallback-2',
    name: 'Chùa Thiên Mụ',
    category: 'temple',
    emoji: '⛩️',
    address: 'Kim Long, Huế',
    rating: 4.9,
    price: 'Miễn phí',
    distance: '4.3km',
    description: 'Ngôi chùa cổ nổi tiếng bên sông Hương.',
    openHours: 'Cả ngày',
    lat: 16.4539,
    lng: 107.5534,
    types: ['place_of_worship'],
  },
];

function inferCategory(types: string[]): PlaceCategory {
  if (types.includes('restaurant') || types.includes('food') || types.includes('cafe')) return 'food';
  if (types.includes('place_of_worship')) return 'temple';
  if (types.includes('shopping_mall') || types.includes('store')) return 'shopping';
  if (types.includes('park') || types.includes('natural_feature')) return 'nature';
  if (types.includes('tourist_attraction') || types.includes('museum')) return 'heritage';
  return 'all';
}

function pickEmoji(place: PlaceResult, category: PlaceCategory) {
  if (place.types.includes('restaurant') || place.types.includes('food')) return '🍜';
  if (place.types.includes('place_of_worship')) return '⛩️';
  if (place.types.includes('shopping_mall') || place.types.includes('store')) return '🛍️';
  if (place.types.includes('natural_feature') || place.types.includes('park')) return '🌿';
  if (place.types.includes('tourist_attraction')) return '🏛️';
  return CATEGORY_CONFIG[category].emoji;
}

function formatDistance(lat: number, lng: number) {
  const dx = (lat - HUE_CENTER.lat) * 111;
  const dy = (lng - HUE_CENTER.lng) * 111 * Math.cos((HUE_CENTER.lat * Math.PI) / 180);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }

  return `${distance.toFixed(1)}km`;
}

function formatPrice(priceLevel?: number) {
  if (priceLevel === undefined) return 'Liên hệ';
  const labels = ['Miễn phí', '₫', '₫₫', '₫₫₫', '₫₫₫₫'];
  return labels[priceLevel] || 'Liên hệ';
}

function toPlaceCard(place: PlaceResult, selectedCategory: PlaceCategory): PlaceCard {
  const inferredCategory = inferCategory(place.types);

  return {
    id: place.place_id,
    name: place.name,
    category: selectedCategory === 'all' ? inferredCategory : selectedCategory,
    emoji: pickEmoji(place, selectedCategory),
    address: place.address,
    rating: place.rating,
    price: formatPrice(place.price_level),
    distance: formatDistance(place.lat, place.lng),
    description: place.types.join(' • ') || 'Địa điểm nổi bật tại Huế',
    openHours: place.open_now === undefined ? 'Chưa rõ' : place.open_now ? 'Đang mở cửa' : 'Đang đóng cửa',
    lat: place.lat,
    lng: place.lng,
    types: place.types,
  };
}

export default function MapScreen() {
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory>('all');
  const [selectedPlace, setSelectedPlace] = useState<PlaceCard | null>(null);
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [route, setRoute] = useState<DirectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPlaces = async () => {
      setIsLoading(true);
      setError('');
      setSelectedPlace(null);
      setRoute(null);

      const config = CATEGORY_CONFIG[selectedCategory];
      const result = await api.searchPlaces(config.query);

      if (result.success && result.data) {
        const mapped = result.data.places.map((place) => toPlaceCard(place, selectedCategory));
        setPlaces(mapped);
      } else {
        setPlaces(FALLBACK_PLACES.filter((place) => selectedCategory === 'all' || place.category === selectedCategory));
        setError(result.error?.message || 'Không thể tải địa điểm');
      }

      setIsLoading(false);
    };

    loadPlaces();
  }, [selectedCategory]);

  const fetchDirections = async (place: PlaceCard) => {
    setIsLoadingRoute(true);
    setRoute(null);

    const result = await api.getDirections({
      originLat: HUE_CENTER.lat,
      originLng: HUE_CENTER.lng,
      destLat: place.lat,
      destLng: place.lng,
      mode: 'driving',
    });

    if (result.success && result.data) {
      setRoute(result.data.directions);
      setError('');
    } else {
      setError(result.error?.message || 'Không thể lấy chỉ đường');
    }

    setIsLoadingRoute(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Bản đồ Huế</Text>
        <Text style={styles.headerSubtitle}>{places.length} địa điểm từ dữ liệu API</Text>
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          {isLoading ? (
            <>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.mapText}>Đang tải địa điểm...</Text>
            </>
          ) : (
            <>
              <Text style={styles.mapEmoji}>🗺️</Text>
              <Text style={styles.mapText}>Bản đồ mô phỏng từ dữ liệu API</Text>
              <Text style={styles.mapSubtext}>Chạm vào pin để xem chi tiết</Text>

              {places.map((place, i) => (
                <TouchableOpacity
                  key={place.id}
                  style={[
                    styles.fakePin,
                    {
                      top: 40 + ((i * 67) % 160),
                      left: 30 + ((i * 89) % (width - 120)),
                    },
                    selectedPlace?.id === place.id && styles.fakePinActive,
                  ]}
                  onPress={() => {
                    setSelectedPlace(place);
                    setRoute(null);
                  }}
                >
                  <Text style={styles.fakePinEmoji}>{place.emoji}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categories}
        contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.sm }}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryChip,
              selectedCategory === cat.key && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <Text style={[
              styles.categoryText,
              selectedCategory === cat.key && styles.categoryTextActive,
            ]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Selected Place Card */}
      {selectedPlace ? (
        <View style={styles.placeCard}>
          <View style={styles.placeCardHeader}>
            <Text style={styles.placeCardEmoji}>{selectedPlace.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeCardName}>{selectedPlace.name}</Text>
              <Text style={styles.placeCardAddress}>{selectedPlace.address}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedPlace(null)}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.placeCardDesc}>{selectedPlace.description}</Text>
          <View style={styles.placeCardMeta}>
            <Text style={styles.metaItem}>⭐ {selectedPlace.rating}</Text>
            <Text style={styles.metaItem}>💰 {selectedPlace.price}</Text>
            <Text style={styles.metaItem}>📍 {selectedPlace.distance}</Text>
            <Text style={styles.metaItem}>⏰ {selectedPlace.openHours}</Text>
          </View>
          {route ? (
            <View style={styles.routeCard}>
              <Text style={styles.routeTitle}>🚗 Lộ trình từ trung tâm Huế</Text>
              <Text style={styles.routeSummary}>{route.distance} • {route.duration}</Text>
              <Text style={styles.routeStep} numberOfLines={2}>
                {route.steps[0]?.instruction || 'Đã có dữ liệu chỉ đường'}
              </Text>
            </View>
          ) : null}
          <View style={styles.placeCardActions}>
            <TouchableOpacity
              style={styles.directionBtn}
              onPress={() => fetchDirections(selectedPlace)}
              disabled={isLoadingRoute}
            >
              <Text style={styles.directionBtnText}>
                {isLoadingRoute ? 'Đang tải...' : '🚗 Chỉ đường'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailBtn}>
              <Text style={styles.detailBtnText}>📖 Chi tiết</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Place List */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.placeList}
          contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.md }}
        >
          {places.map((place) => (
            <TouchableOpacity
              key={place.id}
              style={styles.placeItem}
              onPress={() => {
                setSelectedPlace(place);
                setRoute(null);
              }}
            >
              <View style={styles.placeItemHeader}>
                <Text style={styles.placeItemEmoji}>{place.emoji}</Text>
                <Text style={styles.placeItemRating}>⭐ {place.rating}</Text>
              </View>
              <Text style={styles.placeItemName} numberOfLines={1}>{place.name}</Text>
              <Text style={styles.placeItemAddress} numberOfLines={1}>{place.address}</Text>
              <View style={styles.placeItemFooter}>
                <Text style={styles.placeItemPrice}>{place.price}</Text>
                <Text style={styles.placeItemDistance}>{place.distance}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.sm,
  },
  headerTitle: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  headerSubtitle: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 2 },

  // Map
  mapContainer: { flex: 1, marginHorizontal: Spacing.base, marginTop: Spacing.sm },
  mapPlaceholder: {
    flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.xl,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  mapEmoji: { fontSize: 48, opacity: 0.3 },
  mapText: { fontSize: Fonts.sizes.base, color: Colors.textMuted, marginTop: Spacing.sm },
  mapSubtext: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 4 },
  errorBanner: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255, 112, 67, 0.14)',
    borderRadius: BorderRadius.lg,
  },
  errorText: { color: Colors.text, fontSize: Fonts.sizes.sm },

  // Fake map pins
  fakePin: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  fakePinActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
    transform: [{ scale: 1.3 }],
  },
  fakePinEmoji: { fontSize: 16 },

  // Categories
  categories: { maxHeight: 44, marginVertical: Spacing.sm },
  categoryChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  categoryTextActive: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.semibold as any },

  // Place Card (selected)
  placeCard: {
    marginHorizontal: Spacing.base, marginBottom: 30, padding: Spacing.base,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
  },
  placeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  placeCardEmoji: { fontSize: 32 },
  placeCardName: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  placeCardAddress: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, color: Colors.textMuted },
  placeCardDesc: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, marginBottom: Spacing.sm },
  placeCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md },
  metaItem: { fontSize: Fonts.sizes.sm, color: Colors.text },
  routeCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceLight,
  },
  routeTitle: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
    marginBottom: 4,
  },
  routeSummary: {
    fontSize: Fonts.sizes.sm,
    color: Colors.primary,
    marginBottom: 4,
  },
  routeStep: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  placeCardActions: { flexDirection: 'row', gap: Spacing.sm },
  directionBtn: {
    flex: 1, backgroundColor: Colors.primary, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg, alignItems: 'center',
  },
  directionBtnText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any, color: Colors.textOnPrimary },
  detailBtn: {
    flex: 1, backgroundColor: Colors.surfaceLight, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg, alignItems: 'center',
  },
  detailBtnText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any, color: Colors.text },

  // Place List (horizontal)
  placeList: { maxHeight: 160, marginBottom: 30 },
  placeItem: {
    width: 150, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  placeItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  placeItemEmoji: { fontSize: 24 },
  placeItemRating: { fontSize: 11, color: Colors.secondary },
  placeItemName: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  placeItemAddress: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  placeItemFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  placeItemPrice: { fontSize: 11, color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  placeItemDistance: { fontSize: 11, color: Colors.textMuted },
});
