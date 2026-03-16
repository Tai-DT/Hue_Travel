import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Image,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { FriendInfo, Story, HueEvent, Trip, TripInvitation } from '@/services/api';

type SocialTab = 'feed' | 'friends' | 'trips' | 'events';

export default function SocialScreen() {
  const [tab, setTab] = useState<SocialTab>('feed');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cộng đồng</Text>
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'feed' as SocialTab, label: '📸 Feed', icon: '' },
          { key: 'friends' as SocialTab, label: '👥 Bạn bè', icon: '' },
          { key: 'trips' as SocialTab, label: '✈️ Trips', icon: '' },
          { key: 'events' as SocialTab, label: '🎫 Sự kiện', icon: '' },
        ]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'feed' && <FeedTab />}
      {tab === 'friends' && <FriendsTab />}
      {tab === 'trips' && <TripsTab />}
      {tab === 'events' && <EventsTab />}
    </View>
  );
}

// ============================================
// Feed Tab — Stories
// ============================================
function FeedTab() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getFeed();
    if (res.success && res.data?.stories) setStories(res.data.stories);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handlePost = async () => {
    if (!newContent.trim()) return;
    setPosting(true);
    const res = await api.createStory({ content: newContent.trim() });
    if (res.success) {
      setNewContent('');
      load();
    }
    setPosting(false);
  };

  const handleLike = async (id: string) => {
    await api.likeStory(id);
    setStories(prev => prev.map(s => s.id === id
      ? { ...s, is_liked: !s.is_liked, like_count: s.is_liked ? s.like_count - 1 : s.like_count + 1 }
      : s
    ));
  };

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    if (mins < 1440) return `${Math.floor(mins / 60)} giờ trước`;
    return `${Math.floor(mins / 1440)} ngày trước`;
  };

  if (loading) return <LoadingView text="Đang tải feed..." />;

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Compose */}
      <View style={styles.composeCard}>
        <TextInput
          style={styles.composeInput}
          placeholder="Chia sẻ khoảnh khắc tại Huế..."
          placeholderTextColor={Colors.textMuted}
          value={newContent}
          onChangeText={setNewContent}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.postBtn, !newContent.trim() && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!newContent.trim() || posting}
        >
          {posting
            ? <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            : <Text style={styles.postBtnText}>Đăng →</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Stories */}
      {stories.length === 0 ? (
        <EmptyView icon="📸" title="Chưa có bài đăng" text="Hãy chia sẻ khoảnh khắc đầu tiên!" />
      ) : (
        stories.map(story => (
          <View key={story.id} style={styles.storyCard}>
            <View style={styles.storyHeader}>
              <View style={styles.storyAvatar}>
                {story.user?.avatar_url
                  ? <Image source={{ uri: story.user.avatar_url }} style={styles.avatarImg} />
                  : <Text style={styles.avatarFallback}>👤</Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storyName}>{story.user?.full_name || 'Người dùng'}</Text>
                <Text style={styles.storyTime}>{timeAgo(story.created_at)}</Text>
              </View>
              {story.location && (
                <View style={styles.locationTag}>
                  <Text style={styles.locationText}>📍 {story.location}</Text>
                </View>
              )}
            </View>

            <Text style={styles.storyContent}>{story.content}</Text>

            {story.image_urls && story.image_urls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storyImages}>
                {story.image_urls.map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={styles.storyImage} />
                ))}
              </ScrollView>
            )}

            <View style={styles.storyActions}>
              <TouchableOpacity style={styles.storyAction} onPress={() => handleLike(story.id)}>
                <Text style={[styles.actionIcon, story.is_liked && styles.actionIconActive]}>
                  {story.is_liked ? '❤️' : '🤍'}
                </Text>
                <Text style={styles.actionCount}>{story.like_count}</Text>
              </TouchableOpacity>
              <View style={styles.storyAction}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionCount}>{story.comment_count}</Text>
              </View>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Friends Tab
// ============================================
function FriendsTab() {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [pending, setPending] = useState<FriendInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subTab, setSubTab] = useState<'list' | 'pending'>('list');

  const load = useCallback(async () => {
    const [friendsRes, pendingRes] = await Promise.all([
      api.getFriends(),
      api.getPendingFriendRequests(),
    ]);
    if (friendsRes.success && friendsRes.data?.friends) setFriends(friendsRes.data.friends);
    if (pendingRes.success && pendingRes.data?.requests) setPending(pendingRes.data.requests);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAccept = async (id: string) => {
    const res = await api.acceptFriendRequest(id);
    if (res.success) load();
  };

  const handleDecline = async (id: string) => {
    const res = await api.declineFriendRequest(id);
    if (res.success) load();
  };

  if (loading) return <LoadingView text="Đang tải bạn bè..." />;

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Sub tabs */}
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'list' && styles.subTabActive]}
          onPress={() => setSubTab('list')}
        >
          <Text style={[styles.subTabText, subTab === 'list' && styles.subTabTextActive]}>
            Bạn bè ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'pending' && styles.subTabActive]}
          onPress={() => setSubTab('pending')}
        >
          <Text style={[styles.subTabText, subTab === 'pending' && styles.subTabTextActive]}>
            Lời mời ({pending.length})
          </Text>
          {pending.length > 0 && <View style={styles.pendingDot} />}
        </TouchableOpacity>
      </View>

      {subTab === 'list' ? (
        friends.length === 0 ? (
          <EmptyView icon="👥" title="Chưa có bạn bè" text="Kết nối với những người bạn đồng hành!" />
        ) : (
          friends.map((f) => (
            <View key={f.friendship_id} style={styles.friendCard}>
              <View style={styles.friendAvatar}>
                {f.avatar_url
                  ? <Image source={{ uri: f.avatar_url }} style={styles.avatarImg} />
                  : <Text style={styles.avatarFallback}>👤</Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{f.full_name}</Text>
                {f.level && <Text style={styles.friendLevel}>🏅 {f.level}</Text>}
              </View>
              <TouchableOpacity style={styles.chatBtn}>
                <Text>💬</Text>
              </TouchableOpacity>
            </View>
          ))
        )
      ) : (
        pending.length === 0 ? (
          <EmptyView icon="📨" title="Không có lời mời" text="Chưa có lời mời kết bạn mới." />
        ) : (
          pending.map((f) => (
            <View key={f.friendship_id} style={styles.friendCard}>
              <View style={styles.friendAvatar}>
                {f.avatar_url
                  ? <Image source={{ uri: f.avatar_url }} style={styles.avatarImg} />
                  : <Text style={styles.avatarFallback}>👤</Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{f.full_name}</Text>
                <Text style={styles.friendLevel}>Muốn kết bạn với bạn</Text>
              </View>
              <View style={styles.pendingActions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(f.friendship_id)}>
                  <Text style={styles.acceptBtnText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(f.friendship_id)}>
                  <Text style={styles.declineBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Trips Tab
// ============================================
function TripsTab() {
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [discover, setDiscover] = useState<Trip[]>([]);
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [myRes, discoverRes, invRes] = await Promise.all([
      api.getMyTrips(),
      api.discoverTrips(),
      api.getTripInvitations(),
    ]);
    if (myRes.success && myRes.data?.trips) setMyTrips(myRes.data.trips);
    if (discoverRes.success && discoverRes.data?.trips) setDiscover(discoverRes.data.trips);
    if (invRes.success && invRes.data?.invitations) setInvitations(invRes.data.invitations);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
  };

  const handleAcceptInvite = async (tripId: string) => {
    await api.acceptTripInvite(tripId);
    load();
  };

  const handleJoin = async (tripId: string) => {
    await api.joinPublicTrip(tripId);
    load();
  };

  if (loading) return <LoadingView text="Đang tải chuyến đi..." />;

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Invitations */}
      {invitations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📨 Lời mời tham gia</Text>
          {invitations.map((inv) => (
            <View key={inv.trip_id} style={styles.inviteCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteTitle}>{inv.trip_title}</Text>
                <Text style={styles.inviteFrom}>Từ {inv.inviter_name}</Text>
              </View>
              <TouchableOpacity style={styles.joinBtn} onPress={() => handleAcceptInvite(inv.trip_id)}>
                <Text style={styles.joinBtnText}>Tham gia</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* My Trips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✈️ Chuyến đi của bạn</Text>
        {myTrips.length === 0 ? (
          <EmptyView icon="🧳" title="Chưa có chuyến đi" text="Tạo chuyến đi đầu tiên cùng bạn bè!" />
        ) : (
          myTrips.map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.tripDates}>
                <Text style={styles.tripDateStart}>{formatDate(trip.start_date)}</Text>
                <Text style={styles.tripDateArrow}>→</Text>
                <Text style={styles.tripDateEnd}>{formatDate(trip.end_date)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.tripTitle}>{trip.title}</Text>
                <Text style={styles.tripMembers}>👥 {trip.member_count} thành viên</Text>
              </View>
              {trip.is_public && (
                <View style={styles.publicBadge}>
                  <Text style={styles.publicBadgeText}>Công khai</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Discover */}
      {discover.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌍 Khám phá</Text>
          {discover.map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripTitle}>{trip.title}</Text>
                <Text style={styles.tripMembers}>
                  {formatDate(trip.start_date)} — {formatDate(trip.end_date)} • 👥 {trip.member_count}
                </Text>
                {trip.owner && <Text style={styles.tripOwner}>Bởi {trip.owner.full_name}</Text>}
              </View>
              <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(trip.id)}>
                <Text style={styles.joinBtnText}>Tham gia</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Events Tab
// ============================================
function EventsTab() {
  const [events, setEvents] = useState<HueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getEvents();
    if (res.success && res.data?.events) setEvents(res.data.events);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleRSVP = async (id: string, status: 'going' | 'interested') => {
    await api.rsvpEvent(id, status);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, my_rsvp: status } : e));
  };

  const formatEventDate = (d: string) => {
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  if (loading) return <LoadingView text="Đang tải sự kiện..." />;

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {events.length === 0 ? (
        <EmptyView icon="🎫" title="Không có sự kiện" text="Chưa có sự kiện nào sắp tới ở Huế." />
      ) : (
        events.map((event) => (
          <View key={event.id} style={styles.eventCard}>
            {event.image_url && (
              <Image source={{ uri: event.image_url }} style={styles.eventImage} />
            )}
            <View style={styles.eventBody}>
              <View style={styles.eventCatBadge}>
                <Text style={styles.eventCatText}>{event.category}</Text>
              </View>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventMeta}>📅 {formatEventDate(event.start_date)}</Text>
              <Text style={styles.eventMeta}>📍 {event.location}</Text>
              <Text style={styles.eventMeta}>👥 {event.attendee_count} tham dự</Text>

              <View style={styles.rsvpRow}>
                <TouchableOpacity
                  style={[styles.rsvpBtn, event.my_rsvp === 'going' && styles.rsvpBtnActive]}
                  onPress={() => handleRSVP(event.id, 'going')}
                >
                  <Text style={[styles.rsvpBtnText, event.my_rsvp === 'going' && styles.rsvpBtnTextActive]}>
                    ✓ Tham dự
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rsvpBtn, event.my_rsvp === 'interested' && styles.rsvpBtnActive]}
                  onPress={() => handleRSVP(event.id, 'interested')}
                >
                  <Text style={[styles.rsvpBtnText, event.my_rsvp === 'interested' && styles.rsvpBtnTextActive]}>
                    ⭐ Quan tâm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// Shared Components
// ============================================
function LoadingView({ text }: { text: string }) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={Colors.primary} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

function EmptyView({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
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
  scrollView: { flex: 1, paddingHorizontal: Spacing.xl },

  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 3,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, fontWeight: Fonts.weights.medium as any },
  tabTextActive: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.bold as any },

  // Sub Tabs
  subTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  subTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  subTabActive: { borderColor: Colors.primary, backgroundColor: 'rgba(249,168,37,0.1)' },
  subTabText: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  subTabTextActive: { color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  pendingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error,
  },

  // Compose
  composeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  composeInput: {
    color: Colors.text,
    fontSize: Fonts.sizes.base,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  postBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { color: Colors.textOnPrimary, fontWeight: Fonts.weights.bold as any, fontSize: Fonts.sizes.sm },

  // Story Card
  storyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  storyAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { fontSize: 18 },
  storyName: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  storyTime: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  locationTag: {
    backgroundColor: 'rgba(249,168,37,0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  locationText: { fontSize: Fonts.sizes.xs, color: Colors.primary },
  storyContent: {
    fontSize: Fonts.sizes.base,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  storyImages: { marginBottom: Spacing.sm },
  storyImage: {
    width: 200, height: 150, borderRadius: BorderRadius.lg, marginRight: Spacing.sm,
  },
  storyActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  storyAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 18, opacity: 0.6 },
  actionIconActive: { opacity: 1 },
  actionCount: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },

  // Friends
  friendCard: {
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
  friendAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  friendName: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  friendLevel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  chatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  pendingActions: { flexDirection: 'row', gap: Spacing.sm },
  acceptBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.success,
    justifyContent: 'center', alignItems: 'center',
  },
  acceptBtnText: { color: '#FFF', fontSize: 16, fontWeight: Fonts.weights.bold as any },
  declineBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  declineBtnText: { color: Colors.textMuted, fontSize: 16 },

  // Sections
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
    marginBottom: Spacing.md,
  },

  // Trips
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tripDates: { alignItems: 'center' },
  tripDateStart: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.bold as any },
  tripDateArrow: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginVertical: 2 },
  tripDateEnd: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.bold as any },
  tripTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  tripMembers: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  tripOwner: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  publicBadge: {
    backgroundColor: 'rgba(66,165,245,0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  publicBadgeText: { fontSize: Fonts.sizes.xs, color: Colors.info },

  // Invitations
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249,168,37,0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(249,168,37,0.2)',
  },
  inviteTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  inviteFrom: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  joinBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  joinBtnText: { color: Colors.textOnPrimary, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any },

  // Events
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  eventImage: { width: '100%', height: 150 },
  eventBody: { padding: Spacing.base },
  eventCatBadge: {
    backgroundColor: 'rgba(249,168,37,0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  eventCatText: { fontSize: Fonts.sizes.xs, color: Colors.primary, fontWeight: Fonts.weights.semibold as any },
  eventTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.bold as any,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  eventMeta: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginBottom: 4 },
  rsvpRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  rsvpBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rsvpBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(249,168,37,0.12)',
  },
  rsvpBtnText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  rsvpBtnTextActive: { color: Colors.primary, fontWeight: Fonts.weights.bold as any },

  // Shared
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingTop: 80 },
  loadingText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.bold as any, color: Colors.text, marginBottom: Spacing.sm },
  emptyText: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: 'center' },
});
