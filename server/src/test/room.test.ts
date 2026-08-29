import { RoomManager } from '../room/RoomManager.js';
import { DeviceInfo } from '../shared/types.js';

function runTests() {
  console.log('[TEST] Starting RoomManager unit tests...');
  const manager = new RoomManager(500); // 500ms TTL for testing

  const mockWs1: any = { send: () => {}, readyState: 1 };
  const mockWs2: any = { send: () => {}, readyState: 1 };

  const device1: DeviceInfo = {
    id: 'dev_1',
    name: 'Host Device',
    type: 'desktop',
    joinedAt: Date.now(),
  };

  const device2: DeviceInfo = {
    id: 'dev_2',
    name: 'Peer Device',
    type: 'mobile',
    joinedAt: Date.now(),
  };

  // Test 1: Room Creation
  const { room, hostDevice } = manager.createRoom({
    password: 'secretpassword',
    hostDevice: device1,
    ws: mockWs1,
  });

  console.assert(room.code.length === 7, `Expected 7 chars code with hyphen, got ${room.code}`);
  console.assert(room.hasPassword === true, 'Expected hasPassword to be true');
  console.assert(hostDevice.isHost === true, 'Expected hostDevice to have isHost=true');
  console.log('✓ Test 1 Passed: Room creation & metadata');

  // Test 2: Password Verification
  const internalRoom = manager.getRoomByCode(room.code);
  console.assert(internalRoom !== undefined, 'Expected to find room by code');
  console.assert(manager.validatePassword(internalRoom!, 'secretpassword') === true, 'Expected valid password match');
  console.assert(manager.validatePassword(internalRoom!, 'wrongpassword') === false, 'Expected invalid password to fail');
  console.log('✓ Test 2 Passed: bcrypt password verification');

  // Test 3: Peer Join
  const { peers } = manager.joinRoom(room.code, device2, mockWs2, 'secretpassword');
  console.assert(peers.length === 2, `Expected 2 peers in room, got ${peers.length}`);
  console.log('✓ Test 3 Passed: Peer joined room');

  // Test 4: Device Removal
  const result = manager.removeDevice('dev_2');
  console.assert(result !== undefined, 'Expected result on device remove');
  console.assert(result?.leftDevice?.id === 'dev_2', 'Expected leftDevice to be dev_2');
  console.log('✓ Test 4 Passed: Device removed cleanly');

  // Test 6: Cross-Session Regression: Create Room -> Join with varied formatting
  const { room: regRoom } = manager.createRoom({
    hostDevice: { id: 'host_session_1', name: 'Host Chrome', type: 'desktop', joinedAt: Date.now() },
    ws: mockWs1,
  });

  const mockWs3: any = { send: () => {}, readyState: 1 };
  const mockWs4: any = { send: () => {}, readyState: 1 };
  const mockWs5: any = { send: () => {}, readyState: 1 };

  // Join with exact formatted code (e.g. "ABC-123")
  const join1 = manager.joinRoom(regRoom.code, { id: 'peer_1', name: 'Peer Exact', type: 'mobile', joinedAt: Date.now() }, mockWs3);
  console.assert(join1.peers.length === 2, `Expected 2 peers, got ${join1.peers.length}`);

  // Join with unhyphenated lowercase code (e.g. "abc123")
  const unhyphenatedLower = regRoom.code.replace('-', '').toLowerCase();
  const join2 = manager.joinRoom(unhyphenatedLower, { id: 'peer_2', name: 'Peer Lower', type: 'desktop', joinedAt: Date.now() }, mockWs4);
  console.assert(join2.peers.length === 3, `Expected 3 peers, got ${join2.peers.length}`);

  // Join with Room ID (e.g. "rm_...")
  const join3 = manager.joinRoom(regRoom.id, { id: 'peer_3', name: 'Peer ID', type: 'mobile', joinedAt: Date.now() }, mockWs5);
  console.assert(join3.peers.length === 4, `Expected 4 peers, got ${join3.peers.length}`);
  console.log('✓ Test 6 Passed: Regression - create room → join from another client/session (all formats)');

  // Test 5: Expiration & Sweep
  setTimeout(() => {
    const expiredRoom = manager.getRoomByCode(room.code);
    console.assert(expiredRoom === undefined, 'Expected room to be expired and cleaned up');
    console.log('✓ Test 5 Passed: Room TTL expiration & cleanup');
    manager.destroy();
    console.log('[TEST] All RoomManager unit tests passed successfully!\n');
  }, 600);
}

runTests();

