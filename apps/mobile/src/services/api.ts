// ============================================
// API Service — Backend communication
// ============================================

const API_BASE = __DEV__
  ? 'http://localhost:8080/api/v1'
  : 'https://api.huetravel.vn/api/v1';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: object;
  token?: string | null;
};

type APIResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page: number; per_page: number; total: number; total_pages: number };
};

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<APIResponse<T>> {
    const { method = 'GET', body, token } = options;
    const authToken = token || this.token;

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

      const data = await response.json();
      return data as APIResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: { code: 'HT-NET-001', message: 'Không thể kết nối server' },
      };
    }
  }

  // ---- Auth ----
  async sendOTP(phone: string) {
    return this.request('/auth/otp/send', {
      method: 'POST',
      body: { phone },
    });
  }

  async verifyOTP(phone: string, code: string) {
    return this.request<{
      token: string;
      refresh_token: string;
      expires_in: number;
      user: User;
      is_new_user: boolean;
    }>('/auth/otp/verify', {
      method: 'POST',
      body: { phone, code },
    });
  }

  async googleLogin(idToken: string) {
    return this.request('/auth/google', {
      method: 'POST',
      body: { id_token: idToken },
    });
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

  // ---- Bookings ----
  async createBooking(data: {
    experience_id: string;
    booking_date: string;
    start_time: string;
    guest_count: number;
    special_notes?: string;
  }) {
    return this.request('/bookings', {
      method: 'POST',
      body: data,
    });
  }

  async getBookings(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/bookings${query}`);
  }

  // ---- User ----
  async getMe() {
    return this.request<{ user: User }>('/me');
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
      origin_lat: String(params.originLat),
      origin_lng: String(params.originLng),
      dest_lat: String(params.destLat),
      dest_lng: String(params.destLng),
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
    }>('/payment/create', {
      method: 'POST',
      body: { booking_id: bookingId, bank_code: bankCode },
    });
  }

  // ---- Chat ----
  async getChatRooms() {
    return this.request<{ rooms: ChatRoom[] }>('/chat/rooms');
  }

  async getOrCreateRoom(otherUserId: string) {
    return this.request<{ room: ChatRoom }>('/chat/rooms', {
      method: 'POST',
      body: { other_user_id: otherUserId },
    });
  }

  async getChatMessages(roomId: string, page?: number) {
    const query = page ? `?page=${page}` : '';
    return this.request<{ messages: ChatMessage[] }>(
      `/chat/rooms/${roomId}/messages${query}`
    );
  }

  async sendChatMessage(roomId: string, content: string, msgType: string = 'text') {
    return this.request('/chat/rooms/' + roomId + '/messages', {
      method: 'POST',
      body: { content, type: msgType },
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

  // ---- Reviews ----
  async getReviews(experienceId: string) {
    return this.request(`/experiences/${experienceId}/reviews`);
  }

  async createReview(data: {
    booking_id: string;
    rating: number;
    comment: string;
  }) {
    return this.request('/reviews', {
      method: 'POST',
      body: data,
    });
  }

  // ---- Favorites ----
  async toggleFavorite(experienceId: string) {
    return this.request(`/favorites/toggle/${experienceId}`, { method: 'POST' });
  }

  async getFavorites() {
    return this.request('/favorites');
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
}

// ============================================
// Types
// ============================================
export type User = {
  id: string;
  phone?: string;
  email?: string;
  full_name: string;
  avatar_url?: string;
  role: 'traveler' | 'guide' | 'blogger' | 'merchant' | 'expert' | 'admin';
  bio?: string;
  xp: number;
  level: string;
  is_verified: boolean;
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
  type: string;
  other_user: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  last_message?: string;
  last_message_at: string;
  unread_count: number;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  type: string;
  created_at: string;
  is_read: boolean;
};

export type Guide = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  languages: string[];
  specialties: string[];
  rating: number;
  review_count: number;
  total_tours: number;
  is_verified: boolean;
};

// ============================================
// WebSocket Service
// ============================================
const WS_BASE = __DEV__
  ? 'ws://localhost:8080/ws'
  : 'wss://api.huetravel.vn/ws';

export type WSMessage = {
  type: 'message' | 'typing' | 'read' | 'status' | 'join' | 'leave';
  room_id?: string;
  sender_id?: string;
  content?: string;
  data?: any;
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<(msg: WSMessage) => void>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private userId: string | null = null;

  connect(userId: string) {
    this.userId = userId;
    this.ws = new WebSocket(`${WS_BASE}?user_id=${userId}`);

    this.ws.onopen = () => {
      console.log('🟢 WebSocket connected');
      this.emit('status', { type: 'status', content: 'connected' });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this.emit(msg.type, msg);
        this.emit('*', msg); // wildcard
      } catch {}
    };

    this.ws.onclose = () => {
      console.log('🔴 WebSocket disconnected');
      this.emit('status', { type: 'status', content: 'disconnected' });
      // Auto reconnect after 3s
      this.reconnectTimer = setTimeout(() => {
        if (this.userId) this.connect(this.userId);
      }, 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.userId = null;
  }

  send(msg: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  joinRoom(roomId: string) {
    this.send({ type: 'join', room_id: roomId });
  }

  leaveRoom(roomId: string) {
    this.send({ type: 'leave', room_id: roomId });
  }

  sendMessage(roomId: string, content: string) {
    this.send({ type: 'message', room_id: roomId, content });
  }

  sendTyping(roomId: string) {
    this.send({ type: 'typing', room_id: roomId });
  }

  on(type: string, handler: (msg: WSMessage) => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, msg: WSMessage) {
    this.handlers.get(type)?.forEach((h) => h(msg));
  }
}

export const api = new ApiService();
export const wsService = new WebSocketService();
export default api;
