// ============================================
// API Service — Backend communication
// ============================================

import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const LOCAL_API_BASE = 'http://localhost:8080/api/v1';
const DEV_API_PORT = '8080';

function resolveExpoDevAPIBase() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.linkingUri ||
    '';

  const normalizedHost = hostUri
    .replace(/^[a-zA-Z0-9+.-]+:\/\//, '')
    .replace(/\/--($|\/.*$)/, '')
    .replace(/\/.*$/, '')
    .trim();

  if (!normalizedHost) {
    return null;
  }

  const hostname = normalizedHost.split(':')[0];
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  return `http://${hostname}:${DEV_API_PORT}/api/v1`;
}

function resolveAPIBase() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (__DEV__) {
    return resolveExpoDevAPIBase() || LOCAL_API_BASE;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return LOCAL_API_BASE;
    }
  }

  return 'https://api.huetravel.vn/api/v1';
}

const API_BASE = resolveAPIBase();

export function getWSBase(): string {
  if (API_BASE.startsWith('https://')) {
    return API_BASE.replace('https://', 'wss://').replace('/api/v1', '/ws');
  }
  return API_BASE.replace('http://', 'ws://').replace('/api/v1', '/ws');
}


type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: object;
  token?: string | null;
  retryOnAuthFailure?: boolean;
};

type APIResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page: number; per_page: number; total: number; total_pages: number };
};

class ApiService {
  private token: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private authFailureListeners = new Set<() => void>();
  private readonly accessTokenKey = 'ht_access_token';
  private readonly refreshTokenKey = 'ht_refresh_token';

  private useWebStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private async setStoredItem(key: string, value: string) {
    if (this.useWebStorage()) {
      window.localStorage.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  }

  private async getStoredItem(key: string) {
    if (this.useWebStorage()) {
      return window.localStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key);
  }

  private async deleteStoredItem(key: string) {
    if (this.useWebStorage()) {
      window.localStorage.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  }

  setToken(token: string | null) {
    this.token = token;
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  async setSession(token: string, refreshToken: string) {
    this.token = token;
    this.refreshTokenValue = refreshToken;
    await Promise.all([
      this.setStoredItem(this.accessTokenKey, token),
      this.setStoredItem(this.refreshTokenKey, refreshToken),
    ]);
  }

  async restoreSession(): Promise<{ token: string; refreshToken: string } | null> {
    try {
      const [token, refreshToken] = await Promise.all([
        this.getStoredItem(this.accessTokenKey),
        this.getStoredItem(this.refreshTokenKey),
      ]);

      if (!token || !refreshToken) {
        this.token = null;
        this.refreshTokenValue = null;
        if (token || refreshToken) {
          await this.clearSession();
        }
        return null;
      }

      this.token = token;
      this.refreshTokenValue = refreshToken;
      return { token, refreshToken };
    } catch {
      return null;
    }
  }

  async clearSession() {
    this.token = null;
    this.refreshTokenValue = null;

    try {
      await this.deleteStoredItem(this.accessTokenKey);
      await this.deleteStoredItem(this.refreshTokenKey);
    } catch {
      // Ignore storage cleanup failures and continue with in-memory logout.
    }
  }

  onAuthFailure(listener: () => void) {
    this.authFailureListeners.add(listener);
    return () => {
      this.authFailureListeners.delete(listener);
    };
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<APIResponse<T>> {
    const { method = 'GET', body, token, retryOnAuthFailure = true } = options;
    const authToken = token === undefined ? this.token : token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401 && retryOnAuthFailure && authToken && await this.refreshSession()) {
        return this.request<T>(endpoint, { method, body, retryOnAuthFailure: false });
      }

      if (response.status === 401 && authToken) {
        await this.clearSession();
        this.notifyAuthFailure();
      }

      return await this.parseResponse<T>(response);
    } catch {
      return {
        success: false,
        error: { code: 'HT-NET-001', message: 'Không thể kết nối server' },
      };
    }
  }

  async uploadFile(file: { uri: string; name: string; type: string }, folder: string = 'uploads'): Promise<APIResponse<any>> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('folder', folder);

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: formData,
      });

      if (response.status === 401 && await this.refreshSession()) {
        return this.uploadFile(file, folder);
      }

      if (response.status === 401 && this.token) {
        await this.clearSession();
        this.notifyAuthFailure();
      }

      return await this.parseResponse(response);
    } catch {
      return { success: false, error: { code: 'HT-NET-001', message: 'Upload thất bại' } };
    }
  }

  // ---- Auth ----
  async register(data: {
    full_name: string;
    email: string;
    password: string;
  }) {
    return this.request<{
      token: string;
      refresh_token: string;
      expires_in: number;
      user: User;
      is_new_user: boolean;
    }>('/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  async loginWithPassword(email: string, password: string) {
    return this.request<{
      token: string;
      refresh_token: string;
      expires_in: number;
      user: User;
      is_new_user: boolean;
    }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async updatePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/password', {
      method: 'POST',
      body: {
        current_password: currentPassword,
        new_password: newPassword,
      },
    });
  }

  async refreshToken() {
    return this.request<{
      token: string;
      refresh_token: string;
      expires_in: number;
      user: User;
    }>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: await this.getRefreshToken() },
      retryOnAuthFailure: false,
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST', retryOnAuthFailure: false });
  }

  private async getRefreshToken() {
    if (this.refreshTokenValue) {
      return this.refreshTokenValue;
    }

    try {
      this.refreshTokenValue = await this.getStoredItem(this.refreshTokenKey);
      return this.refreshTokenValue;
    } catch {
      return null;
    }
  }

  private async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    const response = await this.request<{
      token: string;
      refresh_token: string;
      expires_in: number;
      user: User;
    }>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      token: null,
      retryOnAuthFailure: false,
    });

    if (!response.success || !response.data?.token || !response.data?.refresh_token) {
      return false;
    }

    await this.setSession(response.data.token, response.data.refresh_token);
    return true;
  }

  private async parseResponse<T>(response: Response): Promise<APIResponse<T>> {
    try {
      return await response.json() as APIResponse<T>;
    } catch {
      return {
        success: false,
        error: { code: 'HT-NET-002', message: 'Phản hồi từ server không hợp lệ' },
      };
    }
  }

  private notifyAuthFailure() {
    for (const listener of this.authFailureListeners) {
      listener();
    }
  }

  // ---- Experiences ----
  async getExperiences(params?: {
    category?: string;
    q?: string;
    page?: number;
    sort?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.sort) searchParams.set('sort', params.sort);

    const query = searchParams.toString();
    return this.request<Experience[]>(
      `/experiences${query ? '?' + query : ''}`
    );
  }

  async getExperience(id: string) {
    return this.request<Experience>(`/experiences/${id}`);
  }

  async deleteExperience(id: string) {
    return this.request(`/experiences/${id}`, { method: 'DELETE' });
  }

  // ---- Bookings ----
  async createBooking(data: {
    experience_id: string;
    booking_date: string;
    start_time: string;
    guest_count: number;
    special_notes?: string;
  }) {
    return this.request<{ booking: Booking; payment_url?: string }>('/bookings', {
      method: 'POST',
      body: data,
    });
  }

  async getBookings(status?: string, page?: number, perPage?: number) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (page) params.set('page', String(page));
    if (perPage) params.set('per_page', String(perPage));

    const query = params.toString();
    const res = await this.request<Booking[] | null>(`/bookings${query ? `?${query}` : ''}`);
    if (res.success && !Array.isArray(res.data)) {
      return { ...res, data: [] as Booking[] };
    }
    return res as APIResponse<Booking[]>;
  }

  async getBooking(id: string) {
    return this.request<Booking>(`/bookings/${id}`);
  }

  async cancelBooking(id: string, reason?: string) {
    return this.request(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    });
  }

  async confirmBooking(id: string) {
    return this.request(`/bookings/${id}/confirm`, { method: 'POST' });
  }

  async completeBooking(id: string) {
    return this.request(`/bookings/${id}/complete`, { method: 'POST' });
  }

  async getGuideBookings(status?: string, page?: number) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (page) params.set('page', String(page));
    const query = params.toString();
    return this.request(`/bookings/guide/me${query ? '?' + query : ''}`);
  }

  // ---- User ----
  async getMe() {
    return this.request<{ user: User }>('/me');
  }

  async updateProfile(data: {
    full_name: string;
    email?: string;
    bio?: string;
    avatar_url?: string;
    languages?: string[];
  }) {
    return this.request<{ user: User; message: string }>('/me', {
      method: 'PUT',
      body: data,
    });
  }

  // ---- Places ----
  async searchPlaces(q: string, category?: string) {
    const params = new URLSearchParams({ q });
    if (category) params.set('category', category);
    return this.request<{
      query: string;
      places: PlaceResult[];
      total: number;
    }>(`/places/search?${params}`);
  }

  async getNearbyRestaurants(params?: {
    lat?: number;
    lng?: number;
    radius?: number;
    type?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.lat !== undefined) searchParams.set('lat', String(params.lat));
    if (params?.lng !== undefined) searchParams.set('lng', String(params.lng));
    if (params?.radius !== undefined) searchParams.set('radius', String(params.radius));
    if (params?.type) searchParams.set('type', params.type);

    const query = searchParams.toString();
    return this.request<{
      restaurants: PlaceResult[];
      total: number;
      center: { lat: number; lng: number };
      radius: number;
    }>(`/places/nearby${query ? '?' + query : ''}`);
  }

  async getDirections(params: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    mode?: string;
  }) {
    const searchParams = new URLSearchParams({
      origin: `${params.originLat},${params.originLng}`,
      destination: `${params.destLat},${params.destLng}`,
    });
    if (params.mode) searchParams.set('mode', params.mode);

    return this.request<{ directions: DirectionResult }>(`/places/directions?${searchParams}`);
  }

  // ---- AI Trip Planner ----
  async generateTripPlan(data: {
    duration: number;
    budget?: string;
    interests?: string[];
    travel_style?: string;
  }) {
    return this.request<{ plan: TripPlan }>('/ai/trip-plan', {
      method: 'POST',
      body: data,
    });
  }

  async aiChat(messages: Array<{ role: string; content: string }>) {
    return this.request<{ reply: string; role: string }>('/ai/chat', {
      method: 'POST',
      body: { messages },
    });
  }

  async aiSuggest(type?: string) {
    const query = type ? `?type=${type}` : '';
    return this.request<{ suggestions: AISuggestion[] }>(`/ai/suggest${query}`);
  }

  // ---- Payment ----
  async getPaymentMethods() {
    return this.request<{ methods: PaymentMethod[] }>('/payment/methods');
  }

  async createPayment(bookingId: string, bankCode?: string) {
    return this.request<{
      payment_url: string;
      txn_ref: string;
      amount: number;
      expires_in: number;
      status?: string;
      message?: string;
    }>('/payment/create', {
      method: 'POST',
      body: { booking_id: bookingId, bank_code: bankCode },
    });
  }

  // ---- Chat ----
  async getChatRooms() {
    const res = await this.request<{ rooms: ChatRoom[] | null }>('/chat/rooms');
    if (res.success) {
      const rooms = Array.isArray(res.data?.rooms) ? res.data.rooms : [];
      return { ...res, data: { rooms } } as APIResponse<{ rooms: ChatRoom[] }>;
    }
    return res as APIResponse<{ rooms: ChatRoom[] }>;
  }

  async getOrCreateRoom(otherUserId: string) {
    return this.request<{ room: ChatRoom }>('/chat/rooms', {
      method: 'POST',
      body: { recipient_id: otherUserId },
    });
  }

  async getChatMessages(roomId: string, page?: number) {
    const query = page ? `?page=${page}` : '';
    const res = await this.request<{ messages: ChatMessage[] | null }>(
      `/chat/rooms/${roomId}/messages${query}`
    );
    if (res.success) {
      const messages = Array.isArray(res.data?.messages) ? res.data.messages : [];
      return { ...res, data: { messages } } as APIResponse<{ messages: ChatMessage[] }>;
    }
    return res as APIResponse<{ messages: ChatMessage[] }>;
  }

  async sendChatMessage(roomId: string, content: string, msgType: string = 'text') {
    return this.request<{ message: ChatMessage }>('/chat/rooms/' + roomId + '/messages', {
      method: 'POST',
      body: { content, message_type: msgType },
    });
  }

  async markChatRead(roomId: string) {
    return this.request(`/chat/rooms/${roomId}/read`, { method: 'POST' });
  }

  // ---- Guides ----
  async getTopGuides() {
    return this.request<{ guides: Guide[] }>('/guides/top');
  }

  async getGuide(id: string) {
    return this.request<Guide>(`/guides/${id}`);
  }

  async getDirectGuideExperience(guideId: string) {
    const res = await this.request<{ experience: Experience }>(`/guides/${guideId}/direct-booking`);
    if (res.success && res.data?.experience) {
      return { ...res, data: res.data.experience };
    }
    return res as unknown as APIResponse<Experience>;
  }

  // ---- Reviews ----
  async getReviews(experienceId: string, page?: number, perPage?: number) {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (perPage) params.set('per_page', String(perPage));

    const query = params.toString();
    return this.request<{
      reviews: Review[];
      summary: ReviewSummary;
      meta: { page: number; per_page: number; total: number; total_pages: number };
    }>(`/experiences/${experienceId}/reviews${query ? `?${query}` : ''}`);
  }

  async createReview(data: {
    experience_id: string;
    booking_id: string;
    overall_rating: number;
    guide_rating: number;
    value_rating: number;
    comment: string;
    photo_urls?: string[];
  }) {
    return this.request<Review>('/reviews', {
      method: 'POST',
      body: data,
    });
  }

  // ---- Favorites ----
  async toggleFavorite(experienceId: string) {
    return this.request<{ is_favorited: boolean; message: string }>(
      `/favorites/toggle/${experienceId}`,
      { method: 'POST' }
    );
  }

  async getFavorites(page?: number, perPage?: number) {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (perPage) params.set('per_page', String(perPage));

    const query = params.toString();
    return this.request<Experience[]>(`/favorites${query ? `?${query}` : ''}`);
  }

  // ---- Notifications ----
  async getNotifications() {
    return this.request<{
      notifications: NotificationItem[];
      unread_count: number;
      total: number;
    }>('/notifications');
  }

  async getUnreadNotificationCount() {
    return this.request<{ unread_count: number }>('/notifications/unread');
  }

  async markNotificationRead(id: string) {
    return this.request<{ message: string; id?: string; count?: number }>(
      `/notifications/${id}/read`,
      { method: 'POST' }
    );
  }

  async registerDevice(data: { fcm_token: string; platform: string }) {
    return this.request<{ message: string; platform: string }>('/notifications/device', {
      method: 'POST',
      body: data,
    });
  }

  // ---- Search ----
  async search(query: string, filters?: {
    type?: string;
    category?: string;
    min_price?: number;
    max_price?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams({ q: query });
    if (filters?.type) params.set('type', filters.type);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.limit) params.set('limit', String(filters.limit));
    return this.request(`/search?${params}`);
  }

  async searchSuggest(query: string) {
    return this.request<string[]>(`/search/suggest?q=${encodeURIComponent(query)}`);
  }

  async getTrending() {
    return this.request<string[]>('/search/trending');
  }

  // ---- Friends ----
  async sendFriendRequest(userId: string) {
    return this.request<{ friendship: Friendship }>('/friends/request', {
      method: 'POST',
      body: { user_id: userId },
    });
  }

  async acceptFriendRequest(id: string) {
    return this.request<{ message: string }>(`/friends/${id}/accept`, { method: 'POST' });
  }

  async declineFriendRequest(id: string) {
    return this.request<{ message: string }>(`/friends/${id}/decline`, { method: 'POST' });
  }

  async unfriend(id: string) {
    return this.request<{ message: string }>(`/friends/${id}`, { method: 'DELETE' });
  }

  async getFriends() {
    return this.request<{ friends: FriendInfo[]; total: number }>('/friends');
  }

  async getPendingFriendRequests() {
    return this.request<{ requests: FriendInfo[]; total: number }>('/friends/pending');
  }

  async getFriendStatus(userId: string) {
    return this.request<{ status: string; friendship?: Friendship }>(`/friends/status/${userId}`);
  }

  // ---- Trips (Group Travel) ----
  async createTrip(data: { title: string; description?: string; start_date: string; end_date: string; is_public?: boolean }) {
    return this.request<{ trip: Trip }>('/trips', { method: 'POST', body: data });
  }

  async getMyTrips() {
    return this.request<{ trips: Trip[] }>('/trips');
  }

  async getTrip(id: string) {
    return this.request<{ trip: Trip }>(`/trips/${id}`);
  }

  async discoverTrips() {
    return this.request<{ trips: Trip[] }>('/trips/discover');
  }

  async inviteTripMember(tripId: string, userId: string) {
    return this.request(`/trips/${tripId}/invite`, { method: 'POST', body: { user_id: userId } });
  }

  async inviteTripGuide(tripId: string, guideId: string) {
    return this.request(`/trips/${tripId}/invite-guide`, { method: 'POST', body: { guide_id: guideId } });
  }

  async acceptTripInvite(tripId: string) {
    return this.request(`/trips/${tripId}/accept`, { method: 'POST' });
  }

  async declineTripInvite(tripId: string) {
    return this.request(`/trips/${tripId}/decline`, { method: 'POST' });
  }

  async joinPublicTrip(tripId: string) {
    return this.request(`/trips/${tripId}/join`, { method: 'POST' });
  }

  async leaveTrip(tripId: string) {
    return this.request(`/trips/${tripId}/leave`, { method: 'POST' });
  }

  async getTripInvitations() {
    return this.request<{ invitations: TripInvitation[] }>('/trips/invitations');
  }

  async searchGuidesForTrip(tripId: string) {
    return this.request(`/trips/${tripId}/guides`);
  }

  // ---- Stories / Feed ----
  async createStory(data: { content: string; image_urls?: string[]; location?: string }) {
    return this.request<{ story: Story }>('/feed', { method: 'POST', body: data });
  }

  async getFeed(page?: number) {
    const query = page ? `?page=${page}` : '';
    return this.request<{ stories: Story[] }>(`/feed${query}`);
  }

  async likeStory(id: string) {
    return this.request<{ is_liked: boolean }>(`/feed/${id}/like`, { method: 'POST' });
  }

  async commentStory(id: string, content: string) {
    return this.request<{ comment: StoryComment }>(`/feed/${id}/comment`, {
      method: 'POST',
      body: { content },
    });
  }

  async getStoryComments(id: string) {
    return this.request<{ comments: StoryComment[] }>(`/feed/${id}/comments`);
  }

  async deleteStory(id: string) {
    return this.request(`/feed/${id}`, { method: 'DELETE' });
  }

  // ---- Blog ----
  async getBlogPosts(page?: number, category?: string) {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (category) params.set('category', category);
    const query = params.toString();
    return this.request<{ posts: BlogPost[] }>(`/blog/posts${query ? `?${query}` : ''}`);
  }

  async getBlogPost(slug: string) {
    return this.request<{ post: BlogPost }>(`/blog/posts/${slug}`);
  }

  async getBlogTrending() {
    return this.request<{ posts: BlogPost[] }>('/blog/trending');
  }

  async createBlogPost(data: { title: string; content: string; category?: string; cover_url?: string; tags?: string[] }) {
    return this.request<{ post: BlogPost }>('/blog/posts', { method: 'POST', body: data });
  }

  async toggleBlogLike(postId: string) {
    return this.request<{ is_liked: boolean }>(`/blog-posts/${postId}/like`, { method: 'POST' });
  }

  async addBlogComment(postId: string, content: string) {
    return this.request(`/blog-posts/${postId}/comments`, { method: 'POST', body: { content } });
  }

  async getBlogComments(postId: string) {
    return this.request<{ comments: BlogComment[] }>(`/blog-posts/${postId}/comments`);
  }

  // ---- Diary ----
  async createDiaryEntry(data: { title: string; content: string; mood?: string; is_public?: boolean; photo_urls?: string[]; location?: string }) {
    return this.request<{ entry: DiaryEntry }>('/diary/entries', { method: 'POST', body: data });
  }

  async getMyDiary() {
    return this.request<{ entries: DiaryEntry[] }>('/diary/entries');
  }

  async getPublicDiary() {
    return this.request<{ entries: DiaryEntry[] }>('/diary/public');
  }

  // ---- Events ----
  async getEvents() {
    return this.request<{ events: HueEvent[] }>('/events');
  }

  async getEvent(id: string) {
    return this.request<{ event: HueEvent }>(`/events/${id}`);
  }

  async rsvpEvent(id: string, status: 'going' | 'interested' | 'not_going') {
    return this.request(`/events/${id}/rsvp`, { method: 'POST', body: { status } });
  }

  // ---- SOS / Emergency ----
  async sendSOS(data: { lat: number; lng: number; message?: string }) {
    return this.request<{ alert: SOSAlert }>('/emergency/sos', { method: 'POST', body: data });
  }

  async cancelSOS(id: string) {
    return this.request(`/emergency/sos/${id}/cancel`, { method: 'POST' });
  }

  async getEmergencyContacts() {
    return this.request<{ contacts: EmergencyContact[] }>('/emergency/contacts');
  }

  async getNearbyHospitals() {
    return this.request<{ hospitals: NearbyHospital[] }>('/emergency/hospitals');
  }

  // ---- Calls ----
  async initiateCall(roomId: string, callType: 'audio' | 'video') {
    return this.request(`/calls/rooms/${roomId}/call`, { method: 'POST', body: { call_type: callType } });
  }

  async getActiveCall(roomId: string) {
    return this.request(`/calls/rooms/${roomId}/active`);
  }

  async answerCall(callId: string) {
    return this.request(`/calls/${callId}/answer`, { method: 'POST' });
  }

  async declineCall(callId: string) {
    return this.request(`/calls/${callId}/decline`, { method: 'POST' });
  }

  async endCall(callId: string) {
    return this.request(`/calls/${callId}/end`, { method: 'POST' });
  }

  async getCallHistory() {
    return this.request('/calls/history');
  }

  // ---- Reactions ----
  async toggleReaction(messageId: string, emoji: string) {
    return this.request(`/messages/${messageId}/reactions`, { method: 'POST', body: { emoji } });
  }

  async getReactions(messageId: string) {
    return this.request(`/messages/${messageId}/reactions`);
  }

  // ---- Gamification ----
  async getAchievements() {
    return this.request<{ achievements: Achievement[] }>('/achievements');
  }

  async getMyAchievements() {
    return this.request<{ achievements: Achievement[] }>('/achievements/my');
  }

  async getLeaderboard() {
    return this.request<{ users: LeaderboardEntry[] }>('/leaderboard');
  }

  async dailyCheckIn() {
    return this.request<{ message: string; xp_earned: number; streak: number }>('/checkin', { method: 'POST' });
  }

  async getCheckIns() {
    return this.request<{ checkins: CheckIn[] }>('/checkins');
  }

  async getGamificationStats() {
    return this.request<GamificationStats>('/gamification/stats');
  }

  // ---- Promotions ----
  async getActivePromotions() {
    return this.request<{ promotions: Promotion[] }>('/promotions/active');
  }

  async applyPromoCode(code: string, bookingId?: string) {
    return this.request<{ discount: number; message: string }>('/promotions/apply', {
      method: 'POST',
      body: { code, booking_id: bookingId },
    });
  }

  async getMyCoupons() {
    return this.request<{ coupons: Coupon[] }>('/promotions/my-coupons');
  }

  // ---- Weather ----
  async getCurrentWeather() {
    return this.request<WeatherCurrent>('/weather/current');
  }

  async getWeatherForecast() {
    return this.request<{ forecast: WeatherDay[] }>('/weather/forecast');
  }

  async getBestTimeToVisit() {
    return this.request<{ best_months: BestMonth[]; current_recommendation: string }>('/weather/best-time');
  }

  // ---- Translate ----
  async translateText(text: string, targetLang: string, sourceLang?: string) {
    return this.request<{ translated: string; source_lang: string; target_lang: string }>('/translate', {
      method: 'POST',
      body: { text, target_lang: targetLang, source_lang: sourceLang },
    });
  }

  async detectLanguage(text: string) {
    return this.request<{ language: string; confidence: number }>('/translate/detect', {
      method: 'POST',
      body: { text },
    });
  }

  async getPhrasebook() {
    return this.request<{ categories: PhrasebookCategory[] }>('/phrasebook');
  }

  // ---- Collections / Bookmarks ----
  async createCollection(name: string, description?: string) {
    return this.request<{ collection: Collection }>('/collections', {
      method: 'POST',
      body: { name, description },
    });
  }

  async getCollections() {
    return this.request<{ collections: Collection[] }>('/collections');
  }

  async addToCollection(collectionId: string, itemId: string, itemType: string) {
    return this.request(`/collections/${collectionId}/items`, {
      method: 'POST',
      body: { item_id: itemId, item_type: itemType },
    });
  }

  async getCollectionItems(collectionId: string) {
    return this.request(`/collections/${collectionId}/items`);
  }

  async removeFromCollection(collectionId: string, itemId: string) {
    return this.request(`/collections/${collectionId}/items/${itemId}`, { method: 'DELETE' });
  }

  async deleteCollection(collectionId: string) {
    return this.request(`/collections/${collectionId}`, { method: 'DELETE' });
  }

  // ---- Report & Block ----
  async reportContent(data: { target_type: string; target_id: string; reason: string; details?: string }) {
    return this.request('/reports', { method: 'POST', body: data });
  }

  async blockUser(targetId: string) {
    return this.request('/block', { method: 'POST', body: { target_id: targetId } });
  }

  async unblockUser(id: string) {
    return this.request(`/block/${id}`, { method: 'DELETE' });
  }

  async getBlockedUsers() {
    return this.request<{ blocked: BlockedUser[] }>('/block');
  }

  // ---- Guide Application ----
  async applyAsGuide(data: { specialties: string[]; experience_years: number; languages: string[]; motivation: string }) {
    return this.request('/guide-apply', { method: 'POST', body: data });
  }

  async getMyGuideApplication() {
    return this.request<{ application: GuideApplication }>('/guide-apply/my');
  }
}

// ============================================
// Types
// ============================================
export type User = {
  id: string;
  phone?: string;
  email?: string;
  has_password?: boolean;
  full_name: string;
  avatar_url?: string;
  role: 'traveler' | 'guide' | 'blogger' | 'merchant' | 'expert' | 'admin';
  bio?: string;
  xp: number;
  level: string;
  is_verified: boolean;
};

export type Booking = {
  id: string;
  traveler_id: string;
  experience_id: string;
  guide_id: string;
  booking_date: string;
  start_time: string;
  guest_count: number;
  total_price: number;
  service_fee: number;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'refunded';
  special_notes?: string;
  cancel_reason?: string;
  payment_method?: string;
  payment_ref?: string;
  paid_at?: string;
  confirmed_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  experience?: Experience;
  traveler?: User;
  guide?: User;
};

export type ReviewTraveler = {
  full_name: string;
  avatar_url?: string;
  level?: string;
};

export type Review = {
  id: string;
  booking_id: string;
  traveler_id: string;
  experience_id: string;
  overall_rating: number;
  guide_rating: number;
  value_rating: number;
  comment?: string | null;
  photo_urls?: string[];
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  traveler?: ReviewTraveler;
};

export type ReviewSummary = {
  total_reviews: number;
  average_overall: number;
  average_guide: number;
  average_value: number;
  star_5: number;
  star_4: number;
  star_3: number;
  star_2: number;
  star_1: number;
};

export type Experience = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  max_guests: number;
  duration_mins: number;
  meeting_point: string;
  meeting_lat: number;
  meeting_lng: number;
  rating: number;
  rating_count: number;
  image_urls: string[];
  includes?: string[];
  highlights?: string[];
  is_instant: boolean;
  guide?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
};

export type TripPlan = {
  title: string;
  summary: string;
  duration: number;
  total_budget: string;
  days: Array<{
    day: number;
    theme: string;
    activities: Array<{
      time: string;
      name: string;
      description: string;
      duration: string;
      location: string;
      cost: string;
      tips?: string;
    }>;
    meals: Array<{
      type: string;
      name: string;
      location: string;
      must_try: string;
      price_range: string;
    }>;
  }>;
  tips: string[];
};

export type AISuggestion = {
  title: string;
  subtitle: string;
  action: string;
};

export type PlaceResult = {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  rating_count: number;
  price_level?: number;
  types: string[];
  open_now?: boolean;
  photo_reference?: string;
  photo_url?: string;
};

export type DirectionStep = {
  instruction: string;
  distance: string;
  duration: string;
  start_lat?: number;
  start_lng?: number;
  end_lat?: number;
  end_lng?: number;
};

export type DirectionResult = {
  distance: string;
  duration: string;
  duration_secs: number;
  start_address: string;
  end_address: string;
  steps: DirectionStep[];
  polyline?: string;
};

export type NotificationItem = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  is_read: boolean;
  created_at: string;
};

export type PaymentMethod = {
  code: string;
  name: string;
  description: string;
  icon: string;
  recommended: boolean;
};

export type ChatRoom = {
  id: string;
  booking_id?: string;
  participants: string[];
  room_type: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  other_participant?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
};

export type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  message_type: string;
  created_at: string;
  is_read: boolean;
};

export type Guide = {
  id: string;
  user_id: string;
  badge_level: string;
  specialties: string[];
  total_tours: number;
  total_reviews: number;
  avg_rating: number;
  response_time_mins: number;
  user?: {
    full_name: string;
    avatar_url?: string;
    bio?: string;
    languages?: string[];
  };
};

// ---- New Feature Types ----

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

export type FriendInfo = {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  level?: string;
  friendship_id: string;
  since?: string;
};

export type Trip = {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_public: boolean;
  owner_id: string;
  member_count: number;
  status: string;
  created_at: string;
  owner?: { full_name: string; avatar_url?: string };
  members?: TripMember[];
};

export type TripMember = {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  status: string;
};

export type TripInvitation = {
  trip_id: string;
  trip_title: string;
  inviter_name: string;
  created_at: string;
};

export type Story = {
  id: string;
  user_id: string;
  content: string;
  image_urls?: string[];
  location?: string;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  created_at: string;
  user?: { full_name: string; avatar_url?: string };
};

export type StoryComment = {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { full_name: string; avatar_url?: string };
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  cover_url?: string;
  category?: string;
  tags?: string[];
  author_id: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  is_liked?: boolean;
  created_at: string;
  author?: { full_name: string; avatar_url?: string };
};

export type BlogComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { full_name: string; avatar_url?: string };
};

export type DiaryEntry = {
  id: string;
  title: string;
  content: string;
  mood?: string;
  is_public: boolean;
  photo_urls?: string[];
  location?: string;
  created_at: string;
};

export type HueEvent = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date?: string;
  location: string;
  category: string;
  image_url?: string;
  organizer?: string;
  attendee_count: number;
  my_rsvp?: string;
};

export type SOSAlert = {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  message?: string;
  status: 'active' | 'cancelled' | 'resolved';
  created_at: string;
};

export type EmergencyContact = {
  name: string;
  phone: string;
  type: string;
  description?: string;
};

export type NearbyHospital = {
  name: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  distance_km?: number;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  is_unlocked?: boolean;
  unlocked_at?: string;
  progress?: number;
  target?: number;
};

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  xp: number;
  level: string;
};

export type CheckIn = {
  id: string;
  date: string;
  xp_earned: number;
};

export type GamificationStats = {
  xp: number;
  level: string;
  next_level_xp: number;
  streak: number;
  total_checkins: number;
  achievements_unlocked: number;
  rank?: number;
};

export type Promotion = {
  id: string;
  code: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order?: number;
  expires_at: string;
  is_active: boolean;
};

export type Coupon = {
  id: string;
  code: string;
  title: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  is_used: boolean;
  expires_at: string;
};

export type WeatherCurrent = {
  temperature: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  description: string;
  icon: string;
  uv_index?: number;
};

export type WeatherDay = {
  date: string;
  temp_high: number;
  temp_low: number;
  description: string;
  icon: string;
  rain_chance: number;
};

export type BestMonth = {
  month: number;
  month_name: string;
  rating: number;
  description: string;
};

export type PhrasebookCategory = {
  category: string;
  phrases: Array<{ vi: string; en: string; ko?: string; ja?: string; zh?: string; phonetic?: string }>;
};

export type Collection = {
  id: string;
  name: string;
  description?: string;
  item_count: number;
  created_at: string;
};

export type BlockedUser = {
  id: string;
  target_id: string;
  target_name: string;
  target_avatar?: string;
  created_at: string;
};

export type GuideApplication = {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  specialties: string[];
  experience_years: number;
  languages: string[];
  motivation: string;
  created_at: string;
  reviewed_at?: string;
};

export const api = new ApiService();
export default api;
