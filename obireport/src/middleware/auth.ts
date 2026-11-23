import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface DbUserRecord {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUserRecord;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty authentication token.' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const dbUser = await getOrCreateUser({
      uid: decodedToken.uid,
      email: decodedToken.email || `${decodedToken.uid}@users.obireport.app`,
      fullName: typeof decodedToken.name === 'string' ? decodedToken.name : null,
      avatarUrl: typeof decodedToken.picture === 'string' ? decodedToken.picture : null,
    });

    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
};
