// server/middlewares/auth.js
import process from 'node:process';
import jwt from 'jsonwebtoken';

export function authRequired(req, res, next) {
  const authorization = req.get('Authorization');
  // An explicit tab credential must never fall back to another tab's cookie.
  const raw = authorization !== undefined
    ? (/^Bearer (.+)$/i.exec(authorization)?.[1] || '')
    : req.cookies?.token;
  if (!raw) return res.status(401).json({ error: '인증이 필요합니다.' });

  try {
    req.user = jwt.verify(raw, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
  }
}