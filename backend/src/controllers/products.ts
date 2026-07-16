import { Router, Response } from 'express';
import pool from '../config/db';
import { authenticate, isAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

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
        conditions.push(' (name LIKE ? OR description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
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

// Crear producto (Solo Admin)
router.post('/', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, price, stock, image_url, category } = req.body;

  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
  }

  try {
    const [result]: any = await pool.query(
      'INSERT INTO products (name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || null, price, stock, image_url || null, category || null]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      description,
      price,
      stock,
      image_url,
      category
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ message: 'Error al crear el producto' });
  }
});

// Actualizar producto (Solo Admin)
router.put('/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, price, stock, image_url, category } = req.body;

  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
  }

  try {
    const [result]: any = await pool.query(
      'UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image_url = ?, category = ? WHERE id = ?',
      [name, description || null, price, stock, image_url || null, category || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({
      id: parseInt(id),
      name,
      description,
      price,
      stock,
      image_url,
      category
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error al actualizar el producto' });
  }
});

// Eliminar producto (Solo Admin)
router.delete('/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const [result]: any = await pool.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error al eliminar el producto' });
  }
});

export default router;
