// ============================================
// Provider API Client — Guide endpoints
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

type ProviderResponse<T> = { success: boolean; data?: T; error?: any; meta?: any };

type ProviderBooking = {
  id: string;
  booking_code: string;
  user_name: string;
  experience_title: string;
  booking_date: string;
  start_time: string;
  guest_count: number;
  total_price: number;
  service_fee: number;
  status: string;
  special_notes?: string;
  traveler?: { full_name?: string | null } | null;
  experience?: { title?: string | null } | null;
  [key: string]: unknown;
};

function normalizeBooking(booking: ProviderBooking): ProviderBooking {
  return {
    ...booking,
    booking_code: typeof booking.booking_code === 'string' ? booking.booking_code : '',
    user_name: typeof booking.user_name === 'string' && booking.user_name
      ? booking.user_name
      : booking.traveler?.full_name || '',
    experience_title: typeof booking.experience_title === 'string' && booking.experience_title
      ? booking.experience_title
      : booking.experience?.title || '',
    booking_date: typeof booking.booking_date === 'string' ? booking.booking_date : '',
    start_time: typeof booking.start_time === 'string' ? booking.start_time : '',
    guest_count: typeof booking.guest_count === 'number' ? booking.guest_count : 0,
    total_price: typeof booking.total_price === 'number' ? booking.total_price : 0,
    service_fee: typeof booking.service_fee === 'number' ? booking.service_fee : 0,
    status: typeof booking.status === 'string' ? booking.status : '',
  };
}

class ProviderApi {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private readonly tokenKey = 'guide_token';
  private readonly refreshTokenKey = 'guide_refresh_token';

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
    body?: object;
    retryOnAuthFailure?: boolean;
  } = {}): Promise<ProviderResponse<T>> {
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
      const payload = await res.json() as ProviderResponse<{ token: string; refresh_token: string }>;
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

  async updatePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/password', {
      method: 'POST',
      body: {
        current_password: currentPassword,
        new_password: newPassword,
      },
    });
  }

  async getMe() {
    const res = await this.request<{ user: any }>('/me');
    if (res.success && res.data?.user) {
      return { ...res, data: res.data.user };
    }
    return res;
  }

  async logout() {
    const res = await this.request('/auth/logout', { method: 'POST', retryOnAuthFailure: false });
    this.clearToken();
    return res;
  }

  async updateProfile(data: { full_name: string; email?: string; bio?: string; avatar_url?: string; languages?: string[] }) {
    return this.request('/me', { method: 'PUT', body: data });
  }

  async getGuideProfile(id: string) {
    return this.request<{ guide: any; experiences: any[] }>(`/guides/${id}`);
  }

  async updateGuideProfile(data: {
    specialties: string[];
    experience_years: number;
    response_time_mins: number;
  }) {
    return this.request('/guides/me/profile', { method: 'PUT', body: data });
  }

  // ---- Guide Bookings ----
  async getMyBookings(status?: string, page?: number) {
    const sp = new URLSearchParams();
    if (status) sp.set('status', status);
    if (page) sp.set('page', String(page));
    const res = await this.request<ProviderBooking[]>(`/bookings/guide/me?${sp}`);
    if (res.success && Array.isArray(res.data)) {
      return { ...res, data: res.data.map(normalizeBooking) };
    }
    return res;
  }

  async confirmBooking(id: string) {
    return this.request(`/bookings/${id}/confirm`, { method: 'POST' });
  }

  async completeBooking(id: string) {
    return this.request(`/bookings/${id}/complete`, { method: 'POST' });
  }

  // ---- Experiences ----
  async getMyExperiences(guideId: string, page?: number) {
    const sp = new URLSearchParams();
    sp.set('guide_id', guideId);
    if (page) sp.set('page', String(page));
    return this.request<any[]>(`/experiences?${sp}`);
  }

  async createExperience(data: any) {
    return this.request('/experiences', { method: 'POST', body: data });
  }

  async updateExperience(id: string, data: any) {
    return this.request(`/experiences/${id}`, { method: 'PUT', body: data });
  }

  async deleteExperience(id: string) {
    return this.request(`/experiences/${id}`, { method: 'DELETE' });
  }

  // ---- Notifications ----
  async getNotifications() { return this.request<any[]>('/notifications'); }

  // ---- Chat ----
  async getChatRooms() { return this.request<any[]>('/chat/rooms'); }
}

export const providerApi = new ProviderApi();
export default providerApi;
