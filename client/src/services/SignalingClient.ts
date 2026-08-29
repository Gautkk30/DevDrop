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

  public async ensureConnected(timeoutMs = 15000): Promise<void> {
    if (this.isConnected()) return;

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Signaling server connection timeout')), timeoutMs);
    });

    return Promise.race([this.connect(), timeoutPromise]);
  }

  public send(message: SignalingMessage): void {
    this.logOutgoingDiagnostic(message);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
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

