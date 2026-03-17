import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { PlaceResult } from '@/services/api';

const CATEGORIES = [
  { key: 'all', label: 'Tat ca', query: 'dia diem du lich Hue' },
  { key: 'heritage', label: 'Di san', query: 'di tich lich su Hue' },
  { key: 'food', label: 'Am thuc', query: 'quan an nha hang Hue' },
  { key: 'nature', label: 'Thien nhien', query: 'cong vien Hue' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

export default function MapScreenWeb() {
  const [category, setCategory] = useState<CategoryKey>('all');
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categoryMeta = useMemo(
    () => CATEGORIES.find((item) => item.key === category) || CATEGORIES[0],
    [category]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');

      const res = await api.searchPlaces(categoryMeta.query);
      if (cancelled) return;

      if (res.success && res.data?.places) {
        setPlaces(res.data.places);
      } else {
        setPlaces([]);
        setError(res.error?.message || 'Khong the tai ban do tren web');
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryMeta.query]);

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Ban do tren web</Text>
        <Text style={styles.bannerText}>
          Che do web se hien thi danh sach dia diem. Bam de mo Google Maps chi duong.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CATEGORIES.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.filterChip, category === item.key && styles.filterChipActive]}
            onPress={() => setCategory(item.key)}
          >
            <Text style={[styles.filterText, category === item.key && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.stateText}>Dang tai dia diem...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {places.map((place) => (
            <TouchableOpacity
              key={place.place_id}
              style={styles.card}
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`)}
            >
              <Text style={styles.placeName}>{place.name}</Text>
              <Text style={styles.placeAddress}>{place.address}</Text>
              <Text style={styles.placeMeta}>Danh gia: {place.rating || 0} | Luot: {place.rating_count || 0}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  banner: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: Fonts.weights.bold as any,
    marginBottom: 6,
  },
  bannerText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: Fonts.weights.medium as any,
  },
  filterTextActive: {
    color: Colors.textOnPrimary,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  list: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  placeName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: Fonts.weights.semibold as any,
    marginBottom: 4,
  },
  placeAddress: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 6,
  },
  placeMeta: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
