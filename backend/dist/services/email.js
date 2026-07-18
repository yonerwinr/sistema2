"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvoiceEmail = sendInvoiceEmail;
exports.sendPlainEmail = sendPlainEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("../config/db"));
dotenv_1.default.config();
let transporter = null;
// Inicializa el transportador SMTP
async function getTransporter() {
    if (transporter)
        return transporter;
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (host && user && pass) {
        // Usar SMTP provisto por el usuario
        transporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass }
        });
        console.log('Transpotador de correo SMTP configurado con exito.');
    }
    else {
        // Fallback: Crear cuenta de prueba en Ethereal Mail
        console.log('No se detectaron credenciales SMTP en .env. Creando cuenta temporal en Ethereal Mail...');
        try {
            const testAccount = await nodemailer_1.default.createTestAccount();
            transporter = nodemailer_1.default.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            console.log(`Cuenta temporal Ethereal creada: User=${testAccount.user}`);
        }
        catch (error) {
            console.error('Error al crear cuenta en Ethereal Mail, usando transportador dummy:', error);
            // Fallback a un mock
            transporter = nodemailer_1.default.createTransport({
                jsonTransport: true
            });
        }
    }
    return transporter;
}
async function sendInvoiceEmail(toEmail, sale, items, isResend = false) {
    try {
        const client = await getTransporter();
        // Obtener tasas de cambio oficiales
        let rateUsdToVes = 40.00;
        let rateEurToVes = 43.50;
        try {
            const [settingsRows] = await db_1.default.query("SELECT * FROM settings WHERE settings_key IN ('usd_to_ves_rate', 'eur_to_ves_rate')");
            const usdSetting = settingsRows.find((s) => s.settings_key === 'usd_to_ves_rate');
            const eurSetting = settingsRows.find((s) => s.settings_key === 'eur_to_ves_rate');
            if (usdSetting)
                rateUsdToVes = parseFloat(usdSetting.settings_value);
            if (eurSetting)
                rateEurToVes = parseFloat(eurSetting.settings_value);
        }
        catch (dbErr) {
            console.error('Error al consultar tasas para email:', dbErr);
        }
        const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
        const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568; text-align: right;">$${Number(item.price).toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1a202c; text-align: right; fontWeight: 600;">$${(Number(item.price) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');
        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@sistema-pos-online.local';
        const friendlyFrom = `"Sistema POS & Tienda" <${fromAddress}>`;
        const invoiceDate = new Date(sale.created_at || new Date()).toLocaleString('es-ES');
        const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factura de Compra #${sale.id}</title>
        <style>
          body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f7fafc;
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }
          .container {
            width: 100%;
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            overflow: hidden;
            border: 1px solid #edf2f7;
          }
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            padding: 32px;
            text-align: center;
            color: #ffffff;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 14px;
          }
          .content {
            padding: 32px;
          }
          .info-grid {
            display: table;
            width: 100%;
            margin-bottom: 24px;
          }
          .info-col {
            display: table-cell;
            width: 50%;
          }
          .info-col.right {
            text-align: right;
          }
          .label {
            font-size: 12px;
            text-transform: uppercase;
            color: #a0aec0;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .value {
            font-size: 14px;
            color: #2d3748;
            font-weight: 500;
            margin-top: 4px;
          }
          .table-container {
            margin-top: 24px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }
          th {
            background-color: #f8fafc;
            padding: 12px;
            font-weight: 600;
            color: #4a5568;
            border-bottom: 2px solid #e2e8f0;
          }
          .totals {
            margin-top: 24px;
            text-align: right;
          }
          .total-box {
            display: inline-block;
            background: #f1f5f9;
            padding: 16px 24px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          .total-label {
            font-size: 14px;
            color: #64748b;
          }
          .total-value {
            font-size: 24px;
            color: #4f46e5;
            font-weight: 700;
            margin-top: 4px;
          }
          .footer {
            background-color: #f8fafc;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #a0aec0;
            border-top: 1px solid #edf2f7;
          }
          
          @media only screen and (max-width: 600px) {
            .container {
              margin: 12px auto !important;
              border-radius: 8px !important;
              width: 92% !important;
            }
            .header {
              padding: 24px 16px !important;
            }
            .content {
              padding: 16px !important;
            }
            .info-grid {
              display: block !important;
              margin-bottom: 12px !important;
            }
            .info-col {
              display: block !important;
              width: 100% !important;
              text-align: left !important;
              margin-bottom: 16px !important;
            }
            .info-col.right {
              text-align: left !important;
            }
            .table-container {
              border-radius: 6px !important;
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch;
            }
            table {
              font-size: 13px !important;
              min-width: 480px !important;
            }
            th, td {
              padding: 10px 8px !important;
            }
            .totals {
              text-align: center !important;
              margin-top: 16px !important;
            }
            .total-box {
              display: block !important;
              padding: 12px 16px !important;
            }
            .total-value {
              font-size: 20px !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${sale.is_quotation === 1 ? 'Cotización al Mayor' : 'Comprobante de Pago'}</h1>
            <p>${sale.is_quotation === 1 ? 'Detalle de la cotización solicitada' : '¡Gracias por tu compra!'}</p>
          </div>
          <div class="content">
            ${isResend ? `
              <div style="background-color: #fef3c7; border: 1px solid #fcd34d; color: #b45309; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; font-weight: 600; text-align: center;">
                ⚠️ Este correo es un REENVÍO de la factura original emitida el ${invoiceDate}.
              </div>
            ` : ''}
            <div class="info-grid">
              <div class="info-col">
                <div class="label">${sale.is_quotation === 1 ? 'Cotizado a:' : 'Facturado a:'}</div>
                <div class="value"><strong>${sale.customer_name || 'Cliente General'}</strong></div>
                <div>${sale.customer_phone || ''}</div>
                <div>${sale.customer_email || ''}</div>
              </div>
              <div class="info-col">
                <div class="label">Detalles del Documento:</div>
                <div>Fecha: <strong>${invoiceDate}</strong></div>
                <div>Tipo: <strong>${sale.is_quotation === 1 ? 'COTIZACIÓN' : sale.type.toUpperCase()}</strong></div>
                <div>Método Pago: <strong style="text-transform: uppercase;">${sale.payment_method}</strong></div>
                ${sale.status === 'pending' ? `<div>Estado Pago: <strong style="color:#ef4444;">PENDIENTE (Deuda)</strong></div>` : ''}
              </div>
            </div>

            <div class="totals" style="margin-top: 24px;">
              <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 12px; text-align: left; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Producto</th>
                    <th style="padding: 12px; text-align: center; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; width: 80px;">Cant.</th>
                    <th style="padding: 12px; text-align: right; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; width: 100px;">Precio Un.</th>
                    <th style="padding: 12px; text-align: right; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; width: 100px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            <div class="totals-summary" style="margin-top: 20px;">
              <table style="width: 250px; float: right; font-size: 13px; margin-top: 16px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Subtotal:</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #2d3748;">$${subtotal.toFixed(2)}</td>
                </tr>
                ${Number(sale.discount) > 0 ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Descuento:</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #ef4444;">-$${Number(sale.discount).toFixed(2)}</td>
                </tr>
                ` : ''}
                ${Number(sale.tax) > 0 ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">IVA (16%):</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #2d3748;">$${Number(sale.tax).toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="border-top: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; font-size: 16px; font-weight: 700; color: #4f46e5;">TOTAL USD:</td>
                  <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: 700; color: #4f46e5;">$${Number(sale.total).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #f59e0b; font-weight: 700;">TOTAL Bs. (BCV):</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #f59e0b;">Bs. ${(Number(sale.total) * rateUsdToVes).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-size: 11px;">Equivalente EUR (€):</td>
                  <td style="padding: 4px 0; text-align: right; color: #64748b; font-size: 11px;">€ ${((Number(sale.total) * rateUsdToVes) / rateEurToVes).toFixed(2)}</td>
                </tr>
              </table>
              <div style="clear: both;"></div>
            </div>
          </div>
          <div class="footer">
            <p>Este es un correo automático generado por nuestro Sistema POS y Tienda Online.</p>
            <p>&copy; ${new Date().getFullYear()} POS Online. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        const plainTextContent = `
${isResend ? `⚠️ ESTE CORREO ES UN REENVÍO DE LA FACTURA ORIGINAL EMITIDA EL ${invoiceDate}.\n` : ''}=========================================
📄 ${sale.is_quotation === 1 ? 'COTIZACIÓN AL MAYOR' : 'COMPROBANTE DE COMPRA - FACTURA'} #${sale.id}
=========================================
${sale.is_quotation === 1 ? 'Detalle de cotización' : '¡Gracias por tu compra!'}

${sale.is_quotation === 1 ? 'Cotizado a:' : 'Facturado a:'} ${sale.customer_name || 'Cliente General'}
Fecha: ${invoiceDate}
Tipo: ${sale.is_quotation === 1 ? 'COTIZACIÓN' : sale.type.toUpperCase()}
Metodo de Pago: ${sale.payment_method.toUpperCase()}
${sale.status === 'pending' ? 'Estado Pago: PENDIENTE (Deuda)\n' : ''}
Detalle de Productos:
${items.map(item => `- ${item.name} x${item.quantity} ($${Number(item.price).toFixed(2)}) = $${(Number(item.price) * item.quantity).toFixed(2)}`).join('\n')}

-----------------------------------------
SUBTOTAL: $${subtotal.toFixed(2)}
${Number(sale.discount) > 0 ? `DESCUENTO: -$${Number(sale.discount).toFixed(2)}\n` : ''}${Number(sale.tax) > 0 ? `IVA (16%): $${Number(sale.tax).toFixed(2)}\n` : ''}TOTAL: $${Number(sale.total).toFixed(2)}
=========================================
Este es un correo automatico generado por nuestro Sistema POS y Tienda Online.
© ${new Date().getFullYear()} POS Online. Todos los derechos reservados.
    `;
        const info = await client.sendMail({
            from: fromAddress,
            to: toEmail,
            subject: sale.is_quotation === 1
                ? `Cotización al mayor #${sale.id} - POS Online`
                : `${isResend ? '[REENVÍO] ' : ''}Factura de compra #${sale.id} - POS Online`,
            text: plainTextContent,
            html: htmlContent
        });
        const testUrl = nodemailer_1.default.getTestMessageUrl(info);
        if (testUrl) {
            console.log(`==========================================================`);
            console.log(`[EMAIL SENT] Factura #${sale.id} enviada a ${toEmail}`);
            console.log(`[PREVIEW URL] Puedes ver el correo en: ${testUrl}`);
            console.log(`==========================================================`);
            return testUrl; // Retornamos el link temporal de ethereal
        }
        else {
            console.log(`Factura #${sale.id} enviada exitosamente a ${toEmail}`);
            return 'Email enviado';
        }
    }
    catch (error) {
        console.error('Error enviando correo de factura:', error);
        throw error;
    }
}
async function sendPlainEmail(to, subject, text) {
    try {
        const mailTransporter = await getTransporter();
        const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@pos-online.com';
        const mailOptions = {
            from: `"Recordatorio de Pago" <${fromEmail}>`,
            to,
            subject,
            text
        };
        const info = await mailTransporter.sendMail(mailOptions);
        const testUrl = nodemailer_1.default.getTestMessageUrl(info);
        if (testUrl) {
            console.log(`[EMAIL SENT] Recordatorio enviado a ${to} - Preview: ${testUrl}`);
            return testUrl;
        }
        console.log(`[EMAIL SENT] Recordatorio enviado a ${to}`);
        return 'Email enviado';
    }
    catch (error) {
        console.error('Error enviando correo recordatorio:', error);
        throw error;
    }
}
