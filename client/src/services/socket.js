/**
 * socket.js
 * Client-side Socket.IO instance for real-time IMD disaster alert telemetry.
 */
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('⚡ [WeatherGPT WebSocket] Connected to server telemetry stream');
    });

    socket.on('disconnect', () => {
      console.log('🔌 [WeatherGPT WebSocket] Disconnected from server');
    });
  }
  return socket;
}

export default getSocket();
