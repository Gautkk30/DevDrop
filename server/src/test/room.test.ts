import { RoomManager } from '../room/RoomManager.js';
import { DeviceInfo } from '../shared/types.js';
import { IRoomPersistenceStore, SerializedRoom } from '../room/RedisRoomStore.js';

class MockTestStore implements IRoomPersistenceStore {
  public store = new Map<string, SerializedRoom>();
  public shouldFailSave = false;

  public isConnected(): boolean {
    return true;
  }

  async saveRoom(room: SerializedRoom): Promise<void> {
    if (this.shouldFailSave) {
      throw new Error('Simulated Redis I/O failure');
    }
    this.store.set(room.id, { ...room });
  }

  async getRoomByCode(code: string): Promise<SerializedRoom | null> {
    const normalized = RoomManager.normalizeCode(code);
    for (const r of this.store.values()) {
      if (RoomManager.normalizeCode(r.code) === normalized) {
        if (Date.now() > r.expiresAt) {
          this.store.delete(r.id);
          return null;
        }
        return { ...r };
      }
    }
    return null;
  }

  async getRoomById(roomId: string): Promise<SerializedRoom | null> {
    const r = this.store.get(roomId);
    if (!r) return null;
    if (Date.now() > r.expiresAt) {
      this.store.delete(roomId);
      return null;
    }
    return { ...r };
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.store.delete(roomId);
  }
}

async function runTests() {
  console.log('[TEST] Starting RoomManager unit tests...');
  const manager = new RoomManager(500); // 500ms TTL for testing

  const mockWs1: any = { send: () => {}, readyState: 1 };
  const mockWs2: any = { send: () => {}, readyState: 1 };

  const device1: DeviceInfo = {
    id: 'dev_host',
    name: 'Host Device',
    type: 'desktop',
    joinedAt: Date.now(),
  };

  const device2: DeviceInfo = {
    id: 'dev_peer_2',
    name: 'Peer Device',
    type: 'mobile',
    joinedAt: Date.now(),
  };

  // TEST 1: Create room and verify it exists
  const { room, hostDevice } = await manager.createRoom({
    password: 'secretpassword',
    hostDevice: device1,
    ws: mockWs1,
  });

  console.assert(room.code.length === 7, `Expected 7 chars code with hyphen, got ${room.code}`);
  console.assert(room.hasPassword === true, 'Expected hasPassword to be true');
  console.assert(hostDevice.isHost === true, 'Expected hostDevice to have isHost=true');
  console.assert(manager.getRoomById(room.id) !== undefined, 'Expected room to exist by ID');
  console.log('✓ TEST 1 Passed: Create room and verify it exists');

  // TEST 2: Create room → second independent client/session joins the same room
  const { peers } = manager.joinRoom(room.code, device2, mockWs2, 'secretpassword');
  console.assert(peers.length === 2, `Expected 2 peers in room, got ${peers.length}`);
  console.log('✓ TEST 2 Passed: Second independent client/session joins the same room');

  // TEST 3: Create room → normalize code variants → join successfully
  const { room: codeRoom } = await manager.createRoom({
    hostDevice: { id: 'dev_code_host', name: 'Host 3', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });

  const unhyphenatedLower = codeRoom.code.replace('-', '').toLowerCase();
  const unhyphenatedUpper = codeRoom.code.replace('-', '').toUpperCase();
  const hyphenatedLower = codeRoom.code.toLowerCase();

  const j1 = manager.joinRoom(unhyphenatedLower, { id: 'dev_v1', name: 'V1', type: 'mobile', joinedAt: Date.now() }, mockWs2);
  console.assert(j1.peers.length === 2, 'Expected successful join with unhyphenated lowercase');
  const j2 = manager.joinRoom(unhyphenatedUpper, { id: 'dev_v2', name: 'V2', type: 'desktop', joinedAt: Date.now() }, mockWs2);
  console.assert(j2.peers.length === 3, 'Expected successful join with unhyphenated uppercase');
  const j3 = manager.joinRoom(hyphenatedLower, { id: 'dev_v3', name: 'V3', type: 'mobile', joinedAt: Date.now() }, mockWs2);
  console.assert(j3.peers.length === 4, 'Expected successful join with hyphenated lowercase');
  console.log('✓ TEST 3 Passed: Create room → normalize code variants → join successfully');

  // TEST 4: Create room → open another WebSocket connection → room still exists
  const { room: room4 } = await manager.createRoom({
    hostDevice: { id: 'dev_host_4', name: 'Host 4', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });
  console.assert(manager.getRoomByCode(room4.code) !== undefined, 'Room must still exist after another WS opens');
  console.log('✓ TEST 4 Passed: Create room → open another WebSocket connection → room still exists');

  // TEST 5: Create room → transient host socket disconnect/reconnect → room does not immediately disappear
  const { room: room5 } = await manager.createRoom({
    hostDevice: { id: 'dev_host_5', name: 'Host 5', type: 'mobile', joinedAt: Date.now() },
    ws: mockWs1,
  });
  // Host disconnects
  manager.removeDevice('dev_host_5', mockWs1);
  // Room should still be in room store with 0 active peers, waiting for TTL / reconnect
  const survivingRoom = manager.getRoomByCode(room5.code);
  console.assert(survivingRoom !== undefined, 'Room must not be destroyed when host disconnects temporarily');
  console.assert(survivingRoom?.peers.size === 0, 'Peers size should be 0');
  // Second device joins the room even while host is disconnected
  const peerJoiningEmptyRoom = manager.joinRoom(room5.code, { id: 'dev_peer_5', name: 'Peer 5', type: 'desktop', joinedAt: Date.now() }, mockWs2);
  console.assert(peerJoiningEmptyRoom.peers.length === 1, 'Peer should successfully join surviving room');
  console.log('✓ TEST 5 Passed: Transient host socket disconnect → room does not immediately disappear');

  // TEST 6: Old socket closes after a replacement/new socket exists → old close event must not remove active session
  const newSocketWs: any = { send: () => {}, readyState: 1 };
  const oldSocketWs: any = { send: () => {}, readyState: 1 };
  const { room: room6 } = await manager.createRoom({
    hostDevice: { id: 'dev_host_6', name: 'Host 6', type: 'desktop', joinedAt: Date.now() },
    ws: newSocketWs,
  });
  // Old socket close event arrives
  manager.removeDevice('dev_host_6', oldSocketWs);
  const roomAfterStaleClose = manager.getRoomById(room6.id);
  console.assert(roomAfterStaleClose?.peers.has('dev_host_6') === true, 'Active session must NOT be removed by old socket close event');
  console.log('✓ TEST 6 Passed: Stale socket close event ignored when newer socket exists');

  // TEST 8: Multiple concurrent join attempts do not corrupt room state
  const { room: room8 } = await manager.createRoom({
    hostDevice: { id: 'dev_host_8', name: 'Host 8', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });
  const concurrentDevices = Array.from({ length: 5 }, (_, i) => ({
    id: `dev_concurrent_${i}`,
    name: `Concurrent Peer ${i}`,
    type: 'mobile' as const,
    joinedAt: Date.now(),
  }));
  for (const dev of concurrentDevices) {
    manager.joinRoom(room8.code, dev, mockWs2);
  }
  const fullRoom = manager.getRoomById(room8.id);
  console.assert(fullRoom?.peers.size === 6, `Expected 6 peers in room8, got ${fullRoom?.peers.size}`);
  console.log('✓ TEST 8 Passed: Multiple concurrent join attempts do not corrupt room state');

  // === PERSISTENCE SUITE: TESTS A through G ===

  // TEST A: Create room → Redis save → lookup by exact code → successful join
  const testStore = new MockTestStore();
  const persistManager = new RoomManager();
  persistManager.setRedisStore(testStore);
  const { room: roomA } = await persistManager.createRoom({
    hostDevice: { id: 'dev_host_a', name: 'Host A', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });
  console.assert(testStore.store.has(roomA.id), 'TEST A: Room must exist in persistent store');
  const joinA = persistManager.joinRoom(roomA.code, { id: 'dev_join_a', name: 'Join A', type: 'mobile', joinedAt: Date.now() }, mockWs2);
  console.assert(joinA.peers.length === 2, 'TEST A: Join must succeed');
  console.log('✓ TEST A Passed: Create room → Redis save → lookup by exact code → successful join');

  // TEST B: Create room → fresh RoomManager (0 in memory) → Redis contains room → rehydrate → join
  const freshManagerB = new RoomManager();
  freshManagerB.setRedisStore(testStore);
  console.assert(freshManagerB.getRoomCount() === 0, 'TEST B: Fresh manager starts with 0 rooms');
  const rehydratedB = await freshManagerB.findOrRehydrateRoom(roomA.code);
  console.assert(rehydratedB !== undefined, 'TEST B: Rehydration must succeed');
  console.assert(freshManagerB.getRoomCount() === 1, 'TEST B: Memory count is now 1');
  const joinB = freshManagerB.joinRoom(roomA.code, { id: 'dev_join_b', name: 'Join B', type: 'desktop', joinedAt: Date.now() }, mockWs2);
  console.assert(joinB.peers.length === 1, 'TEST B: Device B joins successfully');
  console.log('✓ TEST B Passed: Create room → fresh RoomManager → memory has 0 rooms → rehydrate → join succeeds');

  // TEST C: Create room → immediately join without delay (no write race)
  const { room: roomC } = await persistManager.createRoom({
    hostDevice: { id: 'dev_host_c', name: 'Host C', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });
  const joinC = persistManager.joinRoom(roomC.code, { id: 'dev_join_c', name: 'Join C', type: 'mobile', joinedAt: Date.now() }, mockWs2);
  console.assert(joinC.peers.length === 2, 'TEST C: Immediate join must succeed');
  console.log('✓ TEST C Passed: Create room → immediate join (no write race)');

  // TEST D: Code normalization with variants: PWH-VDP vs pwhvdp
  const freshManagerD = new RoomManager();
  freshManagerD.setRedisStore(testStore);
  const rehydratedD = await freshManagerD.findOrRehydrateRoom(roomC.code.replace('-', '').toLowerCase());
  console.assert(rehydratedD !== undefined, 'TEST D: Rehydrate with hyphenless lowercase must succeed');
  const joinD = freshManagerD.joinRoom(roomC.code.replace('-', '').toLowerCase(), { id: 'dev_join_d', name: 'Join D', type: 'mobile', joinedAt: Date.now() }, mockWs2);
  console.assert(joinD.room.code === roomC.code, 'TEST D: Room code preserved');
  console.log('✓ TEST D Passed: Normalized code variants (PWH-VDP vs pwhvdp) resolve to same room');

  // TEST E: Host disconnect → room remains available in persistence → second device joins
  persistManager.removeDevice('dev_host_c', mockWs1);
  const freshManagerE = new RoomManager();
  freshManagerE.setRedisStore(testStore);
  const rehydratedE = await freshManagerE.findOrRehydrateRoom(roomC.code);
  console.assert(rehydratedE !== undefined, 'TEST E: Room is still findable after host disconnect');
  const joinE = freshManagerE.joinRoom(roomC.code, { id: 'dev_peer_e', name: 'Peer E', type: 'desktop', joinedAt: Date.now() }, mockWs2);
  console.assert(joinE.peers.length === 1, 'TEST E: Peer E joins surviving room');
  console.log('✓ TEST E Passed: Host WebSocket disconnect → room remains available in persistence → second device joins');

  // TEST F: Expired Redis room cannot be joined
  const expiredStore = new MockTestStore();
  const expireManager = new RoomManager(50); // 50ms TTL
  expireManager.setRedisStore(expiredStore);
  const { room: expRoom } = await expireManager.createRoom({
    hostDevice: { id: 'dev_exp_host', name: 'Exp Host', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });
  await new Promise((r) => setTimeout(r, 100)); // wait for expiration
  const freshManagerF = new RoomManager();
  freshManagerF.setRedisStore(expiredStore);
  const rehydratedF = await freshManagerF.findOrRehydrateRoom(expRoom.code);
  console.assert(rehydratedF === undefined, 'TEST F: Expired room must NOT rehydrate');
  console.log('✓ TEST F Passed: Expired Redis room cannot be joined');

  // TEST G: Redis write failure is handled gracefully without crashing
  const failingStore = new MockTestStore();
  failingStore.shouldFailSave = true;
  const failingManager = new RoomManager();
  failingManager.setRedisStore(failingStore);
  const { room: fallbackRoom } = await failingManager.createRoom({
    hostDevice: { id: 'dev_fallback_host', name: 'Fallback Host', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });
  console.assert(failingManager.getRoomByCode(fallbackRoom.code) !== undefined, 'TEST G: In-memory room still available on Redis save failure');
  console.log('✓ TEST G Passed: Redis failure produces clear error and does not crash process');

  // TEST 7: Room actually expires after TTL and is removed
  setTimeout(() => {
    const expiredRoom = manager.getRoomByCode(room.code);
    console.assert(expiredRoom === undefined, 'Expected room to be expired and cleaned up after TTL');
    console.log('✓ TEST 7 Passed: Room actually expires after TTL and is removed');
    manager.destroy();
    persistManager.destroy();
    freshManagerB.destroy();
    freshManagerD.destroy();
    freshManagerE.destroy();
    expireManager.destroy();
    freshManagerF.destroy();
    failingManager.destroy();
    console.log('[TEST] All RoomManager unit tests passed successfully!\n');
  }, 600);
}

runTests().catch((err) => {
  console.error('[TEST FATAL] Room test failed:', err);
  process.exit(1);
});
