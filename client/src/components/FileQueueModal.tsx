import React, { useRef } from 'react';
import { X, Files, Plus, Trash2, Send, CheckCircle2, AlertCircle, Laptop, Smartphone, HardDrive } from 'lucide-react';
import type { QueuedFile, DeviceInfo } from '../shared/types.js';
import { TransferEngine } from '../services/TransferEngine.js';

interface FileQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: QueuedFile[];
  targetDevice: DeviceInfo | null;
  isAllDevices?: boolean;
  peerCount?: number;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onStartTransfer: () => void;
  isTransferring: boolean;
}

export const FileQueueModal: React.FC<FileQueueModalProps> = ({
  isOpen,
  onClose,
  queue,
  targetDevice,
  isAllDevices,
  peerCount = 1,
  onAddFiles,
  onRemoveFile,
  onStartTransfer,
  isTransferring,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const totalBytes = queue.reduce((acc, f) => acc + f.size, 0);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div className="modal-scrim">
      <div className="w-full max-w-lg max-h-[85vh] bg-surface p-6 relative rounded-modal border border-border shadow-modal flex flex-col space-y-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-subtle bg-canvas-subtle border border-border flex items-center justify-center text-ink">
              <Files className="w-4 h-4 text-ink-secondary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink font-sans">Transfer Queue</h2>
              <p className="text-xs text-ink-muted">
                {queue.length} {queue.length === 1 ? 'file' : 'files'} · {TransferEngine.formatBytes(totalBytes)} total
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
            aria-label="Close queue"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Destination Banner */}
        <div className="p-2.5 rounded-card bg-canvas-subtle border border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAllDevices ? (
              <HardDrive className="w-3.5 h-3.5 text-accent" />
            ) : targetDevice?.type === 'mobile' ? (
              <Smartphone className="w-3.5 h-3.5 text-accent" />
            ) : (
              <Laptop className="w-3.5 h-3.5 text-accent" />
            )}
            <span className="text-xs font-medium text-ink font-sans">
              Sending to: <span className="font-semibold">{isAllDevices ? `All Connected Peers (${peerCount})` : targetDevice?.name || 'Selected Device'}</span>
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-subtle">
            Direct P2P
          </span>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
          {queue.length === 0 ? (
            <div className="text-center py-10 space-y-2 border border-dashed border-border rounded-card bg-canvas-subtle">
              <p className="text-xs text-ink-muted font-sans">No files currently in queue.</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-subtle bg-surface hover:bg-canvas-dark border border-border text-xs text-ink font-medium transition-colors"
              >
                Add Files
              </button>
            </div>
          ) : (
            queue.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 rounded-card bg-canvas-subtle border border-border space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-ink-muted text-[11px] tabular-nums shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-mono font-semibold text-ink truncate max-w-[180px] sm:max-w-[260px]">
                        {item.name}
                      </span>
                      <span className="text-[11px] font-mono text-ink-muted tabular-nums shrink-0">
                        {TransferEngine.formatBytes(item.size)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'completed' && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-subtle">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Done
                      </span>
                    )}
                    {item.status === 'transferring' && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-accent bg-accent-faint border border-accent/20 px-2 py-0.5 rounded-subtle">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        {item.progressPercent}%
                      </span>
                    )}
                    {item.status === 'preparing' && (
                      <span className="text-[10px] font-mono text-ink-muted bg-surface border border-border px-2 py-0.5 rounded-subtle">
                        Preparing...
                      </span>
                    )}
                    {item.status === 'queued' && (
                      <span className="text-[10px] font-mono text-ink-muted bg-surface border border-border px-2 py-0.5 rounded-subtle">
                        Queued
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-subtle">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Failed
                      </span>
                    )}

                    {item.status === 'queued' && !isTransferring && (
                      <button
                        onClick={() => onRemoveFile(item.id)}
                        className="p-1 rounded-subtle text-ink-muted hover:text-rose-600 hover:bg-surface transition-colors"
                        title="Remove file from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {item.status === 'transferring' && (
                  <div className="w-full bg-border rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full transition-all duration-150"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Footer Actions */}
        <div className="pt-2 border-t border-border flex items-center justify-between gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isTransferring}
            className="flex items-center gap-1.5 px-3 py-2 rounded-subtle bg-surface hover:bg-canvas-dark border border-border text-ink text-xs font-medium font-sans transition-all btn-press disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add More Files</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-subtle bg-canvas-subtle hover:bg-canvas-dark border border-border text-ink text-xs font-sans font-medium transition-all btn-press"
            >
              Close
            </button>

            {!isTransferring && queue.some((f) => f.status === 'queued') && (
              <button
                onClick={onStartTransfer}
                className="flex items-center gap-1.5 px-4 py-2 rounded-subtle bg-ink hover:bg-ink/90 text-surface text-xs font-medium font-sans transition-all shadow-subtle btn-press"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Start Transfer ({queue.filter((f) => f.status === 'queued').length})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
