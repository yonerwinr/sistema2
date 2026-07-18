import { Router, Response } from 'express';
import pool from '../config/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendInvoiceEmail } from '../services/email';

const router = Router();

// Middleware de autenticación opcional para compras (permite compras de invitados y POS sin iniciar sesión si es necesario, o POS por Admin)
// Para POS requerimos Admin, para Online podemos requerir usuario autenticado o permitir invitados.
// Hagamos una ruta limpia:
// - POST /checkout: Compra online (puede ser autenticado o invitado)
// - POST /pos: Registro de venta física por Admin (requiere admin autenticado)
// - GET /history: Historial de ventas del cliente (requiere autenticación)
// - GET /all: Historial de todas las ventas (requiere admin)

// Registrar Venta Online (Cliente / Invitado)
router.post('/checkout', async (req: AuthRequest, res) => {
  const { userId, customerName, customerEmail, customerPhone, paymentMethod, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'El carrito no puede estar vacio' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let total = 0;
    const saleItemsToInsert: any[] = [];

    // Validar productos y stock
    for (const item of items) {
      const [products]: any = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.productId]);
      if (products.length === 0) {
        throw new Error(`Producto con ID ${item.productId} no encontrado`);
      }

      const product = products[0];
      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}`);
      }

      const itemTotal = Number(product.price) * item.quantity;
      total += itemTotal;

      saleItemsToInsert.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        price: product.price
      });

      // Restar stock
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, product.id]);
    }

    // Registrar la venta
    const [saleResult]: any = await conn.query(
      'INSERT INTO sales (user_id, customer_name, customer_email, customer_phone, total, payment_method, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId || null,
        customerName || 'Cliente Online',
        customerEmail || null,
        customerPhone || null,
        total,
        paymentMethod || 'card',
        'online',
        'completed' // Completado por defecto para simplificar
      ]
    );

    const saleId = saleResult.insertId;

    // Registrar detalles
    for (const item of saleItemsToInsert) {
      await conn.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [saleId, item.productId, item.quantity, item.price]
      );
    }

    await conn.commit();
    conn.release();

    const saleInfo = {
      id: saleId,
      user_id: userId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      total,
      payment_method: paymentMethod,
      type: 'online',
      created_at: new Date()
    };

    // Generar texto para WhatsApp
    const waText = generateWhatsAppText(saleInfo, saleItemsToInsert);

    // Intentar enviar correo de factura en segundo plano para no bloquear el checkout
    if (customerEmail) {
      sendInvoiceEmail(customerEmail, saleInfo, saleItemsToInsert).catch(err => {
        console.error('Error enviando correo en checkout:', err);
      });
    }

    res.status(201).json({
      message: 'Venta registrada con exito',
      saleId,
      total,
      whatsappText: encodeURIComponent(waText),
      emailPreviewUrl: ''
    });
  } catch (error: any) {
    await conn.rollback();
    conn.release();
    console.error('Error en checkout:', error);
    res.status(400).json({ message: error.message || 'Error al procesar la venta' });
  }
});

// Registrar Venta POS (Solo Admin)
router.post('/pos', authenticate, async (req: AuthRequest, res: Response) => {
  // Solo administradores pueden usar el POS
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado. Solo administradores pueden registrar ventas POS' });
  }

  const { customerName, customerEmail, customerPhone, paymentMethod, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Debe agregar al menos un producto' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let total = 0;
    const saleItemsToInsert: any[] = [];

    // Validar productos y stock
    for (const item of items) {
      const [products]: any = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.productId]);
      if (products.length === 0) {
        throw new Error(`Producto con ID ${item.productId} no encontrado`);
      }

      const product = products[0];
      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}`);
      }

      const itemTotal = Number(product.price) * item.quantity;
      total += itemTotal;

      saleItemsToInsert.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        price: product.price
      });

      // Restar stock
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, product.id]);
    }

    // Registrar la venta
    const [saleResult]: any = await conn.query(
      'INSERT INTO sales (user_id, customer_name, customer_email, customer_phone, total, payment_method, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.id, // Admin que registro la venta
        customerName || 'Consumidor Final',
        customerEmail || null,
        customerPhone || null,
        total,
        paymentMethod || 'cash',
        'pos',
        'completed'
      ]
    );

    const saleId = saleResult.insertId;

    // Registrar detalles
    for (const item of saleItemsToInsert) {
      await conn.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [saleId, item.productId, item.quantity, item.price]
      );
    }

    await conn.commit();
    conn.release();

    const saleInfo = {
      id: saleId,
      customer_name: customerName || 'Consumidor Final',
      customer_email: customerEmail,
      customer_phone: customerPhone,
      total,
      payment_method: paymentMethod,
      type: 'pos',
      created_at: new Date()
    };

    // Generar texto para WhatsApp
    const waText = generateWhatsAppText(saleInfo, saleItemsToInsert);

    // Intentar enviar correo de factura en segundo plano para no bloquear la venta POS
    if (customerEmail) {
      sendInvoiceEmail(customerEmail, saleInfo, saleItemsToInsert).catch(err => {
        console.error('Error enviando correo en POS:', err);
      });
    }

    res.status(201).json({
      message: 'Venta POS registrada con exito',
      saleId,
      total,
      whatsappText: encodeURIComponent(waText),
      emailPreviewUrl: ''
    });
  } catch (error: any) {
    await conn.rollback();
    conn.release();
    console.error('Error en venta POS:', error);
    res.status(400).json({ message: error.message || 'Error al procesar la venta POS' });
  }
});

// Historial de Compras de un Cliente (Público autenticado)
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'No autenticado' });

  try {
    const [sales]: any = await pool.query(
      'SELECT * FROM sales WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(sales);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ message: 'Error al obtener historial de ventas' });
  }
});

// Detalle de una Venta específica con sus productos (Autenticado)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const [sales]: any = await pool.query('SELECT * FROM sales WHERE id = ?', [id]);
    if (sales.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const sale = sales[0];

    // Verificar seguridad: solo el propio cliente o un admin puede ver el detalle
    if (req.user?.role !== 'admin' && sale.user_id !== req.user?.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const [items]: any = await pool.query(
      `SELECT si.*, p.name FROM sale_items si 
       JOIN products p ON si.product_id = p.id 
       WHERE si.sale_id = ?`,
      [id]
    );

    res.json({ sale, items });
  } catch (error) {
    console.error('Error al obtener detalle de venta:', error);
    res.status(500).json({ message: 'Error al obtener detalles de la venta' });
  }
});

// Historial de Todas las Ventas (Solo Admin)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'No autorizado' });
  }

  try {
    const [sales]: any = await pool.query(
      `SELECT s.*, u.name as registered_by 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       ORDER BY s.created_at DESC`
    );
    res.json(sales);
  } catch (error) {
    console.error('Error al obtener todas las ventas:', error);
    res.status(500).json({ message: 'Error al obtener todas las ventas' });
  }
});

// Helper para formatear texto de WhatsApp
function generateWhatsAppText(sale: any, items: any[]): string {
  const dateStr = new Date(sale.created_at).toLocaleString('es-ES');
  let text = `*📄 FACTURA DE COMPRA #${sale.id}*\n`;
  text += `-------------------------------------\n`;
  text += `*Cliente:* ${sale.customer_name}\n`;
  text += `*Fecha:* ${dateStr}\n`;
  text += `*Metodo de Pago:* ${sale.payment_method.toUpperCase()}\n`;
  text += `*Tipo:* ${sale.type.toUpperCase()}\n`;
  text += `-------------------------------------\n`;
  text += `*Detalle de Productos:*\n`;

  items.forEach(item => {
    const itemTotal = (Number(item.price) * item.quantity).toFixed(2);
    text += `- ${item.name} x${item.quantity} ($${Number(item.price).toFixed(2)}) = *$${itemTotal}*\n`;
  });

  text += `-------------------------------------\n`;
  text += `*TOTAL NETO:* *$${Number(sale.total).toFixed(2)}*\n\n`;
  text += `¡Gracias por preferirnos! Si tienes dudas contactanos.`;
  return text;
}

// Reenviar factura por correo
router.post('/:id/resend-email', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { email } = req.body;

  try {
    const [sales]: any = await pool.query('SELECT * FROM sales WHERE id = ?', [id]);
    if (sales.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const sale = sales[0];

    // Verificar seguridad: solo el propio cliente o un admin puede ver/reenviar la factura
    if (req.user?.role !== 'admin' && sale.user_id !== req.user?.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const [items]: any = await pool.query(
      `SELECT si.*, p.name FROM sale_items si 
       JOIN products p ON si.product_id = p.id 
       WHERE si.sale_id = ?`,
      [id]
    );

    const targetEmail = email || sale.customer_email;
    if (!targetEmail) {
      return res.status(400).json({ message: 'No hay un correo electrónico asociado a esta venta y no se especificó ninguno.' });
    }

    const previewUrl = await sendInvoiceEmail(targetEmail, sale, items, true);

    res.json({ 
      message: 'Factura reenviada con éxito',
      emailPreviewUrl: previewUrl || ''
    });
  } catch (error: any) {
    console.error('Error al reenviar factura por correo:', error);
    res.status(500).json({ message: 'Error al reenviar la factura por correo', error: error.message });
  }
});

export default router;
