import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from '../room/RoomManager.js';
import { SignalingServer } from '../ws/SignalingServer.js';
import { SignalingMessage } from '../shared/types.js';

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

async function runIntegrationTest() {
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
    console.log('[TEST] End-to-end WebSocket Signaling Integration Test PASSED!\n');
  } finally {
    roomManager.destroy();
    server.close();
  }
}

runIntegrationTest().catch((err) => {
  console.error('[TEST FATAL] Integration test failed:', err);
  process.exit(1);
});
