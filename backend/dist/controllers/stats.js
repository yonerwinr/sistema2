"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Endpoint de estadísticas del dashboard (Solo Admin)
router.get('/', auth_1.authenticate, auth_1.isAdmin, async (req, res) => {
    try {
        // 1. Resumen de tarjetas métricas (Ventas totales, Ingresos, Promedio, Productos sin stock)
        const [summaryResult] = await db_1.default.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(AVG(total), 0) as average_order_value
      FROM sales
      WHERE status = 'completed'
    `);
        const summary = summaryResult[0];
        const [lowStockResult] = await db_1.default.query(`
      SELECT COUNT(*) as low_stock_count FROM products WHERE stock < 5
    `);
        const lowStockCount = lowStockResult[0].low_stock_count;
        // Gastos Totales y Ganancias Netas
        const [expensesResult] = await db_1.default.query(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses
    `);
        const totalExpenses = Number(expensesResult[0]?.total_expenses || 0);
        const totalRevenue = Number(summary.total_revenue || 0);
        const totalProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;
        // 2. Ventas por los últimos 7 días
        const [dailySales] = await db_1.default.query(`
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
        const [paymentMethods] = await db_1.default.query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total) as revenue
      FROM sales
      WHERE status = 'completed'
      GROUP BY payment_method
    `);
        // 4. Distribución por tipo de venta (online vs pos)
        const [salesTypes] = await db_1.default.query(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(total) as revenue
      FROM sales
      WHERE status = 'completed'
      GROUP BY type
    `);
        // 5. Los 5 productos más vendidos
        const [topProducts] = await db_1.default.query(`
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
        const [lowStockProducts] = await db_1.default.query(`
      SELECT id, name, stock, price, category FROM products WHERE stock < 5 ORDER BY stock ASC LIMIT 10
    `);
        res.json({
            metrics: {
                totalOrders: summary.total_orders,
                totalRevenue,
                totalExpenses,
                totalProfit,
                profitMargin,
                averageOrderValue: Number(summary.average_order_value),
                lowStockCount
            },
            dailySales,
            paymentMethods,
            salesTypes,
            topProducts,
            lowStockProducts
        });
    }
    catch (error) {
        console.error('Error al generar estadisticas:', error);
        res.status(500).json({ message: 'Error al generar las estadisticas de ventas' });
    }
});
exports.default = router;
