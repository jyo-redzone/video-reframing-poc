import type { Track, Keyframe, ClipRange, SourceRect } from '../types';
import { TRACK_FILE_SCHEMA_VERSION, TRACK_FILENAME_PART_MAX_LENGTH } from '../config';

export type ParsedTrackFile = { videoUrl: string; track: Track };

export type ParseResult =
  | { ok: true; videoUrl: string; track: Track }
  | { ok: false; error: string };

/**
 * Pretty-prints a Track + videoUrl into a JSON payload suitable for download.
 */
export function serializeTrack(track: Track, videoUrl: string): string {
  const payload = {
    schemaVersion: TRACK_FILE_SCHEMA_VERSION,
    videoUrl,
    track,
  };
  return JSON.stringify(payload, null, 2);
}

// ── Validation helpers ────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateSourceRect(v: unknown, path: string): SourceRect | string {
  if (!isPlainObject(v)) return `${path}: expected an object`;
  const { x, y, width, height } = v;
  if (!isFiniteNumber(x)) return `${path}.x: expected a finite number`;
  if (!isFiniteNumber(y)) return `${path}.y: expected a finite number`;
  if (!isFiniteNumber(width)) return `${path}.width: expected a finite number`;
  if (!isFiniteNumber(height)) return `${path}.height: expected a finite number`;
  return { x, y, width, height };
}

function validateClipRange(v: unknown, path: string): ClipRange | string {
  if (!isPlainObject(v)) return `${path}: expected an object`;
  const { inTime, outTime } = v;
  if (!isFiniteNumber(inTime)) return `${path}.inTime: expected a finite number`;
  if (!isFiniteNumber(outTime)) return `${path}.outTime: expected a finite number`;
  return { inTime, outTime };
}

function validateKeyframe(v: unknown, path: string): Keyframe | string {
  if (!isPlainObject(v)) return `${path}: expected an object`;
  const { id, trackId, time, sourceRect, transitionToNext } = v;
  if (typeof id !== 'string' || id === '') return `${path}.id: expected a non-empty string`;
  if (typeof trackId !== 'string') return `${path}.trackId: expected a string`;
  if (!isFiniteNumber(time)) return `${path}.time: expected a finite number`;

  const rectResult = validateSourceRect(sourceRect, `${path}.sourceRect`);
  if (typeof rectResult === 'string') return rectResult;

  if (
    transitionToNext !== null &&
    transitionToNext !== 'smooth' &&
    transitionToNext !== 'cut'
  ) {
    return `${path}.transitionToNext: expected 'smooth', 'cut', or null`;
  }

  return { id, trackId, time, sourceRect: rectResult, transitionToNext };
}

function validateTrack(v: unknown, path: string): Track | string {
  if (!isPlainObject(v)) return `${path}: expected an object`;
  const { id, videoId, name, keyframes, range, isDirty } = v;
  if (typeof id !== 'string' || id === '') return `${path}.id: expected a non-empty string`;
  if (typeof videoId !== 'string') return `${path}.videoId: expected a string`;
  if (typeof name !== 'string') return `${path}.name: expected a string`;
  if (!Array.isArray(keyframes)) return `${path}.keyframes: expected an array`;

  const validatedKfs: Keyframe[] = [];
  for (let i = 0; i < keyframes.length; i++) {
    const kfResult = validateKeyframe(keyframes[i], `${path}.keyframes[${i}]`);
    if (typeof kfResult === 'string') return kfResult;
    validatedKfs.push(kfResult);
  }

  const rangeResult = validateClipRange(range, `${path}.range`);
  if (typeof rangeResult === 'string') return rangeResult;

  if (typeof isDirty !== 'boolean') return `${path}.isDirty: expected a boolean`;

  return {
    id,
    videoId,
    name,
    keyframes: validatedKfs,
    range: rangeResult,
    isDirty,
  };
}

/**
 * Parses and validates a Track file payload string.
 * On success returns the videoUrl and Track (un-mutated, as written in the file).
 * On failure returns a human-readable error message.
 */
export function parseTrackFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown parse error';
    return { ok: false, error: `Invalid JSON: ${msg}` };
  }

  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Invalid track file: top-level value must be an object' };
  }

  const { schemaVersion, videoUrl, track } = raw;

  if (schemaVersion !== TRACK_FILE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schemaVersion: expected ${TRACK_FILE_SCHEMA_VERSION}, got ${String(
        schemaVersion,
      )}`,
    };
  }

  if (typeof videoUrl !== 'string' || videoUrl === '') {
    return { ok: false, error: 'videoUrl: expected a non-empty string' };
  }

  const trackResult = validateTrack(track, 'track');
  if (typeof trackResult === 'string') {
    return { ok: false, error: trackResult };
  }

  return { ok: true, videoUrl, track: trackResult };
}

// ── Filename helpers ──────────────────────────────────────────────────────

/**
 * Strips path separators, control chars, and reserved filesystem chars.
 * Collapses runs of whitespace into single underscores. Trims to a sane
 * length so the resulting filename stays usable across operating systems.
 */
export function sanitizeFilenamePart(s: string): string {
  // Strip control characters (0x00-0x1F and 0x7F).
  // Replace path separators / reserved chars with empty string.
  // Collapse whitespace runs to a single underscore.
  // eslint-disable-next-line no-control-regex
  const stripped = s
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[\\/:*?"<>|]/g, '');
  const collapsed = stripped.replace(/\s+/g, '_');
  const trimmed = collapsed.replace(/^[._]+|[._]+$/g, '');
  const limited = trimmed.slice(0, TRACK_FILENAME_PART_MAX_LENGTH);
  return limited === '' ? 'untitled' : limited;
}

/**
 * Returns `<sanitized-videoName>_<sanitized-trackName>.json`.
 */
export function buildTrackFilename(videoName: string, trackName: string): string {
  const v = sanitizeFilenamePart(videoName);
  const t = sanitizeFilenamePart(trackName);
  return `${v}_${t}.json`;
}

/**
 * Triggers a browser download of the given JSON content under `filename`.
 * Creates a Blob, anchors a temporary `<a download>`, clicks it, then
 * revokes the object URL.
 */
export function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // Some browsers require the anchor to be in the DOM to honour the click.
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
