"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const email_1 = require("../services/email");
const sheets_1 = require("../services/sheets");
const router = (0, express_1.Router)();
// Middleware de autenticación opcional para compras (permite compras de invitados y POS sin iniciar sesión si es necesario, o POS por Admin)
// Para POS requerimos Admin, para Online podemos requerir usuario autenticado o permitir invitados.
// Hagamos una ruta limpia:
// - POST /checkout: Compra online (puede ser autenticado o invitado)
// - POST /pos: Registro de venta física por Admin (requiere admin autenticado)
// - GET /history: Historial de ventas del cliente (requiere autenticación)
// - GET /all: Historial de todas las ventas (requiere admin)
// Registrar Venta Online (Cliente / Invitado)
router.post('/checkout', async (req, res) => {
    const { userId, customerName, customerEmail, customerPhone, paymentMethod, items, discount, tax } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'El carrito no puede estar vacio' });
    }
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        let total = 0;
        const saleItemsToInsert = [];
        // Validar productos y stock
        for (const item of items) {
            const [products] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.productId]);
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
        // Calcular total final neto: total original menos descuento más tax
        const finalTotal = total - (discount || 0) + (tax || 0);
        const initialPaid = paymentMethod === 'transfer' ? 0.00 : finalTotal;
        // Registrar la venta
        const [saleResult] = await conn.query('INSERT INTO sales (user_id, customer_name, customer_email, customer_phone, total, payment_method, type, status, discount, tax, is_quotation, amount_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)', [
            userId || null,
            customerName || 'Cliente Online',
            customerEmail || null,
            customerPhone || null,
            finalTotal,
            paymentMethod || 'card',
            'online',
            paymentMethod === 'transfer' ? 'pending' : 'completed', // Transferencia empieza como pendiente (Deudor)
            discount || 0,
            tax || 0,
            initialPaid
        ]);
        const saleId = saleResult.insertId;
        // Registrar detalles
        for (const item of saleItemsToInsert) {
            await conn.query('INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [saleId, item.productId, item.quantity, item.price]);
        }
        await conn.commit();
        conn.release();
        const saleInfo = {
            id: saleId,
            user_id: userId,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            total: finalTotal,
            payment_method: paymentMethod,
            type: 'online',
            discount: discount || 0,
            tax: tax || 0,
            amount_paid: initialPaid,
            created_at: new Date()
        };
        // Generar texto para WhatsApp
        const waText = generateWhatsAppText(saleInfo, saleItemsToInsert);
        // Intentar enviar correo de factura en segundo plano para no bloquear el checkout
        if (customerEmail) {
            (0, email_1.sendInvoiceEmail)(customerEmail, saleInfo, saleItemsToInsert).catch(err => {
                console.error('Error enviando correo en checkout:', err);
            });
        }
        // Intentar respaldar en Google Sheets en segundo plano
        (0, sheets_1.syncSaleToSheets)(saleInfo, saleItemsToInsert).catch(err => {
            console.error('Error sincronizando con Google Sheets en checkout:', err);
        });
        res.status(201).json({
            message: 'Venta registrada con exito',
            saleId,
            total: finalTotal,
            whatsappText: encodeURIComponent(waText),
            emailPreviewUrl: ''
        });
    }
    catch (error) {
        await conn.rollback();
        conn.release();
        console.error('Error en checkout:', error);
        res.status(400).json({ message: error.message || 'Error al procesar la venta' });
    }
});
// Registrar Venta POS (Solo Admin)
router.post('/pos', auth_1.authenticate, async (req, res) => {
    // Solo administradores pueden usar el POS
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado. Solo administradores pueden registrar ventas POS' });
    }
    const { customerName, customerEmail, customerPhone, customerUserId, paymentMethod, items, discount, tax, isQuotation, status, amountPaid } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe agregar al menos un producto' });
    }
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        let total = 0;
        const saleItemsToInsert = [];
        // Validar productos y stock
        for (const item of items) {
            const [products] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.productId]);
            if (products.length === 0) {
                throw new Error(`Producto con ID ${item.productId} no encontrado`);
            }
            const product = products[0];
            // Si NO es una cotización, validar stock
            if (!isQuotation && product.stock < item.quantity) {
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
            // Restar stock (solo si NO es cotización)
            if (!isQuotation) {
                await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, product.id]);
            }
        }
        // Calcular total final neto
        const finalTotal = total - (discount || 0) + (tax || 0);
        let finalAmountPaid = 0.00;
        const saleStatus = isQuotation ? 'pending' : (status || 'completed');
        if (saleStatus === 'completed') {
            finalAmountPaid = finalTotal;
        }
        else if (!isQuotation && saleStatus === 'pending') {
            finalAmountPaid = Math.min(finalTotal, Number(amountPaid || 0));
        }
        // Registrar la venta
        const [saleResult] = await conn.query('INSERT INTO sales (user_id, customer_name, customer_email, customer_phone, total, payment_method, type, status, discount, tax, is_quotation, amount_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            customerUserId || null,
            customerName || 'Consumidor Final',
            customerEmail || null,
            customerPhone || null,
            finalTotal,
            paymentMethod || 'cash',
            'pos',
            saleStatus,
            discount || 0.00,
            tax || 0.00,
            isQuotation ? 1 : 0,
            finalAmountPaid
        ]);
        const saleId = saleResult.insertId;
        // Registrar detalles
        for (const item of saleItemsToInsert) {
            await conn.query('INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [saleId, item.productId, item.quantity, item.price]);
        }
        await conn.commit();
        conn.release();
        const saleInfo = {
            id: saleId,
            customer_name: customerName || 'Consumidor Final',
            customer_email: customerEmail,
            customer_phone: customerPhone,
            total: finalTotal,
            payment_method: paymentMethod,
            type: 'pos',
            discount: discount || 0,
            tax: tax || 0,
            is_quotation: isQuotation ? 1 : 0,
            amount_paid: finalAmountPaid,
            created_at: new Date()
        };
        // Generar texto para WhatsApp
        const waText = generateWhatsAppText(saleInfo, saleItemsToInsert);
        // Intentar enviar correo de factura en segundo plano para no bloquear la venta POS (si hay correo)
        if (customerEmail) {
            (0, email_1.sendInvoiceEmail)(customerEmail, saleInfo, saleItemsToInsert).catch(err => {
                console.error('Error enviando correo en POS:', err);
            });
        }
        // Intentar respaldar en Google Sheets en segundo plano
        (0, sheets_1.syncSaleToSheets)(saleInfo, saleItemsToInsert).catch(err => {
            console.error('Error sincronizando con Google Sheets en POS:', err);
        });
        res.status(201).json({
            message: isQuotation ? 'Cotización registrada con éxito' : 'Venta POS registrada con éxito',
            saleId,
            total: finalTotal,
            whatsappText: encodeURIComponent(waText),
            emailPreviewUrl: ''
        });
    }
    catch (error) {
        await conn.rollback();
        conn.release();
        console.error('Error en venta POS:', error);
        res.status(400).json({ message: error.message || 'Error al procesar la venta POS' });
    }
});
// Historial de Compras de un Cliente (Público autenticado)
router.get('/history', auth_1.authenticate, async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autenticado' });
    try {
        const [sales] = await db_1.default.query('SELECT * FROM sales WHERE user_id = ? AND is_quotation = 0 ORDER BY created_at DESC', [req.user.id]);
        res.json(sales);
    }
    catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ message: 'Error al obtener historial de ventas' });
    }
});
// Detalle de una Venta específica con sus productos (Autenticado)
router.get('/:id', auth_1.authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const [sales] = await db_1.default.query('SELECT * FROM sales WHERE id = ?', [id]);
        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }
        const sale = sales[0];
        // Verificar seguridad: solo el propio cliente o un admin puede ver el detalle
        if (req.user?.role !== 'admin' && sale.user_id !== req.user?.id) {
            return res.status(403).json({ message: 'No autorizado' });
        }
        const [items] = await db_1.default.query(`SELECT si.*, p.name FROM sale_items si 
       JOIN products p ON si.product_id = p.id 
       WHERE si.sale_id = ?`, [id]);
        res.json({ sale, items });
    }
    catch (error) {
        console.error('Error al obtener detalle de venta:', error);
        res.status(500).json({ message: 'Error al obtener detalles de la venta' });
    }
});
// Obtener todas las Cotizaciones (Solo Admin)
router.get('/quotations/all', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [sales] = await db_1.default.query(`SELECT s.*, u.name as registered_by 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       WHERE s.is_quotation = 1
       ORDER BY s.created_at DESC`);
        res.json(sales);
    }
    catch (error) {
        console.error('Error al obtener cotizaciones:', error);
        res.status(500).json({ message: 'Error al obtener cotizaciones' });
    }
});
// Obtener todos los Deudores (Ventas pendientes de pago, no cotizaciones) (Solo Admin)
router.get('/debtors/all', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [sales] = await db_1.default.query(`SELECT s.*, u.name as registered_by 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       WHERE s.status = 'pending' AND s.is_quotation = 0
       ORDER BY s.created_at DESC`);
        res.json(sales);
    }
    catch (error) {
        console.error('Error al obtener deudores:', error);
        res.status(500).json({ message: 'Error al obtener deudores' });
    }
});
// Modificar estado de una Venta (Solo Admin - ej. Completar pago de deudor)
router.put('/:id/status', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { id } = req.params;
    const { status, abono } = req.body; // 'completed' | 'cancelled' | 'pending', abono: number (opcional)
    if (status && !['completed', 'cancelled', 'pending'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido' });
    }
    try {
        const [sales] = await db_1.default.query('SELECT total, amount_paid, status FROM sales WHERE id = ?', [id]);
        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }
        const sale = sales[0];
        let newAmountPaid = Number(sale.amount_paid);
        let newStatus = status || sale.status;
        if (abono !== undefined) {
            const abonoNum = parseFloat(abono);
            if (isNaN(abonoNum) || abonoNum <= 0) {
                return res.status(400).json({ message: 'El abono debe ser un número positivo' });
            }
            newAmountPaid += abonoNum;
            // Si el total pagado alcanza o supera el total de la venta, se completa
            if (newAmountPaid >= Number(sale.total)) {
                newAmountPaid = Number(sale.total);
                newStatus = 'completed';
            }
            else {
                newStatus = 'pending';
            }
        }
        else if (status === 'completed') {
            newAmountPaid = Number(sale.total);
        }
        await db_1.default.query('UPDATE sales SET status = ?, amount_paid = ? WHERE id = ?', [newStatus, newAmountPaid, id]);
        // Obtener la venta actualizada y sus ítems para sincronizar la actualización con Google Sheets
        try {
            const [updatedSales] = await db_1.default.query('SELECT * FROM sales WHERE id = ?', [id]);
            const [saleItems] = await db_1.default.query(`SELECT si.*, p.name FROM sale_items si 
         JOIN products p ON si.product_id = p.id 
         WHERE si.sale_id = ?`, [id]);
            if (updatedSales.length > 0) {
                (0, sheets_1.syncSaleToSheets)(updatedSales[0], saleItems).catch(err => {
                    console.error('[SHEETS SYNC] Error al re-sincronizar en Google Sheets:', err);
                });
            }
        }
        catch (sheetErr) {
            console.error('[SHEETS SYNC] Error obteniendo datos para re-sincronización:', sheetErr);
        }
        res.json({
            message: 'Estado de factura actualizado con éxito',
            status: newStatus,
            amount_paid: newAmountPaid
        });
    }
    catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ message: 'Error al actualizar el estado de la venta' });
    }
});
// Validar cupón de descuento
router.post('/coupon/validate', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ message: 'Código de cupón requerido' });
    }
    try {
        const [coupons] = await db_1.default.query('SELECT * FROM coupons WHERE code = ? AND active = 1', [code.toUpperCase()]);
        if (coupons.length === 0) {
            return res.status(404).json({ message: 'Cupón inválido o inactivo' });
        }
        res.json(coupons[0]);
    }
    catch (error) {
        console.error('Error al validar cupón:', error);
        res.status(500).json({ message: 'Error al validar cupón' });
    }
});
// Obtener todos los cupones (Solo Admin)
router.get('/coupons/all', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [coupons] = await db_1.default.query('SELECT * FROM coupons ORDER BY created_at DESC');
        res.json(coupons);
    }
    catch (error) {
        console.error('Error al obtener cupones:', error);
        res.status(500).json({ message: 'Error al obtener cupones' });
    }
});
// Agregar cupón de descuento (Admin y Usuarios)
router.post('/coupons', auth_1.authenticate, async (req, res) => {
    const { code, discountPercent } = req.body;
    if (!code || !discountPercent) {
        return res.status(400).json({ message: 'Código y porcentaje de descuento son obligatorios' });
    }
    try {
        await db_1.default.query('INSERT INTO coupons (code, discount_percent) VALUES (?, ?)', [code.toUpperCase().trim(), discountPercent]);
        res.status(201).json({ message: 'Cupón de descuento agregado con éxito' });
    }
    catch (error) {
        console.error('Error al guardar cupón:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'El cupón ya existe en el sistema' });
        }
        res.status(500).json({ message: 'Error al registrar cupón' });
    }
});
// Historial de Todas las Ventas (Solo Admin)
router.get('/', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [sales] = await db_1.default.query(`SELECT s.*, u.name as registered_by 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       WHERE s.is_quotation = 0
       ORDER BY s.created_at DESC`);
        res.json(sales);
    }
    catch (error) {
        console.error('Error al obtener todas las ventas:', error);
        res.status(500).json({ message: 'Error al obtener todas las ventas' });
    }
});
// Helper para formatear texto de WhatsApp
function generateWhatsAppText(sale, items) {
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
router.post('/:id/resend-email', auth_1.authenticate, async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    try {
        const [sales] = await db_1.default.query('SELECT * FROM sales WHERE id = ?', [id]);
        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }
        const sale = sales[0];
        // Verificar seguridad: solo el propio cliente o un admin puede ver/reenviar la factura
        if (req.user?.role !== 'admin' && sale.user_id !== req.user?.id) {
            return res.status(403).json({ message: 'No autorizado' });
        }
        const [items] = await db_1.default.query(`SELECT si.*, p.name FROM sale_items si 
       JOIN products p ON si.product_id = p.id 
       WHERE si.sale_id = ?`, [id]);
        const targetEmail = email || sale.customer_email;
        if (!targetEmail) {
            return res.status(400).json({ message: 'No hay un correo electrónico asociado a esta venta y no se especificó ninguno.' });
        }
        const previewUrl = await (0, email_1.sendInvoiceEmail)(targetEmail, sale, items, true);
        res.json({
            message: 'Factura reenviada con éxito',
            emailPreviewUrl: previewUrl || ''
        });
    }
    catch (error) {
        console.error('Error al reenviar factura por correo:', error);
        res.status(500).json({ message: 'Error al reenviar la factura por correo', error: error.message });
    }
});
exports.default = router;
