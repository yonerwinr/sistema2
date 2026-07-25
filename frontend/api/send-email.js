const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Solo se permiten peticiones POST' });
  }

  const { smtpHost, smtpPort, smtpUser, smtpPass, from, to, subject, text, html } = req.body;

  if (!smtpHost || !smtpUser || !smtpPass || !to || !subject) {
    return res.status(400).json({ message: 'Faltan parámetros SMTP obligatorios en el cuerpo' });
  }

  try {
    const isGmail = smtpHost.toLowerCase().includes('gmail.com');
    const port = parseInt(smtpPort || '587');
    
    const transporter = nodemailer.createTransport({
      ...(isGmail ? { service: 'gmail' } : { host: smtpHost, port: port, secure: port === 465 }),
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html
    });

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error en Proxy de Correo Vercel:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error al enviar por SMTP en Vercel' });
  }
};
