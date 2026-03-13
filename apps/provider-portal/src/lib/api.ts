// ============================================
// Provider API Client — Guide endpoints
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

type ProviderResponse<T> = { success: boolean; data?: T; error?: any; meta?: any };

class ProviderApi {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('guide_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('guide_token');
    }
    return null;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('guide_token');
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  async request<T>(endpoint: string, options: {
    method?: string;
    body?: object;
  } = {}): Promise<ProviderResponse<T>> {
    const { method = 'GET', body } = options;
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
        this.clearToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:logout'));
        }
      }

      return await res.json();
    } catch {
      return { success: false, error: { code: 'NET', message: 'Không thể kết nối server' } };
    }
  }

  // ---- Auth ----
  async sendOTP(phone: string) {
    return this.request<{ message: string }>('/auth/otp/send', {
      method: 'POST', body: { phone },
    });
  }

  async login(phone: string, code: string) {
    const res = await this.request<{ token: string; refresh_token: string; user: any }>('/auth/otp/verify', {
      method: 'POST', body: { phone, code },
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async getMe() {
    const res = await this.request<{ user: any }>('/me');
    if (res.success && res.data?.user) {
      return { ...res, data: res.data.user };
    }
    return res;
  }

  async logout() {
    const res = await this.request('/auth/logout', { method: 'POST' });
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
    return this.request<any[]>(`/bookings/guide/me?${sp}`);
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
