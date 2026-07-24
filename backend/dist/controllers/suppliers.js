"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const audit_1 = require("../services/audit");
const router = (0, express_1.Router)();
// Middleware de permisos: Admin o Seller pueden manejar proveedores
const canManageSuppliers = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'No autorizado, token no provisto' });
    }
    if (req.user.role === 'admin' || req.user.role === 'seller') {
        return next();
    }
    return res.status(403).json({ message: 'Acceso denegado, se requieren privilegios de administracion o vendedor' });
};
// Obtener todos los proveedores
router.get('/', auth_1.authenticate, canManageSuppliers, async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT * FROM suppliers ORDER BY id DESC');
        res.json(rows);
    }
    catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ message: error.message || 'Error al obtener proveedores' });
    }
});
// Obtener un proveedor por ID
router.get('/:id', auth_1.authenticate, canManageSuppliers, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db_1.default.query('SELECT * FROM suppliers WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Proveedor no encontrado' });
        }
        res.json(rows[0]);
    }
    catch (error) {
        console.error('Error al obtener proveedor:', error);
        res.status(500).json({ message: error.message || 'Error al obtener proveedor' });
    }
});
// Crear un proveedor
router.post('/', auth_1.authenticate, canManageSuppliers, async (req, res) => {
    const { name, contact_name, email, phone, address, rif } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'El nombre del proveedor es obligatorio' });
    }
    const cleanRif = (rif && typeof rif === 'string' && rif.trim()) ? rif.trim() : null;
    try {
        // Validar RIF duplicado si viene informado
        if (cleanRif) {
            const [existing] = await db_1.default.query('SELECT id FROM suppliers WHERE rif = ?', [cleanRif]);
            if (existing.length > 0) {
                return res.status(400).json({ message: `El RIF/Identificacion "${cleanRif}" ya esta registrado por otro proveedor` });
            }
        }
        const [result] = await db_1.default.query('INSERT INTO suppliers (name, contact_name, email, phone, address, rif) VALUES (?, ?, ?, ?, ?, ?)', [name, contact_name || null, email || null, phone || null, address || null, cleanRif]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'supplier_crud',
            title: `Nuevo Proveedor Creado: ${name}`,
            details: `RIF: ${cleanRif || 'N/A'}, Contacto: ${contact_name || 'N/A'}, Tel: ${phone || 'N/A'}`
        });
        res.status(201).json({
            id: result.insertId,
            name,
            contact_name,
            email,
            phone,
            address,
            rif: cleanRif
        });
    }
    catch (error) {
        console.error('Error al crear proveedor:', error);
        res.status(500).json({ message: error.message || 'Error al crear proveedor' });
    }
});
// Editar un proveedor
router.put('/:id', auth_1.authenticate, canManageSuppliers, async (req, res) => {
    const { id } = req.params;
    const { name, contact_name, email, phone, address, rif } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'El nombre del proveedor es obligatorio' });
    }
    const cleanRif = (rif && typeof rif === 'string' && rif.trim()) ? rif.trim() : null;
    try {
        // Validar RIF duplicado de otro proveedor
        if (cleanRif) {
            const [existing] = await db_1.default.query('SELECT id FROM suppliers WHERE rif = ? AND id != ?', [cleanRif, id]);
            if (existing.length > 0) {
                return res.status(400).json({ message: `El RIF/Identificacion "${cleanRif}" ya esta registrado por otro proveedor` });
            }
        }
        const [result] = await db_1.default.query('UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ?, address = ?, rif = ? WHERE id = ?', [name, contact_name || null, email || null, phone || null, address || null, cleanRif, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Proveedor no encontrado' });
        }
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'supplier_crud',
            title: `Proveedor Actualizado (ID #${id}): ${name}`,
            details: `Nuevo RIF: ${cleanRif || 'N/A'}, Contacto: ${contact_name || 'N/A'}`
        });
        res.json({
            id: parseInt(id),
            name,
            contact_name,
            email,
            phone,
            address,
            rif: cleanRif
        });
    }
    catch (error) {
        console.error('Error al actualizar proveedor:', error);
        res.status(500).json({ message: error.message || 'Error al actualizar proveedor' });
    }
});
// Eliminar un proveedor
router.delete('/:id', auth_1.authenticate, canManageSuppliers, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db_1.default.query('DELETE FROM suppliers WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Proveedor no encontrado' });
        }
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'supplier_crud',
            title: `Proveedor Eliminado (ID #${id})`,
            details: `Eliminado por ${req.user?.name}`
        });
        res.json({ message: 'Proveedor eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar proveedor:', error);
        res.status(500).json({ message: error.message || 'Error al eliminar proveedor' });
    }
});
exports.default = router;
