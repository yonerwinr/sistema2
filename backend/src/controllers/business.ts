import { Router } from 'express';
import { authenticate, isAdmin } from '../middleware/auth';
import {
  getBusinessProfile,
  updateBusinessProfile,
  autoProvisionSheet
} from './businessProfileController';
import pool from '../config/db';

const router = Router();

// Obtener perfil público de una empresa por su slug (para tienda online y POS)
router.get('/public/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.trim().toLowerCase();
    const [rows]: any = await pool.query(`
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
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener información pública del comercio.' });
  }
});

// Obtener perfil de la empresa activa del contexto
router.get('/profile', getBusinessProfile);

// Actualizar datos fiscales y perfil (requiere Admin del comercio)
router.put('/profile', authenticate as any, isAdmin as any, updateBusinessProfile);

// Aprovisionar automáticamente Google Sheets para el comercio
router.post('/google-sheet', authenticate as any, isAdmin as any, autoProvisionSheet);

export default router;
