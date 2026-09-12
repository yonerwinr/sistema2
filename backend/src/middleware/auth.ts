import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secreta_pos_online_token_key_987654321';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: 'superadmin' | 'admin' | 'customer' | 'seller' | 'billing';
    name: string;
    business_id?: number;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado, token no proveído' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

export function isAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ message: 'Acceso denegado, se requieren privilegios de administrador' });
  }
  next();
}

export function isSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Acceso denegado, se requieren privilegios de Super Administrador' });
  }
  next();
}
