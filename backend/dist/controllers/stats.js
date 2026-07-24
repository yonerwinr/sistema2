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
router.get('/', auth_1.authenticate, auth_1.isAdmin, async (_req, res) => {
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
// GET /reports: Reportes avanzados filtrables para administración y vendedores
router.get('/reports', auth_1.authenticate, async (req, res) => {
    let { seller_id, period = 'day', date } = req.query;
    // Si el usuario es vendedor (seller), forzar que filtre solo por su propio ID
    if (req.user?.role === 'seller') {
        seller_id = String(req.user.id);
    }
    try {
        let targetDate = date ? new Date(date) : new Date();
        if (isNaN(targetDate.getTime())) {
            targetDate = new Date();
        }
        let startDateStr = '';
        let endDateStr = '';
        if (period === 'day') {
            startDateStr = targetDate.toISOString().slice(0, 10) + ' 00:00:00';
            endDateStr = targetDate.toISOString().slice(0, 10) + ' 23:59:59';
        }
        else if (period === 'week') {
            const start = new Date(targetDate);
            start.setDate(start.getDate() - 6);
            startDateStr = start.toISOString().slice(0, 10) + ' 00:00:00';
            endDateStr = targetDate.toISOString().slice(0, 10) + ' 23:59:59';
        }
        else if (period === 'month') {
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth();
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0);
            startDateStr = start.toISOString().slice(0, 10) + ' 00:00:00';
            endDateStr = end.toISOString().slice(0, 10) + ' 23:59:59';
        }
        else if (period === 'year') {
            const year = targetDate.getFullYear();
            startDateStr = `${year}-01-01 00:00:00`;
            endDateStr = `${year}-12-31 23:59:59`;
        }
        else {
            startDateStr = targetDate.toISOString().slice(0, 10) + ' 00:00:00';
            endDateStr = targetDate.toISOString().slice(0, 10) + ' 23:59:59';
        }
        // 1. Obtener listado de ventas detallado en el periodo
        let salesQuery = `
      SELECT s.*, u.name as customer_name, seller.name as seller_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN users seller ON s.seller_id = seller.id
      WHERE s.status = 'completed' AND s.is_quotation = 0 AND s.created_at >= ? AND s.created_at <= ?
    `;
        const salesParams = [startDateStr, endDateStr];
        if (seller_id && seller_id !== '') {
            if (seller_id === 'online') {
                salesQuery += " AND s.type = 'online'";
            }
            else {
                salesQuery += " AND s.seller_id = ? AND s.type = 'pos'";
                salesParams.push(parseInt(seller_id));
            }
        }
        salesQuery += " ORDER BY s.created_at DESC";
        const [sales] = await db_1.default.query(salesQuery, salesParams);
        // 2. Calcular KPIs
        const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
        let totalExpenses = 0;
        let netProfit = totalRevenue;
        let newCustomers = 0;
        // Solo los administradores pueden ver datos financieros consolidados y clientes nuevos globales
        if (req.user?.role !== 'seller') {
            // Obtener gastos totales en el rango (son globales, no por vendedor)
            const [expensesRows] = await db_1.default.query('SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE is_active = 1 AND created_at >= ? AND created_at <= ?', [startDateStr, endDateStr]);
            totalExpenses = Number(expensesRows[0]?.total_expenses || 0);
            netProfit = totalRevenue - totalExpenses;
            // Obtener cantidad de clientes nuevos registrados
            const [customersRows] = await db_1.default.query('SELECT COUNT(*) as count FROM users WHERE role = "customer" AND created_at >= ? AND created_at <= ?', [startDateStr, endDateStr]);
            newCustomers = customersRows[0]?.count || 0;
        }
        // 3. Distribución de métodos de pago
        let paymentQuery = `
      SELECT payment_method, COUNT(*) as count, SUM(total) as revenue
      FROM sales s
      WHERE s.status = 'completed' AND s.is_quotation = 0 AND s.created_at >= ? AND s.created_at <= ?
    `;
        const paymentParams = [startDateStr, endDateStr];
        if (seller_id && seller_id !== '') {
            if (seller_id === 'online') {
                paymentQuery += " AND s.type = 'online'";
            }
            else {
                paymentQuery += " AND s.seller_id = ? AND s.type = 'pos'";
                paymentParams.push(parseInt(seller_id));
            }
        }
        paymentQuery += " GROUP BY payment_method";
        const [paymentMethods] = await db_1.default.query(paymentQuery, paymentParams);
        res.json({
            metrics: {
                totalRevenue,
                totalExpenses,
                netProfit,
                newCustomers,
                salesCount: sales.length
            },
            sales: sales.map((s) => ({
                ...s,
                total: Number(s.total),
                discount: Number(s.discount),
                tax: Number(s.tax),
                amount_paid: Number(s.amount_paid)
            })),
            paymentMethods
        });
    }
    catch (error) {
        console.error('Error al generar reporte avanzado:', error);
        res.status(500).json({ message: 'Error al generar el reporte de ventas' });
    }
});
exports.default = router;
