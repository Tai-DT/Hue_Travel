import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { Booking, Experience, Review, ReviewSummary } from '@/services/api';

const { height } = Dimensions.get('window');

const EMPTY_REVIEW_SUMMARY: ReviewSummary = {
  total_reviews: 0,
  average_overall: 0,
  average_guide: 0,
  average_value: 0,
  star_5: 0,
  star_4: 0,
  star_3: 0,
  star_2: 0,
  star_1: 0,
};

type Props = {
  experience: Experience;
  onBack: () => void;
  onBookingCreated: (booking: Booking) => void;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN').format(price) + '₫';
}

function formatDuration(durationMins: number) {
  const hours = Math.floor(durationMins / 60);
  const minutes = durationMins % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`;
}

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays <= 0) return 'Hôm nay';
  if (diffDays === 1) return '1 ngày trước';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function getInitial(name?: string) {
  if (!name?.trim()) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function getStarCount(summary: ReviewSummary, star: number) {
  if (star === 5) return summary.star_5;
  if (star === 4) return summary.star_4;
  if (star === 3) return summary.star_3;
  if (star === 2) return summary.star_2;
  return summary.star_1;
}

function getReviewSortDate(booking: Booking) {
  return new Date(booking.completed_at || booking.booking_date).getTime();
}

export default function ExperienceDetailScreen({ experience, onBack, onBookingCreated }: Props) {
  const [showBooking, setShowBooking] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [loadingEngagement, setLoadingEngagement] = useState(true);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [engagementError, setEngagementError] = useState('');
  const [completedBookings, setCompletedBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>(EMPTY_REVIEW_SUMMARY);
  const [showReviewComposer, setShowReviewComposer] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadEngagement = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoadingEngagement(true);
      }

      const [favoritesRes, reviewsRes, bookingsRes] = await Promise.all([
        api.getFavorites(1, 100),
        api.getReviews(experience.id, 1, 20),
        api.getBookings('completed', 1, 100),
      ]);

      const nextErrors: string[] = [];

      if (favoritesRes.success && favoritesRes.data) {
        setIsFavorited(favoritesRes.data.some((item) => item.id === experience.id));
      } else {
        nextErrors.push(favoritesRes.error?.message || 'Không thể tải trạng thái yêu thích');
      }

      if (reviewsRes.success && reviewsRes.data) {
        setReviews(reviewsRes.data.reviews || []);
        setReviewSummary(reviewsRes.data.summary || EMPTY_REVIEW_SUMMARY);
      } else {
        setReviews([]);
        setReviewSummary(EMPTY_REVIEW_SUMMARY);
        nextErrors.push(reviewsRes.error?.message || 'Không thể tải đánh giá');
      }

      if (bookingsRes.success && bookingsRes.data) {
        setCompletedBookings(bookingsRes.data);
      } else {
        setCompletedBookings([]);
        nextErrors.push(bookingsRes.error?.message || 'Không thể tải lịch sử booking');
      }

      setEngagementError(nextErrors[0] || '');
      setLoadingEngagement(false);
    },
    [experience.id]
  );

  useEffect(() => {
    setShowReviewComposer(false);
    setReviewRating(5);
    setReviewComment('');
    setReviewError('');
    void loadEngagement();
  }, [loadEngagement]);

  const activeImageIndex = 0;
  const imageDotCount = Math.min(3, Math.max(experience.image_urls?.length || 1, 1));
  const visibleDots = useMemo(
    () => Array.from({ length: imageDotCount }, (_, index) => index),
    [imageDotCount]
  );

  const displayReviewCount =
    reviewSummary.total_reviews > 0 ? reviewSummary.total_reviews : experience.rating_count;
  const displayRating =
    reviewSummary.total_reviews > 0 ? reviewSummary.average_overall : experience.rating;

  const completedExperienceBookings = useMemo(
    () =>
      completedBookings
        .filter((booking) => booking.experience_id === experience.id)
        .sort((left, right) => getReviewSortDate(right) - getReviewSortDate(left)),
    [completedBookings, experience.id]
  );

  const pendingReviewBooking = useMemo(() => {
    const reviewedBookingIds = new Set(reviews.map((review) => review.booking_id));
    return (
      completedExperienceBookings.find((booking) => !reviewedBookingIds.has(booking.id)) || null
    );
  }, [completedExperienceBookings, reviews]);

  const hasCompletedExperienceBooking = completedExperienceBookings.length > 0;
  const hasReviewedAllCompletedBookings =
    hasCompletedExperienceBooking && pendingReviewBooking === null;

  const ratingBreakdown = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: getStarCount(reviewSummary, star),
        width:
          reviewSummary.total_reviews > 0
            ? (`${(getStarCount(reviewSummary, star) / reviewSummary.total_reviews) * 100}%` as `${number}%`)
            : ('0%' as const),
      })),
    [reviewSummary]
  );

  const handleShare = async () => {
    try {
      await Share.share({
        title: experience.title,
        message: `${experience.title}\n${formatPrice(experience.price)}/người\n${experience.description}`,
      });
    } catch {}
  };

  const handleToggleFavorite = async () => {
    if (favoriteLoading) {
      return;
    }

    setFavoriteLoading(true);
    const result = await api.toggleFavorite(experience.id);
    setFavoriteLoading(false);

    if (result.success && result.data) {
      setIsFavorited(result.data.is_favorited);
      setEngagementError('');
      return;
    }

    Alert.alert('Không thể cập nhật yêu thích', result.error?.message || 'Vui lòng thử lại.');
  };

  const handleSubmitReview = async () => {
    if (!pendingReviewBooking) {
      setReviewError('Bạn chưa có booking hoàn thành để đánh giá.');
      return;
    }

    const trimmedComment = reviewComment.trim();
    if (trimmedComment.length < 10) {
      setReviewError('Nhập ít nhất 10 ký tự để gửi đánh giá.');
      return;
    }

    setSubmittingReview(true);
    setReviewError('');

    const result = await api.createReview({
      experience_id: experience.id,
      booking_id: pendingReviewBooking.id,
      overall_rating: reviewRating,
      guide_rating: reviewRating,
      value_rating: reviewRating,
      comment: trimmedComment,
    });

    setSubmittingReview(false);

    if (result.success) {
      setShowReviewComposer(false);
      setReviewRating(5);
      setReviewComment('');
      Alert.alert('Đã gửi đánh giá', 'Cảm ơn bạn đã chia sẻ trải nghiệm của mình.');
      await loadEngagement(true);
      return;
    }

    setReviewError(result.error?.message || 'Không thể gửi đánh giá');
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroContainer}>
          <View style={styles.heroImage}>
            <Text style={styles.heroEmoji}>
              {experience.category === 'food'
                ? '🍜'
                : experience.category === 'tour'
                  ? '🏛️'
                  : '🎭'}
            </Text>
          </View>

          <View style={styles.topNav}>
            <TouchableOpacity style={styles.navButton} onPress={onBack}>
              <Text style={styles.navIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.navRight}>
              <TouchableOpacity style={styles.navButton} onPress={handleShare}>
                <Text style={styles.navIcon}>↗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navButton, favoriteLoading && styles.navButtonDisabled]}
                onPress={handleToggleFavorite}
                disabled={favoriteLoading}
              >
                {favoriteLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.navIcon}>{isFavorited ? '❤️' : '♡'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {experience.is_instant ? (
            <View style={styles.instantBadge}>
              <Text style={styles.instantText}>⚡ Đặt ngay • Xác nhận tức thì</Text>
            </View>
          ) : null}

          <View style={styles.imageDots}>
            {visibleDots.map((dotIndex) => (
              <View
                key={dotIndex}
                style={[styles.dot, dotIndex === activeImageIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{experience.title}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.star}>⭐</Text>
            <Text style={styles.ratingText}>
              {displayReviewCount > 0 ? displayRating.toFixed(1) : 'Mới'}
            </Text>
            <Text style={styles.ratingCount}>
              {displayReviewCount > 0
                ? `(${displayReviewCount} đánh giá)`
                : 'Chưa có đánh giá'}
            </Text>
            <View style={styles.dot2} />
            <Text style={styles.duration}>🕐 {formatDuration(experience.duration_mins)}</Text>
            <View style={styles.dot2} />
            <Text style={styles.guests}>👥 Tối đa {experience.max_guests}</Text>
          </View>

          {experience.guide ? (
            <TouchableOpacity style={styles.guideCard}>
              <View style={styles.guideAvatar}>
                <Text style={styles.guideInitial}>{getInitial(experience.guide.full_name)}</Text>
              </View>
              <View style={styles.guideInfo}>
                <Text style={styles.guideName}>{experience.guide.full_name}</Text>
                <Text style={styles.guideRole}>Hướng dẫn viên</Text>
              </View>
              <View style={styles.guideBadge}>
                <Text style={styles.guideBadgeText}>🥇 Gold</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.description}>
              {experience.description ||
                'Trải nghiệm đặc biệt tại Huế, được dẫn dắt bởi người bản địa am hiểu văn hoá và lịch sử. Bạn sẽ được khám phá những điều thú vị mà ít du khách biết đến, thưởng thức ẩm thực authentic, và tạo những kỷ niệm đáng nhớ.'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Điểm nổi bật</Text>
            {(experience.highlights?.length
              ? experience.highlights
              : [
                  'Trải nghiệm văn hoá authentic',
                  'Hướng dẫn viên bản địa',
                  'Đồ ăn & nước uống miễn phí',
                  'Chụp ảnh kỷ niệm',
                ]
            ).map((hl, index) => (
              <View key={`${hl}-${index}`} style={styles.highlightItem}>
                <Text style={styles.highlightIcon}>✦</Text>
                <Text style={styles.highlightText}>{hl}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bao gồm</Text>
            <View style={styles.includesGrid}>
              {(experience.includes?.length
                ? experience.includes
                : ['Đồ ăn', 'Nước uống', 'Xe đưa đón', 'Vé tham quan']
              ).map((inc, index) => (
                <View key={`${inc}-${index}`} style={styles.includeChip}>
                  <Text style={styles.includeIcon}>✓</Text>
                  <Text style={styles.includeText}>{inc}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Điểm hẹn</Text>
            <View style={styles.meetingCard}>
              <Text style={styles.meetingIcon}>📍</Text>
              <View>
                <Text style={styles.meetingText}>
                  {experience.meeting_point || '15 Lê Lợi, Phú Hội, TP Huế'}
                </Text>
                <Text style={styles.meetingHint}>Guide sẽ đón bạn tại đây</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Đánh giá</Text>
              <Text style={styles.sectionMeta}>
                {displayReviewCount > 0
                  ? `${displayReviewCount} lượt gần đây`
                  : 'Chưa có lượt đánh giá'}
              </Text>
            </View>

            {engagementError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{engagementError}</Text>
                <TouchableOpacity onPress={() => loadEngagement()}>
                  <Text style={styles.errorBannerAction}>Tải lại</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {loadingEngagement ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.loadingText}>Đang tải đánh giá thật...</Text>
              </View>
            ) : (
              <>
                <View style={styles.ratingSummary}>
                  <View style={styles.ratingBig}>
                    <Text style={styles.ratingBigNumber}>
                      {displayReviewCount > 0 ? displayRating.toFixed(1) : '0.0'}
                    </Text>
                    <Text style={styles.ratingBigStar}>⭐</Text>
                  </View>
                  <View style={styles.ratingBars}>
                    {ratingBreakdown.map(({ star, count, width }) => (
                      <View key={star} style={styles.ratingBar}>
                        <Text style={styles.ratingBarLabel}>{star}</Text>
                        <View style={styles.ratingBarTrack}>
                          <View style={[styles.ratingBarFill, { width }]} />
                        </View>
                        <Text style={styles.ratingBarCount}>{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.reviewMetrics}>
                  <View style={styles.metricChip}>
                    <Text style={styles.metricChipText}>
                      Guide {reviewSummary.average_guide.toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.metricChip}>
                    <Text style={styles.metricChipText}>
                      Giá trị {reviewSummary.average_value.toFixed(1)}
                    </Text>
                  </View>
                </View>

                {pendingReviewBooking ? (
                  showReviewComposer ? (
                    <View style={styles.reviewComposer}>
                      <Text style={styles.reviewComposerTitle}>Đánh giá trải nghiệm của bạn</Text>
                      <Text style={styles.reviewComposerHint}>
                        Booking hoàn thành ngày {formatReviewDate(pendingReviewBooking.booking_date)}
                      </Text>

                      <View style={styles.ratingSelector}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity
                            key={star}
                            style={[
                              styles.ratingSelectorButton,
                              reviewRating >= star && styles.ratingSelectorButtonActive,
                            ]}
                            onPress={() => {
                              setReviewRating(star);
                              setReviewError('');
                            }}
                          >
                            <Text
                              style={[
                                styles.ratingSelectorText,
                                reviewRating >= star && styles.ratingSelectorTextActive,
                              ]}
                            >
                              ⭐
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TextInput
                        style={styles.reviewInput}
                        placeholder="Điều bạn thích, điểm nổi bật, cảm nhận về guide..."
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        value={reviewComment}
                        onChangeText={(value) => {
                          setReviewComment(value);
                          setReviewError('');
                        }}
                      />

                      {reviewError ? <Text style={styles.reviewError}>{reviewError}</Text> : null}

                      <View style={styles.reviewComposerFooter}>
                        <TouchableOpacity
                          style={styles.reviewComposerSecondaryButton}
                          onPress={() => {
                            setShowReviewComposer(false);
                            setReviewError('');
                          }}
                        >
                          <Text style={styles.reviewComposerSecondaryText}>Để sau</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.reviewComposerPrimaryButton,
                            submittingReview && styles.reviewComposerPrimaryButtonDisabled,
                          ]}
                          onPress={handleSubmitReview}
                          disabled={submittingReview}
                        >
                          {submittingReview ? (
                            <ActivityIndicator color={Colors.textOnPrimary} />
                          ) : (
                            <Text style={styles.reviewComposerPrimaryText}>Gửi đánh giá</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.reviewPromptCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewPromptTitle}>Bạn đã hoàn thành trải nghiệm này</Text>
                        <Text style={styles.reviewPromptText}>
                          Viết đánh giá để giúp traveller khác chọn đúng tour, và giúp guide cải thiện dịch vụ.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.reviewPromptButton}
                        onPress={() => setShowReviewComposer(true)}
                      >
                        <Text style={styles.reviewPromptButtonText}>Viết đánh giá</Text>
                      </TouchableOpacity>
                    </View>
                  )
                ) : null}

                {hasReviewedAllCompletedBookings ? (
                  <View style={styles.reviewStatusCard}>
                    <Text style={styles.reviewStatusTitle}>Bạn đã đánh giá trải nghiệm này</Text>
                    <Text style={styles.reviewStatusText}>
                      Review của bạn đã được ghi nhận trong phần đánh giá bên dưới.
                    </Text>
                  </View>
                ) : null}

                {reviews.length === 0 ? (
                  <View style={styles.emptyReviewCard}>
                    <Text style={styles.emptyReviewIcon}>📝</Text>
                    <Text style={styles.emptyReviewTitle}>Chưa có đánh giá nào</Text>
                    <Text style={styles.emptyReviewText}>
                      {pendingReviewBooking
                        ? 'Bạn có thể là người đầu tiên chia sẻ cảm nhận về trải nghiệm này.'
                        : 'Hoàn thành một booking để để lại đánh giá đầu tiên cho trải nghiệm này.'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.reviewList}>
                    {reviews.map((review) => (
                      <View key={review.id} style={styles.reviewItem}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewerAvatar}>
                            <Text style={styles.reviewerInitial}>
                              {getInitial(review.traveler?.full_name)}
                            </Text>
                          </View>
                          <View style={styles.reviewerInfo}>
                            <Text style={styles.reviewerName}>
                              {review.traveler?.full_name || 'Traveller Huế Travel'}
                            </Text>
                            <Text style={styles.reviewDate}>
                              {formatReviewDate(review.created_at)} • ⭐{' '}
                              {review.overall_rating.toFixed(1)}
                            </Text>
                          </View>
                          {review.is_featured ? (
                            <View style={styles.reviewFeaturedBadge}>
                              <Text style={styles.reviewFeaturedText}>Nổi bật</Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.reviewSubratings}>
                          <View style={styles.reviewSubratingChip}>
                            <Text style={styles.reviewSubratingText}>
                              Guide {review.guide_rating.toFixed(1)}
                            </Text>
                          </View>
                          <View style={styles.reviewSubratingChip}>
                            <Text style={styles.reviewSubratingText}>
                              Giá trị {review.value_rating.toFixed(1)}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.reviewText}>
                          {review.comment?.trim() || 'Người dùng chưa để lại bình luận chi tiết.'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chính sách huỷ</Text>
            <View style={styles.policyCard}>
              <Text style={styles.policyIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.policyTitle}>Huỷ miễn phí trước 24h</Text>
                <Text style={styles.policyText}>
                  Hoàn 100% nếu huỷ trước 24 giờ. Sau đó hoàn 50%.
                </Text>
              </View>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Từ</Text>
          <Text style={styles.price}>{formatPrice(experience.price)}</Text>
          <Text style={styles.priceUnit}>/người</Text>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => setShowBooking(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.bookButtonText}>Đặt ngay</Text>
        </TouchableOpacity>
      </View>

      <BookingModal
        visible={showBooking}
        experience={experience}
        onClose={() => setShowBooking(false)}
        onBookingCreated={onBookingCreated}
      />
    </View>
  );
}

function BookingModal({
  visible,
  experience,
  onClose,
  onBookingCreated,
}: {
  visible: boolean;
  experience: Experience;
  onClose: () => void;
  onBookingCreated: (booking: Booking) => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [guests, setGuests] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalPrice = experience.price * guests;
  const serviceFee = Math.floor(totalPrice * 0.05);

  const handleConfirmBooking = async () => {
    if (!date.trim()) {
      setError('Vui lòng nhập ngày trải nghiệm');
      return;
    }

    setLoading(true);
    setError('');

    const result = await api.createBooking({
      experience_id: experience.id,
      booking_date: date.trim(),
      start_time: time,
      guest_count: guests,
      special_notes: notes.trim() || undefined,
    });

    setLoading(false);

    if (result.success && result.data?.booking) {
      setDate('');
      setTime('09:00');
      setGuests(1);
      setNotes('');
      onClose();
      onBookingCreated(result.data.booking);
      return;
    }

    setError(result.error?.message || 'Không thể tạo booking');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>Đặt trải nghiệm</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={modalStyles.summary}>
              <View style={modalStyles.summaryImage}>
                <Text style={{ fontSize: 28 }}>
                  {experience.category === 'food' ? '🍜' : '🏛️'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.summaryTitle} numberOfLines={2}>
                  {experience.title}
                </Text>
                <Text style={modalStyles.summaryMeta}>
                  ⭐ {experience.rating} • 🕐 {Math.floor(experience.duration_mins / 60)}h
                </Text>
              </View>
            </View>

            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>📅 Ngày</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="YYYY-MM-DD (VD: 2026-03-15)"
                placeholderTextColor={Colors.textMuted}
                value={date}
                onChangeText={(value) => {
                  setDate(value);
                  setError('');
                }}
              />
            </View>

            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>🕐 Giờ bắt đầu</Text>
              <View style={modalStyles.timeRow}>
                {['07:00', '09:00', '14:00', '17:00', '19:00'].map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      modalStyles.timeChip,
                      time === slot && modalStyles.timeChipActive,
                    ]}
                    onPress={() => setTime(slot)}
                  >
                    <Text
                      style={[
                        modalStyles.timeText,
                        time === slot && modalStyles.timeTextActive,
                      ]}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>
                👥 Số khách (tối đa {experience.max_guests})
              </Text>
              <View style={modalStyles.guestRow}>
                <TouchableOpacity
                  style={modalStyles.guestBtn}
                  onPress={() => setGuests(Math.max(1, guests - 1))}
                >
                  <Text style={modalStyles.guestBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={modalStyles.guestCount}>{guests}</Text>
                <TouchableOpacity
                  style={modalStyles.guestBtn}
                  onPress={() => setGuests(Math.min(experience.max_guests, guests + 1))}
                >
                  <Text style={modalStyles.guestBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>📝 Ghi chú (tuỳ chọn)</Text>
              <TextInput
                style={[modalStyles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Dị ứng thực phẩm, yêu cầu đặc biệt..."
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={(value) => {
                  setNotes(value);
                  setError('');
                }}
                multiline
              />
            </View>

            {error ? <Text style={modalStyles.errorText}>{error}</Text> : null}

            <View style={modalStyles.priceBreakdown}>
              <View style={modalStyles.priceRow}>
                <Text style={modalStyles.priceLabel}>
                  {formatPrice(experience.price)} × {guests} khách
                </Text>
                <Text style={modalStyles.priceValue}>{formatPrice(totalPrice)}</Text>
              </View>
              <View style={modalStyles.priceRow}>
                <Text style={modalStyles.priceLabel}>Phí dịch vụ (5%)</Text>
                <Text style={modalStyles.priceValue}>{formatPrice(serviceFee)}</Text>
              </View>
              <View style={[modalStyles.priceRow, modalStyles.totalRow]}>
                <Text style={modalStyles.totalLabel}>Tổng cộng</Text>
                <Text style={modalStyles.totalValue}>
                  {formatPrice(totalPrice + serviceFee)}
                </Text>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[modalStyles.confirmButton, loading && modalStyles.confirmButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleConfirmBooking}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={modalStyles.confirmText}>
                Xác nhận đặt — {formatPrice(totalPrice + serviceFee)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  heroContainer: { height: 300, position: 'relative' },
  heroImage: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 72 },
  topNav: {
    position: 'absolute',
    top: 50,
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navRight: { flexDirection: 'row', gap: Spacing.sm },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: { opacity: 0.7 },
  navIcon: { fontSize: 18, color: '#FFF' },
  instantBadge: {
    position: 'absolute',
    bottom: Spacing.xxxl,
    left: Spacing.base,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  instantText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.textOnPrimary,
  },
  imageDots: {
    position: 'absolute',
    bottom: Spacing.base,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFF', width: 18 },

  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  title: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
    lineHeight: 30,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
    flexWrap: 'wrap',
  },
  star: { fontSize: 14 },
  ratingText: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
  },
  ratingCount: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  dot2: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    marginHorizontal: 4,
  },
  duration: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  guests: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },

  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  guideAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  guideInitial: {
    fontSize: 20,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.primary,
  },
  guideInfo: { flex: 1 },
  guideName: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
  },
  guideRole: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  guideBadge: {
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  guideBadgeText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold as any,
  },

  section: { marginTop: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  sectionMeta: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Fonts.weights.medium as any,
    marginBottom: Spacing.md,
  },
  description: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, lineHeight: 22 },

  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  highlightIcon: { fontSize: 14, color: Colors.primary },
  highlightText: { fontSize: Fonts.sizes.md, color: Colors.text },

  includesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  includeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.2)',
  },
  includeIcon: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: Fonts.weights.bold as any,
  },
  includeText: { fontSize: Fonts.sizes.sm, color: Colors.success },

  meetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  meetingIcon: { fontSize: 24 },
  meetingText: {
    fontSize: Fonts.sizes.md,
    color: Colors.text,
    fontWeight: Fonts.weights.medium as any,
  },
  meetingHint: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(244,67,54,0.12)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.18)',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: Fonts.sizes.sm,
    color: Colors.error,
  },
  errorBannerAction: {
    fontSize: Fonts.sizes.sm,
    color: Colors.error,
    fontWeight: Fonts.weights.bold as any,
  },

  loadingCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },

  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  ratingBig: { alignItems: 'center' },
  ratingBigNumber: {
    fontSize: 36,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.primary,
  },
  ratingBigStar: { fontSize: 18 },
  ratingBars: { flex: 1, gap: 6 },
  ratingBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ratingBarLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    width: 12,
    textAlign: 'center',
  },
  ratingBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  ratingBarFill: { height: '100%', backgroundColor: Colors.star, borderRadius: 2 },
  ratingBarCount: {
    width: 28,
    textAlign: 'right',
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
  },
  reviewMetrics: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },
  metricChip: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  metricChipText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.text,
    fontWeight: Fonts.weights.medium as any,
  },

  reviewPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(249,168,37,0.1)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(249,168,37,0.2)',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reviewPromptTitle: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
    marginBottom: 4,
  },
  reviewPromptText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  reviewPromptButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  reviewPromptButtonText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textOnPrimary,
    fontWeight: Fonts.weights.bold as any,
  },

  reviewComposer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reviewComposerTitle: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
  },
  reviewComposerHint: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  ratingSelector: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  ratingSelectorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingSelectorButtonActive: {
    backgroundColor: 'rgba(249,168,37,0.18)',
    borderColor: Colors.primary,
  },
  ratingSelectorText: { fontSize: 18, opacity: 0.45 },
  ratingSelectorTextActive: { opacity: 1 },
  reviewInput: {
    minHeight: 110,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.text,
    textAlignVertical: 'top',
    fontSize: Fonts.sizes.md,
  },
  reviewError: {
    fontSize: Fonts.sizes.sm,
    color: Colors.error,
    marginTop: Spacing.sm,
  },
  reviewComposerFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  reviewComposerSecondaryButton: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  reviewComposerSecondaryText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Fonts.weights.medium as any,
  },
  reviewComposerPrimaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minWidth: 120,
    alignItems: 'center',
  },
  reviewComposerPrimaryButtonDisabled: { opacity: 0.75 },
  reviewComposerPrimaryText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textOnPrimary,
    fontWeight: Fonts.weights.bold as any,
  },

  reviewStatusCard: {
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.18)',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reviewStatusTitle: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.success,
    marginBottom: 4,
  },
  reviewStatusText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  emptyReviewCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyReviewIcon: { fontSize: 28, marginBottom: Spacing.sm },
  emptyReviewTitle: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
    marginBottom: 4,
  },
  emptyReviewText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  reviewList: { gap: Spacing.md },
  reviewItem: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerInitial: {
    fontSize: 16,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.primary,
  },
  reviewerInfo: { flex: 1 },
  reviewerName: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
  },
  reviewDate: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  reviewFeaturedBadge: {
    backgroundColor: 'rgba(66,165,245,0.12)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  reviewFeaturedText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.info,
    fontWeight: Fonts.weights.semibold as any,
  },
  reviewSubratings: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  reviewSubratingChip: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  reviewSubratingText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  reviewText: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, lineHeight: 20 },

  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(66,165,245,0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(66,165,245,0.2)',
  },
  policyIcon: { fontSize: 28 },
  policyTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.info,
  },
  policyText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 34,
  },
  priceSection: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  priceLabel: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  price: {
    fontSize: Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.primary,
  },
  priceUnit: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  bookButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  bookButtonText: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.textOnPrimary,
  },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  headerTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
  },
  closeIcon: { fontSize: 20, color: Colors.textMuted, padding: Spacing.sm },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  summaryImage: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
  },
  summaryMeta: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },

  field: { marginBottom: Spacing.lg },
  fieldLabel: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: Fonts.sizes.md,
  },

  timeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  timeChip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeChipActive: { backgroundColor: 'rgba(249,168,37,0.15)', borderColor: Colors.primary },
  timeText: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
    fontWeight: Fonts.weights.medium as any,
  },
  timeTextActive: {
    color: Colors.primary,
    fontWeight: Fonts.weights.semibold as any,
  },

  guestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  guestBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  guestBtnText: {
    fontSize: 22,
    color: Colors.text,
    fontWeight: Fonts.weights.medium as any,
  },
  guestCount: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
    minWidth: 40,
    textAlign: 'center',
  },

  priceBreakdown: {
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: Fonts.sizes.md, color: Colors.textSecondary },
  priceValue: {
    fontSize: Fonts.sizes.md,
    color: Colors.text,
    fontWeight: Fonts.weights.medium as any,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  totalLabel: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
  },
  totalValue: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.primary,
  },
  errorText: { fontSize: Fonts.sizes.sm, color: Colors.error, marginBottom: Spacing.sm },

  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.textOnPrimary,
  },
});
