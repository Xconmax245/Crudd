import { io, type Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Create a fresh match socket. We intentionally do NOT autoConnect so the
 * caller can attach listeners before the handshake completes.
 */
export function createMatchSocket(): Socket {
  return io(API_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    withCredentials: true,
  });
}
