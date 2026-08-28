import React, { useState } from 'react';
import { X, Shield, Trash2, LogOut } from 'lucide-react';
import type { RoomMetadata } from '../shared/types.js';

interface PrivacySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomMetadata | null;
  onClearHistory: () => void;
  onCloseSession: () => void;
}

export const PrivacySessionModal: React.FC<PrivacySessionModalProps> = ({
  isOpen,
  onClose,
  room,
  onClearHistory,
  onCloseSession,
}) => {
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface p-6 relative rounded-modal border border-border shadow-modal animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
          aria-label="Close session controls"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1 mb-5">
          <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-ink-muted">
            Session & Privacy
          </span>
          <h2 className="text-lg font-bold text-ink font-sans tracking-tight">
            Privacy & Session Controls
          </h2>
          <p className="text-xs text-ink-secondary">
            Manage your ephemeral session and local browser metadata.
          </p>
        </div>

        {/* Technical Privacy Factsheet */}
        <div className="p-3.5 rounded-card bg-canvas-subtle border border-border space-y-2 text-xs font-sans text-ink-secondary mb-4">
          <div className="flex items-center gap-2 text-ink font-medium">
            <Shield className="w-4 h-4 text-emerald-700" />
            <span>Zero Server-Side Storage</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            All files are transferred directly peer-to-peer using DTLS-SRTP encryption. No file data is ever written to disk or stored on servers.
          </p>
          <p className="text-[11px] text-ink-muted font-mono pt-1">
            Session Mode: {room ? `Room ${room.code} · In-Memory Ephemeral` : 'Standby'}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <div className="p-3.5 rounded-card border border-border bg-surface flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-ink font-sans">Clear Local History</h4>
              <p className="text-[11px] text-ink-muted">Purges all 50 transfer records from this browser's localStorage.</p>
            </div>
            {confirmClearHistory ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    onClearHistory();
                    setConfirmClearHistory(false);
                  }}
                  className="px-2.5 py-1 rounded-subtle bg-rose-600 text-surface text-[11px] font-medium hover:bg-rose-700 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmClearHistory(false)}
                  className="px-2 py-1 rounded-subtle text-ink-muted hover:text-ink text-[11px]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearHistory(true)}
                className="px-2.5 py-1.5 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-xs font-medium text-ink-secondary hover:text-rose-700 transition-colors flex items-center gap-1.5 shadow-subtle btn-press"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {room && (
            <div className="p-3.5 rounded-card border border-border bg-surface flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-ink font-sans">End Session & Purge RAM</h4>
                <p className="text-[11px] text-ink-muted">Closes peer connections and purges all active chunk memory.</p>
              </div>
              <button
                onClick={() => {
                  onCloseSession();
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-subtle bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-subtle btn-press"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
