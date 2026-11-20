'use client';

import { Camera, Check, X, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AvatarDialogProps {
  /** The File selected by the operator (not yet uploaded). */
  file: File | null;
  /** Currently selected avatar preview URL (object URL for the selected file). */
  previewUrl: string | null;
  /** Whether an upload is in flight. */
  uploading: boolean;
  /** Commit the selected file to the server. */
  onSave: (file: File) => Promise<void>;
  /** Discard the selection and close the dialog. */
  onCancel: () => void;
  /** Close the dialog without saving. */
  onClose: () => void;
}

export default function AvatarDialog({
  file,
  previewUrl,
  uploading,
  onSave,
  onCancel,
  onClose,
}: AvatarDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dismissTimeout, setDismissTimeout] = useState<number | null>(null);

  // Clicking the backdrop closes the dialog.
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Escape closes the dialog.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-revoke the object URL when the dialog unmounts or preview changes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSave = async () => {
    if (!file) return;
    setDismissTimeout(window.setTimeout(() => onClose(), 120));
    await onSave(file);
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-label="Change profile photo"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div
        className="relative w-full max-w-md mx-4 transform bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border)] p-6 shadow-2xl text-center animate-in fade-in zoom-in duration-200"
      >
        <div className="relative mx-auto mb-4">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-48 w-48 rounded-full object-cover border-4 border-[var(--accent)] shadow-lg"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-full border-4 border-[var(--accent)] bg-[var(--bg-input)]">
              <Camera size={32} className="text-[var(--text-muted)]" aria-hidden="true" />
            </div>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="absolute -top-2 -right-2 p-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
            aria-label="Remove photo"
          >
            <X size={14} />
          </button>
        </div>

        <h3 className="font-display text-lg font-bold mb-1">Change profile photo</h3>
        <p className="text-xs text-[var(--text-muted)] mb-6">
          Choose a new photo. JPG, PNG or WebP, up to 2 MB.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!file || uploading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-base)] text-sm font-black uppercase tracking-widest shadow-lg hover:shadow-[var(--accent)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {uploading ? 'Saving' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
