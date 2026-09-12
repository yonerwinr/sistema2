"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const businessProfileController_1 = require("./businessProfileController");
const db_1 = __importDefault(require("../config/db"));
const router = (0, express_1.Router)();
// Obtener perfil público de una empresa por su slug (para tienda online y POS)
router.get('/public/:slug', async (req, res) => {
    try {
        const slug = req.params.slug.trim().toLowerCase();
        const [rows] = await db_1.default.query(`
      SELECT 
        id, name, slug, rif, legal_name, logo_url, phone, email, address, ticket_message,
        license_status, is_active
      FROM businesses 
      WHERE slug = ? AND is_active = 1 
      LIMIT 1
    `, [slug]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Comercio no encontrado o inactivo.' });
        }
        res.json({ business: rows[0] });
    }
    catch (error) {
        res.status(500).json({ error: 'Error al obtener información pública del comercio.' });
    }
});
// Obtener perfil de la empresa activa del contexto
router.get('/profile', businessProfileController_1.getBusinessProfile);
// Actualizar datos fiscales y perfil (requiere Admin del comercio)
router.put('/profile', auth_1.authenticate, auth_1.isAdmin, businessProfileController_1.updateBusinessProfile);
// Aprovisionar automáticamente Google Sheets para el comercio
router.post('/google-sheet', auth_1.authenticate, auth_1.isAdmin, businessProfileController_1.autoProvisionSheet);
exports.default = router;
