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
const email_1 = require("../services/email");
const audit_1 = require("../services/audit");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreta_pos_online_token_key_987654321';
// Registro de Usuario (Clientes)
router.post('/register', async (req, res) => {
    const { name, email, password, phone, ci } = req.body;
    if (!name || !email || !password || !ci) {
        return res.status(400).json({ message: 'Nombre, correo, contraseña y cédula son obligatorios' });
    }
    // Validar formato de cédula V-12345678 o E-12345678
    const ciPattern = /^[VE]-\d{5,10}$/;
    if (!ciPattern.test(ci)) {
        return res.status(400).json({ message: 'Formato de cédula inválido. Debe comenzar con V- o E- seguido de 5 a 10 dígitos numéricos (ej: V-12345678)' });
    }
    try {
        // Verificar si el usuario ya existe por correo
        const [existing] = await db_1.default.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }
        // Verificar si la cédula ya existe
        const [existingCI] = await db_1.default.query('SELECT id FROM users WHERE ci = ?', [ci]);
        if (existingCI.length > 0) {
            return res.status(400).json({ message: 'La cédula de identidad ya está registrada por otro usuario' });
        }
        // Encriptar contraseña
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        // Insertar usuario
        const [result] = await db_1.default.query('INSERT INTO users (name, email, password, role, phone, ci) VALUES (?, ?, ?, ?, ?, ?)', [name, email, hashedPassword, 'customer', phone || null, ci]);
        const userId = result.insertId;
        // Generar token JWT
        const token = jsonwebtoken_1.default.sign({ id: userId, email, role: 'customer', name }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            token,
            user: { id: userId, name, email, role: 'customer', phone, ci }
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
// Autenticación con Google (Login / Registro integrado)
router.post('/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential) {
        return res.status(400).json({ message: 'La credencial de Google es obligatoria' });
    }
    try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (!googleRes.ok) {
            return res.status(400).json({ message: 'Token de Google inválido o expirado' });
        }
        const payload = await googleRes.json();
        const { email, name, email_verified, aud } = payload;
        if (!email_verified) {
            return res.status(400).json({ message: 'El correo electrónico de Google no está verificado' });
        }
        // Validar GOOGLE_CLIENT_ID si está configurado en .env
        const expectedClientId = process.env.GOOGLE_CLIENT_ID;
        if (expectedClientId && aud !== expectedClientId) {
            return res.status(400).json({ message: 'El cliente de Google no coincide con el configurado' });
        }
        // Buscar si el usuario ya existe por correo
        const [users] = await db_1.default.query('SELECT * FROM users WHERE email = ?', [email]);
        let user;
        if (users.length > 0) {
            user = users[0];
        }
        else {
            // Registrar un nuevo cliente desde Google
            const [result] = await db_1.default.query('INSERT INTO users (name, email, password, role, phone, ci) VALUES (?, ?, NULL, ?, NULL, NULL)', [name, email, 'customer']);
            const userId = result.insertId;
            const [newUsers] = await db_1.default.query('SELECT * FROM users WHERE id = ?', [userId]);
            user = newUsers[0];
        }
        // Generar token JWT del sistema
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                ci: user.ci
            }
        });
    }
    catch (error) {
        console.error('Error en login de Google:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la autenticación de Google' });
    }
});
// Obtener datos del usuario logueado
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'No autenticado' });
        const [users] = await db_1.default.query('SELECT id, name, email, role, phone, ci, permissions, created_at FROM users WHERE id = ?', [req.user.id]);
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
router.get('/customers', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
        return res.status(403).json({ message: 'No autorizado. Solo administradores y vendedores pueden ver la lista de clientes' });
    }
    try {
        const [customers] = await db_1.default.query('SELECT id, name, email, phone, ci FROM users WHERE role = "customer" ORDER BY name ASC');
        res.json(customers);
    }
    catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ message: 'Error al obtener lista de clientes' });
    }
});
// Buscar cliente por cédula (POS Step-1)
router.get('/customer-by-ci', auth_1.authenticate, async (req, res) => {
    const { ci } = req.query;
    if (!ci) {
        return res.status(400).json({ message: 'La cédula es requerida' });
    }
    try {
        const [users] = await db_1.default.query('SELECT id, name, email, phone, ci, role, permissions FROM users WHERE ci = ? LIMIT 1', [ci]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        res.json(users[0]);
    }
    catch (error) {
        console.error('Error buscando cliente por cédula:', error);
        res.status(500).json({ message: 'Error interno al buscar cliente' });
    }
});
// Obtener todos los administradores y vendedores (Solo Admin o Personal con permiso)
router.get('/staff', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const [staff] = await db_1.default.query('SELECT id, name, email, role, phone, ci, permissions FROM users WHERE role IN ("admin", "seller") ORDER BY name ASC');
        res.json(staff);
    }
    catch (error) {
        console.error('Error al obtener personal:', error);
        res.status(500).json({ message: 'Error al obtener lista de personal' });
    }
});
// Crear un administrador o vendedor (Solo Admin)
router.post('/staff', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { name, email, password, role, phone, ci, permissions } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Nombre, correo, contraseña y rol son obligatorios' });
    }
    if (!['admin', 'seller'].includes(role)) {
        return res.status(400).json({ message: 'Rol inválido. Debe ser admin o seller' });
    }
    try {
        // Verificar si el correo ya existe
        const [existing] = await db_1.default.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const permissionsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : (permissions || null);
        await db_1.default.query('INSERT INTO users (name, email, password, role, phone, ci, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)', [name, email, hashedPassword, role, phone || null, ci || null, permissionsStr]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'staff_crud',
            title: `Nuevo Vendedor / Personal Creado: ${name}`,
            details: `Correo: ${email}, Rol: ${role}, Cédula: ${ci || 'N/D'}, Permisos: ${permissionsStr || 'Por defecto'}`
        });
        res.status(201).json({ message: 'Usuario de personal creado con éxito' });
    }
    catch (error) {
        console.error('Error al crear personal:', error);
        res.status(500).json({ message: 'Error al registrar usuario en la base de datos' });
    }
});
// Modificar un administrador o vendedor (Solo Admin)
router.put('/staff/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { id } = req.params;
    const { name, email, password, role, phone, ci, permissions } = req.body;
    if (!name || !email || !role) {
        return res.status(400).json({ message: 'Nombre, correo y rol son obligatorios' });
    }
    if (!['admin', 'seller'].includes(role)) {
        return res.status(400).json({ message: 'Rol inválido' });
    }
    try {
        // Verificar si el correo ya existe para otro usuario
        const [existing] = await db_1.default.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está en uso por otro usuario' });
        }
        const permissionsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : (permissions || null);
        if (password) {
            const salt = await bcryptjs_1.default.genSalt(10);
            const hashedPassword = await bcryptjs_1.default.hash(password, salt);
            await db_1.default.query('UPDATE users SET name = ?, email = ?, password = ?, role = ?, phone = ?, ci = ?, permissions = ? WHERE id = ?', [name, email, hashedPassword, role, phone || null, ci || null, permissionsStr, id]);
        }
        else {
            await db_1.default.query('UPDATE users SET name = ?, email = ?, role = ?, phone = ?, ci = ?, permissions = ? WHERE id = ?', [name, email, role, phone || null, ci || null, permissionsStr, id]);
        }
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'staff_crud',
            title: `Personal Actualizado (ID #${id}): ${name}`,
            details: `Correo: ${email}, Rol: ${role}, Cédula: ${ci || 'N/D'}, Permisos: ${permissionsStr || 'Por defecto'}`
        });
        res.json({ message: 'Usuario de personal actualizado con éxito' });
    }
    catch (error) {
        console.error('Error al actualizar personal:', error);
        res.status(500).json({ message: 'Error al actualizar usuario' });
    }
});
// Eliminar un administrador o vendedor (Solo Admin)
router.delete('/staff/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
    }
    const { id } = req.params;
    // Evitar auto-eliminación
    if (Number(id) === req.user.id) {
        return res.status(400).json({ message: 'No puedes eliminar tu propio usuario administrador' });
    }
    try {
        await db_1.default.query('DELETE FROM users WHERE id = ?', [id]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'staff_crud',
            title: `Personal Eliminado (ID #${id})`,
            details: `Acción ejecutada por el Administrador ${req.user?.name}`
        });
        res.json({ message: 'Usuario de personal eliminado con éxito' });
    }
    catch (error) {
        console.error('Error al eliminar personal:', error);
        res.status(500).json({ message: 'Error al eliminar usuario' });
    }
});
// Solicitar código de recuperación de contraseña por correo
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'El correo electrónico es obligatorio' });
    }
    try {
        const [users] = await db_1.default.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'No existe ninguna cuenta registrada con este correo electrónico' });
        }
        const user = users[0];
        // Generar código aleatorio de 6 dígitos (ej. 849201)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // Expiración en 15 minutos
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        // Guardar en base de datos
        await db_1.default.query('UPDATE users SET reset_code = ?, reset_code_expires_at = ? WHERE id = ?', [code, expiresAt, user.id]);
        // Enviar correo electrónico
        const emailPreviewUrl = await (0, email_1.sendPasswordResetEmail)(user.email, user.name, code);
        res.json({
            message: 'Hemos enviado un código de 6 dígitos a tu correo electrónico',
            emailPreviewUrl: emailPreviewUrl !== 'Email enviado' ? emailPreviewUrl : undefined
        });
    }
    catch (error) {
        console.error('Error en /forgot-password:', error);
        res.status(500).json({ message: 'Error interno al enviar el código de recuperación' });
    }
});
// Restablecer contraseña utilizando el código de 6 dígitos
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
        return res.status(400).json({ message: 'Correo, código y nueva contraseña son obligatorios' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    try {
        const [users] = await db_1.default.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const user = users[0];
        if (!user.reset_code || user.reset_code.trim() !== code.trim()) {
            return res.status(400).json({ message: 'El código de verificación es incorrecto' });
        }
        if (!user.reset_code_expires_at || new Date(user.reset_code_expires_at) < new Date()) {
            return res.status(400).json({ message: 'El código de verificación ha expirado. Por favor solicita uno nuevo.' });
        }
        // Encriptar nueva contraseña
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, salt);
        // Actualizar contraseña y limpiar código
        await db_1.default.query('UPDATE users SET password = ?, reset_code = NULL, reset_code_expires_at = NULL WHERE id = ?', [hashedPassword, user.id]);
        res.json({ message: '¡Contraseña restablecida con éxito! Ya puedes iniciar sesión con tu nueva clave.' });
    }
    catch (error) {
        console.error('Error en /reset-password:', error);
        res.status(500).json({ message: 'Error interno al restablecer la contraseña' });
    }
});
exports.default = router;
