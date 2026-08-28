import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { RoomManager } from './room/RoomManager.js';
import { SignalingServer } from './ws/SignalingServer.js';
import { createHealthRouter } from './routes/health.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || '*';

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const roomManager = new RoomManager();
app.use('/', createHealthRouter(roomManager));

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
new SignalingServer(wss, roomManager);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  DevDrop Ephemeral Signaling Server Listening on :${PORT}`);
  console.log(`  WebSocket Endpoint: ws://localhost:${PORT}/ws`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=======================================================`);
});

process.on('SIGTERM', () => {
  console.log('[Server] Gracefully shutting down...');
  roomManager.destroy();
  server.close(() => {
    process.exit(0);
  });
});
