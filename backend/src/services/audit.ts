import pool from '../config/db';

export interface AuditLogData {
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  actionType: 'sale_online' | 'sale_pos' | 'quotation' | 'staff_crud' | 'user_edit' | 'product_crud' | 'coupon_crud' | 'settings' | 'supplier_crud';
  title: string;
  details?: string | object | null;
}

export async function logAuditEvent(data: AuditLogData): Promise<void> {
  try {
    const detailsStr = typeof data.details === 'object' ? JSON.stringify(data.details) : (data.details || null);
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action_type, title, details) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.userId || null,
        data.userName || 'Sistema',
        data.userRole || 'sistema',
        data.actionType,
        data.title,
        detailsStr
      ]
    );
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err);
  }
}
