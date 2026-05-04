// ============================================
// Admin API Client — communicates with backend
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
const API_ROOT = API_BASE.replace(/\/api\/v1\/?$/, '');

const toWebSocketBaseURL = (httpBase: string) =>
  httpBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');

export type DashboardStats = {
  total_users: number;
  total_bookings: number;
  total_revenue: number;
  avg_rating: number;
  new_users_this_month: number;
  bookings_this_month: number;
  revenue_this_month: number;
  pending_bookings: number;
};

export interface RevenueChartData {
  date: string;
  revenue: number;
}

export interface TopExperience {
  id: string;
  title: string;
  total_bookings: number;
  revenue: number;
}

export interface DashboardBooking {
  id: string;
  experience_title: string;
  booking_date: string;
  total_price: number;
  status: string;
  user_name?: string;
}

export type DashboardOverview = {
  stats: DashboardStats;
  revenue_chart: RevenueChartData[];
  top_experiences: TopExperience[];
  recent_bookings: DashboardBooking[];
  generated_at?: string;
};

type DashboardQuery = {
  days?: number;
};

export type QuickStats = {
  users_change_pct: number;
  bookings_change_pct: number;
  revenue_change_pct: number;
  rating_change: number;
};

export type SystemHealth = {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  dependencies: Array<{
    name: string;
    status: string;
    latency_ms: number;
  }>;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { total?: number; page?: number; per_page?: number };
};

export type AdminNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type AdminSettingsPayload = {
  settings: Record<string, string>;
  updated_at?: string | null;
  count?: number;
};

type DashboardResponse = {
  stats?: Partial<DashboardStats> & {
    new_users_today?: number;
    bookings_today?: number;
    revenue_month?: number;
  };
  revenue_chart?: any[];
  top_experiences?: any[];
  recent_bookings?: any[];
  generated_at?: string;
};

const normalizeDashboardStats = (payload?: DashboardResponse | DashboardStats): DashboardStats => {
  const rawStats: Partial<DashboardStats> & {
    new_users_today?: number;
    bookings_today?: number;
    revenue_month?: number;
  } = payload && 'stats' in payload
    ? (payload.stats || {})
    : ((payload || {}) as DashboardStats);

  return {
    total_users: Number(rawStats.total_users || 0),
    total_bookings: Number(rawStats.total_bookings || 0),
    total_revenue: Number(rawStats.total_revenue || rawStats.revenue_this_month || rawStats.revenue_month || 0),
    avg_rating: Number(rawStats.avg_rating || 0),
    new_users_this_month: Number(rawStats.new_users_this_month || rawStats.new_users_today || 0),
    bookings_this_month: Number(rawStats.bookings_this_month || rawStats.bookings_today || 0),
    revenue_this_month: Number(rawStats.revenue_this_month || rawStats.revenue_month || rawStats.total_revenue || 0),
    pending_bookings: Number(rawStats.pending_bookings || 0),
  };
};

const normalizeRecentBookings = (items?: any[]) =>
  (items || []).map((booking) => ({
    ...booking,
    experience_title: booking.experience_title || booking.experience || '—',
    booking_date: booking.booking_date || booking.date || null,
    total_price: booking.total_price || booking.amount || 0,
  }));

class AdminApi {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private readonly tokenKey = 'admin_token';
  private readonly refreshTokenKey = 'admin_refresh_token';

  private withQuery(endpoint: string, params?: Record<string, string | number | undefined>) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    });

    const query = search.toString();
    return query ? `${endpoint}?${query}` : endpoint;
  }

  setToken(token: string) {
    this.setSession(token);
  }

  setSession(token: string, refreshToken?: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.tokenKey, token);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        localStorage.setItem(this.refreshTokenKey, refreshToken);
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(this.tokenKey);
      return this.token;
    }
    return null;
  }

  getWebSocketUrl(): string | null {
    const token = this.getToken();
    if (!token) return null;

    const url = new URL(`${toWebSocketBaseURL(API_ROOT)}/ws`);
    url.searchParams.set('token', token);
    return url.toString();
  }

  getRefreshToken(): string | null {
    if (this.refreshToken) return this.refreshToken;
    if (typeof window !== 'undefined') {
      this.refreshToken = localStorage.getItem(this.refreshTokenKey);
      return this.refreshToken;
    }
    return null;
  }

  clearToken() {
    this.token = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.refreshTokenKey);
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  async request<T>(endpoint: string, options: {
    method?: string;
    body?: object | string;
    retryOnAuthFailure?: boolean;
  } = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, retryOnAuthFailure = true } = options;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        if (retryOnAuthFailure && token && await this.refreshSession()) {
          return this.request<T>(endpoint, { method, body, retryOnAuthFailure: false });
        }
        this.handleUnauthorized();
      }

      return await res.json();
    } catch {
      return { success: false, error: { code: 'NET', message: 'Không thể kết nối server' } };
    }
  }

  private handleUnauthorized() {
    this.clearToken();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:logout'));
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
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const payload = await res.json() as ApiResponse<{ token: string; refresh_token: string }>;
      if (!res.ok || !payload.success || !payload.data?.token || !payload.data?.refresh_token) {
        return false;
      }

      this.setSession(payload.data.token, payload.data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  // ---- Auth ----
  async loginWithPassword(email: string, password: string) {
    const res = await this.request<{ token: string; refresh_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (res.success && res.data?.token && res.data?.refresh_token) {
      this.setSession(res.data.token, res.data.refresh_token);
    }
    return res;
  }

  async getMe() {
    const res = await this.request<{ user: any }>('/me');
    if (res.success && res.data?.user) {
      return { ...res, data: res.data.user };
    }
    return res as ApiResponse<any>;
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

  async logout() {
    const res = await this.request('/auth/logout', { method: 'POST', retryOnAuthFailure: false });
    this.clearToken();
    return res;
  }

  // ---- Dashboard ----
  async getDashboardOverview(params?: DashboardQuery): Promise<ApiResponse<DashboardOverview>> {
    const res = await this.request<DashboardResponse>(this.withQuery('/admin/dashboard', {
      days: params?.days,
    }));
    if (!res.success || !res.data) {
      return res as ApiResponse<DashboardOverview>;
    }

    return {
      ...res,
      data: {
        stats: normalizeDashboardStats(res.data),
        revenue_chart: res.data.revenue_chart || [],
        top_experiences: res.data.top_experiences || [],
        recent_bookings: normalizeRecentBookings(res.data.recent_bookings),
        generated_at: res.data.generated_at,
      },
    };
  }

  async getDashboardStats(days?: number): Promise<ApiResponse<DashboardStats>> {
    const res = await this.getDashboardOverview({ days });
    if (!res.success || !res.data) {
      return {
        success: res.success,
        error: res.error,
        meta: res.meta,
      };
    }

    return {
      ...res,
      data: res.data.stats,
    };
  }

  async getQuickStats() {
    return this.request<QuickStats>('/admin/quick-stats');
  }

  async getRecentBookings(limit = 5): Promise<ApiResponse<any[]>> {
    const res = await this.getDashboardOverview();
    if (!res.success || !res.data) {
      return {
        success: res.success,
        error: res.error,
        meta: res.meta,
      };
    }

    return {
      ...res,
      data: res.data.recent_bookings.slice(0, limit),
    };
  }

  // ---- Users ----
  async getUsers(params?: { search?: string; role?: string; page?: number }) {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('q', params.search);
    if (params?.role) sp.set('role', params.role);
    if (params?.page) sp.set('page', String(params.page));
    return this.request<any[]>(`/admin/users?${sp}`);
  }

  async getUser(id: string) {
    return this.request<any>(`/admin/users/${id}`);
  }

  async banUser(id: string, active: boolean) {
    return this.request(`/admin/users/${id}/status`, {
      method: 'PUT', body: { active },
    });
  }

  async changeRole(id: string, role: string) {
    return this.request(`/admin/users/${id}/role`, {
      method: 'PUT', body: { role },
    });
  }

  // ---- Experiences ----
  async getExperiences(params?: { page?: number; category?: string }) {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.category) sp.set('category', params.category);
    return this.request<any[]>(`/admin/experiences?${sp}`);
  }

  async deleteExperience(id: string) {
    return this.request(`/admin/experiences/${id}`, { method: 'DELETE' });
  }

  // ---- Bookings ----
  async getBookings(params?: { status?: string; page?: number; perPage?: number; days?: number }) {
    return this.request<any[]>(this.withQuery('/admin/bookings', {
      status: params?.status,
      page: params?.page,
      per_page: params?.perPage,
      days: params?.days,
    }));
  }

  async updateBookingStatus(id: string, status: string) {
    return this.request(`/admin/bookings/${id}/status`, {
      method: 'PUT', body: { status },
    });
  }

  // ---- Health ----
  async getHealth(): Promise<ApiResponse<SystemHealth>> {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_ROOT}/health`, { headers });
      return await res.json();
    } catch {
      return { success: false, error: { code: 'NET', message: 'Không thể kết nối server' } };
    }
  }

  // ---- Search ----
  async getSearchStats() {
    return this.request<any>('/search/stats');
  }

  async getSettings() {
    return this.request<AdminSettingsPayload>('/admin/settings');
  }

  async saveSettings(settings: Record<string, string>) {
    return this.request<AdminSettingsPayload>('/admin/settings', {
      method: 'PUT',
      body: { settings },
    });
  }

  // ---- Notifications ----
  async getNotifications() {
    return this.request<{
      notifications: AdminNotification[];
      unread_count: number;
      total: number;
    }>('/notifications');
  }

  async getUnreadNotificationCount() {
    return this.request<{ unread_count: number }>('/notifications/unread');
  }

  async markNotificationRead(id: string) {
    return this.request<{ message: string; id?: string; count?: number }>(`/notifications/${id}/read`, {
      method: 'POST',
    });
  }

  // ---- Reviews ----
  async getReviews(params?: Record<string, string | number>) {
    return this.request<any[]>(this.withQuery('/admin/reviews', params as any));
  }

  async toggleFeaturedReview(id: string, featured: boolean) {
    return this.request(`/admin/reviews/${id}/featured`, {
      method: 'PUT', body: { is_featured: featured },
    });
  }

  async deleteReview(id: string) {
    return this.request(`/admin/reviews/${id}`, { method: 'DELETE' });
  }

  // ---- Chat Support ----
  async getChatRooms() {
    return this.request<any>('/chat/rooms');
  }

  async getChatMessages(roomId: string, page?: number) {
    const query = page ? `?page=${page}` : '';
    return this.request<any>(`/chat/rooms/${roomId}/messages${query}`);
  }

  async sendChatMessage(roomId: string, content: string, messageType: string = 'text') {
    return this.request<any>(`/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      body: { content, message_type: messageType },
    });
  }

  async markChatRead(roomId: string) {
    return this.request<any>(`/chat/rooms/${roomId}/read`, { method: 'POST' });
  }
}

export const adminApi = new AdminApi();
export default adminApi;
