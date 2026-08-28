import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  Share2,
  QrCode,
  UploadCloud,
  FolderPlus,
  Send,
  Pause,
  Play,
  ShieldCheck,
  Smartphone,
  Laptop,
  Users,
  Clock,
  CheckCircle2,
  Eye,
  LogOut,
  History,
  Files,
  AlertTriangle,
  Info,
  RefreshCw,
} from 'lucide-react';
import type { DeviceInfo, RoomMetadata, TransferSpeedSample, NetworkStats } from '../shared/types.js';
import type { ActiveTransfer } from '../services/TransferEngine.js';
import { TransferEngine } from '../services/TransferEngine.js';
import { SpeedGraph } from './SpeedGraph.tsx';
import { TransferResultSummary } from './TransferResultSummary.tsx';

interface RoomDashboardProps {
  room: RoomMetadata;
  currentDevice: DeviceInfo;
  peers: DeviceInfo[];
  transfers: ActiveTransfer[];
  networkStats?: NetworkStats | null;
  speedSamples?: TransferSpeedSample[];
  queueLength?: number;
  onSendFile: (file: File, targetDeviceIds: string[]) => void;
  onSendFolder: (files: FileList, targetDeviceIds: string[]) => void;
  onStageFiles?: (files: File[], targetDeviceIds: string[]) => void;
  onOpenQueue?: () => void;
  onOpenHistory?: () => void;
  onViewTransferDetails?: (transfer: ActiveTransfer) => void;
  onRetryTransfer?: (transferId: string) => void;
  onPauseTransfer: (transferId: string) => void;
  onResumeTransfer: (transferId: string) => void;
  onCancelTransfer: (transferId: string) => void;
  onAcceptTransfer: (transferId: string) => void;
  onRejectTransfer: (transferId: string) => void;
  onPreviewFile: (transfer: ActiveTransfer) => void;
  onLeaveRoom: () => void;
  onNotify?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const RoomDashboard: React.FC<RoomDashboardProps> = ({
  room,
  currentDevice,
  peers,
  transfers,
  networkStats,
  speedSamples = [],
  queueLength = 0,
  onSendFile,
  onSendFolder,
  onStageFiles,
  onOpenQueue,
  onOpenHistory,
  onViewTransferDetails,
  onRetryTransfer,
  onPauseTransfer,
  onResumeTransfer,
  onAcceptTransfer,
  onRejectTransfer,
  onPreviewFile,
  onLeaveRoom,
  onNotify,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [selectedTargetDeviceId, setSelectedTargetDeviceId] = useState<string>('ALL');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.floor((room.expiresAt - Date.now()) / 1000))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const sec = Math.max(0, Math.floor((room.expiresAt - Date.now()) / 1000));
      setRemainingSec(sec);
    }, 1000);
    return () => clearInterval(timer);
  }, [room.expiresAt]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const shareUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/join/${room.code}`;
  const otherPeers = peers.filter((p) => p.id !== currentDevice.id);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    onNotify?.('Code Copied', `Room code ${room.code} copied to clipboard`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join DevDrop Room',
          text: `Join my ephemeral DevDrop transfer room: ${room.code}`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // user cancelled or fallback
      }
    }

    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    onNotify?.('Link Copied', 'Direct join link copied to clipboard', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    const targets = selectedTargetDeviceId === 'ALL' ? otherPeers.map((p) => p.id) : [selectedTargetDeviceId];
    if (targets.length === 0) return;

    if (onStageFiles) {
      onStageFiles(fileList, targets);
    } else {
      fileList.forEach((file) => onSendFile(file, targets));
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const targets = selectedTargetDeviceId === 'ALL' ? otherPeers.map((p) => p.id) : [selectedTargetDeviceId];
    if (targets.length === 0) return;

    onSendFolder(e.target.files, targets);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const fileList = Array.from(e.dataTransfer.files);
    const targets = selectedTargetDeviceId === 'ALL' ? otherPeers.map((p) => p.id) : [selectedTargetDeviceId];
    if (targets.length === 0) return;

    if (onStageFiles) {
      onStageFiles(fileList, targets);
    } else {
      fileList.forEach((file) => onSendFile(file, targets));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 animate-fade-in pb-16 px-4 sm:px-6">
      {/* Signature Room Ready Banner */}
      <div className="surface-card p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-ink-muted">
                Transfer Room
              </span>
              {room.isOneTime && (
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-subtle bg-amber-50 text-amber-900 border border-amber-200">
                  One-Time
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-ink font-mono tracking-wider">
                {room.code}
              </h1>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-xs font-mono text-ink-secondary hover:text-ink transition-all shadow-subtle btn-press"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600 animate-check-settle" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy code'}</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-xs font-mono text-ink-secondary hover:text-ink transition-all shadow-subtle btn-press"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 animate-check-settle" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Share link'}</span>
                </button>
                <button
                  onClick={() => setShowQr(!showQr)}
                  className={`p-1.5 rounded-subtle border transition-all shadow-subtle btn-press ${
                    showQr ? 'bg-ink text-surface border-ink' : 'bg-surface hover:bg-canvas-subtle border-border text-ink-secondary hover:text-ink'
                  }`}
                  title="Toggle QR Code"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-ink-muted font-mono flex items-center gap-1.5 pt-0.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              {remainingSec === 0 ? (
                <span className="text-rose-700 font-medium">Session Expired</span>
              ) : remainingSec < 120 ? (
                <span className="text-amber-800 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  Expires in {formatCountdown(remainingSec)} (soon)
                </span>
              ) : (
                <span>Expires in {formatCountdown(remainingSec)} · In-memory ephemeral</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {queueLength > 0 && onOpenQueue && (
              <button
                onClick={onOpenQueue}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-canvas-subtle border border-accent/40 text-accent text-xs font-sans font-medium transition-all shadow-subtle btn-press"
              >
                <Files className="w-3.5 h-3.5" />
                <span>Queue ({queueLength})</span>
              </button>
            )}
            {onOpenHistory && (
              <button
                onClick={onOpenHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-xs font-sans font-medium text-ink-secondary hover:text-ink transition-all shadow-subtle btn-press"
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>
            )}
            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-surface hover:bg-rose-50 border border-border hover:border-rose-200 text-xs font-sans font-medium text-ink-muted hover:text-rose-700 transition-all shadow-subtle btn-press"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Room</span>
            </button>
          </div>
        </div>

        {showQr && (
          <div className="mt-5 pt-5 border-t border-border flex flex-col sm:flex-row items-center gap-5 animate-qr-reveal">
            <div className="p-2.5 bg-surface rounded-card border border-border shadow-subtle">
              <QRCodeSVG value={shareUrl} size={130} level="H" includeMargin={true} />
            </div>
            <div className="text-center sm:text-left space-y-1">
              <h2 className="text-xs font-bold text-ink font-sans">Pair via Camera</h2>
              <p className="text-xs text-ink-secondary max-w-sm leading-relaxed font-sans">
                Point another device's camera at this QR code to join room <span className="text-ink font-mono font-bold">{room.code}</span> instantly.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Connected Devices Bar */}
      <div className="surface-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-ink-secondary" />
            <h2 className="text-xs font-mono font-medium uppercase tracking-wider text-ink-muted">
              Connected Devices ({peers.length})
            </h2>
          </div>
          {otherPeers.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-mono animate-fade-in">
              <span
                className={`w-2 h-2 rounded-full ${
                  networkStats?.rating === 'excellent'
                    ? 'bg-emerald-600'
                    : networkStats?.rating === 'good'
                    ? 'bg-emerald-500'
                    : networkStats?.rating === 'fair'
                    ? 'bg-amber-500'
                    : networkStats?.rating === 'poor'
                    ? 'bg-rose-500'
                    : 'bg-emerald-600'
                }`}
              />
              <span className="text-ink font-medium capitalize">
                {networkStats?.rating || 'Excellent'}
              </span>
              <span className="text-ink-muted">·</span>
              <span className="text-ink-secondary">
                {networkStats?.connectionType === 'direct-local'
                  ? 'Direct Wi-Fi / LAN'
                  : networkStats?.connectionType === 'direct-internet'
                  ? 'Direct P2P'
                  : networkStats?.connectionType === 'relayed'
                  ? 'Relay'
                  : 'Direct P2P'}
              </span>
            </div>
          )}
        </div>

        {peers.length === 1 ? (
          <div className="p-4 rounded-card bg-canvas-subtle border border-border text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-ink font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Waiting for a second device to connect…</span>
            </div>
            <p className="text-[11px] text-ink-muted font-sans">Share the 6-character room code or scan the QR code above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {peers.map((peer) => (
              <div
                key={peer.id}
                className={`p-2.5 rounded-card border transition-all flex items-center justify-between animate-device-connect ${
                  peer.id === currentDevice.id
                    ? 'bg-canvas-subtle border-ink/30 shadow-subtle'
                    : 'bg-surface border-border hover:border-ink/20 shadow-subtle'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-subtle bg-canvas-dark text-ink flex items-center justify-center border border-border shrink-0">
                    {peer.type === 'mobile' ? <Smartphone className="w-3.5 h-3.5 text-ink-secondary" /> : <Laptop className="w-3.5 h-3.5 text-ink-secondary" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-ink truncate max-w-[120px] font-sans">{peer.name}</span>
                      {peer.id === currentDevice.id && (
                        <span className="text-[9px] px-1 py-0.2 rounded-sm bg-canvas-dark text-ink-secondary font-mono font-semibold">YOU</span>
                      )}
                      {peer.isHost && (
                        <span className="text-[9px] px-1 py-0.2 rounded-sm bg-canvas-dark text-ink-muted font-mono font-medium">HOST</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-ink-muted font-mono truncate">
                      <span>{peer.platformDescription || (peer.type === 'mobile' ? 'Mobile' : 'Desktop')}</span>
                    </div>
                  </div>
                </div>

                <span className="text-[10px] text-emerald-800 font-mono flex items-center gap-1 shrink-0 ml-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  {networkStats?.connectionType === 'relayed' ? 'Relay' : 'Direct'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Transfer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: File Drop & Actions */}
        <div className="lg:col-span-1 surface-card p-5 space-y-4 h-fit">
          <h2 className="text-xs font-mono font-medium uppercase tracking-wider text-ink-muted">Send Files</h2>

          <div>
            <label className="block text-[11px] font-mono font-medium text-ink-muted uppercase tracking-wider mb-1.5">
              Destination Device
            </label>
            <select
              value={selectedTargetDeviceId}
              onChange={(e) => setSelectedTargetDeviceId(e.target.value)}
              disabled={otherPeers.length === 0}
              className="w-full px-3 py-2 rounded-subtle bg-canvas-subtle border border-border text-xs text-ink focus:bg-surface focus:border-ink font-sans disabled:opacity-50 transition-colors"
            >
              {otherPeers.length > 1 && <option value="ALL">Send to All Devices ({otherPeers.length})</option>}
              {otherPeers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
              {otherPeers.length === 0 && <option value="NONE">No other devices connected</option>}
            </select>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFolderChange}
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden"
          />

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (otherPeers.length > 0) setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            onClick={() => otherPeers.length > 0 && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-card p-6 text-center space-y-2.5 transition-all cursor-pointer ${
              otherPeers.length > 0
                ? isDraggingOver
                  ? 'border-accent bg-accent-faint scale-[0.99]'
                  : 'border-border hover:border-ink/40 bg-canvas-subtle hover:bg-surface'
                : 'border-border opacity-50 cursor-not-allowed bg-canvas-subtle'
            }`}
          >
            <div className="w-10 h-10 rounded-subtle bg-surface text-ink mx-auto flex items-center justify-center border border-border shadow-subtle">
              <UploadCloud className="w-5 h-5 stroke-[1.8] text-ink-secondary" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-ink font-sans">
                {isDraggingOver ? 'Release to send' : 'Drop files here or choose files'}
              </p>
              <p className="text-[11px] text-ink-muted font-sans">Single files, multiple files, or folders</p>
            </div>
          </div>

          <button
            onClick={() => otherPeers.length > 0 && folderInputRef.current?.click()}
            disabled={otherPeers.length === 0}
            className="w-full py-2.5 px-3 rounded-subtle bg-surface hover:bg-canvas-subtle disabled:opacity-40 text-ink text-xs font-sans font-medium flex items-center justify-center gap-2 border border-border transition-colors shadow-subtle"
          >
            <FolderPlus className="w-4 h-4 text-ink-secondary" />
            <span>Select Folder to Share</span>
          </button>
        </div>

        {/* Right Column: Transfer Queue & Live Activity */}
        <div className="lg:col-span-2 surface-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-medium uppercase tracking-wider text-ink-muted">
              Transfer Activity ({transfers.length})
            </h2>
            {queueLength > 0 && onOpenQueue && (
              <button
                onClick={onOpenQueue}
                className="text-xs font-mono text-accent hover:underline flex items-center gap-1"
              >
                <span>View Queue ({queueLength})</span>
              </button>
            )}
          </div>

          {/* Transfer Result Summary Card */}
          <TransferResultSummary
            transfers={transfers}
            connectionType={networkStats?.connectionType}
            onViewDetails={(t) => onViewTransferDetails?.(t)}
            onRetryFailed={(id) => onRetryTransfer?.(id)}
            onCloseSession={onLeaveRoom}
          />

          {/* Real-Time Speed Graph */}
          {speedSamples && speedSamples.length > 1 && (
            <SpeedGraph
              samples={speedSamples}
              currentSpeed={transfers.find((t) => t.status === 'transferring')?.speedBytesPerSec || 0}
              averageSpeed={transfers.find((t) => t.status === 'transferring')?.averageSpeedBytesPerSec}
            />
          )}

          {transfers.length === 0 ? (
            <div className="text-center py-14 space-y-2 border border-dashed border-border rounded-card bg-canvas-subtle">
              <Send className="w-6 h-6 text-ink-muted mx-auto stroke-[1.5]" />
              <p className="text-xs font-medium text-ink font-sans">No active or past transfers in this session.</p>
              <p className="text-[11px] text-ink-muted font-sans">Select a file on the left to begin streaming peer-to-peer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((t) => (
                <div
                  key={t.metadata.transferId}
                  className="p-4 rounded-card bg-canvas-subtle border border-border space-y-3 shadow-subtle"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink font-mono truncate max-w-[200px] sm:max-w-[320px]">
                          {t.metadata.fileName}
                        </span>
                        <span className="text-[11px] text-ink-muted font-mono shrink-0">
                          {TransferEngine.formatBytes(t.metadata.fileSize)}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-secondary font-sans">
                        Sender: <span className="text-ink font-medium">{t.metadata.senderDeviceName}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {t.status === 'completed' && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-800 font-mono px-2 py-0.5 rounded-subtle bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Done
                        </span>
                      )}
                      {t.status === 'failed' && (
                        <span className="flex items-center gap-1 text-[11px] text-rose-800 font-mono px-2 py-0.5 rounded-subtle bg-rose-50 border border-rose-200">
                          Failed
                        </span>
                      )}
                      {t.status === 'transferring' && (
                        <span className="flex items-center gap-1 text-[11px] text-accent font-mono px-2 py-0.5 rounded-subtle bg-accent-faint border border-accent/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                          Transferring
                        </span>
                      )}
                      {t.status === 'paused' && (
                        <span className="text-[11px] text-amber-800 font-mono px-2 py-0.5 rounded-subtle bg-amber-50 border border-amber-200">
                          Paused
                        </span>
                      )}
                      {t.status === 'offering' && t.metadata.senderDeviceId !== currentDevice.id && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onAcceptTransfer(t.metadata.transferId)}
                            className="px-3 py-1 rounded-subtle bg-ink hover:bg-ink/90 text-surface text-xs font-sans font-medium btn-press"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => onRejectTransfer(t.metadata.transferId)}
                            className="px-3 py-1 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink text-xs font-sans btn-press"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {t.status === 'failed' && onRetryTransfer && (
                        <button
                          onClick={() => onRetryTransfer(t.metadata.transferId)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-subtle bg-accent text-surface hover:bg-accent-hover text-xs font-sans font-medium btn-press"
                          title="Retry failed transfer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}

                      {t.status === 'transferring' && (
                        <button
                          onClick={() => onPauseTransfer(t.metadata.transferId)}
                          className="p-1 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink btn-press"
                          title="Pause transfer"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {t.status === 'paused' && (
                        <button
                          onClick={() => onResumeTransfer(t.metadata.transferId)}
                          className="p-1 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-accent btn-press"
                          title="Resume transfer"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {t.status === 'completed' && (
                        <button
                          onClick={() => onViewTransferDetails?.(t)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink text-xs font-sans font-medium btn-press"
                          title="Inspect transfer details & checksum"
                        >
                          <Info className="w-3.5 h-3.5 text-accent" />
                          <span>Details</span>
                        </button>
                      )}
                      {t.status === 'completed' && t.receivedChunks && (
                        <button
                          onClick={() => onPreviewFile(t)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink text-xs font-sans font-medium btn-press"
                        >
                          <Eye className="w-3.5 h-3.5 text-ink-secondary" />
                          <span>Preview</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Linear Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-ink h-full rounded-full transition-all duration-150"
                        style={{ width: `${t.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono tabular-nums text-ink-secondary">
                      <span>
                        {TransferEngine.formatBytes(t.bytesTransferred)} / {TransferEngine.formatBytes(t.metadata.fileSize)} ({t.progressPercent}%)
                      </span>
                      {t.status === 'transferring' && (
                        <span>
                          {TransferEngine.formatSpeed(t.speedBytesPerSec)} · {TransferEngine.formatEta(t.etaSeconds)}
                        </span>
                      )}
                      {t.status === 'completed' && t.startTime && (
                        <span>
                          {TransferEngine.formatDuration((Date.now() - t.startTime) / 1000)} · {TransferEngine.formatSpeed(t.averageSpeedBytesPerSec || t.speedBytesPerSec)} avg
                        </span>
                      )}
                    </div>
                  </div>

                  {t.status === 'completed' && t.verified && (
                    <div className="pt-0.5 flex items-center justify-between text-[11px] font-mono text-emerald-800">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>SHA-256 Verified ✓</span>
                      </div>
                      <span className="text-[10px] text-ink-muted">WebRTC DataChannel</span>
                    </div>
                  )}
                  {t.status === 'failed' && (
                    <div className="pt-0.5 flex items-center justify-between text-[11px] font-mono text-rose-800">
                      <span>{t.error || 'Transfer failed during peer-to-peer transmission'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


