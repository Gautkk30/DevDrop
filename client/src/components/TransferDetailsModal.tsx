import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle, Copy, Check, HardDrive, Clock, Activity, Zap, Wifi } from 'lucide-react';
import type { TransferHistoryEntry, ConnectionType } from '../shared/types.js';
import type { ActiveTransfer } from '../services/TransferEngine.js';
import { TransferEngine } from '../services/TransferEngine.js';

interface TransferDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer?: ActiveTransfer | TransferHistoryEntry | null;
  connectionType?: ConnectionType;
}

export const TransferDetailsModal: React.FC<TransferDetailsModalProps> = ({
  isOpen,
  onClose,
  transfer,
  connectionType,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  if (!isOpen || !transfer) return null;

  const isHistory = 'direction' in transfer;
  const fileName = isHistory ? transfer.fileName : transfer.metadata.fileName;
  const fileSize = isHistory ? transfer.fileSize : transfer.metadata.fileSize;
  const fileType = isHistory ? transfer.fileType : transfer.metadata.fileType;
  const direction = isHistory ? transfer.direction : transfer.file ? 'sent' : 'received';
  const peerName = isHistory ? transfer.peerDeviceName : (transfer.metadata.senderDeviceName || 'Peer');
  const durationSec = isHistory
    ? transfer.durationSec
    : transfer.startTime
    ? (Date.now() - transfer.startTime) / 1000
    : undefined;
  const avgSpeed = isHistory
    ? transfer.averageSpeedBytesPerSec
    : transfer.averageSpeedBytesPerSec || transfer.speedBytesPerSec;
  const peakSpeed = isHistory ? transfer.peakSpeedBytesPerSec : transfer.peakSpeedBytesPerSec;
  const checksum = isHistory ? transfer.sha256Checksum : transfer.metadata.sha256Checksum;
  const verified = isHistory ? transfer.verified : transfer.verified;
  const activeConnType = isHistory ? transfer.connectionType : connectionType;

  const handleCopyHash = () => {
    if (!checksum) return;
    navigator.clipboard.writeText(checksum);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const formatConnType = (type?: ConnectionType) => {
    switch (type) {
      case 'direct-local':
        return 'Direct (Wi-Fi / LAN)';
      case 'direct-internet':
        return 'Direct (P2P / STUN)';
      case 'relayed':
        return 'Relay (TURN)';
      default:
        return 'Direct P2P';
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface p-6 relative rounded-modal border border-border shadow-modal animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
          aria-label="Close transfer details"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1 mb-5">
          <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-ink-muted">
            Transfer Audit & Details
          </span>
          <h2 className="text-lg font-bold text-ink font-sans tracking-tight truncate pr-6">
            {fileName}
          </h2>
          <p className="text-xs text-ink-secondary font-mono">
            {TransferEngine.formatBytes(fileSize)} · {direction === 'sent' ? 'Sent to' : 'Received from'} {peerName}
          </p>
        </div>

        {/* Verification Status Banner */}
        <div
          className={`p-3.5 rounded-card border mb-4 flex items-center justify-between ${
            verified
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/70 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {verified ? (
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700" />
            )}
            <span className="text-xs font-bold font-sans">
              {verified ? 'Integrity Verified' : 'Integrity Verification Failed'}
            </span>
          </div>
          <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-subtle bg-surface border border-inherit">
            SHA-256
          </span>
        </div>

        {/* Technical Metrics Grid */}
        <div className="p-3.5 rounded-card bg-canvas-subtle border border-border space-y-2.5 text-xs font-mono mb-4">
          <div className="flex justify-between items-center">
            <span className="text-ink-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Duration
            </span>
            <span className="text-ink font-semibold">
              {durationSec !== undefined ? `${durationSec.toFixed(1)} sec` : 'Unavailable'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-ink-muted flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Average Speed
            </span>
            <span className="text-ink font-semibold">
              {avgSpeed ? TransferEngine.formatSpeed(avgSpeed) : 'Unavailable'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-ink-muted flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Peak Speed
            </span>
            <span className="text-ink font-semibold">
              {peakSpeed ? TransferEngine.formatSpeed(peakSpeed) : avgSpeed ? TransferEngine.formatSpeed(avgSpeed) : 'Unavailable'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-ink-muted flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5" /> Connection Path
            </span>
            <span className="text-ink font-semibold">
              {formatConnType(activeConnType)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-ink-muted flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" /> MIME Type
            </span>
            <span className="text-ink font-semibold truncate max-w-[180px]">
              {fileType || 'application/octet-stream'}
            </span>
          </div>
        </div>

        {/* Full SHA-256 Checksum Card */}
        {checksum && (
          <div className="p-3 rounded-card bg-canvas-subtle border border-border space-y-1.5 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono text-ink-muted font-medium">
                SHA-256 Checksum
              </span>
              <button
                onClick={handleCopyHash}
                className="flex items-center gap-1 text-[11px] font-mono text-accent hover:underline btn-press"
              >
                {copiedHash ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Full Hash</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-[11px] text-ink break-all bg-surface p-2 rounded-subtle border border-border select-all">
              {checksum}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-subtle bg-ink text-surface text-xs font-medium hover:bg-neutral-800 transition-colors shadow-subtle btn-press font-sans"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
