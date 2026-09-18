// server/routes/auth.routes.js
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
  res.json({ user: { user_id: req.user.uid, nickname: req.user.nn } });
});

export default router;