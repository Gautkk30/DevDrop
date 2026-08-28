import React from 'react';
import { Send, X, File, HardDrive, Smartphone, Laptop } from 'lucide-react';
import type { DeviceInfo } from '../shared/types.js';
import { TransferEngine } from '../services/TransferEngine.js';

interface PreTransferModalProps {
  isOpen: boolean;
  files: File[];
  targetDevice: DeviceInfo | null;
  isAllDevices?: boolean;
  peerCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PreTransferModal: React.FC<PreTransferModalProps> = ({
  isOpen,
  files,
  targetDevice,
  isAllDevices,
  peerCount = 1,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || files.length === 0) return null;

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="modal-scrim">
      <div className="w-full max-w-md bg-surface p-6 sm:p-7 relative rounded-modal border border-border shadow-modal space-y-4 animate-slide-up">
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
          aria-label="Cancel transfer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-ink font-sans tracking-tight">Confirm Transfer</h2>
          <p className="text-xs text-ink-secondary">
            Review your selected files before streaming peer-to-peer.
          </p>
        </div>

        {/* Target Recipient Banner */}
        <div className="p-3 rounded-card bg-canvas-subtle border border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-subtle bg-surface border border-border flex items-center justify-center text-ink-secondary">
              {isAllDevices ? (
                <HardDrive className="w-3.5 h-3.5" />
              ) : targetDevice?.type === 'mobile' ? (
                <Smartphone className="w-3.5 h-3.5 text-accent" />
              ) : (
                <Laptop className="w-3.5 h-3.5 text-accent" />
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-ink-muted block">Destination</span>
              <span className="text-xs font-semibold text-ink font-sans">
                {isAllDevices ? `All Connected Devices (${peerCount})` : targetDevice?.name || 'Selected Device'}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-subtle">
            Direct P2P
          </span>
        </div>

        {/* Selected Files List */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-ink-muted px-1">
            <span>{files.length} {files.length === 1 ? 'FILE' : 'FILES'}</span>
            <span className="font-semibold text-ink">{TransferEngine.formatBytes(totalBytes)} TOTAL</span>
          </div>

          <div className="max-h-44 overflow-y-auto rounded-card bg-canvas-subtle border border-border p-2 space-y-1">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-subtle bg-surface border border-border text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="font-mono text-ink text-xs truncate max-w-[200px] sm:max-w-[240px]">
                    {file.name}
                  </span>
                </div>
                <span className="font-mono text-ink-muted text-[11px] shrink-0 ml-2">
                  {TransferEngine.formatBytes(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-subtle bg-canvas-subtle hover:bg-canvas-dark border border-border text-ink text-xs font-medium font-sans transition-all btn-press"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-subtle bg-ink hover:bg-ink/90 text-surface text-xs font-medium font-sans transition-all flex items-center justify-center gap-2 shadow-subtle btn-press"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
