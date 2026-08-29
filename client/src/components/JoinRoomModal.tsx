import React, { useState, useEffect } from 'react';
import { LogIn, X, Lock, QrCode } from 'lucide-react';
import type { DeviceType } from '../shared/types.js';
import { DeviceIdentifier } from '../services/DeviceIdentifier.js';
import { signalingClient } from '../services/SignalingClient.js';

interface JoinRoomModalProps {
  isOpen: boolean;
  initialCode?: string;
  onClose: () => void;
  onJoin: (options: { roomCode: string; deviceName: string; deviceType: DeviceType; platformDescription?: string; password?: string }) => void;
  onOpenScanner: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  initialCode = '',
  onClose,
  onJoin,
  onOpenScanner,
}) => {
  const [roomCode, setRoomCode] = useState(initialCode);
  const [deviceName, setDeviceName] = useState(() => DeviceIdentifier.getDefaultDeviceName());
  const [deviceType] = useState<DeviceType>(() => {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  });
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialCode) {
      setRoomCode(initialCode);
      checkRoomMetadata(initialCode);
    }
  }, [initialCode]);

  if (!isOpen) return null;

  /**
   * Query room metadata via WebSocket — NOT via HTTP.
   * This avoids triggering an HTTP cold-start on Render that would create a
   * fresh process with no rooms before Device B's WebSocket ROOM_JOIN arrives.
   * The existing WebSocket connection (maintained by Device A's heartbeat pings)
   * keeps the Render process alive and its in-memory room state intact.
   */
  const checkRoomMetadata = async (code: string) => {
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length < 6) return;

    try {
      const info = await signalingClient.queryRoom(cleanCode);
      if (info) {
        setRequiresPassword(info.hasPassword);
        setErrorMsg('');
      }
      // If info is null, the room may not exist yet or we're offline — don't show error
      // The ROOM_JOIN will surface the real error response
    } catch {
      // Ignore — ROOM_JOIN will handle actual validation
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (val.length === 3 && !val.includes('-') && roomCode.length < 4) {
      val += '-';
    }
    setRoomCode(val);
    if (val.length >= 6) {
      checkRoomMetadata(val);
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !deviceName.trim()) return;

    onJoin({
      roomCode: roomCode.trim().toUpperCase(),
      deviceName: deviceName.trim(),
      deviceType,
      platformDescription: DeviceIdentifier.getDeviceDescription(),
      password: requiresPassword && password ? password : undefined,
    });
  };

  return (
    <div className="modal-scrim">
      <div className="w-full max-w-md bg-surface p-6 sm:p-7 relative rounded-modal border border-border shadow-modal animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1 mb-6">
          <h2 className="text-xl font-bold text-ink font-sans tracking-tight">Join a Room</h2>
          <p className="text-xs text-ink-secondary">
            Enter the 6-character room code or scan the room's QR code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono font-medium text-ink-muted uppercase tracking-wider">
                Room Code
              </label>
              <button
                type="button"
                onClick={onOpenScanner}
                className="text-xs text-ink hover:text-accent flex items-center gap-1 font-mono font-medium transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan QR</span>
              </button>
            </div>
            <input
              type="text"
              value={roomCode}
              onChange={handleCodeChange}
              placeholder="7KX9-PQ"
              maxLength={7}
              required
              className="w-full px-4 py-3 rounded-subtle bg-canvas-subtle border border-border text-lg font-mono tracking-widest text-center text-ink uppercase focus:bg-surface focus:border-ink transition-colors"
            />
            {errorMsg && <p className="mt-1 text-xs text-rose-600 font-mono">{errorMsg}</p>}
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-ink-muted uppercase tracking-wider mb-1.5">
              Your Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Phone"
              required
              className="w-full px-3.5 py-2.5 rounded-subtle bg-canvas-subtle border border-border text-sm text-ink placeholder:text-ink-faint focus:bg-surface focus:border-ink transition-colors font-sans"
            />
          </div>

          {requiresPassword && (
            <div className="animate-slide-up">
              <label className="block text-xs font-mono text-accent mb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Room Requires Password</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full px-3.5 py-2.5 rounded-subtle bg-canvas-subtle border border-accent/40 text-sm text-ink focus:bg-surface focus:border-accent font-mono"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-subtle bg-ink hover:bg-ink/90 text-surface font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-subtle btn-press"
            >
              <LogIn className="w-4 h-4" />
              <span>Connect to Room</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

