import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from '../room/RoomManager.js';
import { SignalingServer } from '../ws/SignalingServer.js';
import { SignalingMessage } from '../shared/types.js';
import { IRoomPersistenceStore, SerializedRoom } from '../room/RedisRoomStore.js';

function waitForMessage(ws: WebSocket, type: string, timeoutMs = 5000): Promise<SignalingMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeoutMs);

    const onMsg = (data: any) => {
      try {
        const msg: SignalingMessage = JSON.parse(data.toString());
        if (msg.type === type) {
          clearTimeout(timer);
          ws.off('message', onMsg);
          resolve(msg);
        }
      } catch (e) {
        // ignore parse error in test filter
      }
    };

    ws.on('message', onMsg);
  });
}

// In-memory mock persistent store simulating Redis / Render Key Value
class MockPersistentStore implements IRoomPersistenceStore {
  public store = new Map<string, SerializedRoom>();
  public codeMap = new Map<string, string>();

  public isConnected(): boolean {
    return true;
  }

  async saveRoom(room: SerializedRoom): Promise<void> {
    this.store.set(room.id, { ...room });
    this.codeMap.set(room.code.toUpperCase(), room.id);
    this.codeMap.set(room.code.replace(/[^A-Z0-9]/gi, '').toUpperCase(), room.id);
  }

  async getRoomByCode(code: string): Promise<SerializedRoom | null> {
    const rawUpper = code.trim().toUpperCase();
    const normalized = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const roomId = this.codeMap.get(rawUpper) || this.codeMap.get(normalized);
    if (!roomId) return null;
    return this.getRoomById(roomId);
  }

  async getRoomById(roomId: string): Promise<SerializedRoom | null> {
    const room = this.store.get(roomId);
    if (!room) return null;
    if (Date.now() > room.expiresAt) {
      await this.deleteRoom(roomId, room.code);
      return null;
    }
    return { ...room };
  }

  async deleteRoom(roomId: string, code?: string): Promise<void> {
    this.store.delete(roomId);
    if (code) {
      this.codeMap.delete(code.toUpperCase());
      this.codeMap.delete(code.replace(/[^A-Z0-9]/gi, '').toUpperCase());
    }
  }
}

async function runEndToEndSignalingTest() {
  console.log('[TEST] Starting end-to-end WebSocket Signaling Integration Test...');

  const app = express();
  const server = http.createServer(app);
  const roomManager = new RoomManager();
  const wss = new WebSocketServer({ server, path: '/ws' });
  new SignalingServer(wss, roomManager);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const wsUrl = `ws://127.0.0.1:${address.port}/ws`;
  console.log(`[TEST] Test signaling server running on ${wsUrl} (Instance: ${roomManager.getInstanceId()})`);

  try {
    // 1. Connect Client A (Host)
    const clientA = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      clientA.on('open', () => resolve());
      clientA.on('error', (e) => reject(e));
    });
    console.log('✓ Step 1: Client A (Host) connected to WebSocket');

    // 2. Client A sends ROOM_CREATE
    const roomCreatedPromise = waitForMessage(clientA, 'ROOM_CREATED');
    clientA.send(
      JSON.stringify({
        type: 'ROOM_CREATE',
        payload: {
          device: {
            id: 'dev_host_1',
            name: 'Device Host A',
            type: 'desktop',
            joinedAt: Date.now(),
          },
        },
      })
    );

    const roomCreatedMsg = await roomCreatedPromise;
    const roomCode = roomCreatedMsg.payload?.room?.code;
    const roomId = roomCreatedMsg.payload?.room?.id;
    console.assert(!!roomCode, 'Room code must be present in ROOM_CREATED');
    console.assert(!!roomId, 'Room ID must be present in ROOM_CREATED');
    console.log(`✓ Step 2: Client A received ROOM_CREATED (code: ${roomCode}, id: ${roomId})`);

    // 3. Connect Client B (Peer on second distinct connection)
    const clientB = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      clientB.on('open', () => resolve());
      clientB.on('error', (e) => reject(e));
    });
    console.log('✓ Step 3: Client B (Peer) connected to distinct WebSocket session');

    // 4. Client B sends ROOM_JOIN using unhyphenated lowercase room code
    const unhyphenatedCode = roomCode.replace('-', '').toLowerCase();
    const roomJoinedPromise = waitForMessage(clientB, 'ROOM_JOINED');
    const peerJoinedOnHostPromise = waitForMessage(clientA, 'PEER_JOINED');

    clientB.send(
      JSON.stringify({
        type: 'ROOM_JOIN',
        payload: {
          roomCode: unhyphenatedCode,
          device: {
            id: 'dev_peer_2',
            name: 'Device Peer B',
            type: 'mobile',
            joinedAt: Date.now(),
          },
        },
      })
    );

    // 5. Verify Client B gets ROOM_JOINED and Client A gets PEER_JOINED
    const roomJoinedMsg = await roomJoinedPromise;
    console.assert(roomJoinedMsg.payload?.room?.code === roomCode, 'Client B joined room code must match');
    console.assert(roomJoinedMsg.payload?.peers?.length === 2, 'Peers array must contain 2 devices');
    console.log(`✓ Step 4: Client B received ROOM_JOINED using normalized code "${unhyphenatedCode}"`);

    const peerJoinedMsg = await peerJoinedOnHostPromise;
    console.assert(peerJoinedMsg.payload?.device?.id === 'dev_peer_2', 'Peer joined payload must match Client B');
    console.log('✓ Step 5: Client A (Host) received PEER_JOINED notification');

    // 6. Test Signaling Relay: Client A sends SIGNAL_OFFER to Client B
    const offerPromise = waitForMessage(clientB, 'SIGNAL_OFFER');
    clientA.send(
      JSON.stringify({
        type: 'SIGNAL_OFFER',
        targetDeviceId: 'dev_peer_2',
        payload: { sdp: 'v=0\r\no=mock-sdp-offer\r\n' },
      })
    );
    const offerMsg = await offerPromise;
    console.assert(offerMsg.payload?.sdp?.includes('mock-sdp-offer'), 'SIGNAL_OFFER sdp must match');
    console.log('✓ Step 6: Signaling relay: Client A -> Client B SIGNAL_OFFER delivered');

    // 7. Client B disconnects -> Client A receives PEER_LEFT
    const peerLeftPromise = waitForMessage(clientA, 'PEER_LEFT');
    clientB.close();
    const peerLeftMsg = await peerLeftPromise;
    console.assert(peerLeftMsg.payload?.deviceId === 'dev_peer_2', 'PEER_LEFT deviceId must match');
    console.log('✓ Step 7: Clean disconnect: Client A received PEER_LEFT when Client B closed');

    clientA.close();
    console.log('[TEST] End-to-end WebSocket Signaling Test PASSED!\n');
  } finally {
    roomManager.destroy();
    server.close();
  }
}

async function runRenderRestartPersistenceRegressionTest() {
  console.log('[TEST] Starting Render Process Restart & Persistence Regression Test...');
  const sharedPersistence = new MockPersistentStore();

  // === SERVER PROCESS 1 (Device A creates room) ===
  const app1 = express();
  const server1 = http.createServer(app1);
  const roomManager1 = new RoomManager();
  roomManager1.setRedisStore(sharedPersistence);
  const wss1 = new WebSocketServer({ server: server1, path: '/ws' });
  new SignalingServer(wss1, roomManager1);

  await new Promise<void>((resolve) => server1.listen(0, '127.0.0.1', () => resolve()));
  const port1 = (server1.address() as any).port;
  const wsUrl1 = `ws://127.0.0.1:${port1}/ws`;

  const clientA = new WebSocket(wsUrl1);
  await new Promise<void>((resolve) => clientA.on('open', () => resolve()));

  const createPromise = waitForMessage(clientA, 'ROOM_CREATED');
  clientA.send(
    JSON.stringify({
      type: 'ROOM_CREATE',
      payload: {
        device: {
          id: 'dev_host_persist',
          name: 'Host On Process 1',
          type: 'desktop',
          joinedAt: Date.now(),
        },
      },
    })
  );

  const createdMsg = await createPromise;
  const roomCode = createdMsg.payload?.room?.code;
  console.assert(!!roomCode, 'Room code must exist');
  console.log(`✓ Step 1: Device A created room "${roomCode}" on Process 1`);

  // Verify room exists in persistent store
  const persistedRoom = await sharedPersistence.getRoomByCode(roomCode);
  console.assert(!!persistedRoom, 'Room must be persisted to persistent store');
  console.assert(persistedRoom?.code === roomCode, 'Persisted room code must match');
  console.log(`✓ Step 2: Room "${roomCode}" confirmed in shared persistence store`);

  // Close Device A and Server 1 to simulate process crash / restart
  clientA.close();
  roomManager1.destroy();
  await new Promise<void>((resolve) => server1.close(() => resolve()));
  console.log('✓ Step 3: Process 1 terminated (simulating Render restart / redeploy)');

  // === SERVER PROCESS 2 (Fresh process with 0 in-memory rooms, attached to same persistence) ===
  const app2 = express();
  const server2 = http.createServer(app2);
  const roomManager2 = new RoomManager();
  roomManager2.setRedisStore(sharedPersistence);
  console.assert(roomManager2.getRoomCount() === 0, 'Process 2 in-memory room store must start completely empty (0 rooms)');
  console.log(`✓ Step 4: Process 2 started with ${roomManager2.getRoomCount()} in-memory rooms`);

  const wss2 = new WebSocketServer({ server: server2, path: '/ws' });
  new SignalingServer(wss2, roomManager2);

  await new Promise<void>((resolve) => server2.listen(0, '127.0.0.1', () => resolve()));
  const port2 = (server2.address() as any).port;
  const wsUrl2 = `ws://127.0.0.1:${port2}/ws`;

  // Connect Device B to Process 2 and join room
  const clientB = new WebSocket(wsUrl2);
  await new Promise<void>((resolve) => clientB.on('open', () => resolve()));

  const joinPromise = waitForMessage(clientB, 'ROOM_JOINED');
  clientB.send(
    JSON.stringify({
      type: 'ROOM_JOIN',
      payload: {
        roomCode: roomCode,
        device: {
          id: 'dev_peer_persist',
          name: 'Device B On Process 2',
          type: 'mobile',
          joinedAt: Date.now(),
        },
      },
    })
  );

  const joinedMsg = await joinPromise;
  console.assert(joinedMsg.payload?.room?.code === roomCode, 'Device B must receive ROOM_JOINED from rehydrated room');
  console.assert(roomManager2.getRoomCount() === 1, 'RoomManager 2 must now have rehydrated 1 active room');
  console.log(`✓ Step 5: Device B joined room "${roomCode}" successfully on Process 2 via persistence rehydration!`);

  clientB.close();
  roomManager2.destroy();
  await new Promise<void>((resolve) => server2.close(() => resolve()));
  console.log('[TEST] Render Process Restart & Persistence Regression Test PASSED!\n');
}

async function runAllTests() {
  await runEndToEndSignalingTest();
  await runRenderRestartPersistenceRegressionTest();
}

runAllTests().catch((err) => {
  console.error('[TEST FATAL] Integration test failed:', err);
  process.exit(1);
});
