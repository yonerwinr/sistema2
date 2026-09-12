import { Request, Response } from 'express';
import pool from '../config/db';
import { provisionBusinessSheet } from '../services/googleSheetsAuto';

/**
 * businessProfileController.ts
 * Controlador para que cada comercio gestione su perfil, logo, datos fiscales y Google Sheet.
 */

export async function getBusinessProfile(req: Request, res: Response) {
  try {
    const businessId = (req as any).businessId || ((req as any).user && (req as any).user.business_id) || 1;

    const [rows]: any = await pool.query(`
      SELECT 
        id, name, slug, rif, legal_name, logo_url, phone, email, address, ticket_message,
        license_status, license_plan, license_expires_at, price_monthly,
        google_sheet_url, google_sheets_webhook_url, is_active, created_at
      FROM businesses 
      WHERE id = ? 
      LIMIT 1
    `, [businessId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado.' });
    }

    const b = rows[0];
    let daysRemaining = null;
    if (b.license_expires_at) {
      const exp = new Date(b.license_expires_at);
      const diffMs = exp.getTime() - new Date().getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    res.json({
      business: {
        ...b,
        daysRemaining,
        isExpired: b.license_status === 'expired' || (daysRemaining !== null && daysRemaining < 0)
      }
    });
  } catch (error: any) {
    console.error('[BUSINESS PROFILE] Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error al obtener datos del comercio.' });
  }
}

export async function updateBusinessProfile(req: Request, res: Response) {
  try {
    const businessId = (req as any).businessId || ((req as any).user && (req as any).user.business_id) || 1;
    const {
      name,
      rif,
      legal_name,
      logo_url,
      phone,
      email,
      address,
      ticket_message,
      google_sheets_webhook_url
    } = req.body;

    await pool.query(`
      UPDATE businesses 
      SET 
        name = COALESCE(?, name),
        rif = COALESCE(?, rif),
        legal_name = COALESCE(?, legal_name),
        logo_url = COALESCE(?, logo_url),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        ticket_message = COALESCE(?, ticket_message),
        google_sheets_webhook_url = COALESCE(?, google_sheets_webhook_url)
      WHERE id = ?
    `, [
      name || null,
      rif || null,
      legal_name || null,
      logo_url || null,
      phone || null,
      email || null,
      address || null,
      ticket_message || null,
      google_sheets_webhook_url || null,
      businessId
    ]);

    res.json({
      message: 'Datos de la empresa y configuración de factura actualizados correctamente.'
    });
  } catch (error: any) {
    console.error('[BUSINESS PROFILE] Error actualizando perfil:', error);
    res.status(500).json({ error: 'Error al actualizar perfil del negocio.' });
  }
}

export async function autoProvisionSheet(req: Request, res: Response) {
  try {
    const businessId = (req as any).businessId || ((req as any).user && (req as any).user.business_id) || 1;

    const [rows]: any = await pool.query('SELECT name, email FROM businesses WHERE id = ? LIMIT 1', [businessId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado.' });
    }

    const business = rows[0];
    const sheetInfo = await provisionBusinessSheet(business.name, business.email);

    await pool.query(`
      UPDATE businesses 
      SET google_sheet_id = ?, google_sheet_url = ? 
      WHERE id = ?
    `, [sheetInfo.sheetId, sheetInfo.sheetUrl, businessId]);

    res.json({
      message: 'Hoja de Google Sheets creada y vinculada con éxito.',
      sheetUrl: sheetInfo.sheetUrl,
      isSimulated: sheetInfo.isSimulated
    });
  } catch (error: any) {
    console.error('[BUSINESS PROFILE] Error aprovisionando hoja de Google Sheets:', error);
    res.status(500).json({ error: 'Error al generar la hoja de Google Sheets.' });
  }
}
