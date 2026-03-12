// ============================================
// Provider API Client — Guide endpoints
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

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

  async request<T>(endpoint: string, options: {
    method?: string;
    body?: object;
  } = {}): Promise<{ success: boolean; data?: T; error?: any; meta?: any }> {
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
      return await res.json();
    } catch {
      return { success: false, error: { code: 'NET', message: 'Không thể kết nối server' } };
    }
  }

  // ---- Auth ----
  async login(phone: string, code: string) {
    return this.request<{ token: string; user: any }>('/auth/otp/verify', {
      method: 'POST', body: { phone, code },
    });
  }

  async getMe() { return this.request<any>('/me'); }

  async updateProfile(data: { full_name: string; bio?: string; avatar_url?: string; languages?: string[] }) {
    return this.request('/me', { method: 'PUT', body: data });
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
  async getMyExperiences(page?: number) {
    const sp = new URLSearchParams();
    if (page) sp.set('page', String(page));
    return this.request<any[]>(`/experiences?${sp}`);
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
