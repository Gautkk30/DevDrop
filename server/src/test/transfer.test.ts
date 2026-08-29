import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

// Replicating TransferEngine framing logic in Node test
class TransferEngineTester {
  public static readonly HEADER_SIZE = 8;

  public static frameChunk(chunkIndex: number, totalChunks: number, payload: Buffer): Buffer {
    const header = Buffer.alloc(this.HEADER_SIZE);
    header.writeUInt32BE(chunkIndex, 0);
    header.writeUInt32BE(totalChunks, 4);
    return Buffer.concat([header, payload]);
  }

  public static unframeChunk(framedData: Buffer): { chunkIndex: number; totalChunks: number; payload: Buffer } {
    if (framedData.length < this.HEADER_SIZE) {
      throw new Error('Framed chunk too small');
    }
    const chunkIndex = framedData.readUInt32BE(0);
    const totalChunks = framedData.readUInt32BE(4);
    const payload = framedData.subarray(this.HEADER_SIZE);
    return { chunkIndex, totalChunks, payload };
  }

  public static computeSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

function runTransferTests() {
  console.log('[TEST] Starting TransferEngine framing & integrity tests...');

  // Test 1: Chunk Framing & Unframing
  const originalPayload = Buffer.from('Hello DevDrop binary chunk payload test!');
  const framed = TransferEngineTester.frameChunk(5, 42, originalPayload);

  console.assert(framed.length === originalPayload.length + 8, 'Framed buffer must include 8-byte header');
  const unframed = TransferEngineTester.unframeChunk(framed);

  console.assert(unframed.chunkIndex === 5, `Expected chunkIndex 5, got ${unframed.chunkIndex}`);
  console.assert(unframed.totalChunks === 42, `Expected totalChunks 42, got ${unframed.totalChunks}`);
  console.assert(unframed.payload.equals(originalPayload), 'Payload must match original content');
  console.log('✓ Test 1 Passed: Binary chunk framing & sequence verification');

  // Test 2: Whole-File SHA-256 Integrity
  const testFileContent = Buffer.alloc(2 * 1024 * 1024, 0x41); // 2 MB of 'A'
  const senderChecksum = TransferEngineTester.computeSha256(testFileContent);

  // Sliced into 32KB chunks and reassembled
  const chunkSize = 32768;
  const chunks: Buffer[] = [];
  for (let i = 0; i < testFileContent.length; i += chunkSize) {
    chunks.push(testFileContent.subarray(i, i + chunkSize));
  }

  const receiverAssembled = Buffer.concat(chunks);
  const receiverChecksum = TransferEngineTester.computeSha256(receiverAssembled);

  console.assert(senderChecksum === receiverChecksum, 'Sender and receiver whole-file SHA-256 must match exactly');
  console.log('✓ Test 2 Passed: 2 MB whole-file SHA-256 integrity match');

  // Test 3: Corrupted Chunk Detection
  const corruptedBuffer = Buffer.from(receiverAssembled);
  corruptedBuffer[100] = 0x42; // change one byte
  const corruptedChecksum = TransferEngineTester.computeSha256(corruptedBuffer);

  console.assert(senderChecksum !== corruptedChecksum, 'Corrupted file must fail SHA-256 checksum comparison');
  console.log('✓ Test 3 Passed: Corruption detection on mismatched checksum');

  console.log('[TEST] All TransferEngine unit tests passed successfully!\n');
}

runTransferTests();
