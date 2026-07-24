"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const audit_1 = require("../services/audit");
const router = (0, express_1.Router)();
const canManageProducts = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'No autorizado, token no provisto' });
    }
    if (req.user.role === 'admin' || req.user.role === 'seller') {
        return next();
    }
    return res.status(403).json({ message: 'Acceso denegado, se requieren privilegios de administración o vendedor' });
};
// Configuración de almacenamiento para Multer (Imágenes Locales)
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path_1.default.join(__dirname, '../../uploads')); // backend/uploads
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({ storage });
// Subida de imagen local (Solo Admin)
router.post('/upload', auth_1.authenticate, auth_1.isAdmin, upload.single('image'), (req, res) => {
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
        const params = [];
        if (category || search) {
            query += ' WHERE';
            const conditions = [];
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
        const [products] = await db_1.default.query(query, params);
        res.json(products);
    }
    catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ message: 'Error al obtener los productos' });
    }
});
// Obtener el siguiente correlativo y SKU sugerido CC-SSS-NNNN (Admin o Vendedor)
router.get('/next-sku', auth_1.authenticate, canManageProducts, async (req, res) => {
    const { category, brand } = req.query;
    try {
        const [rows] = await db_1.default.query('SELECT COUNT(*) as total, MAX(id) as maxId FROM products');
        const nextSeq = ((rows[0]?.maxId || 0) + 1);
        // Mapeo de categoría (CC: 2 dígitos)
        const catStr = (category || 'General').trim();
        let cc = '10';
        if (catStr.match(/laptop|computad/i))
            cc = '10';
        else if (catStr.match(/phone|celular|smartphone|móvil|movil/i))
            cc = '20';
        else if (catStr.match(/accesor|cable|cargador|funda/i))
            cc = '30';
        else if (catStr.match(/tablet|ipad/i))
            cc = '40';
        else if (catStr.match(/audio|corneta|audífono|audifono|sonido/i))
            cc = '50';
        else if (catStr.match(/tv|televis|pantalla|monitor/i))
            cc = '60';
        else {
            let hash = 0;
            for (let i = 0; i < catStr.length; i++)
                hash = (hash << 5) - hash + catStr.charCodeAt(i);
            cc = Math.abs((hash % 80) + 10).toString().padStart(2, '0');
        }
        // Mapeo de marca / subcategoría (SSS: 3 dígitos)
        const brandStr = (brand || 'General').trim();
        let sss = '100';
        if (brandStr.match(/apple|macbook|iphone|ipad/i))
            sss = '101';
        else if (brandStr.match(/samsung/i))
            sss = '102';
        else if (brandStr.match(/xiaomi|redmi|poco/i))
            sss = '103';
        else if (brandStr.match(/sony/i))
            sss = '104';
        else if (brandStr.match(/lg/i))
            sss = '105';
        else if (brandStr.match(/hp|dell|lenovo|asus|acer/i))
            sss = '106';
        else {
            let hash = 0;
            for (let i = 0; i < brandStr.length; i++)
                hash = (hash << 5) - hash + brandStr.charCodeAt(i);
            sss = Math.abs((hash % 800) + 100).toString().padStart(3, '0');
        }
        const nnnn = nextSeq.toString().padStart(4, '0');
        const sku = `${cc}-${sss}-${nnnn}`;
        res.json({ sku, seq: nextSeq, cc, sss, nnnn });
    }
    catch (error) {
        console.error('Error al generar siguiente SKU:', error);
        res.status(500).json({ message: 'Error al generar SKU' });
    }
});
// Obtener un producto por ID (Público)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [products] = await db_1.default.query('SELECT * FROM products WHERE id = ?', [id]);
        if (products.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        res.json(products[0]);
    }
    catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ message: 'Error al obtener el producto' });
    }
});
// Crear producto (Admin o Vendedor)
router.post('/', auth_1.authenticate, canManageProducts, async (req, res) => {
    const { code, name, description, price, stock, image_url, category } = req.body;
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
    }
    const cleanCode = (code && typeof code === 'string' && code.trim()) ? code.trim() : null;
    const cleanPrice = Math.round((parseFloat(price) + Number.EPSILON) * 10000) / 10000;
    try {
        // Validar código duplicado si se proporciona
        if (cleanCode) {
            const [existing] = await db_1.default.query('SELECT id FROM products WHERE code = ?', [cleanCode]);
            if (existing.length > 0) {
                return res.status(400).json({ message: `El código "${cleanCode}" ya está registrado por otro producto` });
            }
        }
        const [result] = await db_1.default.query('INSERT INTO products (code, name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)', [cleanCode, name, description || null, cleanPrice, stock, image_url || null, category || null]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'product_crud',
            title: `Nuevo Producto Creado: ${name}`,
            details: `Precio: $${cleanPrice}, Stock: ${stock}, Categoría: ${category || 'General'}`
        });
        res.status(201).json({
            id: result.insertId,
            code: cleanCode,
            name,
            description,
            price: cleanPrice,
            stock,
            image_url,
            category
        });
    }
    catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ message: error.message || 'Error al crear el producto' });
    }
});
// Actualizar producto (Admin o Vendedor)
router.put('/:id', auth_1.authenticate, canManageProducts, async (req, res) => {
    const { id } = req.params;
    const { code, name, description, price, stock, image_url, category } = req.body;
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
    }
    const cleanCode = (code && typeof code === 'string' && code.trim()) ? code.trim() : null;
    const cleanPrice = Math.round((parseFloat(price) + Number.EPSILON) * 10000) / 10000;
    try {
        // Validar código duplicado si se proporciona y no es del mismo producto
        if (cleanCode) {
            const [existing] = await db_1.default.query('SELECT id FROM products WHERE code = ? AND id != ?', [cleanCode, id]);
            if (existing.length > 0) {
                return res.status(400).json({ message: `El código "${cleanCode}" ya está registrado por otro producto` });
            }
        }
        const [result] = await db_1.default.query('UPDATE products SET code = ?, name = ?, description = ?, price = ?, stock = ?, image_url = ?, category = ? WHERE id = ?', [cleanCode, name, description || null, cleanPrice, stock, image_url || null, category || null, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'product_crud',
            title: `Producto Actualizado (ID #${id}): ${name}`,
            details: `Nuevo precio: $${cleanPrice}, Nuevo stock: ${stock}, Categoría: ${category || 'General'}`
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
    }
    catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ message: error.message || 'Error al actualizar el producto' });
    }
});
// Eliminar producto (Admin o Vendedor)
router.delete('/:id', auth_1.authenticate, canManageProducts, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db_1.default.query('DELETE FROM products WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'product_crud',
            title: `Producto Eliminado (ID #${id})`,
            details: `Eliminado por ${req.user?.name}`
        });
        res.json({ message: 'Producto eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ message: error.message || 'Error al eliminar el producto' });
    }
});
exports.default = router;
