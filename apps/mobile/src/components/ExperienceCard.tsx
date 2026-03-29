import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { TravelerCurrency } from '@/services/api';
import { formatCurrencyFromVND } from '@/utils/currency';

// ============================================
// ExperienceCard — Tour/Experience display card
// ============================================
type ExperienceCardProps = {
  title: string;
  category: string;
  price: number;
  rating: number;
  ratingCount: number;
  durationMins: number;
  isInstant?: boolean;
  imageUrl?: string;
  guideName?: string;
  currency?: TravelerCurrency;
  onPress?: () => void;
  onFavorite?: () => void;
  isFavorite?: boolean;
  style?: ViewStyle;
};

export default function ExperienceCard({
  title,
  category,
  price,
  rating,
  ratingCount,
  durationMins,
  isInstant,
  guideName,
  currency = 'VND',
  onPress,
  onFavorite,
  isFavorite = false,
  style,
}: ExperienceCardProps) {
  const durationText = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? durationMins % 60 + 'm' : ''}`
    : `${durationMins}m`;

  const categoryEmoji: Record<string, string> = {
    food: '🍜', tour: '🏛️', experience: '🎭', sightseeing: '📸',
    stay: '🏨', nature: '🌊', heritage: '🏯', craft: '👒',
  };

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.85}>
      {/* Image placeholder */}
      <View style={styles.imageContainer}>
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imageEmoji}>{categoryEmoji[category] || '🏛️'}</Text>
        </View>

        {isInstant && (
          <View style={styles.instantBadge}>
            <Text style={styles.instantText}>⚡ Đặt ngay</Text>
          </View>
        )}

        {onFavorite && (
          <TouchableOpacity style={styles.heartButton} onPress={onFavorite}>
            <Text style={styles.heartIcon}>{isFavorite ? '❤️' : '♡'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>

        <View style={styles.meta}>
          <View style={styles.rating}>
            <Text style={styles.star}>⭐</Text>
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({ratingCount})</Text>
          </View>
          <Text style={styles.duration}>🕐 {durationText}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrencyFromVND(price, currency)}</Text>
            <Text style={styles.priceUnit}>/người</Text>
          </View>
          {guideName && (
            <Text style={styles.guide} numberOfLines={1}>🧭 {guideName}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  imageContainer: {
    height: 160,
    position: 'relative',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageEmoji: {
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartIcon: {
    fontSize: 18,
    color: Colors.text,
  },
  info: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  title: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold,
    color: Colors.text,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  star: { fontSize: 12 },
  ratingText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold,
    color: Colors.text,
  },
  ratingCount: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
  },
  duration: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold,
    color: Colors.primary,
  },
  priceUnit: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  guide: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    maxWidth: 120,
  },
});
