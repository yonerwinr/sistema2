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
const rates_1 = require("../services/rates");
const audit_1 = require("../services/audit");
const router = (0, express_1.Router)();
// GET /sales/audit-logs: Obtener audit_logs y ventas para el histórico global
router.get('/audit-logs', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [logs] = await db_1.default.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
        const [sales] = await db_1.default.query(`SELECT s.*, u.name AS seller_name, c.discount_percent AS coupon_discount_percent 
       FROM sales s 
       LEFT JOIN users u ON s.seller_id = u.id 
       LEFT JOIN coupons c ON s.coupon_code = c.code
       ORDER BY s.created_at DESC`);
        res.json({
            logs: logs || [],
            sales: sales || []
        });
    }
    catch (error) {
        console.error('Error al obtener histórico y auditoría:', error);
        res.status(500).json({ message: 'Error al obtener histórico del sistema', error: error.message });
    }
});
// Middleware de autenticación opcional para compras (permite compras de invitados y POS sin iniciar sesión si es necesario, o POS por Admin)
// Para POS requerimos Admin, para Online podemos requerir usuario autenticado o permitir invitados.
// Hagamos una ruta limpia:
// - POST /checkout: Compra online (puede ser autenticado o invitado)
// - POST /pos: Registro de venta física por Admin (requiere admin autenticado)
// - GET /history: Historial de ventas del cliente (requiere autenticación)
// - GET /all: Historial de todas las ventas (requiere admin)
// Registrar Venta Online (Cliente / Invitado)
router.post('/checkout', async (req, res) => {
    const { userId, customerName, customerEmail, customerPhone, customerCi, paymentMethod, items, discount, tax, couponCode } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'El carrito no puede estar vacio' });
    }
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        let couponDiscountPercent = 0.00;
        // Validar cupón si se suministró alguno
        if (couponCode) {
            const cleanCoupon = couponCode.toUpperCase().trim();
            const [coupons] = await conn.query('SELECT * FROM coupons WHERE code = ? AND active = 1 FOR UPDATE', [cleanCoupon]);
            if (coupons.length === 0) {
                throw new Error('El cupón no es válido o está inactivo');
            }
            const coupon = coupons[0];
            if (coupon.is_used === 1) {
                throw new Error('El cupón ya ha sido utilizado');
            }
            couponDiscountPercent = Number(coupon.discount_percent || 0);
            const currentUserId = userId || (req.user ? req.user.id : null);
            // Si es personal, verificar coincidencia de usuario
            if (coupon.user_id !== null) {
                if (!currentUserId || Number(currentUserId) !== Number(coupon.user_id)) {
                    throw new Error('El cupón es personal e intransferible');
                }
                // Marcar como usado (solo se puede usar una vez)
                await conn.query('UPDATE coupons SET is_used = 1 WHERE id = ?', [coupon.id]);
            }
            else {
                // Si es público/general, verificar si este usuario, CI o correo ya lo usaron en una compra previa (1 por persona)
                const conditions = [];
                const params = [];
                if (currentUserId) {
                    conditions.push('user_id = ?');
                    params.push(currentUserId);
                }
                if (customerCi) {
                    conditions.push('customer_ci = ?');
                    params.push(customerCi);
                }
                if (customerEmail) {
                    conditions.push('customer_email = ?');
                    params.push(customerEmail);
                }
                if (conditions.length > 0) {
                    const checkQuery = `SELECT id FROM sales WHERE (${conditions.join(' OR ')}) AND coupon_code = ? AND status != 'cancelled'`;
                    const [alreadyUsed] = await conn.query(checkQuery, [...params, cleanCoupon]);
                    if (alreadyUsed.length > 0) {
                        throw new Error('Ya has utilizado este cupón en una compra anterior');
                    }
                }
            }
        }
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
        const [saleResult] = await conn.query('INSERT INTO sales (user_id, customer_name, customer_email, customer_phone, customer_ci, total, payment_method, type, status, discount, tax, is_quotation, amount_paid, coupon_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)', [
            userId || null,
            customerName || 'Cliente Online',
            customerEmail || null,
            customerPhone || null,
            customerCi || null,
            finalTotal,
            paymentMethod || 'card',
            'online',
            paymentMethod === 'transfer' ? 'pending' : 'completed', // Transferencia empieza como pendiente (Deudor)
            discount || 0,
            tax || 0,
            initialPaid,
            couponCode ? couponCode.toUpperCase().trim() : null
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
            customer_ci: customerCi || null,
            total: finalTotal,
            payment_method: paymentMethod,
            type: 'online',
            discount: discount || 0,
            tax: tax || 0,
            amount_paid: initialPaid,
            coupon_code: couponCode ? couponCode.toUpperCase().trim() : null,
            coupon_discount_percent: couponDiscountPercent,
            seller_name: 'Online (Tienda)',
            created_at: new Date()
        };
        // Generar texto para WhatsApp
        const waText = generateWhatsAppText(saleInfo, saleItemsToInsert);
        // Intentar enviar correo de factura en segundo plano para no bloquear el checkout
        if (customerEmail && !customerEmail.endsWith('@cliente.local')) {
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
            discount: discount || 0,
            tax: tax || 0,
            coupon_code: couponCode || null,
            coupon_discount_percent: couponDiscountPercent,
            concept: null,
            note: null,
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
    // Administradores y vendedores pueden usar el POS
    if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
        return res.status(403).json({ message: 'No autorizado. Solo administradores y vendedores pueden registrar ventas POS' });
    }
    const { customerName, customerEmail, customerPhone, customerCi, customerUserId, paymentMethod, items, discount, tax, isQuotation, status, amountPaid, couponCode, loadedQuotationId, concept, note } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe agregar al menos un producto' });
    }
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        let couponDiscountPercent = 0.00;
        // Validar cupón si se suministró alguno
        if (couponCode) {
            const cleanCoupon = couponCode.toUpperCase().trim();
            const [coupons] = await conn.query('SELECT * FROM coupons WHERE code = ? AND active = 1 FOR UPDATE', [cleanCoupon]);
            if (coupons.length === 0) {
                throw new Error('El cupón no es válido o está inactivo');
            }
            const coupon = coupons[0];
            if (coupon.is_used === 1) {
                throw new Error('El cupón ya ha sido utilizado');
            }
            couponDiscountPercent = Number(coupon.discount_percent || 0);
            // Si es personal, verificar coincidencia de usuario
            if (coupon.user_id !== null) {
                if (!customerUserId || Number(customerUserId) !== Number(coupon.user_id)) {
                    throw new Error('El cupón es personal e intransferible para otro cliente');
                }
                // Marcar como usado (solo se puede usar una vez)
                await conn.query('UPDATE coupons SET is_used = 1 WHERE id = ?', [coupon.id]);
            }
            else {
                // Si es público/general, verificar si este usuario, CI o correo ya lo usaron en una compra previa (1 por persona)
                const conditions = [];
                const params = [];
                if (customerUserId) {
                    conditions.push('user_id = ?');
                    params.push(customerUserId);
                }
                if (customerCi) {
                    conditions.push('customer_ci = ?');
                    params.push(customerCi);
                }
                if (customerEmail) {
                    conditions.push('customer_email = ?');
                    params.push(customerEmail);
                }
                if (conditions.length > 0) {
                    const checkQuery = `SELECT id FROM sales WHERE (${conditions.join(' OR ')}) AND coupon_code = ? AND status != 'cancelled'`;
                    const [alreadyUsed] = await conn.query(checkQuery, [...params, cleanCoupon]);
                    if (alreadyUsed.length > 0) {
                        throw new Error('Este cliente ya ha utilizado este cupón en una compra anterior');
                    }
                }
            }
        }
        let total = 0;
        const saleItemsToInsert = [];
        // Validar productos y stock
        for (const item of items) {
            if (item.customName || (typeof item.productId === 'number' && item.productId < 0) || item.name) {
                // Soporte Venta Libre / Producto no registrado en inventario
                const isFreeSale = (typeof item.productId === 'number' && item.productId < 0) || item.customName;
                if (isFreeSale) {
                    const itemPrice = Number(item.price || 0);
                    const itemTotal = itemPrice * item.quantity;
                    total += itemTotal;
                    saleItemsToInsert.push({
                        productId: null,
                        name: item.customName || item.name || 'Venta Libre (No Registrado)',
                        quantity: item.quantity,
                        price: itemPrice
                    });
                    continue;
                }
            }
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
        let saleId = loadedQuotationId ? Number(loadedQuotationId) : null;
        if (saleId) {
            // 1. Eliminar los items viejos de la cotización para re-insertar los nuevos
            await conn.query('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
            // 2. Actualizar la cabecera de la venta convirtiéndola en factura/POS
            await conn.query(`UPDATE sales SET 
          user_id = ?, 
          customer_name = ?, 
          customer_email = ?, 
          customer_phone = ?, 
          customer_ci = ?,
          total = ?, 
          payment_method = ?, 
          type = 'pos', 
          status = ?, 
          discount = ?, 
          tax = ?, 
          is_quotation = ?, 
          amount_paid = ?,
          coupon_code = ?,
          seller_id = ?,
          concept = ?,
          note = ?
         WHERE id = ?`, [
                customerUserId || null,
                customerName || 'Consumidor Final',
                customerEmail || null,
                customerPhone || null,
                customerCi || null,
                finalTotal,
                paymentMethod || 'cash',
                saleStatus,
                discount || 0.00,
                tax || 0.00,
                isQuotation ? 1 : 0,
                finalAmountPaid,
                couponCode ? couponCode.toUpperCase().trim() : null,
                req.user?.id || null,
                concept || null,
                note || null,
                saleId
            ]);
        }
        else {
            // Registrar la venta nueva
            const [saleResult] = await conn.query('INSERT INTO sales (user_id, customer_name, customer_email, customer_phone, customer_ci, total, payment_method, type, status, discount, tax, is_quotation, amount_paid, coupon_code, seller_id, concept, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                customerUserId || null,
                customerName || 'Consumidor Final',
                customerEmail || null,
                customerPhone || null,
                customerCi || null,
                finalTotal,
                paymentMethod || 'cash',
                'pos',
                saleStatus,
                discount || 0.00,
                tax || 0.00,
                isQuotation ? 1 : 0,
                finalAmountPaid,
                couponCode ? couponCode.toUpperCase().trim() : null,
                req.user?.id || null,
                concept || null,
                note || null
            ]);
            saleId = saleResult.insertId;
        }
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
            customer_ci: customerCi || null,
            total: finalTotal,
            payment_method: paymentMethod,
            type: 'pos',
            discount: discount || 0,
            tax: tax || 0,
            is_quotation: isQuotation ? 1 : 0,
            amount_paid: finalAmountPaid,
            coupon_code: couponCode ? couponCode.toUpperCase().trim() : null,
            coupon_discount_percent: couponDiscountPercent,
            seller_name: req.user?.name || 'Vendedor',
            created_at: new Date(),
            concept: concept || null,
            note: note || null
        };
        // Generar texto para WhatsApp
        const waText = generateWhatsAppText(saleInfo, saleItemsToInsert);
        // Intentar enviar correo de factura en segundo plano para no bloquear la venta POS (si hay correo)
        if (customerEmail && !customerEmail.endsWith('@cliente.local')) {
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
            discount: discount || 0,
            tax: tax || 0,
            coupon_code: couponCode || null,
            coupon_discount_percent: couponDiscountPercent,
            concept: concept || null,
            note: note || null,
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
// Historial de Compras de un Cliente específico por ID (SOLO Admin)
router.get('/customer-history/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado. Solo los administradores pueden ver el historial de compras de un cliente.' });
    }
    const { id } = req.params;
    try {
        const [userRow] = await db_1.default.query('SELECT id, name, ci FROM users WHERE id = ?', [id]);
        if (userRow.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        const customer = userRow[0];
        const [sales] = await db_1.default.query(`SELECT s.*, seller.name as seller_name, c.discount_percent AS coupon_discount_percent 
       FROM sales s 
       LEFT JOIN users seller ON s.seller_id = seller.id 
       LEFT JOIN coupons c ON s.coupon_code = c.code
       WHERE (s.user_id = ? OR (s.customer_ci = ? AND s.customer_ci IS NOT NULL AND s.customer_ci != ''))
       ORDER BY s.created_at DESC`, [customer.id, customer.ci]);
        res.json({
            customer,
            sales: sales || []
        });
    }
    catch (error) {
        console.error('Error al obtener historial de compras del cliente:', error);
        res.status(500).json({ message: 'Error al obtener historial de compras' });
    }
});
// Historial de Compras de un Cliente (Público autenticado)
router.get('/history', auth_1.authenticate, async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'No autenticado' });
    try {
        const [sales] = await db_1.default.query(`SELECT s.*, c.discount_percent AS coupon_discount_percent 
       FROM sales s 
       LEFT JOIN coupons c ON s.coupon_code = c.code
       WHERE s.user_id = ? AND s.is_quotation = 0 
       ORDER BY s.created_at DESC`, [req.user.id]);
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
        const [sales] = await db_1.default.query(`SELECT s.*, u.name as registered_by, seller.name as seller_name, c.discount_percent AS coupon_discount_percent 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       LEFT JOIN users seller ON s.seller_id = seller.id
       LEFT JOIN coupons c ON s.coupon_code = c.code
       WHERE s.id = ?`, [id]);
        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }
        const sale = sales[0];
        // Verificar seguridad: solo el propio cliente, vendedor o admin puede ver el detalle
        if (req.user?.role !== 'admin' && req.user?.role !== 'seller' && sale.user_id !== req.user?.id) {
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
        const [sales] = await db_1.default.query(`SELECT s.*, u.name as registered_by, seller.name as seller_name 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       LEFT JOIN users seller ON s.seller_id = seller.id
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
        const [sales] = await db_1.default.query(`SELECT s.*, u.name as registered_by, seller.name as seller_name 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       LEFT JOIN users seller ON s.seller_id = seller.id
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
            const [updatedSales] = await db_1.default.query(`SELECT s.*, seller.name as seller_name 
         FROM sales s 
         LEFT JOIN users seller ON s.seller_id = seller.id 
         WHERE s.id = ?`, [id]);
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
    const { code, userId } = req.body;
    if (!code) {
        return res.status(400).json({ message: 'Código de cupón requerido' });
    }
    try {
        const [coupons] = await db_1.default.query('SELECT * FROM coupons WHERE code = ? AND active = 1', [code.toUpperCase().trim()]);
        if (coupons.length === 0) {
            return res.status(404).json({ message: 'Cupón inválido o inactivo' });
        }
        const coupon = coupons[0];
        // Verificar si ya fue utilizado (si es de un solo uso personal)
        if (coupon.is_used === 1) {
            return res.status(400).json({ message: 'Este cupón de descuento ya ha sido utilizado' });
        }
        // Verificar si es personal e intransferible
        if (coupon.user_id !== null) {
            if (!userId || Number(userId) !== Number(coupon.user_id)) {
                return res.status(403).json({ message: 'Este cupón es personal e intransferible para otro cliente' });
            }
        }
        else {
            // Si es público/general, verificar si este usuario ya lo usó en una compra previa
            if (userId) {
                const [alreadyUsed] = await db_1.default.query('SELECT id FROM sales WHERE user_id = ? AND coupon_code = ? AND status != "cancelled"', [userId, code.toUpperCase().trim()]);
                if (alreadyUsed.length > 0) {
                    return res.status(400).json({ message: 'Ya has utilizado este cupón en una compra anterior' });
                }
            }
        }
        res.json(coupon);
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
    const { code, discountPercent, userId } = req.body;
    if (!code || !discountPercent) {
        return res.status(400).json({ message: 'Código y porcentaje de descuento son obligatorios' });
    }
    try {
        await db_1.default.query('INSERT INTO coupons (code, discount_percent, user_id) VALUES (?, ?, ?)', [
            code.toUpperCase().trim(),
            discountPercent,
            userId || null
        ]);
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
// Editar cupón de descuento (Solo Admin)
router.put('/coupons/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { id } = req.params;
    const { code, discountPercent, active, userId } = req.body;
    try {
        const [coupons] = await db_1.default.query('SELECT * FROM coupons WHERE id = ?', [id]);
        if (coupons.length === 0) {
            return res.status(404).json({ message: 'Cupón no encontrado' });
        }
        const currentCoupon = coupons[0];
        const newCode = code !== undefined ? code.toUpperCase().trim() : currentCoupon.code;
        const newDiscount = discountPercent !== undefined ? discountPercent : currentCoupon.discount_percent;
        const newActive = active !== undefined ? active : currentCoupon.active;
        const newUserId = userId !== undefined ? (userId || null) : currentCoupon.user_id;
        await db_1.default.query('UPDATE coupons SET code = ?, discount_percent = ?, active = ?, user_id = ? WHERE id = ?', [newCode, newDiscount, newActive, newUserId, id]);
        res.json({ message: 'Cupón actualizado con éxito' });
    }
    catch (error) {
        console.error('Error al editar cupón:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Ya existe otro cupón con ese código' });
        }
        res.status(500).json({ message: 'Error al actualizar cupón' });
    }
});
// Eliminar cupón de descuento (Solo Admin)
router.delete('/coupons/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { id } = req.params;
    try {
        const [result] = await db_1.default.query('DELETE FROM coupons WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Cupón no encontrado' });
        }
        res.json({ message: 'Cupón eliminado con éxito' });
    }
    catch (error) {
        console.error('Error al eliminar cupón:', error);
        res.status(500).json({ message: 'Error al eliminar cupón' });
    }
});
// Obtener historial completo del sistema y registros de auditoría (Solo Admin)
router.get('/audit-logs', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [logs] = await db_1.default.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
        const [sales] = await db_1.default.query(`SELECT s.*, u.name as registered_by, seller.name as seller_name 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       LEFT JOIN users seller ON s.seller_id = seller.id
       ORDER BY s.created_at DESC`);
        res.json({ logs, sales });
    }
    catch (error) {
        console.error('Error al obtener registros de auditoría:', error);
        res.status(500).json({ message: 'Error al obtener histórico de auditoría' });
    }
});
// Historial de Todas las Ventas (Solo Admin)
router.get('/', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [sales] = await db_1.default.query(`SELECT s.*, u.name as registered_by, seller.name as seller_name 
       FROM sales s 
       LEFT JOIN users u ON s.user_id = u.id 
       LEFT JOIN users seller ON s.seller_id = seller.id
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
    let text = `*📄 COMPROBANTE - FACILITOAPP #${sale.id}* 🐒\n`;
    text += `-------------------------------------\n`;
    text += `*Cliente:* ${sale.customer_name}\n`;
    text += `*Fecha:* ${dateStr}\n`;
    text += `*Metodo de Pago:* ${sale.payment_method.toUpperCase()}\n`;
    text += `*Tipo:* ${sale.type.toUpperCase()}\n`;
    if (sale.seller_name) {
        text += `*Vendedor:* ${sale.seller_name}\n`;
    }
    text += `-------------------------------------\n`;
    text += `*Detalle de Productos:*\n`;
    items.forEach(item => {
        const itemTotal = (Number(item.price) * item.quantity).toFixed(2);
        text += `- ${item.name} x${item.quantity} ($${Number(item.price).toFixed(2)}) = *$${itemTotal}*\n`;
    });
    text += `-------------------------------------\n`;
    text += `*TOTAL NETO:* *$${Number(sale.total).toFixed(2)}*\n\n`;
    text += `¡Gracias por elegir FacilitoApp! 🐒 Si tienes dudas contáctanos.`;
    return text;
}
// Reenviar factura por correo
router.post('/:id/resend-email', auth_1.authenticate, async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    try {
        const [sales] = await db_1.default.query(`SELECT s.*, seller.name as seller_name 
       FROM sales s 
       LEFT JOIN users seller ON s.seller_id = seller.id 
       WHERE s.id = ?`, [id]);
        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }
        const sale = sales[0];
        // Verificar seguridad: solo el propio cliente, vendedor o admin puede ver/reenviar la factura
        if (req.user?.role !== 'admin' && req.user?.role !== 'seller' && sale.user_id !== req.user?.id) {
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
        res.status(500).json({ message: `Error al reenviar la factura por correo: ${error.message}` });
    }
});
// Obtener configuraciones de recordatorios de deudores (Solo Admin)
router.get('/settings/reminders', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [rows] = await db_1.default.query('SELECT * FROM settings WHERE settings_key IN (?, ?)', [
            'debtor_reminder_frequency_days',
            'debtor_reminder_email_template'
        ]);
        const frequency = rows.find((r) => r.settings_key === 'debtor_reminder_frequency_days')?.settings_value || '7';
        const template = rows.find((r) => r.settings_key === 'debtor_reminder_email_template')?.settings_value || '';
        res.json({
            frequencyDays: parseInt(frequency),
            emailTemplate: template
        });
    }
    catch (error) {
        console.error('Error al obtener configuraciones:', error);
        res.status(500).json({ message: 'Error al obtener configuraciones de recordatorios' });
    }
});
// Guardar configuraciones de recordatorios de deudores (Solo Admin)
router.put('/settings/reminders', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { frequencyDays, emailTemplate } = req.body;
    if (frequencyDays === undefined || !emailTemplate) {
        return res.status(400).json({ message: 'Por favor complete todos los datos' });
    }
    try {
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['debtor_reminder_frequency_days', frequencyDays.toString(), frequencyDays.toString()]);
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['debtor_reminder_email_template', emailTemplate, emailTemplate]);
        res.json({ message: 'Configuraciones de recordatorios guardadas con éxito' });
    }
    catch (error) {
        console.error('Error al guardar configuraciones:', error);
        res.status(500).json({ message: 'Error al guardar configuraciones de recordatorios' });
    }
});
// Enviar recordatorio manual por correo (Solo Admin)
router.post('/:id/remind', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { id } = req.params;
    try {
        const [sales] = await db_1.default.query('SELECT * FROM sales WHERE id = ?', [id]);
        if (sales.length === 0) {
            return res.status(404).json({ message: 'Factura no encontrada' });
        }
        const sale = sales[0];
        if (sale.status !== 'pending') {
            return res.status(400).json({ message: 'Esta factura ya está cobrada o cancelada' });
        }
        if (!sale.customer_email) {
            return res.status(400).json({ message: 'El cliente no tiene correo electrónico registrado para enviar el recordatorio' });
        }
        // Obtener la plantilla de correo
        const [templateRows] = await db_1.default.query("SELECT settings_value FROM settings WHERE settings_key = 'debtor_reminder_email_template'");
        const templateText = templateRows.length > 0 ? templateRows[0].settings_value : 'Hola {customerName}, tienes un saldo pendiente de ${amountPending} de tu factura #{saleId}.';
        const pendingAmount = Number(sale.total) - Number(sale.amount_paid || 0);
        // Formatear mensaje
        const emailBody = templateText
            .replace(/{customerName}/g, sale.customer_name || 'Cliente')
            .replace(/\${amountPending}/g, pendingAmount.toFixed(2))
            .replace(/{saleId}/g, sale.id.toString());
        await (0, email_1.sendPlainEmail)(sale.customer_email, `Recordatorio de Pago Pendiente - Factura #${sale.id}`, emailBody);
        // Actualizar last_reminder_sent_at
        await db_1.default.query('UPDATE sales SET last_reminder_sent_at = NOW() WHERE id = ?', [id]);
        res.json({ message: 'Correo recordatorio enviado con éxito al deudor' });
    }
    catch (error) {
        console.error('Error al enviar recordatorio manual:', error);
        res.status(500).json({ message: 'Error al enviar recordatorio por correo' });
    }
});
// Obtener tasas históricas por fecha (Público / Admin)
router.get('/settings/rates/historical', async (req, res) => {
    const dateStr = req.query.date; // YYYY-MM-DD
    try {
        let usdRate = 0;
        let binanceRate = 0;
        // 1. Obtener tasa actual en base de datos
        const [rows] = await db_1.default.query('SELECT * FROM settings WHERE settings_key IN (?, ?)', [
            'usd_to_ves_rate',
            'binance_usd_to_ves_rate'
        ]);
        const currentUsd = rows.find((r) => r.settings_key === 'usd_to_ves_rate')?.settings_value || '40.00';
        const currentBinance = rows.find((r) => r.settings_key === 'binance_usd_to_ves_rate')?.settings_value || '44.50';
        const baseUsd = parseFloat(currentUsd);
        const baseBinance = parseFloat(currentBinance);
        if (dateStr) {
            // Intentar consultar API externa
            try {
                const resH = await fetch(`https://ve.dolarapi.com/v1/dolares`);
                if (resH.ok) {
                    const data = await resH.json();
                    const usdItem = data.find((item) => item.fuente === 'oficial');
                    const paraItem = data.find((item) => item.fuente === 'paralelo' || item.fuente === 'binance');
                    if (usdItem?.promedio)
                        usdRate = parseFloat(usdItem.promedio);
                    if (paraItem?.promedio)
                        binanceRate = parseFloat(paraItem.promedio);
                }
            }
            catch (e) {
                console.warn('[RATES] DolarApi warning:', e.message);
            }
            // Si la fecha es pasada, aplicar ajuste de depreciación diaria (0.25% por día) para reflejar la tasa histórica de ese día
            const targetDate = new Date(dateStr);
            const today = new Date();
            targetDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);
            const diffTime = today.getTime() - targetDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
            if (diffDays > 0) {
                // Tasa estimada histórica en esa fecha
                const factor = Math.max(0.4, 1 - (diffDays * 0.0035));
                usdRate = baseUsd * factor;
                binanceRate = baseBinance * factor;
            }
            else {
                if (!usdRate || usdRate <= 0)
                    usdRate = baseUsd;
                if (!binanceRate || binanceRate <= 0)
                    binanceRate = baseBinance;
            }
        }
        else {
            usdRate = baseUsd;
            binanceRate = baseBinance;
        }
        res.json({
            date: dateStr,
            usdToVes: parseFloat(usdRate.toFixed(2)),
            binanceUsdToVes: parseFloat(binanceRate.toFixed(2))
        });
    }
    catch (error) {
        console.error('Error al obtener tasas históricas:', error);
        res.status(500).json({ message: 'Error al obtener tasas históricas', error: error.message });
    }
});
// Obtener tasas de cambio (Público)
router.get('/settings/rates', async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT * FROM settings WHERE settings_key IN (?, ?, ?)', [
            'usd_to_ves_rate',
            'eur_to_ves_rate',
            'binance_usd_to_ves_rate'
        ]);
        const usdRate = rows.find((r) => r.settings_key === 'usd_to_ves_rate')?.settings_value || '40.00';
        const eurRate = rows.find((r) => r.settings_key === 'eur_to_ves_rate')?.settings_value || '43.50';
        const binanceRate = rows.find((r) => r.settings_key === 'binance_usd_to_ves_rate')?.settings_value || '44.50';
        res.json({
            usdToVes: parseFloat(usdRate),
            eurToVes: parseFloat(eurRate),
            binanceUsdToVes: parseFloat(binanceRate)
        });
    }
    catch (error) {
        console.error('Error al obtener tasas de cambio:', error);
        res.status(500).json({ message: 'Error al obtener tasas de cambio' });
    }
});
// Guardar tasas de cambio (Solo Admin)
router.put('/settings/rates', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { usdToVes, eurToVes, binanceUsdToVes } = req.body;
    if (usdToVes === undefined || eurToVes === undefined) {
        return res.status(400).json({ message: 'Por favor complete todos los datos' });
    }
    try {
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['usd_to_ves_rate', usdToVes.toString(), usdToVes.toString()]);
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['eur_to_ves_rate', eurToVes.toString(), eurToVes.toString()]);
        if (binanceUsdToVes !== undefined) {
            await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['binance_usd_to_ves_rate', binanceUsdToVes.toString(), binanceUsdToVes.toString()]);
        }
        res.json({ message: 'Tasas de cambio actualizadas con éxito' });
    }
    catch (error) {
        console.error('Error al guardar tasas de cambio:', error);
        res.status(500).json({ message: 'Error al guardar tasas de cambio' });
    }
});
// Sincronizar tasas de cambio manualmente con el BCV (Solo Admin)
router.post('/settings/rates/sync', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const rates = await (0, rates_1.syncExchangeRatesFromBCV)();
        res.json({
            message: 'Tasas de cambio sincronizadas con éxito desde el BCV',
            rates
        });
    }
    catch (error) {
        console.error('Error al sincronizar tasas manualmente:', error);
        res.status(500).json({ message: 'Error al sincronizar tasas de cambio con el BCV', error: error.message });
    }
});
// GET /sales/coupons/all: Obtener lista de cupones
router.get('/coupons/all', auth_1.authenticate, async (req, res) => {
    try {
        const [coupons] = await db_1.default.query(`SELECT c.*, u.name AS user_name 
       FROM coupons c 
       LEFT JOIN users u ON c.user_id = u.id 
       ORDER BY c.created_at DESC`);
        res.json(coupons);
    }
    catch (error) {
        console.error('Error al obtener cupones:', error);
        res.status(500).json({ message: 'Error al obtener cupones' });
    }
});
// POST /sales/coupons: Crear un nuevo cupón
router.post('/coupons', auth_1.authenticate, async (req, res) => {
    const { code, discountPercent, userId } = req.body;
    if (!code || !discountPercent) {
        return res.status(400).json({ message: 'Código y porcentaje de descuento son obligatorios' });
    }
    try {
        const cleanCode = code.toUpperCase().trim();
        await db_1.default.query('INSERT INTO coupons (code, discount_percent, user_id, active, is_used) VALUES (?, ?, ?, 1, 0)', [cleanCode, discountPercent, userId || null]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'coupon_crud',
            title: `Nuevo Cupón Creado: ${cleanCode}`,
            details: `Descuento: ${discountPercent}%, Destinatario ID: ${userId || 'General / Todos'}`
        });
        res.status(201).json({ message: 'Cupón creado con éxito' });
    }
    catch (error) {
        console.error('Error al crear cupón:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Ya existe un cupón con ese código' });
        }
        res.status(500).json({ message: 'Error al crear cupón en la base de datos' });
    }
});
// PUT /sales/coupons/:id: Actualizar cupón
router.put('/coupons/:id', auth_1.authenticate, async (req, res) => {
    const id = req.params.id;
    const { discount_percent, active, is_used } = req.body;
    try {
        await db_1.default.query('UPDATE coupons SET discount_percent = COALESCE(?, discount_percent), active = COALESCE(?, active), is_used = COALESCE(?, is_used) WHERE id = ?', [discount_percent, active, is_used, id]);
        res.json({ message: 'Cupón actualizado con éxito' });
    }
    catch (error) {
        console.error('Error al actualizar cupón:', error);
        res.status(500).json({ message: 'Error al actualizar cupón' });
    }
});
// DELETE /sales/coupons/:id: Eliminar cupón
router.delete('/coupons/:id', auth_1.authenticate, async (req, res) => {
    const id = req.params.id;
    try {
        await db_1.default.query('DELETE FROM coupons WHERE id = ?', [id]);
        res.json({ message: 'Cupón eliminado con éxito' });
    }
    catch (error) {
        console.error('Error al eliminar cupón:', error);
        res.status(500).json({ message: 'Error al eliminar cupón' });
    }
});
exports.default = router;
