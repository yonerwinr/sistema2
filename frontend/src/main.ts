import { Chart, registerables } from 'chart.js';
import { api } from './utils/api';
import type { Product, User, SaleDetail } from './utils/api';
import { initScrollAnimations } from './utils/scroll-animation';
import './index.css';

Chart.register(...registerables);

// ==========================================================================
// ESTADO GLOBAL DE LA APP
// ==========================================================================
let currentView: 'store' | 'auth' | 'admin' = 'store';
let currentUser: User | null = null;
let productsList: Product[] = [];
let selectedCategory: string = '';
let searchQuery: string = '';

// Estado del Carrito E-commerce
interface CartItem {
  product: Product;
  quantity: number;
}
let cart: CartItem[] = [];

// Estado del Carrito POS (Administrador)
interface POSCartItem {
  product: Product;
  quantity: number;
}
let posCart: POSCartItem[] = [];
let posSearchQuery: string = '';

// Vista activa dentro de Administración
type AdminSubView = 'stats' | 'pos' | 'products' | 'sales';
let activeAdminView: AdminSubView = 'stats';

// Instancias de Chart.js para destruirlas al cambiar de pestaña
let revenueChartInstance: Chart | null = null;
let paymentChartInstance: Chart | null = null;

// ==========================================================================
// ICONOS SVG COMPARTIDOS (Premium & Sleek)
// ==========================================================================
const icons = {
  cart: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
  dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,
  pos: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="10" y1="4" x2="10" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
  products: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  sales: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  logout: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  user: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  minus: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.166.001 6.141 1.233 8.377 3.469 2.235 2.237 3.466 5.214 3.466 8.384-.003 6.536-5.328 11.86-11.859 11.86-1.996-.001-3.956-.508-5.7-1.472L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.277 0 9.585-4.293 9.588-9.569a9.54 9.54 0 0 0-2.8-6.78A9.52 9.52 0 0 0 11.86 1.62c-5.278 0-9.587 4.293-9.59 9.57a9.508 9.508 0 0 0 1.488 4.787l-.98 3.585 3.679-.963zm12.33-4.996c-.3-.15-1.77-.875-2.046-.975-.276-.1-.477-.15-.677.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-.3-.15-1.265-.467-2.41-1.485-.89-.792-1.49-1.77-1.665-2.07-.175-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5s.05-.375-.025-.525c-.075-.15-.677-1.63-.927-2.23-.243-.586-.492-.507-.677-.517-.174-.01-.375-.012-.576-.012-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.11 3.22 5.11 4.52.714.31 1.27.495 1.7.63.717.227 1.37.195 1.885.118.575-.085 1.77-.725 2.02-1.39.25-.665.25-1.23.175-1.39-.075-.16-.275-.26-.575-.41z"/></svg>`
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
window.addEventListener('DOMContentLoaded', async () => {
  // Cargar sesión del almacenamiento local si existe
  const token = localStorage.getItem('token');
  if (token) {
    try {
      currentUser = await api.auth.me();
    } catch (e) {
      // Token corrupto o expirado
      localStorage.removeItem('token');
    }
  }

  // Cargar carrito del almacenamiento local
  const savedCart = localStorage.getItem('cart');
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
    } catch (e) {
      cart = [];
    }
  }

  // Cargar productos iniciales
  await loadProducts();

  // Renderizar e iniciar animaciones
  navigate('store');
});

async function loadProducts() {
  try {
    productsList = await api.products.getAll(selectedCategory || undefined, searchQuery || undefined);
  } catch (error) {
    console.error('Error al cargar productos:', error);
  }
}

// ==========================================================================
// ENRUTADOR (Navegación SPA)
// ==========================================================================
function navigate(view: 'store' | 'auth' | 'admin') {
  currentView = view;
  
  // Destruir gráficos previos si salimos de admin
  if (currentView !== 'admin') {
    destroyCharts();
  }

  renderApp();
}

function destroyCharts() {
  if (revenueChartInstance) {
    revenueChartInstance.destroy();
    revenueChartInstance = null;
  }
  if (paymentChartInstance) {
    paymentChartInstance.destroy();
    paymentChartInstance = null;
  }
}

// ==========================================================================
// RENDERIZADOR GENERAL
// ==========================================================================
function renderApp() {
  const appDiv = document.getElementById('app');
  if (!appDiv) return;

  appDiv.innerHTML = `
    ${renderNavbar()}
    <main id="main-content" style="flex-grow: 1;">
      ${currentView === 'store' ? renderStoreView() : ''}
      ${currentView === 'auth' ? renderAuthView() : ''}
      ${currentView === 'admin' ? renderAdminView() : ''}
    </main>
    ${renderFooter()}
    ${renderCartSidebar()}
    ${renderCheckoutModal()}
    ${renderInvoiceSuccessModal()}
    ${renderSaleDetailModal()}
  `;

  // Enlazar eventos de la vista activa y modales comunes
  bindGeneralEvents();
  bindCartEvents();
  bindCheckoutEvents();
  bindSuccessEvents();
  bindSaleDetailEvents();

  if (currentView === 'store') {
    bindStoreEvents();
  } else if (currentView === 'auth') {
    bindAuthEvents();
  } else if (currentView === 'admin') {
    bindAdminEvents();
  }

  // Inicializar animaciones de scroll
  initScrollAnimations();
}

// ==========================================================================
// COMPONENTES COMUNES: NAVBAR & FOOTER
// ==========================================================================
function renderNavbar(): string {
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <nav class="navbar">
      <div class="container navbar-container">
        <a class="logo" href="#" id="nav-logo">
          <span>🛍️</span> POS Hibrido
        </a>
        <div class="nav-links">
          <a class="nav-link ${currentView === 'store' ? 'active' : ''}" id="link-store">Tienda</a>
          
          ${currentUser ? `
            ${currentUser.role === 'admin' ? `
              <a class="nav-link ${currentView === 'admin' ? 'active' : ''}" id="link-admin">
                <span style="display:inline-flex; align-items:center; gap:4px;">${icons.dashboard} Panel Admin</span>
              </a>
            ` : ''}
            <span class="nav-link" style="color: var(--primary); font-weight: 600; cursor: default;">
              Hola, ${currentUser.name.split(' ')[0]}
            </span>
            <a class="nav-link" id="link-logout" style="display:flex; align-items:center; gap:6px;">
              ${icons.logout} Salir
            </a>
          ` : `
            <a class="nav-link ${currentView === 'auth' ? 'active' : ''}" id="link-login">Ingresar</a>
          `}
          
          <!-- Carrito de E-commerce -->
          <div class="cart-icon-container" id="nav-cart-btn">
            ${icons.cart}
            ${totalCartItems > 0 ? `<span class="cart-badge">${totalCartItems}</span>` : ''}
          </div>
        </div>
      </div>
    </nav>
  `;
}

function renderFooter(): string {
  return `
    <footer style="background: var(--bg-secondary); border-top: 1px solid var(--border-glass); padding: 24px 0; text-align: center; font-size: 13px; color: var(--text-secondary); margin-top: auto;">
      <div class="container">
        <p>&copy; ${new Date().getFullYear()} POS Online. Construido con HTML, CSS, JavaScript y TypeScript.</p>
      </div>
    </footer>
  `;
}

// ==========================================================================
// SECCIÓN DE EVENTOS COMUNES
// ==========================================================================
function bindGeneralEvents() {
  document.getElementById('nav-logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('store');
  });

  document.getElementById('link-store')?.addEventListener('click', () => navigate('store'));
  document.getElementById('link-admin')?.addEventListener('click', () => {
    activeAdminView = 'stats';
    navigate('admin');
  });

  document.getElementById('link-login')?.addEventListener('click', () => navigate('auth'));

  document.getElementById('link-logout')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    currentUser = null;
    cart = [];
    localStorage.removeItem('cart');
    navigate('store');
  });

  // Sidebar del Carrito
  const cartBtn = document.getElementById('nav-cart-btn');
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartClose = document.getElementById('cart-close');

  cartBtn?.addEventListener('click', () => {
    cartSidebar?.classList.add('open');
  });

  cartClose?.addEventListener('click', () => {
    cartSidebar?.classList.remove('open');
  });
}

// ==========================================================================
// VISTA: TIENDA ONLINE (E-COMMERCE)
// ==========================================================================
function renderStoreView(): string {
  // Categorías estáticas
  const categories = ['Todas', 'Smartphones', 'Laptops', 'Accesorios', 'Tablets', 'Smartwatches'];

  // Agrupar HTML de tarjetas de producto
  const productsHtml = productsList.map(prod => {
    const isLowStock = prod.stock < 5;
    return `
      <div class="card product-card animate-on-scroll animate-fade-up">
        <div class="product-image-container">
          <img class="product-image" src="${prod.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=600&auto=format&fit=crop'}" alt="${prod.name}">
        </div>
        <div class="product-info">
          <div class="product-category">${prod.category || 'General'}</div>
          <h3 class="product-title">${prod.name}</h3>
          <p class="product-description">${prod.description || 'Sin descripcion.'}</p>
          <div class="product-footer">
            <div>
              <div class="product-price">$${Number(prod.price).toFixed(2)}</div>
              <div class="product-stock ${isLowStock ? 'low-stock' : ''}">
                ${isLowStock ? `¡Solo ${prod.stock} disponibles!` : `Stock: ${prod.stock}`}
              </div>
            </div>
            <button class="btn btn-primary btn-icon add-to-cart-btn" data-id="${prod.id}">
              ${icons.plus}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="hero-section animate-on-scroll animate-zoom-in">
      <div class="container">
        <h1 class="hero-title">Tu Tienda Digital Moderna</h1>
        <p class="hero-subtitle">Encuentra los dispositivos mas avanzados del mercado con entrega inmediata, facturacion digital y soporte completo.</p>
      </div>
    </section>

    <div class="container store-container">
      <!-- Filtros Laterales -->
      <aside class="card sidebar-filters animate-on-scroll animate-slide-right">
        <h3 class="mb-4" style="font-size: 16px; font-weight: 700; text-transform: uppercase;">Filtrar</h3>
        
        <!-- Buscador -->
        <div class="form-group">
          <input type="text" class="form-control" id="store-search" placeholder="Buscar producto..." value="${searchQuery}">
        </div>

        <div class="form-group">
          <label class="form-label">Categorias</label>
          <div class="flex flex-col gap-2">
            ${categories.map(cat => `
              <button class="filter-category-btn ${selectedCategory === (cat === 'Todas' ? '' : cat) ? 'active' : ''}" data-category="${cat === 'Todas' ? '' : cat}">
                ${cat}
              </button>
            `).join('')}
          </div>
        </div>
      </aside>

      <!-- Grid de Productos -->
      <section>
        <div class="products-grid stagger-container">
          ${productsHtml.length > 0 ? productsHtml : `
            <div class="card text-center" style="grid-column: 1 / -1; padding: 60px;">
              <p style="color: var(--text-secondary); font-size: 16px;">No se encontraron productos en esta categoria.</p>
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}

function bindStoreEvents() {
  // Buscador con debounce
  let searchTimeout: any;
  const searchInput = document.getElementById('store-search') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    searchQuery = val;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      await loadProducts();
      renderApp();
    }, 450);
  });

  // Filtro de categorías
  document.querySelectorAll('.filter-category-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const cat = (e.currentTarget as HTMLButtonElement).dataset.category || '';
      selectedCategory = cat;
      await loadProducts();
      renderApp();
    });
  });

  // Agregar al carrito
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      const prod = productsList.find(p => p.id === id);
      if (prod) {
        addToCart(prod);
      }
    });
  });
}

function addToCart(product: Product) {
  const existing = cart.find(item => item.product.id === product.id);
  if (existing) {
    if (existing.quantity >= product.stock) {
      alert(`No puedes agregar mas unidades. Stock maximo alcanzado (${product.stock})`);
      return;
    }
    existing.quantity++;
  } else {
    if (product.stock < 1) {
      alert('Producto agotado');
      return;
    }
    cart.push({ product, quantity: 1 });
  }
  
  localStorage.setItem('cart', JSON.stringify(cart));
  renderApp();
  // Abrir sidebar del carrito automáticamente
  document.getElementById('cart-sidebar')?.classList.add('open');
}

// ==========================================================================
// COMPONENTE: CARRITO FLOTANTE (SIDEBAR)
// ==========================================================================
function renderCartSidebar(): string {
  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const itemsHtml = cart.map(item => `
    <div class="cart-item">
      <img src="${item.product.image_url}" class="cart-item-img" alt="${item.product.name}">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.product.name}</div>
        <div class="cart-item-price">$${Number(item.product.price).toFixed(2)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn dec-cart-qty" data-id="${item.product.id}">${icons.minus}</button>
          <span style="font-weight:600; font-size:14px;">${item.quantity}</span>
          <button class="qty-btn inc-cart-qty" data-id="${item.product.id}">${icons.plus}</button>
          
          <button class="btn btn-danger remove-cart-item" data-id="${item.product.id}" style="padding: 4px; border-radius: 6px; margin-left: auto; background: transparent; border: none; color: var(--text-muted);">
            ${icons.trash}
          </button>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="cart-sidebar" id="cart-sidebar">
      <div class="cart-header">
        <h3 style="font-size: 18px; font-weight: 700;">Mi Carrito</h3>
        <button id="cart-close" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size: 20px;">&times;</button>
      </div>
      <div class="cart-items-list">
        ${cart.length > 0 ? itemsHtml : `
          <div style="text-align:center; padding: 40px 0; color:var(--text-secondary);">
            <div style="font-size: 40px; margin-bottom: 12px;">🛍️</div>
            Tu carrito esta vacio
          </div>
        `}
      </div>
      <div class="cart-footer">
        <div class="cart-total-row">
          <span>Subtotal</span>
          <span>$${subtotal.toFixed(2)}</span>
        </div>
        <button class="btn btn-primary w-100" id="cart-checkout-btn" ${cart.length === 0 ? 'disabled' : ''}>
          Proceder al Pago
        </button>
      </div>
    </div>
  `;
}

function bindCartEvents() {
  document.querySelectorAll('.inc-cart-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      const item = cart.find(i => i.product.id === id);
      if (item) {
        if (item.quantity >= item.product.stock) {
          alert('Stock maximo alcanzado');
          return;
        }
        item.quantity++;
        localStorage.setItem('cart', JSON.stringify(cart));
        renderApp();
        document.getElementById('cart-sidebar')?.classList.add('open');
      }
    });
  });

  document.querySelectorAll('.dec-cart-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      const item = cart.find(i => i.product.id === id);
      if (item) {
        item.quantity--;
        if (item.quantity <= 0) {
          cart = cart.filter(i => i.product.id !== id);
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        renderApp();
        document.getElementById('cart-sidebar')?.classList.add('open');
      }
    });
  });

  document.querySelectorAll('.remove-cart-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      cart = cart.filter(i => i.product.id !== id);
      localStorage.setItem('cart', JSON.stringify(cart));
      renderApp();
      document.getElementById('cart-sidebar')?.classList.add('open');
    });
  });

  // Mostrar modal de checkout
  document.getElementById('cart-checkout-btn')?.addEventListener('click', () => {
    // Cerrar el sidebar
    document.getElementById('cart-sidebar')?.classList.remove('open');
    // Abrir el modal de checkout
    const modal = document.getElementById('checkout-modal');
    modal?.classList.add('open');

    // Prellenar si hay usuario logueado
    if (currentUser) {
      const nameInput = document.getElementById('checkout-name') as HTMLInputElement;
      const emailInput = document.getElementById('checkout-email') as HTMLInputElement;
      const phoneInput = document.getElementById('checkout-phone') as HTMLInputElement;
      if (nameInput) nameInput.value = currentUser.name;
      if (emailInput) emailInput.value = currentUser.email;
      if (phoneInput) phoneInput.value = currentUser.phone || '';
    }
  });
}

// ==========================================================================
// COMPONENTE: MODAL DE CHECKOUT (FORMULARIO DE PAGO)
// ==========================================================================
function renderCheckoutModal(): string {
  return `
    <div class="modal-overlay" id="checkout-modal">
      <div class="modal-content animate-on-scroll animate-zoom-in visible">
        <button class="modal-close" id="checkout-close">&times;</button>
        <h2 class="mb-4" style="font-size:22px; font-weight:700;">Finalizar Compra</h2>
        
        <form id="checkout-form">
          <div class="form-group">
            <label class="form-label" for="checkout-name">Nombre Completo</label>
            <input type="text" class="form-control" id="checkout-name" required placeholder="Ej. Juan Perez">
          </div>
          <div class="form-group">
            <label class="form-label" for="checkout-email">Correo Electronico</label>
            <input type="email" class="form-control" id="checkout-email" required placeholder="Ej. juan@correo.com">
            <small style="color:var(--text-muted); font-size:11px;">Recibiras tu factura en este correo.</small>
          </div>
          <div class="form-group">
            <label class="form-label" for="checkout-phone">WhatsApp / Telefono</label>
            <input type="tel" class="form-control" id="checkout-phone" placeholder="Ej. +5491122334455">
            <small style="color:var(--text-muted); font-size:11px;">Codigo de pais incluido (ej. +54 o +57).</small>
          </div>
          <div class="form-group">
            <label class="form-label">Metodo de Pago</label>
            <select class="form-control" id="checkout-payment" required>
              <option value="card">Tarjeta de Credito / Debito</option>
              <option value="transfer">Transferencia Bancaria</option>
            </select>
          </div>

          <div style="margin-top: 32px; display:flex; justify-content:flex-end; gap:16px;">
            <button type="button" class="btn btn-secondary" id="checkout-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="checkout-submit-btn">Pagar y Enviar Factura</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function bindCheckoutEvents() {
  const modal = document.getElementById('checkout-modal');
  const closeBtn = document.getElementById('checkout-close');
  const cancelBtn = document.getElementById('checkout-cancel');

  const closeModal = () => {
    modal?.classList.remove('open');
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('checkout-name') as HTMLInputElement).value;
    const email = (document.getElementById('checkout-email') as HTMLInputElement).value;
    const phone = (document.getElementById('checkout-phone') as HTMLInputElement).value;
    const payment = (document.getElementById('checkout-payment') as HTMLSelectElement).value;

    const checkoutBtn = document.getElementById('checkout-submit-btn') as HTMLButtonElement;
    checkoutBtn.disabled = true;
    checkoutBtn.innerText = 'Procesando...';

    const items = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity
    }));

    try {
      const result = await api.sales.checkout({
        userId: currentUser?.id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        paymentMethod: payment,
        items
      });

      // Compra exitosa
      cart = [];
      localStorage.removeItem('cart');
      closeModal();
      
      // Cargar productos de nuevo para actualizar stock en UI
      await loadProducts();

      // Abrir modal de éxito de factura
      showInvoiceSuccess(result, phone, email);

    } catch (error: any) {
      alert(error.message || 'Error al completar la compra');
      checkoutBtn.disabled = false;
      checkoutBtn.innerText = 'Pagar y Enviar Factura';
    }
  });
}

// ==========================================================================
// COMPONENTE: MODAL DE EXITO Y FACTURACION (WHATSAPP/EMAIL LINKS)
// ==========================================================================

function renderInvoiceSuccessModal(): string {
  return `
    <div class="modal-overlay" id="success-modal">
      <div class="modal-content text-center animate-on-scroll animate-zoom-in visible" style="max-width: 450px;">
        <div class="success-icon">✓</div>
        <h2 class="mb-2" style="font-size:24px; font-weight:700;">¡Compra Realizada!</h2>
        <p style="color:var(--text-secondary); font-size:14px;" class="mb-4">
          La transaccion se proceso correctamente y se ha generado la factura digital.
        </p>

        <div class="success-invoice-box card">
          <div style="font-size: 13px; color:var(--text-secondary); text-transform:uppercase;">Factura</div>
          <div style="font-size: 28px; font-weight:700; color:var(--primary); margin: 6px 0;" id="success-total">$0.00</div>
          <div style="font-size: 12px; color:var(--text-muted);" id="success-id">ID: #000</div>
        </div>

        <div class="invoice-preview-links">
          <!-- WhatsApp Link -->
          <a href="#" target="_blank" class="wa-link" id="success-wa-btn">
            ${icons.whatsapp} Enviar Factura a WhatsApp (Gratis)
          </a>

          <!-- Mailto Email Link -->
          <a href="#" class="btn btn-secondary w-100" id="success-mailto-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; background: rgba(99, 102, 241, 0.1); border-color: var(--primary);">
            ✉️ Enviar Factura a mi Correo (Gratis)
          </a>

          <!-- Email Preview Link -->
          <div id="success-email-box" style="display:none;">
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:6px; margin-top:8px;">
              Previsualizacion de factura (Entorno de desarrollo):
            </p>
            <a href="#" target="_blank" class="btn btn-secondary w-100" id="success-email-btn" style="color:var(--primary); font-weight:600; font-size:12px; padding: 6px 12px;">
              🔍 Ver en Ethereal Mail
            </a>
          </div>
        </div>

        <button class="btn btn-secondary w-100 mt-4" id="success-close-btn">
          Cerrar e Ir a la Tienda
        </button>
      </div>
    </div>
  `;
}

function showInvoiceSuccess(result: any, clientPhone: string, clientEmail?: string) {
  const modal = document.getElementById('success-modal');
  modal?.classList.add('open');

  const totalEl = document.getElementById('success-total');
  const idEl = document.getElementById('success-id');
  const waBtn = document.getElementById('success-wa-btn') as HTMLAnchorElement;
  const mailtoBtn = document.getElementById('success-mailto-btn') as HTMLAnchorElement;
  const emailBox = document.getElementById('success-email-box');
  const emailBtn = document.getElementById('success-email-btn') as HTMLAnchorElement;

  if (totalEl) totalEl.innerText = `$${Number(result.total).toFixed(2)}`;
  if (idEl) idEl.innerText = `ID de Venta: #${result.saleId}`;

  // WhatsApp Link
  const formattedPhone = clientPhone ? clientPhone.replace(/\+/g, '').replace(/\s/g, '') : '';
  waBtn.href = `https://wa.me/${formattedPhone}?text=${result.whatsappText}`;

  // Mailto Email Link
  const decodedText = decodeURIComponent(result.whatsappText);
  if (mailtoBtn) {
    mailtoBtn.href = `mailto:${clientEmail || ''}?subject=${encodeURIComponent('Factura de Compra #' + result.saleId)}&body=${encodeURIComponent(decodedText)}`;
  }

  // Correo de desarrollo preview
  if (result.emailPreviewUrl && result.emailPreviewUrl.includes('ethereal.email')) {
    if (emailBox) emailBox.style.display = 'block';
    if (emailBtn) emailBtn.href = result.emailPreviewUrl;
  } else {
    if (emailBox) emailBox.style.display = 'none';
  }
}

function bindSuccessEvents() {
  document.getElementById('success-close-btn')?.addEventListener('click', () => {
    document.getElementById('success-modal')?.classList.remove('open');
    navigate('store');
  });
}

// ==========================================================================
// VISTA: LOGIN / REGISTRO
// ==========================================================================
let activeAuthTab: 'login' | 'register' = 'login';

function renderAuthView(): string {
  return `
    <div class="auth-container">
      <div class="card auth-card animate-on-scroll animate-zoom-in">
        <div class="auth-tabs">
          <button class="auth-tab-btn ${activeAuthTab === 'login' ? 'active' : ''}" id="tab-login-btn">Iniciar Sesion</button>
          <button class="auth-tab-btn ${activeAuthTab === 'register' ? 'active' : ''}" id="tab-register-btn">Registrarse</button>
        </div>

        ${activeAuthTab === 'login' ? `
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-email">Correo Electronico</label>
              <input type="email" class="form-control" id="login-email" required placeholder="admin@sistema.com o cliente@correo.com">
            </div>
            <div class="form-group">
              <label class="form-label" for="login-password">Contrasena</label>
              <input type="password" class="form-control" id="login-password" required placeholder="••••••••">
            </div>
            <button type="submit" class="btn btn-primary w-100 mt-4" id="login-submit-btn">Ingresar</button>
          </form>
        ` : `
          <form id="register-form">
            <div class="form-group">
              <label class="form-label" for="reg-name">Nombre Completo</label>
              <input type="text" class="form-control" id="reg-name" required placeholder="Ej. Juan Perez">
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-email">Correo Electronico</label>
              <input type="email" class="form-control" id="reg-email" required placeholder="Ej. juan@correo.com">
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-password">Contrasena</label>
              <input type="password" class="form-control" id="reg-password" required minlength="6" placeholder="Minimo 6 caracteres">
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-phone">WhatsApp / Telefono</label>
              <input type="tel" class="form-control" id="reg-phone" placeholder="Ej. +5491122334455">
            </div>
            <button type="submit" class="btn btn-primary w-100 mt-4" id="reg-submit-btn">Crear Cuenta</button>
          </form>
        `}
      </div>
    </div>
  `;
}

function bindAuthEvents() {
  document.getElementById('tab-login-btn')?.addEventListener('click', () => {
    activeAuthTab = 'login';
    renderApp();
  });

  document.getElementById('tab-register-btn')?.addEventListener('click', () => {
    activeAuthTab = 'register';
    renderApp();
  });

  // Evento Login
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const password = (document.getElementById('login-password') as HTMLInputElement).value;

    const btn = document.getElementById('login-submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Cargando...';

    try {
      const res = await api.auth.login({ email, password });
      localStorage.setItem('token', res.token);
      currentUser = res.user;

      if (currentUser.role === 'admin') {
        activeAdminView = 'stats';
        navigate('admin');
      } else {
        navigate('store');
      }
    } catch (error: any) {
      alert(error.message || 'Error en el inicio de sesion');
      btn.disabled = false;
      btn.innerText = 'Ingresar';
    }
  });

  // Evento Registro
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('reg-name') as HTMLInputElement).value;
    const email = (document.getElementById('reg-email') as HTMLInputElement).value;
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;
    const phone = (document.getElementById('reg-phone') as HTMLInputElement).value;

    const btn = document.getElementById('reg-submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Cargando...';

    try {
      const res = await api.auth.register({ name, email, password, phone });
      localStorage.setItem('token', res.token);
      currentUser = res.user;
      navigate('store');
    } catch (error: any) {
      alert(error.message || 'Error en el registro');
      btn.disabled = false;
      btn.innerText = 'Crear Cuenta';
    }
  });
}

// ==========================================================================
// VISTA: PANEL DE ADMINISTRACION (DASHBOARD)
// ==========================================================================
function renderAdminView(): string {
  if (!currentUser || currentUser.role !== 'admin') {
    return `
      <div class="container text-center" style="padding: 100px 0;">
        <h2 style="color:var(--danger)">Acceso Restringido</h2>
        <p class="mb-4">Debes ser administrador para ingresar a esta seccion.</p>
        <button class="btn btn-primary" onclick="navigate('store')">Volver a la Tienda</button>
      </div>
    `;
  }

  return `
    <div class="dashboard-layout">
      <!-- Sidebar de Administracion -->
      <aside class="dashboard-sidebar">
        <button class="sidebar-nav-btn ${activeAdminView === 'stats' ? 'active' : ''}" id="admin-tab-stats">
          ${icons.dashboard} Estadisticas
        </button>
        <button class="sidebar-nav-btn ${activeAdminView === 'pos' ? 'active' : ''}" id="admin-tab-pos">
          ${icons.pos} Punto de Venta (POS)
        </button>
        <button class="sidebar-nav-btn ${activeAdminView === 'products' ? 'active' : ''}" id="admin-tab-products">
          ${icons.products} Catalogo Productos
        </button>
        <button class="sidebar-nav-btn ${activeAdminView === 'sales' ? 'active' : ''}" id="admin-tab-sales">
          ${icons.sales} Historico Ventas
        </button>
      </aside>

      <!-- Panel de Contenido -->
      <section class="dashboard-content" id="dashboard-content-panel">
        <div class="text-center" style="padding:40px;">
          Cargando datos del panel...
        </div>
      </section>
    </div>
  `;
}

async function bindAdminEvents() {
  // Sidebar tabs
  const tabStats = document.getElementById('admin-tab-stats');
  const tabPOS = document.getElementById('admin-tab-pos');
  const tabProducts = document.getElementById('admin-tab-products');
  const tabSales = document.getElementById('admin-tab-sales');

  const clearActiveTabs = () => {
    tabStats?.classList.remove('active');
    tabPOS?.classList.remove('active');
    tabProducts?.classList.remove('active');
    tabSales?.classList.remove('active');
  };

  tabStats?.addEventListener('click', async () => {
    clearActiveTabs();
    tabStats.classList.add('active');
    activeAdminView = 'stats';
    destroyCharts();
    await renderAdminStats();
  });

  tabPOS?.addEventListener('click', async () => {
    clearActiveTabs();
    tabPOS.classList.add('active');
    activeAdminView = 'pos';
    destroyCharts();
    await renderAdminPOS();
  });

  tabProducts?.addEventListener('click', async () => {
    clearActiveTabs();
    tabProducts.classList.add('active');
    activeAdminView = 'products';
    destroyCharts();
    await renderAdminProducts();
  });

  tabSales?.addEventListener('click', async () => {
    clearActiveTabs();
    tabSales.classList.add('active');
    activeAdminView = 'sales';
    destroyCharts();
    await renderAdminSales();
  });

  // Renderizar la subvista por defecto al cargar
  if (activeAdminView === 'stats') {
    await renderAdminStats();
  } else if (activeAdminView === 'pos') {
    await renderAdminPOS();
  } else if (activeAdminView === 'products') {
    await renderAdminProducts();
  } else if (activeAdminView === 'sales') {
    await renderAdminSales();
  }
}

// ==========================================================================
// SUB-VISTA: ESTADÍSTICAS DEL DASHBOARD (CHART.JS)
// ==========================================================================
async function renderAdminStats() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  try {
    const data = await api.stats.getDashboard();

    panel.innerHTML = `
      <div class="animate-on-scroll animate-fade-up visible">
        <h2 class="mb-4" style="font-size:26px; font-weight:800;">Estadisticas de Ventas</h2>

        <!-- Cards Metricas -->
        <div class="metrics-grid stagger-container">
          <div class="card metric-card">
            <div class="metric-header">
              <span>Ingresos Totales</span>
              <span>💰</span>
            </div>
            <div class="metric-value">$${data.metrics.totalRevenue.toFixed(2)}</div>
            <div class="metric-footer">Facturado en total</div>
          </div>
          <div class="card metric-card">
            <div class="metric-header">
              <span>Transacciones</span>
              <span>📦</span>
            </div>
            <div class="metric-value">${data.metrics.totalOrders}</div>
            <div class="metric-footer">Ventas exitosas registradas</div>
          </div>
          <div class="card metric-card">
            <div class="metric-header">
              <span>Ticket Promedio</span>
              <span>📊</span>
            </div>
            <div class="metric-value">$${data.metrics.averageOrderValue.toFixed(2)}</div>
            <div class="metric-footer">Promedio por cliente</div>
          </div>
          <div class="card metric-card" style="${data.metrics.lowStockCount > 0 ? 'border-color: rgba(239, 68, 68, 0.4);' : ''}">
            <div class="metric-header">
              <span>Alertas Stock Bajo</span>
              <span style="color:var(--danger)">⚠</span>
            </div>
            <div class="metric-value" style="${data.metrics.lowStockCount > 0 ? 'color:var(--danger)' : ''}">
              ${data.metrics.lowStockCount}
            </div>
            <div class="metric-footer">Productos con menos de 5 unid.</div>
          </div>
        </div>

        <!-- Graficos -->
        <div class="charts-grid">
          <div class="card chart-card">
            <h3 class="mb-4" style="font-size: 16px; font-weight:700;">Ingresos en los últimos 7 días</h3>
            <canvas id="revenueChart"></canvas>
          </div>
          <div class="card chart-card">
            <h3 class="mb-4" style="font-size: 16px; font-weight:700;">Metodos de Pago</h3>
            <canvas id="paymentChart"></canvas>
          </div>
        </div>

        <!-- Secciones Inferiores (Tablas Rápidas) -->
        <div class="grid-2">
          <!-- Top Productos -->
          <div class="card">
            <h3 class="mb-2" style="font-size: 16px; font-weight:700;">Top 5 Productos Mas Vendidos</h3>
            <div class="table-responsive">
              <table class="table-custom">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th class="text-center">Cantidad</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.topProducts.map(prod => `
                    <tr>
                      <td><strong>${prod.name}</strong></td>
                      <td class="text-center">${prod.total_quantity}</td>
                      <td class="text-right" style="color: var(--primary); font-weight:600;">$${Number(prod.total_revenue).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  ${data.topProducts.length === 0 ? '<tr><td colspan="3" class="text-center">Sin datos de ventas</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Alertas Stock Bajo -->
          <div class="card">
            <h3 class="mb-2" style="font-size: 16px; font-weight:700; color:var(--warning);">Inventario Stock Bajo</h3>
            <div class="table-responsive">
              <table class="table-custom">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoria</th>
                    <th class="text-center">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.lowStockProducts.map(prod => `
                    <tr>
                      <td><strong>${prod.name}</strong></td>
                      <td>${prod.category || 'General'}</td>
                      <td class="text-center" style="color:var(--danger); font-weight:700;">${prod.stock}</td>
                    </tr>
                  `).join('')}
                  ${data.lowStockProducts.length === 0 ? '<tr><td colspan="3" class="text-center" style="color:var(--success)">Todo el inventario esta al dia</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inicializar Gráfico de Ingresos (Línea)
    const ctxRevenue = document.getElementById('revenueChart') as HTMLCanvasElement;
    if (ctxRevenue) {
      const dates = data.dailySales.map(d => d.date);
      const revenues = data.dailySales.map(d => Number(d.revenue));
      
      revenueChartInstance = new Chart(ctxRevenue, {
        type: 'line',
        data: {
          labels: dates.length > 0 ? dates : ['Sin Datos'],
          datasets: [{
            label: 'Ingresos ($)',
            data: revenues.length > 0 ? revenues : [0],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // Inicializar Gráfico de Métodos de Pago (Doughnut)
    const ctxPayment = document.getElementById('paymentChart') as HTMLCanvasElement;
    if (ctxPayment) {
      const methods = data.paymentMethods.map(m => m.payment_method.toUpperCase());
      const counts = data.paymentMethods.map(m => m.count);

      paymentChartInstance = new Chart(ctxPayment, {
        type: 'doughnut',
        data: {
          labels: methods.length > 0 ? methods : ['Efectivo', 'Tarjeta', 'Transferencia'],
          datasets: [{
            data: counts.length > 0 ? counts : [0, 0, 0],
            backgroundColor: ['#10b981', '#6366f1', '#a855f7'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar estadisticas del servidor.</div>`;
  }
}

// ==========================================================================
// SUB-VISTA: PUNTO DE VENTA (POS) - REGISTRO DE VENTAS FÍSICAS
// ==========================================================================
async function renderAdminPOS() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  // Cargar lista completa de productos para el POS
  try {
    const posProducts = await api.products.getAll(undefined, posSearchQuery || undefined);
    const posSubtotal = posCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    panel.innerHTML = `
      <div class="pos-layout animate-on-scroll animate-fade-up visible">
        <!-- Columna de Productos -->
        <div class="pos-products-column">
          <div class="pos-search-bar">
            <input type="text" class="form-control" id="pos-search-input" placeholder="Buscar por nombre..." value="${posSearchQuery}">
          </div>

          <div class="pos-products-grid stagger-container">
            ${posProducts.map(prod => `
              <div class="card pos-product-card add-to-pos-cart" data-id="${prod.id}">
                <img src="${prod.image_url}" alt="${prod.name}">
                <div class="pos-product-name">${prod.name}</div>
                <div style="font-weight:700; color:var(--primary);">$${Number(prod.price).toFixed(2)}</div>
                <div style="font-size:11px; color:var(--text-muted);">Stock: ${prod.stock}</div>
              </div>
            `).join('')}
            ${posProducts.length === 0 ? '<p style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-secondary);">No se encontraron productos.</p>' : ''}
          </div>
        </div>

        <!-- Columna de Carrito POS -->
        <div class="pos-cart-column">
          <h3 style="font-size:18px; font-weight:700;">Venta POS Actual</h3>
          
          <div class="pos-cart-items">
            ${posCart.map(item => `
              <div class="pos-cart-item">
                <div style="flex-grow:1; max-width: 60%;">
                  <div style="font-size:13px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; overflow:hidden;">${item.product.name}</div>
                  <div style="font-size:11px; color:var(--text-secondary);">$${Number(item.product.price).toFixed(2)} c/u</div>
                </div>
                <div class="flex align-center gap-2">
                  <button class="qty-btn dec-pos-qty" data-id="${item.product.id}">${icons.minus}</button>
                  <span style="font-size:13px; font-weight:600;">${item.quantity}</span>
                  <button class="qty-btn inc-pos-qty" data-id="${item.product.id}">${icons.plus}</button>
                </div>
                <div style="font-weight:700; font-size:13px; min-width:60px; text-align:right;">
                  $${(item.product.price * item.quantity).toFixed(2)}
                </div>
              </div>
            `).join('')}
            ${posCart.length === 0 ? `<div style="text-align:center; padding:60px 0; color:var(--text-secondary);">El POS esta vacio. Selecciona productos.</div>` : ''}
          </div>

          <!-- Checkout POS Form -->
          <form id="pos-checkout-form">
            <div class="form-group mb-2">
              <label class="form-label" style="font-size:10px;">Cliente (Opcional)</label>
              <input type="text" class="form-control" id="pos-client-name" style="padding: 8px 12px; font-size:13px;" placeholder="Ej. Consumidor Final" value="Consumidor Final">
            </div>
            <div class="form-group mb-2">
              <label class="form-label" style="font-size:10px;">Correo (Opcional para Factura)</label>
              <input type="email" class="form-control" id="pos-client-email" style="padding: 8px 12px; font-size:13px;" placeholder="Ej. cliente@correo.com">
            </div>
            <div class="form-group mb-2">
              <label class="form-label" style="font-size:10px;">WhatsApp/Telefono (Opcional)</label>
              <input type="tel" class="form-control" id="pos-client-phone" style="padding: 8px 12px; font-size:13px;" placeholder="Ej. +5491122334455">
            </div>
            <div class="form-group mb-4">
              <label class="form-label" style="font-size:10px;">Metodo de Pago</label>
              <select class="form-control" id="pos-client-payment" style="padding: 8px 12px; font-size:13px;">
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>

            <div style="border-top:1px solid var(--border-glass); padding-top:16px; margin-bottom:16px;">
              <div class="flex justify-between" style="font-size:18px; font-weight:700;">
                <span>Total Venta</span>
                <span style="color:var(--primary);">$${posSubtotal.toFixed(2)}</span>
              </div>
            </div>

            <button type="submit" class="btn btn-primary w-100" id="pos-submit-btn" ${posCart.length === 0 ? 'disabled' : ''}>
              Registrar Venta POS
            </button>
          </form>
        </div>
      </div>
    `;

    bindPOSEvents();

  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar POS.</div>`;
  }
}

function bindPOSEvents() {
  // Buscador de productos POS
  let posSearchTimeout: any;
  const searchInput = document.getElementById('pos-search-input') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    posSearchQuery = val;
    clearTimeout(posSearchTimeout);
    posSearchTimeout = setTimeout(async () => {
      await renderAdminPOS();
    }, 450);
  });

  // Agregar al POS Cart
  document.querySelectorAll('.add-to-pos-cart').forEach(card => {
    card.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLDivElement).dataset.id || '0');
      const prod = productsList.find(p => p.id === id);
      if (prod) {
        addToPOSCart(prod);
      }
    });
  });

  // Inc/Dec y Borrar
  document.querySelectorAll('.inc-pos-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      const item = posCart.find(i => i.product.id === id);
      if (item) {
        if (item.quantity >= item.product.stock) {
          alert('Stock maximo alcanzado');
          return;
        }
        item.quantity++;
        renderAdminPOS();
      }
    });
  });

  document.querySelectorAll('.dec-pos-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      const item = posCart.find(i => i.product.id === id);
      if (item) {
        item.quantity--;
        if (item.quantity <= 0) {
          posCart = posCart.filter(i => i.product.id !== id);
        }
        renderAdminPOS();
      }
    });
  });

  // Enviar Venta POS
  document.getElementById('pos-checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('pos-client-name') as HTMLInputElement).value;
    const email = (document.getElementById('pos-client-email') as HTMLInputElement).value;
    const phone = (document.getElementById('pos-client-phone') as HTMLInputElement).value;
    const payment = (document.getElementById('pos-client-payment') as HTMLSelectElement).value;

    const items = posCart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity
    }));

    const btn = document.getElementById('pos-submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Registrando...';

    try {
      const result = await api.sales.checkoutPOS({
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        paymentMethod: payment,
        items
      });

      // Venta exitosa
      posCart = [];
      posSearchQuery = '';
      await loadProducts(); // recargar
      
      // Mostrar modal de éxito
      showInvoiceSuccess(result, phone, email);

      // Renderizar POS de nuevo
      await renderAdminPOS();
    } catch (error: any) {
      alert(error.message || 'Error al registrar venta POS');
      btn.disabled = false;
      btn.innerText = 'Registrar Venta POS';
    }
  });
}

function addToPOSCart(product: Product) {
  const existing = posCart.find(item => item.product.id === product.id);
  if (existing) {
    if (existing.quantity >= product.stock) {
      alert('Stock maximo alcanzado');
      return;
    }
    existing.quantity++;
  } else {
    if (product.stock < 1) {
      alert('Producto agotado');
      return;
    }
    posCart.push({ product, quantity: 1 });
  }
  renderAdminPOS();
}

// ==========================================================================
// SUB-VISTA: CATÁLOGO PRODUCTOS (CRUD)
// ==========================================================================
let editingProductId: number | null = null;

async function renderAdminProducts() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="animate-on-scroll animate-fade-up visible">
      <div class="flex justify-between align-center mb-4">
        <h2 style="font-size:26px; font-weight:800;">Catalogo de Productos</h2>
        <button class="btn btn-primary" id="add-product-btn">
          ${icons.plus} Agregar Producto
        </button>
      </div>

      <!-- Formulario para Crear / Editar (Oculto inicialmente) -->
      <div class="card mb-4" id="product-form-card" style="display:none;">
        <h3 id="product-form-title" class="mb-4" style="font-size:16px; font-weight:700;">Agregar Nuevo Producto</h3>
        <form id="product-form">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="prod-name">Nombre</label>
              <input type="text" class="form-control" id="prod-name" required placeholder="Ej. MacBook Air M3">
            </div>
            <div class="form-group">
              <label class="form-label" for="prod-category">Categoria</label>
              <input type="text" class="form-control" id="prod-category" required placeholder="Ej. Laptops">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="prod-desc">Descripcion</label>
            <textarea class="form-control" id="prod-desc" rows="3" placeholder="Detalle del producto..."></textarea>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="prod-price">Precio ($)</label>
              <input type="number" class="form-control" id="prod-price" required step="0.01" min="0" placeholder="Ej. 1099.00">
            </div>
            <div class="form-group">
              <label class="form-label" for="prod-stock">Stock Inicial</label>
              <input type="number" class="form-control" id="prod-stock" required min="0" placeholder="Ej. 10">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="prod-img">Enlace Imagen (URL)</label>
            <input type="url" class="form-control" id="prod-img" placeholder="https://images.unsplash.com/...">
          </div>

          <div class="flex justify-end gap-4">
            <button type="button" class="btn btn-secondary" id="prod-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="prod-form-submit">Guardar Producto</button>
          </div>
        </form>
      </div>

      <!-- Tabla de Productos -->
      <div class="card">
        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th style="width: 80px;">Imagen</th>
                <th>Nombre</th>
                <th>Categoria</th>
                <th>Precio</th>
                <th class="text-center">Stock</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${productsList.map(prod => `
                <tr>
                  <td>
                    <img src="${prod.image_url}" style="width:48px; height:48px; object-fit:cover; border-radius:8px;" alt="${prod.name}">
                  </td>
                  <td><strong>${prod.name}</strong><br><small style="color:var(--text-secondary); max-width:200px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${prod.description || ''}</small></td>
                  <td>${prod.category || 'General'}</td>
                  <td><strong>$${Number(prod.price).toFixed(2)}</strong></td>
                  <td class="text-center" style="font-weight:600; ${prod.stock < 5 ? 'color:var(--danger)' : ''}">${prod.stock}</td>
                  <td class="text-right">
                    <button class="btn btn-secondary btn-icon edit-prod-btn" style="padding:6px;" data-id="${prod.id}">
                      📝
                    </button>
                    <button class="btn btn-danger btn-icon delete-prod-btn" style="padding:6px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.2); color:var(--danger);" data-id="${prod.id}">
                      ${icons.trash}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  bindProductCRUDEvents();
}

function bindProductCRUDEvents() {
  const formCard = document.getElementById('product-form-card');
  const addBtn = document.getElementById('add-product-btn');
  const cancelBtn = document.getElementById('prod-form-cancel');
  const form = document.getElementById('product-form') as HTMLFormElement;
  const formTitle = document.getElementById('product-form-title');

  addBtn?.addEventListener('click', () => {
    editingProductId = null;
    form.reset();
    if (formTitle) formTitle.innerText = 'Agregar Nuevo Producto';
    if (formCard) formCard.style.display = 'block';
    formCard?.scrollIntoView({ behavior: 'smooth' });
  });

  cancelBtn?.addEventListener('click', () => {
    if (formCard) formCard.style.display = 'none';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('prod-name') as HTMLInputElement).value;
    const category = (document.getElementById('prod-category') as HTMLInputElement).value;
    const description = (document.getElementById('prod-desc') as HTMLTextAreaElement).value;
    const price = parseFloat((document.getElementById('prod-price') as HTMLInputElement).value);
    const stock = parseInt((document.getElementById('prod-stock') as HTMLInputElement).value);
    const image_url = (document.getElementById('prod-img') as HTMLInputElement).value;

    const payload = { name, category, description, price, stock, image_url };

    try {
      if (editingProductId) {
        await api.products.update(editingProductId, payload);
        alert('Producto actualizado con exito');
      } else {
        await api.products.create(payload);
        alert('Producto creado con exito');
      }

      if (formCard) formCard.style.display = 'none';
      await loadProducts();
      await renderAdminProducts();
    } catch (err: any) {
      alert(err.message || 'Error al guardar producto');
    }
  });

  // Evento Editar
  document.querySelectorAll('.edit-prod-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      const prod = productsList.find(p => p.id === id);
      if (prod) {
        editingProductId = prod.id;
        if (formTitle) formTitle.innerText = `Editar Producto: ${prod.name}`;

        (document.getElementById('prod-name') as HTMLInputElement).value = prod.name;
        (document.getElementById('prod-category') as HTMLInputElement).value = prod.category || '';
        (document.getElementById('prod-desc') as HTMLTextAreaElement).value = prod.description || '';
        (document.getElementById('prod-price') as HTMLInputElement).value = prod.price.toString();
        (document.getElementById('prod-stock') as HTMLInputElement).value = prod.stock.toString();
        (document.getElementById('prod-img') as HTMLInputElement).value = prod.image_url || '';

        if (formCard) formCard.style.display = 'block';
        formCard?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Evento Eliminar
  document.querySelectorAll('.delete-prod-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      if (confirm('¿Estas seguro de eliminar este producto? Se eliminara permanentemente.')) {
        try {
          await api.products.delete(id);
          await loadProducts();
          await renderAdminProducts();
        } catch (err: any) {
          alert(err.message || 'Error al eliminar');
        }
      }
    });
  });
}

// ==========================================================================
// SUB-VISTA: HISTORIAL DE VENTAS
// ==========================================================================
async function renderAdminSales() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  try {
    const sales = await api.sales.getAllAdmin();

    panel.innerHTML = `
      <div class="animate-on-scroll animate-fade-up visible">
        <h2 class="mb-4" style="font-size:26px; font-weight:800;">Historico de Ventas</h2>
        
        <div class="card">
          <div class="table-responsive">
            <table class="table-custom">
              <thead>
                <tr>
                  <th>No. Factura</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Metodo Pago</th>
                  <th>Total</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${sales.map(sale => `
                  <tr>
                    <td><strong>#${sale.id}</strong></td>
                    <td>
                      <strong>${sale.customer_name}</strong>
                      ${sale.customer_phone ? `<br><small style="color:var(--text-secondary)">📱 ${sale.customer_phone}</small>` : ''}
                    </td>
                    <td>${new Date(sale.created_at).toLocaleString('es-ES')}</td>
                    <td><span class="badge-status" style="background:rgba(255,255,255,0.05); color:white;">${sale.type.toUpperCase()}</span></td>
                    <td><span style="text-transform:uppercase; font-size:12px; font-weight:600;">${sale.payment_method}</span></td>
                    <td><strong style="color:var(--primary); font-size:15px;">$${Number(sale.total).toFixed(2)}</strong></td>
                    <td class="text-right">
                      <button class="btn btn-secondary btn-icon view-sale-details" style="padding:6px 12px; border-radius:6px; font-size:12px;" data-id="${sale.id}">
                        🔍 Detalles
                      </button>
                    </td>
                  </tr>
                `).join('')}
                ${sales.length === 0 ? '<tr><td colspan="7" class="text-center">No se han registrado ventas aun.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindSalesHistoryEvents();

  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar historial del servidor.</div>`;
  }
}

function bindSalesHistoryEvents() {
  document.querySelectorAll('.view-sale-details').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      try {
        const details = await api.sales.getDetails(id);
        showSaleDetails(details);
      } catch (err: any) {
        alert(err.message || 'Error al obtener detalles de la venta');
      }
    });
  });
}

// ==========================================================================
// COMPONENTE: MODAL DETALLE DE UNA VENTA ESPECÍFICA
// ==========================================================================
function renderSaleDetailModal(): string {
  return `
    <div class="modal-overlay" id="sale-detail-modal">
      <div class="modal-content animate-on-scroll animate-zoom-in visible" style="max-width: 600px;">
        <button class="modal-close" id="sale-detail-close">&times;</button>
        <h2 class="mb-2" style="font-size:22px; font-weight:700;" id="detail-header-id">Detalle de Factura #000</h2>
        <p style="color:var(--text-secondary); font-size:12px;" class="mb-4" id="detail-date">Fecha: --/--/---- --:--:--</p>

        <div class="card mb-4" style="padding:16px;">
          <div class="grid-2" style="font-size:13px; line-height:1.6;">
            <div>
              <div style="color:var(--text-muted); font-size:11px; text-transform:uppercase;">Facturado a:</div>
              <strong id="detail-client-name">Cliente General</strong>
              <div id="detail-client-phone">--</div>
              <div id="detail-client-email">--</div>
            </div>
            <div>
              <div style="color:var(--text-muted); font-size:11px; text-transform:uppercase;">Detalles de Transaccion:</div>
              <div>Tipo: <strong id="detail-type">--</strong></div>
              <div>Metodo Pago: <strong id="detail-payment" style="text-transform:uppercase;">--</strong></div>
            </div>
          </div>
        </div>

        <h3 class="mb-2" style="font-size:14px; font-weight:700; text-transform:uppercase;">Productos</h3>
        <div class="table-responsive mb-4">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Producto</th>
                <th class="text-center">Cant.</th>
                <th class="text-right">Precio Un.</th>
                <th class="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody id="detail-items-rows">
              <!-- Creados dinamicamente -->
            </tbody>
          </table>
        </div>

        <div class="flex justify-between align-center" style="border-top:1px solid var(--border-glass); padding-top:16px;">
          <div>
            <!-- Re-envio WhatsApp -->
            <a href="#" target="_blank" class="wa-link" id="detail-wa-btn" style="padding: 8px 12px; font-size:13px;">
              ${icons.whatsapp} Enviar por WhatsApp
            </a>
          </div>
          <div class="text-right">
            <div style="font-size:12px; color:var(--text-muted);">TOTAL FACTURADO</div>
            <strong style="font-size:24px; color:var(--primary);" id="detail-total-value">$0.00</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

function showSaleDetails(details: SaleDetail) {
  const modal = document.getElementById('sale-detail-modal');
  modal?.classList.add('open');

  const { sale, items } = details;

  const headerId = document.getElementById('detail-header-id');
  const dateEl = document.getElementById('detail-date');
  const clientName = document.getElementById('detail-client-name');
  const clientPhone = document.getElementById('detail-client-phone');
  const clientEmail = document.getElementById('detail-client-email');
  const typeEl = document.getElementById('detail-type');
  const paymentEl = document.getElementById('detail-payment');
  const totalVal = document.getElementById('detail-total-value');
  const tableBody = document.getElementById('detail-items-rows');
  const waBtn = document.getElementById('detail-wa-btn') as HTMLAnchorElement;

  if (headerId) headerId.innerText = `Detalle de Factura #${sale.id}`;
  if (dateEl) dateEl.innerText = `Fecha: ${new Date(sale.created_at).toLocaleString('es-ES')}`;
  if (clientName) clientName.innerText = sale.customer_name || 'Consumidor Final';
  if (clientPhone) clientPhone.innerText = sale.customer_phone ? `Tel: ${sale.customer_phone}` : '';
  if (clientEmail) clientEmail.innerText = sale.customer_email ? `Email: ${sale.customer_email}` : '';
  if (typeEl) typeEl.innerText = sale.type.toUpperCase();
  if (paymentEl) paymentEl.innerText = sale.payment_method;
  if (totalVal) totalVal.innerText = `$${Number(sale.total).toFixed(2)}`;

  // Elementos
  if (tableBody) {
    tableBody.innerHTML = items.map(item => `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-right">$${Number(item.price).toFixed(2)}</td>
        <td class="text-right" style="font-weight:600;">$${(Number(item.price) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  // Enlace a WhatsApp (Re-envío)
  // Generar texto para whatsapp
  let waText = `*📄 FACTURA DE COMPRA #${sale.id}*\n`;
  waText += `-------------------------------------\n`;
  waText += `*Cliente:* ${sale.customer_name}\n`;
  waText += `*Fecha:* ${new Date(sale.created_at).toLocaleString('es-ES')}\n`;
  waText += `*Metodo de Pago:* ${sale.payment_method.toUpperCase()}\n`;
  waText += `*Tipo:* ${sale.type.toUpperCase()}\n`;
  waText += `-------------------------------------\n`;
  waText += `*Detalle de Productos:*\n`;
  items.forEach(item => {
    const itemTotal = (Number(item.price) * item.quantity).toFixed(2);
    waText += `- ${item.name} x${item.quantity} ($${Number(item.price).toFixed(2)}) = *$${itemTotal}*\n`;
  });
  waText += `-------------------------------------\n`;
  waText += `*TOTAL NETO:* *$${Number(sale.total).toFixed(2)}*\n\n`;
  waText += `¡Gracias por preferirnos!`;

  const phoneNum = sale.customer_phone ? sale.customer_phone.replace(/\+/g, '').replace(/\s/g, '') : '';
  waBtn.href = `https://wa.me/${phoneNum}?text=${encodeURIComponent(waText)}`;
}

function bindSaleDetailEvents() {
  const modal = document.getElementById('sale-detail-modal');
  const closeBtn = document.getElementById('sale-detail-close');
  closeBtn?.addEventListener('click', () => {
    modal?.classList.remove('open');
  });
}
