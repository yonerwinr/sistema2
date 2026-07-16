"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
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
                conditions.push(' (name LIKE ? OR description LIKE ?)');
                params.push(`%${search}%`, `%${search}%`);
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
    const { name, description, price, stock, image_url, category } = req.body;
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
    }
    try {
        const [result] = await db_1.default.query('INSERT INTO products (name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?)', [name, description || null, price, stock, image_url || null, category || null]);
        res.status(201).json({
            id: result.insertId,
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
    const { name, description, price, stock, image_url, category } = req.body;
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ message: 'Nombre, precio e inventario son obligatorios' });
    }
    try {
        const [result] = await db_1.default.query('UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image_url = ?, category = ? WHERE id = ?', [name, description || null, price, stock, image_url || null, category || null, id]);
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
