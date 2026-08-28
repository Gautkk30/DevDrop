import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, LogIn, QrCode, Activity, Download, LogOut, ArrowRight } from 'lucide-react';
import type { RoomMetadata } from '../shared/types.js';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomMetadata | null;
  onOpenCreate: () => void;
  onOpenJoin: () => void;
  onOpenScanner: () => void;
  onOpenDiagnostics: () => void;
  onOpenHistory?: () => void;
  onInstallPwa?: () => void;
  pwaInstallable?: boolean;
  onLeaveRoom?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  room,
  onOpenCreate,
  onOpenJoin,
  onOpenScanner,
  onOpenDiagnostics,
  onOpenHistory,
  onInstallPwa,
  pwaInstallable,
  onLeaveRoom,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const commands: CommandItem[] = [
    ...(!room
      ? [
          {
            id: 'create-room',
            title: 'Create Transfer Room',
            subtitle: 'Start a new ephemeral P2P session',
            icon: <Plus className="w-4 h-4 text-accent" />,
            action: () => {
              onClose();
              onOpenCreate();
            },
            shortcut: 'C',
          },
          {
            id: 'join-room',
            title: 'Join Existing Room',
            subtitle: 'Enter a 6-character room code',
            icon: <LogIn className="w-4 h-4 text-ink" />,
            action: () => {
              onClose();
              onOpenJoin();
            },
            shortcut: 'J',
          },
        ]
      : []),
    ...(onOpenHistory
      ? [
          {
            id: 'history',
            title: 'Recent Transfers',
            subtitle: 'View local session transfer history',
            icon: <Activity className="w-4 h-4 text-emerald-600" />,
            action: () => {
              onClose();
              onOpenHistory();
            },
            shortcut: 'H',
          },
        ]
      : []),
    {
      id: 'scan-qr',
      title: 'Scan QR Code',
      subtitle: 'Use camera to pair with another device',
      icon: <QrCode className="w-4 h-4 text-ink-secondary" />,
      action: () => {
        onClose();
        onOpenScanner();
      },
      shortcut: 'S',
    },
    {
      id: 'diagnostics',
      title: 'Developer Diagnostics',
      subtitle: 'Inspect WebRTC, ICE states and throughput',
      icon: <Activity className="w-4 h-4 text-accent" />,
      action: () => {
        onClose();
        onOpenDiagnostics();
      },
      shortcut: 'D',
    },
    ...(pwaInstallable && onInstallPwa
      ? [
          {
            id: 'install-pwa',
            title: 'Install Progressive Web App',
            subtitle: 'Install for offline shell and fast access',
            icon: <Download className="w-4 h-4 text-ink" />,
            action: () => {
              onClose();
              onInstallPwa();
            },
          },
        ]
      : []),
    ...(room && onLeaveRoom
      ? [
          {
            id: 'leave-room',
            title: 'Leave Current Room',
            subtitle: `Exit session ${room.code}`,
            icon: <LogOut className="w-4 h-4 text-rose-600" />,
            action: () => {
              onClose();
              onLeaveRoom();
            },
          },
        ]
      : []),
  ];

  const filteredCommands = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.subtitle?.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-surface rounded-modal border border-border shadow-modal overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search actions..."
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none font-sans"
          />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-canvas-dark text-ink-muted">
            ESC
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted font-sans">
              No actions matching "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between p-2.5 rounded-subtle text-left transition-all ${
                  selectedIndex === idx ? 'bg-canvas-subtle text-ink' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-subtle bg-surface border border-border flex items-center justify-center shrink-0">
                    {cmd.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink font-sans truncate">{cmd.title}</p>
                    {cmd.subtitle && (
                      <p className="text-[11px] text-ink-muted font-sans truncate">{cmd.subtitle}</p>
                    )}
                  </div>
                </div>

                {selectedIndex === idx && (
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0 ml-2" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 bg-canvas-subtle border-t border-border flex items-center justify-between text-[11px] text-ink-muted font-sans">
          <span>Navigate with ↑ ↓ keys</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
};
