import React from 'react';
import { Laptop, Smartphone, ArrowRight, ShieldCheck, Zap, KeyRound } from 'lucide-react';

interface LandingViewProps {
  onOpenCreate: () => void;
  onOpenJoin: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onOpenCreate, onOpenJoin }) => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-16 py-12 sm:py-16 px-4 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-canvas-dark border border-border text-ink text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>WebRTC P2P DataChannel Architecture</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-ink font-sans tracking-tight leading-[1.08]">
            DEVICES. <br />
            CONNECTED.
          </h1>
          <p className="text-base sm:text-lg text-ink-secondary font-sans max-w-xl mx-auto font-normal leading-relaxed">
            Transfer files directly between your devices. <br className="hidden sm:block" />
            No account. No cables. No permanent cloud storage.
          </p>
        </div>

        {/* Minimal Connected Device Illustration */}
        <div className="py-4 flex items-center justify-center">
          <div className="bg-surface px-6 py-4 rounded-card border border-border shadow-subtle flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 text-ink">
              <Laptop className="w-5 h-5 text-ink-secondary" />
              <span className="text-xs font-mono font-medium">Laptop</span>
            </div>

            <div className="flex items-center gap-1.5 text-accent font-mono text-[11px]">
              <span className="h-[1px] w-6 sm:w-12 bg-border-strong" />
              <span className="px-2 py-0.5 rounded-full bg-canvas-subtle border border-border text-ink-muted text-[10px]">
                Direct P2P
              </span>
              <span className="h-[1px] w-6 sm:w-12 bg-border-strong" />
            </div>

            <div className="flex items-center gap-2 text-ink">
              <Smartphone className="w-5 h-5 text-ink-secondary" />
              <span className="text-xs font-mono font-medium">Phone</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onOpenCreate}
            className="w-full sm:w-auto px-6 py-3.5 rounded-subtle bg-ink hover:bg-ink/90 text-surface font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-subtle group btn-press"
          >
            <span>Start Transferring</span>
            <ArrowRight className="w-4 h-4 text-surface/70 group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>
          <button
            onClick={onOpenJoin}
            className="w-full sm:w-auto px-6 py-3.5 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-subtle btn-press"
          >
            <span>Join with Room Code</span>
          </button>
        </div>
      </div>

      {/* 3 Core Architecture Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        <div className="surface-card p-6 space-y-3">
          <div className="w-9 h-9 rounded-subtle bg-canvas-dark text-ink flex items-center justify-center border border-border">
            <Zap className="w-4 h-4 text-accent" />
          </div>
          <h3 className="text-sm font-semibold text-ink font-sans">Pure WebRTC DataChannels</h3>
          <p className="text-xs text-ink-secondary leading-relaxed font-sans">
            Transfers stream peer-to-peer over high-speed DataChannels. Automatically uses local network routes when devices share Wi-Fi.
          </p>
        </div>

        <div className="surface-card p-6 space-y-3">
          <div className="w-9 h-9 rounded-subtle bg-canvas-dark text-ink flex items-center justify-center border border-border">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-sm font-semibold text-ink font-sans">Zero Cloud Storage</h3>
          <p className="text-xs text-ink-secondary leading-relaxed font-sans">
            File contents never touch a server disk or database. Transfers verify with SHA-256 Web Crypto checksums upon assembly.
          </p>
        </div>

        <div className="surface-card p-6 space-y-3">
          <div className="w-9 h-9 rounded-subtle bg-canvas-dark text-ink flex items-center justify-center border border-border">
            <KeyRound className="w-4 h-4 text-brand-slate" />
          </div>
          <h3 className="text-sm font-semibold text-ink font-sans">Ephemeral Rooms</h3>
          <p className="text-xs text-ink-secondary leading-relaxed font-sans">
            Sessions expire automatically with zero trace. Pair effortlessly via QR codes, direct URLs, or optional room passwords.
          </p>
        </div>
      </div>
    </div>
  );
};

