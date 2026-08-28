import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { TransferMetadata } from '../shared/types.js';
import { TransferEngine } from '../services/TransferEngine.js';

interface FileSecurityModalProps {
  metadata: TransferMetadata | null;
  onAccept: () => void;
  onReject: () => void;
}

export const FileSecurityModal: React.FC<FileSecurityModalProps> = ({ metadata, onAccept, onReject }) => {
  if (!metadata) return null;

  return (
    <div className="modal-scrim">
      <div className="w-full max-w-md bg-surface p-6 sm:p-7 relative rounded-modal border border-border shadow-modal space-y-4 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-subtle bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink font-sans">Incoming Executable File</h2>
            <p className="text-xs text-ink-muted">Potential security risk</p>
          </div>
        </div>

        <div className="p-4 rounded-card bg-canvas-subtle border border-border space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-ink-muted">File Name:</span>
            <span className="text-ink font-semibold truncate max-w-[200px]">{metadata.fileName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">File Size:</span>
            <span className="text-ink">{TransferEngine.formatBytes(metadata.fileSize)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Sender:</span>
            <span className="text-accent font-medium">{metadata.senderDeviceName}</span>
          </div>
        </div>

        <div className="p-3 rounded-subtle bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 font-sans">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            This file type can run programs or scripts on your device. Only accept files from senders you know and trust.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onReject}
            className="flex-1 py-2.5 px-4 rounded-subtle bg-canvas-subtle hover:bg-canvas-dark border border-border text-ink font-medium text-xs transition-colors font-sans"
          >
            Reject File
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 px-4 rounded-subtle bg-rose-600 hover:bg-rose-700 text-surface font-medium text-xs transition-colors shadow-subtle font-sans"
          >
            Accept Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

