const API_BASE = '/api';

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
    }) => request<SaleResult>('/sales/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    checkoutPOS: (body: {
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      paymentMethod: string;
      items: { productId: number; quantity: number }[];
    }) => request<SaleResult>('/sales/pos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    getHistory: () => request<Sale[]>('/sales/history'),
    getDetails: (id: number) => request<SaleDetail>(`/sales/${id}`),
    getAllAdmin: () => request<Sale[]>('/sales'),
  },

  // Estadísticas (Dashboard Admin)
  stats: {
    getDashboard: () => request<StatsData>('/stats'),
  },
};
