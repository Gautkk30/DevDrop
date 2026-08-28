import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, CameraOff } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (roomCode: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setCameraError(null);
    let scanner: Html5QrcodeScanner | null = null;

    try {
      scanner = new Html5QrcodeScanner(
        'qr-reader-container',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          let code = decodedText;
          if (decodedText.includes('/join/')) {
            const parts = decodedText.split('/join/');
            code = parts[parts.length - 1];
          }

          scanner?.clear();
          onScanSuccess(code);
        },
        () => {
          // ignore scan frame errors
        }
      );
    } catch (err: any) {
      setCameraError('Camera access not supported or permission denied. Please enter the room code manually.');
    }

    return () => {
      if (scanner) {
        scanner.clear().catch((e) => console.warn('Failed to clear scanner', e));
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-scrim">
      <div className="w-full max-w-md bg-surface p-6 relative rounded-modal border border-border shadow-modal animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors z-10"
          aria-label="Close scanner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1 mb-5 text-center">
          <h2 className="text-xl font-bold text-ink font-sans tracking-tight">Scan Room QR</h2>
          <p className="text-xs text-ink-secondary">
            Point your camera at the QR code displayed on the other device.
          </p>
        </div>

        {cameraError ? (
          <div className="p-6 rounded-card bg-canvas-subtle border border-border text-center space-y-3">
            <div className="w-10 h-10 rounded-subtle bg-surface text-ink-muted mx-auto flex items-center justify-center border border-border">
              <CameraOff className="w-5 h-5" />
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed font-sans">{cameraError}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-subtle bg-ink text-surface text-xs font-medium transition-colors"
            >
              Enter Code Manually
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-card bg-canvas-subtle border border-border p-2">
            <div id="qr-reader-container" className="w-full text-ink text-xs font-mono"></div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border text-center">
          <button
            onClick={onClose}
            className="text-xs text-ink-muted hover:text-ink transition-colors font-sans"
          >
            Cancel & Return to Code Entry
          </button>
        </div>
      </div>
    </div>
  );
};

