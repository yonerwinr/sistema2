import type { SuperAdminMetrics, SuperAdminBusiness } from '../utils/api';
import { api } from '../utils/api';

/**
 * SuperAdminView.ts
 * Consola centralizada para que el dueño de FacilitoApp gestione licencias, deudores y comercios.
 */

export function renderSuperAdminHtml(
  metrics: SuperAdminMetrics | null,
  businesses: SuperAdminBusiness[],
  activeFilter: 'all' | 'active' | 'trial' | 'expired' = 'all',
  searchQuery: string = ''
): string {
  const m = metrics || {
    totalBusinesses: businesses.length,
    activeLicenses: businesses.filter(b => b.license_status === 'active' && b.is_active === 1).length,
    trialLicenses: businesses.filter(b => b.license_status === 'trial' && b.is_active === 1).length,
    expiredLicenses: businesses.filter(b => b.isExpired).length,
    suspendedLicenses: businesses.filter(b => b.license_status === 'suspended' || b.is_active === 0).length,
    estimatedMRR: businesses.reduce((acc, b) => acc + (b.is_active ? Number(b.price_monthly || 25) : 0), 0),
    globalSalesCount: businesses.reduce((acc, b) => acc + Number(b.total_sales || 0), 0),
    globalRevenue: businesses.reduce((acc, b) => acc + Number(b.total_revenue || 0), 0)
  };

  const q = searchQuery.toLowerCase().trim();
  const filtered = businesses.filter(b => {
    // Filtro por búsqueda
    if (q) {
      const matchName = b.name.toLowerCase().includes(q);
      const matchSlug = b.slug.toLowerCase().includes(q);
      const matchRif = (b.rif || '').toLowerCase().includes(q);
      const matchEmail = (b.email || '').toLowerCase().includes(q);
      if (!matchName && !matchSlug && !matchRif && !matchEmail) return false;
    }

    // Filtro por pestaña
    if (activeFilter === 'active') return b.license_status === 'active' && b.is_active === 1 && !b.isExpired;
    if (activeFilter === 'trial') return b.license_status === 'trial' && b.is_active === 1;
    if (activeFilter === 'expired') return b.isExpired || b.license_status === 'suspended' || b.is_active === 0;

    return true;
  });

  return `
    <div class="superadmin-container animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding: 28px 20px;">
      
      <!-- ENCABEZADO DE LA CONSOLA -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, var(--brand-orange) 0%, var(--brand-blue) 100%); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 15px rgba(255,115,0,0.3);">
            ⚡
          </div>
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 10px;">
              Consola SuperAdmin
              <span style="font-size: 11px; font-weight: 700; background: rgba(0,119,246,0.18); border: 1px solid rgba(0,119,246,0.4); color: var(--brand-blue); padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">SaaS Platform</span>
            </h1>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 2px 0 0 0;">
              Control global de licencias, facturación, deudores y aprovisionamiento de comercios
            </p>
          </div>
        </div>

        <button class="btn btn-primary" id="btn-open-create-business-modal" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 15px var(--brand-orange-glow);">
          <span>➕</span> Nuevo Comercio / Licencia
        </button>
      </div>

      <!-- TARJETAS KPI DE RENDIMIENTO DEL SAAS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px;">
        
        <!-- Total Comercios -->
        <div class="card" style="padding: 20px; border-radius: 16px; background: var(--bg-glass); border: 1px solid var(--border-glass);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Total Comercios</span>
            <span style="font-size: 20px;">🏢</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: var(--text-primary);">${m.totalBusinesses}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Inquilinos registrados</div>
        </div>

        <!-- Licencias Activas -->
        <div class="card" style="padding: 20px; border-radius: 16px; background: var(--bg-glass); border: 1px solid rgba(16,185,129,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--success); text-transform: uppercase;">Al Día (Activas)</span>
            <span style="font-size: 20px;">🟢</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: var(--success);">${m.activeLicenses}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Con servicio operativo</div>
        </div>

        <!-- Periodo de Prueba -->
        <div class="card" style="padding: 20px; border-radius: 16px; background: var(--bg-glass); border: 1px solid rgba(0,119,246,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--brand-blue); text-transform: uppercase;">En Prueba (Trial)</span>
            <span style="font-size: 20px;">⏳</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: var(--brand-blue);">${m.trialLicenses}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Evaluando la plataforma</div>
        </div>

        <!-- Deudores / Vencidas -->
        <div class="card" style="padding: 20px; border-radius: 16px; background: var(--bg-glass); border: 1px solid rgba(239,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--danger); text-transform: uppercase;">Deudores / Vencidas</span>
            <span style="font-size: 20px;">⚠️</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: var(--danger);">${m.expiredLicenses + m.suspendedLicenses}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Requieren renovación</div>
        </div>

        <!-- MRR Estimado -->
        <div class="card" style="padding: 20px; border-radius: 16px; background: var(--bg-glass); border: 1px solid rgba(245,158,11,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--accent); text-transform: uppercase;">MRR Estimado</span>
            <span style="font-size: 20px;">💰</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: var(--accent);">$${m.estimatedMRR.toFixed(2)}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Ingresos mensuales</div>
        </div>

      </div>

      <!-- BARRA DE FILTROS Y BÚSQUEDA -->
      <div class="card" style="padding: 16px 20px; border-radius: 16px; background: var(--bg-glass); border: 1px solid var(--border-glass); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        
        <!-- Pestañas de estado -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-sm ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" id="filter-all-btn" style="border-radius: 8px; font-weight: 600;">
            Todos (${businesses.length})
          </button>
          <button class="btn btn-sm ${activeFilter === 'active' ? 'btn-primary' : 'btn-secondary'}" id="filter-active-btn" style="border-radius: 8px; font-weight: 600;">
            🟢 Activos (${businesses.filter(b => b.license_status === 'active' && b.is_active === 1 && !b.isExpired).length})
          </button>
          <button class="btn btn-sm ${activeFilter === 'trial' ? 'btn-primary' : 'btn-secondary'}" id="filter-trial-btn" style="border-radius: 8px; font-weight: 600;">
            ⏳ Prueba (${businesses.filter(b => b.license_status === 'trial' && b.is_active === 1).length})
          </button>
          <button class="btn btn-sm ${activeFilter === 'expired' ? 'btn-danger' : 'btn-secondary'}" id="filter-expired-btn" style="border-radius: 8px; font-weight: 600;">
            ⚠️ Deudores / Vencidos (${businesses.filter(b => b.isExpired || b.license_status === 'suspended' || b.is_active === 0).length})
          </button>
        </div>

        <!-- Buscador -->
        <div style="min-width: 260px; max-width: 380px; flex-grow: 1;">
          <input type="text" class="form-control" id="superadmin-search-input" placeholder="🔍 Buscar comercio, slug o RIF..." value="${searchQuery}" style="border-radius: 10px; height: 38px; font-size: 13px;">
        </div>

      </div>

      <!-- TABLA DE COMERCIOS -->
      <div class="card" style="padding: 0; border-radius: 16px; background: var(--bg-glass); border: 1px solid var(--border-glass); overflow: hidden;">
        <div style="overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-glass); color: var(--text-secondary); text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                <th style="padding: 14px 18px;">Comercio / Identificador</th>
                <th style="padding: 14px 18px;">Plan</th>
                <th style="padding: 14px 18px;">Estado Licencia</th>
                <th style="padding: 14px 18px;">Vencimiento</th>
                <th style="padding: 14px 18px;">Google Sheets</th>
                <th style="padding: 14px 18px;">Ventas</th>
                <th style="padding: 14px 18px; text-align: right;">Acciones / Control</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    No se encontraron comercios con los filtros seleccionados.
                  </td>
                </tr>
              ` : filtered.map(b => {
                const isSuspended = b.license_status === 'suspended' || b.is_active === 0;
                const isExp = b.isExpired;

                const statusColor = isSuspended ? '#ef4444' : (isExp ? '#f59e0b' : (b.license_status === 'trial' ? '#0077f6' : '#10b981'));
                const statusLabel = isSuspended ? '⛔ Suspendido' : (isExp ? '⚠️ Vencido' : (b.license_status === 'trial' ? '⏳ Prueba' : '🟢 Activo'));

                const daysRemaining = b.daysRemaining;
                let daysText = 'Sin límite';
                if (daysRemaining !== null && daysRemaining !== undefined) {
                  if (daysRemaining < 0) {
                    daysText = `Venció hace ${Math.abs(daysRemaining)} días`;
                  } else if (daysRemaining === 0) {
                    daysText = `Vence hoy`;
                  } else {
                    daysText = `${daysRemaining} días restantes`;
                  }
                }

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s ease;">
                    
                    <!-- Nombre y Slug -->
                    <td style="padding: 14px 18px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--bg-secondary); border: 1px solid var(--border-glass); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: var(--brand-orange); flex-shrink: 0; overflow: hidden;">
                          ${b.logo_url ? `<img src="${b.logo_url}" style="width:100%; height:100%; object-fit:cover;" alt="${b.name}">` : b.name.charAt(0)}
                        </div>
                        <div>
                          <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${b.name}</div>
                          <div style="font-size: 11px; color: var(--text-muted); display: flex; gap: 6px; align-items: center;">
                            <code style="background: rgba(0,0,0,0.3); padding: 1px 5px; border-radius: 4px; color: var(--brand-blue);">${b.slug}</code>
                            ${b.rif ? `<span>• RIF: ${b.rif}</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Plan -->
                    <td style="padding: 14px 18px;">
                      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; background: rgba(255,115,0,0.12); color: var(--brand-orange); border: 1px solid rgba(255,115,0,0.3);">
                        ${b.license_plan || 'PRO'}
                      </span>
                      <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                        $${Number(b.price_monthly || 25).toFixed(2)}/mes
                      </div>
                    </td>

                    <!-- Estado de Licencia -->
                    <td style="padding: 14px 18px;">
                      <span style="display: inline-block; font-size: 12px; font-weight: 700; color: ${statusColor}; background: ${statusColor}18; border: 1px solid ${statusColor}40; padding: 4px 10px; border-radius: 20px;">
                        ${statusLabel}
                      </span>
                    </td>

                    <!-- Días Restantes / Vencimiento -->
                    <td style="padding: 14px 18px;">
                      <div style="font-weight: 600; color: ${daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 3 ? 'var(--danger)' : 'var(--text-primary)'};">
                        ${daysText}
                      </div>
                      <div style="font-size: 11px; color: var(--text-muted);">
                        ${b.license_expires_at ? new Date(b.license_expires_at).toLocaleDateString('es-ES') : 'Indefinido'}
                      </div>
                    </td>

                    <!-- Enlace a Google Sheets -->
                    <td style="padding: 14px 18px;">
                      ${b.google_sheet_url ? `
                        <a href="${b.google_sheet_url}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #10b981; text-decoration: none; padding: 4px 10px; border-radius: 6px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25);">
                          <span>📊</span> Abrir Sheet
                        </a>
                      ` : `
                        <span style="font-size: 11px; color: var(--text-muted);">No generado</span>
                      `}
                    </td>

                    <!-- Ventas y Productos -->
                    <td style="padding: 14px 18px;">
                      <div style="font-weight: 700; color: var(--text-primary);">$${Number(b.total_revenue || 0).toFixed(2)}</div>
                      <div style="font-size: 11px; color: var(--text-muted);">${b.total_sales || 0} ventas • ${b.total_products || 0} prods</div>
                    </td>

                    <!-- Acciones y Kill-Switch -->
                    <td style="padding: 14px 18px; text-align: right;">
                      <div style="display: inline-flex; gap: 8px; align-items: center;">
                        
                        <!-- Renovar +30 Días -->
                        <button class="btn btn-sm btn-success btn-renew-license" data-id="${b.id}" data-name="${b.name}" title="Renovar 30 días de licencia" style="padding: 5px 10px; font-size: 12px; font-weight: 700; border-radius: 8px;">
                          +30 Días 💳
                        </button>

                        <!-- Kill Switch: Suspender / Activar -->
                        ${isSuspended ? `
                          <button class="btn btn-sm btn-primary btn-toggle-status" data-id="${b.id}" data-action="activate" title="Reactivar servicio de este comercio" style="padding: 5px 10px; font-size: 12px; font-weight: 700; border-radius: 8px;">
                            Activar ▶️
                          </button>
                        ` : `
                          <button class="btn btn-sm btn-danger btn-toggle-status" data-id="${b.id}" data-action="suspend" title="Pausar/Suspender servicio (Kill-switch)" style="padding: 5px 10px; font-size: 12px; font-weight: 700; border-radius: 8px;">
                            Pausar ⏸️
                          </button>
                        `}

                        <!-- Enlace directo a la tienda del comercio -->
                        <a href="/${b.slug}/store" target="_blank" class="btn btn-sm btn-secondary" title="Ver tienda del comercio" style="padding: 5px 8px; font-size: 12px; border-radius: 8px; text-decoration: none;">
                          🛒
                        </a>

                      </div>
                    </td>

                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL PARA REGISTRAR NUEVO COMERCIO -->
      <div id="modal-create-business" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 20px;">
        <div class="card" style="max-width: 580px; width: 100%; border-radius: 20px; padding: 28px; background: var(--bg-secondary); border: 1px solid var(--border-glass); max-height: 90vh; overflow-y: auto;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
              🏢 Registrar Nuevo Comercio
            </h2>
            <button id="btn-close-create-modal" style="background: none; border: none; font-size: 20px; color: var(--text-secondary); cursor: pointer;">✕</button>
          </div>

          <form id="form-create-business">
            
            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="bus-name">Nombre Comercial del Negocio *</label>
              <input type="text" class="form-control" id="bus-name" required placeholder="Ej. Minimarket San José">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
              <div class="form-group">
                <label class="form-label" for="bus-slug">Identificador URL (Slug)</label>
                <input type="text" class="form-control" id="bus-slug" placeholder="ej. minimarket-san-jose">
                <small style="color: var(--text-muted); font-size: 11px;">facilito.com/<b>identificador</b></small>
              </div>
              <div class="form-group">
                <label class="form-label" for="bus-rif">RIF / Cédula Fiscal</label>
                <input type="text" class="form-control" id="bus-rif" placeholder="Ej. J-12345678-9">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
              <div class="form-group">
                <label class="form-label" for="bus-phone">Teléfono / WhatsApp</label>
                <input type="tel" class="form-control" id="bus-phone" placeholder="Ej. +584125374589">
              </div>
              <div class="form-group">
                <label class="form-label" for="bus-plan">Plan de Licencia</label>
                <select class="form-control" id="bus-plan">
                  <option value="pro" selected>Plan Pro ($25/mes)</option>
                  <option value="basic">Plan Básico ($15/mes)</option>
                  <option value="enterprise">Plan Enterprise ($50/mes)</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="bus-address">Dirección Física de la Empresa</label>
              <input type="text" class="form-control" id="bus-address" placeholder="Ej. Av. Bolívar, Edif. Torre Azul, Local 2">
            </div>

            <!-- Datos del Usuario Administrador del Comercio -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
              <div style="font-weight: 700; font-size: 13px; color: var(--brand-orange); margin-bottom: 10px;">
                👤 Usuario Administrador del Comercio
              </div>
              <div class="form-group" style="margin-bottom: 10px;">
                <label class="form-label" for="bus-admin-name">Nombre del Dueño/Administrador</label>
                <input type="text" class="form-control" id="bus-admin-name" placeholder="Ej. Carlos Pérez">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label" for="bus-admin-email">Correo (Gmail recomendado) *</label>
                  <input type="email" class="form-control" id="bus-admin-email" required placeholder="carlos@gmail.com">
                </div>
                <div class="form-group">
                  <label class="form-label" for="bus-admin-pass">Contraseña Inicial *</label>
                  <input type="password" class="form-control" id="bus-admin-pass" required placeholder="••••••••">
                </div>
              </div>
              <small style="color: var(--text-muted); font-size: 11px; display: block; margin-top: 6px;">
                💡 Se creará y compartirá automáticamente una hoja de Google Sheets con este correo.
              </small>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-create-modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-create-business" style="font-weight: 700;">
                Crear y Aprovisionar Google Sheets 🚀
              </button>
            </div>

          </form>

        </div>
      </div>

    </div>
  `;
}

let cachedMetrics: SuperAdminMetrics | null = null;
let cachedBusinesses: SuperAdminBusiness[] = [];
let currentFilter: 'all' | 'active' | 'trial' | 'expired' = 'all';
let currentSearch: string = '';

export async function renderSuperAdminView(container: HTMLElement) {
  container.innerHTML = `
    <div style="padding: 60px 20px; text-align: center; color: var(--text-muted);">
      <div style="font-size: 36px; margin-bottom: 14px; animation: bounce 1.5s infinite;">👑</div>
      <p style="font-size: 16px; font-weight: 700; color: white;">Cargando métricas de plataforma y comercios...</p>
    </div>
  `;

  try {
    const [metricsRes, bizRes] = await Promise.all([
      api.superadmin.getMetrics(),
      api.superadmin.getBusinesses()
    ]);
    cachedMetrics = metricsRes.metrics;
    cachedBusinesses = bizRes.businesses;
    refreshView(container);
  } catch (err: any) {
    container.innerHTML = `
      <div class="card" style="padding: 24px; border: 1px solid var(--danger); background: rgba(239,68,68,0.06); margin: 20px auto; max-width: 600px;">
        <h4 style="color: var(--danger); margin-bottom: 8px;">Error al cargar consola SuperAdmin</h4>
        <p style="color: var(--text-secondary); font-size: 13px;">${err.message || 'Error al conectar con la API de SuperAdmin'}</p>
        <button class="btn btn-secondary" id="retry-superadmin-btn" style="margin-top: 12px;">Reintentar</button>
      </div>
    `;
    container.querySelector('#retry-superadmin-btn')?.addEventListener('click', () => renderSuperAdminView(container));
  }
}

function refreshView(container: HTMLElement) {
  container.innerHTML = renderSuperAdminHtml(cachedMetrics, cachedBusinesses, currentFilter, currentSearch);
  setupSuperAdminEvents(container);
}

export function setupSuperAdminEvents(container: HTMLElement) {
  // Campo de búsqueda
  const searchInput = container.querySelector('#search-businesses') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    currentSearch = searchInput.value;
    refreshView(container);
    const newSearch = container.querySelector('#search-businesses') as HTMLInputElement | null;
    if (newSearch) {
      newSearch.focus();
      newSearch.value = currentSearch;
      newSearch.setSelectionRange(currentSearch.length, currentSearch.length);
    }
  });

  // Filtros: all, active, trial, expired
  ['all', 'active', 'trial', 'expired'].forEach(f => {
    const tab = container.querySelector(`#filter-tab-${f}`);
    tab?.addEventListener('click', () => {
      currentFilter = f as any;
      refreshView(container);
    });
  });

  // Botón: Extender Licencia 30 Días
  container.querySelectorAll('.btn-extend-license').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      if (!id) return;
      btn.setAttribute('disabled', 'true');
      try {
        await api.superadmin.updateLicense(id, { action: 'renew', add_days: 30 });
        alert('🎉 ¡Licencia extendida 30 días adicionales con éxito!');
        await renderSuperAdminView(container);
      } catch (e: any) {
        alert('Error: ' + e.message);
        btn.removeAttribute('disabled');
      }
    });
  });

  // Botón: Kill-Switch (Pausar / Reactivar)
  container.querySelectorAll('.btn-toggle-license').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const currentlyActive = btn.getAttribute('data-active') === 'true';
      if (!id) return;
      const confirmMsg = currentlyActive 
        ? '¿Estás seguro de pausar/suspender la licencia de este comercio? Sus usuarios no podrán facturar hasta reactivarse.'
        : '¿Reactivar la licencia de este comercio ahora?';
      if (!confirm(confirmMsg)) return;

      btn.setAttribute('disabled', 'true');
      try {
        await api.superadmin.updateLicense(id, { 
          action: currentlyActive ? 'suspend' : 'activate',
          is_active: !currentlyActive,
          license_status: currentlyActive ? 'suspended' : 'active'
        });
        await renderSuperAdminView(container);
      } catch (e: any) {
        alert('Error: ' + e.message);
        btn.removeAttribute('disabled');
      }
    });
  });

  // Modal Crear Comercio
  const openModalBtn = container.querySelector('#btn-open-create-business-modal');
  const modalOverlay = container.querySelector('#modal-create-business');
  const closeModalBtn = container.querySelector('#btn-close-create-modal');
  const cancelModalBtn = container.querySelector('#btn-cancel-create-modal');

  openModalBtn?.addEventListener('click', () => {
    if (modalOverlay) (modalOverlay as HTMLElement).style.display = 'flex';
  });

  const closeModal = () => {
    if (modalOverlay) (modalOverlay as HTMLElement).style.display = 'none';
  };
  closeModalBtn?.addEventListener('click', closeModal);
  cancelModalBtn?.addEventListener('click', closeModal);

  // Form submit crear comercio
  const createForm = container.querySelector('#form-create-business') as HTMLFormElement | null;
  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = container.querySelector('#btn-submit-create-business') as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Aprovisionando Google Sheets y Comercio... 🚀';
    }

    try {
      const name = (container.querySelector('#bus-name') as HTMLInputElement).value.trim();
      const slug = (container.querySelector('#bus-slug') as HTMLInputElement).value.trim();
      const rif = (container.querySelector('#bus-rif') as HTMLInputElement).value.trim();
      const legalName = (container.querySelector('#bus-legal-name') as HTMLInputElement).value.trim();
      const phone = (container.querySelector('#bus-phone') as HTMLInputElement).value.trim();
      const plan = (container.querySelector('#bus-plan') as HTMLSelectElement).value;
      const address = (container.querySelector('#bus-address') as HTMLInputElement).value.trim();
      const adminName = (container.querySelector('#bus-admin-name') as HTMLInputElement).value.trim();
      const adminEmail = (container.querySelector('#bus-admin-email') as HTMLInputElement).value.trim();
      const adminPassword = (container.querySelector('#bus-admin-pass') as HTMLInputElement).value;

      const res = await api.superadmin.createBusiness({
        name,
        slug,
        rif,
        legal_name: legalName,
        phone,
        plan,
        address,
        adminName,
        adminEmail,
        adminPassword,
        days: 30
      });

      alert(`✅ ¡Comercio "${name}" creado exitosamente!\n\nSe ha generado su Google Sheet de respaldo:\n${res.business?.google_sheet_url || 'Asignado'}`);
      closeModal();
      await renderSuperAdminView(container);
    } catch (err: any) {
      alert(`❌ Error al crear comercio: ${err.message || 'Error desconocido'}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear y Aprovisionar Google Sheets 🚀';
      }
    }
  });
}
