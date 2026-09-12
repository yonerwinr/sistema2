import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';

export interface BusinessContext {
  id: number;
  name: string;
  slug: string;
  rif: string | null;
  legal_name: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  ticket_message: string | null;
  license_status: 'trial' | 'active' | 'expired' | 'suspended';
  license_plan: 'basic' | 'pro' | 'enterprise';
  license_expires_at: string | null;
  google_sheet_url: string | null;
  is_active: number;
}

declare global {
  namespace Express {
    interface Request {
      business?: BusinessContext;
      businessId?: number;
    }
  }
}

/**
 * Middleware para identificar el comercio (Tenant) actual y validar el estado de su licencia.
 */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Extraer slug desde headers, query o params
    const slugHeader = req.headers['x-business-slug'] as string;
    const slugQuery = req.query.business as string;
    const slugParam = req.params.businessSlug;
    const targetSlug = (slugHeader || slugQuery || slugParam || '').trim().toLowerCase();

    let query = 'SELECT * FROM businesses WHERE is_active = 1 AND ';
    let params: any[] = [];

    if (targetSlug && targetSlug !== 'undefined' && targetSlug !== 'null') {
      query += 'slug = ? LIMIT 1';
      params.push(targetSlug);
    } else if ((req as any).user && (req as any).user.business_id) {
      query += 'id = ? LIMIT 1';
      params.push((req as any).user.business_id);
    } else {
      // Negocio principal por defecto
      query += 'id = 1 LIMIT 1';
    }

    const [rows]: any = await pool.query(query, params);

    if (rows.length === 0) {
      // Si se especificó un slug que no existe
      if (targetSlug) {
        return res.status(404).json({
          error: 'Comercio no encontrado',
          message: `El negocio con identificador "${targetSlug}" no existe o ha sido dado de baja.`
        });
      }
      // Fallback al primer negocio existente
      const [fallback]: any = await pool.query('SELECT * FROM businesses ORDER BY id ASC LIMIT 1');
      if (fallback.length > 0) {
        req.business = fallback[0];
        req.businessId = fallback[0].id;
      }
    } else {
      const business = rows[0];

      // Verificar vencimiento de licencia
      const now = new Date();
      if (business.license_expires_at && new Date(business.license_expires_at) < now) {
        if (business.license_status === 'active' || business.license_status === 'trial') {
          business.license_status = 'expired';
          // Actualizar estado en segundo plano
          pool.query("UPDATE businesses SET license_status = 'expired' WHERE id = ?", [business.id]).catch(() => {});
        }
      }

      req.business = business;
      req.businessId = business.id;
    }

    next();
  } catch (error: any) {
    console.error('[TENANT MIDDLEWARE] Error al resolver negocio:', error);
    next();
  }
}
