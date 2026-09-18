import { TOKEN_KEY } from '../lib/tab-session.js';
import { io } from 'socket.io-client';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Namespace '/chat' maintained. Socket.IO server path is '/socket.io' (Nginx proxies it).
export const socket = io(`${SOCKET_URL}/chat`, {
  auth: callback => callback({token:sessionStorage.getItem(TOKEN_KEY)}),
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  withCredentials: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 800,
});

export { API };