import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { authenticate, AuthRequest, isAdmin } from '../middleware/auth';
import { logAuditEvent } from '../services/audit';

const router = Router();

// Middleware de permisos: Admin o Seller pueden gestionar devoluciones y reclamos de garantía
const canManageReturns = (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado, token no provisto' });
  }
  if (req.user.role === 'admin' || req.user.role === 'seller' || req.user.role === 'billing') {
    return next();
  }
  return res.status(403).json({ message: 'Acceso denegado, se requieren privilegios de administración o vendedor' });
};

// GET /api/returns/stats - Resumen de métricas de garantías y devoluciones
router.get('/stats', authenticate, canManageReturns, async (_req: AuthRequest, res: Response) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN type = 'warranty' THEN 1 ELSE 0 END) AS warranty_count,
        SUM(CASE WHEN type = 'return' THEN 1 ELSE 0 END) AS return_count,
        SUM(CASE WHEN status IN ('pending', 'in_repair') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN is_repaired = 1 OR status = 'repaired' THEN 1 ELSE 0 END) AS repaired_count,
        COALESCE(SUM(repair_cost), 0) AS total_repair_cost
      FROM returns_claims
    `);

    const stats = rows[0] || {};
    res.json({
      total: Number(stats.total_count || 0),
      warranties: Number(stats.warranty_count || 0),
      returns: Number(stats.return_count || 0),
      pending: Number(stats.pending_count || 0),
      repaired: Number(stats.repaired_count || 0),
      total_repair_cost: parseFloat(stats.total_repair_cost || '0')
    });
  } catch (error: any) {
    console.error('Error al obtener estadísticas de devoluciones y garantías:', error);
    res.status(500).json({ message: error.message || 'Error al obtener estadísticas' });
  }
});

// GET /api/returns - Obtener todos los reclamos / devoluciones con filtros
router.get('/', authenticate, canManageReturns, async (req: AuthRequest, res: Response) => {
  const { status, type, search } = req.query;

  try {
    let query = `
      SELECT 
        rc.*,
        u.name AS created_by_name,
        s.total AS sale_total,
        s.created_at AS sale_date
      FROM returns_claims rc
      LEFT JOIN users u ON rc.created_by = u.id
      LEFT JOIN sales s ON rc.sale_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND rc.status = ?';
      params.push(status);
    }

    if (type && type !== 'all') {
      query += ' AND rc.type = ?';
      params.push(type);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ` AND (
        rc.code LIKE ? OR 
        rc.customer_name LIKE ? OR 
        rc.customer_ci LIKE ? OR 
        rc.customer_phone LIKE ? OR 
        rc.product_name LIKE ? OR 
        rc.product_sku LIKE ? OR
        rc.reason LIKE ?
      )`;
      params.push(term, term, term, term, term, term, term);
    }

    query += ' ORDER BY rc.id DESC';

    const [rows]: any = await pool.query(query, params);
    res.json(rows);
  } catch (error: any) {
    console.error('Error al listar devoluciones y garantías:', error);
    res.status(500).json({ message: error.message || 'Error al obtener reclamos y devoluciones' });
  }
});

// GET /api/returns/:id - Obtener un reclamo por ID
router.get('/:id', authenticate, canManageReturns, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const [rows]: any = await pool.query(
      `SELECT 
        rc.*,
        u.name AS created_by_name,
        s.total AS sale_total,
        s.created_at AS sale_date
       FROM returns_claims rc
       LEFT JOIN users u ON rc.created_by = u.id
       LEFT JOIN sales s ON rc.sale_id = s.id
       WHERE rc.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reclamo o devolución no encontrado' });
    }

    res.json(rows[0]);
  } catch (error: any) {
    console.error('Error al obtener reclamo:', error);
    res.status(500).json({ message: error.message || 'Error al obtener el reclamo' });
  }
});

// POST /api/returns - Registrar nuevo reclamo o devolución
router.post('/', authenticate, canManageReturns, async (req: AuthRequest, res: Response) => {
  const {
    type = 'warranty',
    sale_id,
    product_id,
    product_name,
    product_sku,
    customer_name,
    customer_phone,
    customer_ci,
    customer_email,
    reason,
    issue_description,
    status = 'pending',
    is_repaired = false,
    repair_cost = 0,
    repair_notes,
    technician_name,
    resolution
  } = req.body;

  if (!product_name || !customer_name || !reason) {
    return res.status(400).json({
      message: 'Nombre del producto, nombre del cliente y motivo son campos obligatorios.'
    });
  }

  // Si la solicitud es una Devolución, verificar autorización obligatoria de Administrador o Encargado de Caja
  if (type === 'return') {
    if (req.user?.role !== 'admin') {
      const { supervisorEmail, supervisorPassword } = req.body;
      if (!supervisorEmail || !supervisorPassword) {
        return res.status(401).json({ 
          message: 'Se requiere la clave del administrador o encargado de cajas para autorizar una devolución.' 
        });
      }

      const [supervisors]: any = await pool.query(
        'SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1',
        [supervisorEmail]
      );
      if (supervisors.length === 0) {
        return res.status(401).json({ message: 'Credenciales del administrador o encargado inválidas' });
      }

      const supervisor = supervisors[0];
      if (supervisor.role !== 'admin') {
        return res.status(403).json({ message: 'El usuario no tiene privilegios de administrador o encargado de caja' });
      }

      const isMatch = await bcrypt.compare(supervisorPassword, supervisor.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Clave del administrador o encargado incorrecta' });
      }
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Generar código correlativo de ticket: e.g. GAR-0001 o DEV-0001
    const prefix = type === 'return' ? 'DEV' : 'GAR';
    const [lastRows]: any = await conn.query(
      'SELECT id FROM returns_claims ORDER BY id DESC LIMIT 1'
    );
    const nextSeq = lastRows.length > 0 ? lastRows[0].id + 1 : 1;
    const code = `${prefix}-${String(nextSeq).padStart(4, '0')}`;

    const numRepairCost = parseFloat(String(repair_cost || 0)) || 0;
    const boolIsRepaired = (is_repaired === true || is_repaired === 1 || is_repaired === '1' || status === 'repaired') ? 1 : 0;

    const [result]: any = await conn.query(
      `INSERT INTO returns_claims (
        code, type, sale_id, product_id, product_name, product_sku,
        customer_name, customer_phone, customer_ci, customer_email,
        reason, issue_description, status, is_repaired, repair_cost,
        repair_notes, technician_name, resolution, created_by,
        received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        code,
        type,
        sale_id ? parseInt(String(sale_id)) : null,
        product_id ? parseInt(String(product_id)) : null,
        product_name.trim(),
        product_sku ? String(product_sku).trim() : null,
        customer_name.trim(),
        customer_phone ? String(customer_phone).trim() : null,
        customer_ci ? String(customer_ci).trim() : null,
        customer_email ? String(customer_email).trim() : null,
        reason.trim(),
        issue_description ? String(issue_description).trim() : null,
        status || 'pending',
        boolIsRepaired,
        numRepairCost,
        repair_notes ? String(repair_notes).trim() : null,
        technician_name ? String(technician_name).trim() : null,
        resolution ? String(resolution).trim() : null,
        req.user?.id || null
      ]
    );

    await conn.commit();

    const newId = result.insertId;

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'returns_claims',
      title: `Nuevo Caso Registrado: ${code} (${type === 'return' ? 'Devolución' : 'Garantía'})`,
      details: `Cliente: ${customer_name}, Producto: ${product_name}, Motivo: ${reason}, Costo Reparación Tienda: $${numRepairCost.toFixed(2)}`
    });

    res.status(201).json({
      id: newId,
      code,
      message: 'Caso registrado exitosamente'
    });
  } catch (error: any) {
    await conn.rollback();
    console.error('Error al registrar devolución/garantía:', error);
    res.status(500).json({ message: error.message || 'Error al guardar el reclamo' });
  } finally {
    conn.release();
  }
});

// PUT /api/returns/:id - Actualizar estado, reparación, notas y costos de tienda
router.put('/:id', authenticate, canManageReturns, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    type,
    product_name,
    product_sku,
    customer_name,
    customer_phone,
    customer_ci,
    customer_email,
    reason,
    issue_description,
    status,
    is_repaired,
    repair_cost,
    repair_notes,
    technician_name,
    resolution
  } = req.body;

  try {
    const [existingRows]: any = await pool.query(
      'SELECT * FROM returns_claims WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Reclamo o devolución no encontrado' });
    }

    // Si se cambia el tipo a devolución o el estado a reembolsado, exigir clave de administrador/encargado
    if ((type === 'return' || status === 'refunded') && req.user?.role !== 'admin') {
      const { supervisorEmail, supervisorPassword } = req.body;
      if (!supervisorEmail || !supervisorPassword) {
        return res.status(401).json({ 
          message: 'Se requiere la clave del administrador o encargado de cajas para autorizar esta devolución.' 
        });
      }

      const [supervisors]: any = await pool.query(
        'SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1',
        [supervisorEmail]
      );
      if (supervisors.length === 0) {
        return res.status(401).json({ message: 'Credenciales del administrador o encargado inválidas' });
      }

      const supervisor = supervisors[0];
      if (supervisor.role !== 'admin') {
        return res.status(403).json({ message: 'El usuario no tiene privilegios de administrador o encargado de caja' });
      }

      const isMatch = await bcrypt.compare(supervisorPassword, supervisor.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Clave del administrador o encargado incorrecta' });
      }
    }

    const current = existingRows[0];

    const updatedType = type || current.type;
    const updatedProdName = product_name !== undefined ? product_name : current.product_name;
    const updatedProdSku = product_sku !== undefined ? product_sku : current.product_sku;
    const updatedCustName = customer_name !== undefined ? customer_name : current.customer_name;
    const updatedCustPhone = customer_phone !== undefined ? customer_phone : current.customer_phone;
    const updatedCustCi = customer_ci !== undefined ? customer_ci : current.customer_ci;
    const updatedCustEmail = customer_email !== undefined ? customer_email : current.customer_email;
    const updatedReason = reason !== undefined ? reason : current.reason;
    const updatedIssueDesc = issue_description !== undefined ? issue_description : current.issue_description;
    const updatedStatus = status || current.status;
    const boolIsRepaired = is_repaired !== undefined 
      ? (is_repaired === true || is_repaired === 1 || is_repaired === '1' || updatedStatus === 'repaired' ? 1 : 0)
      : current.is_repaired;
    const updatedRepairCost = repair_cost !== undefined 
      ? (parseFloat(String(repair_cost)) || 0)
      : current.repair_cost;
    const updatedRepairNotes = repair_notes !== undefined ? repair_notes : current.repair_notes;
    const updatedTechName = technician_name !== undefined ? technician_name : current.technician_name;
    const updatedResolution = resolution !== undefined ? resolution : current.resolution;

    let repairedAt = current.repaired_at;
    if ((boolIsRepaired === 1 || updatedStatus === 'repaired') && !repairedAt) {
      repairedAt = new Date();
    }

    let completedAt = current.completed_at;
    if (['completed', 'refunded', 'replaced', 'rejected'].includes(updatedStatus) && !completedAt) {
      completedAt = new Date();
    }

    await pool.query(
      `UPDATE returns_claims SET 
        type = ?, product_name = ?, product_sku = ?,
        customer_name = ?, customer_phone = ?, customer_ci = ?, customer_email = ?,
        reason = ?, issue_description = ?, status = ?,
        is_repaired = ?, repair_cost = ?, repair_notes = ?,
        technician_name = ?, resolution = ?,
        repaired_at = ?, completed_at = ?
       WHERE id = ?`,
      [
        updatedType,
        updatedProdName,
        updatedProdSku,
        updatedCustName,
        updatedCustPhone,
        updatedCustCi,
        updatedCustEmail,
        updatedReason,
        updatedIssueDesc,
        updatedStatus,
        boolIsRepaired,
        updatedRepairCost,
        updatedRepairNotes,
        updatedTechName,
        updatedResolution,
        repairedAt,
        completedAt,
        id
      ]
    );

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'returns_claims',
      title: `Caso Actualizado: ${current.code} (Estado: ${updatedStatus})`,
      details: `Reparado: ${boolIsRepaired ? 'Sí' : 'No'}, Costo Tienda: $${parseFloat(updatedRepairCost).toFixed(2)}, Técnico: ${updatedTechName || 'N/A'}`
    });

    res.json({ message: 'Caso actualizado exitosamente' });
  } catch (error: any) {
    console.error('Error al actualizar reclamo/garantía:', error);
    res.status(500).json({ message: error.message || 'Error al actualizar el reclamo' });
  }
});

// DELETE /api/returns/:id - Eliminar reclamo (Solo administradores)
router.delete('/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const [existing]: any = await pool.query('SELECT code FROM returns_claims WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Reclamo o devolución no encontrado' });
    }

    const code = existing[0].code;

    await pool.query('DELETE FROM returns_claims WHERE id = ?', [id]);

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'returns_claims',
      title: `Caso Eliminado: ${code}`,
      details: `ID de registro eliminado: ${id}`
    });

    res.json({ message: `Caso ${code} eliminado con éxito` });
  } catch (error: any) {
    console.error('Error al eliminar reclamo/garantía:', error);
    res.status(500).json({ message: error.message || 'Error al eliminar el reclamo' });
  }
});

export default router;
