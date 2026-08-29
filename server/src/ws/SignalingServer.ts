import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { RoomManager } from '../room/RoomManager.js';
import { SignalingMessage } from '../shared/types.js';

export class SignalingServer {
  private wsToDeviceId: Map<WebSocket, string> = new Map();

  constructor(private wss: WebSocketServer, private roomManager: RoomManager) {
    this.init();
  }

  private init() {
    this.wss.on('connection', (ws: WebSocket) => {
      ws.on('message', (data: RawData) => {
        try {
          const message: SignalingMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.sendError(ws, 'INVALID_JSON', 'Failed to parse signaling message: ' + errorMsg);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err: Error) => {
        console.error('[SignalingServer] WebSocket error:', err);
        this.handleDisconnect(ws);
      });
    });
  }

  private handleMessage(ws: WebSocket, msg: SignalingMessage) {
    switch (msg.type) {
      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG' }));
        break;

      case 'ROOM_CREATE': {
        const { password, isOneTime, device } = msg.payload || {};
        if (!device || !device.id || !device.name) {
          return this.sendError(ws, 'BAD_REQUEST', 'Missing device information');
        }

        try {
          const { room, hostDevice } = this.roomManager.createRoom({
            password,
            isOneTime,
            hostDevice: device,
            ws,
          });

          this.wsToDeviceId.set(ws, device.id);

          ws.send(
            JSON.stringify({
              type: 'ROOM_CREATED',
              roomId: room.id,
              senderDeviceId: device.id,
              payload: {
                room,
                device: hostDevice,
                peers: [hostDevice],
              },
            })
          );
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.sendError(ws, 'CREATE_FAILED', errorMsg);
        }
        break;
      }

      case 'ROOM_JOIN': {
        const { roomCode, password, device } = msg.payload || {};
        if (!roomCode || !device || !device.id) {
          return this.sendError(ws, 'BAD_REQUEST', 'Missing room code or device info');
        }

        try {
          const { room, peers } = this.roomManager.joinRoom(roomCode, device, ws, password);
          this.wsToDeviceId.set(ws, device.id);

          // 1. Confirm to joiner
          ws.send(
            JSON.stringify({
              type: 'ROOM_JOINED',
              roomId: room.id,
              senderDeviceId: device.id,
              payload: {
                room,
                device,
                peers,
              },
            })
          );

          // 2. Notify all existing peers in room about new peer
          this.broadcastToRoom(room.id, device.id, {
            type: 'PEER_JOINED',
            roomId: room.id,
            senderDeviceId: device.id,
            payload: { device, room },
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.sendError(ws, 'JOIN_FAILED', errorMsg);
        }
        break;
      }

      case 'SIGNAL_OFFER':
      case 'SIGNAL_ANSWER':
      case 'SIGNAL_ICE':
      case 'TRANSFER_OFFER':
      case 'TRANSFER_ACCEPT':
      case 'TRANSFER_REJECT':
      case 'TRANSFER_CANCEL':
      case 'TRANSFER_PAUSE':
      case 'TRANSFER_RESUME_REQUEST':
      case 'TRANSFER_RESUME_ACCEPT':
      case 'TRANSFER_COMPLETE':
      case 'TRANSFER_VERIFY': {
        const senderDeviceId = this.wsToDeviceId.get(ws) || msg.senderDeviceId;
        if (!senderDeviceId) {
          return this.sendError(ws, 'UNAUTHORIZED', 'Device not registered in any room');
        }

        const room = this.roomManager.getRoomForDevice(senderDeviceId);
        if (!room) {
          return this.sendError(ws, 'ROOM_NOT_FOUND', 'Active room not found');
        }

        // Targeted message vs room broadcast
        if (msg.targetDeviceId) {
          const targetPeer = room.peers.get(msg.targetDeviceId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            targetPeer.ws.send(
              JSON.stringify({
                ...msg,
                senderDeviceId,
                roomId: room.id,
              })
            );
          } else {
            this.sendError(ws, 'PEER_UNAVAILABLE', `Target peer ${msg.targetDeviceId} is not connected`);
          }
        } else {
          // Broadcast to everyone else in the room
          this.broadcastToRoom(room.id, senderDeviceId, {
            ...msg,
            senderDeviceId,
            roomId: room.id,
          });
        }
        break;
      }

      default:
        console.warn('[SignalingServer] Unhandled message type:', msg.type);
    }
  }

  private broadcastToRoom(roomId: string, excludeDeviceId: string, msg: SignalingMessage) {
    const room = this.roomManager.getRoomById(roomId);
    if (!room) return;

    const data = JSON.stringify(msg);
    for (const [deviceId, peer] of room.peers.entries()) {
      if (deviceId !== excludeDeviceId && peer.ws.readyState === WebSocket.OPEN) {
        try {
          peer.ws.send(data);
        } catch (e) {
          console.error(`[SignalingServer] Error sending to ${deviceId}:`, e);
        }
      }
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const deviceId = this.wsToDeviceId.get(ws);
    if (!deviceId) return;

    this.wsToDeviceId.delete(ws);
    const result = this.roomManager.removeDevice(deviceId);

    if (result && result.roomId && result.leftDevice) {
      // Notify remaining peers that device left
      this.broadcastToRoom(result.roomId, deviceId, {
        type: 'PEER_LEFT',
        roomId: result.roomId,
        senderDeviceId: deviceId,
        payload: {
          deviceId,
          leftDevice: result.leftDevice,
          room: result.room,
        },
      });
    }
  }

  private sendError(ws: WebSocket, code: string, message: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'ROOM_ERROR',
          error: `${code}: ${message}`,
        })
      );
    }
  }
}
