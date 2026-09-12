"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.isAdmin = isAdmin;
exports.isSuperAdmin = isSuperAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreta_pos_online_token_key_987654321';
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No autorizado, token no proveído' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
}
function isAdmin(req, res, next) {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Acceso denegado, se requieren privilegios de administrador' });
    }
    next();
}
function isSuperAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Acceso denegado, se requieren privilegios de Super Administrador' });
    }
    next();
}
