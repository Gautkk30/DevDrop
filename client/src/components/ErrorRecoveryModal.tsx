import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export interface ErrorRecoveryDetails {
  title: string;
  message: string;
  recoveryActionLabel?: string;
  onRecover?: () => void;
}

interface ErrorRecoveryModalProps {
  error: ErrorRecoveryDetails | null;
  onClose: () => void;
}

export const ErrorRecoveryModal: React.FC<ErrorRecoveryModalProps> = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="modal-scrim">
      <div className="w-full max-w-md bg-surface p-6 sm:p-7 relative rounded-modal border border-border shadow-modal space-y-4 animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
          aria-label="Close error dialogue"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-subtle bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink font-sans">{error.title}</h2>
            <p className="text-xs text-ink-muted font-sans">Action required</p>
          </div>
        </div>

        <div className="p-4 rounded-card bg-canvas-subtle border border-border text-xs text-ink font-sans leading-relaxed">
          {error.message}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-subtle bg-canvas-subtle hover:bg-canvas-dark border border-border text-ink text-xs font-medium font-sans transition-colors"
          >
            Dismiss
          </button>

          {error.onRecover && error.recoveryActionLabel && (
            <button
              onClick={() => {
                onClose();
                error.onRecover?.();
              }}
              className="flex-1 py-2.5 px-4 rounded-subtle bg-ink hover:bg-ink/90 text-surface text-xs font-medium font-sans transition-all flex items-center justify-center gap-1.5 shadow-subtle"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{error.recoveryActionLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
