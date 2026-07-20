"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const audit_1 = require("../services/audit");
const router = (0, express_1.Router)();
async function getExchangeRates() {
    const [rows] = await db_1.default.query('SELECT settings_key, settings_value FROM settings WHERE settings_key IN (?, ?)', ['usd_to_ves_rate', 'eur_to_ves_rate']);
    const values = { usdToVes: 40, eurToVes: 43.5 };
    rows.forEach((row) => {
        if (row.settings_key === 'usd_to_ves_rate') {
            values.usdToVes = Number(row.settings_value) || values.usdToVes;
        }
        if (row.settings_key === 'eur_to_ves_rate') {
            values.eurToVes = Number(row.settings_value) || values.eurToVes;
        }
    });
    return values;
}
function calculateAmountVes(amount, currency, rates) {
    const normalizedCurrency = (currency || 'USD').toUpperCase();
    if (normalizedCurrency === 'USD')
        return Number((amount * rates.usdToVes).toFixed(2));
    if (normalizedCurrency === 'EUR')
        return Number((amount * rates.eurToVes).toFixed(2));
    return Number(amount.toFixed(2));
}
function computeNextDueDate(startDateStr, type) {
    if (!startDateStr || type === 'unexpected')
        return null;
    const start = new Date(startDateStr);
    if (isNaN(start.getTime()))
        return null;
    const d = new Date(start);
    if (type === 'daily') {
        d.setDate(d.getDate() + 1);
    }
    else if (type === 'weekly') {
        d.setDate(d.getDate() + 7);
    }
    else if (type === 'biweekly') {
        d.setDate(d.getDate() + 15);
    }
    else if (type === 'monthly') {
        d.setMonth(d.getMonth() + 1);
    }
    else if (type === 'yearly') {
        d.setFullYear(d.getFullYear() + 1);
    }
    else {
        return startDateStr;
    }
    return d.toISOString().slice(0, 10);
}
router.get('/', auth_1.authenticate, auth_1.isAdmin, async (_req, res) => {
    try {
        const [expenses] = await db_1.default.query('SELECT * FROM expenses ORDER BY is_active DESC, next_due_date IS NULL, next_due_date ASC, created_at DESC');
        res.json(expenses.map((expense) => ({
            ...expense,
            amount: Number(expense.amount),
            amount_ves: expense.amount_ves !== null ? Number(expense.amount_ves) : null,
            is_active: Boolean(expense.is_active)
        })));
    }
    catch (error) {
        console.error('Error al obtener gastos:', error);
        res.status(500).json({ message: 'Error al obtener los gastos' });
    }
});
router.post('/', auth_1.authenticate, auth_1.isAdmin, async (req, res) => {
    const { name, description, amount, currency = 'USD', expense_type = 'unexpected', is_active = true, start_date, next_due_date } = req.body;
    if (!name || amount === undefined || amount === null) {
        return res.status(400).json({ message: 'Nombre y monto son obligatorios' });
    }
    try {
        const rates = await getExchangeRates();
        const amountValue = Number(amount);
        const amountVes = calculateAmountVes(amountValue, currency, rates);
        const normalizedCurrency = String(currency || 'USD').toUpperCase();
        const normalizedType = String(expense_type || 'unexpected').toLowerCase();
        const normalizedActive = Number(Boolean(is_active));
        const today = new Date().toISOString().slice(0, 10);
        const effectiveStartDate = start_date || today;
        const effectiveNextDueDate = next_due_date || computeNextDueDate(effectiveStartDate, normalizedType);
        const [result] = await db_1.default.query('INSERT INTO expenses (name, description, amount, amount_ves, currency, expense_type, is_active, start_date, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, description || null, amountValue, amountVes, normalizedCurrency, normalizedType, normalizedActive, effectiveStartDate, effectiveNextDueDate]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'settings',
            title: `Gasto creado: ${name}`,
            details: `Monto: ${amountValue} ${normalizedCurrency}, Tipo: ${normalizedType}`
        });
        res.status(201).json({
            id: result.insertId,
            name,
            description: description || null,
            amount: amountValue,
            amount_ves: amountVes,
            currency: normalizedCurrency,
            expense_type: normalizedType,
            is_active: Boolean(normalizedActive),
            start_date: effectiveStartDate,
            next_due_date: effectiveNextDueDate,
            created_at: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error al crear gasto:', error);
        res.status(500).json({ message: 'Error al crear el gasto' });
    }
});
router.put('/:id', auth_1.authenticate, auth_1.isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description, amount, currency, expense_type, is_active, start_date, next_due_date } = req.body;
    try {
        const [existingRows] = await db_1.default.query('SELECT * FROM expenses WHERE id = ?', [id]);
        if (existingRows.length === 0) {
            return res.status(404).json({ message: 'Gasto no encontrado' });
        }
        const current = existingRows[0];
        const rates = await getExchangeRates();
        const amountValue = amount === undefined ? Number(current.amount) : Number(amount);
        const amountVes = calculateAmountVes(amountValue, currency || current.currency || 'USD', rates);
        const normalizedCurrency = (currency || current.currency || 'USD').toUpperCase();
        const normalizedType = (expense_type || current.expense_type || 'unexpected').toLowerCase();
        const normalizedActive = is_active === undefined ? Number(Boolean(current.is_active)) : Number(Boolean(is_active));
        const effectiveStartDate = start_date || current.start_date || new Date().toISOString().slice(0, 10);
        const effectiveNextDueDate = next_due_date !== undefined ? next_due_date : (current.next_due_date || computeNextDueDate(effectiveStartDate, normalizedType));
        await db_1.default.query('UPDATE expenses SET name = ?, description = ?, amount = ?, amount_ves = ?, currency = ?, expense_type = ?, is_active = ?, start_date = ?, next_due_date = ? WHERE id = ?', [name || current.name, description !== undefined ? description : current.description, amountValue, amountVes, normalizedCurrency, normalizedType, normalizedActive, effectiveStartDate, effectiveNextDueDate, id]);
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'settings',
            title: `Gasto actualizado: ${name || current.name}`,
            details: `Monto: ${amountValue} ${normalizedCurrency}, Tipo: ${normalizedType}, Activo: ${Boolean(normalizedActive)}`
        });
        res.json({
            id: parseInt(id),
            name: name || current.name,
            description: description !== undefined ? description : current.description,
            amount: amountValue,
            amount_ves: amountVes,
            currency: normalizedCurrency,
            expense_type: normalizedType,
            is_active: Boolean(normalizedActive),
            start_date: effectiveStartDate,
            next_due_date: effectiveNextDueDate,
            created_at: current.created_at
        });
    }
    catch (error) {
        console.error('Error al actualizar gasto:', error);
        res.status(500).json({ message: 'Error al actualizar el gasto' });
    }
});
router.delete('/:id', auth_1.authenticate, auth_1.isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db_1.default.query('DELETE FROM expenses WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Gasto no encontrado' });
        }
        (0, audit_1.logAuditEvent)({
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            actionType: 'settings',
            title: `Gasto eliminado (ID #${id})`,
            details: 'Se eliminó un gasto del panel administrativo'
        });
        res.json({ message: 'Gasto eliminado correctamente' });
    }
    catch (error) {
        console.error('Error al eliminar gasto:', error);
        res.status(500).json({ message: 'Error al eliminar el gasto' });
    }
});
exports.default = router;
