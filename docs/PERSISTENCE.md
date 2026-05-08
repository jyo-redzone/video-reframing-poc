# Track Persistence

Design notes for persisting Track JSON between editing sessions. Scope: a temporary tool used by real customers — durable enough to not lose hours of work, simple enough to ship without inventing new infrastructure.

## Recommendation

Server-side persistence over a small REST surface, with debounced + event-triggered autosave on the client and gzip on the wire.

### API surface

```
PUT  /tracks/:id              save (or overwrite) a single Track
GET  /tracks/:id              load one Track
GET  /tracks?videoId=…        list Tracks for a video
DELETE /tracks/:id            delete a Track
```

- Payload is the existing `Track` TypeScript type, serialized as JSON, plus a top-level `schemaVersion: number` for forward compatibility.
- Storage is a JSON blob keyed by `(customerId, videoId, trackId)`. No relational schema — the Track shape evolves freely.
- Last write wins. No version history, no conflict resolution, no soft-delete.
- One Track per request. Editing one Track does not re-upload siblings on the same video.

### Client autosave behavior

- **Debounced idle save** — 5–10 s after the last edit to the active Track.
- **Event-triggered saves** — flush immediately on:
  - stop recording
  - switch to a different Track
  - close tab / navigate away (`navigator.sendBeacon` from a `beforeunload` handler)
- **In-flight coalescing** — if a save is already in flight, queue the latest snapshot and drop intermediate ones. Never stack requests.
- **UI affordance** — a "saved" / "saving…" / "save failed" indicator near the Track selector. On failure, retry with backoff and surface the error after N attempts.
- **Dirty tracking** — already modeled as `track.isDirty`. Clear on successful save.

### Wire size

Realistic payload sizes for one Track:

| Scenario | Keyframes | Raw JSON | Gzipped |
|---|---|---|---|
| Manual editing only | ~10–100 | 5–25 KB | <5 KB |
| 5-min recording session | ~1,200 | ~250 KB | ~25 KB |
| Full 2hr recording (worst case) | ~28,800 | ~6 MB | **~600 KB** |

Gzip is a single config flag at the reverse proxy / CDN. The repetitive structure of Keyframe arrays compresses ~10×, so even the pathological case is a sub-MB upload, sent once when the user stops recording.

## Alternatives considered

**IndexedDB only** — Zero infrastructure, but customers lose work to cleared browser caches, device switches, or corrupted tabs. Acceptable for a personal demo, not for paying users mid-edit on a 2hr asset.

**JSON file download / upload** — Forces the customer to manage filenames, versions, and "did I remember to save?" anxiety on every session. Lost-work risk is high.

**Hybrid (IndexedDB autosave + server save on commit)** — The "right" pattern for offline tolerance, but doubles the storage surface: two paths to keep in sync, conflict cases when the same user edits across two tabs, IndexedDB schema migrations on top of server schema migrations. Not worth the complexity for a temporary tool — if the server is up, the customer can edit; if it's down, they wait.

**File System Access API** — No Safari support, and customers don't want to babysit a file handle.

**JSON Patch / per-keyframe deltas** — Adds substantial complexity and conflict cases for a problem that gzip + idle triggers already solve. Skip.

**Per-keyframe append endpoints** — Turns one durable save into hundreds of fragile writes the server has to reassemble. Skip.

## Open question

**Auth model.** The endpoints need to identify the customer. Options depend on what already exists around the rendering pipeline — session cookies, a customer token in the URL, an OIDC bearer, etc. To be answered before implementing the client save layer, since it shapes whether we attach to an existing service or stand up a small new one.
