const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

let activeBusinessSlug: string = localStorage.getItem('facilito_business_slug') || '';

export function setActiveBusinessSlug(slug: string) {
  activeBusinessSlug = (slug || '').trim().toLowerCase();
  if (activeBusinessSlug) {
    localStorage.setItem('facilito_business_slug', activeBusinessSlug);
  } else {
    localStorage.removeItem('facilito_business_slug');
  }
}

export function getActiveBusinessSlug(): string {
  return activeBusinessSlug;
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (activeBusinessSlug) {
    headers['x-business-slug'] = activeBusinessSlug;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Error ${response.status}: El servidor backend no respondió con JSON. Por favor asegúrate de reiniciar el backend (npm run dev).`);
    }
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Respuesta no válida del servidor. Reinicie el servidor backend para aplicar los últimos cambios.');
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/register')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('session_expires_at');
      localStorage.removeItem('session_last_activity');
      localStorage.removeItem('session_login_time');
      sessionStorage.removeItem('facilito_cash_session');
      window.dispatchEvent(new CustomEvent('facilito:session-expired', { detail: data?.message || 'Sesión expirada' }));
    }
    const errorObj = new Error(data?.message || `Error ${response.status} en la petición`);
    if (data && typeof data === 'object') {
      Object.assign(errorObj, data);
    }
    throw errorObj;
  }

  return data as T;
}

// Interfaces de datos Multi-Tenant y SaaS
export interface BusinessProfile {
  id: number;
  name: string;
  slug: string;
  rif: string | null;
  legal_name: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  ticket_message: string | null;
  license_status: 'trial' | 'active' | 'expired' | 'suspended';
  license_plan: 'basic' | 'pro' | 'enterprise';
  license_expires_at: string | null;
  price_monthly?: number;
  google_sheet_url: string | null;
  google_sheets_webhook_url?: string | null;
  is_active: number;
  daysRemaining?: number | null;
  isExpired?: boolean;
}

export interface SuperAdminMetrics {
  totalBusinesses: number;
  activeLicenses: number;
  trialLicenses: number;
  expiredLicenses: number;
  suspendedLicenses: number;
  estimatedMRR: number;
  globalSalesCount: number;
  globalRevenue: number;
}

export interface SuperAdminBusiness extends BusinessProfile {
  total_users: number;
  total_products: number;
  total_sales: number;
  total_revenue: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'customer' | 'seller' | 'billing';
  phone?: string;
  ci?: string;
  address?: string | null;
  business_id?: number;
  business?: BusinessProfile;
  client_type?: 'natural' | 'juridico' | 'gubernamental';
  representative_name?: string | null;
  representative_ci?: string | null;
  representative_phone?: string | null;
  representative_position?: string | null;
  permissions?: string;
  created_at?: string;
}

export interface Product {
  id: number;
  code?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  category: string;
}

export interface Sale {
  id: number;
  user_id?: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_ci?: string;
  total: number;
  payment_method: 'cash' | 'card' | 'transfer';
  type: 'online' | 'pos';
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  registered_by?: string;
  seller_name?: string;
  discount?: number;
  tax?: number;
  is_quotation?: number;
  amount_paid?: number;
  coupon_code?: string | null;
  coupon_discount_percent?: number;
  delivery_option?: 'pickup' | 'delivery';
  delivery_address?: string | null;
  google_maps_link?: string | null;
  payment_attachments?: string | null;
}

export interface Coupon {
  id: number;
  code: string;
  discount_percent: number;
  active: number;
  user_id?: number | null;
  is_used?: number;
  created_at?: string;
}

export interface Expense {
  id: number;
  name: string;
  description?: string | null;
  amount: number;
  amount_ves?: number | null;
  currency: string;
  expense_type: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'unexpected';
  is_active: boolean;
  start_date?: string | null;
  next_due_date?: string | null;
  created_at?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  rif?: string | null;
  created_at?: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  action_type: 'sale_online' | 'sale_pos' | 'quotation' | 'staff_crud' | 'user_edit' | 'product_crud' | 'coupon_crud' | 'settings' | 'supplier_crud';
  title: string;
  details?: string;
  created_at: string;
}

export interface SaleDetail {
  sale: Sale;
  items: {
    id: number;
    sale_id: number;
    product_id: number;
    quantity: number;
    price: number;
    name: string;
  }[];
}

export interface SaleResult {
  message: string;
  saleId: number;
  total: number;
  whatsappText: string;
  emailPreviewUrl?: string;
}

export interface StatsData {
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    totalExpenses?: number;
    totalProfit?: number;
    profitMargin?: number;
    averageOrderValue: number;
    lowStockCount: number;
    totalCustomers?: number;
    debtorsCount?: number;
    pendingDebt?: number;
  };
  dailySales: { date: string; count: number; revenue: number }[];
  paymentMethods: { payment_method: string; count: number; revenue: number }[];
  salesTypes: { type: string; count: number; revenue: number }[];
  topProducts: { name: string; category?: string; total_quantity: number; total_revenue: number }[];
  categorySales?: { category: string; order_count: number; total_quantity: number; total_revenue: number }[];
  lowStockProducts: Product[];
}

export interface CashSession {
  id: number;
  user_id: number;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
  opening_balance: number;
  expected_balance: number;
  actual_balance: number | null;
  difference: number | null;
  closed_by: number | null;
}

export interface CashDrop {
  id: number;
  session_id: number;
  amount: number;
  authorized_by: number;
  created_at: string;
}

export interface ReturnClaim {
  id: number;
  code: string;
  type: 'warranty' | 'return';
  sale_id?: number | null;
  product_id?: number | null;
  product_name: string;
  product_sku?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_ci?: string | null;
  customer_email?: string | null;
  reason: string;
  issue_description?: string | null;
  status: 'pending' | 'in_repair' | 'repaired' | 'replaced' | 'refunded' | 'rejected' | 'completed';
  is_repaired: number | boolean;
  repair_cost: number;
  repair_notes?: string | null;
  technician_name?: string | null;
  resolution?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  sale_total?: number | null;
  sale_date?: string | null;
  received_at: string;
  repaired_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  supervisorEmail?: string;
  supervisorPassword?: string;
}

export interface ReturnClaimStats {
  total: number;
  warranties: number;
  returns: number;
  pending: number;
  repaired: number;
  total_repair_cost: number;
}

// API Endpoints
export const api = {
  // Autenticación
  auth: {
    login: (body: any) => request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    register: (body: any) => request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    loginGoogle: (credential: string) => request<{ token: string; user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
    getGoogleClientId: () => request<{ clientId: string }>('/auth/google-client-id'),
    me: () => request<User>('/auth/me'),
    getCustomers: () => request<User[]>('/auth/customers'),
    registerCustomer: (body: {
      name: string;
      ci: string;
      email?: string;
      phone?: string;
      address?: string;
      client_type?: string;
      representative_name?: string;
      representative_ci?: string;
      representative_phone?: string;
      representative_position?: string;
    }) => request<{ message: string; user: User }>('/auth/register-customer', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    getCustomerByCi: (ci: string) => request<User>(`/auth/customer-by-ci?ci=${encodeURIComponent(ci)}`),
    updateCustomer: (id: number, body: any) => request<{ message: string }>(`/auth/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    deleteCustomer: (id: number) => request<{ message: string }>(`/auth/customers/${id}`, {
      method: 'DELETE',
    }),
    getStaff: () => request<User[]>('/auth/staff'),
    createStaff: (body: any) => request<{ message: string }>('/auth/staff', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    updateStaff: (id: number, body: any) => request<{ message: string }>(`/auth/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    deleteStaff: (id: number) => request<{ message: string }>(`/auth/staff/${id}`, {
      method: 'DELETE',
    }),
    forgotPassword: (email: string) => request<{ message: string; emailPreviewUrl?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
    resetPassword: (body: { email: string; code: string; newPassword: string }) => request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    verifySupervisor: (body: any) => request<{ user: User }>('/auth/verify-supervisor', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  },

  // Productos
  products: {
    getAll: (category?: string, search?: string) => {
      let query = '';
      if (category || search) {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        query = `?${params.toString()}`;
      }
      return request<Product[]>(`/products${query}`);
    },
    getOne: (id: number) => request<Product>(`/products/${id}`),
    create: (body: Partial<Product>) => request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    update: (id: number, body: Partial<Product>) => request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    delete: (id: number) => request<{ message: string }>(`/products/${id}`, {
      method: 'DELETE',
    }),
    getNextSku: (category?: string, brand?: string) => {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (brand) params.append('brand', brand);
      return request<{ sku: string; seq: number; cc: string; sss: string; nnnn: string }>(`/products/next-sku?${params.toString()}`);
    },
    uploadImage: async (formData: FormData) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/products/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      const contentType = response.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Error ${response.status}: El servidor no respondió con JSON. Detalle: ${text.substring(0, 100)}...`);
      }
      if (!response.ok) {
        throw new Error(data.message || 'Error al subir la imagen');
      }
      return data as { imageUrl: string };
    },
  },

  // Ventas / Compras
  sales: {
    checkout: (body: {
      userId?: number;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      customerCi?: string;
      paymentMethod: string;
      items: { productId: number; quantity: number }[];
      discount?: number;
      tax?: number;
      couponCode?: string;
      deliveryOption?: string;
      deliveryAddress?: string;
      googleMapsLink?: string;
      paymentAttachments?: string;
    }) => request<SaleResult>('/sales/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    checkoutPOS: (body: {
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      customerCi?: string;
      customerUserId?: number;
      paymentMethod: string;
      items: { productId: number; quantity: number; price?: number; name?: string; customName?: string }[];
      discount?: number;
      tax?: number;
      isQuotation?: boolean;
      status?: string;
      amountPaid?: number;
      couponCode?: string;
      loadedQuotationId?: number;
      concept?: string;
      note?: string;
    }) => request<SaleResult>('/sales/pos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    getHistory: () => request<Sale[]>('/sales/history'),
    getCustomerSalesHistory: (customerId: number) => request<{ customer: User; sales: Sale[] }>(`/sales/customer-history/${customerId}`),
    getDetails: (id: number) => request<SaleDetail>(`/sales/${id}`),
    getAllAdmin: () => request<Sale[]>('/sales'),
    getAuditLogs: () => request<{ logs: AuditLog[]; sales: Sale[] }>('/sales/audit-logs'),
    resendEmail: (id: number, email: string) => request<{ message: string; emailPreviewUrl?: string }>(`/sales/${id}/resend-email`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
    getDebtors: () => request<Sale[]>('/sales/debtors/all'),
    getOnlinePending: () => request<Sale[]>('/sales/online-pending'),
    testSMTP: (testEmail: string) => request<{ success: boolean; message: string; diagnostics: string[] }>('/sales/test-smtp', {
      method: 'POST',
      body: JSON.stringify({ testEmail }),
    }),
    uploadReceipt: async (formData: FormData) => {
      const response = await fetch(`${API_BASE}/sales/upload-receipt`, {
        method: 'POST',
        body: formData,
      });
      const contentType = response.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Error ${response.status}: El servidor no respondió con JSON. Detalle: ${text.substring(0, 100)}...`);
      }
      if (!response.ok) {
        throw new Error(data.message || 'Error al subir comprobante');
      }
      return data as { imageUrl: string };
    },
    updateStatus: (id: number, status?: 'completed' | 'cancelled' | 'pending', abono?: number, supervisorEmail?: string, supervisorPassword?: string) => request<{ message: string; status?: string; amount_paid?: number }>(`/sales/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, abono, supervisorEmail, supervisorPassword }),
    }),
    getQuotations: () => request<Sale[]>('/sales/quotations/all'),
    validateCoupon: (code: string, userId?: number) => request<Coupon>('/sales/coupon/validate', {
      method: 'POST',
      body: JSON.stringify({ code, userId }),
    }),
    getCoupons: () => request<Coupon[]>('/sales/coupons/all'),
    addCoupon: (code: string, discountPercent: number, userId?: number) => request<{ message: string }>('/sales/coupons', {
      method: 'POST',
      body: JSON.stringify({ code, discountPercent, userId }),
    }),
    updateCoupon: (id: number, body: Partial<Coupon>) => request<{ message: string }>(`/sales/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    deleteCoupon: (id: number) => request<{ message: string }>(`/sales/coupons/${id}`, {
      method: 'DELETE',
    }),
    getReminderSettings: () => request<{ frequencyDays: number; emailTemplate: string }>('/sales/settings/reminders'),
    updateReminderSettings: (body: { frequencyDays: number; emailTemplate: string }) => request<{ message: string }>('/sales/settings/reminders', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    sendManualReminder: (id: number) => request<{ message: string }>(`/sales/${id}/remind`, {
      method: 'POST',
    }),
    getExchangeRates: () => request<{ usdToVes: number; eurToVes: number; binanceUsdToVes: number }>('/sales/settings/rates'),
    getHistoricalExchangeRates: (date: string) => request<{ date: string; usdToVes: number; binanceUsdToVes: number }>(`/sales/settings/rates/historical?date=${date}`),
    updateExchangeRates: (body: { usdToVes: number; eurToVes: number; binanceUsdToVes?: number }) => request<{ message: string }>('/sales/settings/rates', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    syncExchangeRates: () => request<{ message: string; rates: { usdToVes: number; eurToVes: number; binanceUsdToVes: number } }>('/sales/settings/rates/sync', {
      method: 'POST',
    }),
  },

  expenses: {
    getAll: () => request<Expense[]>('/expenses'),
    create: (body: Partial<Expense>) => request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    update: (id: number, body: Partial<Expense>) => request<Expense>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    delete: (id: number) => request<{ message: string }>(`/expenses/${id}`, {
      method: 'DELETE',
    }),
  },

  // Estadísticas (Dashboard Admin)
  stats: {
    getDashboard: () => request<StatsData>('/stats'),
    getReports: (filters: { seller_id?: string; period: string; date?: string; start_date?: string; end_date?: string }) => {
      const params = new URLSearchParams();
      if (filters.seller_id) params.append('seller_id', filters.seller_id);
      if (filters.period) params.append('period', filters.period);
      if (filters.date) params.append('date', filters.date);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      return request<any>(`/stats/reports?${params.toString()}`);
    },
  },

  // Caja Registradora / Turnos
  cash: {
    getActive: () => request<CashSession | null>('/cash/active'),
    open: (openingBalance: number) => request<CashSession>('/cash/open', {
      method: 'POST',
      body: JSON.stringify({ openingBalance }),
    }),
    close: (actualBalance: number) => request<any>('/cash/close', {
      method: 'POST',
      body: JSON.stringify({ actualBalance }),
    }),
    cashDrop: (body: { amount: number; supervisorEmail?: string; supervisorPassword?: string }) => request<any>('/cash/cash-drop', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  },

  // Proveedores
  suppliers: {
    getAll: () => request<Supplier[]>('/suppliers'),
    getOne: (id: number) => request<Supplier>(`/suppliers/${id}`),
    create: (body: Partial<Supplier>) => request<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    update: (id: number, body: Partial<Supplier>) => request<Supplier>(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    delete: (id: number) => request<{ message: string }>(`/suppliers/${id}`, {
      method: 'DELETE',
    }),
  },

  // Devoluciones o Reclamos de Garantía
  returns: {
    getAll: (filters?: { status?: string; type?: string; search?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.search) params.append('search', filters.search);
      return request<ReturnClaim[]>(`/returns?${params.toString()}`);
    },
    getStats: () => request<ReturnClaimStats>('/returns/stats'),
    getOne: (id: number) => request<ReturnClaim>(`/returns/${id}`),
    create: (body: Partial<ReturnClaim>) => request<{ id: number; code: string; message: string }>('/returns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    update: (id: number, body: Partial<ReturnClaim>) => request<{ message: string }>(`/returns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    delete: (id: number) => request<{ message: string }>(`/returns/${id}`, {
      method: 'DELETE',
    }),
  },

  // Gestión de Licencias y Comercios (SuperAdmin)
  superadmin: {
    getMetrics: () => request<{ metrics: SuperAdminMetrics }>('/superadmin/metrics'),
    getBusinesses: () => request<{ businesses: SuperAdminBusiness[] }>('/superadmin/businesses'),
    createBusiness: (body: any) => request<{ message: string; business: any }>('/superadmin/businesses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    updateLicense: (id: number, body: { action?: string; add_days?: number; license_status?: string; license_plan?: string; is_active?: boolean; price_monthly?: number }) => request<any>(`/superadmin/businesses/${id}/license`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  },

  // Perfil del Comercio y Google Sheets
  business: {
    getProfile: () => request<{ business: BusinessProfile }>('/business/profile'),
    getMyProfile: async (): Promise<BusinessProfile> => {
      const res = await api.business.getProfile();
      return res.business;
    },
    updateProfile: (body: Partial<BusinessProfile>) => request<{ message: string }>('/business/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    autoProvisionSheet: () => request<{ message: string; sheetUrl: string; isSimulated: boolean }>('/business/google-sheet', {
      method: 'POST',
    }),
    getPublicProfile: (slug: string) => request<{ business: BusinessProfile }>(`/business/public/${slug}`),
    getBySlug: async (slug: string): Promise<BusinessProfile> => {
      const res = await api.business.getPublicProfile(slug);
      return res.business;
    },
  },
};
