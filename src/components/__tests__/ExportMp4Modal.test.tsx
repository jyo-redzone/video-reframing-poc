import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ExportMp4Modal, { getExportCommandTemplate } from '../TrackPanel/ExportMp4Modal';

const WIN_COMMAND = 'tools\\export-cli\\export.bat --mp4-url <cloudflare-mp4-url> <path-to-json>';
const POSIX_COMMAND = './tools/export-cli/export.sh --mp4-url <cloudflare-mp4-url> <path-to-json>';

/** Re-define navigator.platform (jsdom defaults to empty / "Linux x86_64"). */
function setNavigatorPlatform(platform: string) {
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    get: () => platform,
  });
}

describe('getExportCommandTemplate', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(
    window.navigator,
    'platform',
  );

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(window.navigator, 'platform', originalPlatform);
    }
  });

  it('returns the POSIX template on non-Windows platforms', () => {
    setNavigatorPlatform('MacIntel');
    expect(getExportCommandTemplate()).toBe(POSIX_COMMAND);
  });

  it('returns the Windows template when platform is Win32', () => {
    setNavigatorPlatform('Win32');
    expect(getExportCommandTemplate()).toBe(WIN_COMMAND);
  });
});

describe('ExportMp4Modal', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(
    window.navigator,
    'platform',
  );
  const originalClipboard = Object.getOwnPropertyDescriptor(
    window.navigator,
    'clipboard',
  );

  beforeEach(() => {
    // Default to a non-Windows platform per test unless overridden.
    setNavigatorPlatform('MacIntel');
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(window.navigator, 'platform', originalPlatform);
    }
    if (originalClipboard) {
      Object.defineProperty(window.navigator, 'clipboard', originalClipboard);
    } else {
      // Best-effort cleanup if clipboard was injected in a test.
      // (Object.defineProperty with undefined would throw; just remove.)
      try {
        delete (window.navigator as unknown as { clipboard?: unknown }).clipboard;
      } catch {
        /* noop */
      }
    }
    vi.restoreAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(<ExportMp4Modal open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders heading and the POSIX command template when open on non-Windows', () => {
    setNavigatorPlatform('MacIntel');
    render(<ExportMp4Modal open={true} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Export MP4')).toBeTruthy();
    // The <code> child of the <pre> carries the literal command string.
    expect(screen.getByText(POSIX_COMMAND)).toBeTruthy();
  });

  it('shows the Windows template when navigator.platform is Win32', () => {
    setNavigatorPlatform('Win32');
    render(<ExportMp4Modal open={true} onClose={() => {}} />);
    expect(screen.getByText(WIN_COMMAND)).toBeTruthy();
  });

  it('Copy button writes the literal command to the clipboard', async () => {
    setNavigatorPlatform('MacIntel');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      get: () => ({ writeText }),
    });

    render(<ExportMp4Modal open={true} onClose={() => {}} />);
    const copyBtn = screen.getByRole('button', { name: /copy export command/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(POSIX_COMMAND);
  });

  it('calls onClose when ESC is pressed', () => {
    const onClose = vi.fn();
    render(<ExportMp4Modal open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
