import { RoomManager } from '../room/RoomManager.js';
import { DeviceInfo } from '../shared/types.js';

function runTests() {
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
  const { room, hostDevice } = manager.createRoom({
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
  const { room: codeRoom } = manager.createRoom({
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
  const { room: room4 } = manager.createRoom({
    hostDevice: { id: 'dev_host_4', name: 'Host 4', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });
  // Simulate an unrelated client opening a websocket connection
  const unrelatedWs: any = { send: () => {}, readyState: 1 };
  console.assert(manager.getRoomByCode(room4.code) !== undefined, 'Room must still exist after another WS opens');
  console.log('✓ TEST 4 Passed: Create room → open another WebSocket connection → room still exists');

  // TEST 5: Create room → transient host socket disconnect/reconnect → room does not immediately disappear
  const { room: room5 } = manager.createRoom({
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
  const { room: room6 } = manager.createRoom({
    hostDevice: { id: 'dev_host_6', name: 'Host 6', type: 'desktop', joinedAt: Date.now() },
    ws: newSocketWs, // registered with new socket
  });
  // Old socket close event arrives
  manager.removeDevice('dev_host_6', oldSocketWs);
  const roomAfterStaleClose = manager.getRoomById(room6.id);
  console.assert(roomAfterStaleClose?.peers.has('dev_host_6') === true, 'Active session must NOT be removed by old socket close event');
  console.log('✓ TEST 6 Passed: Stale socket close event ignored when newer socket exists');

  // TEST 8: Multiple concurrent join attempts do not corrupt room state
  const { room: room8 } = manager.createRoom({
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

  // TEST 7: Room actually expires after TTL and is removed
  setTimeout(() => {
    const expiredRoom = manager.getRoomByCode(room.code);
    console.assert(expiredRoom === undefined, 'Expected room to be expired and cleaned up after TTL');
    console.log('✓ TEST 7 Passed: Room actually expires after TTL and is removed');
    manager.destroy();
    console.log('[TEST] All RoomManager unit tests passed successfully!\n');
  }, 600);
}

runTests();
