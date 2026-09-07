/**
 * socketService.js
 * WebSocket service using Socket.IO.
 * Handles real-time events:
 *  - weather_update
 *  - alert_update
 *  - system_status
 *  - connection_status
 */
const { Server } = require('socket.io');
const logger = require('../config/logger');
const { getKeyStatus } = require('./geminiService');

let io = null;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`[WebSocket] Client connected: ${socket.id}`);

    // Send initial status on connect
    socket.emit('connection_status', {
      connected: true,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    socket.emit('system_status', {
      status: 'online',
      weatherApi: 'active',
      aiKeys: getKeyStatus(),
      timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[WebSocket] Client disconnected (${socket.id}): ${reason}`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

function broadcastAlert(alertPayload) {
  if (io) {
    io.emit('alert_update', {
      ...alertPayload,
      timestamp: new Date().toISOString(),
    });
  }
}

function broadcastWeatherUpdate(weatherData) {
  if (io) {
    io.emit('weather_update', {
      ...weatherData,
      timestamp: new Date().toISOString(),
    });
  }
}

function broadcastSystemStatus(statusData) {
  if (io) {
    io.emit('system_status', {
      ...statusData,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  init,
  getIO,
  broadcastAlert,
  broadcastWeatherUpdate,
  broadcastSystemStatus,
};
