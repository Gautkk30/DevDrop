import React from 'react';
import { X, History, ArrowUpRight, ArrowDownLeft, CheckCircle2, AlertCircle, XCircle, Trash2, Clock } from 'lucide-react';
import type { TransferHistoryEntry } from '../shared/types.js';
import { TransferEngine } from '../services/TransferEngine.js';

interface TransferHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: TransferHistoryEntry[];
  onClearHistory: () => void;
  onRemoveEntry: (id: string) => void;
  onSelectEntry?: (entry: TransferHistoryEntry) => void;
}

export const TransferHistoryModal: React.FC<TransferHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  onRemoveEntry,
  onSelectEntry,
}) => {
  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[85vh] bg-surface p-6 relative rounded-modal border border-border shadow-modal flex flex-col space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-subtle bg-canvas-subtle border border-border flex items-center justify-center text-ink">
              <History className="w-4 h-4 text-ink-secondary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink font-sans">Recent Transfers</h2>
              <p className="text-xs text-ink-muted">Click any transfer to view full SHA-256 and speed details</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1 px-2.5 py-1 rounded-subtle text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-sans transition-colors"
                title="Clear all local history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
              aria-label="Close history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[60vh]">
          {history.length === 0 ? (
            <div className="text-center py-12 space-y-2 border border-dashed border-border rounded-card bg-canvas-subtle">
              <Clock className="w-6 h-6 text-ink-muted mx-auto stroke-[1.5]" />
              <p className="text-xs font-medium text-ink font-sans">No transfer history yet.</p>
              <p className="text-[11px] text-ink-muted font-sans">
                Completed, failed, and cancelled transfers will appear here.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectEntry?.(item)}
                className="p-3 rounded-card bg-canvas-subtle hover:bg-surface border border-border hover:border-ink/25 transition-all flex items-center justify-between gap-3 text-xs cursor-pointer group shadow-subtle"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-subtle bg-surface border border-border flex items-center justify-center shrink-0">
                    {item.direction === 'sent' ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-accent" />
                    ) : (
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-ink group-hover:text-accent transition-colors truncate max-w-[160px] sm:max-w-[240px]">
                        {item.fileName}
                      </span>
                      <span className="text-[11px] font-mono text-ink-muted tabular-nums shrink-0">
                        {TransferEngine.formatBytes(item.fileSize)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-ink-secondary font-mono">
                      <span>{item.direction === 'sent' ? 'To' : 'From'} {item.peerDeviceName || 'Peer'}</span>
                      <span>·</span>
                      <span className="text-ink-muted">{formatDate(item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {item.status === 'completed' ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-subtle">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {item.verified ? 'Verified' : 'Done'}
                    </span>
                  ) : item.status === 'failed' ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-subtle">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      Failed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-subtle">
                      <XCircle className="w-3 h-3 text-amber-600" />
                      Cancelled
                    </span>
                  )}

                  <button
                    onClick={() => onRemoveEntry(item.id)}
                    className="p-1 rounded-subtle text-ink-muted hover:text-rose-600 hover:bg-surface transition-colors"
                    title="Remove from history"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
