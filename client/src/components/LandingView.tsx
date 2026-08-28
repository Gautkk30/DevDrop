import React, { useRef, useState } from 'react';
import { ArrowRight, ShieldCheck, Zap, KeyRound, UploadCloud } from 'lucide-react';

interface LandingViewProps {
  onOpenCreate: () => void;
  onOpenJoin: () => void;
  onQuickSend?: (files: File[]) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onOpenCreate, onOpenJoin, onQuickSend }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onQuickSend) {
      onQuickSend(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onQuickSend) {
      onQuickSend(Array.from(e.target.files));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-10 py-8 sm:py-12 px-4 animate-fade-in">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        multiple
        className="hidden"
      />

      {/* Hero Section */}
      <div className="text-center space-y-5 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-subtle bg-canvas-dark border border-border text-ink-secondary text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>Peer-to-Peer WebRTC DataChannels</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-ink font-sans tracking-tight leading-[1.15]">
            Direct, private file transfer <br className="hidden sm:block" />
            between your devices.
          </h1>
          <p className="text-sm sm:text-base text-ink-secondary font-sans max-w-lg mx-auto font-normal leading-relaxed">
            Stream files directly over your local network and WebRTC DataChannels. No account creation, no file size limits, zero cloud storage.
          </p>
        </div>

        {/* Quick Send Dropzone */}
        {onQuickSend && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 sm:p-7 rounded-card border-2 border-dashed transition-all cursor-pointer text-center space-y-2 group ${
              isDragOver
                ? 'border-accent bg-accent/5 scale-[1.01]'
                : 'border-border hover:border-ink/30 bg-surface shadow-subtle'
            }`}
          >
            <div className="w-10 h-10 rounded-subtle bg-canvas-dark text-accent mx-auto flex items-center justify-center border border-border group-hover:scale-105 transition-transform">
              <UploadCloud className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <span className="text-sm font-bold text-ink font-sans">
                Drop files here for Quick Send
              </span>
              <p className="text-xs text-ink-muted font-sans mt-0.5">
                or click to browse from this device
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <button
            onClick={onOpenCreate}
            className="w-full sm:w-auto px-5 py-2.5 rounded-subtle bg-ink hover:bg-ink/90 text-surface font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-subtle group btn-press"
          >
            <span>Create Transfer Room</span>
            <ArrowRight className="w-4 h-4 text-surface/70 group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>
          <button
            onClick={onOpenJoin}
            className="w-full sm:w-auto px-5 py-2.5 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-subtle btn-press"
          >
            <span>Join with Code</span>
          </button>
        </div>
      </div>

      {/* 3 Architecture Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="surface-card p-5 space-y-2.5">
          <div className="w-8 h-8 rounded-subtle bg-canvas-dark text-ink flex items-center justify-center border border-border">
            <Zap className="w-3.5 h-3.5 text-accent" />
          </div>
          <h2 className="text-sm font-semibold text-ink font-sans">Direct DataChannels</h2>
          <p className="text-xs text-ink-secondary leading-relaxed font-sans">
            Files stream directly peer-to-peer over WebRTC. Automatically leverages high-speed local LAN paths when devices share the same Wi-Fi.
          </p>
        </div>

        <div className="surface-card p-5 space-y-2.5">
          <div className="w-8 h-8 rounded-subtle bg-canvas-dark text-ink flex items-center justify-center border border-border">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <h2 className="text-sm font-semibold text-ink font-sans">Zero Cloud Storage</h2>
          <p className="text-xs text-ink-secondary leading-relaxed font-sans">
            Binary payloads never touch a server disk or database. Every completed transfer is cryptographically verified with SHA-256 Web Crypto.
          </p>
        </div>

        <div className="surface-card p-5 space-y-2.5">
          <div className="w-8 h-8 rounded-subtle bg-canvas-dark text-ink flex items-center justify-center border border-border">
            <KeyRound className="w-3.5 h-3.5 text-brand-slate" />
          </div>
          <h2 className="text-sm font-semibold text-ink font-sans">Ephemeral Sessions</h2>
          <p className="text-xs text-ink-secondary leading-relaxed font-sans">
            Rooms expire and wipe from server memory automatically. Connect instantly via camera QR scan, direct URLs, or optional passwords.
          </p>
        </div>
      </div>
    </div>
  );
};

