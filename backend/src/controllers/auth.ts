import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';
import { logAuditEvent } from '../services/audit';
import { validateCi } from '../utils/validation';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreta_pos_online_token_key_987654321';

// Registro de Usuario (Clientes)
router.post('/register', async (req, res) => {
  const { name, email, password, phone, ci } = req.body;

  if (!name || !email || !password || !ci) {
    return res.status(400).json({ message: 'Nombre, correo, contraseña y cédula son obligatorios' });
  }

  // Validar formato de Cédula o RIF
  if (!validateCi(ci)) {
    return res.status(400).json({ message: 'Formato de Cédula o RIF inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes (ej: V-12345678, J-301234567)' });
  }

  try {
    // Verificar si el usuario ya existe por correo
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }

    // Verificar si la cédula ya existe
    const [existingCI]: any = await pool.query('SELECT id FROM users WHERE ci = ?', [ci]);
    if (existingCI.length > 0) {
      return res.status(400).json({ message: 'La cédula de identidad ya está registrada por otro usuario' });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar usuario
    const [result]: any = await pool.query(
      'INSERT INTO users (name, email, password, role, phone, ci) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'customer', phone || null, ci]
    );

    const userId = result.insertId;

    // Generar token JWT
    const token = jwt.sign(
      { id: userId, email, role: 'customer', name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: userId, name, email, role: 'customer', phone, ci }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error interno del servidor en el registro' });
  }
});

// Inicio de Sesion (General y Administradores)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contrasena son obligatorios' });
  }

  try {
    // Buscar usuario en base de datos
    const [users]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Credenciales invalidas' });
    }

    const user = users[0];

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales invalidas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor en el login' });
  }
});

// Obtener el Client ID de Google configurado en el servidor
router.get('/google-client-id', (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '1008719970978-hb24n2dstb40o45upg4689qqt56n74hs.apps.googleusercontent.com';
  res.json({ clientId });
});

// Autenticación con Google (Login / Registro integrado)
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'La credencial de Google es obligatoria' });
  }

  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!googleRes.ok) {
      return res.status(400).json({ message: 'Token de Google inválido o expirado' });
    }

    const payload: any = await googleRes.json();
    const { email, name, email_verified, aud } = payload;

    if (email_verified !== true && email_verified !== 'true') {
      return res.status(400).json({ message: 'El correo electrónico de Google no está verificado' });
    }

    // Validar GOOGLE_CLIENT_ID si está configurado en .env
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && aud !== expectedClientId) {
      return res.status(400).json({ message: 'El cliente de Google no coincide con el configurado' });
    }

    // Buscar si el usuario ya existe por correo
    const [users]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    let user;

    if (users.length > 0) {
      user = users[0];
    } else {
      // Registrar un nuevo cliente desde Google
      const userName = name || email.split('@')[0];
      const [result]: any = await pool.query(
        'INSERT INTO users (name, email, password, role, phone, ci) VALUES (?, ?, NULL, ?, NULL, NULL)',
        [userName, email, 'customer']
      );

      const userId = result.insertId;
      const [newUsers]: any = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      user = newUsers[0];
    }

    // Generar token JWT del sistema
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        ci: user.ci
      }
    });
  } catch (error) {
    console.error('Error en login de Google:', error);
    res.status(500).json({ message: 'Error interno del servidor al procesar la autenticación de Google' });
  }
});

// Obtener datos del usuario logueado
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });

    const [users]: any = await pool.query('SELECT id, name, email, role, phone, ci, permissions, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error en /me:', error);
    res.status(500).json({ message: 'Error al obtener datos del usuario' });
  }
});

router.get('/customers', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
    return res.status(403).json({ message: 'No autorizado. Solo administradores y vendedores pueden ver la lista de clientes' });
  }

  try {
    const [customers]: any = await pool.query(
      'SELECT id, name, email, phone, ci, address, client_type, representative_name, representative_ci, representative_phone, representative_position, created_at FROM users WHERE role = "customer" ORDER BY name ASC'
    );
    res.json(customers);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error al obtener lista de clientes' });
  }
});

// Registrar nuevo cliente desde POS o Panel Admin
router.post('/register-customer', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
    return res.status(403).json({ message: 'No autorizado para registrar clientes' });
  }

  const {
    name,
    ci,
    email,
    phone,
    address,
    client_type,
    representative_name,
    representative_ci,
    representative_phone,
    representative_position
  } = req.body;

  if (!name || !ci) {
    return res.status(400).json({ message: 'El nombre/razón social y la cédula/RIF son obligatorios' });
  }

  const cleanCi = ci.trim();
  if (!validateCi(cleanCi)) {
    return res.status(400).json({ message: 'Formato de Cédula o RIF del cliente inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes (ej: V-12345678, J-301234567)' });
  }

  const cleanName = name.trim();
  const cleanPhone = phone ? phone.trim() : null;
  const cleanAddress = address ? address.trim() : null;
  let cleanEmail = email ? email.trim() : null;
  const cleanType = client_type || (cleanCi.toUpperCase().startsWith('J-') ? 'juridico' : cleanCi.toUpperCase().startsWith('G-') ? 'gubernamental' : 'natural');

  const cleanRepName = representative_name ? representative_name.trim() : null;
  const cleanRepCi = representative_ci ? representative_ci.trim() : null;
  if (cleanRepCi && !validateCi(cleanRepCi)) {
    return res.status(400).json({ message: 'Formato de Cédula o RIF del representante legal inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes.' });
  }
  const cleanRepPhone = representative_phone ? representative_phone.trim() : null;
  const cleanRepPosition = representative_position ? representative_position.trim() : null;

  if (!cleanEmail) {
    cleanEmail = `${cleanCi.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.local`;
  }

  try {
    // Verificar si la cédula/RIF ya existe
    const [existingCI]: any = await pool.query(
      'SELECT id, name, email, phone, ci, address, client_type, representative_name, representative_ci, representative_phone, representative_position FROM users WHERE ci = ?',
      [cleanCi]
    );

    if (existingCI.length > 0) {
      return res.status(400).json({
        message: `El cliente con Cédula / RIF (${cleanCi}) ya se encuentra registrado a nombre de: ${existingCI[0].name}`,
        user: existingCI[0]
      });
    }

    // Verificar si el correo ya existe
    const [existingEmail]: any = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingEmail.length > 0) {
      cleanEmail = `${cleanCi.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@cliente.local`;
    }

    const [result]: any = await pool.query(
      `INSERT INTO users 
        (name, email, password, role, phone, ci, address, client_type, representative_name, representative_ci, representative_phone, representative_position) 
       VALUES (?, ?, NULL, "customer", ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanName, cleanEmail, cleanPhone, cleanCi, cleanAddress, cleanType, cleanRepName, cleanRepCi, cleanRepPhone, cleanRepPosition]
    );

    const newCustomerId = result.insertId;

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'user_edit',
      title: `Nuevo Cliente Registrado: ${cleanName}`,
      details: `Cédula/RIF: ${cleanCi}, Dirección: ${cleanAddress || 'N/A'}, Tipo: ${cleanType}, Encargado: ${cleanRepName || 'N/A'}`
    });

    res.status(201).json({
      message: 'Cliente registrado con éxito',
      user: {
        id: newCustomerId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        ci: cleanCi,
        address: cleanAddress,
        role: 'customer',
        client_type: cleanType,
        representative_name: cleanRepName,
        representative_ci: cleanRepCi,
        representative_phone: cleanRepPhone,
        representative_position: cleanRepPosition
      }
    });
  } catch (error: any) {
    console.error('Error al registrar cliente:', error);
    res.status(500).json({ message: error.message || 'Error al registrar cliente en la base de datos' });
  }
});

// Actualizar datos de cliente (Vendedores y Admin)
router.put('/customers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
    return res.status(403).json({ message: 'No autorizado para editar clientes' });
  }

  const { id } = req.params;
  const {
    name,
    ci,
    email,
    phone,
    address,
    client_type,
    representative_name,
    representative_ci,
    representative_phone,
    representative_position
  } = req.body;

  if (!name || !ci) {
    return res.status(400).json({ message: 'El nombre/razón social y la cédula/RIF son obligatorios' });
  }

  const cleanCi = ci.trim();
  if (!validateCi(cleanCi)) {
    return res.status(400).json({ message: 'Formato de Cédula o RIF del cliente inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes (ej: V-12345678, J-301234567)' });
  }

  const cleanName = name.trim();
  const cleanPhone = phone ? phone.trim() : null;
  const cleanAddress = address ? address.trim() : null;
  let cleanEmail = email ? email.trim() : null;
  const cleanType = client_type || (cleanCi.toUpperCase().startsWith('J-') ? 'juridico' : cleanCi.toUpperCase().startsWith('G-') ? 'gubernamental' : 'natural');

  const cleanRepName = representative_name ? representative_name.trim() : null;
  const cleanRepCi = representative_ci ? representative_ci.trim() : null;
  if (cleanRepCi && !validateCi(cleanRepCi)) {
    return res.status(400).json({ message: 'Formato de Cédula o RIF del representante legal inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes.' });
  }
  const cleanRepPhone = representative_phone ? representative_phone.trim() : null;
  const cleanRepPosition = representative_position ? representative_position.trim() : null;

  if (!cleanEmail) {
    cleanEmail = `${cleanCi.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.local`;
  }

  try {
    const [existingCi]: any = await pool.query(
      'SELECT id FROM users WHERE ci = ? AND id != ?',
      [cleanCi, id]
    );

    if (existingCi.length > 0) {
      return res.status(400).json({ message: `La Cédula / RIF (${cleanCi}) ya está en uso por otro cliente` });
    }

    await pool.query(
      `UPDATE users 
       SET name = ?, email = ?, phone = ?, ci = ?, address = ?, client_type = ?, 
           representative_name = ?, representative_ci = ?, representative_phone = ?, representative_position = ?
       WHERE id = ? AND role = "customer"`,
      [cleanName, cleanEmail, cleanPhone, cleanCi, cleanAddress, cleanType, cleanRepName, cleanRepCi, cleanRepPhone, cleanRepPosition, id]
    );

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'user_edit',
      title: `Cliente Actualizado: ${cleanName}`,
      details: `ID #${id}, Cédula/RIF: ${cleanCi}, Teléfono: ${cleanPhone || 'N/A'}`
    });

    res.json({ message: 'Cliente actualizado con éxito' });
  } catch (error: any) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ message: 'Error al actualizar cliente en la base de datos' });
  }
});

// Eliminar cliente (Vendedores y Admin)
router.delete('/customers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
    return res.status(403).json({ message: 'No autorizado para eliminar clientes' });
  }

  const { id } = req.params;

  try {
    const [cust]: any = await pool.query('SELECT name, ci FROM users WHERE id = ? AND role = "customer"', [id]);
    if (cust.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    await pool.query('DELETE FROM users WHERE id = ? AND role = "customer"', [id]);

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'user_edit',
      title: `Cliente Eliminado: ${cust[0].name}`,
      details: `ID #${id}, Cédula/RIF: ${cust[0].ci || 'N/A'}`
    });

    res.json({ message: 'Cliente eliminado con éxito' });
  } catch (error: any) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ message: 'Error al eliminar cliente' });
  }
});

// Buscar cliente por cédula (POS Step-1)
router.get('/customer-by-ci', authenticate, async (req: AuthRequest, res: Response) => {
  const { ci } = req.query;
  if (!ci) {
    return res.status(400).json({ message: 'La cédula o RIF es requerida' });
  }
  try {
    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, ci, address, role, permissions, client_type, representative_name, representative_ci, representative_phone, representative_position FROM users WHERE ci = ? LIMIT 1',
      [ci]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.json(users[0]);
  } catch (error) {
    console.error('Error buscando cliente por cédula:', error);
    res.status(500).json({ message: 'Error interno al buscar cliente' });
  }
});

// Obtener todos los administradores y vendedores (Solo Admin o Personal con permiso)
router.get('/staff', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
    return res.status(403).json({ message: 'No autorizado' });
  }

  try {
    const [staff]: any = await pool.query(
      'SELECT id, name, email, role, phone, ci, permissions FROM users WHERE role IN ("admin", "seller") ORDER BY name ASC'
    );
    res.json(staff);
  } catch (error) {
    console.error('Error al obtener personal:', error);
    res.status(500).json({ message: 'Error al obtener lista de personal' });
  }
});

// Crear un administrador o vendedor (Solo Admin)
router.post('/staff', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado' });
  }

  const { name, email, password, role, phone, ci, permissions } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Nombre, correo, contraseña y rol son obligatorios' });
  }

  if (!['admin', 'seller'].includes(role)) {
    return res.status(400).json({ message: 'Rol inválido. Debe ser admin o seller' });
  }

  if (ci && !validateCi(ci)) {
    return res.status(400).json({ message: 'Formato de Cédula o RIF del personal inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes.' });
  }

  try {
    // Verificar si el correo ya existe
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const permissionsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : (permissions || null);

    await pool.query(
      'INSERT INTO users (name, email, password, role, phone, ci, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, phone || null, ci || null, permissionsStr]
    );

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'staff_crud',
      title: `Nuevo Vendedor / Personal Creado: ${name}`,
      details: `Correo: ${email}, Rol: ${role}, Cédula: ${ci || 'N/D'}, Permisos: ${permissionsStr || 'Por defecto'}`
    });

    res.status(201).json({ message: 'Usuario de personal creado con éxito' });
  } catch (error) {
    console.error('Error al crear personal:', error);
    res.status(500).json({ message: 'Error al registrar usuario en la base de datos' });
  }
});

// Modificar un administrador o vendedor (Solo Admin)
router.put('/staff/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado' });
  }

  const { id } = req.params;
  const { name, email, password, role, phone, ci, permissions } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ message: 'Nombre, correo y rol son obligatorios' });
  }

  if (!['admin', 'seller'].includes(role)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }

  if (ci && !validateCi(ci)) {
    return res.status(400).json({ message: 'Formato de Cédula o RIF del personal inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes.' });
  }

  try {
    // Verificar si el correo ya existe para otro usuario
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está en uso por otro usuario' });
    }

    const permissionsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : (permissions || null);

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await pool.query(
        'UPDATE users SET name = ?, email = ?, password = ?, role = ?, phone = ?, ci = ?, permissions = ? WHERE id = ?',
        [name, email, hashedPassword, role, phone || null, ci || null, permissionsStr, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = ?, email = ?, role = ?, phone = ?, ci = ?, permissions = ? WHERE id = ?',
        [name, email, role, phone || null, ci || null, permissionsStr, id]
      );
    }

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'staff_crud',
      title: `Personal Actualizado (ID #${id}): ${name}`,
      details: `Correo: ${email}, Rol: ${role}, Cédula: ${ci || 'N/D'}, Permisos: ${permissionsStr || 'Por defecto'}`
    });

    res.json({ message: 'Usuario de personal actualizado con éxito' });
  } catch (error) {
    console.error('Error al actualizar personal:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

// Eliminar un administrador o vendedor (Solo Admin)
router.delete('/staff/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado' });
  }

  const { id } = req.params;

  // Evitar auto-eliminación
  if (Number(id) === req.user.id) {
    return res.status(400).json({ message: 'No puedes eliminar tu propio usuario administrador' });
  }

  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'staff_crud',
      title: `Personal Eliminado (ID #${id})`,
      details: `Acción ejecutada por el Administrador ${req.user?.name}`
    });

    res.json({ message: 'Usuario de personal eliminado con éxito' });
  } catch (error) {
    console.error('Error al eliminar personal:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

// Solicitar código de recuperación de contraseña por correo
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'El correo electrónico es obligatorio' });
  }

  try {
    const [users]: any = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'No existe ninguna cuenta registrada con este correo electrónico' });
    }

    const user = users[0];

    // Generar código aleatorio de 6 dígitos (ej. 849201)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expiración en 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Guardar en base de datos
    await pool.query(
      'UPDATE users SET reset_code = ?, reset_code_expires_at = ? WHERE id = ?',
      [code, expiresAt, user.id]
    );

    // Enviar correo electrónico
    const emailPreviewUrl = await sendPasswordResetEmail(user.email, user.name, code);

    res.json({
      message: 'Hemos enviado un código de 6 dígitos a tu correo electrónico',
      emailPreviewUrl: emailPreviewUrl !== 'Email enviado' ? emailPreviewUrl : undefined
    });
  } catch (error) {
    console.error('Error en /forgot-password:', error);
    res.status(500).json({ message: 'Error interno al enviar el código de recuperación' });
  }
});

// Restablecer contraseña utilizando el código de 6 dígitos
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Correo, código y nueva contraseña son obligatorios' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const [users]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = users[0];

    if (!user.reset_code || user.reset_code.trim() !== code.trim()) {
      return res.status(400).json({ message: 'El código de verificación es incorrecto' });
    }

    if (!user.reset_code_expires_at || new Date(user.reset_code_expires_at) < new Date()) {
      return res.status(400).json({ message: 'El código de verificación ha expirado. Por favor solicita uno nuevo.' });
    }

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña y limpiar código
    await pool.query(
      'UPDATE users SET password = ?, reset_code = NULL, reset_code_expires_at = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.json({ message: '¡Contraseña restablecida con éxito! Ya puedes iniciar sesión con tu nueva clave.' });
  } catch (error) {
    console.error('Error en /reset-password:', error);
    res.status(500).json({ message: 'Error interno al restablecer la contraseña' });
  }
});

// GET /auth/staff: Obtener personal y vendedores
router.get('/staff', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado. Solo administradores' });
  }
  try {
    const [staff]: any = await pool.query(
      'SELECT id, name, email, role, phone, ci, permissions FROM users WHERE role IN ("admin", "seller") ORDER BY name ASC'
    );
    res.json(staff);
  } catch (error) {
    console.error('Error al obtener personal:', error);
    res.status(500).json({ message: 'Error al obtener personal' });
  }
});

// POST /auth/staff: Crear personal/vendedor
router.post('/staff', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado. Solo administradores' });
  }
  const { name, email, password, role, phone, ci, permissions } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Nombre, correo, contraseña y rol son obligatorios' });
  }

  try {
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const permsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : (permissions || null);

    await pool.query(
      'INSERT INTO users (name, email, password, role, phone, ci, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, phone || null, ci || null, permsStr]
    );

    res.status(201).json({ message: 'Personal registrado con éxito' });
  } catch (error: any) {
    console.error('Error al registrar personal:', error);
    res.status(500).json({ message: 'Error al registrar personal' });
  }
});

// PUT /auth/staff/:id: Actualizar personal/vendedor
router.put('/staff/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado. Solo administradores' });
  }
  const id = req.params.id;
  const { name, email, password, role, phone, ci, permissions } = req.body;

  try {
    const permsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : (permissions || null);

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await pool.query(
        'UPDATE users SET name = ?, email = ?, password = ?, role = ?, phone = ?, ci = ?, permissions = ? WHERE id = ?',
        [name, email, hashedPassword, role, phone || null, ci || null, permsStr, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = ?, email = ?, role = ?, phone = ?, ci = ?, permissions = ? WHERE id = ?',
        [name, email, role, phone || null, ci || null, permsStr, id]
      );
    }

    res.json({ message: 'Personal actualizado con éxito' });
  } catch (error: any) {
    console.error('Error al actualizar personal:', error);
    res.status(500).json({ message: 'Error al actualizar personal' });
  }
});

// DELETE /auth/staff/:id: Eliminar personal/vendedor
router.delete('/staff/:id', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado. Solo administradores' });
  }
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Usuario eliminado con éxito' });
  } catch (error: any) {
    console.error('Error al eliminar personal:', error);
    res.status(500).json({ message: 'Error al eliminar personal' });
  }
});

// POST /auth/verify-supervisor: Verifica credenciales de administrador/supervisor
router.post('/verify-supervisor', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
  }

  try {
    const [users]: any = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales de supervisor inválidas' });
    }

    const user = users[0];
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'El usuario no tiene privilegios de supervisor (administrador)' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales de supervisor inválidas' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error al verificar supervisor:', error);
    res.status(500).json({ message: 'Error interno al verificar supervisor' });
  }
});

export default router;
