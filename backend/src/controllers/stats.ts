import { Router, Response } from 'express';
import pool from '../config/db';
import { authenticate, isAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Endpoint de estadísticas del dashboard (Solo Admin)
router.get('/', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Resumen de tarjetas métricas (Ventas totales, Ingresos, Promedio, Productos sin stock)
    const [summaryResult]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(AVG(total), 0) as average_order_value
      FROM sales
      WHERE status = 'completed'
    `);
    const summary = summaryResult[0];

    const [lowStockResult]: any = await pool.query(`
      SELECT COUNT(*) as low_stock_count FROM products WHERE stock < 5
    `);
    const lowStockCount = lowStockResult[0].low_stock_count;

    // 2. Ventas por los últimos 7 días
    const [dailySales]: any = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as date,
        COUNT(*) as count,
        SUM(total) as revenue
      FROM sales
      WHERE status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY date ASC
    `);

    // 3. Distribución de métodos de pago
    const [paymentMethods]: any = await pool.query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total) as revenue
      FROM sales
      WHERE status = 'completed'
      GROUP BY payment_method
    `);

    // 4. Distribución por tipo de venta (online vs pos)
    const [salesTypes]: any = await pool.query(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(total) as revenue
      FROM sales
      WHERE status = 'completed'
      GROUP BY type
    `);

    // 5. Los 5 productos más vendidos
    const [topProducts]: any = await pool.query(`
      SELECT 
        p.name,
        SUM(si.quantity) as total_quantity,
        SUM(si.quantity * si.price) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      GROUP BY p.id
      ORDER BY total_quantity DESC
      LIMIT 5
    `);

    // 6. Alertas de productos con stock bajo (detalle)
    const [lowStockProducts]: any = await pool.query(`
      SELECT id, name, stock, price, category FROM products WHERE stock < 5 ORDER BY stock ASC LIMIT 10
    `);

    res.json({
      metrics: {
        totalOrders: summary.total_orders,
        totalRevenue: Number(summary.total_revenue),
        averageOrderValue: Number(summary.average_order_value),
        lowStockCount
      },
      dailySales,
      paymentMethods,
      salesTypes,
      topProducts,
      lowStockProducts
    });
  } catch (error) {
    console.error('Error al generar estadisticas:', error);
    res.status(500).json({ message: 'Error al generar las estadisticas de ventas' });
  }
});

export default router;
