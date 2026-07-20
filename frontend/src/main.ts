import { Chart, registerables } from 'chart.js';
import { api } from './utils/api';
import type { Product, User, SaleDetail, AuditLog, Sale } from './utils/api';
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
type AdminSubView = 'stats' | 'pos' | 'products' | 'sales' | 'debtors' | 'quotations' | 'coupons' | 'staff' | 'expenses' | 'customers';
let activeAdminView: AdminSubView = 'stats';

// Nuevas variables de estado para el control en POS
let posCustomersList: User[] = [];
let posSelectedCustomerId: number | null = null;
let posDiscount = 0;
let posApplyTax = true;
let posCouponCode = '';
let posCouponDiscountPercent = 0;
let posIsPending = false;
let posInitialPayment = 0;
let posLoadedQuotationId: number | null = null;
let posClientIdentified = false;
let posCustomerName = 'Consumidor Final';
let posCustomerCi = '';
let posCustomerEmail = '';
let posCustomerPhone = '';
let rateUsdToVes = 40.00;
let rateEurToVes = 43.50;
let rateBinanceToVes = 44.50;
let posConfirmedUnregisteredWarning = false;
let showFreeSaleModal = false;
let showExpenseModal = false;
let showRegisterCustomerModal = false;
let adminCustomerSearchQuery = '';

interface POSPaymentLine {
  id: number;
  method: string;
  amountUsd: number;
  amountVes?: number;
}

let posPaymentLines: POSPaymentLine[] = [
  { id: 1, method: 'efectivo_usd', amountUsd: 0 }
];

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
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.166.001 6.141 1.233 8.377 3.469 2.235 2.237 3.466 5.214 3.466 8.384-.003 6.536-5.328 11.86-11.859 11.86-1.996-.001-3.956-.508-5.7-1.472L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.277 0 9.585-4.293 9.588-9.569a9.54 9.54 0 0 0-2.8-6.78A9.52 9.52 0 0 0 11.86 1.62c-5.278 0-9.587 4.293-9.59 9.57a9.508 9.508 0 0 0 1.488 4.787l-.98 3.585 3.679-.963zm12.33-4.996c-.3-.15-1.77-.875-2.046-.975-.276-.1-.477-.15-.677.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-.3-.15-1.265-.467-2.41-1.485-.89-.792-1.49-1.77-1.665-2.07-.175-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5s.05-.375-.025-.525c-.075-.15-.677-1.63-.927-2.23-.243-.586-.492-.507-.677-.517-.174-.01-.375-.012-.576-.012-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.11 3.22 5.11 4.52.714.31 1.27.495 1.7.63.717.227 1.37.195 1.885.118.575-.085 1.77-.725 2.02-1.39.25-.665.25-1.23.175-1.39-.075-.16-.275-.26-.575-.41z"/></svg>`,
  menu: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`
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

  // Cargar tasas de cambio
  try {
    const rates = await api.sales.getExchangeRates();
    rateUsdToVes = rates.usdToVes;
    rateEurToVes = rates.eurToVes;
    rateBinanceToVes = rates.binanceUsdToVes || (rates.usdToVes * 1.08);
  } catch (e) {
    console.error('Error al cargar tasas de cambio en el arranque:', e);
  }

  // Si hay un usuario logueado que sea administrador o vendedor, ir directamente al panel de control
  if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'seller')) {
    activeAdminView = 'stats';
    navigate('admin');
  } else {
    navigate('store');
  }
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
      ${currentView === 'admin' ? renderAdminDashboard() : ''}
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
    <div class="exchange-rate-banner" style="background: rgba(16,185,129,0.06); border-bottom: 1px solid var(--border-glass); padding: 6px 0; font-size: 11px; font-weight: 600; text-align: center; color: var(--success); display: flex; justify-content: center; gap: 16px; align-items:center;">
      <span>💵 Tasa Oficial (BCV):</span>
      <span>Dólar $: <strong>Bs. ${rateUsdToVes.toFixed(2)}</strong></span>
      <span style="color:var(--text-muted);">|</span>
      <span>Euro €: <strong>Bs. ${rateEurToVes.toFixed(2)}</strong></span>
    </div>
    <nav class="navbar">
      <div class="container navbar-container">
        <a class="logo" href="#" id="nav-logo" style="display:flex; align-items:center; gap:8px;">
          <img src="/logofacilito.png" style="height:36px; width:36px; object-fit:contain; border-radius:50%; background:rgba(255,255,255,0.1); padding:2px;" class="animate-float" alt="FacilitoApp Logo">
          <span style="font-weight:900; letter-spacing:-0.5px;">FacilitoApp</span>
        </a>
        
        <!-- Botón Toggle Menú Hamburguesa Móvil -->
        <button id="nav-toggle-btn" class="nav-toggle-btn" aria-label="Abrir menú de navegación" style="display:none;">
          ${icons.menu}
        </button>

        <div class="nav-links" id="nav-links-menu">
          <a class="nav-link ${currentView === 'store' ? 'active' : ''}" id="link-store">Tienda</a>
          
          ${currentUser ? `
            ${(currentUser.role === 'admin' || currentUser.role === 'seller') ? `
              <a class="nav-link ${currentView === 'admin' ? 'active' : ''}" id="link-admin">
                <span style="display:inline-flex; align-items:center; gap:4px;">${icons.dashboard} ${currentUser.role === 'admin' ? 'Panel Admin' : 'Caja POS'}</span>
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
        <p>&copy; ${new Date().getFullYear()} FacilitoApp 🐒. La forma más fácil de gestionar tu negocio. ¡Tan fácil que hasta un monito puede usarlo! 💻📱</p>
      </div>
    </footer>
  `;
}

// ==========================================================================
// SECCIÓN DE EVENTOS COMUNES
// ==========================================================================
function bindGeneralEvents() {
  // Menú Hamburguesa Toggle en móvil
  document.getElementById('nav-toggle-btn')?.addEventListener('click', () => {
    document.getElementById('nav-links-menu')?.classList.toggle('open');
  });

  // Cerrar menú móvil al hacer clic en cualquier enlace
  document.querySelectorAll('#nav-links-menu .nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('nav-links-menu')?.classList.remove('open');
    });
  });

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
          ${isLowStock ? `<span class="product-badge danger">¡Pocos 🐒!</span>` : ''}
          ${prod.code ? `<span class="product-badge info">${prod.code}</span>` : ''}
        </div>
        <div class="product-info">
          <div class="product-category">${prod.category || 'General'}</div>
          <h3 class="product-title">${prod.name}</h3>
          <p class="product-description">${prod.description || 'Sin descripcion.'}</p>
          <div class="product-footer">
            <div>
              <div class="product-price">$${Number(prod.price).toFixed(2)}</div>
              <div class="product-stock ${isLowStock ? 'low-stock' : ''}">
                ${isLowStock ? `¡Solo ${prod.stock} disp.!` : `Stock: ${prod.stock}`}
              </div>
            </div>
            <button class="btn btn-primary add-to-cart-btn" data-id="${prod.id}" style="padding: 8px 14px; border-radius: 50px; font-size: 12px; font-weight:700; display:flex; align-items:center; gap:6px;">
              ${icons.plus} Agregar
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="hero-section animate-on-scroll animate-zoom-in" style="position:relative; overflow:hidden; padding: 60px 0; background: linear-gradient(135deg, rgba(255,122,0,0.1) 0%, rgba(139,92,246,0.1) 100%); border-radius: var(--radius-lg); border: 1px solid var(--border-glass); margin-bottom: 30px;">
      <div class="container" style="display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap-reverse;">
        <div style="flex: 1; min-width: 300px;">
          <h1 class="hero-title" style="font-size: 38px; line-height: 1.1; margin-bottom: 12px; font-weight:900; text-align:left;">
            ¡Todo es más fácil en <span style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">FacilitoApp</span>! 🐒
          </h1>
          <p class="hero-subtitle" style="font-size: 15px; color: var(--text-secondary); max-width: 550px; margin-bottom: 20px; text-align:left;">
            Tu solución inteligente para compras en línea y punto de venta. Tan rápido, interactivo y automático... ¡que hasta nuestra mascota sabe usarlo! 💻📱
          </p>
          <div style="display:flex; gap:12px;">
            <span class="badge" style="background: rgba(255,122,0,0.15); color: var(--primary); padding: 6px 12px; border-radius: 50px; font-weight:700; font-size:11px; border: 1px solid rgba(255,122,0,0.25);">🐒 Rápido</span>
            <span class="badge" style="background: rgba(139,92,246,0.15); color: var(--secondary); padding: 6px 12px; border-radius: 50px; font-weight:700; font-size:11px; border: 1px solid rgba(139,92,246,0.25);">💻 Automático</span>
            <span class="badge" style="background: rgba(6,182,212,0.15); color: var(--accent); padding: 6px 12px; border-radius: 50px; font-weight:700; font-size:11px; border: 1px solid rgba(6,182,212,0.25);">📱 Divertido</span>
          </div>
        </div>
        <div style="flex: 0 0 auto; margin: 0 auto; display:flex; justify-content:center; align-items:center;" class="animate-float">
          <div style="position:relative; width: 130px; height: 130px; border-radius: 50%; background: radial-gradient(circle, rgba(255,122,0,0.2) 0%, transparent 70%); display:flex; justify-content:center; align-items:center;">
            <img src="/logofacilito.png" style="width:110px; height:110px; object-fit:contain; border-radius: 50%; border: 3px solid var(--primary); box-shadow: 0 8px 24px rgba(255,122,0,0.3); background: var(--bg-secondary);" alt="Mascota FacilitoApp">
            <span style="position:absolute; bottom:-5px; right:-5px; font-size:24px;">👋</span>
          </div>
        </div>
      </div>
    </section>

    <div class="container store-container" style="display:flex; flex-direction:column; gap:24px;">
      <!-- Barra de Filtros Horizontal Superior (Modern E-Commerce Layout) -->
      <div class="store-filter-bar card" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 24px; position: sticky; top: 75px; z-index: 10; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); background: rgba(18,24,39,0.85); border-radius: var(--radius-md); border: 1px solid var(--border-glass);">
        <!-- Buscador Elegante -->
        <div style="position: relative; flex: 1; min-width: 240px; max-width: 320px;">
          <input type="text" class="form-control" id="store-search" placeholder="🔍 Buscar productos..." value="${searchQuery}" style="padding-left: 14px; border-radius: 50px; background: rgba(255,255,255,0.03);">
        </div>
        
        <!-- Categorías Horizontales -->
        <div class="categories-container" style="display: flex; gap: 8px; overflow-x: auto; max-width: 100%; white-space: nowrap; padding-bottom: 2px; -webkit-overflow-scrolling: touch; border: none; background: transparent;">
          ${categories.map(cat => `
            <button class="filter-category-btn ${selectedCategory === (cat === 'Todas' ? '' : cat) ? 'active' : ''}" data-category="${cat === 'Todas' ? '' : cat}" style="padding: 8px 16px; border-radius: 50px; font-size: 13px; font-weight: 600; border: 1px solid var(--border-glass); background: ${selectedCategory === (cat === 'Todas' ? '' : cat) ? 'var(--primary)' : 'rgba(255,255,255,0.02)'}; color: ${selectedCategory === (cat === 'Todas' ? '' : cat) ? '#000' : 'var(--text-secondary)'}; transition: all 0.3s ease; cursor:pointer;">
              ${cat}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Grid de Productos (Ancho Completo) -->
      <section style="width: 100%;">
        <div class="products-grid stagger-container">
          ${productsHtml.length > 0 ? productsHtml : `
            <div class="card text-center" style="grid-column: 1 / -1; padding: 60px; text-align: center; color: var(--text-secondary);">
              <span style="font-size: 48px; display:block; margin-bottom:12px;">🐒🔍</span>
              No se encontraron productos en esta categoría.
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
      const ciPrefixInput = document.getElementById('checkout-ci-prefix') as HTMLSelectElement;
      const ciNumInput = document.getElementById('checkout-ci-num') as HTMLInputElement;

      if (nameInput) nameInput.value = currentUser.name;
      if (emailInput) emailInput.value = currentUser.email;
      if (phoneInput) phoneInput.value = currentUser.phone || '';
      if (currentUser.ci) {
        const parts = currentUser.ci.split('-');
        if (parts.length === 2) {
          if (ciPrefixInput) ciPrefixInput.value = `${parts[0]}-`;
          if (ciNumInput) ciNumInput.value = parts[1];
        } else if (ciNumInput) {
          ciNumInput.value = currentUser.ci;
        }
      }
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
          <div class="form-group mb-3">
            <label class="form-label" for="checkout-name">Nombre Completo</label>
            <input type="text" class="form-control" id="checkout-name" required placeholder="Ej. Juan Perez">
          </div>
          <div class="form-group mb-3">
            <label class="form-label" for="checkout-ci-num">Cédula / Documento de Identidad</label>
            <div style="display: flex; gap: 8px;">
              <select class="form-control" id="checkout-ci-prefix" style="width: 80px; font-weight: 700; flex-shrink: 0;">
                <option value="V-">V-</option>
                <option value="E-">E-</option>
                <option value="J-">J-</option>
                <option value="G-">G-</option>
              </select>
              <input type="text" class="form-control" id="checkout-ci-num" required placeholder="12345678" pattern="\\d{5,10}" title="Ingrese de 5 a 10 dígitos numéricos" style="flex-grow: 1;">
            </div>
          </div>
          <div class="form-group mb-3">
            <label class="form-label" for="checkout-email">Correo Electronico</label>
            <input type="email" class="form-control" id="checkout-email" required placeholder="Ej. juan@correo.com">
            <small style="color:var(--text-muted); font-size:11px;">Recibiras tu factura en este correo.</small>
          </div>
          <div class="form-group mb-3">
            <label class="form-label" for="checkout-phone">WhatsApp / Telefono</label>
            <input type="tel" class="form-control" id="checkout-phone" placeholder="Ej. +5491122334455">
            <small style="color:var(--text-muted); font-size:11px;">Codigo de pais incluido (ej. +54 o +57).</small>
          </div>
          <div class="form-group">
            <label class="form-label">Método de Pago</label>
            <select class="form-control" id="checkout-payment" required>
              <option value="pago_movil">📱 Pago Móvil (Bs.)</option>
              <option value="zelle">💸 Zelle ($)</option>
              <option value="transferencia_ves">🏢 Transferencia Bancaria (Bs.)</option>
              <option value="binance">🔶 Binance Pay</option>
              <option value="paypal">🅿️ PayPal ($)</option>
            </select>
          </div>

          <!-- Resumen de Pago Multimoneda -->
          <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; margin-bottom: 16px; border: 1px dashed var(--border-glass); font-size:13px;">
            <div class="flex justify-between" style="font-weight:700;">
              <span>Total Compra (USD)</span>
              <span style="color:var(--primary); font-size:16px;">$${cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toFixed(2)}</span>
            </div>
            <div class="flex justify-between mt-1" style="font-weight:600; color: #f59e0b;">
              <span>Equivalente en Bolívares (Bs.)</span>
              <span>Bs. ${(cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0) * rateUsdToVes).toFixed(2)}</span>
            </div>
            <small style="color: var(--text-muted); font-size:10px; display:block; margin-top:6px; line-height:1.2;">
              * Tasa oficial de cambio (BCV): 1 USD = Bs. ${rateUsdToVes.toFixed(2)}. Si aplicas un cupón de descuento, el descuento se calculará sobre el total de tu factura.
            </small>
          </div>
          
          <div class="form-group mb-4">
            <label class="form-label" for="checkout-coupon">Cupón de Descuento (Opcional)</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" class="form-control" id="checkout-coupon" placeholder="Ej. DESCUENTO10" style="text-transform: uppercase;">
              <button type="button" class="btn btn-secondary" id="checkout-apply-coupon" style="padding: 0 16px; font-size: 13px;">Aplicar</button>
            </div>
            <div id="checkout-coupon-status" style="margin-top: 4px; font-size: 11px;"></div>
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

  let checkoutCouponPercent = 0;
  let checkoutCouponCode = '';

  const closeModal = () => {
    modal?.classList.remove('open');
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  // Botón para aplicar cupón
  const applyCouponBtn = document.getElementById('checkout-apply-coupon');
  const couponInput = document.getElementById('checkout-coupon') as HTMLInputElement;
  const couponStatus = document.getElementById('checkout-coupon-status');

  applyCouponBtn?.addEventListener('click', async () => {
    const code = couponInput.value.trim();
    if (!code) {
      if (couponStatus) {
        couponStatus.style.color = 'var(--danger)';
        couponStatus.innerText = 'Ingrese un código de cupón';
      }
      return;
    }
    try {
      const coupon = await api.sales.validateCoupon(code, currentUser?.id);
      checkoutCouponPercent = Number(coupon.discount_percent);
      checkoutCouponCode = coupon.code;
      if (couponStatus) {
        couponStatus.style.color = 'var(--success)';
        couponStatus.innerText = `¡Cupón ${coupon.code} aplicado! (${coupon.discount_percent}% de descuento)`;
      }
    } catch (err: any) {
      checkoutCouponPercent = 0;
      checkoutCouponCode = '';
      if (couponStatus) {
        couponStatus.style.color = 'var(--danger)';
        couponStatus.innerText = err.message || 'Cupón inválido o inactivo';
      }
    }
  });

  document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('checkout-name') as HTMLInputElement).value;
    const email = (document.getElementById('checkout-email') as HTMLInputElement).value;
    const phone = (document.getElementById('checkout-phone') as HTMLInputElement).value;
    const ciPrefix = (document.getElementById('checkout-ci-prefix') as HTMLSelectElement).value;
    const ciNum = (document.getElementById('checkout-ci-num') as HTMLInputElement).value.trim();
    const customerCi = ciNum ? `${ciPrefix}${ciNum}` : undefined;
    const payment = (document.getElementById('checkout-payment') as HTMLSelectElement).value;

    const checkoutBtn = document.getElementById('checkout-submit-btn') as HTMLButtonElement;
    checkoutBtn.disabled = true;
    checkoutBtn.innerText = 'Procesando...';

    const items = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity
    }));

    // Calcular descuento
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const discount = subtotal * (checkoutCouponPercent / 100);

    try {
      const result = await api.sales.checkout({
        userId: currentUser?.id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerCi,
        paymentMethod: payment,
        items,
        discount,
        tax: 0,
        couponCode: checkoutCouponCode || undefined
      });

      // Compra exitosa
      cart = [];
      localStorage.removeItem('cart');
      closeModal();
      
      // Cargar productos de nuevo para actualizar stock en UI
      await loadProducts();

      // Abrir modal de éxito de factura (pasando lista de items)
      const itemsFormatted = items.map(item => {
        const prod = productsList.find(p => p.id === item.productId);
        return { name: prod ? prod.name : 'Producto', quantity: item.quantity, price: prod ? prod.price : 0 };
      });
      showInvoiceSuccess(result, phone, email, itemsFormatted);

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

        <!-- Factura PNG Vista Previa e Interacciones -->
        <div style="margin: 16px 0; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">Comprobante Digital (PNG)</div>
          <div id="success-png-container" style="width: 100%; max-height: 220px; overflow-y: auto; border: 1px solid var(--border-glass); border-radius: var(--radius-md); background: #0f172a; padding: 8px; display:flex; align-items:center; justify-content:center;">
            <p style="color: var(--text-muted); font-size: 11px; padding: 20px;">Generando imagen PNG de la factura...</p>
          </div>
          <div class="flex gap-2 w-100" style="margin-top: 4px;">
            <button type="button" class="btn btn-secondary w-100" id="success-copy-png-btn" style="font-size: 12px; font-weight:600; padding: 8px; display:flex; align-items:center; justify-content:center; gap:6px;">
              📋 Copiar PNG
            </button>
            <a href="#" class="btn btn-secondary w-100" id="success-download-png-btn" style="font-size: 12px; font-weight:600; padding: 8px; display:flex; align-items:center; justify-content:center; gap:6px; text-decoration:none; color:inherit;">
              📥 Descargar
            </a>
          </div>
        </div>

        <div class="invoice-preview-links">
          <!-- WhatsApp Link -->
          <a href="#" target="_blank" class="wa-link" id="success-wa-btn">
            ${icons.whatsapp} Enviar a WhatsApp (Pega la Imagen)
          </a>

          <!-- Estado de Envío de Correo Automático -->
          <div id="success-email-status-box" style="display: none; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: var(--radius-md); background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); color: var(--success); font-weight: 600; font-size: 13px; margin-top: 8px;">
            ✉️ Factura enviada automáticamente al correo
          </div>

          <!-- Enviar/Reenviar por Correo Electrónico Manual -->
          <button class="btn btn-secondary w-100" id="success-manual-email-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; margin-top: 8px;">
            ✉️ Enviar por Correo Electrónico
          </button>

          <!-- Copiar al Portapapeles (Texto Fallback) -->
          <button class="btn btn-secondary w-100" id="success-copy-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; margin-top: 8px;">
            📄 Copiar Factura en Texto
          </button>

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

function generateReceiptPNG(sale: any, items: any[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Cargar la imagen del logotipo
    const logoImg = new Image();
    logoImg.src = '/logofacilito.png';

    const onLogoLoaded = (loaded: boolean) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No se pudo inicializar canvas');

      const width = 450;
      const rowHeight = 30;
      const headerHeight = loaded ? 200 : 130;
      const clientHeight = 110;
      const footerHeight = 100;
      const itemsHeight = items.length * rowHeight;
      
      const discountVal = Number(sale.discount || 0);
      const taxVal = Number(sale.tax || 0);
      let extraHeight = 0;
      if (discountVal > 0) extraHeight += 18;
      if (taxVal > 0) extraHeight += 18;
      
      const height = headerHeight + clientHeight + itemsHeight + 100 + footerHeight + extraHeight + 40;

      canvas.width = width;
      canvas.height = height;

      // Pintar fondo oscuro elegante
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, width, height);

      // Borde brillante de estilo glassmorphism
      ctx.strokeStyle = '#ff7a00'; // naranja
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, width - 4, height - 4);

      let textY = 45;

      // Dibujar Logo si se cargó con éxito
      if (loaded) {
        try {
          ctx.drawImage(logoImg, width / 2 - 30, 20, 60, 60);
          textY = 110;
        } catch (e) {
          console.error('Error dibujando el logo en la factura:', e);
        }
      }

      // Dibujar Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Outfit, Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(sale.is_quotation === 1 ? 'COTIZACIÓN AL MAYOR' : 'COMPROBANTE DE COMPRA', width / 2, textY);

      ctx.fillStyle = '#ff7a00';
      ctx.font = 'bold 15px Outfit, Segoe UI';
      ctx.fillText('FACILITOAPP 🐒', width / 2, textY + 25);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px Outfit, Segoe UI';
      ctx.fillText(`${sale.is_quotation === 1 ? 'Cotización' : 'Factura'}: #${sale.id}`, width / 2, textY + 50);
      ctx.fillText(`Fecha: ${new Date(sale.created_at || new Date()).toLocaleString('es-ES')}`, width / 2, textY + 70);

      // Dibujar Línea divisoria
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, headerHeight + 5);
      ctx.lineTo(width - 30, headerHeight + 5);
      ctx.stroke();

      // Dibujar Datos del Cliente
      let yOffset = headerHeight + 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Outfit, Segoe UI';
      ctx.fillText(sale.is_quotation === 1 ? 'COTIZADO A:' : 'FACTURADO A:', 30, yOffset);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Outfit, Segoe UI';
      ctx.fillText(sale.customer_name || 'Cliente General', 30, yOffset + 20);

      ctx.font = '12px Outfit, Segoe UI';
      ctx.fillStyle = '#e2e8f0';
      let nextY = yOffset + 40;
      if (sale.customer_ci) {
        ctx.fillText(`C.I. / RIF: ${sale.customer_ci}`, 30, nextY);
        nextY += 20;
      }
      if (sale.customer_phone) {
        ctx.fillText(`Tel: ${sale.customer_phone}`, 30, nextY);
        nextY += 20;
      }
      if (sale.customer_email) {
        ctx.fillText(`Email: ${sale.customer_email}`, 30, nextY);
        nextY += 20;
      }

      // Datos del pago (derecha)
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Outfit, Segoe UI';
      ctx.fillText(sale.is_quotation === 1 ? 'DETALLES COTIZACIÓN:' : 'DETALLES DE PAGO:', width - 30, yOffset);

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Outfit, Segoe UI';
      ctx.fillText(`Metodo: ${sale.payment_method.toUpperCase()}`, width - 30, yOffset + 20);
      ctx.fillText(`Tipo: ${sale.is_quotation === 1 ? 'COTIZACIÓN' : sale.type.toUpperCase()}`, width - 30, yOffset + 40);
      ctx.fillText(`Cajero: ${sale.seller_name || 'Online'}`, width - 30, yOffset + 60);

      // Divisor
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(30, nextY + 10);
      ctx.lineTo(width - 30, nextY + 10);
      ctx.stroke();

      // Tabla de ítems
      let y = nextY + 35;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px Outfit, Segoe UI';
      ctx.fillText('PRODUCTO', 30, y);
      ctx.textAlign = 'center';
      ctx.fillText('CANT', 250, y);
      ctx.textAlign = 'right';
      ctx.fillText('TOTAL', width - 30, y);

      y += 15;
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();

      y += 20;
      ctx.font = '12px Outfit, Segoe UI';
      items.forEach(item => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        
        // Cortar nombre si es muy largo
        let name = item.name;
        if (name.length > 25) name = name.substring(0, 22) + '...';
        ctx.fillText(name, 30, y);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(item.quantity.toString(), 250, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`$${(Number(item.price) * item.quantity).toFixed(2)}`, width - 30, y);

        y += rowHeight;
      });

      // Divisor de Totales
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();

      // Cálculos de desglose
      const subtotalVal = Number(sale.total) - taxVal + discountVal;

      y += 15;
      ctx.font = '11px Outfit, Segoe UI';
      ctx.fillStyle = '#94a3b8';
      
      // Dibujar Subtotal
      ctx.textAlign = 'left';
      ctx.fillText('Subtotal', 30, y);
      ctx.textAlign = 'right';
      ctx.fillText(`$${subtotalVal.toFixed(2)}`, width - 30, y);
      
      // Dibujar Descuento
      if (discountVal > 0) {
        y += 18;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f87171';
        ctx.fillText('Descuento', 30, y);
        ctx.textAlign = 'right';
        ctx.fillText(`-$${discountVal.toFixed(2)}`, width - 30, y);
        ctx.fillStyle = '#94a3b8';
      }
      
      // Dibujar IVA 16%
      if (taxVal > 0) {
        y += 18;
        ctx.textAlign = 'left';
        ctx.fillText('IVA (16%)', 30, y);
        ctx.textAlign = 'right';
        ctx.fillText(`$${taxVal.toFixed(2)}`, width - 30, y);
      }

      y += 15;
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();

      y += 25;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Outfit, Segoe UI';
      ctx.fillText('TOTAL NETO (USD)', 30, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ff7a00'; // Naranja FacilitoApp
      ctx.font = 'bold 18px Outfit, Segoe UI';
      ctx.fillText(`$${Number(sale.total).toFixed(2)}`, width - 30, y);

      const totalVes = Number(sale.total) * rateUsdToVes;
      const totalEur = totalVes / rateEurToVes;

      y += 18;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 11px Outfit, Segoe UI';
      ctx.fillText('Equivalente Bs. (BCV)', 30, y);

      ctx.textAlign = 'right';
      ctx.fillText(`Bs. ${totalVes.toFixed(2)}`, width - 30, y);

      y += 16;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Outfit, Segoe UI';
      ctx.fillText('Equivalente EUR (€)', 30, y);

      ctx.textAlign = 'right';
      ctx.fillText(`€ ${totalEur.toFixed(2)}`, width - 30, y);

      // Divisor
      y += 20;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();

      // Footer
      y += 35;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Outfit, Segoe UI';
      ctx.fillText(sale.is_quotation === 1 ? 'Cotización válida por 15 días.' : '¡Gracias por tu compra!', width / 2, y);

      y += 20;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Outfit, Segoe UI';
      ctx.fillText('Documento digital generado por FacilitoApp.', width / 2, y);

      // Convertir canvas a Blob y retornar
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject('Error al exportar blob');
      }, 'image/png');
    };

    logoImg.onload = () => {
      onLogoLoaded(true);
    };

    logoImg.onerror = () => {
      onLogoLoaded(false);
    };
  });
}

async function shareInvoiceAsImage(sale: any, items: any[], clientPhone: string) {
  try {
    const blob = await generateReceiptPNG(sale, items);
    const formattedPhone = clientPhone ? clientPhone.replace(/\+/g, '').replace(/\s/g, '') : '';
    
    // Copiar imagen al portapapeles de forma silenciosa (sin interrumpir con alerts)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
    } catch (err) {
      console.warn('Clipboard image write failed:', err);
    }
    
    // Mensaje de agradecimiento amigable y profesional
    const waMessage = `¡Hola! Muchas gracias por tu compra. 😊\n\nTe comparto el comprobante digital de tu Factura #${sale.id} por un total de $${Number(sale.total).toFixed(2)}.\n\n*(Pega la factura presionando Ctrl + V o manteniendo presionado y seleccionando Pegar).*`;
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(waMessage)}`;
    window.open(waUrl, '_blank');
  } catch (error) {
    console.error('Error al compartir la factura PNG:', error);
    alert('No se pudo generar el comprobante digital de la factura.');
  }
}

async function showInvoiceSuccess(result: any, clientPhone: string, clientEmail?: string, purchaseItems?: { name: string, quantity: number, price: number }[]) {
  const modal = document.getElementById('success-modal');
  modal?.classList.add('open');

  const totalEl = document.getElementById('success-total');
  const idEl = document.getElementById('success-id');
  const waBtn = document.getElementById('success-wa-btn') as HTMLAnchorElement;
  const emailStatusBox = document.getElementById('success-email-status-box');
  const emailBox = document.getElementById('success-email-box');
  const emailBtn = document.getElementById('success-email-btn') as HTMLAnchorElement;

  if (totalEl) {
    const totalUsd = Number(result.total);
    const totalVes = totalUsd * rateUsdToVes;
    const totalEur = totalVes / rateEurToVes;
    totalEl.innerHTML = `
      <div style="font-size:24px; color:var(--primary); font-weight:700;">$${totalUsd.toFixed(2)}</div>
      <div style="font-size:15px; color:#f59e0b; font-weight:600; margin-top:2px;">Bs. ${totalVes.toFixed(2)}</div>
      <div style="font-size:11px; color:var(--text-muted); font-weight:500;">€ ${totalEur.toFixed(2)}</div>
    `;
  }
  if (idEl) idEl.innerText = `ID de Venta: #${result.saleId}`;

  // WhatsApp Link - Interceptado por click
  const decodedText = decodeURIComponent(result.whatsappText);
  waBtn.setAttribute('data-invoice-text', decodedText);
  
  const newWaBtn = waBtn.cloneNode(true) as HTMLAnchorElement;
  waBtn.parentNode?.replaceChild(newWaBtn, waBtn);
  
  newWaBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Inferencia de datos de pago
    let payMethod = 'tarjeta';
    if (decodedText.toLowerCase().includes('efectivo') || decodedText.toLowerCase().includes('cash')) payMethod = 'efectivo';
    else if (decodedText.toLowerCase().includes('transfer')) payMethod = 'transferencia';

    let saleType = 'online';
    if (decodedText.toLowerCase().includes('pos')) saleType = 'pos';

    const saleMock = {
      id: result.saleId,
      customer_name: result.customerName || 'Cliente General',
      customer_phone: clientPhone,
      customer_email: clientEmail,
      total: result.total,
      payment_method: payMethod,
      type: saleType,
      seller_name: currentUser?.name || 'Online',
      created_at: new Date()
    };
    
    await shareInvoiceAsImage(saleMock, purchaseItems || [], clientPhone);
  });

  // Mostrar estado del correo automático
  if (emailStatusBox) {
    if (clientEmail) {
      emailStatusBox.style.display = 'flex';
      emailStatusBox.innerHTML = `✉️ Factura enviada automáticamente a: ${clientEmail}`;
    } else {
      emailStatusBox.style.display = 'none';
    }
  }

  // Correo de desarrollo preview
  if (result.emailPreviewUrl && result.emailPreviewUrl.includes('ethereal.email')) {
    if (emailBox) emailBox.style.display = 'block';
    if (emailBtn) emailBtn.href = result.emailPreviewUrl;
  } else {
    if (emailBox) emailBox.style.display = 'none';
  }

  // Configurar botón manual de correo electrónico
  const manualEmailBtn = document.getElementById('success-manual-email-btn') as HTMLButtonElement;
  if (manualEmailBtn) {
    const newManualEmailBtn = manualEmailBtn.cloneNode(true) as HTMLButtonElement;
    manualEmailBtn.parentNode?.replaceChild(newManualEmailBtn, manualEmailBtn);

    newManualEmailBtn.addEventListener('click', async () => {
      let targetEmail = clientEmail || '';
      
      const inputEmail = prompt('Ingrese el correo electrónico al cual desea enviar la factura:', targetEmail);
      if (inputEmail === null) return; // cancelado
      
      if (!inputEmail || !inputEmail.includes('@')) {
        alert('Por favor, ingrese un correo electrónico válido.');
        return;
      }

      newManualEmailBtn.disabled = true;
      newManualEmailBtn.innerText = 'Enviando...';

      try {
        await api.sales.resendEmail(result.saleId, inputEmail);
        alert(`¡Factura enviada con éxito a ${inputEmail}!`);
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Error al enviar la factura por correo.');
      } finally {
        newManualEmailBtn.disabled = false;
        newManualEmailBtn.innerText = '✉️ Enviar por Correo Electrónico';
      }
    });
  }

  // Generar y configurar la imagen de la factura
  const pngContainer = document.getElementById('success-png-container');
  const copyPngBtn = document.getElementById('success-copy-png-btn');
  const downloadPngBtn = document.getElementById('success-download-png-btn') as HTMLAnchorElement;

  if (pngContainer && purchaseItems) {
    pngContainer.innerHTML = `<p style="color:var(--text-muted); font-size: 11px; padding: 20px;">Generando imagen PNG...</p>`;
    try {
      // Inferencia de datos de pago
      let payMethod = 'tarjeta';
      if (decodedText.toLowerCase().includes('efectivo') || decodedText.toLowerCase().includes('cash')) payMethod = 'efectivo';
      else if (decodedText.toLowerCase().includes('transfer')) payMethod = 'transferencia';

      let saleType = 'online';
      if (decodedText.toLowerCase().includes('pos')) saleType = 'pos';

      const saleMock = {
        id: result.saleId,
        customer_name: result.customerName || 'Cliente General',
        customer_phone: clientPhone,
        customer_email: clientEmail,
        total: result.total,
        payment_method: payMethod,
        type: saleType,
        seller_name: currentUser?.name || 'Online',
        created_at: new Date()
      };

      const blob = await generateReceiptPNG(saleMock, purchaseItems);
      const blobUrl = URL.createObjectURL(blob);

      // Renderizar imagen
      pngContainer.innerHTML = `<img src="${blobUrl}" style="max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 6px; box-shadow: var(--shadow-lg);" alt="Factura PNG">`;

      // Configurar Descarga
      if (downloadPngBtn) {
        downloadPngBtn.href = blobUrl;
        downloadPngBtn.download = `factura-${result.saleId}.png`;
      }

      // Copiar automaticamente al portapapeles
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        console.log('Factura PNG copiada al portapapeles.');
      } catch (err) {
        console.warn('Copia automatica bloqueada por el navegador. Presiona el boton.');
      }

      // Configurar boton de copiar
      if (copyPngBtn) {
        const newCopyBtn = copyPngBtn.cloneNode(true) as HTMLButtonElement;
        copyPngBtn.parentNode?.replaceChild(newCopyBtn, copyPngBtn);
        newCopyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            alert('¡Factura PNG copiada al portapapeles! Abre el chat de WhatsApp y presiona Ctrl + V para enviarla.');
          } catch (err) {
            console.error(err);
            alert('Error al copiar la imagen automaticamente. Por favor descarga la factura.');
          }
        });
      }
    } catch (err) {
      console.error(err);
      pngContainer.innerHTML = `<p style="color:var(--danger); font-size:11px; padding:20px;">Error al generar PNG.</p>`;
    }
  }
}

function bindSuccessEvents() {
  document.getElementById('success-close-btn')?.addEventListener('click', () => {
    document.getElementById('success-modal')?.classList.remove('open');
    navigate('store');
  });

  // Copiar al Portapapeles
  document.getElementById('success-copy-btn')?.addEventListener('click', () => {
    const waBtn = document.getElementById('success-wa-btn');
    if (waBtn) {
      let text = waBtn.getAttribute('data-invoice-text');
      // Si no está el atributo, intentar obtenerlo de la URL por retrocompatibilidad
      if (!text && (waBtn as HTMLAnchorElement).href && (waBtn as HTMLAnchorElement).href.includes('?')) {
        const urlParams = new URLSearchParams((waBtn as HTMLAnchorElement).href.split('?')[1]);
        text = urlParams.get('text');
      }
      if (text) {
        navigator.clipboard.writeText(decodeURIComponent(text))
          .then(() => {
            alert('¡Factura copiada al portapapeles! Puedes pegarla directamente en tu correo, Word o chat.');
          })
          .catch(err => {
            console.error('Error al copiar:', err);
            alert('No se pudo copiar automaticamente. Por favor, selecciona y copia el texto manualmente.');
          });
      }
    }
  });
}

// ==========================================================================
// VISTA: LOGIN / REGISTRO
// ==========================================================================
let activeAuthTab: 'login' | 'register' | 'forgot' = 'login';
let forgotStep: 'email' | 'code' = 'email';
let resetTargetEmail = '';
let resetPreviewUrl = '';

function renderAuthView(): string {
  return `
    <div class="auth-container">
      <div class="card auth-card animate-on-scroll animate-zoom-in">
        <div style="text-align:center; margin-bottom: 20px;">
          <img src="/logofacilito.png" class="animate-float" style="width: 76px; height: 76px; border-radius:50%; border:2px solid var(--primary); box-shadow: 0 4px 15px rgba(255,122,0,0.25); background:var(--bg-secondary); object-fit:contain;" alt="Logo">
          <h2 style="font-weight:900; margin-top:10px; font-size: 24px; background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing:-0.5px;">FacilitoApp</h2>
          <p style="font-size:12px; color:var(--text-secondary); margin-top:2px;">¡Ingresa y disfruta del control total de tus ventas! 🐒</p>
        </div>
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
              <label class="form-label" for="login-password">Contraseña</label>
              <input type="password" class="form-control" id="login-password" required placeholder="••••••••">
              <div style="text-align: right; margin-top: 6px;">
                <a href="#" id="link-forgot-pass" style="font-size: 12px; color: var(--primary); font-weight: 600; text-decoration: none;">¿Olvidaste tu contraseña?</a>
              </div>
            </div>
            <button type="submit" class="btn btn-primary w-100 mt-3" id="login-submit-btn">Ingresar</button>
          </form>
        ` : activeAuthTab === 'register' ? `
          <form id="register-form">
            <div class="form-group">
              <label class="form-label" for="reg-name">Nombre Completo</label>
              <input type="text" class="form-control" id="reg-name" required placeholder="Ej. Juan Perez">
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-ci-num">Cédula de Identidad</label>
              <div style="display: flex; gap: 8px;">
                <select class="form-control" id="reg-ci-prefix" style="width: 80px; font-weight: 700; flex-shrink: 0;">
                  <option value="V-">V-</option>
                  <option value="E-">E-</option>
                </select>
                <input type="text" class="form-control" id="reg-ci-num" required placeholder="12345678" pattern="\\d{5,10}" title="Ingrese de 5 a 10 dígitos numéricos" style="flex-grow: 1;">
              </div>
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
        ` : `
          <div style="margin-top: 10px;">
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Recuperar Contraseña 🔐</h3>
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
              ${forgotStep === 'email' 
                ? 'Ingresa tu correo electrónico registrado y te enviaremos un código de verificación de 6 dígitos.' 
                : `Ingresa el código enviado a <strong style="color:var(--text-main);">${resetTargetEmail}</strong> y tu nueva contraseña.`}
            </p>

            ${forgotStep === 'email' ? `
              <form id="forgot-email-form">
                <div class="form-group mb-3">
                  <label class="form-label" for="forgot-email-input">Correo Electrónico</label>
                  <input type="email" class="form-control" id="forgot-email-input" required placeholder="Ej. usuario@correo.com" value="${resetTargetEmail}">
                </div>
                <button type="submit" class="btn btn-primary w-100" id="forgot-send-btn">Enviar Código al Correo</button>
              </form>
            ` : `
              <form id="reset-pass-form">
                <div class="form-group mb-3">
                  <label class="form-label" for="reset-code-input">Código de Verificación (6 dígitos)</label>
                  <input type="text" class="form-control" id="reset-code-input" required placeholder="123456" maxlength="6" pattern="\\d{6}" title="Ingrese el código de 6 dígitos" style="font-size: 20px; font-weight: 800; letter-spacing: 6px; text-align: center; color: var(--primary);">
                </div>
                <div class="form-group mb-3">
                  <label class="form-label" for="reset-new-pass-input">Nueva Contraseña</label>
                  <input type="password" class="form-control" id="reset-new-pass-input" required minlength="6" placeholder="Mínimo 6 caracteres">
                </div>
                <button type="submit" class="btn btn-primary w-100 mb-2" id="reset-submit-btn">Restablecer Contraseña</button>
              </form>
              ${resetPreviewUrl ? `
                <div style="margin-top: 12px; text-align: center;">
                  <a href="${resetPreviewUrl}" target="_blank" class="btn btn-secondary w-100" style="font-size: 12px; display: inline-block;">
                    🔍 Ver correo enviado en Ethereal Mail
                  </a>
                </div>
              ` : ''}
            `}

            <div style="text-align: center; margin-top: 16px;">
              <a href="#" id="link-back-login" style="font-size: 12px; color: var(--text-muted); text-decoration: none;">
                ⬅ Volver al Inicio de Sesión
              </a>
            </div>
          </div>
        `}

        <div style="margin: 20px 0; text-align: center; color: var(--text-muted); font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span style="flex-grow: 1; height: 1px; background: var(--border-glass);"></span>
          <span>O continuar con</span>
          <span style="flex-grow: 1; height: 1px; background: var(--border-glass);"></span>
        </div>

        <div style="display: flex; justify-content: center; margin-top: 10px;">
          <div id="google-signin-btn"></div>
        </div>
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

  document.getElementById('link-forgot-pass')?.addEventListener('click', (e) => {
    e.preventDefault();
    activeAuthTab = 'forgot';
    forgotStep = 'email';
    renderApp();
  });

  document.getElementById('link-back-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    activeAuthTab = 'login';
    renderApp();
  });

  // Evento Solicitar Código de Recuperación
  document.getElementById('forgot-email-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('forgot-email-input') as HTMLInputElement).value.trim();
    const btn = document.getElementById('forgot-send-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Enviando código...';

    try {
      const res = await api.auth.forgotPassword(email);
      resetTargetEmail = email;
      resetPreviewUrl = res.emailPreviewUrl || '';
      forgotStep = 'code';
      alert(res.message);
      renderApp();
    } catch (err: any) {
      alert(err.message || 'Error al enviar código de recuperación');
      btn.disabled = false;
      btn.innerText = 'Enviar Código al Correo';
    }
  });

  // Evento Restablecer Contraseña con Código
  document.getElementById('reset-pass-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = (document.getElementById('reset-code-input') as HTMLInputElement).value.trim();
    const newPassword = (document.getElementById('reset-new-pass-input') as HTMLInputElement).value;
    const btn = document.getElementById('reset-submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Guardando nueva clave...';

    try {
      const res = await api.auth.resetPassword({ email: resetTargetEmail, code, newPassword });
      alert(res.message);
      activeAuthTab = 'login';
      forgotStep = 'email';
      resetTargetEmail = '';
      resetPreviewUrl = '';
      renderApp();
    } catch (err: any) {
      alert(err.message || 'Error al restablecer la contraseña');
      btn.disabled = false;
      btn.innerText = 'Restablecer Contraseña';
    }
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
    const ciPrefix = (document.getElementById('reg-ci-prefix') as HTMLSelectElement).value;
    const ciNum = (document.getElementById('reg-ci-num') as HTMLInputElement).value.trim();
    const email = (document.getElementById('reg-email') as HTMLInputElement).value;
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;
    const phone = (document.getElementById('reg-phone') as HTMLInputElement).value;

    const ci = `${ciPrefix}${ciNum}`;

    const btn = document.getElementById('reg-submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Cargando...';

    try {
      const res = await api.auth.register({ name, email, password, phone, ci });
      localStorage.setItem('token', res.token);
      currentUser = res.user;
      navigate('store');
    } catch (error: any) {
      alert(error.message || 'Error en el registro');
      btn.disabled = false;
      btn.innerText = 'Crear Cuenta';
    }
  });

  // Integración de Google Sign-In (Login y Registro)
  const initGoogleBtn = () => {
    const google = (window as any).google;
    if (google) {
      google.accounts.id.initialize({
        client_id: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '1008719970978-hb24n2dstb40o45upg4689qqt56n74hs.apps.googleusercontent.com',
        callback: async (response: any) => {
          const credential = response.credential;
          try {
            const googleBtn = document.getElementById('google-signin-btn');
            if (googleBtn) googleBtn.style.pointerEvents = 'none';

            const res = await api.auth.loginGoogle(credential);
            localStorage.setItem('token', res.token);
            currentUser = res.user;

            if (currentUser.role === 'admin') {
              activeAdminView = 'stats';
              navigate('admin');
            } else {
              navigate('store');
            }
          } catch (error: any) {
            alert(error.message || 'Error en la autenticación con Google');
            const googleBtn = document.getElementById('google-signin-btn');
            if (googleBtn) googleBtn.style.pointerEvents = 'auto';
          }
        }
      });

      const btnDiv = document.getElementById('google-signin-btn');
      if (btnDiv) {
        google.accounts.id.renderButton(btnDiv, {
          theme: 'filled_blue',
          size: 'large',
          text: activeAuthTab === 'login' ? 'signin_with' : 'signup_with',
          shape: 'rectangular',
          width: 300
        });
      }
    } else {
      // Reintentar en 100ms si el script externo de Google aún está cargando
      setTimeout(initGoogleBtn, 100);
    }
  };

  initGoogleBtn();
}


// ==========================================================================
// VISTA: PANEL DE ADMINISTRACION (DASHBOARD)
// ==========================================================================
function hasPermission(perm: string): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (!currentUser.permissions) return perm === 'pos';
  try {
    const perms = typeof currentUser.permissions === 'string'
      ? JSON.parse(currentUser.permissions)
      : currentUser.permissions;
    return Array.isArray(perms) && perms.includes(perm);
  } catch (e) {
    return perm === 'pos';
  }
}

function renderAdminDashboard(): string {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'seller')) {
    return `
      <div class="card text-center animate-on-scroll animate-fade-up visible" style="max-width: 400px; margin: 40px auto; padding: 40px;">
        <h2 class="mb-4">Acceso Denegado</h2>
        <p class="mb-4" style="color:var(--text-secondary);">Debes ser un administrador o vendedor autenticado para acceder al panel de control.</p>
        <button class="btn btn-primary" id="go-store-btn">Volver a la Tienda</button>
      </div>
    `;
  }

  // Ajustar subvista activa por defecto según permisos
  if (!hasPermission(activeAdminView)) {
    if (hasPermission('pos')) activeAdminView = 'pos';
    else if (hasPermission('stats')) activeAdminView = 'stats';
    else if (hasPermission('products')) activeAdminView = 'products';
  }

  return `
    <div class="dashboard-layout">
      <!-- Sidebar de Administracion -->
      <aside class="dashboard-sidebar" style="display:flex; flex-direction:column; justify-content:space-between; min-height: 500px;">
        <div>
          ${currentUser.role === 'admin' ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'stats' ? 'active' : ''}" id="admin-tab-stats">
              ${icons.dashboard} Estadisticas
            </button>
          ` : ''}
          ${hasPermission('pos') ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'pos' ? 'active' : ''}" id="admin-tab-pos">
              ${icons.pos} Punto de Venta (POS)
            </button>
          ` : ''}
          ${hasPermission('products') ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'products' ? 'active' : ''}" id="admin-tab-products">
              ${icons.products} Catalogo Productos
            </button>
          ` : ''}
          ${hasPermission('sales') ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'sales' ? 'active' : ''}" id="admin-tab-sales">
              ${icons.sales} Historico del Sistema
            </button>
          ` : ''}
          ${hasPermission('debtors') ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'debtors' ? 'active' : ''}" id="admin-tab-debtors">
              💸 Deudores
            </button>
          ` : ''}
          ${hasPermission('quotations') ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'quotations' ? 'active' : ''}" id="admin-tab-quotations">
              📝 Cotizaciones
            </button>
          ` : ''}
          ${hasPermission('coupons') ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'coupons' ? 'active' : ''}" id="admin-tab-coupons">
              🎟️ Cupones
            </button>
          ` : ''}
          <button class="sidebar-nav-btn ${activeAdminView === 'customers' ? 'active' : ''}" id="admin-tab-customers">
            👤 Clientes Registrados
          </button>
          ${currentUser.role === 'admin' ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'expenses' ? 'active' : ''}" id="admin-tab-expenses">
              💼 Gastos
            </button>
          ` : ''}
          ${hasPermission('staff') ? `
            <button class="sidebar-nav-btn ${activeAdminView === 'staff' ? 'active' : ''}" id="admin-tab-staff">
              👥 Vendedores
            </button>
          ` : ''}
        </div>

        ${currentUser.role === 'admin' ? `
          <!-- Tasas de Cambio Widget -->
          <div class="card" style="margin-top: 20px; padding: 12px; font-size:11px; background:rgba(255,255,255,0.01); border:1px solid var(--border-glass);">
            <div style="font-weight:700; margin-bottom: 8px; display:flex; align-items:center; gap:4px; color:var(--primary);">
              💵 Tasas BCV & Binance
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                <span>$ BCV:</span>
                <input type="number" step="0.01" id="rate-usd-input" value="${rateUsdToVes}" style="width:70px; padding:2px 6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-glass); border-radius:4px; color:white; text-align:right; font-size:11px;">
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                <span>€ BCV:</span>
                <input type="number" step="0.01" id="rate-eur-input" value="${rateEurToVes}" style="width:70px; padding:2px 6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-glass); border-radius:4px; color:white; text-align:right; font-size:11px;">
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; color:#f59e0b;">
                <span>🟡 Binance:</span>
                <input type="number" step="0.01" id="rate-binance-input" value="${rateBinanceToVes}" style="width:70px; padding:2px 6px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:4px; color:#f59e0b; text-align:right; font-size:11px; font-weight:700;">
              </div>
              <div style="display:flex; gap:4px;">
                <button type="button" class="btn btn-secondary" id="sync-rates-btn" style="padding:4px 6px; font-size:10px; margin-top:4px; width:45%; background:rgba(255,255,255,0.05); color:white; border-color:var(--border-glass);" title="Sincronizar automáticamente con el BCV y Binance P2P">
                  🔄 Auto
                </button>
                <button type="button" class="btn btn-primary" id="save-rates-btn" style="padding:4px 6px; font-size:10px; margin-top:4px; width:55%;">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        ` : ''}
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
  const tabDebtors = document.getElementById('admin-tab-debtors');
  const tabQuotations = document.getElementById('admin-tab-quotations');
  const tabCoupons = document.getElementById('admin-tab-coupons');
  const tabCustomers = document.getElementById('admin-tab-customers');
  const tabExpenses = document.getElementById('admin-tab-expenses');
  const tabStaff = document.getElementById('admin-tab-staff');

  const clearActiveTabs = () => {
    tabStats?.classList.remove('active');
    tabPOS?.classList.remove('active');
    tabProducts?.classList.remove('active');
    tabSales?.classList.remove('active');
    tabDebtors?.classList.remove('active');
    tabQuotations?.classList.remove('active');
    tabCoupons?.classList.remove('active');
    tabCustomers?.classList.remove('active');
    tabExpenses?.classList.remove('active');
    tabStaff?.classList.remove('active');
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

  tabDebtors?.addEventListener('click', async () => {
    clearActiveTabs();
    tabDebtors?.classList.add('active');
    activeAdminView = 'debtors';
    destroyCharts();
    await renderAdminDebtors();
  });

  tabQuotations?.addEventListener('click', async () => {
    clearActiveTabs();
    tabQuotations?.classList.add('active');
    activeAdminView = 'quotations';
    destroyCharts();
    await renderAdminQuotations();
  });

  tabCoupons?.addEventListener('click', async () => {
    clearActiveTabs();
    tabCoupons?.classList.add('active');
    activeAdminView = 'coupons';
    destroyCharts();
    await renderAdminCoupons();
  });

  tabCustomers?.addEventListener('click', async () => {
    clearActiveTabs();
    tabCustomers?.classList.add('active');
    activeAdminView = 'customers';
    destroyCharts();
    await renderAdminCustomers();
  });

  tabExpenses?.addEventListener('click', async () => {
    clearActiveTabs();
    tabExpenses?.classList.add('active');
    activeAdminView = 'expenses';
    destroyCharts();
    await renderAdminExpenses();
  });

  tabStaff?.addEventListener('click', async () => {
    clearActiveTabs();
    tabStaff.classList.add('active');
    activeAdminView = 'staff';
    destroyCharts();
    await renderAdminStaff();
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
  } else if (activeAdminView === 'debtors') {
    await renderAdminDebtors();
  } else if (activeAdminView === 'quotations') {
    await renderAdminQuotations();
  } else if (activeAdminView === 'coupons') {
    await renderAdminCoupons();
  } else if (activeAdminView === 'customers') {
    await renderAdminCustomers();
  } else if (activeAdminView === 'expenses') {
    await renderAdminExpenses();
  } else if (activeAdminView === 'staff') {
    await renderAdminStaff();
  }

  // Guardar Tasas de Cambio Manuales (BCV & Binance)
  document.getElementById('save-rates-btn')?.addEventListener('click', async () => {
    const usdVal = parseFloat((document.getElementById('rate-usd-input') as HTMLInputElement).value);
    const eurVal = parseFloat((document.getElementById('rate-eur-input') as HTMLInputElement).value);
    const binanceVal = parseFloat((document.getElementById('rate-binance-input') as HTMLInputElement).value);

    if (isNaN(usdVal) || usdVal <= 0 || isNaN(eurVal) || eurVal <= 0 || isNaN(binanceVal) || binanceVal <= 0) {
      alert('Por favor ingrese tasas válidas mayores a 0.');
      return;
    }

    const btn = document.getElementById('save-rates-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = '...';

    try {
      await api.sales.updateExchangeRates({ usdToVes: usdVal, eurToVes: eurVal, binanceUsdToVes: binanceVal });
      rateUsdToVes = usdVal;
      rateEurToVes = eurVal;
      rateBinanceToVes = binanceVal;
      alert('Tasas de cambio oficiales (BCV & Binance) guardadas con éxito.');
      navigate('admin'); // Recargar vista admin para refrescar todo
    } catch (err: any) {
      alert(err.message || 'Error al actualizar tasas de cambio.');
      btn.disabled = false;
      btn.innerText = 'Guardar';
    }
  });

  // Sincronizar Tasas de Cambio Automáticamente desde el BCV y Binance
  document.getElementById('sync-rates-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('sync-rates-btn') as HTMLButtonElement;
    const saveBtn = document.getElementById('save-rates-btn') as HTMLButtonElement;
    
    btn.disabled = true;
    saveBtn.disabled = true;
    btn.innerText = '...';

    try {
      const res = await api.sales.syncExchangeRates();
      rateUsdToVes = res.rates.usdToVes;
      rateEurToVes = res.rates.eurToVes;
      rateBinanceToVes = res.rates.binanceUsdToVes;
      
      // Actualizar inputs si existen en pantalla
      const usdInput = document.getElementById('rate-usd-input') as HTMLInputElement;
      const eurInput = document.getElementById('rate-eur-input') as HTMLInputElement;
      const binanceInput = document.getElementById('rate-binance-input') as HTMLInputElement;
      if (usdInput) usdInput.value = rateUsdToVes.toString();
      if (eurInput) eurInput.value = rateEurToVes.toString();
      if (binanceInput) binanceInput.value = rateBinanceToVes.toString();

      alert(`¡Tasas sincronizadas con éxito desde el BCV y Binance P2P!\n\nBCV Dólar: Bs. ${rateUsdToVes.toFixed(2)}\nBCV Euro: Bs. ${rateEurToVes.toFixed(2)}\nBinance USDT: Bs. ${rateBinanceToVes.toFixed(2)}`);
      navigate('admin');
    } catch (err: any) {
      alert(err.message || 'Error al conectar con el servidor para sincronizar tasas.');
    } finally {
      btn.disabled = false;
      saveBtn.disabled = false;
      btn.innerText = '🔄 Auto';
    }
  });
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
            <div class="chart-container" style="position: relative; height: 280px; width: 100%;">
              <canvas id="revenueChart"></canvas>
            </div>
          </div>
          <div class="card chart-card">
            <h3 class="mb-4" style="font-size: 16px; font-weight:700;">Metodos de Pago</h3>
            <div class="chart-container" style="position: relative; height: 280px; width: 100%;">
              <canvas id="paymentChart"></canvas>
            </div>
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

  try {
    // Cargar lista de clientes para el POS si está vacía
    if (!Array.isArray(posCustomersList) || posCustomersList.length === 0) {
      try {
        const custs = await api.auth.getCustomers();
        posCustomersList = Array.isArray(custs) ? custs : [];
      } catch (err) {
        console.error('Error al cargar lista de clientes para POS:', err);
        posCustomersList = [];
      }
    }
    
    let posProducts: Product[] = [];
    try {
      const prods = await api.products.getAll(undefined, posSearchQuery || undefined);
      posProducts = Array.isArray(prods) ? prods : [];
    } catch (err) {
      console.error('Error al cargar lista de productos para POS:', err);
      posProducts = [];
    }
    
    // Cálculos de totales del POS
    const posSubtotal = posCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const couponDiscountAmount = posSubtotal * (posCouponDiscountPercent / 100);
    const totalDiscount = couponDiscountAmount + posDiscount;
    const taxableSubtotal = Math.max(0, posSubtotal - totalDiscount);
    const taxAmount = posApplyTax ? taxableSubtotal * 0.16 : 0;
    const posTotal = taxableSubtotal + taxAmount;

    panel.innerHTML = `
      <!-- Barra Superior de Acciones POS -->
      <div class="flex justify-between align-center mb-3">
        <div class="flex gap-2">
          <button type="button" class="btn btn-secondary" id="open-register-customer-btn" style="background:#6366f1; border:none; color:white; font-size:12px; font-weight:700; padding:8px 14px; border-radius:8px;">
            👤 Registrar Cliente
          </button>
          ${currentUser?.role === 'admin' ? `
            <button type="button" class="btn btn-success" id="open-free-sale-btn" style="background:#10b981; border:none; color:white; font-size:12px; font-weight:700; padding:8px 14px; border-radius:8px;">
              ➕ Nueva Venta Libre
            </button>
          ` : ''}
          <button type="button" class="btn btn-danger" id="open-expense-btn" style="background:#ef4444; border:none; color:white; font-size:12px; font-weight:700; padding:8px 14px; border-radius:8px;">
            🔴 Nuevo Gasto
          </button>
        </div>

        <div style="font-size:12px; color:var(--text-secondary);">
          Vendedor: <strong>${currentUser?.name || 'Admin'}</strong>
        </div>
      </div>

      <div class="pos-layout animate-on-scroll animate-fade-up visible" style="display:grid; grid-template-columns: 1fr 420px; gap:20px;">
        <!-- Columna de Productos (Izquierda) -->
        <div class="pos-products-column">
          <div class="pos-search-bar mb-3">
            <input type="text" class="form-control" id="pos-search-input" placeholder="🔍 Buscar por nombre o código de producto..." value="${posSearchQuery}" style="font-size:14px; padding:10px 14px;">
          </div>

          <div class="pos-products-grid stagger-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:12px;">
            ${posProducts.map(prod => `
              <div class="card pos-product-card add-to-pos-cart" data-id="${prod.id}" style="cursor:pointer; padding:10px; border-radius:12px; text-align:center; transition:transform 0.15s ease;">
                <img src="${prod.image_url || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200'}" alt="${prod.name}" style="width:100%; height:90px; object-fit:cover; border-radius:8px; margin-bottom:6px;">
                <div class="pos-product-name" style="font-size:12px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${prod.name}</div>
                <div style="font-weight:800; color:var(--primary); font-size:13px; margin-top:2px;">$${Number(prod.price).toFixed(2)}</div>
                <div style="font-size:10px; color:var(--text-muted);">Stock: ${prod.stock}</div>
              </div>
            `).join('')}
            ${posProducts.length === 0 ? '<p style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-secondary);">No se encontraron productos.</p>' : ''}
          </div>
        </div>

        <!-- Columna de Carrito & Datos de Pago (Derecha) -->
        <div class="pos-cart-column" style="background:#111827; border:1px solid var(--border-glass); border-radius:16px; padding:16px; display:flex; flex-direction:column; gap:14px;">
          
          <!-- Encabezado de Productos & Vaciar Canasta -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-glass); padding-bottom:8px;">
            <span style="font-size:15px; font-weight:800; color:white;">Productos (${posCart.reduce((sum, i) => sum + i.quantity, 0)})</span>
            ${posCart.length > 0 ? `
              <button type="button" id="clear-pos-cart-btn" style="background:none; border:none; color:#f87171; font-size:12px; text-decoration:underline; cursor:pointer; font-weight:600;">
                Vaciar canasta
              </button>
            ` : ''}
          </div>

          <!-- Items en Canasta -->
          <div class="pos-cart-items" style="max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
            ${posCart.map(item => `
              <div class="pos-cart-item" style="background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); padding:10px; border-radius:10px; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; gap:8px; align-items:center;">
                    <img src="${item.product.image_url || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200'}" style="width:36px; height:36px; object-fit:cover; border-radius:6px;">
                    <div style="font-size:12px; font-weight:700; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.product.name}</div>
                  </div>
                  <button type="button" class="btn btn-danger remove-pos-item" data-id="${item.product.id}" style="padding:2px 6px; font-size:10px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171;" title="Eliminar del carrito">
                    🗑️
                  </button>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:4px;">
                  <div class="flex align-center gap-1" style="border:1px solid var(--border-glass); border-radius:6px; padding:2px 4px;">
                    <button type="button" class="qty-btn dec-pos-qty" data-id="${item.product.id}" style="width:24px; height:24px; font-weight:800; border:none; background:none; color:white; cursor:pointer;">-</button>
                    <span style="font-size:12px; font-weight:700; min-width:20px; text-align:center;">${item.quantity}</span>
                    <button type="button" class="qty-btn inc-pos-qty" data-id="${item.product.id}" style="width:24px; height:24px; font-weight:800; border:none; background:none; color:white; cursor:pointer;">+</button>
                  </div>

                  <div style="display:flex; align-items:center; gap:4px;">
                    <span style="font-size:11px; color:var(--text-muted);">$</span>
                    <input type="number" step="0.01" min="0.01" class="form-control change-pos-price" data-id="${item.product.id}" value="${Number(item.product.price).toFixed(2)}" style="width:70px; padding:2px 6px; font-size:12px; text-align:right; font-weight:700;">
                  </div>
                </div>

                <div style="font-size:10px; color:var(--text-muted); text-align:left;">
                  Precio por ${item.quantity} unidades: <strong>$${(item.product.price * item.quantity).toFixed(2)}</strong>
                </div>
              </div>
            `).join('')}
            ${posCart.length === 0 ? `<div style="text-align:center; padding:30px 0; color:var(--text-secondary); font-size:13px;">La canasta está vacía. Selecciona productos.</div>` : ''}
          </div>

          <!-- Checkout POS Form -->
          <form id="pos-checkout-form" style="display:flex; flex-direction:column; gap:12px;">
            
            <!-- Segmented Toggle: Pagada vs A crédito -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; background:rgba(255,255,255,0.03); padding:4px; border-radius:10px; border:1px solid var(--border-glass);">
              <button type="button" id="pos-type-paid-btn" class="btn" style="padding:8px; font-size:12px; font-weight:700; border-radius:8px; ${!posIsPending ? 'background:#10b981; color:white;' : 'background:transparent; color:var(--text-muted);'}">
                Pagada
              </button>
              <button type="button" id="pos-type-credit-btn" class="btn" style="padding:8px; font-size:12px; font-weight:700; border-radius:8px; ${posIsPending ? 'background:#ef4444; color:white;' : 'background:transparent; color:var(--text-muted);'}">
                A crédito
              </button>
            </div>

            <!-- Tasa Oficial del Día -->
            <div style="background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.25); border-radius:10px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:11px; font-weight:700; color:#10b981;">Tasa Oficial BCV:</span>
              <div style="display:flex; align-items:center; gap:4px;">
                <span style="font-size:11px; font-weight:700; color:white;">Bs. ${rateUsdToVes.toFixed(2)}</span>
                <span style="font-size:10px; color:var(--text-muted);">= $1 USD</span>
              </div>
            </div>

            <!-- Cliente Seleccionado -->
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); border-radius:10px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Cliente Factura:</div>
                <div style="font-size:12px; font-weight:700; color:var(--primary);">
                  👑 ${posCustomerName || 'Consumidor Final'} ${posCustomerCi ? `(${posCustomerCi})` : ''}
                </div>
              </div>
              <button type="button" class="btn btn-secondary" id="change-pos-client-btn" style="padding:4px 8px; font-size:10px;">
                🆔 Cambiar
              </button>
            </div>

            <!-- Datos Ocultos para Formulario -->
            <input type="hidden" id="pos-client-name" value="${posCustomerName}">
            <input type="hidden" id="pos-client-ci-num" value="${posCustomerCi}">
            <input type="hidden" id="pos-client-email" value="${posCustomerEmail}">
            <input type="hidden" id="pos-client-phone" value="${posCustomerPhone}">
            <input type="hidden" id="pos-is-pending" value="${posIsPending ? '1' : '0'}">

            <!-- Módulo de Métodos de Pago Combinados / Mixtos -->
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label class="form-label" style="font-size:10px; text-transform:uppercase; font-weight:700; margin:0;">💳 Métodos de Pago *</label>
                <button type="button" class="btn btn-secondary" id="add-pos-payment-line-btn" style="padding:3px 8px; font-size:10px; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); color:#818cf8; font-weight:700;">
                  ➕ Añadir Otro Método
                </button>
              </div>

              <div id="pos-payment-lines-container" style="display:flex; flex-direction:column; gap:8px;">
                ${posPaymentLines.map((line, idx) => `
                  <div class="pos-payment-row" data-index="${idx}" style="display:grid; grid-template-columns: 1fr auto auto; gap:6px; align-items:center; background:rgba(0,0,0,0.2); padding:6px; border-radius:8px; border:1px solid var(--border-glass);">
                    <select class="form-control pos-pay-method-select" data-index="${idx}" style="padding:4px 6px; font-size:11px; font-weight:700;">
                      <option value="efectivo_usd" ${line.method === 'efectivo_usd' ? 'selected' : ''}>💵 Efectivo USD ($)</option>
                      <option value="pago_movil" ${line.method === 'pago_movil' ? 'selected' : ''}>📱 Pago Móvil (Bs.)</option>
                      <option value="punto_de_venta" ${line.method === 'punto_de_venta' ? 'selected' : ''}>💳 Punto de Venta (Bs.)</option>
                      <option value="transferencia_ves" ${line.method === 'transferencia_ves' ? 'selected' : ''}>🏛️ Transferencia (Bs.)</option>
                      <option value="zelle" ${line.method === 'zelle' ? 'selected' : ''}>💸 Zelle ($)</option>
                      <option value="binance" ${line.method === 'binance' ? 'selected' : ''}>🟡 Binance Pay ($)</option>
                      <option value="efectivo_ves" ${line.method === 'efectivo_ves' ? 'selected' : ''}>💵 Efectivo Bs. (VES)</option>
                      <option value="paypal" ${line.method === 'paypal' ? 'selected' : ''}>🅿️ PayPal ($)</option>
                    </select>

                    <div style="display:flex; align-items:center; gap:3px;">
                      <span style="font-size:10px; color:var(--primary); font-weight:700;">$</span>
                      <input type="number" step="0.01" min="0" class="form-control pos-pay-amount-usd" data-index="${idx}" value="${line.amountUsd !== undefined && line.amountUsd > 0 ? line.amountUsd : ''}" placeholder="0.00" style="width:75px; padding:4px; font-size:11px; text-align:right; font-weight:700;">
                    </div>

                    ${posPaymentLines.length > 1 ? `
                      <button type="button" class="btn btn-danger remove-pos-payment-line" data-index="${idx}" style="padding:2px 6px; font-size:10px; background:rgba(239,68,68,0.2); color:#f87171; border:none;" title="Quitar método">✕</button>
                    ` : '<div style="width:16px;"></div>'}
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Descuento Dual (% y $) -->
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="form-label" style="font-size:10px; font-weight:700;">Descuento</label>
              <div style="display:flex; align-items:center; gap:6px;">
                <input type="number" step="0.1" min="0" max="100" class="form-control" id="pos-discount-percent" placeholder="0%" style="font-size:12px; padding:6px; text-align:right;">
                <span>=</span>
                <input type="number" step="0.01" min="0" class="form-control" id="pos-discount-input" placeholder="$ 0.00" value="${posDiscount > 0 ? posDiscount : ''}" style="font-size:12px; padding:6px; text-align:right;">
              </div>
            </div>

            <!-- Sección Desplegable: Detalles del Comprobante -->
            <div style="border:1px solid var(--border-glass); border-radius:10px; padding:8px 12px; background:rgba(255,255,255,0.01);">
              <div id="toggle-receipt-details-btn" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-size:11px; font-weight:700; color:var(--text-secondary);">
                <span>Detalles del comprobante</span>
                <span id="receipt-details-arrow">▼</span>
              </div>

              <div id="receipt-details-body" style="display:none; margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                <div class="form-group">
                  <label class="form-label" style="font-size:10px;">Concepto del comprobante (Opcional)</label>
                  <input type="text" class="form-control" id="pos-concept-input" placeholder="Ej. Venta de productos / Servicios" style="font-size:12px; padding:6px 10px;">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size:10px;">Nota del comprobante (Opcional)</label>
                  <textarea class="form-control" id="pos-note-input" rows="2" placeholder="Ej. Entregado en tienda..." style="font-size:12px; padding:6px 10px;"></textarea>
                </div>
              </div>
            </div>

            <!-- Resumen de Pago -->
            <div style="border-top:1px solid var(--border-glass); padding-top:10px; display:flex; flex-direction:column; gap:4px; font-size:12px;">
              <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
                <span>Equivalente en bolívares</span>
                <strong style="color:#f59e0b;">Bs. ${(posTotal * rateUsdToVes).toFixed(2)}</strong>
              </div>
            </div>

            <!-- Botón Principal de Cobro (Crear Venta) -->
            <div style="display:flex; gap:8px; align-items:center;">
              <button type="button" class="btn btn-secondary" id="pos-print-preview-btn" style="padding:10px 12px; font-size:14px; background:rgba(255,255,255,0.05);" title="Imprimir / Vista Previa">
                🖨️
              </button>
              <button type="submit" class="btn btn-primary" id="pos-submit-btn" ${posCart.length === 0 ? 'disabled' : ''} style="flex-grow:1; padding:12px; font-size:14px; font-weight:800; background:#111827; border:1px solid var(--primary); display:flex; justify-content:space-between; align-items:center;">
                <span>🛒 Crear venta</span>
                <span style="color:var(--primary); font-size:15px;">$${posTotal.toFixed(2)} ›</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      ${!posClientIdentified && !posLoadedQuotationId ? `
        <div class="modal-overlay open" id="pos-id-modal" style="z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);">
          <div class="modal-content animate-on-scroll animate-zoom-in visible" style="max-width: 460px; width: 90%; padding: 28px; border-radius: 16px; border: 1px solid var(--border-glass); background: #111827;">
            <div style="font-size: 38px; text-align: center; margin-bottom: 6px;">🆔</div>
            <h3 style="font-size: 20px; font-weight: 800; text-align: center; margin-bottom: 4px;">Identificación del Cliente</h3>
            <p style="font-size: 12px; color: var(--text-secondary); text-align: center; margin-bottom: 20px;">
              Ingrese la Cédula o RIF para buscar y cargar los datos del cliente en el POS.
            </p>

            <form id="pos-id-search-form" class="mb-4">
              <div class="form-group mb-3">
                <label class="form-label" style="font-size: 11px; text-transform: uppercase; font-weight: 700;">Cédula de Identidad / RIF</label>
                <div style="display: flex; gap: 8px;">
                  <select class="form-control" id="pos-id-prefix" style="width: 80px; font-weight: 700; flex-shrink: 0; font-size: 14px;">
                    <option value="V-">V-</option>
                    <option value="E-">E-</option>
                    <option value="J-">J-</option>
                    <option value="G-">G-</option>
                  </select>
                  <input type="text" class="form-control" id="pos-id-num" placeholder="Ej. 12345678" pattern="\\d{5,10}" title="Ingrese de 5 a 10 dígitos numéricos" required style="flex-grow: 1; font-size: 15px; font-weight: 600;">
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                <button type="submit" class="btn btn-primary" id="pos-id-submit-btn" style="padding: 10px; font-size: 13px; font-weight: 700; flex:1;">
                  🔍 Buscar Cliente
                </button>
                <button type="button" class="btn btn-success" id="pos-id-register-btn" style="padding: 10px; font-size: 13px; font-weight: 700; background:#6366f1; border-color:#6366f1; flex:1;">
                  ➕ Registrar Nuevo
                </button>
              </div>
            </form>

            <div style="position: relative; text-align: center; margin: 18px 0;">
              <hr style="border: 0; border-top: 1px solid var(--border-glass);">
              <span style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #111827; padding: 0 10px; font-size: 10px; color: var(--text-muted); text-transform: uppercase;">
                O continuar sin registrar
              </span>
            </div>

            <button type="button" class="btn btn-secondary w-100" id="pos-id-skip-btn" style="padding: 10px; font-size: 12px; font-weight: 600;">
              👤 Consumidor Final (Usuario No Registrado)
            </button>
          </div>
        </div>
      ` : ''}

      ${showRegisterCustomerModal ? `
        <div class="modal-overlay open" id="register-customer-modal-overlay" style="z-index: 99999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);">
          <div class="modal-content animate-on-scroll animate-zoom-in visible" style="max-width: 520px; width: 92%; padding: 24px; border-radius: 16px; border: 1px solid var(--primary); background: #111827; max-height:90vh; overflow-y:auto;">
            <div style="font-size: 36px; text-align: center; margin-bottom: 4px;">👤</div>
            <h3 style="font-size: 20px; font-weight: 800; text-align: center; margin-bottom: 4px; color: var(--primary);">Registrar Nuevo Cliente</h3>
            <p style="font-size: 11px; color: var(--text-secondary); text-align: center; margin-bottom: 16px;">
              Seleccione el tipo de documento e ingrese los datos oficiales del cliente.
            </p>

            <form id="register-customer-form">
              <div class="form-group mb-3">
                <label class="form-label" style="font-size: 11px; font-weight: 700;">Tipo de Documento / Persona *</label>
                <div style="display: flex; gap: 8px;">
                  <select class="form-control" id="reg-cust-ci-prefix" style="width: 130px; font-weight: 700; flex-shrink: 0; font-size: 13px;">
                    <option value="V-">V- Natural (Ven)</option>
                    <option value="E-">E- Natural (Ext)</option>
                    <option value="J-">J- Jurídico (Empresa)</option>
                    <option value="G-">G- Gubernamental</option>
                    <option value="P-">P- Pasaporte</option>
                  </select>
                  <input type="text" class="form-control" id="reg-cust-ci-num" placeholder="Ej. 12345678 o 12345678-9" required style="flex-grow: 1; font-size: 14px; font-weight: 600;">
                </div>
              </div>

              <div class="form-group mb-3">
                <label class="form-label" id="reg-cust-name-label" style="font-size: 11px; font-weight: 700;">Nombre Completo / Razón Social *</label>
                <input type="text" class="form-control" id="reg-cust-name" placeholder="Ej. Juan Pérez / Inversiones C.A." required style="font-size: 13px;">
              </div>

              <div class="grid-2 gap-2 mb-3">
                <div class="form-group">
                  <label class="form-label" style="font-size: 11px; font-weight: 700;">Teléfono Principal</label>
                  <input type="text" class="form-control" id="reg-cust-phone" placeholder="Ej. 04141234567" style="font-size: 13px;">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size: 11px; font-weight: 700;">Correo Electrónico</label>
                  <input type="email" class="form-control" id="reg-cust-email" placeholder="cliente@correo.com" style="font-size: 13px;">
                </div>
              </div>

              <!-- Sección Dinámica: Datos del Encargado / Representante (Aparece cuando es J- o G-) -->
              <div id="reg-cust-rep-box" style="display: none; background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 800; color: #818cf8; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                  👔 Datos del Encargado / Representante Legal
                </div>
                
                <div class="form-group mb-3">
                  <label class="form-label" style="font-size: 10px; font-weight: 700;">Nombre y Apellido del Encargado *</label>
                  <input type="text" class="form-control" id="reg-cust-rep-name" placeholder="Ej. Carlos Mendoza" style="font-size: 12px;">
                </div>

                <div class="grid-2 gap-2 mb-3">
                  <div class="form-group">
                    <label class="form-label" style="font-size: 10px; font-weight: 700;">Cédula del Encargado</label>
                    <div style="display: flex; gap: 4px;">
                      <select class="form-control" id="reg-cust-rep-ci-prefix" style="width: 65px; font-size: 11px; font-weight: 700;">
                        <option value="V-">V-</option>
                        <option value="E-">E-</option>
                      </select>
                      <input type="text" class="form-control" id="reg-cust-rep-ci-num" placeholder="Ej. 12345678" style="font-size: 12px;">
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size: 10px; font-weight: 700;">Teléfono Encargado</label>
                    <input type="text" class="form-control" id="reg-cust-rep-phone" placeholder="Ej. 04129876543" style="font-size: 12px;">
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" style="font-size: 10px; font-weight: 700;">Cargo / Departamento</label>
                  <input type="text" class="form-control" id="reg-cust-rep-position" placeholder="Ej. Gerente de Compras / Director" style="font-size: 12px;">
                </div>
              </div>

              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-secondary w-50" id="close-register-customer-btn" style="padding: 10px; font-size: 12px;">Cancelar</button>
                <button type="submit" class="btn btn-primary w-50" style="padding: 10px; font-size: 12px; font-weight: 700;">💾 Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}

      ${showFreeSaleModal ? `
        <div class="modal-overlay open" id="free-sale-modal-overlay" style="z-index: 99999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);">
          <div class="modal-content animate-on-scroll animate-zoom-in visible" style="max-width: 440px; width: 90%; padding: 24px; border-radius: 16px; border: 1px solid var(--border-glass); background: #111827;">
            <div style="font-size: 36px; text-align: center; margin-bottom: 4px;">➕</div>
            <h3 style="font-size: 18px; font-weight: 800; text-align: center; margin-bottom: 4px; color: #f59e0b;">Agregar Venta Libre</h3>
            <p style="font-size: 11px; color: var(--text-secondary); text-align: center; margin-bottom: 16px;">
              Esta opción permite facturar artículos o servicios no registrados en el catálogo oficial.
            </p>

            <form id="free-sale-form">
              <div class="form-group mb-3">
                <label class="form-label" style="font-size: 11px; font-weight: 700;">Nombre / Descripción del Producto</label>
                <input type="text" class="form-control" id="free-sale-name" placeholder="Ej. Servicio Técnico / Producto Especial" required style="font-size: 13px;">
              </div>

              <div class="grid-2 gap-2 mb-4">
                <div class="form-group">
                  <label class="form-label" style="font-size: 11px; font-weight: 700;">Precio USD ($)</label>
                  <input type="number" step="0.01" min="0.01" class="form-control" id="free-sale-price" placeholder="0.00" required style="font-size: 13px;">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size: 11px; font-weight: 700;">Cantidad</label>
                  <input type="number" min="1" value="1" class="form-control" id="free-sale-qty" required style="font-size: 13px;">
                </div>
              </div>

              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-secondary w-50" id="close-free-sale-btn" style="padding: 8px; font-size: 12px;">Cancelar</button>
                <button type="submit" class="btn btn-primary w-50" style="padding: 8px; font-size: 12px; font-weight: 700; background: #f59e0b; border-color: #f59e0b; color: black;">➕ Agregar al POS</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}

      <!-- Modal de Advertencia por Cliente No Registrado -->
      <div class="modal-overlay" id="unregistered-warning-modal" style="display: none; z-index: 999999; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);">
        <div class="modal-content animate-on-scroll animate-zoom-in visible" style="max-width: 480px; width: 90%; padding: 28px; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.5); background: #111827;">
          <div style="font-size: 42px; text-align: center; margin-bottom: 6px;">⚠️</div>
          <h3 style="font-size: 20px; font-weight: 800; text-align: center; color: var(--danger); margin-bottom: 6px;">Advertencia de Cliente No Registrado</h3>
          <p style="font-size: 12px; color: var(--text-secondary); text-align: center; line-height: 1.5; margin-bottom: 18px;">
            Ha elegido facturar a <strong>"Consumidor Final"</strong> sin registrar la Cédula ni Nombre del cliente.
          </p>

          <div style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.25); font-size: 12px; color: #f87171; font-weight: 600; margin-bottom: 20px; text-align: center; line-height: 1.4;">
            🚫 <strong>AVISO DE GARANTÍA:</strong> Las compras a clientes no registrados <u>NO gozan de garantía del sistema</u> ni derecho a reclamos, devoluciones o soporte posterior.
          </div>

          <div style="display: flex; gap: 10px; flex-direction: column;">
            <button type="button" class="btn btn-secondary w-100" id="cancel-unregistered-sale-btn" style="padding: 10px; font-weight: 700; font-size: 13px;">
              ✍️ Cancelar y Registrar Datos del Cliente
            </button>
            <button type="button" class="btn btn-danger w-100" id="confirm-unregistered-sale-btn" style="padding: 10px; font-weight: 700; font-size: 13px; background: var(--danger);">
              ⚠️ Continuar Venta Sin Garantía
            </button>
          </div>
        </div>
      </div>

      ${showExpenseModal ? `
        <div class="modal-overlay open" id="expense-modal-overlay" style="z-index: 99999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);">
          <div class="modal-content animate-on-scroll animate-zoom-in visible" style="max-width: 440px; width: 90%; padding: 24px; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.4); background: #111827;">
            <div style="font-size: 36px; text-align: center; margin-bottom: 4px;">🔴</div>
            <h3 style="font-size: 18px; font-weight: 800; text-align: center; margin-bottom: 4px; color: #f87171;">Registrar Nuevo Gasto de Caja</h3>
            <p style="font-size: 11px; color: var(--text-secondary); text-align: center; margin-bottom: 16px;">
              Registra egresos de dinero o gastos operativos en el sistema POS.
            </p>

            <form id="expense-form">
              <div class="form-group mb-3">
                <label class="form-label" style="font-size: 11px; font-weight: 700;">Concepto del Gasto</label>
                <input type="text" class="form-control" id="expense-title" placeholder="Ej. Pago de Transporte / Compra de Insumos" required style="font-size: 13px;">
              </div>

              <div class="form-group mb-3">
                <label class="form-label" style="font-size: 11px; font-weight: 700;">Monto del Gasto ($)</label>
                <input type="number" step="0.01" min="0.01" class="form-control" id="expense-amount" placeholder="0.00" required style="font-size: 13px;">
              </div>

              <div class="form-group mb-4">
                <label class="form-label" style="font-size: 11px; font-weight: 700;">Detalle / Observaciones (Opcional)</label>
                <textarea class="form-control" id="expense-details" rows="2" placeholder="Observaciones adicionales..." style="font-size: 12px;"></textarea>
              </div>

              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-secondary w-50" id="close-expense-btn" style="padding: 8px; font-size: 12px;">Cancelar</button>
                <button type="submit" class="btn btn-danger w-50" style="padding: 8px; font-size: 12px; font-weight: 700; background: #ef4444;">🔴 Guardar Gasto</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    `;

    bindPOSEvents();

  } catch (error: any) {
    console.error('Error al cargar POS:', error);
    panel.innerHTML = `
      <div class="card text-center" style="color:var(--danger); padding:40px;">
        <h3 style="font-weight:700;">No se pudo cargar el punto de venta (POS)</h3>
        <p style="font-size:13px; margin-top:8px; opacity:0.8;">${error?.message || 'Error al comunicarse con el servidor'}</p>
      </div>
    `;
  }
}

function bindPOSEvents() {
  // Abrir Modal de Registro de Cliente desde Header o POS ID
  document.getElementById('open-register-customer-btn')?.addEventListener('click', async () => {
    showRegisterCustomerModal = true;
    await renderAdminPOS();
  });

  document.getElementById('pos-id-register-btn')?.addEventListener('click', async () => {
    showRegisterCustomerModal = true;
    await renderAdminPOS();
  });

  document.getElementById('close-register-customer-btn')?.addEventListener('click', async () => {
    showRegisterCustomerModal = false;
    await renderAdminPOS();
  });

  // Mostrar / ocultar datos del encargado al cambiar tipo de documento (J- o G-)
  const ciPrefixSelect = document.getElementById('reg-cust-ci-prefix') as HTMLSelectElement;
  ciPrefixSelect?.addEventListener('change', () => {
    const val = ciPrefixSelect.value;
    const repBox = document.getElementById('reg-cust-rep-box');
    const nameLabel = document.getElementById('reg-cust-name-label');
    const nameInput = document.getElementById('reg-cust-name') as HTMLInputElement;

    if (val === 'J-' || val === 'G-') {
      if (repBox) repBox.style.display = 'block';
      if (nameLabel) nameLabel.innerText = val === 'J-' ? 'Razón Social / Nombre de la Empresa *' : 'Nombre del Ente / Institución Gubernamental *';
      if (nameInput) nameInput.placeholder = val === 'J-' ? 'Ej. Inversiones 2020 C.A.' : 'Ej. Alcaldía de Maracaibo / Gobernación';
    } else {
      if (repBox) repBox.style.display = 'none';
      if (nameLabel) nameLabel.innerText = 'Nombre Completo del Cliente *';
      if (nameInput) nameInput.placeholder = 'Ej. Juan Pérez';
    }
  });

  // Guardar Nuevo Cliente desde Modal
  document.getElementById('register-customer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prefix = (document.getElementById('reg-cust-ci-prefix') as HTMLSelectElement).value;
    const num = (document.getElementById('reg-cust-ci-num') as HTMLInputElement).value.trim();
    const ci = `${prefix}${num}`;
    const name = (document.getElementById('reg-cust-name') as HTMLInputElement).value.trim();
    const phone = (document.getElementById('reg-cust-phone') as HTMLInputElement).value.trim();
    const email = (document.getElementById('reg-cust-email') as HTMLInputElement).value.trim();

    const isLegalEntity = (prefix === 'J-' || prefix === 'G-');
    const client_type = prefix === 'J-' ? 'juridico' : prefix === 'G-' ? 'gubernamental' : 'natural';

    let repName: string | undefined = undefined;
    let repCi: string | undefined = undefined;
    let repPhone: string | undefined = undefined;
    let repPosition: string | undefined = undefined;

    if (isLegalEntity) {
      const repNameVal = (document.getElementById('reg-cust-rep-name') as HTMLInputElement)?.value.trim();
      const repCiPrefix = (document.getElementById('reg-cust-rep-ci-prefix') as HTMLSelectElement)?.value || 'V-';
      const repCiNum = (document.getElementById('reg-cust-rep-ci-num') as HTMLInputElement)?.value.trim();
      const repPhoneVal = (document.getElementById('reg-cust-rep-phone') as HTMLInputElement)?.value.trim();
      const repPosVal = (document.getElementById('reg-cust-rep-position') as HTMLInputElement)?.value.trim();

      if (repNameVal) repName = repNameVal;
      if (repCiNum) repCi = `${repCiPrefix}${repCiNum}`;
      if (repPhoneVal) repPhone = repPhoneVal;
      if (repPosVal) repPosition = repPosVal;
    }

    try {
      const res = await api.auth.registerCustomer({
        name,
        ci,
        phone: phone || undefined,
        email: email || undefined,
        client_type,
        representative_name: repName,
        representative_ci: repCi,
        representative_phone: repPhone,
        representative_position: repPosition
      });

      posSelectedCustomerId = res.user.id;
      posCustomerName = res.user.name;
      posCustomerCi = res.user.ci || ci;
      posCustomerPhone = res.user.phone || phone || '';
      posCustomerEmail = res.user.email || email || '';
      posClientIdentified = true;
      showRegisterCustomerModal = false;

      alert(`¡Cliente "${res.user.name}" registrado y seleccionado con éxito!`);
      await renderAdminPOS();
    } catch (err: any) {
      alert(err.message || 'Error al registrar cliente');
    }
  });

  // Eventos Modal de Identificación del Cliente (POS Step 1)
  document.getElementById('pos-id-search-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prefix = (document.getElementById('pos-id-prefix') as HTMLSelectElement).value;
    const num = (document.getElementById('pos-id-num') as HTMLInputElement).value.trim();
    const fullCi = `${prefix}${num}`;
    const btn = document.getElementById('pos-id-submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Buscando...';

    try {
      const customer = await api.auth.getCustomerByCi(fullCi);
      posSelectedCustomerId = customer.id;
      posCustomerName = customer.name;
      posCustomerEmail = customer.email || '';
      posCustomerPhone = customer.phone || '';
      posCustomerCi = customer.ci || fullCi;
      posClientIdentified = true;

      alert(`¡Cliente Identificado Con Éxito!\n\nNombre: ${customer.name}\nCédula: ${customer.ci}\nCorreo: ${customer.email || 'N/D'}`);
      await renderAdminPOS();
    } catch (err: any) {
      if (confirm(`No se encontró ningún cliente registrado con la Cédula/RIF "${fullCi}".\n\n¿Desea registrarlo como nuevo cliente ahora?`)) {
        showRegisterCustomerModal = true;
        await renderAdminPOS();
        setTimeout(() => {
          const ciPrefixIn = document.getElementById('reg-cust-ci-prefix') as HTMLSelectElement;
          const ciNumIn = document.getElementById('reg-cust-ci-num') as HTMLInputElement;
          if (ciPrefixIn) ciPrefixIn.value = prefix;
          if (ciNumIn) ciNumIn.value = num;
        }, 100);
      } else {
        posCustomerName = 'Consumidor Final';
        posCustomerCi = fullCi;
        posSelectedCustomerId = null;
        posClientIdentified = true;
        await renderAdminPOS();
      }
    }
  });

  document.getElementById('pos-id-skip-btn')?.addEventListener('click', async () => {
    posSelectedCustomerId = null;
    posCustomerName = 'Consumidor Final';
    posCustomerCi = '';
    posCustomerEmail = '';
    posCustomerPhone = '';
    posClientIdentified = true;
    await renderAdminPOS();
  });

  document.getElementById('change-pos-client-btn')?.addEventListener('click', async () => {
    posClientIdentified = false;
    await renderAdminPOS();
  });

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

  // Seleccionar Cliente
  const clientSelect = document.getElementById('pos-client-select') as HTMLSelectElement;
  clientSelect?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    const ciPrefixInput = document.getElementById('pos-client-ci-prefix') as HTMLSelectElement;
    const ciNumInput = document.getElementById('pos-client-ci-num') as HTMLInputElement;

    if (val) {
      posSelectedCustomerId = parseInt(val);
      const client = posCustomersList.find(c => c.id === posSelectedCustomerId);
      if (client) {
        (document.getElementById('pos-client-name') as HTMLInputElement).value = client.name;
        (document.getElementById('pos-client-email') as HTMLInputElement).value = client.email;
        (document.getElementById('pos-client-phone') as HTMLInputElement).value = client.phone || '';
        if (client.ci) {
          const parts = client.ci.split('-');
          if (parts.length === 2) {
            if (ciPrefixInput) ciPrefixInput.value = `${parts[0]}-`;
            if (ciNumInput) ciNumInput.value = parts[1];
          } else if (ciNumInput) {
            ciNumInput.value = client.ci;
          }
        } else if (ciNumInput) {
          ciNumInput.value = '';
        }
      }
    } else {
      posSelectedCustomerId = null;
      (document.getElementById('pos-client-name') as HTMLInputElement).value = 'Consumidor Final';
      (document.getElementById('pos-client-email') as HTMLInputElement).value = '';
      (document.getElementById('pos-client-phone') as HTMLInputElement).value = '';
      if (ciNumInput) ciNumInput.value = '';
    }
  });

  // Descuento Fijo
  const discountInput = document.getElementById('pos-discount-input') as HTMLInputElement;
  discountInput?.addEventListener('change', async (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    posDiscount = isNaN(val) ? 0 : val;
    await renderAdminPOS();
  });

  // Aplicar Cupón
  const applyCouponBtn = document.getElementById('pos-apply-coupon-btn');
  applyCouponBtn?.addEventListener('click', async () => {
    const code = (document.getElementById('pos-coupon-input') as HTMLInputElement).value.trim();
    if (!code) {
      alert('Ingrese un código de cupón');
      return;
    }
    try {
      const coupon = await api.sales.validateCoupon(code, posSelectedCustomerId || undefined);
      posCouponCode = coupon.code;
      posCouponDiscountPercent = Number(coupon.discount_percent);
      alert(`¡Cupón ${coupon.code} aplicado! (${coupon.discount_percent}% de descuento)`);
      await renderAdminPOS();
    } catch (err: any) {
      alert(err.message || 'Cupón inválido o inactivo');
    }
  });

  // Toggle IVA
  const applyTaxCheckbox = document.getElementById('pos-apply-tax') as HTMLInputElement;
  applyTaxCheckbox?.addEventListener('change', async (e) => {
    posApplyTax = (e.target as HTMLInputElement).checked;
    await renderAdminPOS();
  });

  // Toggle Deuda y Abono Inicial
  const isPendingCheckbox = document.getElementById('pos-is-pending') as HTMLInputElement;
  const initialPaymentBox = document.getElementById('pos-initial-payment-box');
  const initialPaymentInput = document.getElementById('pos-initial-payment-input') as HTMLInputElement;

  isPendingCheckbox?.addEventListener('change', (e) => {
    posIsPending = (e.target as HTMLInputElement).checked;
    if (initialPaymentBox) {
      initialPaymentBox.style.display = posIsPending ? 'block' : 'none';
    }
  });

  initialPaymentInput?.addEventListener('change', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    posInitialPayment = isNaN(val) ? 0 : val;
  });

  // Toggle Cotización
  const isQuotationCheckbox = document.getElementById('pos-is-quotation') as HTMLInputElement;
  isQuotationCheckbox?.addEventListener('change', (e) => {
    const isQuote = (e.target as HTMLInputElement).checked;
    const submitBtn = document.getElementById('pos-submit-btn');
    if (submitBtn) {
      submitBtn.innerText = isQuote ? 'Generar Cotización al Mayor' : 'Registrar Venta POS';
    }
  });

  // Eventos Modal de Gasto
  document.getElementById('open-expense-btn')?.addEventListener('click', async () => {
    showExpenseModal = true;
    await renderAdminPOS();
  });

  document.getElementById('close-expense-btn')?.addEventListener('click', async () => {
    showExpenseModal = false;
    await renderAdminPOS();
  });

  document.getElementById('expense-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = (document.getElementById('expense-title') as HTMLInputElement).value;
    const amount = parseFloat((document.getElementById('expense-amount') as HTMLInputElement).value);
    const details = (document.getElementById('expense-details') as HTMLTextAreaElement).value;

    if (!title || isNaN(amount) || amount <= 0) {
      alert('Por favor ingrese un concepto y monto válidos.');
      return;
    }

    alert(`🔴 Gasto de Caja Registrado con Éxito:\n\nConcepto: ${title}\nMonto: $${amount.toFixed(2)}\nDetalle: ${details || 'Sin observaciones'}`);
    showExpenseModal = false;
    await renderAdminPOS();
  });

  // Eventos Venta Libre (Producto No Registrado)
  document.getElementById('open-free-sale-btn')?.addEventListener('click', async () => {
    showFreeSaleModal = true;
    await renderAdminPOS();
  });

  document.getElementById('close-free-sale-btn')?.addEventListener('click', async () => {
    showFreeSaleModal = false;
    await renderAdminPOS();
  });

  document.getElementById('free-sale-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal = (document.getElementById('free-sale-name') as HTMLInputElement).value;
    const priceVal = parseFloat((document.getElementById('free-sale-price') as HTMLInputElement).value);
    const qtyVal = parseInt((document.getElementById('free-sale-qty') as HTMLInputElement).value);

    if (!nameVal || isNaN(priceVal) || priceVal <= 0) {
      alert('Por favor ingrese un nombre y precio válidos para la venta libre.');
      return;
    }

    posCart.push({
      product: {
        id: -Date.now(),
        name: nameVal.trim(),
        price: priceVal,
        category: 'Venta Libre',
        stock: 999,
        description: 'Producto no registrado en inventario',
        image_url: ''
      },
      quantity: isNaN(qtyVal) || qtyVal <= 0 ? 1 : qtyVal
    });

    showFreeSaleModal = false;
    await renderAdminPOS();
  });

  // Eventos Modal de Advertencia Cliente No Registrado
  document.getElementById('cancel-unregistered-sale-btn')?.addEventListener('click', () => {
    const warningModal = document.getElementById('unregistered-warning-modal');
    if (warningModal) warningModal.style.display = 'none';
    const nameInput = document.getElementById('pos-client-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  });

  document.getElementById('confirm-unregistered-sale-btn')?.addEventListener('click', () => {
    const warningModal = document.getElementById('unregistered-warning-modal');
    if (warningModal) warningModal.style.display = 'none';
    posConfirmedUnregisteredWarning = true;
    const form = document.getElementById('pos-checkout-form') as HTMLFormElement;
    form?.requestSubmit();
  });

  // Vaciar Canasta
  document.getElementById('clear-pos-cart-btn')?.addEventListener('click', async () => {
    posCart = [];
    await renderAdminPOS();
  });

  // Eliminar Item de Canasta
  document.querySelectorAll('.remove-pos-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      posCart = posCart.filter(item => item.product.id !== id);
      await renderAdminPOS();
    });
  });

  // Cambiar Precio Unitario de Item en Canasta
  document.querySelectorAll('.change-pos-price').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = parseInt((e.currentTarget as HTMLInputElement).dataset.id || '0');
      const val = parseFloat((e.currentTarget as HTMLInputElement).value);
      const item = posCart.find(i => i.product.id === id);
      if (item && !isNaN(val) && val >= 0) {
        item.product.price = val;
        await renderAdminPOS();
      }
    });
  });

  // Toggle Pagada vs A Crédito
  document.getElementById('pos-type-paid-btn')?.addEventListener('click', async () => {
    posIsPending = false;
    await renderAdminPOS();
  });
  document.getElementById('pos-type-credit-btn')?.addEventListener('click', async () => {
    posIsPending = true;
    await renderAdminPOS();
  });

  // Selección Visual de Método de Pago (Cards)
  document.querySelectorAll('.pay-card').forEach(card => {
    card.addEventListener('click', (e) => {
      document.querySelectorAll('.pay-card').forEach(c => {
        c.classList.remove('active');
        (c as HTMLElement).style.border = '1px solid var(--border-glass)';
        (c as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
      });
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      target.style.border = '1px solid var(--primary)';
      target.style.background = 'rgba(99,102,241,0.1)';
      const method = target.dataset.method || 'efectivo_usd';
      (document.getElementById('pos-client-payment') as HTMLInputElement).value = method;
    });
  });

  // Descuento por Porcentaje %
  document.getElementById('pos-discount-percent')?.addEventListener('input', async (e) => {
    const pct = parseFloat((e.target as HTMLInputElement).value);
    const posSubtotal = posCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    if (!isNaN(pct) && pct >= 0 && posSubtotal > 0) {
      posDiscount = posSubtotal * (pct / 100);
    } else if (isNaN(pct)) {
      posDiscount = 0;
    }
    const fixedInput = document.getElementById('pos-discount-input') as HTMLInputElement;
    if (fixedInput) fixedInput.value = posDiscount > 0 ? posDiscount.toFixed(2) : '';
  });

  // Desplegable Detalles del Comprobante (Concepto y Nota)
  document.getElementById('toggle-receipt-details-btn')?.addEventListener('click', () => {
    const body = document.getElementById('receipt-details-body');
    const arrow = document.getElementById('receipt-details-arrow');
    if (body) {
      const isHidden = body.style.display === 'none' || body.style.display === '';
      body.style.display = isHidden ? 'flex' : 'none';
      if (arrow) arrow.innerText = isHidden ? '▲' : '▼';
    }
  });

  // Refrescar Tasa Inline
  document.getElementById('refresh-inline-rate-btn')?.addEventListener('click', async () => {
    try {
      const res = await api.sales.syncExchangeRates();
      rateUsdToVes = res.rates.usdToVes;
      await renderAdminPOS();
      alert(`Tasa BCV sincronizada: Bs. ${rateUsdToVes.toFixed(2)}`);
    } catch (e: any) {
      alert('Error al sincronizar tasa BCV');
    }
  });

  // Enviar Venta POS
  document.getElementById('pos-checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('pos-client-name') as HTMLInputElement).value;
    const email = (document.getElementById('pos-client-email') as HTMLInputElement).value;
    const phone = (document.getElementById('pos-client-phone') as HTMLInputElement).value;
    const ciPrefix = (document.getElementById('pos-client-ci-prefix') as HTMLSelectElement)?.value || 'V-';
    const ciNum = (document.getElementById('pos-client-ci-num') as HTMLInputElement)?.value.trim() || '';
    const customerCi = ciNum ? `${ciPrefix}${ciNum}` : undefined;
    const payment = (document.getElementById('pos-client-payment') as HTMLInputElement).value;

    const concept = (document.getElementById('pos-concept-input') as HTMLInputElement)?.value.trim() || undefined;
    const note = (document.getElementById('pos-note-input') as HTMLTextAreaElement)?.value.trim() || undefined;

    const isQuotation = (document.getElementById('pos-is-quotation') as HTMLInputElement)?.checked || false;
    const isPending = (document.getElementById('pos-is-pending') as HTMLInputElement)?.value === '1';

    // Validación de Cliente Registrado & Advertencia Sin Garantía
    const isCustomerDataProvided = name && name.trim() !== '' && name.toLowerCase() !== 'consumidor final' && ciNum && ciNum.trim() !== '';

    if (!isCustomerDataProvided && !posConfirmedUnregisteredWarning) {
      const warningModal = document.getElementById('unregistered-warning-modal');
      if (warningModal) warningModal.style.display = 'flex';
      return;
    }

    posConfirmedUnregisteredWarning = false;

    const items = posCart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      price: item.product.price,
      name: item.product.name,
      customName: item.product.id < 0 ? item.product.name : undefined
    }));

    const btn = document.getElementById('pos-submit-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Registrando...';

    // Totales finales a pasar
    const posSubtotal = posCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const couponDiscountAmount = posSubtotal * (posCouponDiscountPercent / 100);
    const totalDiscount = couponDiscountAmount + posDiscount;
    const taxableSubtotal = Math.max(0, posSubtotal - totalDiscount);
    const taxAmount = posApplyTax ? taxableSubtotal * 0.16 : 0;

    try {
      const result = await api.sales.checkoutPOS({
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerCi,
        customerUserId: posSelectedCustomerId || undefined,
        paymentMethod: payment,
        items,
        discount: totalDiscount,
        tax: taxAmount,
        isQuotation,
        status: isPending ? 'pending' : 'completed',
        amountPaid: posIsPending ? posInitialPayment : undefined,
        couponCode: posCouponCode || undefined,
        loadedQuotationId: posLoadedQuotationId || undefined,
        concept,
        note
      });

      // Venta exitosa, limpiar estados
      posCart = [];
      posSearchQuery = '';
      posSelectedCustomerId = null;
      posDiscount = 0;
      posApplyTax = true;
      posCouponCode = '';
      posCouponDiscountPercent = 0;
      posIsPending = false;
      posInitialPayment = 0;
      posLoadedQuotationId = null;
      posClientIdentified = false;
      posCustomerName = 'Consumidor Final';
      posCustomerCi = '';
      posCustomerEmail = '';
      posCustomerPhone = '';
      
      await loadProducts(); // recargar
      
      // Mostrar modal de éxito
      const itemsFormatted = items.map(item => {
        const prod = productsList.find(p => p.id === item.productId);
        return { name: prod ? prod.name : 'Producto', quantity: item.quantity, price: prod ? prod.price : 0 };
      });
      
      // Modificar temporalmente para ver si es cotización
      showInvoiceSuccess({
        ...result,
        customerName: name,
        is_quotation: isQuotation ? 1 : 0
      }, phone, email, itemsFormatted);

      // Renderizar POS de nuevo
      await renderAdminPOS();
    } catch (error: any) {
      alert(error.message || 'Error al registrar venta POS');
      btn.disabled = false;
      btn.innerText = isQuotation ? 'Generar Cotización al Mayor' : 'Registrar Venta POS';
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
let editingStaffId: number | null = null;
let adminProductsSearchQuery = '';
let adminProductsSearchDebounceTimer: number | undefined;

function getAdminFilteredProducts(): Product[] {
  const normalizedQuery = adminProductsSearchQuery.trim().toLowerCase();
  if (!normalizedQuery) return productsList;

  return productsList.filter(prod => {
    const haystack = [
      prod.name,
      prod.description,
      prod.category,
      prod.code,
      prod.id?.toString()
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

function renderAdminProductsRows(products: Product[]): string {
  return products.map(prod => `
    <tr>
      <td>
        <img src="${prod.image_url}" style="width:48px; height:48px; object-fit:cover; border-radius:8px;" alt="${prod.name}">
      </td>
      <td>
        <strong>${prod.name}</strong>
        ${prod.code ? `<br><small style="color:var(--primary); font-weight:600; font-size:11px;">🏷️ ${prod.code}</small>` : ''}
        <br><small style="color:var(--text-secondary); max-width:200px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${prod.description || ''}</small>
      </td>
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
  `).join('');
}

function bindProductTableActions() {
  document.querySelectorAll('.edit-prod-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      const prod = productsList.find(p => p.id === id);
      if (prod) {
        editingProductId = prod.id;
        const formTitle = document.getElementById('product-form-title');
        if (formTitle) formTitle.innerText = `Editar Producto: ${prod.name}`;

        const categorySelect = document.getElementById('prod-category-select') as HTMLSelectElement;
        const categoryCustomBox = document.getElementById('new-category-input-box');
        const categoryCustomInput = document.getElementById('prod-category-custom') as HTMLInputElement;

        (document.getElementById('prod-name') as HTMLInputElement).value = prod.name;

        const options = Array.from(categorySelect?.options || []).map(o => o.value);
        if (options.includes(prod.category)) {
          categorySelect.value = prod.category;
          if (categoryCustomBox) categoryCustomBox.style.display = 'none';
        } else {
          categorySelect.value = '__NEW_CATEGORY__';
          if (categoryCustomBox) categoryCustomBox.style.display = 'block';
          if (categoryCustomInput) categoryCustomInput.value = prod.category || '';
        }

        (document.getElementById('prod-code') as HTMLInputElement).value = prod.code || '';
        (document.getElementById('prod-desc') as HTMLTextAreaElement).value = prod.description || '';
        (document.getElementById('prod-price') as HTMLInputElement).value = prod.price.toString();
        (document.getElementById('prod-stock') as HTMLInputElement).value = prod.stock.toString();
        (document.getElementById('prod-img') as HTMLInputElement).value = prod.image_url || '';

        const fileInput = document.getElementById('prod-image-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        const formCard = document.getElementById('product-form-card');
        if (formCard) formCard.style.display = 'block';
        formCard?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

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

async function renderAdminProducts() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  const existingCategories = Array.from(new Set(productsList.map(p => p.category).filter(Boolean)));
  if (!existingCategories.includes('General')) existingCategories.push('General');

  const filteredProducts = getAdminFilteredProducts();

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
              <label class="form-label" for="prod-category-select">Categoría</label>
              <select class="form-control" id="prod-category-select" style="padding: 8px 12px; font-size:13px;">
                ${existingCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                <option value="__NEW_CATEGORY__" style="color:var(--primary); font-weight:700;">➕ Agregar nueva categoría...</option>
              </select>
              <div id="new-category-input-box" style="display:none; margin-top:6px;">
                <input type="text" class="form-control" id="prod-category-custom" placeholder="Escriba el nombre de la nueva categoría..." style="padding: 6px 10px; font-size: 12px;">
              </div>
            </div>
          </div>

          <div class="form-group mb-2">
            <label class="form-label" for="prod-code">Código de Barras / SKU (Opcional)</label>
            <input type="text" class="form-control" id="prod-code" placeholder="Ej. 7501009001 o SKU-AIR-M3">
          </div>

          <div class="form-group">
            <label class="form-label" for="prod-desc">Descripcion</label>
            <textarea class="form-control" id="prod-desc" rows="3" placeholder="Detalle del producto..."></textarea>
          </div>

          <!-- Calculadora Inteligente de Costo & Precio (Dólar Negro / Binance vs BCV) -->
          <div class="card mb-4" style="background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.25); padding: 14px; border-radius: 10px;">
            <div style="font-size: 13px; font-weight: 800; color: #f59e0b; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
              <span>🧮 Calculadora de Precio (Dólar Negro / Binance vs BCV)</span>
              <span style="font-size: 10px; opacity: 0.8; font-weight: 500;">Ajuste Automático a Dólar BCV</span>
            </div>
            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">
              Si compraste la mercancía a Tasa Paralela / Binance, ingresa el costo en dólar negro y las tasas de la fecha para calcular el porcentaje de recargo e imputarlo al precio final en Dólar BCV:
            </p>

            <div class="grid-3 gap-2 mb-3">
              <div class="form-group">
                <label class="form-label" style="font-size: 10px; font-weight: 700;">Fecha de Compra</label>
                <input type="date" class="form-control" id="calc-purchase-date" style="font-size: 12px; padding: 6px 10px;" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 10px; font-weight: 700;">Tasa BCV (Bs.)</label>
                <input type="number" step="0.01" min="0.01" class="form-control" id="calc-bcv-rate" style="font-size: 12px; padding: 6px 10px;" value="${rateUsdToVes}">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 10px; font-weight: 700; color: #f59e0b;">Tasa Compra Binance (Bs.)</label>
                <input type="number" step="0.01" min="0.01" class="form-control" id="calc-binance-rate" style="font-size: 12px; padding: 6px 10px; border-color: rgba(245,158,11,0.4); color: #f59e0b; font-weight: 700;" value="${rateBinanceToVes}">
              </div>
            </div>

            <div class="grid-3 gap-2 mb-3">
              <div class="form-group">
                <label class="form-label" style="font-size: 10px; font-weight: 700;">Costo en Dólar Negro ($)</label>
                <input type="number" step="0.01" min="0" class="form-control" id="calc-black-cost" style="font-size: 12px; padding: 6px 10px;" placeholder="Ej. 10.00">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 10px; font-weight: 700;">Margen Ganancia (%)</label>
                <input type="number" step="1" min="0" class="form-control" id="calc-profit-margin" style="font-size: 12px; padding: 6px 10px;" placeholder="0" value="0">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 10px; font-weight: 700; color: var(--success);">Diferencial Recargo (%)</label>
                <input type="text" readonly class="form-control" id="calc-markup-percent" style="font-size: 12px; padding: 6px 10px; font-weight: 700; color: var(--success);" value="0.00%">
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; border: 1px dashed var(--border-glass); display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Precio Resultante (Dólar BCV):</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--primary);" id="calc-result-price-display">$0.00</div>
              </div>
              <button type="button" class="btn btn-secondary" id="apply-calc-price-btn" style="font-size: 11px; padding: 6px 12px; background: var(--primary); color: white; border: none; font-weight: 700;">
                ⚡ Usar este Precio
              </button>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="prod-price">Precio Final en Dólar BCV ($)</label>
              <input type="number" class="form-control" id="prod-price" required step="0.01" min="0" placeholder="Ej. 11.00">
            </div>
            <div class="form-group">
              <label class="form-label" for="prod-stock">Stock Inicial</label>
              <input type="number" class="form-control" id="prod-stock" required min="0" placeholder="Ej. 10">
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="prod-image-file">Subir Imagen Local (Opcional)</label>
              <input type="file" class="form-control" id="prod-image-file" accept="image/*" style="padding: 6px 12px; font-size: 13px;">
            </div>
            <div class="form-group">
              <label class="form-label" for="prod-img">O Enlace Imagen (URL)</label>
              <input type="url" class="form-control" id="prod-img" placeholder="https://images.unsplash.com/...">
            </div>
          </div>

          <div class="flex justify-end gap-4 mt-4">
            <button type="button" class="btn btn-secondary" id="prod-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="prod-form-submit">Guardar Producto</button>
          </div>
        </form>
      </div>

      <div class="card mb-3" style="padding: 12px 14px;">
        <div class="flex align-center gap-2" style="flex-wrap: wrap;">
          <input type="text" class="form-control" id="admin-products-search" placeholder="Buscar por nombre, código, categoría..." value="${adminProductsSearchQuery}" style="max-width: 360px;">
          <button type="button" class="btn btn-secondary" id="admin-products-clear-search" style="padding: 8px 12px;">Limpiar</button>
        </div>
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
            <tbody id="admin-products-table-body">
              ${renderAdminProductsRows(filteredProducts)}
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
  const searchInput = document.getElementById('admin-products-search') as HTMLInputElement | null;
  const clearSearchBtn = document.getElementById('admin-products-clear-search') as HTMLButtonElement | null;
  const form = document.getElementById('product-form') as HTMLFormElement;
  const formTitle = document.getElementById('product-form-title');

  // Función para re-calcular precio en Dólar BCV según Tasa Dólar Negro vs BCV
  function updateProductPriceCalc() {
    const bcvInput = document.getElementById('calc-bcv-rate') as HTMLInputElement;
    const binanceInput = document.getElementById('calc-binance-rate') as HTMLInputElement;
    const blackCostInput = document.getElementById('calc-black-cost') as HTMLInputElement;
    const profitMarginInput = document.getElementById('calc-profit-margin') as HTMLInputElement;

    const bcvRate = parseFloat(bcvInput?.value || '0') || rateUsdToVes;
    const binanceRate = parseFloat(binanceInput?.value || '0') || rateBinanceToVes;
    const blackCost = parseFloat(blackCostInput?.value || '0') || 0;
    const profitMargin = parseFloat(profitMarginInput?.value || '0') || 0;

    if (bcvRate > 0 && binanceRate > 0) {
      const markupDiffRatio = (binanceRate - bcvRate) / bcvRate;
      const markupPercent = markupDiffRatio * 100;
      
      const markupDisplay = document.getElementById('calc-markup-percent') as HTMLInputElement;
      if (markupDisplay) {
        markupDisplay.value = `${markupPercent >= 0 ? '+' : ''}${markupPercent.toFixed(2)}%`;
      }

      if (blackCost > 0) {
        // Costo equivalente en dólar BCV
        const costUsdBcv = blackCost * (binanceRate / bcvRate);
        const finalPriceBcv = costUsdBcv * (1 + profitMargin / 100);

        const priceDisplay = document.getElementById('calc-result-price-display');
        if (priceDisplay) {
          priceDisplay.innerText = `$${finalPriceBcv.toFixed(2)}`;
        }

        // Auto-llenar el input de precio final del producto
        const prodPriceInput = document.getElementById('prod-price') as HTMLInputElement;
        if (prodPriceInput) {
          prodPriceInput.value = finalPriceBcv.toFixed(2);
        }
      }
    }
  }

  // Escuchar cambios de fecha para actualizar automáticamente las tasas de esa fecha sin recargar la página
  const handlePurchaseDateChange = async (e: Event) => {
    const selectedDate = (e.target as HTMLInputElement).value;
    if (selectedDate) {
      const bcvInput = document.getElementById('calc-bcv-rate') as HTMLInputElement;
      const binanceInput = document.getElementById('calc-binance-rate') as HTMLInputElement;

      try {
        const rates = await api.sales.getHistoricalExchangeRates(selectedDate);
        if (bcvInput && rates.usdToVes > 0) {
          bcvInput.value = rates.usdToVes.toFixed(2);
        }
        if (binanceInput && rates.binanceUsdToVes > 0) {
          binanceInput.value = rates.binanceUsdToVes.toFixed(2);
        }

        updateProductPriceCalc();
      } catch (err) {
        console.error('Error al obtener tasas de la fecha seleccionada:', err);
      }
    }
  };

  const purchaseDateElem = document.getElementById('calc-purchase-date');
  purchaseDateElem?.addEventListener('change', handlePurchaseDateChange);
  purchaseDateElem?.addEventListener('input', handlePurchaseDateChange);

  // Toggle para caja de texto de nueva categoría
  const categorySelect = document.getElementById('prod-category-select') as HTMLSelectElement;
  const categoryCustomBox = document.getElementById('new-category-input-box');
  const categoryCustomInput = document.getElementById('prod-category-custom') as HTMLInputElement;

  categorySelect?.addEventListener('change', () => {
    if (categorySelect.value === '__NEW_CATEGORY__') {
      if (categoryCustomBox) categoryCustomBox.style.display = 'block';
      if (categoryCustomInput) categoryCustomInput.focus();
    } else {
      if (categoryCustomBox) categoryCustomBox.style.display = 'none';
    }
  });

  ['calc-purchase-date', 'calc-bcv-rate', 'calc-binance-rate', 'calc-black-cost', 'calc-profit-margin'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateProductPriceCalc);
    document.getElementById(id)?.addEventListener('change', updateProductPriceCalc);
  });

  document.getElementById('apply-calc-price-btn')?.addEventListener('click', () => {
    updateProductPriceCalc();
    const prodPriceInput = document.getElementById('prod-price') as HTMLInputElement;
    if (prodPriceInput) prodPriceInput.focus();
  });

  const applyProductsSearch = () => {
    if (searchInput) {
      adminProductsSearchQuery = searchInput.value;
      if (adminProductsSearchDebounceTimer) {
        window.clearTimeout(adminProductsSearchDebounceTimer);
      }
      adminProductsSearchDebounceTimer = window.setTimeout(() => {
        const tableBody = document.getElementById('admin-products-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = renderAdminProductsRows(getAdminFilteredProducts());
        bindProductTableActions();
      }, 40);
    }
  };

  searchInput?.addEventListener('input', applyProductsSearch);
  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      adminProductsSearchQuery = '';
      const tableBody = document.getElementById('admin-products-table-body');
      if (tableBody) {
        tableBody.innerHTML = renderAdminProductsRows(getAdminFilteredProducts());
        bindProductTableActions();
      }
    }
  });

  addBtn?.addEventListener('click', () => {
    editingProductId = null;
    form.reset();
    if (formTitle) formTitle.innerText = 'Agregar Nuevo Producto';
    if (formCard) formCard.style.display = 'block';
    if (categoryCustomBox) categoryCustomBox.style.display = 'none';
    formCard?.scrollIntoView({ behavior: 'smooth' });
    updateProductPriceCalc();
  });

  cancelBtn?.addEventListener('click', () => {
    if (formCard) formCard.style.display = 'none';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('prod-form-submit') as HTMLButtonElement;
    const cancelBtn = document.getElementById('prod-form-cancel') as HTMLButtonElement;
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'Guardando...';

    try {
      const name = (document.getElementById('prod-name') as HTMLInputElement).value;
      
      let category = categorySelect?.value || 'General';
      if (category === '__NEW_CATEGORY__') {
        const customCatName = categoryCustomInput?.value.trim();
        if (!customCatName) {
          alert('Por favor ingrese el nombre de la nueva categoría');
          submitBtn.disabled = false;
          cancelBtn.disabled = false;
          submitBtn.innerText = originalText;
          return;
        }
        category = customCatName;
      }

      const description = (document.getElementById('prod-desc') as HTMLTextAreaElement).value;
      const price = parseFloat((document.getElementById('prod-price') as HTMLInputElement).value);
      const stock = parseInt((document.getElementById('prod-stock') as HTMLInputElement).value);
      let image_url = (document.getElementById('prod-img') as HTMLInputElement).value;
      const code = (document.getElementById('prod-code') as HTMLInputElement).value.trim();

      // Procesar archivo local si existe
      const fileInput = document.getElementById('prod-image-file') as HTMLInputElement;
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        submitBtn.innerText = 'Subiendo imagen...';
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        const uploadRes = await api.products.uploadImage(formData);
        image_url = uploadRes.imageUrl;
      }

      const payload = { code: code || undefined, name, category, description, price, stock, image_url };

      if (editingProductId) {
        await api.products.update(editingProductId, payload);
        alert('Producto actualizado con éxito');
      } else {
        await api.products.create(payload);
        alert('Producto creado con éxito');
      }

      if (formCard) formCard.style.display = 'none';
      await loadProducts();
      await renderAdminProducts();
    } catch (err: any) {
      alert(err.message || 'Error al guardar producto');
    } finally {
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  });

  bindProductTableActions();
}

// ==========================================================================
// SUB-VISTA: HISTORIAL DE VENTAS
// ==========================================================================
// ==========================================================================
// SUB-VISTA: HISTÓRICO COMPLETO DEL SISTEMA Y AUDITORÍA DE MODIFICACIONES
// ==========================================================================
let historyFilterType = 'all';
let historySearchQuery = '';

async function renderAdminSales() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  panel.innerHTML = `<div class="text-center" style="padding:40px;">Cargando histórico del sistema y registro de auditoría...</div>`;

  try {
    const { logs, sales } = await api.sales.getAuditLogs();

    // Combinar ventas y logs de auditoría en un único listado cronológico
    const combinedEvents: any[] = [];

    // 1. Agregar logs de auditoría (Acciones del sistema, staff, productos, cupones, tasas)
    if (Array.isArray(logs)) {
      logs.forEach((log: AuditLog) => {
        combinedEvents.push({
          id: `log-${log.id}`,
          rawId: log.id,
          isSale: false,
          actionType: log.action_type,
          title: log.title,
          userName: log.user_name || 'Sistema',
          userRole: log.user_role || 'sistema',
          details: log.details || '',
          createdAt: new Date(log.created_at),
          createdAtStr: new Date(log.created_at).toLocaleString('es-ES')
        });
      });
    }

    // 2. Agregar ventas históricas (POS, Online y Cotizaciones)
    if (Array.isArray(sales)) {
      sales.forEach((sale: Sale) => {
        const isQuotation = sale.is_quotation === 1;
        const typeKey = isQuotation ? 'quotation' : (sale.type === 'pos' ? 'sale_pos' : 'sale_online');
        
        combinedEvents.push({
          id: `sale-${sale.id}`,
          rawId: sale.id,
          isSale: true,
          saleData: sale,
          actionType: typeKey,
          title: isQuotation ? `Cotización #${sale.id} ($${Number(sale.total).toFixed(2)})` : `Venta ${sale.type.toUpperCase()} #${sale.id} ($${Number(sale.total).toFixed(2)})`,
          userName: sale.seller_name || sale.customer_name || 'Cliente',
          userRole: sale.seller_name ? 'vendedor' : 'cliente',
          details: `Cliente: ${sale.customer_name}${sale.customer_ci ? ' (' + sale.customer_ci + ')' : ''} | Pago: ${sale.payment_method.toUpperCase()} | Total: $${Number(sale.total).toFixed(2)}${sale.customer_phone ? ' | Tel: ' + sale.customer_phone : ''}`,
          createdAt: new Date(sale.created_at),
          createdAtStr: new Date(sale.created_at).toLocaleString('es-ES')
        });
      });
    }

    // Ordenar cronológicamente por fecha más reciente
    combinedEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Filtrar según el tipo seleccionado y la búsqueda de texto
    const filteredEvents = combinedEvents.filter(ev => {
      if (historyFilterType !== 'all' && ev.actionType !== historyFilterType) {
        return false;
      }
      if (historySearchQuery) {
        const q = historySearchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesUser = ev.userName.toLowerCase().includes(q);
        const matchesDetails = ev.details.toLowerCase().includes(q);
        return matchesTitle || matchesUser || matchesDetails;
      }
      return true;
    });

    const getBadgeStyle = (type: string) => {
      switch (type) {
        case 'sale_pos': return { bg: 'rgba(255,122,0,0.15)', color: '#ff7a00', label: '🛒 Venta POS' };
        case 'sale_online': return { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: '🌐 Venta Online' };
        case 'quotation': return { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6', label: '📝 Cotización' };
        case 'staff_crud': return { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: '👥 Personal / Vendedor' };
        case 'product_crud': return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: '📦 Inventario / Producto' };
        case 'coupon_crud': return { bg: 'rgba(236,72,153,0.15)', color: '#ec4899', label: '🎟️ Cupón' };
        case 'settings': return { bg: 'rgba(6,182,212,0.15)', color: '#06b6d4', label: '💱 Tasa BCV / Ajustes' };
        default: return { bg: 'rgba(255,255,255,0.05)', color: '#ffffff', label: '📋 Registro' };
      }
    };

    panel.innerHTML = `
      <div class="animate-on-scroll animate-fade-up visible">
        <div class="flex justify-between align-center mb-2" style="flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:26px; font-weight:800; margin:0;">Histórico del Sistema & Auditoría 📋</h2>
            <p style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Registro de todas las operaciones, ventas, cotizaciones, cambios de inventario y personal.</p>
          </div>
        </div>

        <!-- Barra de Filtros por Categoría y Buscador -->
        <div class="card mb-4" style="padding:16px; background:rgba(255,255,255,0.01); border:1px solid var(--border-glass);">
          <div class="flex justify-between align-center mb-3" style="flex-wrap:wrap; gap:12px;">
            <!-- Buscador general -->
            <div style="flex-grow:1; max-width:400px;">
              <input type="text" class="form-control" id="history-search-input" placeholder="🔍 Buscar por cliente, vendedor, producto o acción..." value="${historySearchQuery}">
            </div>
          </div>

          <!-- Botones de Filtro por Categoría -->
          <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; -webkit-overflow-scrolling:touch;">
            <button class="btn ${historyFilterType === 'all' ? 'btn-primary' : 'btn-secondary'} history-filter-btn" data-type="all" style="padding:6px 14px; font-size:12px; white-space:nowrap;">
              🌐 Todos (${combinedEvents.length})
            </button>
            <button class="btn ${historyFilterType === 'sale_pos' ? 'btn-primary' : 'btn-secondary'} history-filter-btn" data-type="sale_pos" style="padding:6px 14px; font-size:12px; white-space:nowrap;">
              🛒 Ventas POS
            </button>
            <button class="btn ${historyFilterType === 'sale_online' ? 'btn-primary' : 'btn-secondary'} history-filter-btn" data-type="sale_online" style="padding:6px 14px; font-size:12px; white-space:nowrap;">
              🌐 Ventas Online
            </button>
            <button class="btn ${historyFilterType === 'quotation' ? 'btn-primary' : 'btn-secondary'} history-filter-btn" data-type="quotation" style="padding:6px 14px; font-size:12px; white-space:nowrap;">
              📝 Cotizaciones
            </button>
            <button class="btn ${historyFilterType === 'staff_crud' ? 'btn-primary' : 'btn-secondary'} history-filter-btn" data-type="staff_crud" style="padding:6px 14px; font-size:12px; white-space:nowrap;">
              👥 Vendedores / Personal
            </button>
            <button class="btn ${historyFilterType === 'product_crud' ? 'btn-primary' : 'btn-secondary'} history-filter-btn" data-type="product_crud" style="padding:6px 14px; font-size:12px; white-space:nowrap;">
              📦 Productos / Inventario
            </button>
            <button class="btn ${historyFilterType === 'coupon_crud' ? 'btn-primary' : 'btn-secondary'} history-filter-btn" data-type="coupon_crud" style="padding:6px 14px; font-size:12px; white-space:nowrap;">
              🎟️ Cupones
            </button>
            <button class="btn ${historyFilterType === 'settings' ? 'btn-primary' : 'btn-secondary'} history-filter-btn" data-type="settings" style="padding:6px 14px; font-size:12px; white-space:nowrap;">
              💱 Tasas BCV / Ajustes
            </button>
          </div>
        </div>

        <!-- Tabla de Eventos e Histórico -->
        <div class="card">
          <div class="table-responsive">
            <table class="table-custom">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Categoría</th>
                  <th>Responsable / Usuario</th>
                  <th>Acción / Operación</th>
                  <th>Detalle de la Modificación</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredEvents.map(ev => {
                  const badge = getBadgeStyle(ev.actionType);
                  return `
                    <tr>
                      <td style="font-size:12px; white-space:nowrap; color:var(--text-secondary);">${ev.createdAtStr}</td>
                      <td>
                        <span class="badge-status" style="background:${badge.bg}; color:${badge.color}; font-size:11px; font-weight:700; text-transform:uppercase;">
                          ${badge.label}
                        </span>
                      </td>
                      <td>
                        <strong>👤 ${ev.userName}</strong>
                        ${ev.userRole ? `<br><small style="color:var(--text-muted); font-size:10px; text-transform:uppercase;">(${ev.userRole})</small>` : ''}
                      </td>
                      <td><strong>${ev.title}</strong></td>
                      <td style="font-size:12px; color:var(--text-secondary); max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ev.details}">
                        ${ev.details || 'Sin detalles'}
                      </td>
                      <td class="text-right">
                        ${ev.isSale ? `
                          <button class="btn btn-secondary btn-icon view-sale-details" style="padding:6px 12px; font-size:12px;" data-id="${ev.rawId}">
                            🔍 Ver Factura
                          </button>
                        ` : `
                          <button class="btn btn-secondary btn-icon view-log-details" style="padding:6px 12px; font-size:12px;" data-title="${ev.title}" data-details="${encodeURIComponent(ev.details)}" data-user="${ev.userName}" data-date="${ev.createdAtStr}">
                            ℹ️ Detalle
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
                ${filteredEvents.length === 0 ? '<tr><td colspan="6" class="text-center">No hay registros de auditoría o eventos en esta categoría.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindSalesHistoryEvents();

  } catch (error) {
    console.error(error);
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar el histórico de auditoría del servidor.</div>`;
  }
}

function bindSalesHistoryEvents() {
  // Eventos de filtro por categoría
  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      historyFilterType = (e.currentTarget as HTMLButtonElement).dataset.type || 'all';
      await renderAdminSales();
    });
  });

  // Evento de búsqueda por texto
  const searchIn = document.getElementById('history-search-input') as HTMLInputElement;
  searchIn?.addEventListener('input', (e) => {
    historySearchQuery = (e.target as HTMLInputElement).value;
    renderAdminSales();
  });

  // Evento ver factura
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

  // Evento ver detalle de auditoría
  document.querySelectorAll('.view-log-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const title = target.dataset.title || 'Detalle de Auditoría';
      const details = decodeURIComponent(target.dataset.details || '');
      const user = target.dataset.user || 'Sistema';
      const date = target.dataset.date || '';

      alert(`📋 DETALLE DE AUDITORÍA Y MODIFICACIÓN\n\n📌 Operación: ${title}\n👤 Ejecutado por: ${user}\n🕒 Fecha: ${date}\n\n📝 Detalle:\n${details}`);
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
              <div>Cajero/Vendedor: <strong id="detail-registered-by">--</strong></div>
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

        <div class="flex justify-between align-center" style="border-top:1px solid var(--border-glass); padding-top:16px; flex-wrap: wrap; gap: 12px;">
          <div class="flex gap-2">
            <!-- Re-envio WhatsApp -->
            <a href="#" target="_blank" class="wa-link" id="detail-wa-btn" style="padding: 8px 12px; font-size:13px; border-radius: var(--radius-md);">
              ${icons.whatsapp} Enviar por WhatsApp
            </a>
            <!-- Re-envio Correo -->
            <button class="btn btn-secondary" id="detail-email-btn" style="padding: 8px 12px; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px;">
              ✉️ Reenviar por Correo
            </button>
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
  const registeredByEl = document.getElementById('detail-registered-by');
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
  if (registeredByEl) registeredByEl.innerText = sale.seller_name || 'Online (Tienda)';
  if (totalVal) {
    const totalUsd = Number(sale.total);
    const totalVes = totalUsd * rateUsdToVes;
    const totalEur = totalVes / rateEurToVes;
    totalVal.innerHTML = `
      <div style="font-size:22px; color:var(--primary); font-weight:700;">$${totalUsd.toFixed(2)}</div>
      <div style="font-size:14px; color:#f59e0b; font-weight:600;">Bs. ${totalVes.toFixed(2)}</div>
      <div style="font-size:11px; color:var(--text-muted); font-weight:500;">Equiv. € ${totalEur.toFixed(2)}</div>
    `;
  }

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

  // Enlace a WhatsApp (Re-envío) - Enviando la imagen de la factura en su lugar
  const phoneNum = sale.customer_phone ? sale.customer_phone.replace(/\+/g, '').replace(/\s/g, '') : '';
  
  const newWaBtn = waBtn.cloneNode(true) as HTMLAnchorElement;
  waBtn.parentNode?.replaceChild(newWaBtn, waBtn);

  newWaBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await shareInvoiceAsImage(sale, items, phoneNum);
  });

  // Enlace a Correo (Re-envío)
  const emailBtn = document.getElementById('detail-email-btn') as HTMLButtonElement;
  if (emailBtn) {
    const newEmailBtn = emailBtn.cloneNode(true) as HTMLButtonElement;
    emailBtn.parentNode?.replaceChild(newEmailBtn, emailBtn);

    newEmailBtn.addEventListener('click', async () => {
      let targetEmail = sale.customer_email || '';
      
      const inputEmail = prompt('Ingrese el correo electrónico al cual desea reenviar la factura:', targetEmail);
      if (inputEmail === null) return; // cancelado
      
      if (!inputEmail || !inputEmail.includes('@')) {
        alert('Por favor, ingrese un correo electrónico válido.');
        return;
      }

      newEmailBtn.disabled = true;
      newEmailBtn.innerText = 'Reenviando...';

      try {
        await api.sales.resendEmail(sale.id, inputEmail);
        alert(`¡Factura reenviada con éxito a ${inputEmail}!`);
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Error al reenviar la factura por correo.');
      } finally {
        newEmailBtn.disabled = false;
        newEmailBtn.innerText = '✉️ Reenviar por Correo';
      }
    });
  }
}

function bindSaleDetailEvents() {
  const modal = document.getElementById('sale-detail-modal');
  const closeBtn = document.getElementById('sale-detail-close');
  closeBtn?.addEventListener('click', () => {
    modal?.classList.remove('open');
  });
}

// ==========================================================================
// SUB-VISTA: DEUDORES (PAGOS PENDIENTES)
// ==========================================================================
async function renderAdminDebtors() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  panel.innerHTML = `<div class="text-center" style="padding:40px;">Cargando lista de deudores y configuraciones...</div>`;

  try {
    const debtors = await api.sales.getDebtors();
    const settings = await api.sales.getReminderSettings();

    panel.innerHTML = `
      <div class="card animate-on-scroll animate-fade-up visible">
        <div class="flex justify-between align-center mb-4">
          <h2 style="font-size:20px; font-weight:700;">💸 Control de Deudores (Pagos Pendientes)</h2>
          <button class="btn btn-secondary" id="toggle-reminder-settings-btn" style="padding: 6px 12px; font-size: 11px;">
            ⚙️ Alertas de Cobro
          </button>
        </div>

        <!-- Formulario Configuración Recordatorios -->
        <div id="reminder-settings-box" class="card mb-4 animate-fade-in" style="display: none; padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass);">
          <h4 style="font-size: 14px; font-weight:600; margin-bottom: 12px;">Configurar Frecuencia y Mensaje de Alertas</h4>
          <form id="reminder-settings-form">
            <div class="grid-2 gap-2 mb-2">
              <div class="form-group">
                <label class="form-label" style="font-size: 11px;">Frecuencia de Alertas (Días)</label>
                <input type="number" min="1" class="form-control" id="reminder-days-input" required value="${settings.frequencyDays}">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 11px;">Variables Disponibles</label>
                <div style="font-size: 10px; color: var(--text-muted); padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px; line-height: 1.4;">
                  <code>{customerName}</code> - Nombre cliente<br>
                  <code>\${amountPending}</code> - Saldo deudor<br>
                  <code>{saleId}</code> - ID factura
                </div>
              </div>
            </div>
            <div class="form-group mb-3">
              <label class="form-label" style="font-size: 11px;">Plantilla de Recordatorio</label>
              <textarea class="form-control" id="reminder-template-input" rows="3" required style="font-size:12px; font-family:inherit; line-height:1.4;">${settings.emailTemplate}</textarea>
            </div>
            <button type="submit" class="btn btn-primary" id="save-reminder-settings-btn" style="padding: 6px 16px; font-size:11px;">
              Guardar Configuración
            </button>
          </form>
        </div>

        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Factura ID</th>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Total Factura</th>
                <th>Monto Abonado</th>
                <th class="text-right">Monto Pendiente</th>
                <th>Fecha Emisión</th>
                <th class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${debtors.map(sale => {
                const total = Number(sale.total);
                const paid = Number(sale.amount_paid || 0);
                const pending = Math.max(0, total - paid);
                
                // Formatear texto recordatorio de WhatsApp
                const waText = settings.emailTemplate
                  .replace(/{customerName}/g, sale.customer_name || 'Cliente')
                  .replace(/\${amountPending}/g, pending.toFixed(2))
                  .replace(/{saleId}/g, sale.id.toString());

                return `
                  <tr>
                    <td><strong>#${sale.id}</strong></td>
                    <td><strong>${sale.customer_name}</strong></td>
                    <td>
                      <div style="font-size:12px;">${sale.customer_email || ''}</div>
                      <div style="font-size:12px; color:var(--text-muted);">${sale.customer_phone || ''}</div>
                    </td>
                    <td>$${total.toFixed(2)}</td>
                    <td style="color:var(--success); font-weight:600;">$${paid.toFixed(2)}</td>
                    <td class="text-right" style="font-weight:700; color:var(--danger);">$${pending.toFixed(2)}</td>
                    <td>${new Date(sale.created_at).toLocaleString('es-ES')}</td>
                    <td class="text-center">
                      <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; max-width: 250px; margin: 0 auto;">
                        <button class="btn btn-secondary abono-btn" data-id="${sale.id}" data-pending="${pending}" style="padding: 6px 10px; font-size:10px;">
                          💵 Abonar
                        </button>
                        <button class="btn btn-primary mark-as-paid-btn" data-id="${sale.id}" style="padding: 6px 10px; font-size:10px;">
                          ✓ Cobrar
                        </button>
                        <button class="btn btn-secondary send-email-reminder-btn" data-id="${sale.id}" style="padding: 6px 10px; font-size:10px; background:#4f46e5; border-color:#4f46e5; color:white;" ${!sale.customer_email ? 'disabled title="Sin correo"' : ''}>
                          ✉️ Correo
                        </button>
                        <button class="btn btn-secondary send-wa-reminder-btn" data-phone="${sale.customer_phone || ''}" data-text="${encodeURIComponent(waText)}" style="padding: 6px 10px; font-size:10px; background:#25d366; border-color:#25d366; color:white;" ${!sale.customer_phone ? 'disabled title="Sin teléfono"' : ''}>
                          💬 WA
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
              ${debtors.length === 0 ? '<tr><td colspan="8" class="text-center">No hay clientes deudores o pagos pendientes.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Toggle Configuración Box
    const toggleBtn = document.getElementById('toggle-reminder-settings-btn');
    const settingsBox = document.getElementById('reminder-settings-box');
    toggleBtn?.addEventListener('click', () => {
      if (settingsBox) {
        settingsBox.style.display = settingsBox.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Guardar Configuración
    document.getElementById('reminder-settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const days = parseInt((document.getElementById('reminder-days-input') as HTMLInputElement).value);
      const template = (document.getElementById('reminder-template-input') as HTMLTextAreaElement).value;
      const saveBtn = document.getElementById('save-reminder-settings-btn') as HTMLButtonElement;
      
      saveBtn.disabled = true;
      saveBtn.innerText = 'Guardando...';

      try {
        await api.sales.updateReminderSettings({ frequencyDays: days, emailTemplate: template });
        alert('Configuración de alertas guardada con éxito.');
        await renderAdminDebtors();
      } catch (err: any) {
        alert(err.message || 'Error al guardar configuraciones.');
        saveBtn.disabled = false;
        saveBtn.innerText = 'Guardar Configuración';
      }
    });

    // Bind abono events
    document.querySelectorAll('.abono-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        const pending = parseFloat((e.currentTarget as HTMLButtonElement).dataset.pending || '0');
        
        const inputStr = prompt(`Monto a abonar para la factura #${id} (Máximo $${pending.toFixed(2)}):`);
        if (inputStr === null) return; // cancelado
        
        const abonoVal = parseFloat(inputStr);
        if (isNaN(abonoVal) || abonoVal <= 0) {
          alert('Por favor ingrese un monto válido mayor a 0.');
          return;
        }

        try {
          const res = await api.sales.updateStatus(id, undefined, abonoVal);
          alert(res.message || 'Abono registrado con éxito.');
          await renderAdminDebtors();
        } catch (err: any) {
          alert(err.message || 'Error al procesar el abono.');
        }
      });
    });

    // Bind mark as paid events
    document.querySelectorAll('.mark-as-paid-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        if (confirm(`¿Estás seguro de marcar la factura #${id} como completada y pagada en su totalidad?`)) {
          try {
            await api.sales.updateStatus(id, 'completed');
            alert('¡Pago registrado con éxito!');
            await renderAdminDebtors();
          } catch (err: any) {
            alert(err.message || 'Error al actualizar estado del pago.');
          }
        }
      });
    });

    // Bind manual email reminder
    document.querySelectorAll('.send-email-reminder-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        const originalText = (e.currentTarget as HTMLButtonElement).innerText;
        (e.currentTarget as HTMLButtonElement).disabled = true;
        (e.currentTarget as HTMLButtonElement).innerText = 'Enviando...';
        try {
          const res = await api.sales.sendManualReminder(id);
          alert(res.message || '¡Recordatorio enviado con éxito por correo!');
          await renderAdminDebtors();
        } catch (err: any) {
          alert(err.message || 'Error al enviar recordatorio por correo.');
        } finally {
          (e.currentTarget as HTMLButtonElement).disabled = false;
          (e.currentTarget as HTMLButtonElement).innerText = originalText;
        }
      });
    });

    // Bind WhatsApp reminder
    document.querySelectorAll('.send-wa-reminder-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const phone = (e.currentTarget as HTMLButtonElement).dataset.phone || '';
        const text = (e.currentTarget as HTMLButtonElement).dataset.text || '';
        if (!phone) {
          alert('Este cliente no tiene teléfono registrado.');
          return;
        }
        const formattedPhone = phone.replace(/\+/g, '').replace(/\s/g, '');
        window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank');
      });
    });

  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar la lista de deudores o configuraciones.</div>`;
  }
}

// ==========================================================================
// SUB-VISTA: COTIZACIONES AL MAYOR
// ==========================================================================
async function renderAdminQuotations() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  panel.innerHTML = `<div class="text-center" style="padding:40px;">Cargando cotizaciones al mayor...</div>`;

  try {
    const quotes = await api.sales.getQuotations();

    panel.innerHTML = `
      <div class="card animate-on-scroll animate-fade-up visible">
        <div class="flex justify-between align-center mb-4">
          <h2 style="font-size:20px; font-weight:700;">📝 Cotizaciones al Mayor</h2>
        </div>

        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Cotización ID</th>
                <th>Cliente</th>
                <th>Contacto</th>
                <th class="text-right">Monto Cotizado</th>
                <th>Fecha de Creación</th>
                <th class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${quotes.map(sale => `
                <tr>
                  <td><strong>#${sale.id}</strong></td>
                  <td><strong>${sale.customer_name}</strong></td>
                  <td>
                    <div style="font-size:12px;">${sale.customer_email || ''}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${sale.customer_phone || ''}</div>
                  </td>
                  <td class="text-right" style="font-weight:700; color:var(--primary);">$${Number(sale.total).toFixed(2)}</td>
                  <td>${new Date(sale.created_at).toLocaleString('es-ES')}</td>
                  <td class="text-center" style="display:flex; justify-content:center; gap:8px; align-items:center;">
                    <button class="btn btn-secondary view-quote-details-btn" data-id="${sale.id}" style="padding: 6px 12px; font-size:11px;">
                      🔍 Ver
                    </button>
                    <button class="btn btn-primary send-quote-wa-btn" data-id="${sale.id}" style="padding: 6px 12px; font-size:11px; background:#25d366; border-color:#25d366;">
                      WhatsApp
                    </button>
                    <button class="btn btn-secondary load-quote-pos-btn" data-id="${sale.id}" style="padding: 6px 12px; font-size:11px; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.2); color:var(--primary);" title="Cargar cotización en el POS para facturar">
                      🛒 Facturar
                    </button>
                  </td>
                </tr>
              `).join('')}
              ${quotes.length === 0 ? '<tr><td colspan="6" class="text-center">No se han registrado cotizaciones al mayor.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind view quote details
    document.querySelectorAll('.view-quote-details-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        try {
          const details = await api.sales.getDetails(id);
          showSaleDetails(details);
          const headerId = document.getElementById('detail-header-id');
          if (headerId) headerId.innerText = `Detalle de Cotización #${details.sale.id}`;
        } catch (err: any) {
          alert(err.message || 'Error al obtener cotización.');
        }
      });
    });

    // Bind send quote to WhatsApp
    document.querySelectorAll('.send-quote-wa-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        try {
          const details = await api.sales.getDetails(id);
          const phone = details.sale.customer_phone || '';
          const cleanedPhone = phone.replace(/\+/g, '').replace(/\s/g, '');
          
          await shareInvoiceAsImage(details.sale, details.items, cleanedPhone);
        } catch (err: any) {
          alert(err.message || 'Error al enviar cotización.');
        }
      });
    });

    // Bind load quote to POS
    document.querySelectorAll('.load-quote-pos-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        try {
          const details = await api.sales.getDetails(id);
          
          // Cargar productos en posCart
          posCart = details.items.map(item => ({
            product: {
              id: item.product_id,
              name: item.name,
              price: Number(item.price),
              stock: 9999,
              description: '',
              image_url: '',
              category: ''
            },
            quantity: item.quantity
          }));

          // Cargar descuento e impuestos
          posDiscount = Number(details.sale.discount || 0);
          posApplyTax = Number(details.sale.tax || 0) > 0;
          posSelectedCustomerId = details.sale.user_id || null;
          posLoadedQuotationId = details.sale.id;

          // Cambiar de pestaña al POS
          activeAdminView = 'pos';
          
          // Recargar la vista del admin
          const tabPOS = document.getElementById('admin-tab-pos');
          document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.remove('active'));
          tabPOS?.classList.add('active');
          
          await renderAdminPOS();

          // Auto-llenar campos en el formulario de la derecha tras renderizar
          setTimeout(() => {
            const nameIn = document.getElementById('pos-cust-name') as HTMLInputElement;
            const phoneIn = document.getElementById('pos-cust-phone') as HTMLInputElement;
            const emailIn = document.getElementById('pos-cust-email') as HTMLInputElement;
            const selectCustomer = document.getElementById('pos-customer-select') as HTMLSelectElement;
            const discountIn = document.getElementById('pos-discount-input') as HTMLInputElement;
            const taxIn = document.getElementById('pos-tax-checkbox') as HTMLInputElement;

            if (nameIn) nameIn.value = details.sale.customer_name || '';
            if (phoneIn) phoneIn.value = details.sale.customer_phone || '';
            if (emailIn) emailIn.value = details.sale.customer_email || '';
            if (selectCustomer && details.sale.user_id) selectCustomer.value = details.sale.user_id.toString();
            if (discountIn) discountIn.value = posDiscount.toString();
            if (taxIn) taxIn.checked = posApplyTax;
          }, 50);

          alert(`Cotización #${id} cargada con éxito en el POS. Puedes modificar productos, cantidades o descuentos antes de facturar.`);
        } catch (err: any) {
          alert(err.message || 'Error al cargar cotización en el POS.');
        }
      });
    });

  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar cotizaciones.</div>`;
  }
}

// ==========================================================================
// SUB-VISTA: GESTIÓN DE CUPONES DE DESCUENTO
// ==========================================================================
async function renderAdminCoupons() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  panel.innerHTML = `<div class="text-center" style="padding:40px;">Cargando cupones de descuento...</div>`;

  try {
    // Cargar lista de clientes si está vacía
    if (posCustomersList.length === 0) {
      posCustomersList = await api.auth.getCustomers();
    }

    const coupons = await api.sales.getCoupons();

    panel.innerHTML = `
      <div class="grid-2 gap-4 animate-on-scroll animate-fade-up visible">
        <!-- Formulario Crear Cupón -->
        <div class="card" style="padding: 24px; align-self: flex-start;">
          <h3 class="mb-4" style="font-size:18px; font-weight:700;">🎟️ Crear Nuevo Cupón</h3>
          
          <form id="create-coupon-form">
            <div class="form-group mb-2">
              <label class="form-label" for="coupon-code-input">Código del Cupón</label>
              <input type="text" class="form-control" id="coupon-code-input" required placeholder="Ej. LIQUIDACION30" style="text-transform: uppercase;">
            </div>
            <div class="form-group mb-2">
              <label class="form-label" for="coupon-percent-input">Porcentaje de Descuento (%)</label>
              <input type="number" min="1" max="100" class="form-control" id="coupon-percent-input" required placeholder="Ej. 30">
            </div>
            <div class="form-group mb-4">
              <label class="form-label" for="coupon-client-select">Asignar a Cliente (Opcional - Personal y Uniuso)</label>
              <select class="form-control" id="coupon-client-select" style="padding: 8px 12px; font-size:13px;">
                <option value="">-- Público / General --</option>
                ${posCustomersList.map(c => `
                  <option value="${c.id}">${c.name} (${c.email})</option>
                `).join('')}
              </select>
            </div>
            <button type="submit" class="btn btn-primary w-100" id="coupon-submit-btn">
              Crear Cupón
            </button>
          </form>
        </div>

        <!-- Lista de Cupones -->
        <div class="card" style="padding: 24px;">
          <h3 class="mb-4" style="font-size:18px; font-weight:700;">Cupones Registrados</h3>
          
          <div class="table-responsive">
            <table class="table-custom" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>Código</th>
                  <th class="text-center">Descuento</th>
                  <th>Destinatario / Uso</th>
                  <th class="text-center">Estado</th>
                  <th class="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${coupons.map(cp => {
                  let userText = '<span style="color:var(--text-muted);">Público</span>';
                  if (cp.user_id) {
                    const cust = posCustomersList.find(c => c.id === cp.user_id);
                    userText = cust ? `👤 ${cust.name}` : `👤 Cliente #${cp.user_id}`;
                  }
                  
                  let useStatus = '';
                  if (cp.user_id) {
                    useStatus = cp.is_used === 1 
                      ? ' <span class="badge" style="background:rgba(239,68,68,0.1); color:var(--danger); font-size:10px; padding:1px 4px;">Usado</span>' 
                      : ' <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success); font-size:10px; padding:1px 4px;">Disponible</span>';
                  }

                  return `
                    <tr>
                      <td><strong>${cp.code}</strong></td>
                      <td class="text-center" style="font-weight:700; color:var(--primary);">${cp.discount_percent}%</td>
                      <td>
                        <div style="font-size:12px;">${userText}</div>
                        <div>${useStatus}</div>
                      </td>
                      <td class="text-center">
                        <span class="badge" style="background:${cp.active === 1 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${cp.active === 1 ? 'var(--success)' : 'var(--danger)'}; padding:2px 6px; font-size:11px;">
                          ${cp.active === 1 ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td class="text-center">
                        <div style="display: flex; gap: 6px; justify-content: center;">
                          <button class="btn btn-secondary edit-coupon-btn" data-id="${cp.id}" data-code="${cp.code}" data-percent="${cp.discount_percent}" data-active="${cp.active}" style="padding: 6px 10px; font-size:11px;">
                            ✏️
                          </button>
                          <button class="btn btn-primary delete-coupon-btn" data-id="${cp.id}" style="padding: 6px 10px; font-size:11px; background:var(--danger); border-color:var(--danger);">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
                ${coupons.length === 0 ? '<tr><td colspan="5" class="text-center">No hay cupones registrados.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Bind submit coupon
    document.getElementById('create-coupon-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = (document.getElementById('coupon-code-input') as HTMLInputElement).value;
      const percent = parseFloat((document.getElementById('coupon-percent-input') as HTMLInputElement).value);
      const selectedUserId = (document.getElementById('coupon-client-select') as HTMLSelectElement).value;

      const submitBtn = document.getElementById('coupon-submit-btn') as HTMLButtonElement;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Creando...';

      try {
        await api.sales.addCoupon(code, percent, selectedUserId ? parseInt(selectedUserId) : undefined);
        alert('Cupón de descuento creado con éxito.');
        await renderAdminCoupons();
      } catch (err: any) {
        alert(err.message || 'Error al crear cupón.');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Crear Cupón';
      }
    });

    // Bind delete coupon
    document.querySelectorAll('.delete-coupon-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        if (confirm(`¿Estás seguro de eliminar permanentemente este cupón?`)) {
          try {
            await api.sales.deleteCoupon(id);
            alert('Cupón eliminado con éxito.');
            await renderAdminCoupons();
          } catch (err: any) {
            alert(err.message || 'Error al eliminar el cupón.');
          }
        }
      });
    });

    // Bind edit coupon
    document.querySelectorAll('.edit-coupon-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        const code = (e.currentTarget as HTMLButtonElement).dataset.code || '';
        const currentPercent = (e.currentTarget as HTMLButtonElement).dataset.percent || '0';

        const newPercentStr = prompt(`Editar porcentaje de descuento para cupón ${code}:`, currentPercent);
        if (newPercentStr === null) return;
        const newPercent = parseFloat(newPercentStr);
        if (isNaN(newPercent) || newPercent < 1 || newPercent > 100) {
          alert('Por favor ingrese un porcentaje válido (1-100).');
          return;
        }

        const newActive = confirm(`¿Deseas que el cupón ${code} esté ACTIVO? (Aceptar = Activo, Cancelar = Inactivo)`);

        try {
          await api.sales.updateCoupon(id, { discount_percent: newPercent, active: newActive ? 1 : 0 });
          alert('Cupón actualizado con éxito.');
          await renderAdminCoupons();
        } catch (err: any) {
          alert(err.message || 'Error al actualizar cupón.');
        }
      });
    });

  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar cupones.</div>`;
  }
}

// ==========================================================================
// SUB-VISTA: GESTIÓN DE GASTOS
// ==========================================================================
async function renderAdminExpenses() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  panel.innerHTML = `<div class="text-center" style="padding:40px;">Cargando gastos...</div>`;

  try {
    const expenses = await api.expenses.getAll();

    panel.innerHTML = `
      <div class="animate-on-scroll animate-fade-up visible">
        <div class="flex justify-between align-center mb-4" style="flex-wrap:wrap; gap:12px;">
          <h2 style="font-size:26px; font-weight:800; margin:0;">Gestión de Gastos</h2>
          <button class="btn btn-primary" id="add-expense-btn">➕ Agregar Gasto</button>
        </div>

        <div class="card mb-4" id="expense-form-card" style="display:none; background: rgba(255,255,255,0.01); border: 1px solid var(--border-glass);">
          <h3 id="expense-form-title" class="mb-3" style="font-size:16px; font-weight:700;">Agregar Nuevo Gasto</h3>
          <form id="expense-form">
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="expense-name">Nombre</label>
                <input type="text" class="form-control" id="expense-name" required placeholder="Ej. Mensualidad de hosting">
              </div>
              <div class="form-group">
                <label class="form-label" for="expense-type">Tipo</label>
                <select class="form-control" id="expense-type">
                  <option value="monthly">Mensual</option>
                  <option value="unexpected">Imprevisto</option>
                </select>
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="expense-amount">Monto</label>
                <input type="number" step="0.01" min="0" class="form-control" id="expense-amount" required placeholder="100">
              </div>
              <div class="form-group">
                <label class="form-label" for="expense-currency">Moneda</label>
                <select class="form-control" id="expense-currency">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="VES">VES</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="expense-description">Descripción</label>
              <textarea class="form-control" id="expense-description" rows="2" placeholder="Ej. Pago mensual de servidor o técnico del aire"></textarea>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="expense-start-date">Fecha de Inicio</label>
                <input type="date" class="form-control" id="expense-start-date">
              </div>
              <div class="form-group">
                <label class="form-label" for="expense-next-due-date">Próximo Pago</label>
                <input type="date" class="form-control" id="expense-next-due-date">
              </div>
            </div>

            <div class="form-group mb-3">
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="checkbox" id="expense-active" checked> Activo / Cobrar normalmente
              </label>
            </div>

            <div class="flex justify-end gap-4" style="margin-top:16px;">
              <button type="button" class="btn btn-secondary" id="expense-form-cancel">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="expense-form-submit">Guardar Gasto</button>
            </div>
          </form>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table class="table-custom" style="font-size:13px;">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Moneda</th>
                  <th>Equivalente en BS</th>
                  <th>Próximo pago</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${expenses.map(exp => `
                  <tr>
                    <td>
                      <strong>${exp.name}</strong>
                      ${exp.description ? `<br><small style="color:var(--text-secondary);">${exp.description}</small>` : ''}
                    </td>
                    <td>${exp.expense_type === 'monthly' ? 'Mensual' : 'Imprevisto'}</td>
                    <td><strong>${Number(exp.amount).toFixed(2)}</strong></td>
                    <td>${exp.currency}</td>
                    <td>${exp.amount_ves !== null && exp.amount_ves !== undefined ? `Bs. ${Number(exp.amount_ves).toFixed(2)}` : '—'}</td>
                    <td>${exp.next_due_date || '—'}</td>
                    <td>
                      <span class="badge" style="background:${exp.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${exp.is_active ? 'var(--success)' : 'var(--danger)'}; padding:2px 6px; font-size:11px;">
                        ${exp.is_active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td>
                      <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn btn-secondary edit-expense-btn" data-id="${exp.id}" style="padding:6px 10px; font-size:11px;">✏️</button>
                        <button class="btn btn-danger delete-expense-btn" data-id="${exp.id}" style="padding:6px 10px; font-size:11px;">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
                ${expenses.length === 0 ? '<tr><td colspan="8" class="text-center">No hay gastos registrados.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    let editingExpenseId: number | null = null;

    const formCard = document.getElementById('expense-form-card');
    const form = document.getElementById('expense-form') as HTMLFormElement;
    const formTitle = document.getElementById('expense-form-title');
    const addBtn = document.getElementById('add-expense-btn');
    const cancelBtn = document.getElementById('expense-form-cancel');

    const resetForm = () => {
      if (form) form.reset();
      const activeCheckbox = document.getElementById('expense-active') as HTMLInputElement | null;
      if (activeCheckbox) activeCheckbox.checked = true;
      const startDate = document.getElementById('expense-start-date') as HTMLInputElement | null;
      if (startDate) startDate.value = new Date().toISOString().slice(0, 10);
      const nextDueDate = document.getElementById('expense-next-due-date') as HTMLInputElement | null;
      if (nextDueDate) nextDueDate.value = '';
      editingExpenseId = null;
      if (formTitle) formTitle.innerText = 'Agregar Nuevo Gasto';
      if (formCard) formCard.style.display = 'none';
    };

    addBtn?.addEventListener('click', () => {
      if (formCard) formCard.style.display = 'block';
      formCard?.scrollIntoView({ behavior: 'smooth' });
      if (formTitle) formTitle.innerText = 'Agregar Nuevo Gasto';
      editingExpenseId = null;
      const startDate = document.getElementById('expense-start-date') as HTMLInputElement | null;
      if (startDate && !startDate.value) startDate.value = new Date().toISOString().slice(0, 10);
    });

    cancelBtn?.addEventListener('click', resetForm);

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('expense-form-submit') as HTMLButtonElement;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Guardando...';

      try {
        const payload: Partial<import('./utils/api').Expense> = {
          name: (document.getElementById('expense-name') as HTMLInputElement).value.trim(),
          description: (document.getElementById('expense-description') as HTMLTextAreaElement).value.trim(),
          amount: parseFloat((document.getElementById('expense-amount') as HTMLInputElement).value),
          currency: (document.getElementById('expense-currency') as HTMLSelectElement).value,
          expense_type: ((document.getElementById('expense-type') as HTMLSelectElement).value === 'monthly' ? 'monthly' : 'unexpected'),
          is_active: (document.getElementById('expense-active') as HTMLInputElement).checked,
          start_date: (document.getElementById('expense-start-date') as HTMLInputElement).value || null,
          next_due_date: (document.getElementById('expense-next-due-date') as HTMLInputElement).value || null,
        };

        const amountValue = parseFloat((document.getElementById('expense-amount') as HTMLInputElement).value);
        if (!payload.name || Number.isNaN(amountValue)) {
          throw new Error('Nombre y monto válidos son obligatorios.');
        }
        payload.amount = amountValue;

        if (editingExpenseId) {
          await api.expenses.update(editingExpenseId, payload);
          alert('Gasto actualizado con éxito.');
        } else {
          await api.expenses.create(payload);
          alert('Gasto creado con éxito.');
        }

        await renderAdminExpenses();
      } catch (err: any) {
        alert(err.message || 'Error al guardar gasto');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Guardar Gasto';
      }
    });

    document.querySelectorAll('.edit-expense-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        const expense = expenses.find(item => item.id === id);
        if (!expense) return;

        editingExpenseId = expense.id;
        if (formTitle) formTitle.innerText = `Editar Gasto: ${expense.name}`;
        (document.getElementById('expense-name') as HTMLInputElement).value = expense.name;
        (document.getElementById('expense-description') as HTMLTextAreaElement).value = expense.description || '';
        (document.getElementById('expense-amount') as HTMLInputElement).value = expense.amount.toString();
        (document.getElementById('expense-currency') as HTMLSelectElement).value = expense.currency;
        (document.getElementById('expense-type') as HTMLSelectElement).value = expense.expense_type;
        (document.getElementById('expense-active') as HTMLInputElement).checked = expense.is_active;
        (document.getElementById('expense-start-date') as HTMLInputElement).value = expense.start_date || '';
        (document.getElementById('expense-next-due-date') as HTMLInputElement).value = expense.next_due_date || '';
        if (formCard) formCard.style.display = 'block';
        formCard?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    document.querySelectorAll('.delete-expense-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
        if (!confirm('¿Deseas eliminar este gasto?')) return;
        try {
          await api.expenses.delete(id);
          alert('Gasto eliminado.');
          await renderAdminExpenses();
        } catch (err: any) {
          alert(err.message || 'Error al eliminar gasto');
        }
      });
    });
  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar gastos.</div>`;
  }
}

// ==========================================================================
// SUB-VISTA: GESTIÓN DE PERSONAL / VENDEDORES (CRUD)
// ==========================================================================
let staffList: User[] = [];

async function renderAdminStaff() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  try {
    staffList = await api.auth.getStaff();

    panel.innerHTML = `
      <div class="animate-on-scroll animate-fade-up visible">
        <div class="flex justify-between align-center mb-4" style="flex-wrap:wrap; gap:12px;">
          <h2 style="font-size:26px; font-weight:800; margin:0;">Gestión de Vendedores</h2>
          <button class="btn btn-primary" id="add-staff-btn">
            ➕ Agregar Vendedor
          </button>
        </div>

        <!-- Formulario de Personal -->
        <div class="card mb-4" id="staff-form-card" style="display: none; background: rgba(255,255,255,0.01); border: 1px solid var(--border-glass);">
          <h3 id="staff-form-title" class="mb-3" style="font-size:16px; font-weight:700;">Agregar Nuevo Miembro</h3>
          <form id="staff-form">
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="staff-name">Nombre Completo</label>
                <input type="text" class="form-control" id="staff-name" required placeholder="Ej. Juan Pérez">
              </div>
              <div class="form-group">
                <label class="form-label" for="staff-email">Correo Electrónico</label>
                <input type="email" class="form-control" id="staff-email" required placeholder="juan@sistema.com">
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="staff-phone">Teléfono / WhatsApp</label>
                <input type="text" class="form-control" id="staff-phone" placeholder="Ej. +584120000000">
              </div>
              <div class="form-group">
                <label class="form-label" for="staff-ci-num">Cédula de Identidad</label>
                <div style="display: flex; gap: 6px;">
                  <select class="form-control" id="staff-ci-prefix" style="width: 70px; font-weight: 700; flex-shrink: 0;">
                    <option value="V-">V-</option>
                    <option value="E-">E-</option>
                  </select>
                  <input type="text" class="form-control" id="staff-ci-num" placeholder="12345678" pattern="\d{5,10}" title="Ingrese de 5 a 10 dígitos numéricos" style="flex-grow: 1;">
                </div>
              </div>
            </div>
            <div class="form-group mb-3">
              <label class="form-label" for="staff-role">Privilegios / Rol Principal</label>
              <select class="form-control" id="staff-role" required>
                <option value="seller">Vendedor / Cajero (Permisos Seleccionados)</option>
                <option value="admin">Administrador (Acceso Total)</option>
              </select>
            </div>

            <!-- Granular Permissions Checkboxes -->
            <div class="form-group mb-4">
              <label class="form-label" style="font-size:13px; font-weight:700;">Permisos Específicos Asignados</label>
              <p style="font-size:11px; color:var(--text-secondary); margin-bottom:8px;">Marque los módulos a los cuales este usuario tendrá acceso dentro del sistema:</p>
              
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px; background:rgba(255,255,255,0.02); padding:14px; border-radius:8px; border:1px solid var(--border-glass);">
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" class="staff-perm-checkbox" value="pos" checked> 🛒 Punto de Venta (POS)
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" class="staff-perm-checkbox" value="products"> 📦 Catálogo e Inventario
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" class="staff-perm-checkbox" value="sales"> 📋 Histórico & Auditoría
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" class="staff-perm-checkbox" value="debtors"> 💸 Control de Deudores
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" class="staff-perm-checkbox" value="quotations"> 📝 Cotizaciones al Mayor
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" class="staff-perm-checkbox" value="coupons"> 🎟️ Cupones de Descuento
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                  <input type="checkbox" class="staff-perm-checkbox" value="staff"> 👥 Gestión de Personal
                </label>
              </div>
            </div>

            <div class="form-group mb-4">
              <label class="form-label" for="staff-password" id="staff-pass-label">Contraseña</label>
              <input type="password" class="form-control" id="staff-password" required placeholder="Min. 6 caracteres">
              <small class="form-text text-muted" id="staff-pass-help" style="display:none; color:var(--text-secondary); margin-top:4px;">Dejar en blanco para mantener la contraseña actual.</small>
            </div>

            <div class="flex justify-end gap-4" style="margin-top:16px;">
              <button type="button" class="btn btn-secondary" id="staff-form-cancel">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="staff-form-submit-btn">Guardar</button>
            </div>
          </form>
        </div>

        <!-- Tabla de Personal -->
        <div class="card">
          <div class="table-responsive">
            <table class="table-custom">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cédula</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Rol</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${staffList.map(member => `
                  <tr>
                    <td><strong>${member.name}</strong></td>
                    <td><span class="badge" style="background:rgba(255,255,255,0.05); font-weight:700;">${member.ci || 'N/D'}</span></td>
                    <td>${member.email}</td>
                    <td>${member.phone || 'N/D'}</td>
                    <td>
                      <span class="badge-status" style="background:${member.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)'}; color:${member.role === 'admin' ? 'var(--primary)' : 'var(--success)'}; font-size:11px; text-transform:uppercase; font-weight:700;">
                        ${member.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>
                    <td class="text-right">
                      <button class="btn btn-secondary btn-icon edit-staff-btn" style="padding:6px 12px; font-size:12px;" data-id="${member.id}">
                        ✏️ Editar
                      </button>
                      ${member.id !== currentUser?.id ? `
                        <button class="btn btn-danger btn-icon delete-staff-btn" style="padding:6px 12px; font-size:12px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.2); color:var(--danger);" data-id="${member.id}">
                          🗑️ Eliminar
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
                ${staffList.length === 0 ? '<tr><td colspan="6" class="text-center">No hay personal registrado.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindStaffEvents();
  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar lista de personal del servidor.</div>`;
  }
}

function bindStaffEvents() {
  const formCard = document.getElementById('staff-form-card');
  const addBtn = document.getElementById('add-staff-btn');
  const cancelBtn = document.getElementById('staff-form-cancel');
  const form = document.getElementById('staff-form') as HTMLFormElement;
  const formTitle = document.getElementById('staff-form-title');
  const passInput = document.getElementById('staff-password') as HTMLInputElement;
  const passHelp = document.getElementById('staff-pass-help');

  addBtn?.addEventListener('click', () => {
    editingStaffId = null;
    form.reset();
    if (formTitle) formTitle.innerText = 'Agregar Nuevo Miembro de Personal';
    if (passInput) passInput.required = true;
    if (passHelp) passHelp.style.display = 'none';
    if (formCard) formCard.style.display = 'block';
    formCard?.scrollIntoView({ behavior: 'smooth' });
  });

  cancelBtn?.addEventListener('click', () => {
    if (formCard) formCard.style.display = 'none';
  });

  // Auto-seleccionar permisos según el rol
  document.getElementById('staff-role')?.addEventListener('change', (e) => {
    const roleVal = (e.target as HTMLSelectElement).value;
    document.querySelectorAll('.staff-perm-checkbox').forEach((cb: any) => {
      if (roleVal === 'admin') {
        cb.checked = true;
      } else {
        cb.checked = (cb.value === 'pos');
      }
    });
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('staff-name') as HTMLInputElement).value;
    const email = (document.getElementById('staff-email') as HTMLInputElement).value;
    const phone = (document.getElementById('staff-phone') as HTMLInputElement).value;
    const ciPrefix = (document.getElementById('staff-ci-prefix') as HTMLSelectElement).value;
    const ciNum = (document.getElementById('staff-ci-num') as HTMLInputElement).value.trim();
    const ci = ciNum ? `${ciPrefix}${ciNum}` : null;
    const role = (document.getElementById('staff-role') as HTMLSelectElement).value;
    const password = passInput.value;

    const checkedPerms = Array.from(document.querySelectorAll('.staff-perm-checkbox:checked')).map((c: any) => c.value);

    const payload: any = { name, email, role, phone, ci, permissions: checkedPerms };
    if (password || !editingStaffId) {
      payload.password = password;
    }

    try {
      if (editingStaffId) {
        await api.auth.updateStaff(editingStaffId, payload);
        alert('Miembro de personal actualizado con éxito.');
      } else {
        await api.auth.createStaff(payload);
        alert('Miembro de personal creado con éxito.');
      }

      if (formCard) formCard.style.display = 'none';
      await renderAdminStaff();
    } catch (err: any) {
      alert(err.message || 'Error al guardar personal.');
    }
  });

  // Evento Editar
  document.querySelectorAll('.edit-staff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      const member = staffList.find(m => m.id === id);
      if (member) {
        editingStaffId = member.id;
        if (formTitle) formTitle.innerText = `Editar Personal: ${member.name}`;
        
        (document.getElementById('staff-name') as HTMLInputElement).value = member.name;
        (document.getElementById('staff-email') as HTMLInputElement).value = member.email;
        (document.getElementById('staff-phone') as HTMLInputElement).value = member.phone || '';
        (document.getElementById('staff-role') as HTMLSelectElement).value = member.role;

        if (member.ci) {
          const parts = member.ci.split('-');
          if (parts.length === 2) {
            (document.getElementById('staff-ci-prefix') as HTMLSelectElement).value = `${parts[0]}-`;
            (document.getElementById('staff-ci-num') as HTMLInputElement).value = parts[1];
          } else {
            (document.getElementById('staff-ci-num') as HTMLInputElement).value = member.ci;
          }
        } else {
          (document.getElementById('staff-ci-num') as HTMLInputElement).value = '';
        }

        // Cargar checkboxes de permisos
        let perms: string[] = [];
        if (member.permissions) {
          try {
            perms = typeof member.permissions === 'string' ? JSON.parse(member.permissions) : member.permissions;
          } catch (err) {
            perms = [];
          }
        } else {
          perms = member.role === 'admin' ? ['pos', 'products', 'sales', 'debtors', 'quotations', 'coupons', 'staff'] : ['pos'];
        }

        document.querySelectorAll('.staff-perm-checkbox').forEach((cb: any) => {
          cb.checked = Array.isArray(perms) && perms.includes(cb.value);
        });

        if (passInput) passInput.required = false;
        if (passHelp) passHelp.style.display = 'block';
        if (formCard) formCard.style.display = 'block';
        formCard?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Evento Eliminar
  document.querySelectorAll('.delete-staff-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt((e.currentTarget as HTMLButtonElement).dataset.id || '0');
      if (confirm('¿Estás seguro de eliminar este miembro de personal? Se eliminará permanentemente.')) {
        try {
          await api.auth.deleteStaff(id);
          alert('Personal eliminado con éxito.');
          await renderAdminStaff();
        } catch (err: any) {
          alert(err.message || 'Error al eliminar.');
        }
      }
    });
  });
}

// ==========================================================================
// SUB-VISTA: GESTIÓN DE CLIENTES REGISTRADOS
// ==========================================================================
async function renderAdminCustomers() {
  const panel = document.getElementById('dashboard-content-panel');
  if (!panel) return;

  try {
    const customers = await api.auth.getCustomers();
    const query = (adminCustomerSearchQuery || '').toLowerCase().trim();
    const filteredCustomers = query ? customers.filter(c => 
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.ci && c.ci.toLowerCase().includes(query)) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query))
    ) : customers;

    panel.innerHTML = `
      <div class="animate-on-scroll animate-fade-up visible">
        <div class="flex justify-between align-center mb-4">
          <div>
            <h2 style="font-size:24px; font-weight:800; margin-bottom:4px;">Gestión de Clientes Registrados</h2>
            <p style="font-size:12px; color:var(--text-secondary);">Directorio de clientes registrados en el sistema</p>
          </div>
          <button type="button" class="btn btn-primary" id="admin-add-customer-btn" style="padding:10px 16px; font-weight:700;">
            ➕ Registrar Nuevo Cliente
          </button>
        </div>

        <div class="card mb-4" style="padding:14px;">
          <input type="text" class="form-control" id="admin-customer-search-input" placeholder="🔍 Buscar por nombre, cédula, teléfono o correo..." value="${adminCustomerSearchQuery}" style="font-size:13px; padding:10px 14px;">
        </div>

        <div class="card">
          <div class="table-responsive">
            <table class="table-custom">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Cédula / RIF</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredCustomers.map(cust => `
                  <tr>
                    <td>
                      <strong>${cust.name}</strong>
                      ${cust.representative_name ? `<br><small style="color:#818cf8; font-size:11px;">👔 Encargado: ${cust.representative_name} ${cust.representative_ci ? `(${cust.representative_ci})` : ''} ${cust.representative_position ? `- ${cust.representative_position}` : ''}</small>` : ''}
                    </td>
                    <td>
                      <span class="badge" style="background:${cust.ci?.startsWith('J-') || cust.ci?.startsWith('G-') ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)'}; color:${cust.ci?.startsWith('J-') || cust.ci?.startsWith('G-') ? '#818cf8' : 'white'}; font-weight:700;">
                        ${cust.ci || 'N/D'}
                      </span>
                    </td>
                    <td>${cust.phone || (cust.representative_phone ? `📱 ${cust.representative_phone}` : 'N/D')}</td>
                    <td>${cust.email || 'N/D'}</td>
                    <td class="text-right">
                      <button type="button" class="btn btn-secondary select-customer-pos-btn" style="padding:6px 12px; font-size:12px;" data-ci="${cust.ci || ''}" data-name="${cust.name}">
                        🛒 Asignar al POS
                      </button>
                    </td>
                  </tr>
                `).join('')}
                ${filteredCustomers.length === 0 ? '<tr><td colspan="5" class="text-center">No se encontraron clientes registrados.</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    bindCustomersEvents();
  } catch (error) {
    panel.innerHTML = `<div class="card text-center" style="color:var(--danger)">Error al cargar la lista de clientes del servidor.</div>`;
  }
}

function bindCustomersEvents() {
  let customerSearchTimeout: any;
  document.getElementById('admin-customer-search-input')?.addEventListener('input', (e) => {
    adminCustomerSearchQuery = (e.target as HTMLInputElement).value;
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(async () => {
      await renderAdminCustomers();
    }, 350);
  });

  document.getElementById('admin-add-customer-btn')?.addEventListener('click', async () => {
    showRegisterCustomerModal = true;
    activeAdminView = 'pos';
    await renderAdminPOS();
  });

  document.querySelectorAll('.select-customer-pos-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      posCustomerName = target.dataset.name || 'Consumidor Final';
      posCustomerCi = target.dataset.ci || '';
      posClientIdentified = true;
      activeAdminView = 'pos';
      await renderAdminPOS();
    });
  });
}
