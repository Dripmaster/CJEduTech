// server/routes/auth.routes.js
import process from 'node:process';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { z } from 'zod';
import cookieParser from 'cookie-parser';
import { loginOrSignup } from '../services/auth.service.js';
import { authRequired } from '../middlewares/auth.js';

const router = Router();

// body 파싱/쿠키 파싱은 index.js 전역에서도 가능하지만,
// 독립 사용을 위해 여기서도 안전하게 보장
router.use(cookieParser());

const loginSchema = z.object({
  nickname: z.string().min(1),
  password: z.string().min(1),
  tabSession: z.boolean().optional()
});

const teacherAttempts = new Map();
router.post('/teacher/login', async (req, res, next) => {
  const now = Date.now();
  for (const [ip, value] of teacherAttempts) if (value.until <= now) teacherAttempts.delete(ip);
  const attempts = teacherAttempts.get(req.ip) || {count:0, until:now + 10 * 60_000};
  if (attempts.count >= 10) return res.status(429).json({message:'잠시 후 다시 시도해 주세요.'});
  attempts.count++; teacherAttempts.set(req.ip, attempts);
  const password = req.body?.password;
  const hash = process.env.FINANCIAL_TEACHER_PASSWORD_HASH;
  if (!hash || typeof password !== 'string' || password.length > 200) {
    return res.status(401).json({message:'접속 정보를 확인해 주세요.'});
  }
  try {
    if (!await bcrypt.compare(password, hash)) return res.status(401).json({message:'접속 정보를 확인해 주세요.'});
    teacherAttempts.delete(req.ip);
    const token = jwt.sign({uid:'financial-teacher', nn:'admin', role:'admin'}, process.env.JWT_SECRET, {expiresIn:'12h'});
    res.set('Cache-Control','no-store');
    res.json({token, user:{user_id:'financial-teacher', nickname:'admin', role:'admin'}});
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { nickname, password, tabSession } = loginSchema.parse(req.body);
    const { token, user } = await loginOrSignup({ nickname, password });

    if (tabSession) {
      res.set('Cache-Control', 'no-store');
      return res.json({ user, token });
    }

    // httpOnly 쿠키로 발급 (프론트 JS에서 직접 접근 불가 → 보안상 이점)
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // 운영 HTTPS 환경에서는 true
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', authRequired, (req, res) => {
  // 토큰에 들어있는 uid/nn 제공
  res.json({ user: { user_id: req.user.uid, nickname: req.user.nn, role: req.user.role === 'admin' ? 'admin' : 'user' } });
});

export default router;