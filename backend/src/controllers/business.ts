import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, isAdmin } from '../middleware/auth';
import {
  getBusinessProfile,
  updateBusinessProfile,
  autoProvisionSheet,
  uploadBusinessLogo
} from './businessProfileController';
import pool from '../config/db';

const router = Router();

// Configuración de almacenamiento para Logotipos Locales
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = 'logo-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, uniqueSuffix);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|svg\+xml|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (PNG, JPG, JPEG, WEBP, SVG)'));
  }
});

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

// Subida de imagen/logotipo local para la empresa y facturación
router.post('/upload-logo', authenticate as any, isAdmin as any, uploadLogo.single('logo'), uploadBusinessLogo);

// Aprovisionar automáticamente Google Sheets para el comercio
router.post('/google-sheet', authenticate as any, isAdmin as any, autoProvisionSheet);

export default router;

