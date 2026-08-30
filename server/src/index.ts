import http from 'http';
import os from 'os';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { RoomManager } from './room/RoomManager.js';
import { RedisRoomStore } from './room/RedisRoomStore.js';
import { SignalingServer } from './ws/SignalingServer.js';
import { createHealthRouter } from './routes/health.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || '*';
const REDIS_URL = process.env.REDIS_URL || process.env.KEYVALUE_URL || process.env.RENDER_KEYVALUE_URL;

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const roomManager = new RoomManager();

// Connect to Redis for room persistence across process restarts
if (REDIS_URL) {
  const redisStore = new RedisRoomStore(REDIS_URL);
  roomManager.setRedisStore(redisStore);
  console.log('[Server] Redis room persistence ENABLED');
} else {
  console.log('[Server] Redis room persistence DISABLED (no REDIS_URL) — rooms are in-memory only');
}

app.use('/', createHealthRouter(roomManager));

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
new SignalingServer(wss, roomManager);

server.listen(PORT, () => {
  const host = os.hostname();
  console.log(`=======================================================`);
  console.log(`  DevDrop Ephemeral Signaling Server Listening on :${PORT}`);
  console.log(`  WebSocket Endpoint: ws://localhost:${PORT}/ws`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  pid=${process.pid} host=${host} instance=${roomManager.getInstanceId()}`);
  console.log(`  Redis: ${REDIS_URL ? 'connected' : 'disabled (in-memory only)'}`);
  console.log(`=======================================================`);
});

const handleShutdown = () => {
  console.log('[Server] Gracefully shutting down...');
  roomManager.destroy();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Prevent unhandled rejections from crashing the process and losing all room state
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled promise rejection (process preserved):', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception (process preserved):', err);
});

