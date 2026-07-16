"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreta_pos_online_token_key_987654321';
// Registro de Usuario (Clientes)
router.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Nombre, correo y contrasena son obligatorios' });
    }
    try {
        // Verificar si el usuario ya existe
        const [existing] = await db_1.default.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El correo electronico ya esta registrado' });
        }
        // Encriptar contrasena
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        // Insertar usuario
        const [result] = await db_1.default.query('INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)', [name, email, hashedPassword, 'customer', phone || null]);
        const userId = result.insertId;
        // Generar token JWT
        const token = jsonwebtoken_1.default.sign({ id: userId, email, role: 'customer', name }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            token,
            user: { id: userId, name, email, role: 'customer', phone }
        });
    }
    catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor en el registro' });
    }
});
// Inicio de Sesion (General y Administradores)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Correo y contrasena son obligatorios' });
    }
    try {
        // Buscar usuario en base de datos
        const [users] = await db_1.default.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Credenciales invalidas' });
        }
        const user = users[0];
        // Verificar contraseña
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciales invalidas' });
        }
        // Generar token JWT
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone
            }
        });
    }
    catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor en el login' });
    }
});
// Obtener datos del usuario logueado
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'No autenticado' });
        const [users] = await db_1.default.query('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json(users[0]);
    }
    catch (error) {
        console.error('Error en /me:', error);
        res.status(500).json({ message: 'Error al obtener datos del usuario' });
    }
});
exports.default = router;
