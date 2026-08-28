import React, { useState } from 'react';
import { Lock, X, Smartphone, Laptop, Plus } from 'lucide-react';
import type { DeviceType } from '../shared/types.js';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (options: { deviceName: string; deviceType: DeviceType; password?: string; isOneTime: boolean }) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [deviceName, setDeviceName] = useState(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    return isMobile ? 'Mobile Device' : 'My Computer';
  });
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  });
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isOneTime, setIsOneTime] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;

    onCreate({
      deviceName: deviceName.trim(),
      deviceType,
      password: enablePassword && password.trim() ? password.trim() : undefined,
      isOneTime,
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
          <h2 className="text-xl font-bold text-ink font-sans tracking-tight">Create a Room</h2>
          <p className="text-xs text-ink-secondary">
            Connect another device by scanning a QR code or entering the room code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-ink-muted uppercase tracking-wider mb-1.5">
              Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Gautham's Laptop"
              required
              className="w-full px-3.5 py-2.5 rounded-subtle bg-canvas-subtle border border-border text-sm text-ink placeholder:text-ink-faint focus:bg-surface focus:border-ink transition-colors font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-ink-muted uppercase tracking-wider mb-1.5">
              Device Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeviceType('desktop')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-subtle border text-xs font-medium transition-all btn-press ${
                  deviceType === 'desktop'
                    ? 'bg-ink text-surface border-ink shadow-subtle'
                    : 'bg-canvas-subtle border-border text-ink-secondary hover:text-ink'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Desktop / PC</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceType('mobile')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-subtle border text-xs font-medium transition-all btn-press ${
                  deviceType === 'mobile'
                    ? 'bg-ink text-surface border-ink shadow-subtle'
                    : 'bg-canvas-subtle border-border text-ink-secondary hover:text-ink'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile / Tablet</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-medium text-ink font-sans">Password Protection</span>
                <span className="text-[11px] text-ink-muted">Require password before peers can join</span>
              </div>
              <input
                type="checkbox"
                checked={enablePassword}
                onChange={(e) => setEnablePassword(e.target.checked)}
                className="w-4 h-4 rounded-sm border-border text-ink focus:ring-0 cursor-pointer accent-ink"
              />
            </div>

            {enablePassword && (
              <div className="animate-slide-up">
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-ink-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set room password"
                    className="w-full pl-8 pr-3.5 py-2 rounded-subtle bg-canvas-subtle border border-border text-xs text-ink focus:bg-surface focus:border-ink font-mono"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="block text-xs font-medium text-ink font-sans">One-Time Room</span>
                <span className="text-[11px] text-ink-muted">Auto-close room after transfer session completes</span>
              </div>
              <input
                type="checkbox"
                checked={isOneTime}
                onChange={(e) => setIsOneTime(e.target.checked)}
                className="w-4 h-4 rounded-sm border-border text-ink focus:ring-0 cursor-pointer accent-ink"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-subtle bg-ink hover:bg-ink/90 text-surface font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-subtle btn-press"
            >
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

