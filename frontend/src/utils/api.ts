const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Algo salio mal en la peticion');
  }

  return data as T;
}

// Interfaces de datos
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  phone?: string;
}

export interface Product {
  id: number;
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
  total: number;
  payment_method: 'cash' | 'card' | 'transfer';
  type: 'online' | 'pos';
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  registered_by?: string;
  discount?: number;
  tax?: number;
  is_quotation?: number;
  amount_paid?: number;
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
    averageOrderValue: number;
    lowStockCount: number;
  };
  dailySales: { date: string; count: number; revenue: number }[];
  paymentMethods: { payment_method: string; count: number; revenue: number }[];
  salesTypes: { type: string; count: number; revenue: number }[];
  topProducts: { name: string; total_quantity: number; total_revenue: number }[];
  lowStockProducts: Product[];
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
    me: () => request<User>('/auth/me'),
    getCustomers: () => request<User[]>('/auth/customers'),
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
  },

  // Ventas / Compras
  sales: {
    checkout: (body: {
      userId?: number;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      paymentMethod: string;
      items: { productId: number; quantity: number }[];
      discount?: number;
      tax?: number;
      couponCode?: string;
    }) => request<SaleResult>('/sales/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    checkoutPOS: (body: {
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      customerUserId?: number;
      paymentMethod: string;
      items: { productId: number; quantity: number }[];
      discount?: number;
      tax?: number;
      isQuotation?: boolean;
      status?: string;
      amountPaid?: number;
      couponCode?: string;
    }) => request<SaleResult>('/sales/pos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    getHistory: () => request<Sale[]>('/sales/history'),
    getDetails: (id: number) => request<SaleDetail>(`/sales/${id}`),
    getAllAdmin: () => request<Sale[]>('/sales'),
    resendEmail: (id: number, email: string) => request<{ message: string; emailPreviewUrl?: string }>(`/sales/${id}/resend-email`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
    getDebtors: () => request<Sale[]>('/sales/debtors/all'),
    updateStatus: (id: number, status?: 'completed' | 'cancelled' | 'pending', abono?: number) => request<{ message: string; status?: string; amount_paid?: number }>(`/sales/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, abono }),
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
    getExchangeRates: () => request<{ usdToVes: number; eurToVes: number }>('/sales/settings/rates'),
    updateExchangeRates: (body: { usdToVes: number; eurToVes: number }) => request<{ message: string }>('/sales/settings/rates', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    syncExchangeRates: () => request<{ message: string; rates: { usdToVes: number; eurToVes: number } }>('/sales/settings/rates/sync', {
      method: 'POST',
    }),
  },

  // Estadísticas (Dashboard Admin)
  stats: {
    getDashboard: () => request<StatsData>('/stats'),
  },
};
