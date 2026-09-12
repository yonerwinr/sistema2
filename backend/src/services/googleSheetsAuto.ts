import { google } from 'googleapis';
import pool from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

/**
 * googleSheetsAuto.ts
 * Servicio para aprovisionar y sincronizar automáticamente Google Sheets por empresa.
 */

// Obtener cliente autenticado de Google si las credenciales están configuradas
function getGoogleAuthClient() {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceEmail || !privateKey) {
    return null;
  }

  // Reemplazar saltos de línea escapados en variables de entorno
  privateKey = privateKey.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  });
}

export interface SheetProvisionResult {
  sheetId: string;
  sheetUrl: string;
  isSimulated: boolean;
}

/**
 * Crea una nueva hoja de cálculo en Google Drive para un negocio específico con pestañas prediseñadas.
 */
export async function provisionBusinessSheet(
  businessName: string,
  ownerEmail?: string | null
): Promise<SheetProvisionResult> {
  const auth = getGoogleAuthClient();

  if (!auth) {
    console.log(`[GOOGLE SHEETS AUTO] Credenciales de cuenta de servicio no detectadas en .env.`);
    console.log(`[GOOGLE SHEETS AUTO] Generando enlace de plantilla automática para "${businessName}".`);

    // Enlace de demostración funcional mientras se configuran las credenciales de Google Cloud
    const demoId = 'facilito_' + Buffer.from(businessName + '_' + Date.now()).toString('hex').substring(0, 16);
    const demoUrl = `https://docs.google.com/spreadsheets/d/${demoId}/edit#gid=0`;

    return {
      sheetId: demoId,
      sheetUrl: demoUrl,
      isSimulated: true
    };
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // 1. Crear el nuevo Spreadsheet
    const title = `FacilitoApp - Respaldo ${businessName}`;
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          {
            properties: {
              title: 'Ventas',
              gridProperties: { rowCount: 1000, columnCount: 12, frozenRowCount: 1 }
            }
          },
          {
            properties: {
              title: 'Inventario',
              gridProperties: { rowCount: 1000, columnCount: 6, frozenRowCount: 1 }
            }
          },
          {
            properties: {
              title: 'Caja y Turnos',
              gridProperties: { rowCount: 500, columnCount: 8, frozenRowCount: 1 }
            }
          }
        ]
      }
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('No se obtuvo el ID de la hoja creada en Google Sheets.');
    }

    const sheetUrl = createRes.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 2. Colocar encabezados de columnas con estilo
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: 'Ventas!A1:L1',
            values: [[
              'ID Venta',
              'Fecha y Hora',
              'Cliente',
              'Cédula/RIF',
              'Teléfono',
              'Método de Pago',
              'Subtotal ($)',
              'Descuento ($)',
              'Total ($)',
              'Monto Pagado',
              'Productos Vendidos',
              'Vendedor/Cajero'
            ]]
          },
          {
            range: 'Inventario!A1:F1',
            values: [[
              'Código / SKU',
              'Nombre del Producto',
              'Categoría',
              'Precio Unitario ($)',
              'Stock Disponible',
              'Fecha Registro'
            ]]
          },
          {
            range: 'Caja y Turnos!A1:H1',
            values: [[
              'Sesión ID',
              'Cajero',
              'Apertura',
              'Monto Inicial ($)',
              'Cierre',
              'Esperado ($)',
              'Contado ($)',
              'Diferencia ($)'
            ]]
          }
        ]
      }
    });

    // 3. Compartir con el correo del cliente si fue provisto
    if (ownerEmail && ownerEmail.includes('@')) {
      try {
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: ownerEmail
          }
        });
        console.log(`[GOOGLE SHEETS AUTO] Hoja compartida exitosamente con ${ownerEmail}`);
      } catch (permErr: any) {
        console.warn(`[GOOGLE SHEETS AUTO] No se pudo compartir automáticamente con ${ownerEmail}:`, permErr.message);
      }
    }

    console.log(`[GOOGLE SHEETS AUTO] Hoja "${title}" creada exitosamente con ID: ${spreadsheetId}`);

    return {
      sheetId: spreadsheetId,
      sheetUrl,
      isSimulated: false
    };
  } catch (error: any) {
    console.error('[GOOGLE SHEETS AUTO] Error al crear hoja en Google Sheets:', error);
    const demoId = 'err_' + Date.now();
    return {
      sheetId: demoId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${demoId}/edit`,
      isSimulated: true
    };
  }
}

/**
 * Registra una venta en la hoja de cálculo del negocio correspondiente.
 */
export async function appendSaleToBusinessSheet(
  businessId: number,
  sale: any,
  items: any[]
): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      'SELECT google_sheet_id, google_sheets_webhook_url, name FROM businesses WHERE id = ? LIMIT 1',
      [businessId]
    );

    if (rows.length === 0) return;
    const business = rows[0];

    const itemsFormatted = items.map(i => `${i.name} (x${i.quantity})`).join(', ');

    // 1. Si tiene Webhook configurado (Google Apps Script personal del cliente)
    if (business.google_sheets_webhook_url) {
      try {
        const payload = {
          saleId: sale.id,
          date: new Date(sale.created_at || new Date()).toLocaleString('es-ES'),
          customerName: sale.customer_name || 'Cliente General',
          customerCi: sale.customer_ci || '',
          customerPhone: sale.customer_phone || '',
          paymentMethod: sale.payment_method,
          subtotal: (Number(sale.total) - Number(sale.tax || 0) + Number(sale.discount || 0)).toFixed(2),
          discount: Number(sale.discount || 0).toFixed(2),
          total: Number(sale.total).toFixed(2),
          amountPaid: Number(sale.amount_paid || 0).toFixed(2),
          items: itemsFormatted,
          sellerName: sale.seller_name || 'POS'
        };

        await fetch(business.google_sheets_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        console.log(`[GOOGLE SHEETS AUTO] Venta #${sale.id} sincronizada vía Webhook para "${business.name}".`);
      } catch (err: any) {
        console.error(`[GOOGLE SHEETS AUTO] Error webhook para negocio ${businessId}:`, err.message);
      }
    }

    // 2. Si tiene google_sheet_id y credenciales de Google Cloud
    const auth = getGoogleAuthClient();
    if (auth && business.google_sheet_id && !business.google_sheet_id.startsWith('facilito_')) {
      const sheets = google.sheets({ version: 'v4', auth });
      const rowValues = [
        sale.id,
        new Date(sale.created_at || new Date()).toLocaleString('es-ES'),
        sale.customer_name || 'Cliente General',
        sale.customer_ci || '',
        sale.customer_phone || '',
        sale.payment_method,
        (Number(sale.total) - Number(sale.tax || 0) + Number(sale.discount || 0)).toFixed(2),
        Number(sale.discount || 0).toFixed(2),
        Number(sale.total).toFixed(2),
        Number(sale.amount_paid || 0).toFixed(2),
        itemsFormatted,
        sale.seller_name || 'POS'
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: business.google_sheet_id,
        range: 'Ventas!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues]
        }
      });
      console.log(`[GOOGLE SHEETS AUTO] Fila agregada a Google Sheets de "${business.name}".`);
    }
  } catch (error: any) {
    console.error(`[GOOGLE SHEETS AUTO] Error sincronizando venta en Google Sheets para negocio ${businessId}:`, error.message);
  }
}
