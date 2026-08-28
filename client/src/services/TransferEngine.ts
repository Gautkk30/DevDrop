import type { TransferMetadata } from '../shared/types.js';

export const CHUNK_SIZE = 32768; // 32 KB per chunk
export const HIGH_WATER_MARK = 131072; // 128 KB backpressure limit
export const LOW_WATER_MARK = 65536; // 64 KB resume threshold

export type TransferStatus =
  | 'idle'
  | 'offering'
  | 'accepted'
  | 'transferring'
  | 'paused'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ActiveTransfer {
  metadata: TransferMetadata;
  status: TransferStatus;
  bytesTransferred: number;
  currentChunkIndex: number;
  speedBytesPerSec: number;
  averageSpeedBytesPerSec: number;
  etaSeconds: number;
  progressPercent: number;
  verified?: boolean;
  error?: string;
  file?: File; // Sender side
  receivedChunks?: BlobPart[]; // Receiver side
  startTime?: number;
}

export class TransferEngine {
  public static readonly HEADER_SIZE = 8; // 4 bytes chunkIndex + 4 bytes totalChunks

  public static isExecutableRisk(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const riskyExts = ['exe', 'bat', 'cmd', 'sh', 'apk', 'msi', 'vbs', 'scr', 'ps1', 'jar', 'app'];
    return !!ext && riskyExts.includes(ext);
  }

  public static async computeSha256(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  public static async computeFileSha256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    return this.computeSha256(buffer);
  }

  public static frameChunk(chunkIndex: number, totalChunks: number, payload: ArrayBuffer): ArrayBuffer {
    const framed = new Uint8Array(this.HEADER_SIZE + payload.byteLength);
    const view = new DataView(framed.buffer);
    view.setUint32(0, chunkIndex, false); // Big-endian
    view.setUint32(4, totalChunks, false);
    framed.set(new Uint8Array(payload), this.HEADER_SIZE);
    return framed.buffer;
  }

  public static unframeChunk(framedData: ArrayBuffer): { chunkIndex: number; totalChunks: number; payload: Uint8Array } {
    if (framedData.byteLength < this.HEADER_SIZE) {
      throw new Error(`Framed chunk size ${framedData.byteLength} is smaller than header size ${this.HEADER_SIZE}`);
    }
    const view = new DataView(framedData);
    const chunkIndex = view.getUint32(0, false);
    const totalChunks = view.getUint32(4, false);
    const payload = new Uint8Array(framedData, this.HEADER_SIZE);
    return { chunkIndex, totalChunks, payload };
  }

  public static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  public static formatSpeed(bytesPerSec: number): string {
    return `${this.formatBytes(bytesPerSec)}/s`;
  }

  public static formatEta(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return 'estimating...';
    if (seconds < 60) return `~${Math.ceil(seconds)} sec`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `~${mins}m ${secs}s`;
  }

  public static smoothSpeed(previousEmaSpeed: number, currentInstantSpeed: number, alpha: number = 0.3): number {
    if (previousEmaSpeed <= 0) return currentInstantSpeed;
    return alpha * currentInstantSpeed + (1 - alpha) * previousEmaSpeed;
  }

  public static formatDuration(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return '0s';
    if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  public static sendFileChunks(
    file: File,
    dataChannel: RTCDataChannel,
    startChunkIndex: number = 0,
    onProgress: (bytesTransferred: number, chunkIndex: number) => void,
    onComplete: () => void,
    onError: (err: Error) => void,
    isCancelledOrPaused: () => boolean
  ): void {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let currentChunk = startChunkIndex;

    dataChannel.bufferedAmountLowThreshold = LOW_WATER_MARK;

    const readAndSendNextChunk = () => {
      if (isCancelledOrPaused()) {
        dataChannel.onbufferedamountlow = null;
        return;
      }

      if (currentChunk >= totalChunks) {
        dataChannel.onbufferedamountlow = null;
        onComplete();
        return;
      }

      if (dataChannel.bufferedAmount > HIGH_WATER_MARK) {
        dataChannel.onbufferedamountlow = () => {
          dataChannel.onbufferedamountlow = null;
          readAndSendNextChunk();
        };
        return;
      }

      const start = currentChunk * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const slice = file.slice(start, end);

      const reader = new FileReader();
      reader.onload = (e) => {
        if (isCancelledOrPaused()) {
          dataChannel.onbufferedamountlow = null;
          return;
        }

        if (e.target?.result && dataChannel.readyState === 'open') {
          try {
            const rawPayload = e.target.result as ArrayBuffer;
            const framedData = TransferEngine.frameChunk(currentChunk, totalChunks, rawPayload);
            dataChannel.send(framedData);
            currentChunk++;
            onProgress(end, currentChunk);

            setTimeout(readAndSendNextChunk, 0);
          } catch (err: any) {
            dataChannel.onbufferedamountlow = null;
            onError(err);
          }
        }
      };
      reader.onerror = () => {
        dataChannel.onbufferedamountlow = null;
        onError(new Error('FileReader read failed'));
      };
      reader.readAsArrayBuffer(slice);
    };

    readAndSendNextChunk();
  }
}
