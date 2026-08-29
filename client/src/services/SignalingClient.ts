import type { SignalingMessage, SignalingMessageType } from '../shared/types.js';

export type SignalingCallback = (msg: SignalingMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<SignalingCallback>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
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

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        return resolve();
      }

      try {
        this.ws = new WebSocket(this.signalingUrl);

        this.ws.onopen = () => {
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: SignalingMessage = JSON.parse(event.data);
            this.notifyListeners(message);
          } catch (err) {
            console.error('[SignalingClient] Message parse error:', err);
          }
        };

        this.ws.onerror = (err) => {
          console.error('[SignalingClient] WebSocket error:', err);
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.scheduleReconnect();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public send(message: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[SignalingClient] Cannot send message, WebSocket not connected:', message.type);
      return;
    }
    this.ws.send(JSON.stringify(message));
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
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.warn('[SignalingClient] Reconnect failed:', err);
      });
    }, 3000);
  }

  public disconnect(): void {
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
