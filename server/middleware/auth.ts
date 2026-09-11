import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'broadcast_engine_jwt_secret_superlucky_2026';

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  role: 'superadmin' | 'admin' | 'operator';
  company_name: string;
  permissions: Record<string, any>;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Also support HTTP cookies
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.split(';').find((c) => c.trim().startsWith('auth_token='));
    if (match) {
      token = match.split('=')[1]?.trim();
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required. No active session token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const userRes = await query(
      'SELECT id, email, full_name, role, company_name, permissions, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      res.status(401).json({ success: false, message: 'Account is deactivated or not found.' });
      return;
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Session expired after 15 minutes. Please sign in again.' });
  }
};

export const requireSuperadmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'superadmin') {
    res.status(403).json({
      success: false,
      message: 'Access denied: Superadmin privileges required.',
    });
    return;
  }
  next();
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || (req.user.role !== 'superadmin' && req.user.role !== 'admin')) {
    res.status(403).json({
      success: false,
      message: 'Access denied: Administrator privileges required.',
    });
    return;
  }
  next();
};

export const logAdminAudit = async (
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  details?: any,
  ipAddress?: string
) => {
  try {
    await query(
      `INSERT INTO admin_audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId || null, JSON.stringify(details || {}), ipAddress || null]
    );
  } catch (err) {
    console.error('Failed to log admin audit action:', err);
  }
};
