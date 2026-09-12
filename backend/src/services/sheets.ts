import dotenv from 'dotenv';
import { appendSaleToBusinessSheet } from './googleSheetsAuto';

dotenv.config();

/**
 * Sincroniza la venta con la hoja de Google Sheets de la empresa correspondiente.
 */
export async function syncSaleToSheets(sale: any, items: any[], businessIdOverride?: number): Promise<void> {
  const businessId = Number(businessIdOverride || sale.business_id || 1);

  // Delegar al servicio multi-empresa automatizado
  await appendSaleToBusinessSheet(businessId, sale, items);

  // Compatibilidad hacia atrás: si hay una URL global configurada en .env
  const globalWebhookUrl = process.env.GOOGLE_SHEETS_URL;
  if (globalWebhookUrl) {
    const itemsFormatted = items.map(i => `${i.name} (x${i.quantity})`).join(', ');
    const payload = {
      saleId: sale.id,
      date: new Date(sale.created_at || new Date()).toLocaleString('es-ES'),
      customerName: sale.customer_name || 'Cliente General',
      customerPhone: sale.customer_phone || '',
      customerEmail: sale.customer_email || '',
      paymentMethod: sale.payment_method,
      type: sale.type,
      status: sale.status,
      isQuotation: sale.is_quotation === 1 ? 'Sí' : 'No',
      subtotal: (Number(sale.total) - Number(sale.tax || 0) + Number(sale.discount || 0)).toFixed(2),
      discount: Number(sale.discount || 0).toFixed(2),
      tax: Number(sale.tax || 0).toFixed(2),
      total: Number(sale.total).toFixed(2),
      amountPaid: Number(sale.amount_paid || 0).toFixed(2),
      amountPending: Math.max(0, Number(sale.total) - Number(sale.amount_paid || 0)).toFixed(2),
      items: itemsFormatted,
      sellerName: sale.seller_name || 'Online (Tienda)'
    };

    try {
      await fetch(globalWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      console.warn('[SHEETS SYNC GLOBAL] Error webhook global:', err.message);
    }
  }
}
