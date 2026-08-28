import React, { useMemo } from 'react';
import type { TransferSpeedSample } from '../shared/types.js';
import { TransferEngine } from '../services/TransferEngine.js';

interface SpeedGraphProps {
  samples: TransferSpeedSample[];
  currentSpeed: number;
  averageSpeed?: number;
  className?: string;
}

export const SpeedGraph: React.FC<SpeedGraphProps> = ({
  samples,
  currentSpeed,
  averageSpeed,
  className = '',
}) => {
  const { pathD, areaD, maxSpeed } = useMemo(() => {
    if (!samples || samples.length < 2) {
      return { pathD: '', areaD: '', maxSpeed: Math.max(currentSpeed, 1024 * 1024) };
    }

    const width = 280;
    const height = 44;
    const padding = 2;

    const speeds = samples.map((s) => s.speedBytesPerSec);
    const max = Math.max(...speeds, currentSpeed, 1024 * 1024); // Minimum 1MB/s ceiling

    const points = samples.map((sample, idx) => {
      const x = padding + (idx / (samples.length - 1)) * (width - padding * 2);
      const normalizedSpeed = Math.min(1, Math.max(0, sample.speedBytesPerSec / max));
      const y = height - padding - normalizedSpeed * (height - padding * 2);
      return { x, y };
    });

    const linePath = points.reduce((acc, pt, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    }, '');

    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    const bottomY = height - padding;
    const areaPath = `${linePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

    return { pathD: linePath, areaD: areaPath, maxSpeed: max };
  }, [samples, currentSpeed]);

  if (!samples || samples.length === 0) {
    return null;
  }

  return (
    <div className={`p-2.5 rounded-card bg-canvas-subtle border border-border space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-ink-muted">
        <span className="uppercase tracking-wider">Transfer Throughput</span>
        <span className="text-ink font-medium">
          {TransferEngine.formatSpeed(currentSpeed)}
          {averageSpeed ? ` (avg ${TransferEngine.formatSpeed(averageSpeed)})` : ''}
        </span>
      </div>

      <div className="relative h-11 w-full overflow-hidden">
        <svg
          viewBox="0 0 280 44"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent, #C2410C)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-accent, #C2410C)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {areaD && <path d={areaD} fill="url(#speedGradient)" />}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#C2410C"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono text-ink-muted">
        <span>60s window</span>
        <span>Peak {TransferEngine.formatSpeed(maxSpeed)}</span>
      </div>
    </div>
  );
};
