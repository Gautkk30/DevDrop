import React from 'react';
import { ShieldCheck, AlertCircle, RefreshCw, LogOut, Info } from 'lucide-react';
import type { ActiveTransfer } from '../services/TransferEngine.js';
import { TransferEngine } from '../services/TransferEngine.js';
import type { ConnectionType } from '../shared/types.js';

interface TransferResultSummaryProps {
  transfers: ActiveTransfer[];
  connectionType?: ConnectionType;
  onViewDetails: (transfer: ActiveTransfer) => void;
  onRetryFailed?: (transferId: string) => void;
  onCloseSession: () => void;
}

export const TransferResultSummary: React.FC<TransferResultSummaryProps> = ({
  transfers,
  connectionType,
  onViewDetails,
  onRetryFailed,
  onCloseSession,
}) => {
  if (transfers.length === 0) return null;

  const completed = transfers.filter((t) => t.status === 'completed');
  const failed = transfers.filter((t) => t.status === 'failed');
  const transferring = transfers.filter((t) => t.status === 'transferring' || t.status === 'offering' || t.status === 'verifying');

  // Only display result summary when there are finished transfers and none currently transferring
  if (transferring.length > 0 || (completed.length === 0 && failed.length === 0)) {
    return null;
  }

  const isAllSuccess = failed.length === 0 && completed.length > 0;
  const isPartial = failed.length > 0 && completed.length > 0;
  const isSingle = transfers.length === 1;

  const totalBytes = completed.reduce((acc, t) => acc + t.metadata.fileSize, 0);
  const avgSpeed = completed.reduce((acc, t) => acc + (t.averageSpeedBytesPerSec || t.speedBytesPerSec), 0) / (completed.length || 1);
  const totalDurationSec = completed.reduce((acc, t) => acc + (t.startTime ? (Date.now() - t.startTime) / 1000 : 0), 0);

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  const formatConnType = (type?: ConnectionType) => {
    switch (type) {
      case 'direct-local':
        return 'Direct Wi-Fi / LAN';
      case 'direct-internet':
        return 'Direct P2P';
      case 'relayed':
        return 'Relay (TURN)';
      default:
        return 'Direct P2P';
    }
  };

  return (
    <div className="surface-card p-5 sm:p-6 border border-border shadow-subtle animate-slide-up space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {isAllSuccess ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 font-sans">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Transfer Complete
              </span>
            ) : isPartial ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 font-sans">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                Transfer Partially Completed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-800 font-sans">
                <AlertCircle className="w-4 h-4 text-rose-700" />
                Transfer Failed
              </span>
            )}
          </div>
          <p className="text-xs text-ink-secondary font-mono">
            {isSingle ? (
              `${completed[0]?.metadata.fileName || failed[0]?.metadata.fileName} · ${TransferEngine.formatBytes(completed[0]?.metadata.fileSize || failed[0]?.metadata.fileSize || 0)}`
            ) : (
              `${completed.length} of ${transfers.length} files transferred (${TransferEngine.formatBytes(totalBytes)})`
            )}
          </p>
        </div>

        {isAllSuccess && (
          <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-subtle border border-emerald-200 self-start sm:self-center font-medium">
            {completed.length} / {completed.length} SHA-256 Verified
          </span>
        )}
      </div>

      {/* Metrics Row */}
      {completed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono py-1">
          <div className="p-2.5 rounded-card bg-canvas-subtle border border-border">
            <span className="text-[10px] text-ink-muted block uppercase">Duration</span>
            <span className="text-ink font-semibold">{formatDuration(totalDurationSec)}</span>
          </div>

          <div className="p-2.5 rounded-card bg-canvas-subtle border border-border">
            <span className="text-[10px] text-ink-muted block uppercase">Average Speed</span>
            <span className="text-ink font-semibold">{TransferEngine.formatSpeed(avgSpeed)}</span>
          </div>

          <div className="p-2.5 rounded-card bg-canvas-subtle border border-border col-span-2 sm:col-span-1">
            <span className="text-[10px] text-ink-muted block uppercase">Connection</span>
            <span className="text-ink font-semibold">{formatConnType(connectionType)}</span>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
        <div className="flex items-center gap-2">
          {completed.length > 0 && (
            <button
              onClick={() => onViewDetails(completed[0])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-xs font-sans font-medium text-ink transition-all shadow-subtle btn-press"
            >
              <Info className="w-3.5 h-3.5 text-accent" />
              <span>View Details</span>
            </button>
          )}

          {failed.length > 0 && onRetryFailed && (
            <button
              onClick={() => onRetryFailed(failed[0].metadata.transferId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-accent text-surface hover:bg-accent-hover text-xs font-sans font-medium transition-all shadow-subtle btn-press"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Failed ({failed.length})</span>
            </button>
          )}
        </div>

        <button
          onClick={onCloseSession}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-rose-50 border border-border hover:border-rose-200 text-xs font-sans font-medium text-ink-muted hover:text-rose-700 transition-all shadow-subtle btn-press"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Close Session & Clean Up</span>
        </button>
      </div>
    </div>
  );
};
