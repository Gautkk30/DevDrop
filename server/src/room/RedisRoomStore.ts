import Redis from 'ioredis';
import { RoomManager } from './RoomManager.js';

export interface SerializedRoom {
  id: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  passwordHash: string;
  isOneTime: boolean;
  hostDeviceId: string;
}

export interface IRoomPersistenceStore {
  saveRoom(room: SerializedRoom): Promise<void>;
  getRoomByCode(code: string): Promise<SerializedRoom | null>;
  getRoomById(roomId: string): Promise<SerializedRoom | null>;
  deleteRoom(roomId: string, code?: string): Promise<void>;
  isConnected(): boolean;
  disconnect?(): Promise<void>;
}

export class RedisRoomStore implements IRoomPersistenceStore {
  private redis: Redis;
  private connected = false;

  constructor(redisUrl: string) {
    // Log safe connection target without exposing credentials
    try {
      const parsed = new URL(redisUrl);
      console.log(`[RedisRoomStore] Initializing connection to ${parsed.protocol}//${parsed.hostname}:${parsed.port || '6379'}`);
    } catch {
      console.log('[RedisRoomStore] Initializing connection to configured Redis URL');
    }

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableReadyCheck: true,
      retryStrategy(times: number) {
        if (times > 10) return null;
        return Math.min(times * 200, 2000);
      },
    });

    this.redis.on('connect', () => {
      this.connected = true;
      console.log('[RedisRoomStore] Connected to Redis instance');
    });

    this.redis.on('ready', () => {
      this.connected = true;
      console.log('[RedisRoomStore] Redis connection ready for operations');
    });

    this.redis.on('close', () => {
      this.connected = false;
      console.warn('[RedisRoomStore] Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      console.log('[RedisRoomStore] Reconnecting to Redis...');
    });

    this.redis.on('error', (err: Error) => {
      this.connected = false;
      console.error('[RedisRoomStore] Redis connection/operation error:', err.message);
    });
  }

  public isConnected(): boolean {
    return this.connected;
  }

  async saveRoom(room: SerializedRoom): Promise<void> {
    const key = `room:${room.id}`;
    const now = Date.now();
    const ttlSeconds = Math.max(1, Math.ceil((room.expiresAt - now) / 1000));
    const normalizedCode = RoomManager.normalizeCode(room.code);

    console.log(`[RedisRoomStore] saveRoom START: id="${room.id}" code="${room.code}" normalized="${normalizedCode}" expiresAt=${room.expiresAt} now=${now} ttlSeconds=${ttlSeconds}`);

    try {
      const pipeline = this.redis.pipeline();
      pipeline.hset(key, {
        id: room.id,
        code: room.code,
        createdAt: String(room.createdAt),
        expiresAt: String(room.expiresAt),
        passwordHash: room.passwordHash || '',
        isOneTime: room.isOneTime ? '1' : '0',
        hostDeviceId: room.hostDeviceId,
      });
      pipeline.expire(key, ttlSeconds);
      pipeline.set(`code:${normalizedCode}`, room.id, 'EX', ttlSeconds);

      const results = await pipeline.exec();
      if (results) {
        for (const [err] of results) {
          if (err) {
            console.error(`[RedisRoomStore] Pipeline error for room ${room.id}:`, err);
            throw err;
          }
        }
      }
      console.log(`[RedisRoomStore] saveRoom SUCCESS for id="${room.id}", code="${room.code}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RedisRoomStore] Failed to save room ${room.id} to Redis:`, msg);
      throw err;
    }
  }

  async getRoomByCode(code: string): Promise<SerializedRoom | null> {
    try {
      const normalizedCode = RoomManager.normalizeCode(code);
      const rawUpper = code.trim().toUpperCase();

      let roomId = await this.redis.get(`code:${normalizedCode}`);
      if (!roomId && rawUpper !== normalizedCode) {
        roomId = await this.redis.get(`code:${rawUpper}`);
      }
      if (!roomId) {
        console.log(`[RedisRoomStore] getRoomByCode: no roomId mapping found for code "${code}" (key: code:${normalizedCode})`);
        return null;
      }

      console.log(`[RedisRoomStore] getRoomByCode: resolved code "${code}" -> roomId "${roomId}"`);
      return await this.getRoomById(roomId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RedisRoomStore] Failed to get room by code "${code}" from Redis:`, msg);
      return null;
    }
  }

  async getRoomById(roomId: string): Promise<SerializedRoom | null> {
    try {
      const data = await this.redis.hgetall(`room:${roomId}`);
      if (!data || !data.id) {
        console.log(`[RedisRoomStore] getRoomById: key room:${roomId} not found or empty`);
        return null;
      }

      const room: SerializedRoom = {
        id: data.id,
        code: data.code,
        createdAt: parseInt(data.createdAt, 10),
        expiresAt: parseInt(data.expiresAt, 10),
        passwordHash: data.passwordHash || '',
        isOneTime: data.isOneTime === '1',
        hostDeviceId: data.hostDeviceId,
      };

      if (isNaN(room.expiresAt) || Date.now() > room.expiresAt) {
        console.log(`[RedisRoomStore] getRoomById: room ${roomId} expired (expiresAt: ${room.expiresAt}, now: ${Date.now()})`);
        await this.deleteRoom(roomId, room.code);
        return null;
      }

      return room;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RedisRoomStore] Failed to get room ${roomId} from Redis:`, msg);
      return null;
    }
  }

  async deleteRoom(roomId: string, code?: string): Promise<void> {
    try {
      const keys = [`room:${roomId}`];
      if (code) {
        keys.push(`code:${RoomManager.normalizeCode(code)}`);
        keys.push(`code:${code.toUpperCase()}`);
      }
      await this.redis.del(...keys);
      console.log(`[RedisRoomStore] deleteRoom: deleted keys ${JSON.stringify(keys)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RedisRoomStore] Failed to delete room ${roomId} from Redis:`, msg);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
