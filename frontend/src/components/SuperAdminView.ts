import type { SuperAdminMetrics, SuperAdminBusiness } from '../utils/api';
import { api } from '../utils/api';

/**
 * SuperAdminView.ts
 * Consola centralizada para que el dueño de FacilitoApp gestione licencias, deudores,
 * planes de 1 y 2 años, renovaciones flexibles y aprovisionamiento de comercios.
 */

function formatPlanBadge(plan: string | undefined): string {
  if (!plan) return 'PRO';
  const clean = plan.toLowerCase();
  if (clean === 'basic') return 'Básico';
  if (clean === 'pro') return 'Pro';
  if (clean === 'enterprise') return 'Enterprise';
  if (clean.includes('annual') || clean.includes('anual')) return 'Plan Anual';
  if (clean.includes('2years') || clean.includes('2_years') || clean.includes('2 anos') || clean.includes('2 años')) return 'Plan 2 Años';
  if (clean.includes('3years') || clean.includes('3_years') || clean.includes('3 anos') || clean.includes('3 años')) return 'Plan 3 Años';
  return plan.toUpperCase();
}

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
              <span style="font-size: 11px; font-weight: 700; background: rgba(0,119,246,0.18); border: 1px solid rgba(0,119,246,0.4); color: var(--brand-blue); padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">SaaS Multi-Tienda</span>
            </h1>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 2px 0 0 0;">
              Control global de licencias, planes anuales / 2 años, facturación y comercios
            </p>
          </div>
        </div>

        <button class="btn btn-primary" id="btn-open-create-business-modal" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 15px var(--brand-orange-glow);">
          <span>➕</span> Registrar Comercio / Licencia
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
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Tiendas registradas</div>
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
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Evaluando plataforma</div>
        </div>

        <!-- Deudores / Vencidas -->
        <div class="card" style="padding: 20px; border-radius: 16px; background: var(--bg-glass); border: 1px solid rgba(239,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--danger); text-transform: uppercase;">Vencidas / Pausadas</span>
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
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Ingresos base</div>
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
            ⚠️ Vencidos (${businesses.filter(b => b.isExpired || b.license_status === 'suspended' || b.is_active === 0).length})
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
                <th style="padding: 14px 18px;">Comercio / Slug</th>
                <th style="padding: 14px 18px;">Plan / Tarifa</th>
                <th style="padding: 14px 18px;">Estado</th>
                <th style="padding: 14px 18px;">Vigencia / Vencimiento</th>
                <th style="padding: 14px 18px;">Google Sheets</th>
                <th style="padding: 14px 18px;">Ventas</th>
                <th style="padding: 14px 18px; text-align: right;">Gestión de Licencia</th>
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

                const planBadge = formatPlanBadge(b.license_plan);

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s ease;">
                    
                    <!-- Nombre y Slug -->
                    <td style="padding: 14px 18px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--bg-secondary); border: 1px solid var(--border-glass); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: var(--brand-orange); flex-shrink: 0; overflow: hidden;">
                          ${b.logo_url ? `<img src="${b.logo_url}" style="width:100%; height:100%; object-fit:cover;" alt="${b.name}">` : b.name.charAt(0)}
                        </div>
                        <div>
                          <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${b.name}</div>
                          <div style="font-size: 11px; color: var(--text-muted); display: flex; gap: 6px; align-items: center;">
                            <code style="background: rgba(0,0,0,0.3); padding: 1px 5px; border-radius: 4px; color: var(--brand-blue);">${b.slug}</code>
                            ${b.rif ? `<span>• ${b.rif}</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Plan -->
                    <td style="padding: 14px 18px;">
                      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; background: rgba(255,115,0,0.12); color: var(--brand-orange); border: 1px solid rgba(255,115,0,0.3);">
                        ${planBadge}
                      </span>
                      <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                        $${Number(b.price_monthly || 25).toFixed(2)} tarifa
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
                      <div style="font-weight: 700; color: ${daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 15 ? 'var(--danger)' : 'var(--text-primary)'};">
                        ${daysText}
                      </div>
                      <div style="font-size: 11px; color: var(--text-muted);">
                        ${b.license_expires_at ? new Date(b.license_expires_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Indefinido'}
                      </div>
                    </td>

                    <!-- Google Sheets -->
                    <td style="padding: 14px 18px;">
                      ${b.google_sheet_url ? `
                        <a href="${b.google_sheet_url}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #10b981; text-decoration: none; padding: 4px 10px; border-radius: 6px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25);">
                          <span>📊</span> Sheet
                        </a>
                      ` : `
                        <span style="font-size: 11px; color: var(--text-muted);">No generado</span>
                      `}
                    </td>

                    <!-- Ventas y Productos -->
                    <td style="padding: 14px 18px;">
                      <div style="font-weight: 700; color: var(--text-primary);">$${Number(b.total_revenue || 0).toFixed(2)}</div>
                      <div style="font-size: 11px; color: var(--text-muted);">${b.total_sales || 0} ventas</div>
                    </td>

                    <!-- Acciones y Control -->
                    <td style="padding: 14px 18px; text-align: right;">
                      <div style="display: inline-flex; gap: 6px; align-items: center;">
                        
                        <!-- Botón Principal: Gestionar Licencia (Modal completo) -->
                        <button class="btn btn-sm btn-primary btn-open-manage-modal" 
                                data-id="${b.id}" 
                                data-name="${b.name}" 
                                data-plan="${b.license_plan || 'pro'}" 
                                data-status="${b.license_status}" 
                                data-expires="${b.license_expires_at || ''}" 
                                data-price="${b.price_monthly || 25}" 
                                data-days="${daysRemaining ?? ''}"
                                data-sheet-url="${b.google_sheet_url || ''}"
                                title="Gestionar licencia (Planes Anuales, 2 Años, fechas o tarifas)" 
                                style="padding: 6px 11px; font-size: 12px; font-weight: 700; border-radius: 8px;">
                          ⚙️ Licencia
                        </button>

                        <!-- Kill Switch: Suspender / Activar -->
                        ${isSuspended ? `
                          <button class="btn btn-sm btn-success btn-toggle-status" data-id="${b.id}" data-action="activate" title="Reactivar servicio de este comercio" style="padding: 6px 10px; font-size: 12px; font-weight: 700; border-radius: 8px;">
                            ▶️
                          </button>
                        ` : `
                          <button class="btn btn-sm btn-danger btn-toggle-status" data-id="${b.id}" data-action="suspend" title="Pausar/Suspender servicio (Kill-switch)" style="padding: 6px 10px; font-size: 12px; font-weight: 700; border-radius: 8px;">
                            ⏸️
                          </button>
                        `}

                        <!-- Enlace directo a la tienda -->
                        <a href="/${b.slug}/store" target="_blank" class="btn btn-sm btn-secondary" title="Ver catálogo del comercio" style="padding: 6px 8px; font-size: 12px; border-radius: 8px; text-decoration: none;">
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
      <div id="modal-create-business" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 20px;">
        <div class="card" style="max-width: 620px; width: 100%; border-radius: 20px; padding: 28px; background: var(--bg-secondary); border: 1px solid var(--border-glass); max-height: 90vh; overflow-y: auto;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
              🏢 Registrar Nuevo Comercio & Licencia
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
                  <option value="pro" selected>Plan Pro Mensual ($25/mes)</option>
                  <option value="pro_annual">Plan Pro Anual ($250/año)</option>
                  <option value="pro_2years">Plan Pro 2 Años ($450/2 años)</option>
                  <option value="basic">Plan Básico Mensual ($15/mes)</option>
                  <option value="basic_annual">Plan Básico Anual ($150/año)</option>
                  <option value="enterprise">Plan Enterprise ($50/mes)</option>
                  <option value="enterprise_annual">Plan Enterprise Anual ($500/año)</option>
                  <option value="enterprise_2years">Plan Enterprise 2 Años ($900/2 años)</option>
                  <option value="custom">Plan Personalizado</option>
                </select>
              </div>
            </div>

            <!-- Duración / Período Comprado -->
            <div style="background: rgba(255,115,0,0.06); border: 1px solid rgba(255,115,0,0.25); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
              <div style="font-weight: 700; font-size: 13px; color: var(--brand-orange); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                <span>⏱️</span> Duración de la Suscripción Comprada
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label" for="bus-duration-preset">Período de Contratación *</label>
                  <select class="form-control" id="bus-duration-preset">
                    <option value="30">1 Mes (30 días)</option>
                    <option value="90">3 Meses (90 días)</option>
                    <option value="180">6 Meses (180 días)</option>
                    <option value="365">1 Año (365 días)</option>
                    <option value="730" selected>2 Años (730 días)</option>
                    <option value="1095">3 Años (1095 días)</option>
                    <option value="custom_days">Días personalizados</option>
                    <option value="exact_date">Fecha exacta de vencimiento</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="bus-price">Tarifa / Monto Cobrado ($)</label>
                  <input type="number" step="0.01" class="form-control" id="bus-price" value="450" placeholder="Ej. 450.00">
                </div>
              </div>

              <!-- Inputs condicionales para personalizado -->
              <div id="bus-custom-days-group" style="display: none; margin-top: 10px;">
                <label class="form-label" for="bus-custom-days">Cantidad de días a otorgar:</label>
                <input type="number" class="form-control" id="bus-custom-days" min="1" placeholder="Ej. 730">
              </div>

              <div id="bus-exact-date-group" style="display: none; margin-top: 10px;">
                <label class="form-label" for="bus-exact-date">Fecha límite de vencimiento:</label>
                <input type="date" class="form-control" id="bus-exact-date">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="bus-address">Dirección Física de la Empresa</label>
              <input type="text" class="form-control" id="bus-address" placeholder="Ej. Av. Bolívar, Edif. Torre Azul, Local 2">
            </div>

            <!-- Datos del Administrador de la Tienda -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
              <div style="font-weight: 700; font-size: 13px; color: var(--brand-blue); margin-bottom: 10px;">
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

      <!-- MODAL PARA GESTIONAR Y RENOVAR LICENCIA (Planes Anuales / 2 Años / Fecha exacta) -->
      <div id="modal-manage-license" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 20px;">
        <div class="card" style="max-width: 540px; width: 100%; border-radius: 20px; padding: 28px; background: var(--bg-secondary); border: 1px solid var(--border-glass);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
            <div>
              <h2 style="font-size: 19px; font-weight: 800; color: var(--text-primary); margin: 0;" id="manage-modal-title">
                ⚙️ Gestionar Licencia
              </h2>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;" id="manage-modal-subtitle">
                Comercio seleccionado
              </div>
            </div>
            <button id="btn-close-manage-modal" style="background: none; border: none; font-size: 20px; color: var(--text-secondary); cursor: pointer;">✕</button>
          </div>

          <form id="form-manage-license">
            <input type="hidden" id="manage-business-id">

            <!-- Resumen actual -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Vencimiento Actual</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);" id="manage-current-expires">--</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Días Restantes</div>
                <div style="font-size: 14px; font-weight: 800;" id="manage-current-days">--</div>
              </div>
            </div>

            <!-- Opciones de Extensión -->
            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="manage-add-option">Período a Extender o Asignar *</label>
              <select class="form-control" id="manage-add-option">
                <option value="keep_date" selected>Mantener fecha actual (Solo cambiar estado/plan/tarifa)</option>
                <option value="30">+30 Días (1 Mes)</option>
                <option value="90">+90 Días (3 Meses)</option>
                <option value="180">+180 Días (6 Meses)</option>
                <option value="365">+1 Año (365 Días)</option>
                <option value="730">+2 Años (730 Días)</option>
                <option value="1095">+3 Años (1095 Días)</option>
                <option value="custom_days">Cantidad de días específica</option>
                <option value="exact_date">Fecha fija de vencimiento</option>
              </select>
            </div>

            <div id="manage-custom-days-group" style="display: none; margin-bottom: 14px;">
              <label class="form-label" for="manage-custom-days">Días a sumar:</label>
              <input type="number" class="form-control" id="manage-custom-days" min="1" placeholder="Ej. 730">
            </div>

            <div id="manage-exact-date-group" style="display: none; margin-bottom: 14px;">
              <label class="form-label" for="manage-exact-date">Nueva fecha exacta de vencimiento:</label>
              <input type="date" class="form-control" id="manage-exact-date">
            </div>

            <!-- Plan y Tarifa -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
              <div class="form-group">
                <label class="form-label" for="manage-plan">Plan de Licencia</label>
                <select class="form-control" id="manage-plan">
                  <option value="pro">Plan Pro Mensual</option>
                  <option value="pro_annual">Plan Pro Anual (1 Año)</option>
                  <option value="pro_2years">Plan Pro 2 Años</option>
                  <option value="basic">Plan Básico</option>
                  <option value="basic_annual">Plan Básico Anual</option>
                  <option value="enterprise">Plan Enterprise</option>
                  <option value="enterprise_annual">Plan Enterprise Anual</option>
                  <option value="enterprise_2years">Plan Enterprise 2 Años</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="manage-price">Tarifa / Monto ($)</label>
                <input type="number" step="0.01" class="form-control" id="manage-price" placeholder="Ej. 25.00">
              </div>
            </div>

            <!-- Estado de Licencia -->
            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="manage-status">Estado Operativo</label>
              <select class="form-control" id="manage-status">
                <option value="active">🟢 Activo (Servicio operativo)</option>
                <option value="trial">⏳ Período de Prueba (Trial)</option>
                <option value="suspended">⛔ Suspendido / Pausado (Kill-switch)</option>
              </select>
            </div>

            <!-- Hoja de Google Sheets vinculada -->
            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" for="manage-sheet-url">URL de Google Sheets (Opcional)</label>
              <input type="url" class="form-control" id="manage-sheet-url" placeholder="https://docs.google.com/spreadsheets/d/TU_ID/edit" style="font-size: 12px; font-family: monospace;">
              <small style="color: var(--text-muted); font-size: 11px; display: block; margin-top: 4px;">
                Pega la URL de una hoja real de Google Sheets para este comercio o déjala en blanco.
              </small>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-manage-modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-manage-license" style="font-weight: 700;">
                Guardar y Actualizar Licencia 💾
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
  const searchInput = container.querySelector('#superadmin-search-input') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    currentSearch = searchInput.value;
    refreshView(container);
    const newSearch = container.querySelector('#superadmin-search-input') as HTMLInputElement | null;
    if (newSearch) {
      newSearch.focus();
      newSearch.value = currentSearch;
      newSearch.setSelectionRange(currentSearch.length, currentSearch.length);
    }
  });

  // Filtros: all, active, trial, expired
  const filterAllBtn = container.querySelector('#filter-all-btn');
  const filterActiveBtn = container.querySelector('#filter-active-btn');
  const filterTrialBtn = container.querySelector('#filter-trial-btn');
  const filterExpiredBtn = container.querySelector('#filter-expired-btn');

  filterAllBtn?.addEventListener('click', () => { currentFilter = 'all'; refreshView(container); });
  filterActiveBtn?.addEventListener('click', () => { currentFilter = 'active'; refreshView(container); });
  filterTrialBtn?.addEventListener('click', () => { currentFilter = 'trial'; refreshView(container); });
  filterExpiredBtn?.addEventListener('click', () => { currentFilter = 'expired'; refreshView(container); });

  // Botón: Kill-Switch (Pausar / Reactivar)
  container.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const action = btn.getAttribute('data-action') as 'activate' | 'suspend';
      if (!id) return;
      const isActivating = action === 'activate';
      const confirmMsg = isActivating
        ? '¿Deseas reactivar el servicio de este comercio ahora?'
        : '¿Estás seguro de pausar/suspender la licencia de este comercio? Sus usuarios no podrán facturar hasta reactivarse.';
      if (!confirm(confirmMsg)) return;

      btn.setAttribute('disabled', 'true');
      try {
        await api.superadmin.updateLicense(id, { 
          action,
          is_active: isActivating,
          license_status: isActivating ? 'active' : 'suspended'
        });
        await renderSuperAdminView(container);
      } catch (e: any) {
        alert('Error: ' + e.message);
        btn.removeAttribute('disabled');
      }
    });
  });

  // ==========================================
  // MODAL DE REGISTRAR NUEVO COMERCIO
  // ==========================================
  const openCreateModalBtn = container.querySelector('#btn-open-create-business-modal');
  const createModalOverlay = container.querySelector('#modal-create-business');
  const closeCreateModalBtn = container.querySelector('#btn-close-create-modal');
  const cancelCreateModalBtn = container.querySelector('#btn-cancel-create-modal');
  const durationPresetSelect = container.querySelector('#bus-duration-preset') as HTMLSelectElement | null;
  const customDaysGroup = container.querySelector('#bus-custom-days-group') as HTMLElement | null;
  const exactDateGroup = container.querySelector('#bus-exact-date-group') as HTMLElement | null;
  const planSelect = container.querySelector('#bus-plan') as HTMLSelectElement | null;
  const priceInput = container.querySelector('#bus-price') as HTMLInputElement | null;

  // Ajustar precio sugerido automáticamente según el plan
  planSelect?.addEventListener('change', () => {
    if (!priceInput) return;
    const p = planSelect.value;
    if (p === 'pro_2years') {
      priceInput.value = '450';
      if (durationPresetSelect) durationPresetSelect.value = '730';
    } else if (p === 'pro_annual') {
      priceInput.value = '250';
      if (durationPresetSelect) durationPresetSelect.value = '365';
    } else if (p === 'pro') {
      priceInput.value = '25';
      if (durationPresetSelect) durationPresetSelect.value = '30';
    } else if (p === 'basic') {
      priceInput.value = '15';
      if (durationPresetSelect) durationPresetSelect.value = '30';
    } else if (p === 'basic_annual') {
      priceInput.value = '150';
      if (durationPresetSelect) durationPresetSelect.value = '365';
    } else if (p === 'enterprise') {
      priceInput.value = '50';
      if (durationPresetSelect) durationPresetSelect.value = '30';
    } else if (p === 'enterprise_annual') {
      priceInput.value = '500';
      if (durationPresetSelect) durationPresetSelect.value = '365';
    } else if (p === 'enterprise_2years') {
      priceInput.value = '900';
      if (durationPresetSelect) durationPresetSelect.value = '730';
    }
  });

  durationPresetSelect?.addEventListener('change', () => {
    if (customDaysGroup) customDaysGroup.style.display = durationPresetSelect.value === 'custom_days' ? 'block' : 'none';
    if (exactDateGroup) exactDateGroup.style.display = durationPresetSelect.value === 'exact_date' ? 'block' : 'none';
  });

  openCreateModalBtn?.addEventListener('click', () => {
    if (createModalOverlay) (createModalOverlay as HTMLElement).style.display = 'flex';
  });

  const closeCreateModal = () => {
    if (createModalOverlay) (createModalOverlay as HTMLElement).style.display = 'none';
  };
  closeCreateModalBtn?.addEventListener('click', closeCreateModal);
  cancelCreateModalBtn?.addEventListener('click', closeCreateModal);

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
      const phone = (container.querySelector('#bus-phone') as HTMLInputElement).value.trim();
      const plan = (container.querySelector('#bus-plan') as HTMLSelectElement).value;
      const price = Number(priceInput?.value || 25);
      const address = (container.querySelector('#bus-address') as HTMLInputElement).value.trim();
      const adminName = (container.querySelector('#bus-admin-name') as HTMLInputElement).value.trim();
      const adminEmail = (container.querySelector('#bus-admin-email') as HTMLInputElement).value.trim();
      const adminPassword = (container.querySelector('#bus-admin-pass') as HTMLInputElement).value;

      let license_days: number | undefined = undefined;
      let expires_at: string | undefined = undefined;

      const durVal = durationPresetSelect?.value || '730';
      if (durVal === 'exact_date') {
        const dateVal = (container.querySelector('#bus-exact-date') as HTMLInputElement).value;
        if (!dateVal) throw new Error('Por favor ingresa la fecha exacta de vencimiento.');
        expires_at = dateVal;
      } else if (durVal === 'custom_days') {
        const daysVal = Number((container.querySelector('#bus-custom-days') as HTMLInputElement).value);
        if (!daysVal || daysVal <= 0) throw new Error('Por favor ingresa una cantidad válida de días.');
        license_days = daysVal;
      } else {
        license_days = Number(durVal);
      }

      const res = await api.superadmin.createBusiness({
        name,
        slug,
        rif,
        legal_name: name,
        phone,
        license_plan: plan,
        license_days,
        expires_at,
        price_monthly: price,
        address,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword
      });

      const sheetMsg = res.business?.google_sheet_url 
        ? `\n\n📊 Hoja de Google Sheets vinculada:\n${res.business.google_sheet_url}`
        : '\n\n💡 Puedes vincular una hoja de Google Sheets en cualquier momento desde "⚙️ Licencia" o desde "Mi Negocio".';
      alert(`✅ ¡Comercio "${name}" creado exitosamente con su plan y vigencia!${sheetMsg}`);
      closeCreateModal();
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

  // ==========================================
  // MODAL DE GESTIÓN Y RENOVACIÓN DE LICENCIA
  // ==========================================
  const manageModalOverlay = container.querySelector('#modal-manage-license');
  const closeManageModalBtn = container.querySelector('#btn-close-manage-modal');
  const cancelManageModalBtn = container.querySelector('#btn-cancel-manage-modal');
  const manageTitle = container.querySelector('#manage-modal-title');
  const manageSubtitle = container.querySelector('#manage-modal-subtitle');
  const manageCurrentExpires = container.querySelector('#manage-current-expires');
  const manageCurrentDays = container.querySelector('#manage-current-days') as HTMLElement | null;
  const manageBusinessIdInput = container.querySelector('#manage-business-id') as HTMLInputElement | null;

  const manageAddOptionSelect = container.querySelector('#manage-add-option') as HTMLSelectElement | null;
  const manageCustomDaysGroup = container.querySelector('#manage-custom-days-group') as HTMLElement | null;
  const manageExactDateGroup = container.querySelector('#manage-exact-date-group') as HTMLElement | null;
  const managePlanSelect = container.querySelector('#manage-plan') as HTMLSelectElement | null;
  const managePriceInput = container.querySelector('#manage-price') as HTMLInputElement | null;
  const manageStatusSelect = container.querySelector('#manage-status') as HTMLSelectElement | null;

  manageAddOptionSelect?.addEventListener('change', () => {
    if (manageCustomDaysGroup) manageCustomDaysGroup.style.display = manageAddOptionSelect.value === 'custom_days' ? 'block' : 'none';
    if (manageExactDateGroup) manageExactDateGroup.style.display = manageAddOptionSelect.value === 'exact_date' ? 'block' : 'none';
  });

  const closeManageModal = () => {
    if (manageModalOverlay) (manageModalOverlay as HTMLElement).style.display = 'none';
  };
  closeManageModalBtn?.addEventListener('click', closeManageModal);
  cancelManageModalBtn?.addEventListener('click', closeManageModal);

  // Abrir modal de gestión al hacer clic en botón de la fila
  container.querySelectorAll('.btn-open-manage-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id') || '';
      const name = btn.getAttribute('data-name') || 'Comercio';
      const plan = btn.getAttribute('data-plan') || 'pro';
      const status = btn.getAttribute('data-status') || 'active';
      const expires = btn.getAttribute('data-expires') || '';
      const price = btn.getAttribute('data-price') || '25';
      const days = btn.getAttribute('data-days') || '';

      if (manageBusinessIdInput) manageBusinessIdInput.value = id;
      if (manageTitle) manageTitle.textContent = `⚙️ Gestionar Licencia: ${name}`;
      if (manageSubtitle) manageSubtitle.textContent = `ID #${id} • Plan actual: ${formatPlanBadge(plan)}`;
      if (manageCurrentExpires) {
        manageCurrentExpires.textContent = expires ? new Date(expires).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Indefinido';
      }
      if (manageCurrentDays) {
        if (days !== '') {
          const numDays = Number(days);
          manageCurrentDays.textContent = numDays > 0 ? `${numDays} días restantes` : (numDays === 0 ? 'Vence hoy' : `Vencida (${Math.abs(numDays)}d)`);
          manageCurrentDays.style.color = numDays <= 15 ? 'var(--danger)' : 'var(--success)';
        } else {
          manageCurrentDays.textContent = 'Sin límite';
          manageCurrentDays.style.color = 'var(--text-secondary)';
        }
      }

      if (managePlanSelect) managePlanSelect.value = plan;
      if (managePriceInput) managePriceInput.value = price;
      if (manageStatusSelect) manageStatusSelect.value = status === 'suspended' ? 'suspended' : (status === 'trial' ? 'trial' : 'active');
      if (manageAddOptionSelect) {
        manageAddOptionSelect.value = 'keep_date';
        manageAddOptionSelect.dispatchEvent(new Event('change'));
      }

      const sheetUrl = btn.getAttribute('data-sheet-url') || '';
      const manageSheetUrlInput = container.querySelector('#manage-sheet-url') as HTMLInputElement | null;
      if (manageSheetUrlInput) manageSheetUrlInput.value = sheetUrl;

      if (manageModalOverlay) (manageModalOverlay as HTMLElement).style.display = 'flex';
    });
  });

  // Botones de acción rápida: Pausar/Suspender (Kill-switch) o Reactivar directamente en la tabla
  container.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const action = btn.getAttribute('data-action') as 'suspend' | 'activate';
      if (!id || !action) return;

      const isSuspending = action === 'suspend';
      const confirmMsg = isSuspending
        ? '¿Estás seguro de que deseas pausar/suspender la licencia de este comercio? No podrá operar en el sistema hasta que sea reactivada.'
        : '¿Deseas reactivar el servicio operativo de este comercio?';

      if (!confirm(confirmMsg)) return;

      try {
        await api.superadmin.updateLicense(id, {
          action,
          license_status: isSuspending ? 'suspended' : 'active',
          is_active: !isSuspending
        });
        alert(isSuspending ? '⛔ Comercio pausado/suspendido con éxito.' : '🟢 Comercio reactivado con éxito.');
        await renderSuperAdminView(container);
      } catch (err: any) {
        alert(`❌ Error al cambiar estado: ${err.message || 'Error desconocido'}`);
      }
    });
  });

  // Guardar cambios de licencia en modal
  const manageForm = container.querySelector('#form-manage-license') as HTMLFormElement | null;
  manageForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = Number(manageBusinessIdInput?.value);
    if (!id) return;

    const submitBtn = container.querySelector('#btn-submit-manage-license') as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando cambios de licencia... ⏳';
    }

    try {
      const opt = manageAddOptionSelect?.value || 'keep_date';
      const selectedPlan = managePlanSelect?.value || 'pro';
      const priceVal = Number(managePriceInput?.value || 25);
      const statusVal = manageStatusSelect?.value || 'active';
      const sheetUrlVal = (container.querySelector('#manage-sheet-url') as HTMLInputElement | null)?.value.trim() || null;
      const isSuspending = statusVal === 'suspended';

      let add_days: number | undefined = undefined;
      let expires_at: string | undefined = undefined;

      if (!isSuspending) {
        if (opt === 'exact_date') {
          const dateInput = (container.querySelector('#manage-exact-date') as HTMLInputElement).value;
          if (!dateInput) throw new Error('Por favor selecciona una fecha de vencimiento.');
          expires_at = dateInput;
        } else if (opt === 'custom_days') {
          const daysInput = Number((container.querySelector('#manage-custom-days') as HTMLInputElement).value);
          if (!daysInput || daysInput <= 0) throw new Error('Por favor ingresa una cantidad válida de días.');
          add_days = daysInput;
        } else if (opt !== 'keep_date') {
          add_days = Number(opt);
        }
      }

      await api.superadmin.updateLicense(id, {
        action: isSuspending ? 'suspend' : (add_days ? 'renew' : undefined),
        add_days,
        expires_at,
        license_plan: selectedPlan,
        price_monthly: priceVal,
        license_status: statusVal,
        is_active: !isSuspending,
        google_sheet_url: sheetUrlVal
      });

      alert(isSuspending ? '⛔ ¡Licencia del comercio pausada/suspendida con éxito!' : '🎉 ¡Licencia y vigencia actualizadas con éxito!');
      closeManageModal();
      await renderSuperAdminView(container);
    } catch (err: any) {
      alert(`❌ Error al actualizar licencia: ${err.message || 'Error desconocido'}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar y Actualizar Licencia 💾';
      }
    }
  });
}
