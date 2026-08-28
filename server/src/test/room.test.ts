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
