import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Image,
} from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import api, { FriendInfo, Guide, Story, StoryComment, HueEvent, Trip, TripInvitation, TripMember } from '@/services/api';

type SocialTab = 'feed' | 'friends' | 'trips' | 'events';

type SocialScreenProps = {
  onOpenChatWithUser?: (userId: string) => void;
  onOpenChatRoom?: (roomId: string) => void;
};

export default function SocialScreen({ onOpenChatWithUser, onOpenChatRoom }: SocialScreenProps) {
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
      {tab === 'friends' && <FriendsTab onOpenChatWithUser={onOpenChatWithUser} />}
      {tab === 'trips' && <TripsTab onOpenChatRoom={onOpenChatRoom} />}
      {tab === 'events' && <EventsTab />}
    </View>
  );
}

// ============================================
// Feed Tab — Stories
// ============================================
type FriendState = {
  status: string;
  incoming?: boolean;
  friendshipId?: string;
};

function FeedTab() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friendStates, setFriendStates] = useState<Record<string, FriendState>>({});

  const load = useCallback(async () => {
    const res = await api.getFeed();
    if (res.success && res.data?.stories) setStories(res.data.stories);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await api.getMe();
      if (cancelled || !res.success || !res.data) return;
      const me = (res.data as any).user || res.data;
      setCurrentUserId(me.id);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUserId || stories.length === 0) return;

    const userIds = [...new Set(
      stories
        .map((story) => story.user_id)
        .filter((userId) => Boolean(userId) && userId !== currentUserId)
    )];

    if (userIds.length === 0) return;

    let cancelled = false;

    (async () => {
      const nextStates = await Promise.all(userIds.map(async (userId) => {
        const res = await api.getFriendStatus(userId);
        const friendship = res.data?.friendship;
        return [
          userId,
          {
            status: res.success && res.data?.status ? res.data.status : 'none',
            incoming: friendship?.addressee_id === currentUserId && res.data?.status === 'pending',
            friendshipId: friendship?.id,
          } satisfies FriendState,
        ] as const;
      }));

      if (!cancelled) {
        setFriendStates((prev) => ({
          ...prev,
          ...Object.fromEntries(nextStates),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, stories]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const getFriendActionLabel = (state?: FriendState) => {
    if (!state || state.status === 'none' || state.status === 'declined') return 'Kết bạn';
    if (state.status === 'accepted') return 'Bạn bè';
    if (state.incoming) return 'Chấp nhận';
    return 'Đã gửi';
  };

  const handleFriendAction = async (userId: string) => {
    const state = friendStates[userId];

    if (!state || state.status === 'none' || state.status === 'declined') {
      const res = await api.sendFriendRequest(userId);
      if (res.success) {
        setFriendStates((prev) => ({
          ...prev,
          [userId]: {
            status: 'pending',
            incoming: false,
            friendshipId: res.data?.friendship?.id,
          },
        }));
      }
      return;
    }

    if (state.status === 'pending' && state.incoming && state.friendshipId) {
      const res = await api.acceptFriendRequest(state.friendshipId);
      if (res.success) {
        setFriendStates((prev) => ({
          ...prev,
          [userId]: {
            status: 'accepted',
            incoming: false,
            friendshipId: state.friendshipId,
          },
        }));
      }
    }
  };

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

  // --- Comments ---
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentsByStory, setCommentsByStory] = useState<Record<string, StoryComment[]>>({});
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState<string | null>(null);
  const [commentPosting, setCommentPosting] = useState(false);

  const handleToggleComments = async (storyId: string) => {
    if (expandedComments === storyId) {
      setExpandedComments(null);
      return;
    }
    setExpandedComments(storyId);
    setCommentText('');
    if (!commentsByStory[storyId]) {
      setCommentLoading(storyId);
      const res = await api.getStoryComments(storyId);
      if (res.success && res.data?.comments) {
        setCommentsByStory(prev => ({ ...prev, [storyId]: res.data!.comments }));
      } else {
        setCommentsByStory(prev => ({ ...prev, [storyId]: [] }));
      }
      setCommentLoading(null);
    }
  };

  const handlePostComment = async (storyId: string) => {
    if (!commentText.trim()) return;
    setCommentPosting(true);
    const res = await api.commentStory(storyId, commentText.trim());
    if (res.success && res.data?.comment) {
      setCommentsByStory(prev => ({
        ...prev,
        [storyId]: [...(prev[storyId] || []), res.data!.comment],
      }));
      setStories(prev => prev.map(s =>
        s.id === storyId ? { ...s, comment_count: s.comment_count + 1 } : s
      ));
      setCommentText('');
    }
    setCommentPosting(false);
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
              {currentUserId && story.user_id !== currentUserId ? (
                <TouchableOpacity
                  style={[
                    styles.friendRequestBtn,
                    (friendStates[story.user_id]?.status === 'accepted' ||
                      (friendStates[story.user_id]?.status === 'pending' && !friendStates[story.user_id]?.incoming))
                      && styles.friendRequestBtnDisabled,
                  ]}
                  disabled={
                    friendStates[story.user_id]?.status === 'accepted' ||
                    (friendStates[story.user_id]?.status === 'pending' && !friendStates[story.user_id]?.incoming)
                  }
                  onPress={() => handleFriendAction(story.user_id)}
                >
                  <Text style={styles.friendRequestBtnText}>
                    {getFriendActionLabel(friendStates[story.user_id])}
                  </Text>
                </TouchableOpacity>
              ) : null}
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
              <TouchableOpacity style={styles.storyAction} onPress={() => handleToggleComments(story.id)}>
                <Text style={[styles.actionIcon, expandedComments === story.id && styles.actionIconActive]}>💬</Text>
                <Text style={styles.actionCount}>{story.comment_count}</Text>
              </TouchableOpacity>
            </View>

            {/* Inline Comments */}
            {expandedComments === story.id && (
              <View style={styles.commentsSection}>
                {commentLoading === story.id ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: Spacing.sm }} />
                ) : (
                  <>
                    {(commentsByStory[story.id] || []).length === 0 ? (
                      <Text style={styles.noComments}>Chưa có bình luận. Hãy là người đầu tiên!</Text>
                    ) : (
                      (commentsByStory[story.id] || []).map(c => (
                        <View key={c.id} style={styles.commentItem}>
                          <Text style={styles.commentAuthor}>{c.user?.full_name || 'Người dùng'}</Text>
                          <Text style={styles.commentContent}>{c.content}</Text>
                          <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                        </View>
                      ))
                    )}
                    <View style={styles.commentInputRow}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Viết bình luận..."
                        placeholderTextColor={Colors.textMuted}
                        value={commentText}
                        onChangeText={setCommentText}
                        maxLength={300}
                      />
                      <TouchableOpacity
                        style={[styles.commentSendBtn, !commentText.trim() && styles.postBtnDisabled]}
                        onPress={() => handlePostComment(story.id)}
                        disabled={!commentText.trim() || commentPosting}
                      >
                        {commentPosting
                          ? <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                          : <Text style={styles.commentSendText}>Gửi</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
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
function FriendsTab({ onOpenChatWithUser }: { onOpenChatWithUser?: (userId: string) => void }) {
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
            <View key={`${f.friendship_id}-${f.user_id}`} style={styles.friendCard}>
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
              <TouchableOpacity style={styles.chatBtn} onPress={() => onOpenChatWithUser?.(f.user_id)}>
                <Text style={styles.chatBtnText}>💬 Nhắn tin</Text>
              </TouchableOpacity>
            </View>
          ))
        )
      ) : (
        pending.length === 0 ? (
          <EmptyView icon="📨" title="Không có lời mời" text="Chưa có lời mời kết bạn mới." />
        ) : (
          pending.map((f) => (
            <View key={`${f.friendship_id}-${f.user_id}`} style={styles.friendCard}>
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
                  <Text style={styles.acceptBtnText}>Chấp nhận</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(f.friendship_id)}>
                  <Text style={styles.declineBtnText}>Từ chối</Text>
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
function TripsTab({ onOpenChatRoom }: { onOpenChatRoom?: (roomId: string) => void }) {
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [discover, setDiscover] = useState<Trip[]>([]);
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tripTitle, setTripTitle] = useState('');
  const [tripDestination, setTripDestination] = useState('Huế');
  const [tripStartDate, setTripStartDate] = useState('');
  const [tripEndDate, setTripEndDate] = useState('');
  const [tripIsPublic, setTripIsPublic] = useState(true);
  const [expandedFriendTripId, setExpandedFriendTripId] = useState<string | null>(null);
  const [expandedGuideTripId, setExpandedGuideTripId] = useState<string | null>(null);
  const [guidesByTripId, setGuidesByTripId] = useState<Record<string, Guide[]>>({});
  const [tripMembersByTripId, setTripMembersByTripId] = useState<Record<string, TripMember[]>>({});
  const [loadingGuidesTripId, setLoadingGuidesTripId] = useState<string | null>(null);
  const [loadingMembersTripId, setLoadingMembersTripId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [myRes, discoverRes, invRes, friendsRes] = await Promise.all([
      api.getMyTrips(),
      api.discoverTrips(),
      api.getTripInvitations(),
      api.getFriends(),
    ]);
    if (myRes.success && myRes.data?.trips) setMyTrips(myRes.data.trips);
    if (discoverRes.success && discoverRes.data?.trips) setDiscover(discoverRes.data.trips);
    if (invRes.success && invRes.data?.invitations) setInvitations(invRes.data.invitations);
    if (friendsRes.success && friendsRes.data?.friends) setFriends(friendsRes.data.friends);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const formatDate = (d: string) => {
    if (!d) return 'Chưa chọn';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
  };

  const handleCreateTrip = async () => {
    if (!tripTitle.trim()) return;

    setCreating(true);
    const res = await api.createTrip({
      title: tripTitle.trim(),
      destination: tripDestination.trim() || 'Huế',
      start_date: tripStartDate.trim() || undefined,
      end_date: tripEndDate.trim() || undefined,
      is_public: tripIsPublic,
    });
    setCreating(false);

    if (res.success) {
      setTripTitle('');
      setTripDestination('Huế');
      setTripStartDate('');
      setTripEndDate('');
      setTripIsPublic(true);
      load();
    }
  };

  const handleAcceptInvite = async (tripId: string) => {
    await api.acceptTripInvite(tripId);
    load();
  };

  const handleJoin = async (tripId: string) => {
    await api.joinPublicTrip(tripId);
    load();
  };

  const ensureTripMembersLoaded = useCallback(async (tripId: string) => {
    if (tripMembersByTripId[tripId]) return;

    setLoadingMembersTripId(tripId);
    const res = await api.getTrip(tripId);
    if (res.success && res.data?.trip) {
      setTripMembersByTripId((prev) => ({
        ...prev,
        [tripId]: res.data?.trip.members || [],
      }));
    }
    setLoadingMembersTripId(null);
  }, [tripMembersByTripId]);

  const upsertTripMemberStatus = useCallback((
    tripId: string,
    userId: string,
    fullName: string,
    role: string,
    status: string,
  ) => {
    setTripMembersByTripId((prev) => {
      const existing = prev[tripId] || [];
      const next = existing.some((member) => member.user_id === userId)
        ? existing.map((member) => (
          member.user_id === userId
            ? { ...member, full_name: member.full_name || fullName, role, status }
            : member
        ))
        : [...existing, { user_id: userId, full_name: fullName, role, status }];

      return {
        ...prev,
        [tripId]: next,
      };
    });
  }, []);

  const toggleFriendPicker = async (tripId: string) => {
    if (expandedFriendTripId === tripId) {
      setExpandedFriendTripId(null);
      return;
    }

    setExpandedFriendTripId(tripId);
    await ensureTripMembersLoaded(tripId);
  };

  const handleInviteFriend = async (tripId: string, userId: string) => {
    const res = await api.inviteTripMember(tripId, userId);
    if (res.success) {
      const friend = friends.find((item) => item.user_id === userId);
      upsertTripMemberStatus(tripId, userId, friend?.full_name || 'Người dùng', 'member', 'invited');
      load();
    }
  };

  const toggleGuidePicker = async (tripId: string) => {
    if (expandedGuideTripId === tripId) {
      setExpandedGuideTripId(null);
      return;
    }

    setExpandedGuideTripId(tripId);
    await ensureTripMembersLoaded(tripId);
    if (guidesByTripId[tripId]) return;

    setLoadingGuidesTripId(tripId);
    const res = await api.searchGuidesForTrip(tripId);
    if (res.success && res.data?.guides) {
      setGuidesByTripId((prev) => ({ ...prev, [tripId]: res.data!.guides }));
    }
    setLoadingGuidesTripId(null);
  };

  const handleInviteGuide = async (tripId: string, guideId: string) => {
    const res = await api.inviteTripGuide(tripId, guideId);
    if (res.success) {
      const guide = (guidesByTripId[tripId] || []).find((item) => item.user_id === guideId);
      upsertTripMemberStatus(
        tripId,
        guideId,
        guide?.user?.full_name || 'Guide Huế Travel',
        'guide',
        'invited',
      );
      load();
    }
  };

  const getTripMemberStatus = (tripId: string, userId: string) => (
    tripMembersByTripId[tripId]?.find((member) => member.user_id === userId)?.status
  );

  const getInviteButtonLabel = (tripId: string, userId: string) => {
    const status = getTripMemberStatus(tripId, userId);
    if (status === 'accepted') return 'Đã tham gia';
    if (status === 'invited') return 'Đã mời';
    if (status === 'declined' || status === 'removed') return 'Mời lại';
    return 'Mời';
  };

  const isInviteDisabled = (tripId: string, userId: string) => {
    const status = getTripMemberStatus(tripId, userId);
    return status === 'accepted' || status === 'invited';
  };

  if (loading) return <LoadingView text="Đang tải chuyến đi..." />;

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.composeCard}>
        <Text style={styles.sectionTitle}>➕ Tạo chuyến đi nhóm</Text>
        <TextInput
          style={styles.tripFormInput}
          placeholder="Tên chuyến đi"
          placeholderTextColor={Colors.textMuted}
          value={tripTitle}
          onChangeText={setTripTitle}
        />
        <TextInput
          style={styles.tripFormInput}
          placeholder="Điểm đến"
          placeholderTextColor={Colors.textMuted}
          value={tripDestination}
          onChangeText={setTripDestination}
        />
        <View style={styles.tripFormRow}>
          <TextInput
            style={[styles.tripFormInput, styles.tripFormInputHalf]}
            placeholder="Bắt đầu (YYYY-MM-DD)"
            placeholderTextColor={Colors.textMuted}
            value={tripStartDate}
            onChangeText={setTripStartDate}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.tripFormInput, styles.tripFormInputHalf]}
            placeholder="Kết thúc (YYYY-MM-DD)"
            placeholderTextColor={Colors.textMuted}
            value={tripEndDate}
            onChangeText={setTripEndDate}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={[styles.tripVisibilityBtn, tripIsPublic && styles.tripVisibilityBtnActive]}
          onPress={() => setTripIsPublic((prev) => !prev)}
        >
          <Text style={[styles.tripVisibilityText, tripIsPublic && styles.tripVisibilityTextActive]}>
            {tripIsPublic ? '🌍 Công khai' : '🔒 Riêng tư'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.postBtn, !tripTitle.trim() && styles.postBtnDisabled]}
          onPress={handleCreateTrip}
          disabled={!tripTitle.trim() || creating}
        >
          {creating
            ? <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            : <Text style={styles.postBtnText}>Tạo chuyến đi</Text>}
        </TouchableOpacity>
      </View>

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
              <View style={styles.tripRow}>
                <View style={styles.tripDates}>
                  <Text style={styles.tripDateStart}>{formatDate(trip.start_date)}</Text>
                  <Text style={styles.tripDateArrow}>→</Text>
                  <Text style={styles.tripDateEnd}>{formatDate(trip.end_date)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={styles.tripTitle}>{trip.title}</Text>
                  <Text style={styles.tripOwner}>📍 {trip.destination || 'Huế'}</Text>
                  <Text style={styles.tripMembers}>👥 {trip.member_count} thành viên</Text>
                </View>
                {trip.is_public && (
                  <View style={styles.publicBadge}>
                    <Text style={styles.publicBadgeText}>Công khai</Text>
                  </View>
                )}
              </View>
              <View style={styles.tripActionRow}>
                {trip.chat_room_id ? (
                  <TouchableOpacity style={styles.tripMiniBtn} onPress={() => onOpenChatRoom?.(trip.chat_room_id!)}>
                    <Text style={styles.tripMiniBtnText}>💬 Chat nhóm</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.tripMiniBtn}
                  onPress={() => toggleFriendPicker(trip.id)}
                >
                  <Text style={styles.tripMiniBtnText}>👥 Mời bạn</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tripMiniBtn} onPress={() => toggleGuidePicker(trip.id)}>
                  <Text style={styles.tripMiniBtnText}>🧭 Mời guide</Text>
                </TouchableOpacity>
              </View>
              {expandedFriendTripId === trip.id ? (
                <View style={styles.tripInvitePanel}>
                  <Text style={styles.tripInviteTitle}>Bạn bè của bạn</Text>
                  {loadingMembersTripId === trip.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : friends.length === 0 ? (
                    <Text style={styles.tripInviteHint}>Hãy kết bạn trước để mời vào chuyến đi.</Text>
                  ) : (
                    friends.map((friend) => (
                      <View key={`${trip.id}-${friend.user_id}`} style={styles.tripInviteRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.friendName}>{friend.full_name}</Text>
                          {friend.level ? <Text style={styles.friendLevel}>🏅 {friend.level}</Text> : null}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.joinBtn,
                            isInviteDisabled(trip.id, friend.user_id) && styles.invitedBtn,
                          ]}
                          onPress={() => handleInviteFriend(trip.id, friend.user_id)}
                          disabled={isInviteDisabled(trip.id, friend.user_id)}
                        >
                          <Text
                            style={[
                              styles.joinBtnText,
                              isInviteDisabled(trip.id, friend.user_id) && styles.invitedBtnText,
                            ]}
                          >
                            {getInviteButtonLabel(trip.id, friend.user_id)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
              {expandedGuideTripId === trip.id ? (
                <View style={styles.tripInvitePanel}>
                  <Text style={styles.tripInviteTitle}>Hướng dẫn viên phù hợp</Text>
                  {loadingMembersTripId === trip.id || loadingGuidesTripId === trip.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (guidesByTripId[trip.id] || []).length === 0 ? (
                    <Text style={styles.tripInviteHint}>Chưa có guide khả dụng.</Text>
                  ) : (
                    (guidesByTripId[trip.id] || []).map((guide) => (
                      <View key={`${trip.id}-${guide.user_id}`} style={styles.tripInviteRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.friendName}>{guide.user?.full_name || 'Guide Huế Travel'}</Text>
                          <Text style={styles.friendLevel}>
                            ⭐ {guide.avg_rating.toFixed(1)} • {guide.specialties?.join(', ') || 'Guide địa phương'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.joinBtn,
                            isInviteDisabled(trip.id, guide.user_id) && styles.invitedBtn,
                          ]}
                          onPress={() => handleInviteGuide(trip.id, guide.user_id)}
                          disabled={isInviteDisabled(trip.id, guide.user_id)}
                        >
                          <Text
                            style={[
                              styles.joinBtnText,
                              isInviteDisabled(trip.id, guide.user_id) && styles.invitedBtnText,
                            ]}
                          >
                            {getInviteButtonLabel(trip.id, guide.user_id)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
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
              <View style={styles.tripRow}>
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
  friendRequestBtn: {
    backgroundColor: 'rgba(249,168,37,0.14)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  friendRequestBtnDisabled: { opacity: 0.55 },
  friendRequestBtnText: {
    color: Colors.primary,
    fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.semibold as any,
  },
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
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatBtnText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.medium as any },
  pendingActions: { flexDirection: 'row', gap: Spacing.sm },
  acceptBtn: {
    minHeight: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
  },
  acceptBtnText: { color: '#FFF', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any },
  declineBtn: {
    minHeight: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
  },
  declineBtnText: { color: Colors.textMuted, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.medium as any },

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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripFormInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tripFormRow: { flexDirection: 'row', gap: Spacing.sm },
  tripFormInputHalf: { flex: 1 },
  tripVisibilityBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tripVisibilityBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(249,168,37,0.12)',
  },
  tripVisibilityText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.medium as any,
  },
  tripVisibilityTextActive: { color: Colors.primary },
  tripDates: { alignItems: 'center' },
  tripDateStart: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.bold as any },
  tripDateArrow: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginVertical: 2 },
  tripDateEnd: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: Fonts.weights.bold as any },
  tripTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.semibold as any, color: Colors.text },
  tripMembers: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  tripOwner: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  tripActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  tripMiniBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
  },
  tripMiniBtnText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.medium as any,
  },
  tripInvitePanel: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  tripInviteTitle: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
  },
  tripInviteHint: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  tripInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
  },
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
  invitedBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinBtnText: { color: Colors.textOnPrimary, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold as any },
  invitedBtnText: { color: Colors.textSecondary },

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

  // Comments
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  noComments: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  commentItem: {
    marginBottom: Spacing.sm,
  },
  commentAuthor: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold as any,
    color: Colors.text,
  },
  commentContent: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  commentTime: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: Fonts.sizes.sm,
  },
  commentSendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  commentSendText: {
    color: Colors.textOnPrimary,
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold as any,
  },
});
