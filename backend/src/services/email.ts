import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import pool from '../config/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let transporter: nodemailer.Transporter | null = null;

// Inicializa el transportador SMTP
async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    // Usar SMTP provisto por el usuario
    const isGmail = host.toLowerCase().includes('gmail.com');
    transporter = nodemailer.createTransport({
      ...(isGmail ? { service: 'gmail' } : { host, port, secure: port === 465 }),
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
    console.log(`Transpotador de correo SMTP configurado con exito.${isGmail ? ' (Modo Gmail optimizado)' : ''}`);
  } else {
    // Fallback: Crear cuenta de prueba en Ethereal Mail
    console.log('No se detectaron credenciales SMTP en .env. Creando cuenta temporal en Ethereal Mail...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`Cuenta temporal Ethereal creada: User=${testAccount.user}`);
    } catch (error) {
      console.error('Error al crear cuenta en Ethereal Mail, usando transportador dummy:', error);
      // Fallback a un mock
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
    }
  }
  return transporter;
}

export async function sendInvoiceEmail(toEmail: string, sale: any, items: any[], isResend: boolean = false): Promise<string> {
  try {
    const client = await getTransporter();

    // Obtener tasas de cambio oficiales y nombre del vendedor
    let rateUsdToVes = 40.00;
    let rateEurToVes = 43.50;
    let registeredBy = 'Online (Tienda)';
    try {
      const [settingsRows]: any = await pool.query("SELECT * FROM settings WHERE settings_key IN ('usd_to_ves_rate', 'eur_to_ves_rate')");
      const usdSetting = settingsRows.find((s: any) => s.settings_key === 'usd_to_ves_rate');
      const eurSetting = settingsRows.find((s: any) => s.settings_key === 'eur_to_ves_rate');
      if (usdSetting) rateUsdToVes = parseFloat(usdSetting.settings_value);
      if (eurSetting) rateEurToVes = parseFloat(eurSetting.settings_value);

      if (sale.seller_name) {
        registeredBy = sale.seller_name;
      } else if (sale.seller_id) {
        const [userRows]: any = await pool.query('SELECT name FROM users WHERE id = ?', [sale.seller_id]);
        if (userRows.length > 0) {
          registeredBy = userRows[0].name;
        }
      } else if (sale.user_id) {
        const [userRows]: any = await pool.query('SELECT name FROM users WHERE id = ?', [sale.user_id]);
        if (userRows.length > 0) {
          registeredBy = userRows[0].name;
        }
      }
    } catch (dbErr) {
      console.error('Error al consultar tasas/usuario para email:', dbErr);
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
    const friendlyFrom = `"FacilitoApp 🐒" <${fromAddress}>`;
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
            background: linear-gradient(135deg, #ff7a00 0%, #8b5cf6 100%);
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
            color: #ff7a00;
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
                <div>Cajero/Vendedor: <strong>${registeredBy}</strong></div>
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
                  <td style="padding: 10px 0; font-size: 16px; font-weight: 700; color: #ff7a00;">TOTAL USD:</td>
                  <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: 700; color: #ff7a00;">$${Number(sale.total).toFixed(2)}</td>
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
            <p>Este es un correo automático generado por FacilitoApp 🐒.</p>
            <p>&copy; ${new Date().getFullYear()} FacilitoApp. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const plainTextContent = `
${isResend ? `⚠️ ESTE CORREO ES UN REENVÍO DE LA FACTURA ORIGINAL EMITIDA EL ${invoiceDate}.\n` : ''}=========================================
📄 ${sale.is_quotation === 1 ? 'COTIZACIÓN AL MAYOR' : 'COMPROBANTE DE COMPRA'} #${sale.id}
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
Este es un correo automático generado por FacilitoApp 🐒.
© ${new Date().getFullYear()} FacilitoApp. Todos los derechos reservados.
    `;

    const info = await client.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: sale.is_quotation === 1 
        ? `Cotización al mayor #${sale.id} - FacilitoApp 🐒` 
        : `${isResend ? '[REENVÍO] ' : ''}Comprobante de compra #${sale.id} - FacilitoApp 🐒`,
      text: plainTextContent,
      html: htmlContent
    });

    const testUrl = nodemailer.getTestMessageUrl(info);
    if (testUrl) {
      console.log(`==========================================================`);
      console.log(`[EMAIL SENT] Factura #${sale.id} enviada a ${toEmail}`);
      console.log(`[PREVIEW URL] Puedes ver el correo en: ${testUrl}`);
      console.log(`==========================================================`);
      return testUrl; // Retornamos el link temporal de ethereal
    } else {
      console.log(`Factura #${sale.id} enviada exitosamente a ${toEmail}`);
      return 'Email enviado';
    }
  } catch (error) {
    console.error('Error enviando correo de factura:', error);
    throw error;
  }
}

export async function sendPlainEmail(to: string, subject: string, text: string): Promise<string> {
  try {
    const mailTransporter = await getTransporter();
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@facilitoapp.com';

    const mailOptions = {
      from: `"Recordatorio de Pago - FacilitoApp 🐒" <${fromEmail}>`,
      to,
      subject,
      text
    };

    const info = await mailTransporter.sendMail(mailOptions);
    const testUrl = nodemailer.getTestMessageUrl(info);
    if (testUrl) {
      console.log(`[EMAIL SENT] Recordatorio enviado a ${to} - Preview: ${testUrl}`);
      return testUrl;
    }
    console.log(`[EMAIL SENT] Recordatorio enviado a ${to}`);
    return 'Email enviado';
  } catch (error) {
    console.error('Error enviando correo recordatorio:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(toEmail: string, userName: string, code: string): Promise<string> {
  try {
    const client = await getTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@facilitoapp.com';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 0; }
          .container { max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #edf2f7; box-shadow: 0 10px 15px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #ff7a00 0%, #8b5cf6 100%); padding: 28px; text-align: center; color: #ffffff; }
          .content { padding: 32px; text-align: center; }
          .code-box { display: inline-block; background: #f1f5f9; padding: 16px 32px; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ff7a00; border: 2px dashed #ff7a00; margin: 20px 0; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #a0aec0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size:22px;">FacilitoApp 🐒</h1>
            <p style="margin:4px 0 0 0; opacity:0.9; font-size:13px;">Recuperación de Contraseña</p>
          </div>
          <div class="content">
            <h3 style="color:#2d3748; margin-top:0;">Hola, ${userName} 👋</h3>
            <p style="color:#4a5568; font-size:14px; line-height:1.5;">Has solicitado restablecer tu contraseña. Usa el siguiente código de verificación de 6 dígitos:</p>
            <div class="code-box">${code}</div>
            <p style="color:#718096; font-size:12px;">Este código es válido por <strong>15 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
          </div>
          <div class="footer">
            <p>FacilitoApp 🐒 - Tu solución inteligente para compras y POS.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await client.sendMail({
      from: `"FacilitoApp 🐒" <${fromAddress}>`,
      to: toEmail,
      subject: `Código de recuperación: ${code} - FacilitoApp 🐒`,
      text: `Hola ${userName}, tu código para restablecer tu contraseña en FacilitoApp es: ${code}. Este código vence en 15 minutos.`,
      html: htmlContent
    });

    const testUrl = nodemailer.getTestMessageUrl(info);
    if (testUrl) {
      console.log(`[RESET CODE SENT] Código ${code} enviado a ${toEmail} - Preview: ${testUrl}`);
      return testUrl;
    }
    return 'Email enviado';
  } catch (error) {
    console.error('Error enviando correo de recuperación:', error);
    throw error;
  }
}
