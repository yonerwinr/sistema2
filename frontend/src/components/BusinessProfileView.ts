import type { BusinessProfile } from '../utils/api';
import { api } from '../utils/api';

/**
 * BusinessProfileView.ts
 * Formulario para que cada comercio configure sus datos fiscales, logotipo local,
 * visualice el estado y vencimiento de su licencia, vincule su hoja real de Google Sheets y configure facturas.
 */

function formatPlanName(plan: string | undefined): string {
  if (!plan) return 'PRO';
  const clean = plan.toLowerCase();
  if (clean.includes('trial_3') || clean.includes('3days') || clean.includes('3_dias')) return 'Prueba 3 Días ⏳';
  if (clean.includes('trial_7') || clean.includes('7days') || clean.includes('7_dias')) return 'Prueba 7 Días ⏳';
  if (clean.includes('trial')) return 'Prueba Gratuita ⏳';
  if (clean === 'basic') return 'Básico';
  if (clean === 'basic_annual') return 'Básico Anual';
  if (clean === 'pro') return 'Pro Mensual';
  if (clean.includes('annual') || clean.includes('anual')) return 'Plan Anual';
  if (clean.includes('2years') || clean.includes('2_years') || clean.includes('2 anos') || clean.includes('2 años')) return 'Plan 2 Años 🚀';
  if (clean.includes('3years') || clean.includes('3_years') || clean.includes('3 anos') || clean.includes('3 años')) return 'Plan 3 Años';
  if (clean === 'enterprise') return 'Enterprise';
  if (clean === 'custom') return 'Personalizado';
  return plan.toUpperCase();
}

function formatExpirationDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Indefinido';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Indefinido';
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return 'Indefinido';
  }
}

export function renderBusinessProfileHtml(business: BusinessProfile | null): string {
  const b = business || {
    id: 1,
    name: 'Mi Empresa',
    slug: 'mi-empresa',
    rif: '',
    legal_name: '',
    logo_url: '',
    phone: '',
    email: '',
    address: '',
    ticket_message: '¡Gracias por su compra!',
    license_status: 'active',
    license_plan: 'pro',
    license_expires_at: null,
    price_monthly: 25,
    google_sheet_url: null,
    google_sheets_webhook_url: '',
    is_active: 1
  };

  // Calcular días restantes si no viene precalculado
  let daysRemaining = b.daysRemaining;
  if (daysRemaining === undefined || daysRemaining === null) {
    if (b.license_expires_at) {
      const exp = new Date(b.license_expires_at);
      const diffMs = exp.getTime() - new Date().getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  const isExpired = b.isExpired || b.license_status === 'expired' || (daysRemaining !== null && daysRemaining !== undefined && daysRemaining < 0);
  const isSuspended = b.license_status === 'suspended' || b.is_active === 0;

  let statusBadgeColor = 'var(--success)';
  let statusBadgeBg = 'rgba(16,185,129,0.12)';
  let statusBorder = 'rgba(16,185,129,0.3)';
  let statusText = '🟢 Licencia Activa';

  if (isSuspended) {
    statusBadgeColor = 'var(--danger)';
    statusBadgeBg = 'rgba(239,68,68,0.12)';
    statusBorder = 'rgba(239,68,68,0.3)';
    statusText = '⛔ Licencia Suspendida';
  } else if (isExpired) {
    statusBadgeColor = 'var(--danger)';
    statusBadgeBg = 'rgba(239,68,68,0.12)';
    statusBorder = 'rgba(239,68,68,0.3)';
    statusText = '⚠️ Licencia Vencida';
  } else if (daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 15) {
    statusBadgeColor = '#f59e0b';
    statusBadgeBg = 'rgba(245,158,11,0.12)';
    statusBorder = 'rgba(245,158,11,0.3)';
    statusText = `🟡 Por Vencer (${daysRemaining} días restantes)`;
  }

  const formattedExpiration = formatExpirationDate(b.license_expires_at);
  const planDisplay = formatPlanName(b.license_plan);
  const hasRealSheet = b.google_sheet_url && !b.google_sheet_url.includes('facilito_');

  return `
    <div class="business-profile-container animate-fade-in" style="max-width: 1020px; margin: 0 auto; padding: 20px 0;">
      
      <!-- ENCABEZADO -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 10px;">
            🏢 Perfil de Empresa & Facturación
          </h2>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 4px 0 0 0;">
            Personaliza el logotipo, los datos fiscales que se imprimen en tus facturas y tu respaldo en Google Sheets.
          </p>
        </div>

        <a href="https://wa.me/584120000000?text=${encodeURIComponent(`Hola, deseo consultar sobre mi suscripción de FacilitoApp para el comercio "${b.name}"`)}" target="_blank" class="btn btn-secondary" style="font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border-radius: 10px; text-decoration: none;">
          <span>💬</span> Soporte / Renovar
        </a>
      </div>

      <!-- TARJETA DESTACADA: ESTADO Y VENCIMIENTO DE LA SUSCRIPCIÓN -->
      <div class="card" style="padding: 20px 24px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%); border: 1px solid ${statusBorder}; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 52px; height: 52px; border-radius: 14px; background: ${statusBadgeBg}; border: 1px solid ${statusBorder}; display: flex; align-items: center; justify-content: center; font-size: 26px; flex-shrink: 0;">
              ${isExpired || isSuspended ? '⚠️' : '🛡️'}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 20px; background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBorder};">
                  ${statusText}
                </span>
                <span style="font-size: 12px; font-weight: 700; color: var(--brand-orange); background: rgba(255,115,0,0.12); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,115,0,0.25);">
                  ${planDisplay}
                </span>
              </div>
              <div style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-top: 6px;">
                ${daysRemaining !== null && daysRemaining !== undefined 
                  ? (daysRemaining > 0 ? `Te quedan ${daysRemaining} días de servicio activo` : (daysRemaining === 0 ? '¡Tu licencia vence hoy!' : `Licencia expiró hace ${Math.abs(daysRemaining)} días`))
                  : 'Suscripción sin fecha límite'}
              </div>
            </div>
          </div>

          <div style="text-align: right; background: rgba(0,0,0,0.25); padding: 10px 16px; border-radius: 12px; border: 1px solid var(--border-glass);">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Fecha de Vencimiento</div>
            <div style="font-size: 15px; font-weight: 800; color: ${isExpired ? 'var(--danger)' : 'var(--text-primary)'}; margin-top: 2px;">
              ${formattedExpiration}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              ${b.price_monthly ? `Tarifa: $${Number(b.price_monthly).toFixed(2)}` : ''}
            </div>
          </div>

        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start;">
        
        <!-- FORMULARIO DE DATOS FISCALES Y LOGO -->
        <div class="card" style="padding: 24px; border-radius: 18px; background: var(--bg-glass); border: 1px solid var(--border-glass);">
          
          <form id="form-business-profile">
            
            <h3 style="font-size: 15px; font-weight: 700; color: var(--brand-orange); margin-bottom: 16px; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px;">
              📋 Información General y Fiscal
            </h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
              <div class="form-group">
                <label class="form-label" for="prof-name">Nombre Comercial *</label>
                <input type="text" class="form-control" id="prof-name" required value="${b.name || ''}" placeholder="Ej. Minimarket San José">
              </div>
              <div class="form-group">
                <label class="form-label" for="prof-rif">RIF / Identificación Fiscal *</label>
                <input type="text" class="form-control" id="prof-rif" value="${b.rif || ''}" placeholder="Ej. J-12345678-9">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="prof-legal">Razón Social Legal</label>
              <input type="text" class="form-control" id="prof-legal" value="${b.legal_name || ''}" placeholder="Ej. Inversiones San José C.A.">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
              <div class="form-group">
                <label class="form-label" for="prof-phone">Teléfono de Contacto</label>
                <input type="tel" class="form-control" id="prof-phone" value="${b.phone || ''}" placeholder="Ej. +58 412 1234567">
              </div>
              <div class="form-group">
                <label class="form-label" for="prof-email">Correo de Contacto</label>
                <input type="email" class="form-control" id="prof-email" value="${b.email || ''}" placeholder="contacto@minegocio.com">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
              <label class="form-label" for="prof-address">Dirección Fiscal / Ubicación del Local</label>
              <textarea class="form-control" id="prof-address" rows="2" placeholder="Ej. Calle 4 con Carrera 12, Local N° 3, Frente a la Plaza Bolívar">${b.address || ''}</textarea>
            </div>

            <!-- SECCIÓN LOGOTIPO Y FOTO DEL COMERCIO / FACTURA -->
            <h3 style="font-size: 15px; font-weight: 700; color: var(--brand-blue); margin-bottom: 14px; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
              <span>🖼️</span> Foto de Perfil, Logotipo & Factura
            </h3>

            <!-- Campo oculto donde se guarda la ruta interna / base64 -->
            <input type="hidden" id="prof-logo" value="${b.logo_url || ''}">

            <div id="prof-logo-dropzone" style="background: rgba(0, 119, 246, 0.05); border: 2px dashed rgba(0, 119, 246, 0.35); border-radius: 14px; padding: 18px; margin-bottom: 18px; transition: all 0.2s ease;">
              
              <div style="display: flex; gap: 18px; align-items: center; flex-wrap: wrap;">
                
                <!-- Caja de Vista Previa del Logo -->
                <div id="prof-logo-preview-box" style="width: 96px; height: 96px; border-radius: 14px; background: rgba(0,0,0,0.35); border: 2px solid var(--border-glass); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                  ${b.logo_url 
                    ? `<img src="${b.logo_url}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';" alt="Logotipo">` 
                    : '<img src="/logo.png" style="width: 100%; height: 100%; object-fit: contain;" alt="Logotipo">'}
                </div>

                <div style="flex-grow: 1; min-width: 240px;">
                  <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                    Logotipo Principal para Mi Negocio y Factura
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">
                    Puedes seleccionar una foto o logotipo local desde tu computadora o teléfono (PNG, JPG, WEBP o SVG). Aparecerá en el encabezado de tus facturas impresas, tickets y tienda online.
                  </div>

                  <!-- Input de archivo real (oculto) -->
                  <input type="file" id="prof-logo-file-input" accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" style="display: none;">
                  
                  <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
                    <button type="button" class="btn btn-sm btn-primary" id="btn-browse-logo" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; padding: 8px 16px; border-radius: 8px;">
                      <span>📁</span> ${b.logo_url ? 'Cambiar Foto desde este Equipo' : '📁 Seleccionar Foto Local'}
                    </button>

                    <button type="button" class="btn btn-sm btn-secondary" id="btn-use-facilito-logo" style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 8px 14px; border-radius: 8px;" title="Usar el logotipo oficial de Facilito">
                      <span>🐒</span> Usar Logo Oficial Facilito
                    </button>

                    <button type="button" class="btn btn-sm btn-secondary" id="btn-toggle-url-logo" style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 8px 14px; border-radius: 8px;">
                      <span>🔗</span> Pegar Enlace URL
                    </button>

                    <button type="button" class="btn btn-sm btn-secondary" id="btn-remove-logo" style="display: ${b.logo_url ? 'inline-flex' : 'none'}; align-items: center; gap: 6px; color: var(--danger); border-color: rgba(239,68,68,0.3); border-radius: 8px; padding: 8px 14px;">
                      <span>🗑️</span> Quitar Foto
                    </button>

                    <span id="prof-logo-upload-status" style="font-size: 12px; font-weight: 600;"></span>
                  </div>

                  <!-- Input alternativo para ingresar URL si lo desea -->
                  <div id="prof-logo-url-container" style="display: ${b.logo_url && b.logo_url.startsWith('http') ? 'block' : 'none'}; margin-top: 8px;">
                    <input type="url" class="form-control" id="prof-logo-url-input" placeholder="https://mi-dominio.com/logo.png" style="font-size: 12px; height: 34px;" value="${b.logo_url && b.logo_url.startsWith('http') ? b.logo_url : ''}">
                    <small style="font-size: 10.5px; color: var(--text-muted); display: block; margin-top: 3px;">
                      Ingresa el enlace directo a tu imagen web y se reflejará al instante.
                    </small>
                  </div>
                </div>

              </div>

            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" for="prof-ticket-msg">Mensaje al Pie del Ticket de Venta</label>
              <textarea class="form-control" id="prof-ticket-msg" rows="2" placeholder="¡Gracias por su compra! Garantía de 15 días presentando su factura. Síguenos en @minegocio">${b.ticket_message || ''}</textarea>
            </div>

            <!-- SECCIÓN GOOGLE SHEETS -->
            <h3 style="font-size: 15px; font-weight: 700; color: #10b981; margin-bottom: 16px; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
              <span>📊</span> Respaldo en Vivo en Google Sheets
            </h3>

            <div id="google-sheets-section-wrapper" style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.25); border-radius: 14px; padding: 18px; margin-bottom: 18px;">
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <span style="font-size: 13px; font-weight: 700; color: #10b981; display: flex; align-items: center; gap: 6px;">
                  <span>📑</span> Enlace de tu Hoja de Google Sheets
                </span>
                <span style="font-size: 11px; background: rgba(16,185,129,0.18); color: #10b981; border: 1px solid rgba(16,185,129,0.3); padding: 3px 8px; border-radius: 6px; font-weight: 700;">
                  ${hasRealSheet ? '🟢 Hoja Vinculada' : '⚙️ Requiere Vincular Hoja'}
                </span>
              </div>

              <!-- Explicación amigable paso a paso -->
              <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 12px 0; line-height: 1.5;">
                Pega aquí el enlace de tu hoja de Google Sheets para que quede guardada y conectada a tu negocio. Si aún no tienes una hoja creada, puedes abrir una en 1 clic:
              </p>

              <!-- Botones rápidos de ayuda para crear y preparar la hoja -->
              <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
                <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; text-decoration: none; padding: 7px 14px; border-radius: 8px; font-size: 12px;">
                  <span>✨</span> Crear Hoja Nueva (sheets.new) ↗️
                </a>

                <button type="button" class="btn btn-sm btn-secondary" id="btn-copy-sheet-headers" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; padding: 7px 14px; border-radius: 8px; font-size: 12px;" title="Copia los encabezados para pegarlos en la primera fila de tu hoja">
                  <span>📋</span> <span id="copy-headers-btn-text">Copiar Encabezados para Fila 1</span>
                </button>
              </div>

              <!-- Campo para ingresar / editar el enlace real de Google Sheets -->
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label" for="prof-sheet-url" style="font-size: 12px; font-weight: 600;">URL / Enlace de la Hoja de Google Sheets:</label>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <input type="url" class="form-control" id="prof-sheet-url" value="${hasRealSheet ? (b.google_sheet_url || '') : ''}" placeholder="https://docs.google.com/spreadsheets/d/TU_ID_DE_HOJA/edit" style="font-size: 12px; font-family: monospace; height: 38px; min-width: 240px; flex-grow: 1;">
                  
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-sheet-url" style="height: 38px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; border-radius: 8px;" title="Copiar enlace al portapapeles">
                    <span>📋</span> <span id="copy-sheet-btn-text">Copiar Enlace</span>
                  </button>

                  <a id="btn-open-sheet-link" href="${hasRealSheet ? b.google_sheet_url : 'https://sheets.google.com'}" target="_blank" rel="noopener noreferrer" class="btn btn-success btn-sm" style="height: 38px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; padding: 0 14px; border-radius: 8px;" title="Abrir Google Sheets">
                    <span>↗️</span> Abrir
                  </a>
                </div>
              </div>

              <!-- Separador y Explicación del Webhook en Vivo -->
              <div style="margin-top: 16px; padding-top: 14px; border-top: 1px dashed rgba(16,185,129,0.25);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                  <label class="form-label" for="prof-sheet-webhook" style="font-size: 12px; font-weight: 700; margin: 0; color: #10b981; display: flex; align-items: center; gap: 6px;">
                    <span>⚡</span> Sincronización en Tiempo Real (Google Apps Script):
                  </label>
                  <button type="button" id="btn-toggle-script-guide" class="btn btn-sm btn-secondary" style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
                    📖 ¿Cómo conectar en 3 pasos? (Ver Código)
                  </button>
                </div>

                <p style="font-size: 11.5px; color: var(--text-muted); margin: 0 0 10px 0; line-height: 1.4;">
                  Google exige este conector seguro para que tus ventas se registren automáticamente en tu hoja de Google Sheets. Solo toma 1 minuto:
                </p>

                <!-- Panel colapsable con las instrucciones y el código listo -->
                <div id="script-guide-box" style="display: none; background: rgba(0,0,0,0.35); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                  <div style="font-size: 12px; font-weight: 700; color: white; margin-bottom: 8px;">
                    🚀 Pasos para activar el registro automático de ventas:
                  </div>
                  <ol style="font-size: 11.5px; color: var(--text-secondary); margin: 0 0 12px 18px; padding: 0; line-height: 1.6;">
                    <li>Abre tu hoja de Google Sheets y ve al menú: <b>Extensiones ➔ Apps Script</b>.</li>
                    <li>Borra el código que esté en pantalla y pega el script de abajo (pulsa <i>Copiar Código</i>).</li>
                    <li>Haz clic en el botón azul superior: <b>Implementar ➔ Nueva implementación</b>.</li>
                    <li>En el engranaje ⚙️ selecciona <b>Aplicación web</b>. En <i>"Quién tiene acceso"</i> pon <b>Cualquier usuario (Anyone)</b> y haz clic en <b>Implementar</b>.</li>
                    <li>Copia la <b>URL de la aplicación web</b> que te da Google (termina en <code>/exec</code>), pégala en la casilla de abajo y pulsa <b>⚡ Probar Conexión</b>.</li>
                  </ol>

                  <div>
                    <textarea id="apps-script-code" readonly style="width: 100%; height: 110px; font-family: monospace; font-size: 11px; background: #0f172a; color: #a7f3d0; border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; padding: 10px; resize: none;">function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      data.saleId || '',
      data.date || '',
      data.customerName || 'Cliente General',
      data.customerCi || '',
      data.customerPhone || '',
      data.paymentMethod || '',
      data.subtotal || '0.00',
      data.discount || '0.00',
      data.total || '0.00',
      data.amountPaid || '0.00',
      data.items || '',
      data.sellerName || 'POS'
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}</textarea>
                    <button type="button" id="btn-copy-apps-script" class="btn btn-sm btn-primary" style="margin-top: 8px; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 6px;">
                      📋 Copiar Código del Script
                    </button>
                  </div>
                </div>

                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <input type="url" class="form-control" id="prof-sheet-webhook" value="${b.google_sheets_webhook_url || ''}" placeholder="https://script.google.com/macros/s/.../exec" style="font-size: 12px; font-family: monospace; height: 38px; min-width: 240px; flex-grow: 1;">
                  
                  <button type="button" class="btn btn-success btn-sm" id="btn-test-sheet-webhook" style="height: 38px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; border-radius: 8px;" title="Enviar fila de prueba a tu hoja de Google Sheets">
                    <span>⚡</span> Probar Conexión
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary w-100" id="btn-save-business-profile" style="padding: 12px; font-weight: 700; border-radius: 12px; font-size: 15px;">
              Guardar Configuración Fiscal y Factura 💾
            </button>

          </form>

        </div>

        <!-- VISTA PREVIA DEL TICKET TÉRMICO IMPRESO -->
        <div class="card" style="padding: 20px; border-radius: 18px; background: #ffffff; color: #111111; font-family: 'Courier New', Courier, monospace; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <div style="font-size: 11px; font-weight: 700; color: #666666; text-transform: uppercase; text-align: center; margin-bottom: 12px; font-family: sans-serif;">
            Vista Previa de Ticket Térmico
          </div>

          <!-- Ticket simulado -->
          <div style="text-align: center; border-bottom: 1px dashed #666666; padding-bottom: 12px; margin-bottom: 12px;">
            <div id="preview-ticket-logo" style="margin-bottom: 8px;">
              ${b.logo_url 
                ? `<img src="${b.logo_url}" style="max-width: 80px; max-height: 80px; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';" alt="Logo">` 
                : '<img src="/logo.png" style="max-width: 80px; max-height: 80px; object-fit: contain;" alt="Logo">'}
            </div>
            <div id="preview-ticket-name" style="font-size: 15px; font-weight: bold;">${b.name || 'NOMBRE DE EMPRESA'}</div>
            <div id="preview-ticket-rif" style="font-size: 12px;">RIF: ${b.rif || 'J-00000000-0'}</div>
            <div id="preview-ticket-address" style="font-size: 10px; color: #333333; margin-top: 4px;">${b.address || 'Dirección de la tienda'}</div>
            <div id="preview-ticket-phone" style="font-size: 10px; color: #333333;">Tel: ${b.phone || '+58 000 0000000'}</div>
          </div>

          <div style="font-size: 11px; margin-bottom: 12px;">
            <div>FACTURA #00123</div>
            <div>FECHA: ${new Date().toLocaleDateString('es-ES')} 10:45 AM</div>
            <div>CAJERO: Juan Pérez</div>
          </div>

          <div style="border-bottom: 1px dashed #666666; padding-bottom: 8px; margin-bottom: 8px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between;">
              <span>1x Refresco 2L</span>
              <span>$2.50</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>2x Harina de Maíz</span>
              <span>$2.20</span>
            </div>
          </div>

          <div style="font-size: 12px; font-weight: bold; display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span>TOTAL:</span>
            <span>$4.70</span>
          </div>

          <div id="preview-ticket-footer" style="text-align: center; font-size: 10px; color: #555555;">
            ${b.ticket_message || '¡Gracias por su compra!'}
          </div>

        </div>

      </div>

    </div>
  `;
}

function compressImageToBase64(file: File, maxDim: number = 450, quality: number = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(event.target?.result as string);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, quality));
      };
      img.onerror = () => resolve(event.target?.result as string);
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function setupBusinessProfileEvents(
  container: HTMLElement,
  onProfileUpdated?: (b: BusinessProfile) => void
) {
  const form = container.querySelector('#form-business-profile') as HTMLFormElement | null;
  const nameInput = container.querySelector('#prof-name') as HTMLInputElement | null;
  const rifInput = container.querySelector('#prof-rif') as HTMLInputElement | null;
  const legalInput = container.querySelector('#prof-legal') as HTMLInputElement | null;
  const phoneInput = container.querySelector('#prof-phone') as HTMLInputElement | null;
  const emailInput = container.querySelector('#prof-email') as HTMLInputElement | null;
  const addressInput = container.querySelector('#prof-address') as HTMLTextAreaElement | null;
  const logoHiddenInput = container.querySelector('#prof-logo') as HTMLInputElement | null;
  const msgInput = container.querySelector('#prof-ticket-msg') as HTMLTextAreaElement | null;
  const fileInput = container.querySelector('#prof-logo-file-input') as HTMLInputElement | null;
  const browseBtn = container.querySelector('#btn-browse-logo') as HTMLButtonElement | null;
  const useFacilitoBtn = container.querySelector('#btn-use-facilito-logo') as HTMLButtonElement | null;
  const removeLogoBtn = container.querySelector('#btn-remove-logo') as HTMLButtonElement | null;
  const uploadStatus = container.querySelector('#prof-logo-upload-status') as HTMLElement | null;
  const logoPreviewBox = container.querySelector('#prof-logo-preview-box') as HTMLElement | null;

  const sheetUrlInput = container.querySelector('#prof-sheet-url') as HTMLInputElement | null;
  const sheetWebhookInput = container.querySelector('#prof-sheet-webhook') as HTMLInputElement | null;
  const openSheetLink = container.querySelector('#btn-open-sheet-link') as HTMLAnchorElement | null;

  // Elementos de la vista previa del ticket
  const previewLogo = container.querySelector('#preview-ticket-logo') as HTMLElement | null;
  const previewName = container.querySelector('#preview-ticket-name') as HTMLElement | null;
  const previewRif = container.querySelector('#preview-ticket-rif') as HTMLElement | null;
  const previewAddress = container.querySelector('#preview-ticket-address') as HTMLElement | null;
  const previewPhone = container.querySelector('#preview-ticket-phone') as HTMLElement | null;
  const previewFooter = container.querySelector('#preview-ticket-footer') as HTMLElement | null;

  // Vista previa interactiva en tiempo real del ticket térmico
  nameInput?.addEventListener('input', () => {
    if (previewName) previewName.textContent = nameInput.value.trim() || 'NOMBRE DE EMPRESA';
  });
  rifInput?.addEventListener('input', () => {
    if (previewRif) previewRif.textContent = `RIF: ${rifInput.value.trim() || 'J-00000000-0'}`;
  });
  addressInput?.addEventListener('input', () => {
    if (previewAddress) previewAddress.textContent = addressInput.value.trim() || 'Dirección de la tienda';
  });
  phoneInput?.addEventListener('input', () => {
    if (previewPhone) previewPhone.textContent = `Tel: ${phoneInput.value.trim() || '+58 000 0000000'}`;
  });
  msgInput?.addEventListener('input', () => {
    if (previewFooter) previewFooter.textContent = msgInput.value.trim() || '¡Gracias por su compra!';
  });

  const updateLogoDisplay = (url: string) => {
    if (logoPreviewBox) {
      logoPreviewBox.innerHTML = url
        ? `<img src="${url}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';" alt="Logo">`
        : '<img src="/logo.png" style="width: 100%; height: 100%; object-fit: contain;" alt="Logo">';
    }
    if (previewLogo) {
      previewLogo.innerHTML = url
        ? `<img src="${url}" style="max-width: 80px; max-height: 80px; object-fit: contain;" onerror="this.onerror=null; this.src='/logo.png';" alt="Logo">`
        : '<img src="/logo.png" style="max-width: 80px; max-height: 80px; object-fit: contain;" alt="Logo">';
    }
    if (browseBtn) {
      browseBtn.innerHTML = `<span>📁</span> ${url ? 'Cambiar Foto desde este Equipo' : '📁 Seleccionar Foto Local'}`;
    }
    if (removeLogoBtn) {
      removeLogoBtn.style.display = url ? 'inline-flex' : 'none';
    }
  };

  // Toggle para contenedor de URL
  const toggleUrlBtn = container.querySelector('#btn-toggle-url-logo') as HTMLButtonElement | null;
  const urlContainer = container.querySelector('#prof-logo-url-container') as HTMLElement | null;
  const urlInput = container.querySelector('#prof-logo-url-input') as HTMLInputElement | null;
  const dropzone = container.querySelector('#prof-logo-dropzone') as HTMLElement | null;

  toggleUrlBtn?.addEventListener('click', () => {
    if (urlContainer) {
      const isHidden = urlContainer.style.display === 'none';
      urlContainer.style.display = isHidden ? 'block' : 'none';
      if (isHidden && urlInput) urlInput.focus();
    }
  });

  urlInput?.addEventListener('input', () => {
    const val = urlInput.value.trim();
    if (logoHiddenInput) logoHiddenInput.value = val;
    updateLogoDisplay(val);
  });

  // Botón para usar el logo oficial de Facilito
  useFacilitoBtn?.addEventListener('click', async () => {
    if (logoHiddenInput) logoHiddenInput.value = '/logo.png';
    if (urlInput) urlInput.value = '/logo.png';
    updateLogoDisplay('/logo.png');
    if (uploadStatus) uploadStatus.innerHTML = '<span style="color: var(--brand-orange); font-weight:700;">Aplicando logo oficial... ⏳</span>';
    try {
      await api.business.updateProfile({ logo_url: '/logo.png' });
      if (uploadStatus) {
        uploadStatus.innerHTML = '<span style="color: var(--success); font-weight: 700;">✅ ¡Logo Oficial Facilito activado!</span>';
        setTimeout(() => { if (uploadStatus) uploadStatus.textContent = ''; }, 4000);
      }
      const updated = await api.business.getMyProfile();
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (e: any) {
      alert('Error al aplicar logo: ' + e.message);
    }
  });

  // Procesar archivo local optimizado en Base64 permanente
  const processLocalFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('⚠️ Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP, SVG).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('⚠️ La imagen no debe superar 8MB de tamaño.');
      return;
    }

    if (uploadStatus) uploadStatus.innerHTML = '<span style="color: var(--brand-blue); font-weight:700;">Optimizando y guardando... ⏳</span>';
    if (browseBtn) browseBtn.disabled = true;

    try {
      const compressedBase64 = await compressImageToBase64(file);
      if (logoHiddenInput) logoHiddenInput.value = compressedBase64;
      updateLogoDisplay(compressedBase64);

      // Guardado directo en BD para garantizar persistencia universal
      await api.business.updateProfile({ logo_url: compressedBase64 });
      if (uploadStatus) {
        uploadStatus.innerHTML = '<span style="color: var(--success); font-weight: 700;">✅ ¡Logotipo guardado con éxito!</span>';
        setTimeout(() => { if (uploadStatus) uploadStatus.textContent = ''; }, 4000);
      }
      const updated = await api.business.getMyProfile();
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err: any) {
      console.error('Error guardando logo en BD:', err);
      if (uploadStatus) uploadStatus.innerHTML = `<span style="color: var(--danger);">❌ ${err.message || 'Error al guardar'}</span>`;
    } finally {
      if (browseBtn) browseBtn.disabled = false;
      if (fileInput) fileInput.value = '';
    }
  };

  // SUBIDA LOCAL DE ARCHIVO DE LOGOTIPO MEDIANTE BOTÓN
  browseBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async () => {
    if (!fileInput.files || fileInput.files.length === 0) return;
    await processLocalFile(fileInput.files[0]);
  });

  // DRAG AND DROP SOBRE LA ZONA DE FOTO
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--brand-orange)';
    dropzone.style.background = 'rgba(255, 115, 0, 0.08)';
  });
  dropzone?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'rgba(0, 119, 246, 0.35)';
    dropzone.style.background = 'rgba(0, 119, 246, 0.05)';
  });
  dropzone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'rgba(0, 119, 246, 0.35)';
    dropzone.style.background = 'rgba(0, 119, 246, 0.05)';
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processLocalFile(e.dataTransfer.files[0]);
    }
  });

  // Botón Quitar Foto
  removeLogoBtn?.addEventListener('click', async () => {
    if (!confirm('¿Deseas quitar el logotipo personalizado y volver al de Facilito?')) return;
    if (logoHiddenInput) logoHiddenInput.value = '';
    if (urlInput) urlInput.value = '';
    updateLogoDisplay('');
    try {
      await api.business.updateProfile({ logo_url: null });
      if (uploadStatus) {
        uploadStatus.innerHTML = '<span style="color: var(--text-muted);">Logo restaurado por defecto</span>';
        setTimeout(() => {
          if (uploadStatus) uploadStatus.textContent = '';
        }, 3000);
      }
      const updated = await api.business.getMyProfile();
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (e: any) {
      alert('Error al quitar foto: ' + e.message);
    }
  });

  // Dinámicamente actualizar enlace "Abrir" cuando el usuario edite el input de URL de Google Sheets
  sheetUrlInput?.addEventListener('input', () => {
    const val = sheetUrlInput.value.trim();
    if (openSheetLink) {
      openSheetLink.href = val || 'https://sheets.google.com';
    }
  });

  // BOTÓN COPIAR ENLACE DE GOOGLE SHEETS
  const copySheetBtn = container.querySelector('#btn-copy-sheet-url') as HTMLButtonElement | null;
  const copySheetBtnText = container.querySelector('#copy-sheet-btn-text');

  copySheetBtn?.addEventListener('click', async () => {
    const url = sheetUrlInput?.value?.trim();
    if (!url) {
      alert('⚠️ Primero ingresa o pega el enlace de tu hoja de Google Sheets.');
      sheetUrlInput?.focus();
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      if (copySheetBtnText) copySheetBtnText.textContent = '¡Copiado!';
      copySheetBtn.style.background = 'rgba(16,185,129,0.2)';
      copySheetBtn.style.borderColor = '#10b981';
      setTimeout(() => {
        if (copySheetBtnText) copySheetBtnText.textContent = 'Copiar Enlace';
        copySheetBtn.style.background = '';
        copySheetBtn.style.borderColor = '';
      }, 2500);
    } catch (err) {
      sheetUrlInput?.select();
      document.execCommand('copy');
      alert('📋 ¡Enlace copiado al portapapeles!');
    }
  });

  // BOTÓN COPIAR ENCABEZADOS DE COLUMNA PARA LA HOJA
  const copyHeadersBtn = container.querySelector('#btn-copy-sheet-headers') as HTMLButtonElement | null;
  const copyHeadersText = container.querySelector('#copy-headers-btn-text');

  copyHeadersBtn?.addEventListener('click', async () => {
    const headersText = "ID Venta\tFecha\tCliente\tCédula / RIF\tTeléfono\tMétodo de Pago\tSubtotal ($)\tDescuento ($)\tTotal ($)\tMonto Pagado ($)\tProductos\tVendedor";
    try {
      await navigator.clipboard.writeText(headersText);
      if (copyHeadersText) copyHeadersText.textContent = '¡Encabezados Copiados!';
      copyHeadersBtn.style.background = 'rgba(16,185,129,0.2)';
      copyHeadersBtn.style.borderColor = '#10b981';
      setTimeout(() => {
        if (copyHeadersText) copyHeadersText.textContent = 'Copiar Encabezados para Fila 1';
        copyHeadersBtn.style.background = '';
        copyHeadersBtn.style.borderColor = '';
      }, 3000);
      alert('📋 ¡Encabezados copiados!\n\nAbre tu hoja de Google Sheets, selecciona la celda A1 y presiona Ctrl+V para pegar todas las columnas ordenadas.');
    } catch (_) {
      alert('Encabezados: ID Venta | Fecha | Cliente | Cédula | Teléfono | Método de Pago | Subtotal | Descuento | Total | Monto Pagado | Productos | Vendedor');
    }
  });

  // MOSTRAR / OCULTAR GUÍA DE GOOGLE APPS SCRIPT
  const toggleGuideBtn = container.querySelector('#btn-toggle-script-guide') as HTMLButtonElement | null;
  const guideBox = container.querySelector('#script-guide-box') as HTMLElement | null;
  toggleGuideBtn?.addEventListener('click', () => {
    if (guideBox) {
      const isHidden = guideBox.style.display === 'none';
      guideBox.style.display = isHidden ? 'block' : 'none';
      toggleGuideBtn.textContent = isHidden ? '🔼 Ocultar Guía' : '📖 ¿Cómo conectar en 3 pasos? (Ver Código)';
    }
  });

  // COPIAR CÓDIGO DE GOOGLE APPS SCRIPT
  const copyScriptBtn = container.querySelector('#btn-copy-apps-script') as HTMLButtonElement | null;
  const scriptTextarea = container.querySelector('#apps-script-code') as HTMLTextAreaElement | null;
  copyScriptBtn?.addEventListener('click', async () => {
    if (!scriptTextarea) return;
    try {
      await navigator.clipboard.writeText(scriptTextarea.value);
      copyScriptBtn.textContent = '✅ ¡Código Copiado!';
      copyScriptBtn.style.background = '#10b981';
      setTimeout(() => {
        copyScriptBtn.textContent = '📋 Copiar Código del Script';
        copyScriptBtn.style.background = '';
      }, 2500);
      alert('📋 ¡Código copiado!\n\nPégalo en Extensiones ➔ Apps Script dentro de tu hoja de cálculo.');
    } catch (_) {
      scriptTextarea.select();
      document.execCommand('copy');
      alert('📋 ¡Código copiado!');
    }
  });

  // PROBAR CONEXIÓN DEL WEBHOOK DE GOOGLE SHEETS
  const testWebhookBtn = container.querySelector('#btn-test-sheet-webhook') as HTMLButtonElement | null;
  testWebhookBtn?.addEventListener('click', async () => {
    const webhookUrl = sheetWebhookInput?.value.trim();
    if (!webhookUrl) {
      alert('⚠️ Primero debes pegar la URL de la aplicación web (Webhook) en la casilla para poder probarla.');
      sheetWebhookInput?.focus();
      return;
    }

    testWebhookBtn.disabled = true;
    testWebhookBtn.textContent = 'Enviando prueba... ⏳';

    try {
      const res = await api.business.testWebhook(webhookUrl);
      alert(`🎉 ${res.message || '¡Prueba exitosa! Revisa tu Google Sheet, la fila de prueba fue agregada correctamente.'}`);
    } catch (err: any) {
      alert(`❌ Error al conectar con tu Webhook:\n\n${err.message || 'Error desconocido'}\n\nAsegúrate de que en Apps Script pusiste "Quién tiene acceso: Cualquier usuario (Anyone)" al implementar.`);
    } finally {
      testWebhookBtn.disabled = false;
      testWebhookBtn.innerHTML = '<span>⚡</span> Probar Conexión';
    }
  });

  // Guardado general del formulario
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = container.querySelector('#btn-save-business-profile') as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando cambios... 💾';
    }

    try {
      const payload: Partial<BusinessProfile> = {
        name: nameInput?.value.trim(),
        rif: rifInput?.value.trim(),
        legal_name: legalInput?.value.trim(),
        phone: phoneInput?.value.trim(),
        email: emailInput?.value.trim(),
        address: addressInput?.value.trim(),
        ticket_message: msgInput?.value.trim(),
        logo_url: logoHiddenInput?.value?.trim() || null,
        google_sheet_url: sheetUrlInput?.value.trim() || null,
        google_sheets_webhook_url: sheetWebhookInput?.value.trim() || null
      };

      await api.business.updateProfile(payload);
      alert('🎉 ¡Datos de la empresa y configuración de facturas guardados correctamente!');
      const updated = await api.business.getMyProfile();
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err: any) {
      alert(`❌ Error al guardar perfil: ${err.message || 'Error desconocido'}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Configuración Fiscal y Factura 💾';
      }
    }
  });
}
