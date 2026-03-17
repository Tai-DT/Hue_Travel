import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { DirectionResult, PlaceResult } from '@/services/api';

// ============================================
// Map Screen — Real Interactive Map
// Uses react-native-maps (Apple Maps / Google Maps)
// ============================================

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'all', label: '🗺️ Tất cả', query: 'địa điểm du lịch Huế' },
  { key: 'heritage', label: '🏛️ Di sản', query: 'di tích lịch sử Huế' },
  { key: 'food', label: '🍜 Ẩm thực', query: 'nhà hàng quán ăn Huế' },
  { key: 'temple', label: '⛩️ Chùa chiền', query: 'chùa đền Huế' },
  { key: 'nature', label: '🌿 Thiên nhiên', query: 'công viên thiên nhiên Huế' },
  { key: 'shopping', label: '🛍️ Mua sắm', query: 'chợ mua sắm Huế' },
] as const;

type PlaceCategory = typeof CATEGORIES[number]['key'];

type MapPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  ratingCount: number;
  priceLevel?: number;
  types: string[];
  emoji: string;
  distance: string;
  openStatus: string;
};

const HUE_CENTER = { lat: 16.4637, lng: 107.5909 };

const HUE_REGION: Region = {
  latitude: HUE_CENTER.lat,
  longitude: HUE_CENTER.lng,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

// ============================================
// Helpers
// ============================================

function getEmoji(types: string[]): string {
  if (types.some(t => ['restaurant', 'food', 'meal_delivery', 'meal_takeaway'].includes(t))) return '🍜';
  if (types.includes('cafe')) return '☕';
  if (types.includes('place_of_worship')) return '⛩️';
  if (types.some(t => ['shopping_mall', 'store', 'market'].includes(t))) return '🛍️';
  if (types.some(t => ['park', 'natural_feature'].includes(t))) return '🌿';
  if (types.some(t => ['museum', 'tourist_attraction'].includes(t))) return '🏛️';
  if (types.includes('lodging')) return '🏨';
  return '📍';
}

function getMarkerColor(types: string[]): string {
  if (types.some(t => ['restaurant', 'food', 'meal_delivery', 'meal_takeaway', 'cafe'].includes(t))) return '#FF6B35';
  if (types.includes('place_of_worship')) return '#9C27B0';
  if (types.some(t => ['shopping_mall', 'store', 'market'].includes(t))) return '#E91E63';
  if (types.some(t => ['park', 'natural_feature'].includes(t))) return '#4CAF50';
  if (types.some(t => ['museum', 'tourist_attraction'].includes(t))) return '#FF9800';
  return '#2196F3';
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
}

function priceLevelText(level?: number): string {
  if (level === undefined || level === 0) return '';
  return '₫'.repeat(level);
}

function toMapPlace(p: PlaceResult, center: { lat: number; lng: number }): MapPlace {
  return {
    id: p.place_id,
    name: p.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    rating: p.rating,
    ratingCount: p.rating_count || 0,
    priceLevel: p.price_level,
    types: p.types || [],
    emoji: getEmoji(p.types || []),
    distance: calcDistance(center.lat, center.lng, p.lat, p.lng),
    openStatus: p.open_now === undefined ? '' : p.open_now ? '🟢 Đang mở' : '🔴 Đã đóng',
  };
}

// Decode Google/Goong polyline to coordinates
function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b: number;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// ============================================
// Main Component
// ============================================

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [category, setCategory] = useState<PlaceCategory>('all');
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<DirectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(HUE_CENTER);
  const [showDetail, setShowDetail] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const selectedPlace = places.find(p => p.id === selectedId) || null;

  // Get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {}
    })();
  }, []);

  // Load places
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setSelectedId(null);
      setRoute(null);
      setShowDetail(false);

      const cat = CATEGORIES.find(c => c.key === category)!;
      const result = await api.searchPlaces(cat.query);

      if (result.success && result.data) {
        const mapped = result.data.places.map(p => toMapPlace(p, userLocation));
        setPlaces(mapped);
        if (mapped.length === 0) setError('Chưa tìm thấy địa điểm phù hợp.');
      } else {
        setPlaces([]);
        setError(result.error?.message || 'Không thể tải địa điểm');
      }
      setLoading(false);
    };
    load();
  }, [category]);

  // Fit map to show all places when places change
  useEffect(() => {
    if (!mapReady || places.length === 0) return;
    const coords = [
      { latitude: userLocation.lat, longitude: userLocation.lng },
      ...places.map(p => ({ latitude: p.lat, longitude: p.lng })),
    ];
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }, 300);
  }, [places, mapReady]);

  // Animate to selected place
  useEffect(() => {
    if (!selectedPlace || !mapReady) return;
    mapRef.current?.animateToRegion({
      latitude: selectedPlace.lat,
      longitude: selectedPlace.lng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 500);
  }, [selectedId]);

  // Fetch directions
  const fetchDirections = useCallback(async (place: MapPlace) => {
    setRouteLoading(true);
    setRoute(null);
    const result = await api.getDirections({
      originLat: userLocation.lat,
      originLng: userLocation.lng,
      destLat: place.lat,
      destLng: place.lng,
      mode: 'driving',
    });
    if (result.success && result.data) {
      setRoute(result.data.directions);

      // Fit to route
      if (result.data.directions.polyline) {
        const routeCoords = decodePolyline(result.data.directions.polyline);
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 80, right: 40, bottom: 200, left: 40 },
          animated: true,
        });
      }
    } else {
      setError(result.error?.message || 'Không thể lấy chỉ đường');
    }
    setRouteLoading(false);
  }, [userLocation]);

  // Open in native Maps app
  const openInMaps = useCallback((place: MapPlace) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${place.lat},${place.lng}(${encodeURIComponent(place.name)})`,
      android: `geo:${place.lat},${place.lng}?q=${place.lat},${place.lng}(${encodeURIComponent(place.name)})`,
      default: `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`,
    });
    if (url) Linking.openURL(url);
  }, []);

  // Go to user location
  const goToMyLocation = useCallback(() => {
    mapRef.current?.animateToRegion({
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 500);
  }, [userLocation]);

  // Route polyline coordinates
  const routeCoords = route?.polyline
    ? decodePolyline(route.polyline)
    : route?.steps?.length
      ? [
          { latitude: userLocation.lat, longitude: userLocation.lng },
          ...(route.steps.filter(s => s.start_lat && s.start_lng).map(s => ({
            latitude: s.start_lat!,
            longitude: s.start_lng!,
          }))),
          ...(selectedPlace ? [{ latitude: selectedPlace.lat, longitude: selectedPlace.lng }] : []),
        ]
      : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Bản đồ Huế</Text>
        <Text style={styles.headerSub}>
          {loading ? 'Đang tải...' : `${places.length} địa điểm`}
        </Text>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catRow}
        contentContainerStyle={styles.catContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.catChip, category === cat.key && styles.catChipActive]}
            onPress={() => setCategory(cat.key)}
          >
            <Text style={[styles.catText, category === cat.key && styles.catTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ===== REAL MAP ===== */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={HUE_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          onMapReady={() => setMapReady(true)}
          onPress={() => {
            if (selectedId) {
              setSelectedId(null);
              setRoute(null);
              setShowDetail(false);
            }
          }}
        >
          {/* Place markers */}
          {places.map(place => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              title={place.name}
              description={place.address}
              pinColor={getMarkerColor(place.types)}
              onPress={() => {
                setSelectedId(place.id);
                setRoute(null);
                setShowDetail(false);
              }}
            >
              {/* Custom marker view */}
              <View style={[
                styles.markerWrap,
                place.id === selectedId && styles.markerWrapActive,
              ]}>
                <View style={[
                  styles.markerBubble,
                  { backgroundColor: getMarkerColor(place.types) },
                  place.id === selectedId && styles.markerBubbleActive,
                ]}>
                  <Text style={styles.markerEmoji}>{place.emoji}</Text>
                </View>
                <View style={[
                  styles.markerArrow,
                  { borderTopColor: getMarkerColor(place.types) },
                ]} />
              </View>
            </Marker>
          ))}

          {/* Route polyline */}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#FF6F43"
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}
        </MapView>

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.mapBtn} onPress={goToMyLocation}>
            <Text style={styles.mapBtnText}>📍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapBtn} onPress={() => {
            if (places.length === 0) return;
            const coords = places.map(p => ({ latitude: p.lat, longitude: p.lng }));
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 60, right: 40, bottom: 40, left: 40 },
              animated: true,
            });
          }}>
            <Text style={styles.mapBtnText}>🔲</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.mapOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.mapOverlayText}>Đang tải địa điểm...</Text>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* ===== BOTTOM: Selected Card OR Place List ===== */}
      {selectedPlace ? (
        <ScrollView style={styles.cardScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={[styles.cardEmojiWrap, { backgroundColor: getMarkerColor(selectedPlace.types) + '20' }]}>
                <Text style={styles.cardEmoji}>{selectedPlace.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>{selectedPlace.name}</Text>
                <Text style={styles.cardAddr} numberOfLines={1}>{selectedPlace.address}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => { setSelectedId(null); setRoute(null); setShowDetail(false); }}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Meta */}
            <View style={styles.metaRow}>
              {selectedPlace.rating > 0 && (
                <View style={styles.metaChip}><Text style={styles.metaText}>⭐ {selectedPlace.rating.toFixed(1)}</Text></View>
              )}
              {selectedPlace.ratingCount > 0 && (
                <View style={styles.metaChip}><Text style={styles.metaText}>👥 {selectedPlace.ratingCount}</Text></View>
              )}
              <View style={styles.metaChip}><Text style={styles.metaText}>📍 {selectedPlace.distance}</Text></View>
              {selectedPlace.openStatus ? (
                <View style={styles.metaChip}><Text style={styles.metaText}>{selectedPlace.openStatus}</Text></View>
              ) : null}
              {selectedPlace.priceLevel ? (
                <View style={styles.metaChip}><Text style={styles.metaText}>💰 {priceLevelText(selectedPlace.priceLevel)}</Text></View>
              ) : null}
            </View>

            {/* Route info */}
            {route && (
              <View style={styles.routeBox}>
                <View style={styles.routeHeader}>
                  <Text style={styles.routeTitle}>🚗 Lộ trình</Text>
                  <View style={styles.routeStatsRow}>
                    <Text style={styles.routeStat}>📏 {route.distance}</Text>
                    <Text style={styles.routeStatDivider}>•</Text>
                    <Text style={styles.routeStat}>⏱️ {route.duration}</Text>
                  </View>
                </View>
                {route.steps?.slice(0, 3).map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNumWrap}>
                      <Text style={styles.stepNum}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepText} numberOfLines={2}>
                        {step.instruction?.replace(/<[^>]*>/g, '') || `Bước ${i + 1}`}
                      </Text>
                      <Text style={styles.stepMeta}>{step.distance} • {step.duration}</Text>
                    </View>
                  </View>
                ))}
                {(route.steps?.length || 0) > 3 && (
                  <Text style={styles.moreSteps}>+ {route.steps!.length - 3} bước nữa</Text>
                )}
              </View>
            )}

            {/* Detail panel */}
            {showDetail && (
              <View style={styles.detailBox}>
                <Text style={styles.detailTitleText}>📋 Chi tiết địa điểm</Text>
                <DetailRow label="📍 Địa chỉ" value={selectedPlace.address} />
                <DetailRow label="🏷️ Loại" value={selectedPlace.types.join(', ') || 'Địa điểm'} />
                {selectedPlace.rating > 0 && (
                  <DetailRow label="⭐ Đánh giá" value={`${selectedPlace.rating.toFixed(1)} (${selectedPlace.ratingCount} lượt)`} />
                )}
                <DetailRow label="📐 Khoảng cách" value={`${selectedPlace.distance} từ vị trí hiện tại`} />
                <DetailRow label="🌐 Tọa độ" value={`${selectedPlace.lat.toFixed(5)}, ${selectedPlace.lng.toFixed(5)}`} />
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.dirBtn]}
                onPress={() => fetchDirections(selectedPlace)}
                disabled={routeLoading}
              >
                {routeLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.dirBtnText}>{route ? '🔄 Làm mới' : '🚗 Chỉ đường'}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.detBtn, showDetail && styles.detBtnActive]}
                onPress={() => setShowDetail(v => !v)}
              >
                <Text style={[styles.detBtnText, showDetail && styles.detBtnTextActive]}>
                  {showDetail ? '✕ Đóng' : '📖 Chi tiết'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.navBtn]}
                onPress={() => openInMaps(selectedPlace)}
              >
                <Text style={styles.navBtnText}>🧭 Mở Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : !loading && places.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.placeList}
          contentContainerStyle={styles.placeListContent}
        >
          {places.map(place => (
            <TouchableOpacity
              key={place.id}
              style={styles.placeItem}
              onPress={() => { setSelectedId(place.id); setRoute(null); setShowDetail(false); }}
            >
              <View style={styles.placeItemTop}>
                <View style={[styles.placeItemIcon, { backgroundColor: getMarkerColor(place.types) + '20' }]}>
                  <Text style={styles.placeItemEmoji}>{place.emoji}</Text>
                </View>
                {place.rating > 0 && (
                  <Text style={styles.placeItemRating}>⭐ {place.rating.toFixed(1)}</Text>
                )}
              </View>
              <Text style={styles.placeItemName} numberOfLines={1}>{place.name}</Text>
              <Text style={styles.placeItemAddr} numberOfLines={1}>{place.address}</Text>
              <View style={styles.placeItemBottom}>
                <Text style={styles.placeItemDist}>📍 {place.distance}</Text>
                {place.openStatus ? <Text style={styles.placeItemOpen}>{place.openStatus}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ============================================
// Detail Row
// ============================================
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: { paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.xs },
  headerTitle: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  headerSub: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

  catRow: { maxHeight: 44, marginBottom: Spacing.xs },
  catContent: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
  catChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  catTextActive: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.semibold as any },

  // Map
  mapWrap: {
    flex: 1, marginHorizontal: Spacing.sm, borderRadius: BorderRadius.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  map: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  mapOverlayText: { color: '#FFF', marginTop: 8, fontSize: Fonts.sizes.sm },

  // Map controls
  mapControls: {
    position: 'absolute', right: 12, top: 12, gap: 8,
  },
  mapBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  mapBtnText: { fontSize: 18 },

  // Custom markers
  markerWrap: { alignItems: 'center' },
  markerWrapActive: { zIndex: 99 },
  markerBubble: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  markerBubbleActive: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#FFF' },
  markerEmoji: { fontSize: 18 },
  markerArrow: {
    width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6,
    borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },

  errorBanner: {
    marginHorizontal: Spacing.base, marginTop: Spacing.xs, padding: Spacing.sm,
    backgroundColor: 'rgba(255,112,67,0.12)', borderRadius: BorderRadius.lg,
  },
  errorText: { color: Colors.text, fontSize: Fonts.sizes.xs },

  // Selected Card
  cardScroll: { maxHeight: SCREEN_H * 0.38, marginTop: Spacing.xs },
  card: {
    marginHorizontal: Spacing.sm, marginBottom: Platform.OS === 'ios' ? 30 : 12,
    padding: Spacing.base, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  cardEmojiWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cardEmoji: { fontSize: 24 },
  cardName: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  cardAddr: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 1 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, color: Colors.textMuted },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
  metaChip: { backgroundColor: Colors.surfaceLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  metaText: { fontSize: 11, color: Colors.text },

  routeBox: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  routeTitle: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  routeStatsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  routeStat: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  routeStatDivider: { color: Colors.textMuted, fontSize: 10 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  stepNumWrap: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNum: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  stepText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  stepMeta: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  moreSteps: { fontSize: 11, color: Colors.primary, marginTop: 4, fontWeight: Fonts.weights.medium as any },

  detailBox: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  detailTitleText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any, color: Colors.text, marginBottom: 8 },
  detailRow: { flexDirection: 'row', marginBottom: 6, gap: 6 },
  detailLabel: { fontSize: 12, color: Colors.textMuted, width: 95 },
  detailValue: { fontSize: 12, color: Colors.text, flex: 1 },

  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.lg, alignItems: 'center' },
  dirBtn: { backgroundColor: Colors.primary },
  dirBtnText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any, color: '#FFF' },
  detBtn: { backgroundColor: Colors.surfaceLight },
  detBtnActive: { backgroundColor: Colors.primary + '20' },
  detBtnText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any, color: Colors.text },
  detBtnTextActive: { color: Colors.primary },
  navBtn: { backgroundColor: Colors.surfaceLight },
  navBtnText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any, color: Colors.text },

  // Place list
  placeList: { maxHeight: 160, marginBottom: Platform.OS === 'ios' ? 30 : 12, marginTop: Spacing.xs },
  placeListContent: { paddingHorizontal: Spacing.sm, gap: Spacing.sm },
  placeItem: {
    width: 160, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  placeItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  placeItemIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  placeItemEmoji: { fontSize: 16 },
  placeItemRating: { fontSize: 10, color: Colors.secondary },
  placeItemName: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  placeItemAddr: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  placeItemBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  placeItemDist: { fontSize: 10, color: Colors.primary },
  placeItemOpen: { fontSize: 10 },
});
