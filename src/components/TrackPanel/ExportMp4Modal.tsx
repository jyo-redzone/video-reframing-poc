import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXPORT_COPY_FEEDBACK_MS } from '../../config';

/**
 * Returns the platform-specific copy-paste command template for the export
 * CLI. Detection uses (in order) `navigator.userAgentData?.platform`,
 * `navigator.platform`, and a `navigator.userAgent` substring fallback —
 * anything that smells like Windows yields the `.bat` variant, everything
 * else yields the POSIX `.sh` variant.
 *
 * The returned string includes the literal `<path-to-json>` placeholder
 * which the user replaces in their terminal.
 */
export function getExportCommandTemplate(): string {
  const nav: Navigator | undefined =
    typeof navigator === 'undefined' ? undefined : navigator;
  const uaData = (nav as unknown as { userAgentData?: { platform?: string } } | undefined)
    ?.userAgentData;
  const candidate = uaData?.platform || nav?.platform || nav?.userAgent || '';
  const isWindows = /win/i.test(candidate);
  return isWindows
    ? 'tools\\export-cli\\export.bat --mp4-url <cloudflare-mp4-url> <path-to-json>'
    : './tools/export-cli/export.sh --mp4-url <cloudflare-mp4-url> <path-to-json>';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ExportMp4Modal({ open, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const command = getExportCommandTemplate();

  // Focus the Copy button on open for ergonomic copy/paste flow.
  useEffect(() => {
    if (!open) return;
    copyButtonRef.current?.focus();
  }, [open]);

  // Reset the "Copied!" indicator whenever the modal opens/closes.
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  // ESC to close + click-outside-card to close. Mirrors VideoInfoPopover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (cardRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = () => {
    const clipboard = navigator?.clipboard;
    if (!clipboard?.writeText) {
      // No clipboard API available — surface a console warning and bail.
      // eslint-disable-next-line no-console
      console.warn('Clipboard API unavailable; cannot copy export command.');
      return;
    }
    clipboard.writeText(command).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), EXPORT_COPY_FEEDBACK_MS);
      },
      (err) => {
        // Page-not-focused (and similar) failures should not crash the modal.
        // eslint-disable-next-line no-console
        console.warn('Failed to copy export command to clipboard:', err);
      },
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-mp4-modal-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div
        ref={cardRef}
        className="w-full max-w-lg rounded-default border border-border-subtle bg-surface-raised p-5 text-sm text-text-primary shadow-elevation-8"
      >
        <h2
          id="export-mp4-modal-heading"
          className="text-base font-semibold text-text-primary"
        >
          Export MP4
        </h2>
        <p className="mt-2 text-text-secondary">
          The track JSON has been downloaded. Paste the command below into a terminal,
          replace <code className="font-mono">&lt;cloudflare-mp4-url&gt;</code> with
          the Cloudflare Stream download URL, and replace{' '}
          <code className="font-mono">&lt;path-to-json&gt;</code> with the path to
          the saved file.
        </p>
        <div className="mt-3 flex items-start gap-2">
          <pre className="flex-1 select-text overflow-x-auto rounded-default border border-border-subtle bg-black/30 p-2 font-mono text-xs leading-snug text-text-primary">
            <code>{command}</code>
          </pre>
          <button
            ref={copyButtonRef}
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium uppercase tracking-button text-text-primary hover:bg-white/10"
            aria-label="Copy export command"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-default bg-brand px-4 py-2 text-xs font-medium uppercase tracking-button text-white hover:bg-brand/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
