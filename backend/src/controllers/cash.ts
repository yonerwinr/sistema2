import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAuditEvent } from '../services/audit';

const router = Router();

// GET /active: Obtiene el turno de caja abierto actual del usuario
router.get('/active', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [sessions]: any = await pool.query(
      'SELECT * FROM cash_sessions WHERE user_id = ? AND status = "open" ORDER BY id DESC LIMIT 1',
      [req.user?.id]
    );

    if (sessions.length === 0) {
      return res.json(null);
    }

    // Obtener también el límite de caja de settings
    const [limitRows]: any = await pool.query(
      'SELECT settings_value FROM settings WHERE settings_key = "cash_drop_limit" LIMIT 1'
    );
    const limit = limitRows.length > 0 ? parseFloat(limitRows[0].settings_value) : 500.00;

    res.json({
      ...sessions[0],
      cash_drop_limit: limit
    });
  } catch (error) {
    console.error('Error al obtener caja activa:', error);
    res.status(500).json({ message: 'Error al obtener el estado de la caja' });
  }
});

// POST /open: Abre un nuevo turno de caja
router.post('/open', authenticate, async (req: AuthRequest, res: Response) => {
  const { openingBalance } = req.body;

  if (openingBalance === undefined || openingBalance === null) {
    return res.status(400).json({ message: 'El balance inicial es obligatorio' });
  }

  const initialBalance = parseFloat(openingBalance);
  if (isNaN(initialBalance) || initialBalance < 0) {
    return res.status(400).json({ message: 'El balance inicial debe ser un número válido mayor o igual a 0' });
  }

  try {
    // Verificar si ya existe una sesión abierta
    const [existing]: any = await pool.query(
      'SELECT id FROM cash_sessions WHERE user_id = ? AND status = "open"',
      [req.user?.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Ya tienes un turno de caja abierto' });
    }

    const [result]: any = await pool.query(
      'INSERT INTO cash_sessions (user_id, opening_balance, expected_balance, status) VALUES (?, ?, ?, "open")',
      [req.user?.id, initialBalance, initialBalance]
    );

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'staff_crud',
      title: `Apertura de Caja`,
      details: `Caja abierta con un balance inicial de $${initialBalance.toFixed(2)} por ${req.user?.name}`
    });

    res.status(201).json({
      id: result.insertId,
      user_id: req.user?.id,
      opening_balance: initialBalance,
      expected_balance: initialBalance,
      status: 'open',
      opened_at: new Date()
    });
  } catch (error: any) {
    console.error('Error al abrir caja:', error);
    res.status(500).json({ message: error.message || 'Error al abrir el turno de caja' });
  }
});

// POST /close: Cierra el turno de caja activo
router.post('/close', authenticate, async (req: AuthRequest, res: Response) => {
  const { actualBalance } = req.body;

  if (actualBalance === undefined || actualBalance === null) {
    return res.status(400).json({ message: 'El balance físico de cierre es obligatorio' });
  }

  const realBalance = parseFloat(actualBalance);
  if (isNaN(realBalance) || realBalance < 0) {
    return res.status(400).json({ message: 'El balance físico debe ser un número válido mayor o igual a 0' });
  }

  try {
    // Obtener sesión activa
    const [sessions]: any = await pool.query(
      'SELECT * FROM cash_sessions WHERE user_id = ? AND status = "open" ORDER BY id DESC LIMIT 1',
      [req.user?.id]
    );

    if (sessions.length === 0) {
      return res.status(400).json({ message: 'No hay ningún turno de caja abierto' });
    }

    const session = sessions[0];
    const difference = realBalance - Number(session.expected_balance);

    await pool.query(
      'UPDATE cash_sessions SET closed_at = NOW(), status = "closed", actual_balance = ?, difference = ?, closed_by = ? WHERE id = ?',
      [realBalance, difference, req.user?.id, session.id]
    );

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'staff_crud',
      title: `Cierre de Caja`,
      details: `Caja cerrada. Esperado: $${Number(session.expected_balance).toFixed(2)}, Físico: $${realBalance.toFixed(2)}, Diferencia: $${difference.toFixed(2)}`
    });

    res.json({
      message: 'Turno de caja cerrado con éxito',
      sessionId: session.id,
      expectedBalance: Number(session.expected_balance),
      actualBalance: realBalance,
      difference
    });
  } catch (error: any) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ message: error.message || 'Error al cerrar el turno de caja' });
  }
});

// POST /cash-drop: Registra un retiro de efectivo (sangría) verificado por supervisor
router.post('/cash-drop', authenticate, async (req: AuthRequest, res: Response) => {
  const { amount, supervisorEmail, supervisorPassword } = req.body;

  if (!amount || !supervisorEmail || !supervisorPassword) {
    return res.status(400).json({ message: 'Monto, correo y contraseña del supervisor son obligatorios' });
  }

  const dropAmount = parseFloat(amount);
  if (isNaN(dropAmount) || dropAmount <= 0) {
    return res.status(400).json({ message: 'El monto del retiro debe ser un número positivo' });
  }

  try {
    // 1. Verificar credenciales del supervisor (debe ser admin)
    const [supervisors]: any = await pool.query(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [supervisorEmail]
    );

    if (supervisors.length === 0) {
      return res.status(401).json({ message: 'Credenciales del supervisor inválidas' });
    }

    const supervisor = supervisors[0];

    if (supervisor.role !== 'admin') {
      return res.status(403).json({ message: 'El usuario provisto no tiene privilegios de supervisor (administrador)' });
    }

    const isMatch = await bcrypt.compare(supervisorPassword, supervisor.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales del supervisor inválidas' });
    }

    // 2. Obtener sesión activa de caja del vendedor
    const [sessions]: any = await pool.query(
      'SELECT * FROM cash_sessions WHERE user_id = ? AND status = "open" ORDER BY id DESC LIMIT 1',
      [req.user?.id]
    );

    if (sessions.length === 0) {
      return res.status(400).json({ message: 'No hay un turno de caja abierto activo para realizar el retiro' });
    }

    const session = sessions[0];

    // Opcional: Validar que el monto no exceda el balance esperado
    if (Number(session.expected_balance) < dropAmount) {
      return res.status(400).json({ message: `Monto del retiro excede el saldo de caja esperado ($${Number(session.expected_balance).toFixed(2)})` });
    }

    // 3. Registrar sangría
    await pool.query(
      'INSERT INTO cash_drops (session_id, amount, authorized_by) VALUES (?, ?, ?)',
      [session.id, dropAmount, supervisor.id]
    );

    // 4. Actualizar expected_balance
    const newExpected = Number(session.expected_balance) - dropAmount;
    await pool.query(
      'UPDATE cash_sessions SET expected_balance = ? WHERE id = ?',
      [newExpected, session.id]
    );

    logAuditEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      actionType: 'staff_crud',
      title: `Sangría de Caja (Retiro de Efectivo)`,
      details: `Retiro de $${dropAmount.toFixed(2)} de la caja del usuario ${req.user?.name} autorizado por el supervisor ${supervisor.name}. Nuevo balance esperado: $${newExpected.toFixed(2)}`
    });

    res.json({
      message: 'Sangría de caja registrada con éxito',
      newExpectedBalance: newExpected,
      amount: dropAmount,
      authorizedBy: supervisor.name
    });
  } catch (error: any) {
    console.error('Error al procesar sangría de caja:', error);
    res.status(500).json({ message: error.message || 'Error al procesar la sangría de caja' });
  }
});

export default router;
