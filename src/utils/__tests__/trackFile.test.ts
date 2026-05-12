import { describe, it, expect } from 'vitest';
import {
  serializeTrack,
  parseTrackFile,
  type TrackFileVideoMetadata,
} from '../trackFile';
import { TRACK_FILE_SCHEMA_VERSION } from '../../config';
import type { Track } from '../../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VIDEO_URL = 'https://example.com/master.m3u8';

const metadata: TrackFileVideoMetadata = {
  width: 1920,
  height: 1080,
  fps: 29.97,
};

const track: Track = {
  id: 'track-1',
  videoId: 'video-1',
  name: 'Clip A',
  keyframes: [
    {
      id: 'kf-0',
      trackId: 'track-1',
      time: 0,
      sourceRect: { x: 0, y: 0, width: 1280, height: 720 },
      transitionToNext: 'smooth',
    },
    {
      id: 'kf-1',
      trackId: 'track-1',
      time: 2,
      sourceRect: { x: 100, y: 200, width: 1280, height: 720 },
      transitionToNext: null,
    },
  ],
  range: { inTime: 0, outTime: 2 },
  isDirty: false,
};

// ---------------------------------------------------------------------------
// serializeTrack
// ---------------------------------------------------------------------------

describe('serializeTrack', () => {
  it('includes schemaVersion, videoUrl, videoMetadata, and track at the top level', () => {
    const json = serializeTrack(track, VIDEO_URL, metadata);
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe(TRACK_FILE_SCHEMA_VERSION);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.videoUrl).toBe(VIDEO_URL);
    expect(parsed.videoMetadata).toEqual({ width: 1920, height: 1080, fps: 29.97 });
    expect(parsed.track).toEqual(track);
  });

  it('persists only width, height, fps in videoMetadata (no extra keys)', () => {
    // Cast through unknown to simulate accidental extra fields slipping in
    // through TypeScript holes — serializeTrack must still emit exactly the
    // three documented keys.
    const overstuffed = {
      width: 1920,
      height: 1080,
      fps: 29.97,
      id: 'should-not-appear',
      name: 'should-not-appear',
      duration: 12345,
      url: 'should-not-appear',
    } as unknown as TrackFileVideoMetadata;

    const json = serializeTrack(track, VIDEO_URL, overstuffed);
    const parsed = JSON.parse(json);

    expect(Object.keys(parsed.videoMetadata).sort()).toEqual(['fps', 'height', 'width']);
  });

  it('round-trips through parseTrackFile', () => {
    const json = serializeTrack(track, VIDEO_URL, metadata);
    const result = parseTrackFile(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.videoUrl).toBe(VIDEO_URL);
    expect(result.videoMetadata).toEqual(metadata);
    expect(result.track).toEqual(track);
  });
});

// ---------------------------------------------------------------------------
// parseTrackFile — validation failures
// ---------------------------------------------------------------------------

describe('parseTrackFile', () => {
  function payloadWithoutMetadata(): Record<string, unknown> {
    return {
      schemaVersion: TRACK_FILE_SCHEMA_VERSION,
      videoUrl: VIDEO_URL,
      track,
    };
  }

  function payloadWith(videoMetadata: unknown): Record<string, unknown> {
    return {
      schemaVersion: TRACK_FILE_SCHEMA_VERSION,
      videoUrl: VIDEO_URL,
      videoMetadata,
      track,
    };
  }

  it('rejects payloads missing videoMetadata entirely', () => {
    const result = parseTrackFile(JSON.stringify(payloadWithoutMetadata()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata/);
  });

  it('rejects videoMetadata that is not an object', () => {
    const result = parseTrackFile(JSON.stringify(payloadWith('nope')));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata: expected an object/);
  });

  it('rejects videoMetadata with missing width', () => {
    const result = parseTrackFile(
      JSON.stringify(payloadWith({ height: 1080, fps: 29.97 })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata\.width: expected a positive finite number/);
  });

  it('rejects videoMetadata with missing height', () => {
    const result = parseTrackFile(
      JSON.stringify(payloadWith({ width: 1920, fps: 29.97 })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata\.height: expected a positive finite number/);
  });

  it('rejects videoMetadata with missing fps', () => {
    const result = parseTrackFile(
      JSON.stringify(payloadWith({ width: 1920, height: 1080 })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata\.fps: expected a positive finite number/);
  });

  it('rejects non-finite width (Infinity serializes to null in JSON, still invalid)', () => {
    // JSON.stringify converts Infinity/NaN to null, which then fails the
    // isFiniteNumber check on parse.
    const result = parseTrackFile(
      JSON.stringify(payloadWith({ width: Infinity, height: 1080, fps: 29.97 })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata\.width: expected a positive finite number/);
  });

  it('rejects non-finite fps when injected as a raw token', () => {
    // Bypass JSON.stringify's Infinity → null coercion by hand-crafting the
    // text so the parser sees a non-finite value directly.
    const text = `{
      "schemaVersion": ${TRACK_FILE_SCHEMA_VERSION},
      "videoUrl": "${VIDEO_URL}",
      "videoMetadata": { "width": 1920, "height": 1080, "fps": null },
      "track": ${JSON.stringify(track)}
    }`;
    const result = parseTrackFile(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata\.fps: expected a positive finite number/);
  });

  it('rejects negative width', () => {
    const result = parseTrackFile(
      JSON.stringify(payloadWith({ width: -1920, height: 1080, fps: 29.97 })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata\.width: expected a positive finite number/);
  });

  it('rejects zero height (must be strictly positive)', () => {
    const result = parseTrackFile(
      JSON.stringify(payloadWith({ width: 1920, height: 0, fps: 29.97 })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata\.height: expected a positive finite number/);
  });

  it('rejects negative fps', () => {
    const result = parseTrackFile(
      JSON.stringify(payloadWith({ width: 1920, height: 1080, fps: -29.97 })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/videoMetadata\.fps: expected a positive finite number/);
  });

  it('rejects schemaVersion: 1 (old v1 files are not supported)', () => {
    const text = JSON.stringify({
      schemaVersion: 1,
      videoUrl: VIDEO_URL,
      track,
    });
    const result = parseTrackFile(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Unsupported schemaVersion/);
  });
});
