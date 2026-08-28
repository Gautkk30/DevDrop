import React from 'react';
import { Activity, Download, QrCode } from 'lucide-react';
import type { RoomMetadata } from '../shared/types.js';

interface HeaderProps {
  room?: RoomMetadata | null;
  onOpenDiagnostics: () => void;
  onOpenJoinScan: () => void;
  onOpenCommandPalette?: () => void;
  pwaInstallable: boolean;
  onInstallPwa: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  onOpenDiagnostics,
  onOpenJoinScan,
  onOpenCommandPalette,
  pwaInstallable,
  onInstallPwa,
}) => {
  return (
    <header className="w-full border-b border-border bg-canvas/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => (window.location.href = '/')}
        >
          <img src="/brand-logo.png" alt="DevDrop" className="h-7 sm:h-8 w-auto object-contain" />
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-canvas-dark text-ink-secondary">
            P2P
          </span>
        </div>

        {room && (
          <div className="hidden sm:flex items-center gap-2.5 bg-surface px-3 py-1.5 rounded-subtle border border-border text-xs font-mono shadow-subtle">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="text-ink-muted text-[11px] uppercase tracking-wider">ROOM</span>
            <span className="text-ink font-semibold tracking-wider">{room.code}</span>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-subtle bg-canvas-subtle hover:bg-canvas-dark border border-border text-ink-muted hover:text-ink text-xs font-sans transition-all btn-press"
              title="Search commands (⌘K or Ctrl+K)"
            >
              <span>Commands</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-surface border border-border text-ink-muted">
                ⌘K
              </kbd>
            </button>
          )}

          <button
            onClick={onOpenJoinScan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink-secondary hover:text-ink text-xs font-medium transition-all shadow-subtle btn-press"
            title="Scan QR Code"
          >
            <QrCode className="w-3.5 h-3.5 text-ink-secondary" />
            <span className="hidden sm:inline">Scan QR</span>
          </button>

          <button
            onClick={onOpenDiagnostics}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink-secondary hover:text-ink text-xs font-medium transition-all shadow-subtle btn-press"
            title="Developer Diagnostics"
          >
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">Diagnostics</span>
          </button>

          {pwaInstallable && (
            <button
              onClick={onInstallPwa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-ink hover:bg-ink/90 text-surface text-xs font-medium transition-all shadow-subtle btn-press"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

