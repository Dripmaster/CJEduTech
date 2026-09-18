import jwt from 'jsonwebtoken';
import process from 'node:process';
export function isTeacherSocket(socket) {
  const token = socket.handshake.auth?.token;
  if (!token) return false;
  try { return jwt.verify(token, process.env.JWT_SECRET).role === 'admin'; }
  catch { return false; }
}
