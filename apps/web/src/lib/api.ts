// ============================================
// Admin API Client — communicates with backend
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

class AdminApi {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_token');
    }
    return null;
  }

  async request<T>(endpoint: string, options: {
    method?: string;
    body?: object;
  } = {}): Promise<{ success: boolean; data?: T; error?: { code: string; message: string }; meta?: any }> {
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

  // ---- Users ----
  async getUsers(params?: { search?: string; role?: string; page?: number }) {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.role) sp.set('role', params.role);
    if (params?.page) sp.set('page', String(params.page));
    return this.request<any[]>(`/admin/users?${sp}`);
  }

  async getUser(id: string) {
    return this.request<any>(`/admin/users/${id}`);
  }

  async banUser(id: string, active: boolean) {
    return this.request(`/admin/users/${id}/status`, {
      method: 'PUT', body: { is_active: active },
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
  async getBookings(params?: { status?: string; page?: number }) {
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.page) sp.set('page', String(params.page));
    return this.request<any[]>(`/admin/bookings?${sp}`);
  }

  async updateBookingStatus(id: string, status: string) {
    return this.request(`/admin/bookings/${id}/status`, {
      method: 'PUT', body: { status },
    });
  }

  // ---- Health ----
  async getHealth() {
    return this.request<any>('/health');
  }

  // ---- Search ----
  async getSearchStats() {
    return this.request<any>('/search/stats');
  }
}

export const adminApi = new AdminApi();
export default adminApi;
