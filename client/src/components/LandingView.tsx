import React from 'react';
import { Laptop, Smartphone, ArrowRight, ShieldCheck, Zap, KeyRound } from 'lucide-react';

interface LandingViewProps {
  onOpenCreate: () => void;
  onOpenJoin: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onOpenCreate, onOpenJoin }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-12 py-10 sm:py-16 px-4 animate-fade-in">
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

        {/* Minimal Connected Device Schematic */}
        <div className="py-2 flex items-center justify-center">
          <div className="bg-surface px-5 py-3 rounded-card border border-border shadow-subtle flex items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2 text-ink">
              <Laptop className="w-4 h-4 text-ink-secondary stroke-[1.75]" />
              <span className="text-xs font-mono font-medium">Laptop</span>
            </div>

            <div className="flex items-center gap-1.5 text-accent font-mono text-[11px]">
              <span className="h-[1px] w-5 sm:w-10 bg-border-strong" />
              <span className="px-2 py-0.5 rounded-subtle bg-canvas-subtle border border-border text-ink-muted text-[10px]">
                Direct P2P
              </span>
              <span className="h-[1px] w-5 sm:w-10 bg-border-strong" />
            </div>

            <div className="flex items-center gap-2 text-ink">
              <Smartphone className="w-4 h-4 text-ink-secondary stroke-[1.75]" />
              <span className="text-xs font-mono font-medium">Phone</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
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

