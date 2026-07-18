import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreta_pos_online_token_key_987654321';

// Registro de Usuario (Clientes)
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nombre, correo y contrasena son obligatorios' });
  }

  try {
    // Verificar si el usuario ya existe
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'El correo electronico ya esta registrado' });
    }

    // Encriptar contrasena
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar usuario
    const [result]: any = await pool.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'customer', phone || null]
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
      user: { id: userId, name, email, role: 'customer', phone }
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

// Obtener datos del usuario logueado
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });

    const [users]: any = await pool.query('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?', [req.user.id]);
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
      'SELECT id, name, email, phone FROM users WHERE role = "customer" ORDER BY name ASC'
    );
    res.json(customers);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error al obtener lista de clientes' });
  }
});

// Obtener todos los administradores y vendedores (Solo Admin)
router.get('/staff', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado' });
  }

  try {
    const [staff]: any = await pool.query(
      'SELECT id, name, email, role, phone FROM users WHERE role IN ("admin", "seller") ORDER BY name ASC'
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

  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Nombre, correo, contraseña y rol son obligatorios' });
  }

  if (!['admin', 'seller'].includes(role)) {
    return res.status(400).json({ message: 'Rol inválido. Debe ser admin o seller' });
  }

  try {
    // Verificar si el correo ya existe
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, phone || null]
    );

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
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ message: 'Nombre, correo y rol son obligatorios' });
  }

  if (!['admin', 'seller'].includes(role)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }

  try {
    // Verificar si el correo ya existe para otro usuario
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está en uso por otro usuario' });
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await pool.query(
        'UPDATE users SET name = ?, email = ?, password = ?, role = ?, phone = ? WHERE id = ?',
        [name, email, hashedPassword, role, phone || null, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = ?, email = ?, role = ?, phone = ? WHERE id = ?',
        [name, email, role, phone || null, id]
      );
    }

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
    res.json({ message: 'Usuario de personal eliminado con éxito' });
  } catch (error) {
    console.error('Error al eliminar personal:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

export default router;
