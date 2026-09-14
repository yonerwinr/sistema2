"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = requireSuperAdmin;
exports.getSuperAdminMetrics = getSuperAdminMetrics;
exports.getBusinessesList = getBusinessesList;
exports.createBusiness = createBusiness;
exports.updateBusinessLicense = updateBusinessLicense;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../config/db"));
const googleSheetsAuto_1 = require("../services/googleSheetsAuto");
/**
 * superadminController.ts
 * Controlador para la consola de gestión de licencias, cobranzas y comercios del SuperAdmin.
 */
// Middleware de verificación de rol SuperAdmin
function requireSuperAdmin(req, res, next) {
    const user = req.user;
    if (!user || user.role !== 'superadmin') {
        return res.status(403).json({
            error: 'Acceso Denegado',
            message: 'Esta acción requiere privilegios de Super Administrador del sistema.'
        });
    }
    next();
}
/**
 * Obtiene el resumen de métricas del SaaS (MRR, comercios, deudores, etc.)
 */
async function getSuperAdminMetrics(_req, res) {
    try {
        const [stats] = await db_1.default.query(`
      SELECT 
        COUNT(*) AS total_businesses,
        SUM(CASE WHEN license_status = 'active' AND is_active = 1 THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN license_status = 'trial' AND is_active = 1 THEN 1 ELSE 0 END) AS trial_count,
        SUM(CASE WHEN license_status = 'expired' OR (license_expires_at < NOW() AND license_status != 'active') THEN 1 ELSE 0 END) AS expired_count,
        SUM(CASE WHEN license_status = 'suspended' OR is_active = 0 THEN 1 ELSE 0 END) AS suspended_count,
        SUM(CASE WHEN license_status = 'active' AND is_active = 1 THEN COALESCE(price_monthly, 25.00) ELSE 0 END) AS estimated_mrr
      FROM businesses
    `);
        const [recentSales] = await db_1.default.query(`
      SELECT COUNT(*) AS total_sales, COALESCE(SUM(total), 0) AS total_revenue
      FROM sales
    `);
        res.json({
            metrics: {
                totalBusinesses: Number(stats[0]?.total_businesses || 0),
                activeLicenses: Number(stats[0]?.active_count || 0),
                trialLicenses: Number(stats[0]?.trial_count || 0),
                expiredLicenses: Number(stats[0]?.expired_count || 0),
                suspendedLicenses: Number(stats[0]?.suspended_count || 0),
                estimatedMRR: Number(stats[0]?.estimated_mrr || 0),
                globalSalesCount: Number(recentSales[0]?.total_sales || 0),
                globalRevenue: Number(recentSales[0]?.total_revenue || 0)
            }
        });
    }
    catch (error) {
        console.error('[SUPERADMIN] Error obteniendo métricas:', error);
        res.status(500).json({ error: 'Error al obtener métricas del sistema.' });
    }
}
/**
 * Lista todos los comercios con detalles de licencia y actividad
 */
async function getBusinessesList(_req, res) {
    try {
        const [businesses] = await db_1.default.query(`
      SELECT 
        b.id,
        b.name,
        b.slug,
        b.rif,
        b.legal_name,
        b.logo_url,
        b.phone,
        b.email,
        b.address,
        b.license_status,
        b.license_plan,
        b.license_expires_at,
        b.price_monthly,
        b.google_sheet_url,
        b.is_active,
        b.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.business_id = b.id) AS total_users,
        (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id) AS total_products,
        (SELECT COUNT(*) FROM sales s WHERE s.business_id = b.id) AS total_sales,
        (SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE s.business_id = b.id) AS total_revenue
      FROM businesses b
      ORDER BY b.id DESC
    `);
        const now = new Date();
        const formatted = businesses.map((b) => {
            let daysRemaining = null;
            if (b.license_expires_at) {
                const exp = new Date(b.license_expires_at);
                const diffMs = exp.getTime() - now.getTime();
                daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            }
            return {
                ...b,
                daysRemaining,
                isExpired: b.license_status === 'expired' || (daysRemaining !== null && daysRemaining < 0)
            };
        });
        res.json({ businesses: formatted });
    }
    catch (error) {
        console.error('[SUPERADMIN] Error listando comercios:', error);
        res.status(500).json({ error: 'Error al listar comercios.' });
    }
}
/**
 * Crea un nuevo comercio manualmente con aprovisionamiento de Google Sheets y usuario administrador
 */
async function createBusiness(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        const { name, slug, rif, legal_name, phone, email, address, ticket_message, license_plan = 'pro', license_days = 30, expires_at, price_monthly = 25.00, admin_name, admin_email, admin_password } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'El nombre del negocio es obligatorio.' });
        }
        // Generar slug limpio
        const cleanSlug = (slug || name)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        // Verificar slug único
        const [existing] = await conn.query('SELECT id FROM businesses WHERE slug = ? LIMIT 1', [cleanSlug]);
        if (existing.length > 0) {
            return res.status(400).json({ error: `El identificador/slug "${cleanSlug}" ya está en uso por otro comercio.` });
        }
        // Calcular fecha de vencimiento (por fecha específica o días de duración)
        let finalExpiresAt = new Date();
        if (expires_at) {
            finalExpiresAt = new Date(expires_at);
        }
        else {
            finalExpiresAt.setDate(finalExpiresAt.getDate() + Number(license_days || 30));
        }
        // Aprovisionar automáticamente Google Sheets para el nuevo comercio si hay credenciales
        const targetEmail = admin_email || email || '';
        const sheetInfo = await (0, googleSheetsAuto_1.provisionBusinessSheet)(name, targetEmail);
        const realSheetId = sheetInfo.isSimulated ? null : sheetInfo.sheetId;
        const realSheetUrl = sheetInfo.isSimulated ? null : sheetInfo.sheetUrl;
        await conn.beginTransaction();
        // 1. Insertar Comercio
        const [busRes] = await conn.query(`
      INSERT INTO businesses (
        name, slug, rif, legal_name, phone, email, address, ticket_message,
        license_status, license_plan, license_expires_at, price_monthly,
        google_sheet_id, google_sheet_url, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 1)
    `, [
            name,
            cleanSlug,
            rif || null,
            legal_name || name,
            phone || null,
            email || null,
            address || null,
            ticket_message || `¡Gracias por tu compra en ${name}! 🐒`,
            license_plan,
            finalExpiresAt,
            price_monthly,
            realSheetId,
            realSheetUrl
        ]);
        const newBusinessId = busRes.insertId;
        // 2. Crear usuario Administrador del nuevo comercio si se proporcionó credenciales
        if (admin_email && admin_password) {
            const hashedPass = await bcryptjs_1.default.hash(admin_password, 10);
            const [userRes] = await conn.query(`
        INSERT INTO users (name, email, password, role, phone, business_id)
        VALUES (?, ?, ?, 'admin', ?, ?)
      `, [
                admin_name || `Admin ${name}`,
                admin_email,
                hashedPass,
                phone || null,
                newBusinessId
            ]);
            await conn.query('UPDATE businesses SET owner_user_id = ? WHERE id = ?', [userRes.insertId, newBusinessId]);
        }
        await conn.commit();
        res.status(201).json({
            message: sheetInfo.isSimulated
                ? `Comercio "${name}" creado exitosamente con su plan y vencimiento.`
                : `Comercio "${name}" y Google Sheet aprovisionados exitosamente.`,
            business: {
                id: newBusinessId,
                name,
                slug: cleanSlug,
                google_sheet_url: realSheetUrl
            }
        });
    }
    catch (error) {
        await conn.rollback();
        console.error('[SUPERADMIN] Error creando negocio:', error);
        res.status(500).json({ error: error.message || 'Error al crear el comercio.' });
    }
    finally {
        conn.release();
    }
}
/**
 * Actualiza la licencia de un comercio (Extender días, cambiar plan, suspender o reactivar)
 */
async function updateBusinessLicense(req, res) {
    try {
        const businessId = Number(req.params.id);
        const { action, add_days, expires_at, license_status, license_plan, is_active, price_monthly, google_sheet_url } = req.body;
        const [rows] = await db_1.default.query('SELECT * FROM businesses WHERE id = ? LIMIT 1', [businessId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Comercio no encontrado.' });
        }
        const business = rows[0];
        let newExpiresAt = business.license_expires_at ? new Date(business.license_expires_at) : new Date();
        let newStatus = business.license_status;
        let newIsActive = business.is_active;
        // 1. Manejar acción explícita o estado de suspensión/reactivación
        const isSuspending = action === 'suspend' || license_status === 'suspended' || is_active === false || is_active === 0;
        if (isSuspending) {
            newStatus = 'suspended';
            newIsActive = 0;
        }
        else if (action === 'activate') {
            newStatus = 'active';
            newIsActive = 1;
            if (newExpiresAt < new Date()) {
                newExpiresAt = new Date();
                newExpiresAt.setDate(newExpiresAt.getDate() + 30);
            }
        }
        else {
            if (license_status) {
                newStatus = license_status;
                if (newStatus === 'suspended')
                    newIsActive = 0;
                else if (newStatus === 'active' || newStatus === 'trial')
                    newIsActive = 1;
            }
            if (typeof is_active === 'boolean') {
                newIsActive = is_active ? 1 : 0;
            }
            else if (is_active !== undefined) {
                newIsActive = Number(is_active);
            }
        }
        // 2. Manejar vigencia / expiración (solo si no se está suspendiendo)
        if (!isSuspending) {
            if (expires_at) {
                newExpiresAt = new Date(expires_at);
                newStatus = 'active';
                newIsActive = 1;
            }
            else if (add_days && Number(add_days) > 0) {
                const daysToAdd = Number(add_days);
                if (newExpiresAt < new Date()) {
                    newExpiresAt = new Date();
                }
                newExpiresAt.setDate(newExpiresAt.getDate() + daysToAdd);
                newStatus = 'active';
                newIsActive = 1;
            }
        }
        let sheetId = business.google_sheet_id;
        let cleanSheetUrl = business.google_sheet_url;
        if (google_sheet_url !== undefined) {
            cleanSheetUrl = google_sheet_url ? google_sheet_url.trim() : null;
            if (cleanSheetUrl) {
                const match = cleanSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                sheetId = match ? match[1] : null;
            }
            else {
                sheetId = null;
            }
        }
        await db_1.default.query(`
      UPDATE businesses 
      SET 
        license_status = ?,
        license_plan = COALESCE(?, license_plan),
        license_expires_at = ?,
        is_active = ?,
        price_monthly = COALESCE(?, price_monthly),
        google_sheet_url = ?,
        google_sheet_id = ?
      WHERE id = ?
    `, [
            newStatus,
            license_plan || null,
            newExpiresAt,
            newIsActive,
            price_monthly || null,
            cleanSheetUrl,
            sheetId,
            businessId
        ]);
        res.json({
            message: `Licencia y datos de "${business.name}" actualizados con éxito.`,
            license: {
                status: newStatus,
                isActive: newIsActive === 1,
                expiresAt: newExpiresAt,
                google_sheet_url: cleanSheetUrl
            }
        });
    }
    catch (error) {
        console.error('[SUPERADMIN] Error actualizando licencia:', error);
        res.status(500).json({ error: 'Error al actualizar licencia del comercio.' });
    }
}
