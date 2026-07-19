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
const router = (0, express_1.Router)();
// Configuración de almacenamiento para Multer (Imágenes Locales)
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.join(__dirname, '../../uploads')); // backend/uploads
    },
    filename: (req, file, cb) => {
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
// Crear producto (Solo Admin)
router.post('/', auth_1.authenticate, auth_1.isAdmin, async (req, res) => {
    const { code, name, description, price, stock, image_url, category } = req.body;
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
    }
    try {
        // Validar código duplicado si se proporciona
        if (code) {
            const [existing] = await db_1.default.query('SELECT id FROM products WHERE code = ?', [code]);
            if (existing.length > 0) {
                return res.status(400).json({ message: `El código "${code}" ya está registrado por otro producto` });
            }
        }
        const [result] = await db_1.default.query('INSERT INTO products (code, name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)', [code || null, name, description || null, price, stock, image_url || null, category || null]);
        res.status(201).json({
            id: result.insertId,
            code,
            name,
            description,
            price,
            stock,
            image_url,
            category
        });
    }
    catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ message: 'Error al crear el producto' });
    }
});
// Actualizar producto (Solo Admin)
router.put('/:id', auth_1.authenticate, auth_1.isAdmin, async (req, res) => {
    const { id } = req.params;
    const { code, name, description, price, stock, image_url, category } = req.body;
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
    }
    try {
        // Validar código duplicado si se proporciona y no es del mismo producto
        if (code) {
            const [existing] = await db_1.default.query('SELECT id FROM products WHERE code = ? AND id != ?', [code, id]);
            if (existing.length > 0) {
                return res.status(400).json({ message: `El código "${code}" ya está registrado por otro producto` });
            }
        }
        const [result] = await db_1.default.query('UPDATE products SET code = ?, name = ?, description = ?, price = ?, stock = ?, image_url = ?, category = ? WHERE id = ?', [code || null, name, description || null, price, stock, image_url || null, category || null, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        res.json({
            id: parseInt(id),
            code,
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
        res.status(500).json({ message: 'Error al actualizar el producto' });
    }
});
// Eliminar producto (Solo Admin)
router.delete('/:id', auth_1.authenticate, auth_1.isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db_1.default.query('DELETE FROM products WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        res.json({ message: 'Producto eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ message: 'Error al eliminar el producto' });
    }
});
exports.default = router;
