import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/db';
import { authenticate, isAdmin, AuthRequest } from '../middleware/auth';
import { logAuditEvent } from '../services/audit';

const router = Router();

// Configuración de almacenamiento para Multer (Imágenes Locales)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads')); // backend/uploads
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Subida de imagen local (Solo Admin)
router.post('/upload', authenticate, isAdmin, upload.single('image'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se subió ninguna imagen' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Obtener todos los productos (Público)
router.get('/', async (req, res) => {
  const { category, search } = req.query;
  try {
    let query = 'SELECT * FROM products';
    const params: any[] = [];

    if (category || search) {
      query += ' WHERE';
      const conditions: string[] = [];

      if (category) {
        conditions.push(' category = ?');
        params.push(category);
      }
      if (search) {
        conditions.push(' (name LIKE ? OR description LIKE ? OR code = ?)');
        params.push(`%${search}%`, `%${search}%`, search);
      }

      query += conditions.join(' AND');
    }

    query += ' ORDER BY id DESC';

    const [products] = await pool.query(query, params);
    res.json(products);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ message: 'Error al obtener los productos' });
  }
});

// Obtener un producto por ID (Público)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [products]: any = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json(products[0]);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ message: 'Error al obtener el producto' });
  }
});

const canManageProducts = (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado, token no provisto' });
  }
  if (req.user.role === 'admin' || req.user.role === 'seller') {
    return next();
  }
  return res.status(403).json({ message: 'Acceso denegado, se requieren privilegios de administración o vendedor' });
};

// Crear producto (Admin o Vendedor)
router.post('/', authenticate, canManageProducts, async (req: AuthRequest, res: Response) => {
  const { code, name, description, price, stock, image_url, category } = req.body;

  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
  }

  const cleanCode = (code && typeof code === 'string' && code.trim()) ? code.trim() : null;

  try {
    // Validar código duplicado si se proporciona
    if (cleanCode) {
      const [existing]: any = await pool.query('SELECT id FROM products WHERE code = ?', [cleanCode]);
      if (existing.length > 0) {
        return res.status(400).json({ message: `El código "${cleanCode}" ya está registrado por otro producto` });
      }
    }

    const [result]: any = await pool.query(
      'INSERT INTO products (code, name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cleanCode, name, description || null, price, stock, image_url || null, category || null]
    );

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'product_crud',
      title: `Nuevo Producto Creado: ${name}`,
      details: `Precio: $${price}, Stock: ${stock}, Categoría: ${category || 'General'}`
    });

    res.status(201).json({
      id: result.insertId,
      code: cleanCode,
      name,
      description,
      price,
      stock,
      image_url,
      category
    });
  } catch (error: any) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ message: error.message || 'Error al crear el producto' });
  }
});

// Actualizar producto (Admin o Vendedor)
router.put('/:id', authenticate, canManageProducts, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { code, name, description, price, stock, image_url, category } = req.body;

  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
  }

  const cleanCode = (code && typeof code === 'string' && code.trim()) ? code.trim() : null;

  try {
    // Validar código duplicado si se proporciona y no es del mismo producto
    if (cleanCode) {
      const [existing]: any = await pool.query('SELECT id FROM products WHERE code = ? AND id != ?', [cleanCode, id]);
      if (existing.length > 0) {
        return res.status(400).json({ message: `El código "${cleanCode}" ya está registrado por otro producto` });
      }
    }

    const [result]: any = await pool.query(
      'UPDATE products SET code = ?, name = ?, description = ?, price = ?, stock = ?, image_url = ?, category = ? WHERE id = ?',
      [cleanCode, name, description || null, price, stock, image_url || null, category || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'product_crud',
      title: `Producto Actualizado (ID #${id}): ${name}`,
      details: `Nuevo precio: $${price}, Nuevo stock: ${stock}, Categoría: ${category || 'General'}`
    });

    res.json({
      id: parseInt(id),
      code: cleanCode,
      name,
      description,
      price,
      stock,
      image_url,
      category
    });
  } catch (error: any) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: error.message || 'Error al actualizar el producto' });
  }
});

// Eliminar producto (Admin o Vendedor)
router.delete('/:id', authenticate, canManageProducts, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const [result]: any = await pool.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'product_crud',
      title: `Producto Eliminado (ID #${id})`,
      details: `Eliminado por ${req.user?.name}`
    });

    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error: any) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: error.message || 'Error al eliminar el producto' });
  }
});

export default router;
