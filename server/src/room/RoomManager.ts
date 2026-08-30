import bcrypt from 'bcryptjs';
import { DeviceInfo, RoomMetadata } from '../shared/types.js';
import { WebSocket } from 'ws';
import { IRoomPersistenceStore, RedisRoomStore } from './RedisRoomStore.js';

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
  private instanceId: string = 'inst_' + Math.random().toString(36).substring(2, 7);
  private rooms: Map<string, InternalRoom> = new Map(); // roomId -> InternalRoom
  private codeToRoomId: Map<string, string> = new Map(); // normalized & raw code -> roomId
  private deviceToRoomId: Map<string, string> = new Map(); // deviceId -> roomId
  private cleanupInterval: NodeJS.Timeout;
  private redisStore: IRoomPersistenceStore | null = null;

  constructor(private defaultTtlMs: number = 15 * 60 * 1000) {
    console.log(`[ROOM DEBUG] RoomManager initialized instance=${this.instanceId}`);
    // Run cleanup sweep every 30 seconds
    this.cleanupInterval = setInterval(() => this.sweepExpiredRooms(), 30 * 1000);
  }

  public setRedisStore(store: IRoomPersistenceStore): void {
    this.redisStore = store;
    console.log(`[ROOM DEBUG] Redis store attached to RoomManager instance=${this.instanceId}`);
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public static normalizeCode(code: string): string {
    return code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
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

    const rawCodeUpper = code.toUpperCase();
    const normalizedCode = RoomManager.normalizeCode(code);

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(rawCodeUpper, roomId);
    this.codeToRoomId.set(normalizedCode, roomId);
    this.deviceToRoomId.set(options.hostDevice.id, roomId);

    console.log(`[ROOM DEBUG] CREATE requested instance=${this.instanceId} device=${options.hostDevice.id}`);
    console.log(`[ROOM DEBUG] CREATED instance=${this.instanceId} room=${roomId} code=${code}`);
    console.log(`[ROOM DEBUG] ACTIVE_ROOMS instance=${this.instanceId} count=${this.rooms.size}`);

    // Persist to Redis (fire-and-forget) so room survives process restart
    if (this.redisStore) {
      this.redisStore.saveRoom({
        id: roomId,
        code,
        createdAt: now,
        expiresAt,
        passwordHash: passwordHash || '',
        isOneTime: !!options.isOneTime,
        hostDeviceId: options.hostDevice.id,
      }).catch((err: Error) => {
        console.error(`[ROOM DEBUG] Redis persist failed for room=${roomId}:`, err.message);
      });
    }

    return {
      room: this.toPublicMetadata(room),
      hostDevice: hostPeer.device,
    };
  }

  public getRoomByCode(code: string): InternalRoom | undefined {
    const rawUpper = code.trim().toUpperCase();
    const normalized = RoomManager.normalizeCode(code);
    const roomId = this.codeToRoomId.get(rawUpper) || this.codeToRoomId.get(normalized);
    if (!roomId) return undefined;
    return this.getRoomById(roomId);
  }

  /**
   * Try to find a room in-memory first. If not found and Redis is available,
   * attempt to rehydrate from Redis. Call this before joinRoom() in the
   * SignalingServer so the synchronous joinRoom() finds the room in-memory.
   */
  public async findOrRehydrateRoom(code: string): Promise<InternalRoom | undefined> {
    const inMemory = this.getRoomByCode(code);
    if (inMemory) return inMemory;

    if (!this.redisStore) return undefined;

    try {
      const serialized = await this.redisStore.getRoomByCode(code);
      if (!serialized) return undefined;

      // Check if another concurrent request already rehydrated it
      if (this.rooms.has(serialized.id)) {
        return this.rooms.get(serialized.id);
      }

      // Rehydrate into in-memory store (peers start empty — they must reconnect)
      const room: InternalRoom = {
        id: serialized.id,
        code: serialized.code,
        createdAt: serialized.createdAt,
        expiresAt: serialized.expiresAt,
        passwordHash: serialized.passwordHash || undefined,
        isOneTime: serialized.isOneTime,
        peers: new Map(),
        hostDeviceId: serialized.hostDeviceId,
      };

      const normalizedCode = RoomManager.normalizeCode(room.code);
      this.rooms.set(room.id, room);
      this.codeToRoomId.set(room.code.toUpperCase(), room.id);
      this.codeToRoomId.set(normalizedCode, room.id);

      console.log(`[ROOM DEBUG] REHYDRATED from Redis instance=${this.instanceId} room=${room.id} code=${room.code}`);
      console.log(`[ROOM DEBUG] ACTIVE_ROOMS instance=${this.instanceId} count=${this.rooms.size}`);

      return room;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[ROOM DEBUG] Redis rehydrate failed for code=${code}:`, errMsg);
      return undefined;
    }
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
    const rawInput = roomIdOrCode.trim();
    const normalizedInput = RoomManager.normalizeCode(rawInput);

    console.log(`[ROOM DEBUG] JOIN requested instance=${this.instanceId} room=${rawInput} device=${device.id}`);
    console.log(`[ROOM DEBUG] JOIN lookup instance=${this.instanceId} normalized=${normalizedInput}`);

    let room = this.getRoomByCode(rawInput) || this.getRoomById(rawInput) || this.getRoomByCode(normalizedInput);

    if (!room) {
      console.log(`[ROOM DEBUG] ACTIVE_ROOMS instance=${this.instanceId} count=${this.rooms.size}`);
      console.warn(`[ROOM DEBUG] [${this.instanceId}] JOIN_FAILED: Room "${rawInput}" not found among ${this.rooms.size} active rooms.`);
      throw new Error('Room not found or expired');
    }

    if (room.passwordHash && !this.validatePassword(room, password)) {
      throw new Error('Invalid room password');
    }

    const isHost = room.hostDeviceId === device.id;
    const peer: RoomPeer = {
      device: { ...device, isHost },
      ws,
    };

    room.peers.set(device.id, peer);
    this.deviceToRoomId.set(device.id, room.id);

    console.log(`[ROOM DEBUG] ACTIVE_ROOMS instance=${this.instanceId} count=${this.rooms.size}`);

    const publicPeers = Array.from(room.peers.values()).map((p) => p.device);

    return {
      room: this.toPublicMetadata(room),
      peers: publicPeers,
    };
  }

  public removeDevice(deviceId: string, ws?: WebSocket): { roomId: string; room?: RoomMetadata; leftDevice?: DeviceInfo } | undefined {
    const roomId = this.deviceToRoomId.get(deviceId);
    if (!roomId) return undefined;

    const room = this.rooms.get(roomId);
    if (!room) {
      this.deviceToRoomId.delete(deviceId);
      return undefined;
    }

    const peer = room.peers.get(deviceId);
    // If a specific ws was provided and it doesn't match the current peer's active ws, do NOT remove the peer
    if (ws && peer && peer.ws !== ws) {
      console.log(`[ROOM DEBUG] [${this.instanceId}] Ignoring disconnect from stale/previous socket for device=${deviceId}`);
      return undefined;
    }

    this.deviceToRoomId.delete(deviceId);
    const leftDevice = peer?.device;
    room.peers.delete(deviceId);

    console.log(`[ROOM DEBUG] REMOVE_DEVICE instance=${this.instanceId} device=${deviceId} room=${roomId} reason=peer_disconnect`);
    console.log(`[ROOM DEBUG] ACTIVE_ROOMS instance=${this.instanceId} count=${this.rooms.size}`);

    // NOTE: The room is NOT destroyed when peers.size === 0.
    // Rooms are preserved for their configured TTL so that devices can reconnect across
    // momentary network drops or mobile backgrounding.
    // Cleanup occurs when Date.now() > room.expiresAt or when closeRoom is explicitly invoked.

    return {
      roomId,
      room: this.toPublicMetadata(room),
      leftDevice,
    };
  }

  public closeRoom(roomId: string, reason: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`[ROOM DEBUG] ROOM_DESTROYED instance=${this.instanceId} room=${roomId} reason=${reason}`);

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
    this.codeToRoomId.delete(RoomManager.normalizeCode(room.code));
    this.rooms.delete(roomId);
    console.log(`[ROOM DEBUG] ACTIVE_ROOMS instance=${this.instanceId} count=${this.rooms.size}`);

    // Also remove from Redis
    if (this.redisStore) {
      this.redisStore.deleteRoom(roomId, room.code).catch((err: Error) => {
        console.error(`[ROOM DEBUG] Redis delete failed for room=${roomId}:`, err.message);
      });
    }
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

