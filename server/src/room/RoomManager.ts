import bcrypt from 'bcryptjs';
import { DeviceInfo, RoomMetadata } from '../shared/types.js';
import { WebSocket } from 'ws';

export interface RoomPeer {
  device: DeviceInfo;
  ws: WebSocket;
}

export interface InternalRoom {
  id: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  passwordHash?: string;
  isOneTime: boolean;
  peers: Map<string, RoomPeer>; // deviceId -> RoomPeer
  hostDeviceId: string;
}

export class RoomManager {
  private rooms: Map<string, InternalRoom> = new Map(); // roomId -> InternalRoom
  private codeToRoomId: Map<string, string> = new Map(); // upper code -> roomId
  private deviceToRoomId: Map<string, string> = new Map(); // deviceId -> roomId
  private cleanupInterval: NodeJS.Timeout;

  constructor(private defaultTtlMs: number = 15 * 60 * 1000) {
    // Run cleanup sweep every 30 seconds
    this.cleanupInterval = setInterval(() => this.sweepExpiredRooms(), 30 * 1000);
  }

  public createRoom(options: {
    password?: string;
    isOneTime?: boolean;
    ttlMs?: number;
    hostDevice: DeviceInfo;
    ws: WebSocket;
  }): { room: RoomMetadata; hostDevice: DeviceInfo } {
    const roomId = this.generateRoomId();
    const code = this.generateRoomCode();
    const now = Date.now();
    const expiresAt = now + (options.ttlMs || this.defaultTtlMs);

    let passwordHash: string | undefined = undefined;
    if (options.password && options.password.trim().length > 0) {
      passwordHash = bcrypt.hashSync(options.password.trim(), 10);
    }

    const hostPeer: RoomPeer = {
      device: { ...options.hostDevice, isHost: true },
      ws: options.ws,
    };

    const room: InternalRoom = {
      id: roomId,
      code,
      createdAt: now,
      expiresAt,
      passwordHash,
      isOneTime: !!options.isOneTime,
      peers: new Map([[options.hostDevice.id, hostPeer]]),
      hostDeviceId: options.hostDevice.id,
    };

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(code.toUpperCase(), roomId);
    this.deviceToRoomId.set(options.hostDevice.id, roomId);

    return {
      room: this.toPublicMetadata(room),
      hostDevice: hostPeer.device,
    };
  }

  public getRoomByCode(code: string): InternalRoom | undefined {
    const roomId = this.codeToRoomId.get(code.trim().toUpperCase());
    if (!roomId) return undefined;
    return this.getRoomById(roomId);
  }

  public getRoomById(roomId: string): InternalRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    if (Date.now() > room.expiresAt) {
      this.closeRoom(roomId, 'ROOM_EXPIRED');
      return undefined;
    }

    return room;
  }

  public validatePassword(room: InternalRoom, password?: string): boolean {
    if (!room.passwordHash) return true;
    if (!password) return false;
    return bcrypt.compareSync(password.trim(), room.passwordHash);
  }

  public joinRoom(
    roomIdOrCode: string,
    device: DeviceInfo,
    ws: WebSocket,
    password?: string
  ): { room: RoomMetadata; peers: DeviceInfo[] } {
    let room = this.getRoomByCode(roomIdOrCode) || this.getRoomById(roomIdOrCode);

    if (!room) {
      throw new Error('Room not found or expired');
    }

    if (room.passwordHash && !this.validatePassword(room, password)) {
      throw new Error('Invalid room password');
    }

    const peer: RoomPeer = {
      device: { ...device, isHost: false },
      ws,
    };

    room.peers.set(device.id, peer);
    this.deviceToRoomId.set(device.id, room.id);

    const publicPeers = Array.from(room.peers.values()).map((p) => p.device);

    return {
      room: this.toPublicMetadata(room),
      peers: publicPeers,
    };
  }

  public removeDevice(deviceId: string): { roomId: string; room?: RoomMetadata; leftDevice?: DeviceInfo } | undefined {
    const roomId = this.deviceToRoomId.get(deviceId);
    if (!roomId) return undefined;

    this.deviceToRoomId.delete(deviceId);
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const peer = room.peers.get(deviceId);
    const leftDevice = peer?.device;
    room.peers.delete(deviceId);

    // If host left or no peers left or one-time room completed session, close room
    if (room.peers.size === 0 || (room.isOneTime && leftDevice?.isHost)) {
      this.closeRoom(roomId, 'HOST_LEFT');
      return { roomId, leftDevice };
    }

    return {
      roomId,
      room: this.toPublicMetadata(room),
      leftDevice,
    };
  }

  public closeRoom(roomId: string, reason: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Notify all remaining peers
    for (const peer of room.peers.values()) {
      try {
        peer.ws.send(
          JSON.stringify({
            type: 'ROOM_EXPIRED',
            roomId,
            error: reason,
          })
        );
      } catch (e) {
        // ignore send error
      }
      this.deviceToRoomId.delete(peer.device.id);
    }

    this.codeToRoomId.delete(room.code.toUpperCase());
    this.rooms.delete(roomId);
  }

  public getRoomForDevice(deviceId: string): InternalRoom | undefined {
    const roomId = this.deviceToRoomId.get(deviceId);
    if (!roomId) return undefined;
    return this.getRoomById(roomId);
  }

  public toPublicMetadata(room: InternalRoom): RoomMetadata {
    return {
      id: room.id,
      code: room.code,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      deviceCount: room.peers.size,
      hasPassword: !!room.passwordHash,
      isOneTime: room.isOneTime,
    };
  }

  private sweepExpiredRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (now > room.expiresAt) {
        this.closeRoom(roomId, 'Expired by system sweep');
      }
    }
  }

  private generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // readable, non-confusing chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      if (i === 3) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private generateRoomId(): string {
    return 'rm_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  }

  public destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
