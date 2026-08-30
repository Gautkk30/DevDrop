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
    const roomKey = `room:${room.id}`;
    const normalizedCode = RoomManager.normalizeCode(room.code);
    const codeKey = `code:${normalizedCode}`;
    const now = Date.now();
    const ttlSeconds = Math.max(1, Math.ceil((room.expiresAt - now) / 1000));

    console.log(`[RedisRoomStore] SAVE_START room=${room.id} code=${room.code} normalized=${normalizedCode}`);
    console.log(`[RedisRoomStore] SAVE_KEY ${roomKey}`);
    console.log(`[RedisRoomStore] SAVE_KEY ${codeKey}`);
    console.log(`[RedisRoomStore] SAVE_DETAILS expiresAt=${room.expiresAt} now=${now} ttlSeconds=${ttlSeconds}`);

    try {
      const roomJson = JSON.stringify(room);
      const pipeline = this.redis.pipeline();
      pipeline.set(roomKey, roomJson, 'EX', ttlSeconds);
      pipeline.set(codeKey, room.id, 'EX', ttlSeconds);

      const results = await pipeline.exec();
      if (results) {
        for (const [err] of results) {
          if (err) {
            console.error(`[RedisRoomStore] Pipeline error for room ${room.id}:`, err);
            throw err;
          }
        }
      }

      console.log(`[RedisRoomStore] SAVE_SUCCESS room=${room.id} code=${normalizedCode}`);

      // Verify keys actually exist in Redis immediately after write
      const [roomKeyExists, savedRoomId] = await Promise.all([
        this.redis.exists(roomKey),
        this.redis.get(codeKey),
      ]);

      const isRoomOk = roomKeyExists === 1;
      const isCodeOk = savedRoomId === room.id;

      console.log(`[RedisRoomStore] SAVE_VERIFY roomKeyExists=${isRoomOk} codeKeyExists=${isCodeOk}`);

      if (!isRoomOk || !isCodeOk) {
        throw new Error(`Persistence verification failed for room ${room.id} (roomKeyExists=${isRoomOk}, codeKeyExists=${isCodeOk})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RedisRoomStore] SAVE_FAILED room=${room.id} error=${msg}`);
      throw err;
    }
  }

  async getRoomByCode(code: string): Promise<SerializedRoom | null> {
    try {
      const normalizedCode = RoomManager.normalizeCode(code);
      const codeKey = `code:${normalizedCode}`;
      console.log(`[RedisRoomStore] getRoomByCode: looking up key "${codeKey}" for code "${code}"`);

      let roomId = await this.redis.get(codeKey);
      if (!roomId) {
        const rawUpper = code.trim().toUpperCase();
        if (rawUpper !== normalizedCode) {
          roomId = await this.redis.get(`code:${rawUpper}`);
        }
      }

      if (!roomId) {
        console.log(`[RedisRoomStore] getRoomByCode: no roomId mapping found for code "${normalizedCode}" (key: ${codeKey})`);
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
      const roomKey = `room:${roomId}`;
      console.log(`[RedisRoomStore] getRoomById: looking up key "${roomKey}"`);

      const data = await this.redis.get(roomKey);
      if (!data) {
        console.log(`[RedisRoomStore] getRoomById: key ${roomKey} not found or empty`);
        return null;
      }

      let room: SerializedRoom;
      try {
        room = JSON.parse(data);
      } catch (err) {
        console.error(`[RedisRoomStore] getRoomById: failed to parse JSON for ${roomKey}:`, err);
        return null;
      }

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
