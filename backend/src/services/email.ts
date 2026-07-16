import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

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
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    console.log('Transpotador de correo SMTP configurado con exito.');
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

export async function sendInvoiceEmail(toEmail: string, sale: any, items: any[]): Promise<string> {
  try {
    const client = await getTransporter();

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568; text-align: right;">$${Number(item.price).toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1a202c; text-align: right; fontWeight: 600;">$${(Number(item.price) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const fromAddress = process.env.SMTP_FROM || 'no-reply@sistema-pos-online.local';
    const invoiceDate = new Date(sale.created_at || new Date()).toLocaleString('es-ES');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Factura de Compra #${sale.id}</title>
        <style>
          body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f7fafc;
            margin: 0;
            padding: 0;
          }
          .container {
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Comprobante de Pago</h1>
            <p>¡Gracias por tu compra!</p>
          </div>
          <div class="content">
            <div class="info-grid">
              <div class="info-col">
                <div class="label">Facturado a:</div>
                <div class="value"><strong>${sale.customer_name || 'Cliente General'}</strong></div>
                ${sale.customer_phone ? `<div class="value">${sale.customer_phone}</div>` : ''}
                ${sale.customer_email ? `<div class="value">${sale.customer_email}</div>` : ''}
              </div>
              <div class="info-col right">
                <div class="label">No. Factura:</div>
                <div class="value">#${sale.id}</div>
                <div class="label" style="margin-top: 12px;">Fecha:</div>
                <div class="value">${invoiceDate}</div>
              </div>
            </div>

            <div class="info-grid" style="margin-top: -12px; margin-bottom: 24px;">
              <div class="info-col">
                <div class="label">Tipo de Compra:</div>
                <div class="value" style="text-transform: uppercase;">${sale.type}</div>
              </div>
              <div class="info-col right">
                <div class="label">Metodo de Pago:</div>
                <div class="value" style="text-transform: uppercase;">${sale.payment_method}</div>
              </div>
            </div>

            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="text-align: left;">Producto</th>
                    <th style="text-align: center; width: 60px;">Cant.</th>
                    <th style="text-align: right; width: 80px;">P. Unit</th>
                    <th style="text-align: right; width: 100px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            <div class="totals">
              <div class="total-box">
                <div class="total-label">TOTAL NETO</div>
                <div class="total-value">$${Number(sale.total).toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div class="footer">
            Este es un correo automatico generado por nuestro Sistema POS y Tienda Online.
            <br>&copy; ${new Date().getFullYear()} POS Online. Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    const plainTextContent = `
=========================================
📄 COMPROBANTE DE COMPRA - FACTURA #${sale.id}
=========================================
¡Gracias por tu compra!

Facturado a: ${sale.customer_name || 'Cliente General'}
Fecha: ${invoiceDate}
Tipo de Compra: ${sale.type.toUpperCase()}
Metodo de Pago: ${sale.payment_method.toUpperCase()}

Detalle de Productos:
${items.map(item => `- ${item.name} x${item.quantity} ($${Number(item.price).toFixed(2)}) = $${(Number(item.price) * item.quantity).toFixed(2)}`).join('\n')}

-----------------------------------------
TOTAL NETO: $${Number(sale.total).toFixed(2)}
=========================================
Este es un correo automatico generado por nuestro Sistema POS y Tienda Online.
© ${new Date().getFullYear()} POS Online. Todos los derechos reservados.
    `;

    const info = await client.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `Factura de compra #${sale.id} - POS Online`,
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
