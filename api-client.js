// Frontend API Client - استفاده کنید این فایل رو در HTML frontend
// ابتدا API_BASE_URL رو با URL سرور‌تون جایگزین کنید

const API_BASE_URL = 'https://your-api-domain.com'; // تغییر دهید

class TablighYarAPI {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  // ============= AUTH =============

  async signup(name, phone, referralCode = null) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, referralCode })
      });

      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        localStorage.setItem('token', data.token);
        localStorage.setItem('referralCode', data.user.referralCode);
        return { success: true, user: data.user, token: data.token };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async login(phone, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        localStorage.setItem('token', data.token);
        return { success: true, user: data.user, token: data.token };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('referralCode');
  }

  // ============= USER PROFILE =============

  async getProfile() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();
      return response.ok ? { success: true, user: data.user } : { success: false, error: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTeam() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/team`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();
      return response.ok ? { success: true, data } : { success: false, error: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============= SALES =============

  async createSale(businessName, packageType, amount, description = '') {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ businessName, packageType, amount, description })
      });

      const data = await response.json();
      return response.ok ? { success: true, sale: data.sale } : { success: false, error: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getUserSales() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales/user`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();
      return response.ok ? { success: true, sales: data.sales, total: data.totalAmount } : { success: false, error: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============= COMMISSIONS =============

  async getCommissions() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/commissions`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();
      return response.ok ? { success: true, commissions: data.commissions, total: data.total, byLevel: data.byLevel } : { success: false, error: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============= DASHBOARD =============

  async getDashboard() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();
      return response.ok ? { success: true, ...data } : { success: false, error: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============= HELPERS =============

  isLoggedIn() {
    return !!this.token;
  }

  getReferralCode() {
    return localStorage.getItem('referralCode');
  }

  getReferralLink() {
    return `${window.location.origin}?ref=${this.getReferralCode()}`;
  }
}

// ============= استفاده =============

// ایجاد instance
const api = new TablighYarAPI();

// مثال: ثبت‌نام
// const result = await api.signup('احمد محمدی', '09121234567');
// if (result.success) console.log('ثبت‌نام موفق:', result.user);

// مثال: ورود
// const result = await api.login('09121234567', 'password123');
// if (result.success) console.log('ورود موفق:', result.user);

// مثال: دریافت داشبورد
// const result = await api.getDashboard();
// if (result.success) {
//   console.log('فروش شخصی:', result.stats.ownSalesThisMonth);
//   console.log('فروش تیم:', result.stats.teamSalesThisMonth);
//   console.log('کمیشن ماه:', result.stats.totalCommission);
// }

// مثال: ثبت فروش جدید
// const result = await api.createSale('فروشگاه علی', 'silver', 15);
// if (result.success) console.log('فروش ثبت شد:', result.sale);
