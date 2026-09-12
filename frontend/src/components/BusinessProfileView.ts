import type { BusinessProfile } from '../utils/api';
import { api } from '../utils/api';

/**
 * BusinessProfileView.ts
 * Formulario para que cada comercio configure sus datos fiscales, logotipo, mensaje de factura y Google Sheet.
 */

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
    google_sheet_url: null,
    google_sheets_webhook_url: '',
    is_active: 1
  };

  return `
    <div class="business-profile-container animate-fade-in" style="max-width: 960px; margin: 0 auto; padding: 20px 0;">
      
      <!-- ENCABEZADO -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 10px;">
            🏢 Perfil de Empresa & Facturación
          </h2>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 4px 0 0 0;">
            Personaliza el logotipo, los datos fiscales que se imprimen en tus facturas y tu respaldo en Google Sheets.
          </p>
        </div>

        <!-- Estado de Licencia del Comercio -->
        <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-glass); padding: 8px 14px; border-radius: 12px;">
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Estado de Licencia</div>
            <div style="font-size: 13px; font-weight: 700; color: ${b.is_active ? 'var(--success)' : 'var(--danger)'};">
              ${b.is_active ? '🟢 Activa (' + (b.license_plan || 'PRO').toUpperCase() + ')' : '🔴 Suspendida'}
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start;">
        
        <!-- FORMULARIO DE DATOS FISCALES -->
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

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="prof-address">Dirección Fiscal / Ubicación del Local</label>
              <textarea class="form-control" id="prof-address" rows="2" placeholder="Ej. Calle 4 con Carrera 12, Local N° 3, Frente a la Plaza Bolívar">${b.address || ''}</textarea>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="prof-logo">URL del Logotipo (PNG / JPG)</label>
              <input type="url" class="form-control" id="prof-logo" value="${b.logo_url || ''}" placeholder="https://ejemplo.com/mi-logo.png">
              <small style="color: var(--text-muted); font-size: 11px;">Aparecerá en el encabezado de tus facturas y en tu tienda online.</small>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label" for="prof-ticket-msg">Mensaje al Pie del Ticket de Venta</label>
              <textarea class="form-control" id="prof-ticket-msg" rows="2" placeholder="¡Gracias por su compra! Garantía de 15 días presentando su factura. Síguenos en @minegocio">${b.ticket_message || ''}</textarea>
            </div>

            <!-- SECCIÓN GOOGLE SHEETS -->
            <h3 style="font-size: 15px; font-weight: 700; color: #10b981; margin-bottom: 16px; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px;">
              📊 Respaldo en Vivo en Google Sheets
            </h3>

            <div style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.25); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                <span style="font-size: 13px; font-weight: 700; color: #10b981;">Hoja Vinculada de la Empresa</span>
                ${b.google_sheet_url ? `
                  <a href="${b.google_sheet_url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-success" style="font-weight: 700; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
                    <span>📊</span> Abrir en Google Sheets
                  </a>
                ` : `
                  <button type="button" class="btn btn-sm btn-primary" id="btn-provision-sheet">
                    Generar Hoja Automáticamente 🚀
                  </button>
                `}
              </div>

              ${b.google_sheet_url ? `
                <div style="font-size: 12px; color: var(--text-secondary); word-break: break-all; margin-bottom: 10px;">
                  🔗 Enlace: <a href="${b.google_sheet_url}" target="_blank" style="color: #60a5fa;">${b.google_sheet_url}</a>
                </div>
              ` : `
                <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 10px 0;">
                  Aún no tienes una hoja de Google Sheets generada para respaldar tus ventas automáticamente.
                </p>
              `}

              <div class="form-group" style="margin: 0;">
                <label class="form-label" for="prof-sheet-webhook" style="font-size: 12px;">Webhook Personalizado (Opcional - Google Apps Script)</label>
                <input type="url" class="form-control" id="prof-sheet-webhook" value="${b.google_sheets_webhook_url || ''}" placeholder="https://script.google.com/macros/s/.../exec" style="font-size: 12px;">
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
              ${b.logo_url ? `<img src="${b.logo_url}" style="max-width: 80px; max-height: 80px; object-fit: contain;" alt="Logo">` : '<div style="font-size: 32px;">🛒</div>'}
            </div>
            <div id="preview-ticket-name" style="font-size: 15px; font-weight: bold;">${b.name || 'NOMBRE DE EMPRESA'}</div>
            <div id="preview-ticket-rif" style="font-size: 12px;">RIF: ${b.rif || 'J-00000000-0'}</div>
            <div id="preview-ticket-address" style="font-size: 10px; color: #333333; margin-top: 4px;">${b.address || 'Dirección de la tienda'}</div>
            <div id="preview-ticket-phone" style="font-size: 10px; color: #333333;">Tel: ${b.phone || '+58 000 0000000'}</div>
          </div>

          <div style="font-size: 11px; margin-bottom: 12px;">
            <div>FACTURA #00123</div>
            <div>FECHA: 12/09/2026 10:45 AM</div>
            <div>CAJERO: Juan Pérez</div>
          </div>

          <div style="border-bottom: 1px dashed #666666; padding-bottom: 8px; margin-bottom: 8px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between;">
              <span>1x Refresco 2L</span>
              <span>$2.50</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>2x Harina de Maíz</span>
              <span>$2.40</span>
            </div>
          </div>

          <div style="text-align: right; font-size: 13px; font-weight: bold; margin-bottom: 14px;">
            TOTAL: $4.90
          </div>

          <div id="preview-ticket-footer" style="text-align: center; font-size: 10px; border-top: 1px dashed #666666; padding-top: 10px; color: #444444;">
            ${b.ticket_message || '¡Gracias por su compra!'}
          </div>

        </div>

      </div>

    </div>
  `;
}

export function setupBusinessProfileEvents(
  container: HTMLElement,
  onProfileUpdated?: (updated: BusinessProfile) => void
) {
  const nameInput = container.querySelector('#bus-name') as HTMLInputElement | null;
  const rifInput = container.querySelector('#bus-rif') as HTMLInputElement | null;
  const addressInput = container.querySelector('#bus-address') as HTMLInputElement | null;
  const phoneInput = container.querySelector('#bus-phone') as HTMLInputElement | null;
  const msgInput = container.querySelector('#bus-ticket-message') as HTMLInputElement | null;
  const logoInput = container.querySelector('#bus-logo-url') as HTMLInputElement | null;
  const sheetInput = container.querySelector('#bus-sheet-url') as HTMLInputElement | null;

  const previewName = container.querySelector('#preview-ticket-name');
  const previewRif = container.querySelector('#preview-ticket-rif');
  const previewAddress = container.querySelector('#preview-ticket-address');
  const previewPhone = container.querySelector('#preview-ticket-phone');
  const previewFooter = container.querySelector('#preview-ticket-footer');
  const previewLogo = container.querySelector('#preview-ticket-logo');

  // Vista previa interactiva en tiempo real
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
  logoInput?.addEventListener('input', () => {
    if (previewLogo) {
      const url = logoInput.value.trim();
      previewLogo.innerHTML = url ? `<img src="${url}" style="max-width: 80px; max-height: 80px; object-fit: contain;" alt="Logo">` : '<div style="font-size: 32px;">🛒</div>';
    }
  });

  // Aprovisionamiento automático de Google Sheet
  const autoSheetBtn = container.querySelector('#btn-auto-sheet') as HTMLButtonElement | null;
  autoSheetBtn?.addEventListener('click', async () => {
    const originalText = autoSheetBtn.innerHTML;
    autoSheetBtn.disabled = true;
    autoSheetBtn.innerHTML = 'Aprovisionando Google Sheets... ⏳';

    try {
      const res = await api.business.autoProvisionSheet();
      if (sheetInput) sheetInput.value = res.sheetUrl;
      alert(`✅ ¡Hoja de Google Sheets configurada con éxito!\n\nSe ha generado y vinculado tu respaldo para ventas, caja e inventario.\n\nEnlace: ${res.sheetUrl}`);
      const current = await api.business.getMyProfile();
      if (onProfileUpdated) onProfileUpdated(current);
    } catch (err: any) {
      alert(`⚠️ Error al aprovisionar Google Sheet: ${err.message || 'Error desconocido'}`);
    } finally {
      autoSheetBtn.disabled = false;
      autoSheetBtn.innerHTML = originalText;
    }
  });

  // Envío del formulario
  const form = container.querySelector('#form-business-profile') as HTMLFormElement | null;
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
        legal_name: (container.querySelector('#bus-legal-name') as HTMLInputElement)?.value.trim(),
        phone: phoneInput?.value.trim(),
        email: (container.querySelector('#bus-email') as HTMLInputElement)?.value.trim(),
        address: addressInput?.value.trim(),
        ticket_message: msgInput?.value.trim(),
        logo_url: logoInput?.value.trim() || null,
        google_sheet_url: sheetInput?.value.trim() || null,
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
