export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface DeviceInfo {
  id: string;
  name: string;
  type: DeviceType;
  joinedAt: number;
  isHost?: boolean;
}

export interface RoomMetadata {
  id: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  deviceCount: number;
  hasPassword: boolean;
  isOneTime: boolean;
}

export type ConnectionType = 'direct-local' | 'direct-internet' | 'relayed' | 'unknown';
export type QualityRating = 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';

export interface NetworkStats {
  rttMs: number;
  throughputBytesPerSec: number;
  averageThroughputBytesPerSec: number;
  bufferedAmountBytes: number;
  connectionType: ConnectionType;
  rating: QualityRating;
  candidatePair?: {
    localType: string;
    remoteType: string;
    localAddress?: string;
    remoteAddress?: string;
  };
}

export interface TransferMetadata {
  transferId: string;
  senderDeviceId: string;
  senderDeviceName: string;
  targetDeviceIds: string[];
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  chunkSize: number;
  sha256Checksum?: string;
  isFolder?: boolean;
  relativePath?: string;
  isExecutableRisk?: boolean;
}

export type SignalingMessageType =
  | 'ROOM_CREATE'
  | 'ROOM_CREATED'
  | 'ROOM_JOIN'
  | 'ROOM_JOINED'
  | 'ROOM_ERROR'
  | 'ROOM_EXPIRED'
  | 'PEER_JOINED'
  | 'PEER_LEFT'
  | 'SIGNAL_OFFER'
  | 'SIGNAL_ANSWER'
  | 'SIGNAL_ICE'
  | 'TRANSFER_OFFER'
  | 'TRANSFER_ACCEPT'
  | 'TRANSFER_REJECT'
  | 'TRANSFER_CANCEL'
  | 'TRANSFER_PAUSE'
  | 'TRANSFER_RESUME_REQUEST'
  | 'TRANSFER_RESUME_ACCEPT'
  | 'TRANSFER_COMPLETE'
  | 'TRANSFER_VERIFY'
  | 'PING'
  | 'PONG';

export interface SignalingMessage {
  protocolVersion?: number;
  type: SignalingMessageType;
  roomId?: string;
  senderDeviceId?: string;
  targetDeviceId?: string;
  payload?: any;
  error?: string;
}

export interface QueuedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'queued' | 'preparing' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  progressPercent: number;
  error?: string;
}

export interface TransferHistoryEntry {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'sent' | 'received';
  peerDeviceName: string;
  timestamp: number;
  durationSec?: number;
  averageSpeedBytesPerSec?: number;
  verified: boolean;
  status: 'completed' | 'failed' | 'cancelled';
}

export interface TransferSpeedSample {
  timestamp: number;
  speedBytesPerSec: number;
}

