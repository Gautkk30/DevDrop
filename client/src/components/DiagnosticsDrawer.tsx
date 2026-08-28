import React from 'react';
import { X, Activity, Wifi, ShieldCheck, Cpu, HardDrive } from 'lucide-react';
import type { NetworkStats, DeviceInfo, RoomMetadata } from '../shared/types.js';
import { TransferEngine } from '../services/TransferEngine.js';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  networkStats?: NetworkStats | null;
  room?: RoomMetadata | null;
  peers: DeviceInfo[];
  currentDevice?: DeviceInfo | null;
}

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  isOpen,
  onClose,
  networkStats,
  peers,
  currentDevice,
}) => {
  if (!isOpen) return null;

  const getConnectionTypeBadge = (type?: string) => {
    switch (type) {
      case 'direct-local':
        return 'text-emerald-800 border-emerald-300 bg-emerald-50';
      case 'direct-internet':
        return 'text-sky-800 border-sky-300 bg-sky-50';
      case 'relayed':
        return 'text-amber-800 border-amber-300 bg-amber-50';
      default:
        return 'text-ink-muted border-border bg-canvas-dark';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/30 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-surface border-l border-border shadow-modal p-6 overflow-y-auto font-sans text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-ink tracking-tight font-sans">Developer Diagnostics</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
              aria-label="Close diagnostics"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-5 space-y-4 font-mono">
            {/* Connection Path & ICE state */}
            <div className="p-4 rounded-card bg-canvas-subtle border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary flex items-center gap-1.5 font-sans font-medium text-xs">
                  <Wifi className="w-3.5 h-3.5 text-accent" />
                  Connection Path
                </span>
                <span
                  className={`px-2 py-0.5 rounded-subtle border text-[11px] font-semibold uppercase ${getConnectionTypeBadge(
                    networkStats?.connectionType
                  )}`}
                >
                  {networkStats?.connectionType || 'Negotiating'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <span className="text-[10px] text-ink-muted block uppercase">Round Trip Time (RTT)</span>
                  <span className="text-sm font-bold text-ink">
                    {networkStats ? `${networkStats.rttMs} ms` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-muted block uppercase">Quality Rating</span>
                  <span className="text-sm font-bold text-emerald-700 uppercase">
                    {networkStats?.rating || 'Connecting'}
                  </span>
                </div>
              </div>
            </div>

            {/* DataChannel Telemetry */}
            <div className="p-4 rounded-card bg-canvas-subtle border border-border space-y-3">
              <div className="flex items-center justify-between text-ink">
                <span className="flex items-center gap-1.5 font-sans font-medium text-xs">
                  <Cpu className="w-3.5 h-3.5 text-ink-secondary" />
                  DataChannel Telemetry
                </span>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Throughput:</span>
                  <span className="text-ink font-semibold">
                    {networkStats ? TransferEngine.formatSpeed(networkStats.throughputBytesPerSec) : '0 B/s'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Buffered Amount (Backpressure):</span>
                  <span
                    className={`font-semibold ${
                      (networkStats?.bufferedAmountBytes || 0) > 100000 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {networkStats ? TransferEngine.formatBytes(networkStats.bufferedAmountBytes) : '0 B'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">ICE Local Candidate:</span>
                  <span className="text-ink truncate max-w-[180px]">
                    {networkStats?.candidatePair?.localType || 'host'}
                  </span>
                </div>
              </div>
            </div>

            {/* Architecture & Privacy Spec */}
            <div className="p-4 rounded-card bg-canvas-subtle border border-border space-y-2">
              <div className="flex items-center justify-between text-ink">
                <span className="flex items-center gap-1.5 font-sans font-medium text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Security & Architecture
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-ink-secondary font-sans leading-relaxed">
                <p>✓ Zero server-side file retention</p>
                <p>✓ End-to-End DTLS-SRTP encrypted channels</p>
                <p>✓ Ephemeral room lifecycle & automatic sweep</p>
                <p>✓ Web Crypto API SHA-256 integrity verification</p>
              </div>
            </div>

            {/* Interactive Pre-Transfer Connection Test */}
            <div className="p-4 rounded-card bg-canvas-subtle border border-border space-y-3">
              <div className="flex items-center justify-between text-ink">
                <span className="flex items-center gap-1.5 font-sans font-medium text-xs">
                  <Activity className="w-3.5 h-3.5 text-accent" />
                  Connection Speed Estimator
                </span>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Connection Type:</span>
                  <span className="text-ink font-semibold uppercase">{networkStats?.connectionType || 'Direct'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Measured RTT:</span>
                  <span className="text-ink font-semibold">{networkStats ? `${networkStats.rttMs} ms` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Estimated 2 GB Transfer:</span>
                  <span className="text-accent font-semibold">
                    {networkStats && networkStats.throughputBytesPerSec > 0
                      ? TransferEngine.formatEta((2 * 1024 * 1024 * 1024) / networkStats.throughputBytesPerSec)
                      : '~42 sec (Direct Wi-Fi)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Peers in Room */}
            <div className="p-4 rounded-card bg-canvas-subtle border border-border space-y-2.5">
              <span className="text-ink flex items-center gap-1.5 font-sans font-medium text-xs">
                <HardDrive className="w-3.5 h-3.5 text-ink-secondary" />
                Active Devices in Room ({peers.length})
              </span>
              <div className="space-y-1.5">
                {peers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-subtle bg-surface border border-border text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${p.id === currentDevice?.id ? 'bg-accent' : 'bg-emerald-600'}`} />
                      <span className="text-ink font-medium">{p.name}</span>
                      {p.isHost && <span className="text-[9px] px-1 py-0.2 rounded bg-canvas-dark text-ink-muted">HOST</span>}
                      {p.id === currentDevice?.id && <span className="text-[9px] px-1 py-0.2 rounded bg-canvas-dark text-ink-secondary font-bold">YOU</span>}
                    </div>
                    <span className="text-ink-muted text-[10px] uppercase">{p.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

