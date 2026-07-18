"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDebtorReminders = processDebtorReminders;
exports.startReminderCron = startReminderCron;
const db_1 = __importDefault(require("../config/db"));
const email_1 = require("./email");
async function processDebtorReminders() {
    console.log('[REMINDER CRON] Iniciando escaneo de deudores...');
    try {
        // 1. Obtener configuraciones de recordatorios
        const [settingsRows] = await db_1.default.query('SELECT * FROM settings WHERE settings_key IN (?, ?)', [
            'debtor_reminder_frequency_days',
            'debtor_reminder_email_template'
        ]);
        const frequencyDaysSetting = settingsRows.find((s) => s.settings_key === 'debtor_reminder_frequency_days');
        const templateSetting = settingsRows.find((s) => s.settings_key === 'debtor_reminder_email_template');
        const frequencyDays = frequencyDaysSetting ? parseInt(frequencyDaysSetting.settings_value) : 7;
        const templateText = templateSetting ? templateSetting.settings_value : 'Hola {customerName}, tienes un saldo pendiente de ${amountPending} de tu factura #{saleId}.';
        // 2. Obtener deudores (sales con status='pending' e is_quotation=0 y customer_email válido)
        const [debtors] = await db_1.default.query(`SELECT * FROM sales 
       WHERE status = 'pending' 
       AND is_quotation = 0 
       AND customer_email IS NOT NULL 
       AND customer_email != ''`);
        console.log(`[REMINDER CRON] Se encontraron ${debtors.length} facturas pendientes de deudores.`);
        const now = new Date();
        for (const sale of debtors) {
            const lastSent = sale.last_reminder_sent_at ? new Date(sale.last_reminder_sent_at) : new Date(sale.created_at);
            const diffMs = now.getTime() - lastSent.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays >= frequencyDays) {
                console.log(`[REMINDER CRON] Enviando recordatorio para factura #${sale.id} a ${sale.customer_email} (Diferencia de días: ${diffDays.toFixed(1)})...`);
                const pendingAmount = Number(sale.total) - Number(sale.amount_paid || 0);
                // Reemplazar marcadores en la plantilla
                const emailBody = templateText
                    .replace(/{customerName}/g, sale.customer_name || 'Cliente')
                    .replace(/\${amountPending}/g, pendingAmount.toFixed(2))
                    .replace(/{saleId}/g, sale.id.toString());
                try {
                    await (0, email_1.sendPlainEmail)(sale.customer_email, `Recordatorio de Pago Pendiente - Factura #${sale.id}`, emailBody);
                    // Actualizar last_reminder_sent_at
                    await db_1.default.query('UPDATE sales SET last_reminder_sent_at = NOW() WHERE id = ?', [sale.id]);
                    console.log(`[REMINDER CRON] Factura #${sale.id} marcada con recordatorio enviado.`);
                }
                catch (mailErr) {
                    console.error(`[REMINDER CRON] Error al enviar email a ${sale.customer_email} para factura #${sale.id}:`, mailErr);
                }
            }
        }
    }
    catch (err) {
        console.error('[REMINDER CRON] Error en el proceso de recordatorios de deudores:', err);
    }
}
function startReminderCron() {
    // Ejecutar inmediatamente al arrancar
    processDebtorReminders().catch(err => console.error('[REMINDER CRON] Error inicial:', err));
    // Ejecutar cada 6 horas
    const INTERVAL_MS = 1000 * 60 * 60 * 6;
    setInterval(() => {
        processDebtorReminders().catch(err => console.error('[REMINDER CRON] Error en intervalo:', err));
    }, INTERVAL_MS);
}
