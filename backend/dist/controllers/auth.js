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
const validation_1 = require("../utils/validation");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreta_pos_online_token_key_987654321';
// Registro de Usuario (Clientes) con Validación por Correo y WhatsApp
router.post('/register', async (req, res) => {
    const { name, email, password, phone, ci } = req.body;
    if (!name || !email || !password || !ci) {
        return res.status(400).json({ message: 'Nombre, correo, contraseña y cédula son obligatorios' });
    }
    // Validar formato de Cédula o RIF
    if (!(0, validation_1.validateCi)(ci)) {
        return res.status(400).json({ message: 'Formato de Cédula o RIF inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes (ej: V-12345678, J-301234567)' });
    }
    try {
        // Verificar si el usuario ya existe por correo
        const [existing] = await db_1.default.query('SELECT id, email_verified FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            // Si el usuario existe pero no se ha verificado nunca, permitimos regenerar código y continuar
            if (existing[0].email_verified === 0) {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
                await db_1.default.query('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?', [code, expiresAt, existing[0].id]);
                let previewUrl = '';
                try {
                    previewUrl = await (0, email_1.sendRegistrationVerificationEmail)(email, name, code);
                }
                catch (emailErr) {
                    console.warn('No se pudo enviar correo de verificación:', emailErr);
                }
                const [bRows] = await db_1.default.query('SELECT phone FROM businesses WHERE id = 1 LIMIT 1');
                const supportPhone = bRows.length > 0 && bRows[0].phone ? bRows[0].phone.replace(/[^0-9]/g, '') : '';
                return res.status(200).json({
                    requiresVerification: true,
                    email,
                    phone: phone || null,
                    supportPhone,
                    message: 'Tu cuenta ya estaba en proceso de registro. Hemos enviado un nuevo código de activación a tu correo.',
                    previewUrl: previewUrl !== 'Email enviado' ? previewUrl : undefined
                });
            }
            return res.status(400).json({ message: 'El correo electrónico ya está registrado y activo. Por favor inicia sesión.' });
        }
        // Verificar si la cédula ya existe
        const [existingCI] = await db_1.default.query('SELECT id FROM users WHERE ci = ?', [ci]);
        if (existingCI.length > 0) {
            return res.status(400).json({ message: 'La cédula de identidad ya está registrada por otro usuario' });
        }
        // Encriptar contraseña
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        // Generar código de verificación de 6 dígitos
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        // Insertar usuario con estado pendiente de verificación
        await db_1.default.query('INSERT INTO users (name, email, password, role, phone, ci, email_verified, phone_verified, verification_code, verification_expires_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)', [name, email, hashedPassword, 'customer', phone || null, ci, verificationCode, expiresAt]);
        // Enviar correo de validación
        let previewUrl = '';
        try {
            previewUrl = await (0, email_1.sendRegistrationVerificationEmail)(email, name, verificationCode);
        }
        catch (emailErr) {
            console.warn('Error enviando correo de verificación de registro:', emailErr);
        }
        // Obtener teléfono de soporte para WhatsApp gratis
        const [bRows] = await db_1.default.query('SELECT phone FROM businesses WHERE id = 1 LIMIT 1');
        const supportPhone = bRows.length > 0 && bRows[0].phone ? bRows[0].phone.replace(/[^0-9]/g, '') : '';
        res.status(201).json({
            requiresVerification: true,
            email,
            phone: phone || null,
            supportPhone,
            message: '¡Registro casi listo! Te hemos enviado un código de 6 dígitos a tu correo electrónico para verificar tu cuenta.',
            previewUrl: previewUrl !== 'Email enviado' ? previewUrl : undefined
        });
    }
    catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor en el registro' });
    }
});
// Verificar código de activación (Correo o WhatsApp)
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ message: 'El correo y el código de verificación son obligatorios' });
    }
    try {
        const [users] = await db_1.default.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const user = users[0];
        // Si ya está verificado
        if (user.email_verified === 1) {
            const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name, business_id: user.business_id || 1 }, JWT_SECRET, { expiresIn: '8h' });
            return res.json({
                message: 'Tu cuenta ya se encuentra verificada.',
                token,
                user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, ci: user.ci }
            });
        }
        // Verificar código
        if (!user.verification_code || user.verification_code.trim() !== code.toString().trim()) {
            return res.status(400).json({ message: 'El código de verificación es incorrecto' });
        }
        // Verificar expiración
        if (!user.verification_expires_at || new Date(user.verification_expires_at) < new Date()) {
            return res.status(400).json({ message: 'El código de verificación ha expirado. Por favor solicita uno nuevo.' });
        }
        // Marcar como verificado y limpiar código
        await db_1.default.query('UPDATE users SET email_verified = 1, phone_verified = 1, verification_code = NULL, verification_expires_at = NULL WHERE id = ?', [user.id]);
        // Generar token JWT
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name, business_id: user.business_id || 1 }, JWT_SECRET, { expiresIn: '8h' });
        res.json({
            message: '¡Cuenta verificada exitosamente! Bienvenido a FacilitoApp.',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, ci: user.ci }
        });
    }
    catch (error) {
        console.error('Error en /verify-code:', error);
        res.status(500).json({ message: 'Error interno al verificar el código' });
    }
});
// Reenviar código de verificación
router.post('/resend-verification', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'El correo electrónico es obligatorio' });
    }
    try {
        const [users] = await db_1.default.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'No existe una cuenta registrada con este correo' });
        }
        const user = users[0];
        if (user.email_verified === 1) {
            return res.status(400).json({ message: 'Tu cuenta ya está verificada. Puedes iniciar sesión directamente.' });
        }
        // Generar nuevo código
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db_1.default.query('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?', [newCode, expiresAt, user.id]);
        let previewUrl = '';
        try {
            previewUrl = await (0, email_1.sendRegistrationVerificationEmail)(user.email, user.name, newCode);
        }
        catch (err) {
            console.warn('Error reenviando código:', err);
        }
        const [bRows] = await db_1.default.query('SELECT phone FROM businesses WHERE id = 1 LIMIT 1');
        const supportPhone = bRows.length > 0 && bRows[0].phone ? bRows[0].phone.replace(/[^0-9]/g, '') : '';
        res.json({
            message: 'Hemos enviado un nuevo código de 6 dígitos a tu correo electrónico.',
            supportPhone,
            previewUrl: previewUrl !== 'Email enviado' ? previewUrl : undefined
        });
    }
    catch (error) {
        console.error('Error en /resend-verification:', error);
        res.status(500).json({ message: 'Error interno al reenviar el código' });
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
        // Si es un cliente y aún no ha verificado su cuenta, requerir validación
        if (user.role === 'customer' && user.email_verified === 0) {
            // Regenerar código si es necesario
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await db_1.default.query('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?', [code, expiresAt, user.id]);
            try {
                await (0, email_1.sendRegistrationVerificationEmail)(user.email, user.name, code);
            }
            catch (e) {
                console.warn('Error reenviando código en login:', e);
            }
            return res.status(403).json({
                requiresVerification: true,
                email: user.email,
                phone: user.phone,
                message: 'Tu cuenta requiere verificación. Hemos enviado un código de 6 dígitos a tu correo electrónico.'
            });
        }
        // Obtener información del negocio asociado
        let businessInfo = null;
        const targetBusinessId = user.business_id || 1;
        const [bRows] = await db_1.default.query('SELECT id, name, slug, rif, legal_name, logo_url, phone, email, address, ticket_message, license_status, license_plan, license_expires_at, price_monthly, google_sheet_url, is_active FROM businesses WHERE id = ? LIMIT 1', [targetBusinessId]);
        if (bRows.length > 0) {
            const b = bRows[0];
            let daysRemaining = null;
            if (b.license_expires_at) {
                const exp = new Date(b.license_expires_at);
                const diffMs = exp.getTime() - new Date().getTime();
                daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            }
            businessInfo = {
                ...b,
                daysRemaining,
                isExpired: b.license_status === 'expired' || (daysRemaining !== null && daysRemaining < 0)
            };
        }
        // Generar token JWT (Vigencia de 8 horas)
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name, business_id: targetBusinessId }, JWT_SECRET, { expiresIn: '8h' });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                ci: user.ci,
                avatar_url: user.avatar_url || null,
                business_id: targetBusinessId,
                business: businessInfo
            }
        });
    }
    catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor en el login' });
    }
});
// Obtener el Client ID de Google configurado en el servidor o base de datos
router.get('/google-client-id', async (_req, res) => {
    let clientId = process.env.GOOGLE_CLIENT_ID || '366254145584-utq2m6sir1cq6v09au1ojj8gik2vr7f8.apps.googleusercontent.com';
    try {
        const [rows] = await db_1.default.query("SELECT settings_value FROM settings WHERE settings_key = 'google_client_id' LIMIT 1");
        if (rows.length > 0 && rows[0].settings_value && !rows[0].settings_value.includes('1008719970978')) {
            clientId = rows[0].settings_value;
        }
    }
    catch (e) {
        console.warn('Error al consultar google_client_id de settings:', e);
    }
    res.json({ clientId });
});
// Guardar o actualizar el Client ID de Google en base de datos
router.post('/google-client-id', async (req, res) => {
    const { clientId } = req.body;
    if (!clientId || !clientId.trim()) {
        return res.status(400).json({ message: 'El Client ID es obligatorio' });
    }
    try {
        await db_1.default.query("INSERT INTO settings (settings_key, settings_value) VALUES ('google_client_id', ?) ON DUPLICATE KEY UPDATE settings_value = ?", [clientId.trim(), clientId.trim()]);
        res.json({ message: 'Google Client ID guardado exitosamente', clientId: clientId.trim() });
    }
    catch (err) {
        console.error('Error guardando google_client_id:', err);
        res.status(500).json({ message: 'Error interno al guardar la configuración' });
    }
});
// Autenticación con Google (Login / Registro integrado)
router.post('/google', async (req, res) => {
    const { credential, accessToken } = req.body;
    if (!credential && !accessToken) {
        return res.status(400).json({ message: 'La credencial o token de acceso de Google es obligatorio' });
    }
    try {
        let email = '';
        let name = '';
        let email_verified = false;
        if (credential) {
            const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
            if (!googleRes.ok) {
                return res.status(400).json({ message: 'Token de Google inválido o expirado' });
            }
            const payload = await googleRes.json();
            email = payload.email;
            name = payload.name;
            email_verified = payload.email_verified;
        }
        else if (accessToken) {
            const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!googleRes.ok) {
                return res.status(400).json({ message: 'Token de acceso de Google inválido o expirado' });
            }
            const payload = await googleRes.json();
            email = payload.email;
            name = payload.name;
            email_verified = payload.email_verified;
        }
        if (email_verified !== true && email_verified !== 'true') {
            return res.status(400).json({ message: 'El correo electrónico de Google no está verificado' });
        }
        // Buscar si el usuario ya existe por correo
        const [users] = await db_1.default.query('SELECT * FROM users WHERE email = ?', [email]);
        let user;
        if (users.length > 0) {
            user = users[0];
            if (user.email_verified === 0) {
                await db_1.default.query('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
                user.email_verified = 1;
            }
        }
        else {
            // Registrar un nuevo cliente desde Google (correo verificado automáticamente por Google)
            const userName = name || email.split('@')[0];
            const [result] = await db_1.default.query('INSERT INTO users (name, email, password, role, phone, ci, email_verified) VALUES (?, ?, NULL, ?, NULL, NULL, 1)', [userName, email, 'customer']);
            const userId = result.insertId;
            const [newUsers] = await db_1.default.query('SELECT * FROM users WHERE id = ?', [userId]);
            user = newUsers[0];
        }
        // Generar token JWT del sistema (Vigencia de 8 horas)
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                ci: user.ci,
                avatar_url: user.avatar_url || null
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
        const [users] = await db_1.default.query('SELECT id, name, email, role, phone, ci, avatar_url, permissions, business_id, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const u = users[0];
        let businessInfo = null;
        const targetBusinessId = u.business_id || 1;
        const [bRows] = await db_1.default.query('SELECT id, name, slug, rif, legal_name, logo_url, phone, email, address, ticket_message, license_status, license_plan, license_expires_at, price_monthly, google_sheet_url, is_active FROM businesses WHERE id = ? LIMIT 1', [targetBusinessId]);
        if (bRows.length > 0) {
            const b = bRows[0];
            let daysRemaining = null;
            if (b.license_expires_at) {
                const exp = new Date(b.license_expires_at);
                const diffMs = exp.getTime() - new Date().getTime();
                daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            }
            businessInfo = {
                ...b,
                daysRemaining,
                isExpired: b.license_status === 'expired' || (daysRemaining !== null && daysRemaining < 0)
            };
        }
        res.json({
            ...u,
            business: businessInfo
        });
    }
    catch (error) {
        console.error('Error en /me:', error);
        res.status(500).json({ message: 'Error al obtener datos del usuario' });
    }
});
// GET /auth/profile: Obtener configuración de perfil del usuario logueado (todos los roles)
router.get('/profile', auth_1.authenticate, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'No autenticado' });
        const [users] = await db_1.default.query('SELECT id, name, email, role, phone, ci, avatar_url, password IS NOT NULL as has_password, business_id, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0)
            return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(users[0]);
    }
    catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ message: 'Error interno al obtener el perfil' });
    }
});
// PUT /auth/profile: Modificar información de la cuenta, foto de perfil y contraseña (todos los usuarios)
router.put('/profile', auth_1.authenticate, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'No autenticado' });
        const userId = req.user.id;
        const { name, phone, ci, avatar_url, current_password, new_password } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'El nombre completo es obligatorio' });
        }
        if (ci && !(0, validation_1.validateCi)(ci)) {
            return res.status(400).json({ message: 'Formato de Cédula o RIF inválido. Debe comenzar con V-, E-, J- o G- (ej. V-12345678)' });
        }
        const [existingUsers] = await db_1.default.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (existingUsers.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const currentUserDb = existingUsers[0];
        // Manejo de cambio de contraseña si se solicita
        let updatePasswordSql = '';
        const queryParams = [
            name.trim(),
            phone ? phone.trim() : null,
            ci ? ci.trim() : null,
            avatar_url !== undefined ? avatar_url : currentUserDb.avatar_url
        ];
        if (new_password && new_password.trim()) {
            if (new_password.trim().length < 6) {
                return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
            }
            if (currentUserDb.password) {
                if (!current_password) {
                    return res.status(400).json({ message: 'Debes ingresar tu contraseña actual para cambiarla' });
                }
                const isMatch = await bcryptjs_1.default.compare(current_password, currentUserDb.password);
                if (!isMatch) {
                    return res.status(400).json({ message: 'La contraseña actual no es correcta' });
                }
            }
            const salt = await bcryptjs_1.default.genSalt(10);
            const hashedPassword = await bcryptjs_1.default.hash(new_password.trim(), salt);
            updatePasswordSql = ', password = ?';
            queryParams.push(hashedPassword);
        }
        queryParams.push(userId);
        await db_1.default.query(`UPDATE users SET name = ?, phone = ?, ci = ?, avatar_url = ?${updatePasswordSql} WHERE id = ?`, queryParams);
        // Registrar auditoría
        try {
            await (0, audit_1.logAuditEvent)({
                userId,
                userName: name.trim(),
                userRole: currentUserDb.role,
                actionType: 'user_edit',
                title: 'Actualización de perfil de usuario',
                details: {
                    name: name.trim(),
                    phone,
                    ci,
                    has_avatar: Boolean(avatar_url),
                    password_changed: Boolean(new_password)
                }
            });
        }
        catch (_) { }
        // Obtener usuario actualizado
        const [updatedRows] = await db_1.default.query('SELECT id, name, email, role, phone, ci, avatar_url, business_id FROM users WHERE id = ?', [userId]);
        res.json({
            message: '¡Tu perfil ha sido actualizado con éxito!',
            user: updatedRows[0]
        });
    }
    catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({ message: 'Error interno al actualizar perfil' });
    }
});
router.get('/customers', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
        return res.status(403).json({ message: 'No autorizado. Solo administradores y vendedores pueden ver la lista de clientes' });
    }
    try {
        const [customers] = await db_1.default.query('SELECT id, name, email, phone, ci, address, client_type, representative_name, representative_ci, representative_phone, representative_position, created_at FROM users WHERE role = "customer" ORDER BY name ASC');
        res.json(customers);
    }
    catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ message: 'Error al obtener lista de clientes' });
    }
});
// Registrar nuevo cliente desde POS o Panel Admin
router.post('/register-customer', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
        return res.status(403).json({ message: 'No autorizado para registrar clientes' });
    }
    const { name, ci, email, phone, address, client_type, representative_name, representative_ci, representative_phone, representative_position } = req.body;
    if (!name || !ci) {
        return res.status(400).json({ message: 'El nombre/razón social y la cédula/RIF son obligatorios' });
    }
    const cleanCi = ci.trim();
    if (!(0, validation_1.validateCi)(cleanCi)) {
        return res.status(400).json({ message: 'Formato de Cédula o RIF del cliente inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes (ej: V-12345678, J-301234567)' });
    }
    const cleanName = name.trim();
    const cleanPhone = phone ? phone.trim() : null;
    const cleanAddress = address ? address.trim() : null;
    let cleanEmail = email ? email.trim() : null;
    const cleanType = client_type || (cleanCi.toUpperCase().startsWith('J-') ? 'juridico' : cleanCi.toUpperCase().startsWith('G-') ? 'gubernamental' : 'natural');
    const cleanRepName = representative_name ? representative_name.trim() : null;
    const cleanRepCi = representative_ci ? representative_ci.trim() : null;
    if (cleanRepCi && !(0, validation_1.validateCi)(cleanRepCi)) {
        return res.status(400).json({ message: 'Formato de Cédula o RIF del representante legal inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes.' });
    }
    const cleanRepPhone = representative_phone ? representative_phone.trim() : null;
    const cleanRepPosition = representative_position ? representative_position.trim() : null;
    if (!cleanEmail) {
        cleanEmail = `${cleanCi.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.local`;
    }
    try {
        // Verificar si la cédula/RIF ya existe
        const [existingCI] = await db_1.default.query('SELECT id, name, email, phone, ci, address, client_type, representative_name, representative_ci, representative_phone, representative_position FROM users WHERE ci = ?', [cleanCi]);
        if (existingCI.length > 0) {
            return res.status(400).json({
                message: `El cliente con Cédula / RIF (${cleanCi}) ya se encuentra registrado a nombre de: ${existingCI[0].name}`,
                user: existingCI[0]
            });
        }
        // Verificar si el correo ya existe
        const [existingEmail] = await db_1.default.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
        if (existingEmail.length > 0) {
            cleanEmail = `${cleanCi.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@cliente.local`;
        }
        const [result] = await db_1.default.query(`INSERT INTO users 
        (name, email, password, role, phone, ci, address, client_type, representative_name, representative_ci, representative_phone, representative_position) 
       VALUES (?, ?, NULL, "customer", ?, ?, ?, ?, ?, ?, ?, ?)`, [cleanName, cleanEmail, cleanPhone, cleanCi, cleanAddress, cleanType, cleanRepName, cleanRepCi, cleanRepPhone, cleanRepPosition]);
        const newCustomerId = result.insertId;
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'user_edit',
            title: `Nuevo Cliente Registrado: ${cleanName}`,
            details: `Cédula/RIF: ${cleanCi}, Dirección: ${cleanAddress || 'N/A'}, Tipo: ${cleanType}, Encargado: ${cleanRepName || 'N/A'}`
        });
        res.status(201).json({
            message: 'Cliente registrado con éxito',
            user: {
                id: newCustomerId,
                name: cleanName,
                email: cleanEmail,
                phone: cleanPhone,
                ci: cleanCi,
                address: cleanAddress,
                role: 'customer',
                client_type: cleanType,
                representative_name: cleanRepName,
                representative_ci: cleanRepCi,
                representative_phone: cleanRepPhone,
                representative_position: cleanRepPosition
            }
        });
    }
    catch (error) {
        console.error('Error al registrar cliente:', error);
        res.status(500).json({ message: error.message || 'Error al registrar cliente en la base de datos' });
    }
});
// Actualizar datos de cliente (Vendedores y Admin)
router.put('/customers/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
        return res.status(403).json({ message: 'No autorizado para editar clientes' });
    }
    const { id } = req.params;
    const { name, ci, email, phone, address, client_type, representative_name, representative_ci, representative_phone, representative_position } = req.body;
    if (!name || !ci) {
        return res.status(400).json({ message: 'El nombre/razón social y la cédula/RIF son obligatorios' });
    }
    const cleanCi = ci.trim();
    if (!(0, validation_1.validateCi)(cleanCi)) {
        return res.status(400).json({ message: 'Formato de Cédula o RIF del cliente inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes (ej: V-12345678, J-301234567)' });
    }
    const cleanName = name.trim();
    const cleanPhone = phone ? phone.trim() : null;
    const cleanAddress = address ? address.trim() : null;
    let cleanEmail = email ? email.trim() : null;
    const cleanType = client_type || (cleanCi.toUpperCase().startsWith('J-') ? 'juridico' : cleanCi.toUpperCase().startsWith('G-') ? 'gubernamental' : 'natural');
    const cleanRepName = representative_name ? representative_name.trim() : null;
    const cleanRepCi = representative_ci ? representative_ci.trim() : null;
    if (cleanRepCi && !(0, validation_1.validateCi)(cleanRepCi)) {
        return res.status(400).json({ message: 'Formato de Cédula o RIF del representante legal inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes.' });
    }
    const cleanRepPhone = representative_phone ? representative_phone.trim() : null;
    const cleanRepPosition = representative_position ? representative_position.trim() : null;
    if (!cleanEmail) {
        cleanEmail = `${cleanCi.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.local`;
    }
    try {
        const [existingCi] = await db_1.default.query('SELECT id FROM users WHERE ci = ? AND id != ?', [cleanCi, id]);
        if (existingCi.length > 0) {
            return res.status(400).json({ message: `La Cédula / RIF (${cleanCi}) ya está en uso por otro cliente` });
        }
        await db_1.default.query(`UPDATE users 
       SET name = ?, email = ?, phone = ?, ci = ?, address = ?, client_type = ?, 
           representative_name = ?, representative_ci = ?, representative_phone = ?, representative_position = ?
       WHERE id = ? AND role = "customer"`, [cleanName, cleanEmail, cleanPhone, cleanCi, cleanAddress, cleanType, cleanRepName, cleanRepCi, cleanRepPhone, cleanRepPosition, id]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'user_edit',
            title: `Cliente Actualizado: ${cleanName}`,
            details: `ID #${id}, Cédula/RIF: ${cleanCi}, Teléfono: ${cleanPhone || 'N/A'}`
        });
        res.json({ message: 'Cliente actualizado con éxito' });
    }
    catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ message: 'Error al actualizar cliente en la base de datos' });
    }
});
// Eliminar cliente (Vendedores y Admin)
router.delete('/customers/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'seller') {
        return res.status(403).json({ message: 'No autorizado para eliminar clientes' });
    }
    const { id } = req.params;
    try {
        const [cust] = await db_1.default.query('SELECT name, ci FROM users WHERE id = ? AND role = "customer"', [id]);
        if (cust.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        await db_1.default.query('DELETE FROM users WHERE id = ? AND role = "customer"', [id]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'user_edit',
            title: `Cliente Eliminado: ${cust[0].name}`,
            details: `ID #${id}, Cédula/RIF: ${cust[0].ci || 'N/A'}`
        });
        res.json({ message: 'Cliente eliminado con éxito' });
    }
    catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ message: 'Error al eliminar cliente' });
    }
});
// Buscar cliente por cédula (POS Step-1)
router.get('/customer-by-ci', auth_1.authenticate, async (req, res) => {
    const { ci } = req.query;
    if (!ci) {
        return res.status(400).json({ message: 'La cédula o RIF es requerida' });
    }
    try {
        const [users] = await db_1.default.query('SELECT id, name, email, phone, ci, address, role, permissions, client_type, representative_name, representative_ci, representative_phone, representative_position FROM users WHERE ci = ? LIMIT 1', [ci]);
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
        const [staff] = await db_1.default.query('SELECT id, name, email, role, phone, ci, permissions FROM users WHERE role IN ("admin", "seller", "billing") ORDER BY name ASC');
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
    if (!['admin', 'seller', 'billing'].includes(role)) {
        return res.status(400).json({ message: 'Rol inválido. Debe ser admin, seller o billing' });
    }
    if (ci && !(0, validation_1.validateCi)(ci)) {
        return res.status(400).json({ message: 'Formato de Cédula o RIF del personal inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes.' });
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
    if (!['admin', 'seller', 'billing'].includes(role)) {
        return res.status(400).json({ message: 'Rol inválido' });
    }
    if (ci && !(0, validation_1.validateCi)(ci)) {
        return res.status(400).json({ message: 'Formato de Cédula o RIF del personal inválido. Debe comenzar con V-, E-, J- o G- seguido de los dígitos correspondientes.' });
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
        // Enviar correo electrónico de forma segura
        let emailPreviewUrl;
        let emailSent = false;
        try {
            emailPreviewUrl = await (0, email_1.sendPasswordResetEmail)(user.email, user.name, code);
            emailSent = true;
        }
        catch (mailError) {
            console.error('Aviso: No se pudo enviar el correo de recuperación SMTP:', mailError);
        }
        // Teléfono de soporte de la empresa
        let supportPhone = '';
        try {
            const [bRows] = await db_1.default.query('SELECT phone FROM businesses WHERE id = 1 LIMIT 1');
            if (bRows.length > 0 && bRows[0].phone) {
                supportPhone = bRows[0].phone.replace(/[^0-9]/g, '');
            }
        }
        catch (_) { }
        res.json({
            success: true,
            message: emailSent
                ? 'Hemos enviado un código de 6 dígitos a tu correo electrónico'
                : 'Código de recuperación generado. Si el correo tarda en llegar, puedes comunicarte con soporte por WhatsApp.',
            emailSent,
            supportPhone,
            emailPreviewUrl: emailPreviewUrl !== 'Email enviado' ? emailPreviewUrl : undefined
        });
    }
    catch (error) {
        console.error('Error en /forgot-password:', error);
        res.status(500).json({ message: 'Error interno al procesar la solicitud de recuperación' });
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
// GET /auth/staff: Obtener personal y vendedores
router.get('/staff', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado. Solo administradores' });
    }
    try {
        const [staff] = await db_1.default.query('SELECT id, name, email, role, phone, ci, permissions FROM users WHERE role IN ("admin", "seller") ORDER BY name ASC');
        res.json(staff);
    }
    catch (error) {
        console.error('Error al obtener personal:', error);
        res.status(500).json({ message: 'Error al obtener personal' });
    }
});
// POST /auth/staff: Crear personal/vendedor
router.post('/staff', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado. Solo administradores' });
    }
    const { name, email, password, role, phone, ci, permissions } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Nombre, correo, contraseña y rol son obligatorios' });
    }
    try {
        const [existing] = await db_1.default.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const permsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : (permissions || null);
        await db_1.default.query('INSERT INTO users (name, email, password, role, phone, ci, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)', [name, email, hashedPassword, role, phone || null, ci || null, permsStr]);
        res.status(201).json({ message: 'Personal registrado con éxito' });
    }
    catch (error) {
        console.error('Error al registrar personal:', error);
        res.status(500).json({ message: 'Error al registrar personal' });
    }
});
// PUT /auth/staff/:id: Actualizar personal/vendedor
router.put('/staff/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado. Solo administradores' });
    }
    const id = req.params.id;
    const { name, email, password, role, phone, ci, permissions } = req.body;
    try {
        const permsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : (permissions || null);
        if (password && password.trim() !== '') {
            const salt = await bcryptjs_1.default.genSalt(10);
            const hashedPassword = await bcryptjs_1.default.hash(password, salt);
            await db_1.default.query('UPDATE users SET name = ?, email = ?, password = ?, role = ?, phone = ?, ci = ?, permissions = ? WHERE id = ?', [name, email, hashedPassword, role, phone || null, ci || null, permsStr, id]);
        }
        else {
            await db_1.default.query('UPDATE users SET name = ?, email = ?, role = ?, phone = ?, ci = ?, permissions = ? WHERE id = ?', [name, email, role, phone || null, ci || null, permsStr, id]);
        }
        res.json({ message: 'Personal actualizado con éxito' });
    }
    catch (error) {
        console.error('Error al actualizar personal:', error);
        res.status(500).json({ message: 'Error al actualizar personal' });
    }
});
// DELETE /auth/staff/:id: Eliminar personal/vendedor
router.delete('/staff/:id', auth_1.authenticate, async (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado. Solo administradores' });
    }
    const id = req.params.id;
    try {
        await db_1.default.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'Usuario eliminado con éxito' });
    }
    catch (error) {
        console.error('Error al eliminar personal:', error);
        res.status(500).json({ message: 'Error al eliminar personal' });
    }
});
// POST /auth/verify-supervisor: Verifica credenciales de administrador/supervisor
router.post('/verify-supervisor', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
    }
    try {
        const [users] = await db_1.default.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Credenciales de supervisor inválidas' });
        }
        const user = users[0];
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'El usuario no tiene privilegios de supervisor (administrador)' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales de supervisor inválidas' });
        }
        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Error al verificar supervisor:', error);
        res.status(500).json({ message: 'Error interno al verificar supervisor' });
    }
});
exports.default = router;
