import type { SignalingMessage, SignalingMessageType } from '../shared/types.js';

export type SignalingCallback = (msg: SignalingMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<SignalingCallback>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectPromise: Promise<void> | null = null;
  private outgoingQueue: SignalingMessage[] = [];
  private isExplicitlyDisconnected = false;
  private signalingUrl: string;
  private rejoinMessage: SignalingMessage | null = null;
  private hasEverConnected = false;

  constructor(url?: string) {
    if (url) {
      this.signalingUrl = url;
    } else if (import.meta.env.VITE_SIGNALING_URL) {
      this.signalingUrl = import.meta.env.VITE_SIGNALING_URL;
    } else if (import.meta.env.PROD) {
      this.signalingUrl = 'wss://devdrop-server.onrender.com/ws';
    } else {
      this.signalingUrl = 'ws://localhost:3001/ws';
    }
    console.log('[DIAGNOSTIC] 6. SignalingClient initialized with target URL:', this.signalingUrl, '(import.meta.env.PROD:', import.meta.env.PROD, ')');
  }

  public getUrl(): string {
    return this.signalingUrl;
  }

  public isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(): Promise<void> {
    this.isExplicitlyDisconnected = false;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    console.log('[SignalingClient] Connecting to signaling server:', this.signalingUrl);

    this.connectPromise = new Promise((resolve, reject) => {
      let isResolvedOrRejected = false;

      try {
        const ws = new WebSocket(this.signalingUrl);
        this.ws = ws;

        ws.onopen = () => {
          console.log('[SignalingClient] WebSocket OPEN:', this.signalingUrl);
          this.startHeartbeat();

          // Auto-rejoin room after unexpected reconnect (e.g. Render process restart)
          if (this.hasEverConnected && this.rejoinMessage) {
            const hasPendingRoomAction = this.outgoingQueue.some(
              (m) => m.type === 'ROOM_CREATE' || m.type === 'ROOM_JOIN'
            );
            if (!hasPendingRoomAction) {
              console.log('[SignalingClient] Auto-rejoining room after reconnect...');
              this.enqueueMessage(this.rejoinMessage);
            }
          }
          this.hasEverConnected = true;

          this.flushOutgoingQueue();

          if (!isResolvedOrRejected) {
            isResolvedOrRejected = true;
            this.connectPromise = null;
            resolve();
          }
        };

        ws.onmessage = (event) => {
          try {
            const message: SignalingMessage = JSON.parse(event.data);
            this.logIncomingDiagnostic(message);
            this.notifyListeners(message);
          } catch (err) {
            console.error('[SignalingClient] Message parse error:', err);
          }
        };

        ws.onerror = (err) => {
          console.error('[SignalingClient] WebSocket ERROR on:', this.signalingUrl, err);
          if (!isResolvedOrRejected) {
            isResolvedOrRejected = true;
            this.connectPromise = null;
            reject(new Error('WebSocket connection error on ' + this.signalingUrl));
          }
        };

        ws.onclose = (event) => {
          console.log(`[SignalingClient] WebSocket CLOSED (code: ${event.code}, reason: ${event.reason || 'none'})`);
          this.stopHeartbeat();
          if (!isResolvedOrRejected) {
            isResolvedOrRejected = true;
            this.connectPromise = null;
            reject(new Error(`WebSocket closed before connecting (code: ${event.code})`));
          }
          if (!this.isExplicitlyDisconnected) {
            this.scheduleReconnect();
          }
        };
      } catch (err) {
        console.error('[SignalingClient] Connection initialization error:', err);
        this.connectPromise = null;
        reject(err);
      }
    });

    return this.connectPromise;
  }

  public async ensureConnected(timeoutMs?: number): Promise<void> {
    if (this.isConnected()) return;

    const actualTimeout = timeoutMs ?? (import.meta.env.PROD ? 75000 : 15000);

    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timer = setTimeout(() => {
        this.clearPendingRoomRequests();
        reject(new Error(`Signaling server connection timeout (${actualTimeout / 1000}s)`));
      }, actualTimeout);
    });

    try {
      await Promise.race([this.connect(), timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  public clearPendingRoomRequests(): void {
    const prevCount = this.outgoingQueue.length;
    this.outgoingQueue = this.outgoingQueue.filter(
      (m) => m.type !== 'ROOM_CREATE' && m.type !== 'ROOM_JOIN'
    );
    if (prevCount !== this.outgoingQueue.length) {
      console.log('[SignalingClient] Cleared pending room requests from queue.');
    }
  }

  /**
   * Set a ROOM_JOIN message to be automatically sent after WebSocket reconnection.
   * This allows Device A to re-register in its room after a Render process restart
   * kills the WebSocket but doesn't destroy the Redis-persisted room.
   */
  public setAutoRejoin(message: SignalingMessage | null): void {
    this.rejoinMessage = message;
  }

  /**
   * Query room metadata via WebSocket (no HTTP — keeps Render from cold-starting).
   * Returns { hasPassword, deviceCount, code } on success, or null if room not found.
   */
  public async queryRoom(roomCode: string, timeoutMs = 8000): Promise<{ hasPassword: boolean; deviceCount: number; code: string } | null> {
    try {
      await this.ensureConnected(timeoutMs);
    } catch {
      return null; // Server offline or unreachable — skip pre-validation
    }

    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; unsub(); resolve(null); }
      }, 5000);

      const unsub = this.on('*', (msg) => {
        if (done) return;
        if (msg.type === 'ROOM_INFO' && msg.payload?.code) {
          const normalized = msg.payload.code;
          // Only resolve if this is for our queried code
          if (normalized.replace(/[^A-Z0-9]/g, '') === roomCode.replace(/[^A-Z0-9]/g, '')) {
            done = true;
            clearTimeout(timer);
            unsub();
            resolve({ hasPassword: !!msg.payload.hasPassword, deviceCount: msg.payload.deviceCount ?? 0, code: msg.payload.code });
          }
        } else if (msg.type === 'ROOM_ERROR' && msg.payload?.code) {
          if (msg.payload.code.replace(/[^A-Z0-9]/g, '') === roomCode.replace(/[^A-Z0-9]/g, '')) {
            done = true;
            clearTimeout(timer);
            unsub();
            resolve(null);
          }
        }
      });

      this.send({ type: 'ROOM_QUERY', payload: { roomCode } });
    });
  }

  public send(message: SignalingMessage): void {
    console.log('[DIAGNOSTIC] 4. SignalingClient.send() called for type:', message.type);
    console.log('[DIAGNOSTIC] 5. WebSocket readyState:', this.ws ? this.ws.readyState : 'NULL', '(1=OPEN, 0=CONNECTING, 2=CLOSING, 3=CLOSED)');
    console.log('[DIAGNOSTIC] 6. Target signaling URL:', this.signalingUrl);
    this.logOutgoingDiagnostic(message);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        console.log('[DIAGNOSTIC] 7. ws.send() successfully executed on open socket for type:', message.type);
      } catch (err) {
        console.error('[SignalingClient] Send failed, queuing message:', message.type, err);
        this.enqueueMessage(message);
      }
      return;
    }

    console.log(
      `[SignalingClient] WebSocket not OPEN (state: ${this.ws ? this.ws.readyState : 'NULL'}). Queuing message: ${message.type}`
    );
    this.enqueueMessage(message);

    // Trigger connection if not already connecting
    this.connect().catch((err) => {
      console.warn('[SignalingClient] Background connection attempt during send failed:', err.message);
    });
  }

  private enqueueMessage(message: SignalingMessage): void {
    // Avoid duplicate ROOM_CREATE or ROOM_JOIN requests in queue
    if (message.type === 'ROOM_CREATE' || message.type === 'ROOM_JOIN') {
      this.outgoingQueue = this.outgoingQueue.filter((m) => m.type !== message.type);
    }
    this.outgoingQueue.push(message);
  }

  private flushOutgoingQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (this.outgoingQueue.length > 0) {
      console.log(`[SignalingClient] Flushing ${this.outgoingQueue.length} queued message(s)...`);
      const queue = [...this.outgoingQueue];
      this.outgoingQueue = [];

      for (const msg of queue) {
        try {
          this.logOutgoingDiagnostic(msg);
          this.ws.send(JSON.stringify(msg));
          console.log('[DIAGNOSTIC] 7. ws.send() successfully executed from flushed queue for type:', msg.type);
        } catch (err) {
          console.error('[SignalingClient] Error flushing queued message:', msg.type, err);
          this.enqueueMessage(msg);
          break;
        }
      }
    }
  }

  private logOutgoingDiagnostic(message: SignalingMessage): void {
    switch (message.type) {
      case 'ROOM_CREATE':
        console.log('[SignalingClient] ➔ Outgoing ROOM_CREATE (device:', message.payload?.device?.name + ')');
        break;
      case 'ROOM_JOIN':
        console.log('[SignalingClient] ➔ Outgoing ROOM_JOIN (room:', message.payload?.roomCode, 'device:', message.payload?.device?.name + ')');
        break;
      case 'SIGNAL_OFFER':
      case 'SIGNAL_ANSWER':
      case 'SIGNAL_ICE':
      case 'TRANSFER_OFFER':
      case 'TRANSFER_ACCEPT':
      case 'TRANSFER_REJECT':
      case 'TRANSFER_CANCEL':
        console.log(`[SignalingClient] ➔ Outgoing ${message.type} to ${message.targetDeviceId}`);
        break;
      case 'PING':
        // no-op to avoid log spam
        break;
      default:
        console.log('[SignalingClient] ➔ Outgoing:', message.type);
    }
  }

  private logIncomingDiagnostic(message: SignalingMessage): void {
    switch (message.type) {
      case 'ROOM_CREATED':
        console.log('[SignalingClient] ⬅ Received ROOM_CREATED:', message.payload?.room?.code);
        break;
      case 'ROOM_JOINED':
        console.log('[SignalingClient] ⬅ Received ROOM_JOINED:', message.payload?.room?.code);
        break;
      case 'ROOM_ERROR':
        console.error('[SignalingClient] ⬅ Received ROOM_ERROR:', message.error);
        break;
      case 'PEER_JOINED':
        console.log('[SignalingClient] ⬅ Received PEER_JOINED:', message.payload?.device?.name, '(' + message.payload?.device?.id + ')');
        break;
      case 'PEER_LEFT':
        console.log('[SignalingClient] ⬅ Received PEER_LEFT:', message.payload?.leftDevice?.name || message.payload?.deviceId);
        break;
      case 'PONG':
        // no-op to avoid log spam
        break;
      default:
        console.log('[SignalingClient] ⬅ Received:', message.type);
    }
  }

  public on(type: SignalingMessageType | '*', callback: SignalingCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  private notifyListeners(message: SignalingMessage): void {
    const specificListeners = this.listeners.get(message.type);
    if (specificListeners) {
      specificListeners.forEach((cb) => cb(message));
    }
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((cb) => cb(message));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING' });
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isExplicitlyDisconnected) return;
    console.log('[SignalingClient] Scheduling reconnect in 3s...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.warn('[SignalingClient] Reconnect attempt failed:', err.message);
      });
    }, 3000);
  }

  public disconnect(): void {
    this.isExplicitlyDisconnected = true;
    this.outgoingQueue = [];
    this.connectPromise = null;
    this.rejoinMessage = null;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const signalingClient = new SignalingClient();

