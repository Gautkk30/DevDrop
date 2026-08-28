import React, { useEffect, useState } from 'react';
import { X, FileText, Download, File, Image, Film, Music } from 'lucide-react';
import type { TransferMetadata } from '../shared/types.js';

interface FilePreviewModalProps {
  metadata: TransferMetadata | null;
  blob: Blob | null;
  onClose: () => void;
  onDownload: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  metadata,
  blob,
  onClose,
  onDownload,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      setTextContent(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setObjectUrl(url);

    const isText = metadata?.fileType.startsWith('text/') || 
      /\.(txt|json|js|ts|md|css|html|py|sh|csv|xml)$/i.test(metadata?.fileName || '');

    if (isText && blob.size < 500 * 1024) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTextContent(e.target?.result as string);
      };
      reader.readAsText(blob);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob, metadata]);

  if (!metadata || !blob) return null;

  const isImage = metadata.fileType.startsWith('image/');
  const isVideo = metadata.fileType.startsWith('video/');
  const isAudio = metadata.fileType.startsWith('audio/');
  const isPdf = metadata.fileType === 'application/pdf' || metadata.fileName.endsWith('.pdf');

  return (
    <div className="modal-scrim">
      <div className="w-full max-w-2xl max-h-[85vh] bg-surface p-6 relative rounded-modal border border-border shadow-modal flex flex-col animate-slide-up">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-subtle bg-canvas-dark text-ink flex items-center justify-center border border-border">
              {isImage && <Image className="w-4 h-4" />}
              {isVideo && <Film className="w-4 h-4" />}
              {isAudio && <Music className="w-4 h-4" />}
              {!isImage && !isVideo && !isAudio && <FileText className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink font-sans truncate max-w-[260px] sm:max-w-[380px]">
                {metadata.fileName}
              </h2>
              <p className="text-xs text-ink-muted font-mono">{(blob.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-subtle bg-ink hover:bg-ink/90 text-surface text-xs font-medium transition-colors shadow-subtle"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-subtle text-ink-muted hover:text-ink hover:bg-canvas-subtle transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto my-4 rounded-card bg-canvas-subtle border border-border p-4 flex items-center justify-center min-h-[250px]">
          {objectUrl && isImage && (
            <img src={objectUrl} alt={metadata.fileName} className="max-h-[60vh] object-contain rounded-subtle shadow-subtle" />
          )}

          {objectUrl && isVideo && (
            <video src={objectUrl} controls className="max-h-[60vh] w-full rounded-subtle" />
          )}

          {objectUrl && isAudio && (
            <audio src={objectUrl} controls className="w-full max-w-md" />
          )}

          {objectUrl && isPdf && (
            <iframe src={objectUrl} className="w-full h-[50vh] rounded-subtle" title="PDF Preview" />
          )}

          {textContent !== null && (
            <pre className="w-full h-full text-xs font-mono text-ink overflow-auto whitespace-pre-wrap p-3 bg-surface rounded-subtle border border-border">
              {textContent}
            </pre>
          )}

          {!isImage && !isVideo && !isAudio && !isPdf && textContent === null && (
            <div className="text-center py-10 space-y-3">
              <File className="w-12 h-12 text-ink-muted mx-auto stroke-[1.2]" />
              <p className="text-xs text-ink-secondary font-sans">No direct preview available for this format.</p>
              <button
                onClick={onDownload}
                className="px-4 py-2 rounded-subtle bg-surface hover:bg-canvas-subtle border border-border text-ink text-xs font-medium font-sans"
              >
                Download to View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

