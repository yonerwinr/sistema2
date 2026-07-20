"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
const db_1 = __importDefault(require("../config/db"));
async function logAuditEvent(data) {
    try {
        const detailsStr = typeof data.details === 'object' ? JSON.stringify(data.details) : (data.details || null);
        await db_1.default.query(`INSERT INTO audit_logs (user_id, user_name, user_role, action_type, title, details) VALUES (?, ?, ?, ?, ?, ?)`, [
            data.userId || null,
            data.userName || 'Sistema',
            data.userRole || 'sistema',
            data.actionType,
            data.title,
            detailsStr
        ]);
    }
    catch (err) {
        console.error('[AUDIT LOG ERROR]', err);
    }
}
