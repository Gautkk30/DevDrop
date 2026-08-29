import { Router } from 'express';
import os from 'os';
import { RoomManager } from '../room/RoomManager.js';

export function createHealthRouter(roomManager: RoomManager) {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'DevDrop Ephemeral Signaling Server',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      pid: process.pid,
      host: os.hostname(),
      instance: roomManager.getInstanceId(),
      activeRooms: roomManager.getRoomCount(),
    });
  });

  router.get('/api/room/validate/:code', (req, res) => {
    const code = req.params.code;
    const room = roomManager.getRoomByCode(code);

    if (!room) {
      return res.status(404).json({
        valid: false,
        error: 'Room not found or expired',
        pid: process.pid,
        instance: roomManager.getInstanceId(),
        activeRooms: roomManager.getRoomCount(),
      });
    }

    res.json({
      valid: true,
      code: room.code,
      hasPassword: !!room.passwordHash,
      deviceCount: room.peers.size,
      expiresAt: room.expiresAt,
      pid: process.pid,
      instance: roomManager.getInstanceId(),
    });
  });

  return router;
}
