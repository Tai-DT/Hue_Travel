import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ImageBackground,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

type Props = {
  onGetStarted: () => void;
};

export default function WelcomeScreen({ onGetStarted }: Props) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background with overlay */}
      <View style={styles.backgroundContainer}>
        <View style={styles.backgroundGradient} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Logo & Brand */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🌏</Text>
          </View>
          <Text style={styles.brandName}>Huế Travel</Text>
          <Text style={styles.tagline}>Khám phá Huế như người bản địa</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <FeatureItem icon="🗺️" text="Lịch trình AI thông minh" />
          <FeatureItem icon="👤" text="Kết nối hướng dẫn viên local" />
          <FeatureItem icon="🍜" text="Ẩm thực & trải nghiệm authentic" />
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onGetStarted}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Bắt đầu khám phá</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <Text style={styles.termsLink}>Điều khoản</Text> &{' '}
            <Text style={styles.termsLink}>Chính sách</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundGradient: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: height * 0.15,
    paddingBottom: Spacing.xxxl,
  },
  logoSection: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: Spacing.lg,
  },
  logoEmoji: {
    fontSize: 48,
  },
  brandName: {
    fontSize: Fonts.sizes.hero,
    fontWeight: Fonts.weights.extrabold,
    color: Colors.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: Fonts.sizes.lg,
    color: Colors.primary,
    marginTop: Spacing.sm,
    fontWeight: Fonts.weights.medium,
  },
  features: {
    gap: Spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: Spacing.base,
  },
  featureText: {
    fontSize: Fonts.sizes.base,
    color: Colors.text,
    fontWeight: Fonts.weights.medium,
  },
  ctaSection: {
    alignItems: 'center',
    gap: Spacing.base,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold,
    color: Colors.textOnPrimary,
  },
  termsText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  termsLink: {
    color: Colors.primary,
  },
});
