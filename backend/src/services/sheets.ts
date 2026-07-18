import dotenv from 'dotenv';
dotenv.config();

export async function syncSaleToSheets(sale: any, items: any[]): Promise<void> {
  const webhookUrl = process.env.GOOGLE_SHEETS_URL;
  if (!webhookUrl) {
    // Ignorar si la URL de Webhook de Google Sheets no está configurada
    return;
  }

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
    items: itemsFormatted
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.warn('[SHEETS SYNC] Google Sheets Webhook retornó estado de error:', response.status);
    } else {
      console.log(`[SHEETS SYNC] Registro de Venta #${sale.id} respaldado en Google Sheets.`);
    }
  } catch (error) {
    console.error('[SHEETS SYNC] Error al sincronizar con Google Sheets:', error);
  }
}
