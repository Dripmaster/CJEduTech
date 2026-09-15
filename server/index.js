import express from "express";
import process from 'node:process';
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import cookieParser from "cookie-parser";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import chatRouter from './routes/socket.routes.js';
import { errorHandler } from './middlewares/error.js';
import { randomUUID } from "crypto";
import { initChatSocket } from './services/socket.service.js';
import { initCourseControl } from './services/course-control.service.js';

// ENV: AI_SERVER_BASE (e.g., http://localhost:8000) used by services/review.service.js

dotenv.config();
const allowed = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean) : [
  'https://aigora.kr',
  'https://www.aigora.kr',
  'https://api.aigora.kr',
  "http://localhost:5173",
  "http://localhost:8080",
];

const app = express();
app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // SSR/healthz/curl
    return cb(null, allowed.includes(origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use(cookieParser());
// HTTP 서버 및 Socket.IO 설정
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  path: '/socket.io',
  cors: {
    origin: allowed,
    methods: ['GET','POST'],
    credentials: true
  }
});

// MySQL 커넥션 풀
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306, // ← 포트 옵션 추가
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

export default pool;

// 헬스체크
app.get('/health', (req, res) => res.json({ ok: true }));
// 헬스체크
app.get('/healthz', (req, res) => res.json({ ok: true }));

//로그인 api
app.use('/api/auth', authRoutes);

//유저 관련 api
app.use('/api/user', userRoutes);

// chat overview route
app.use('/api/chat', chatRouter);

import reviewRoutes from './routes/review.routes.js';
app.use('/api/review', reviewRoutes);

import gameRoutes from './routes/game.routes.js';
app.use('/api/game', gameRoutes);

// Initialize chat socket namespace/handlers from service
initChatSocket(io);
initCourseControl(io);

//퀴즈 api
import quizRoutes from './routes/quiz.routes.js';
app.use('/api/quiz', quizRoutes);

//에러 핸들러 (마지막에))
app.use(errorHandler);

const PORT = Number(process.env.PORT || 3000);
httpServer.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`API + Socket.IO UP http://localhost:${PORT}`));
