"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = tenantMiddleware;
const db_1 = __importDefault(require("../config/db"));
/**
 * Middleware para identificar el comercio (Tenant) actual y validar el estado de su licencia.
 */
async function tenantMiddleware(req, res, next) {
    try {
        // 1. Extraer slug desde headers, query o params
        const slugHeader = req.headers['x-business-slug'];
        const slugQuery = req.query.business;
        const slugParam = req.params.businessSlug;
        const targetSlug = (slugHeader || slugQuery || slugParam || '').trim().toLowerCase();
        let query = 'SELECT * FROM businesses WHERE is_active = 1 AND ';
        let params = [];
        if (targetSlug && targetSlug !== 'undefined' && targetSlug !== 'null') {
            query += 'slug = ? LIMIT 1';
            params.push(targetSlug);
        }
        else if (req.user && req.user.business_id) {
            query += 'id = ? LIMIT 1';
            params.push(req.user.business_id);
        }
        else {
            // Negocio principal por defecto
            query += 'id = 1 LIMIT 1';
        }
        const [rows] = await db_1.default.query(query, params);
        if (rows.length === 0) {
            // Si se especificó un slug que no existe
            if (targetSlug) {
                return res.status(404).json({
                    error: 'Comercio no encontrado',
                    message: `El negocio con identificador "${targetSlug}" no existe o ha sido dado de baja.`
                });
            }
            // Fallback al primer negocio existente
            const [fallback] = await db_1.default.query('SELECT * FROM businesses ORDER BY id ASC LIMIT 1');
            if (fallback.length > 0) {
                req.business = fallback[0];
                req.businessId = fallback[0].id;
            }
        }
        else {
            const business = rows[0];
            // Verificar vencimiento de licencia
            const now = new Date();
            if (business.license_expires_at && new Date(business.license_expires_at) < now) {
                if (business.license_status === 'active' || business.license_status === 'trial') {
                    business.license_status = 'expired';
                    // Actualizar estado en segundo plano
                    db_1.default.query("UPDATE businesses SET license_status = 'expired' WHERE id = ?", [business.id]).catch(() => { });
                }
            }
            req.business = business;
            req.businessId = business.id;
        }
        next();
    }
    catch (error) {
        console.error('[TENANT MIDDLEWARE] Error al resolver negocio:', error);
        next();
    }
}
