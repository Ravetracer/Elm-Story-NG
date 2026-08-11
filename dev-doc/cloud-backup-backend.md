# Cloud backup backend — a safety net, not a platform (plan)

**Status: planned, not started (as of 2026-08-11, v0.71.2).** This supersedes the
"Non-goal: a collaboration / cloud backend" section in `browser-build.md`, which
rejected *real-time collaboration* on sound grounds and then noted that the useful
residue — "a snapshot store with `If-Match`/409 optimistic concurrency, backup and
single-author continuation" — was worth keeping. That residue is exactly this
feature. Nothing here contradicts that rejection; it builds the half of it that was
always sound.

## Why

The browser build (`browser-build.md`) keeps a storyworld in an origin's
IndexedDB, which the browser evicts without warning — Safari after ~7 idle days,
Chromium under storage pressure. `storageDurability.ts` already defends against
this two ways (persistent-storage request, stale-backup nag), but both put the
burden on the author: persistence can be declined, and an export ZIP still has to
be downloaded and kept somewhere safe. An author who is sick or on vacation for
three weeks can lose a half-written novel to an eviction they never saw.

The safety net is a server that holds a copy the author does not have to manage.
Log in, and the storyworld is there when they come back — on a new machine, after
an eviction, whenever. **This is backup and continuity for a single author, not
teamwork.** Multi-user is a later section, deliberately kept on the table but not
in scope here.

## The shape in one paragraph

A small Symfony app (micro-kernel is fine) exposing a REST API over HTTPS. It
authenticates a user, stores one snapshot per storyworld per user as a **content
JSON blob plus content-addressed asset files on the local filesystem**, and hands
them back on request. Concurrency between an author's own devices is handled with
an ETag/`If-Match` optimistic check — a 409 means "the server copy is newer,
here it is." No WebSocket, no live editing, no server-side model of the storyworld
schema. The server treats a world as an opaque blob it version-stamps; the client
already knows how to read and write that blob.

## Why the client side is nearly free

The wire format already exists. `src/lib/worldZip.ts` is the portable bundle —
`storyworld.json` at the root plus `assets/<id>.<ext>` — and it is
environment-agnostic (`Uint8Array` in, `Uint8Array` out, no DOM/Node leak). The
browser build already:

- produces the world JSON with `getWorldDataJSON` (the exact string the JSON
  export writes),
- reads and writes assets as IndexedDB blobs with an md5 per asset
  (`electronBrowser.ts` already computes these for the PWA export),
- packs and unpacks the bundle with `buildWorldZip` / `parseWorldZip`.

So "upload to cloud" is "build the same thing export builds, PUT it" and "restore
from cloud" is "GET it, run it through the *unchanged* import pipeline"
(validate → upgrade chain → create studio → persist). The sync client is I/O
around parts that are already tested.

**Recommended granularity: split the JSON from the assets.** A naive whole-ZIP PUT
on every save re-uploads every MP3 and image each time, which is hostile on a phone
tether. Instead:

1. Client computes the world JSON (small, changes often) and a manifest of
   `{ id, ext, md5 }` for its assets (large, change rarely — the md5s already
   exist).
2. Client PUTs the JSON and the manifest. Server replies with the subset of asset
   ids whose md5 it does **not** already hold (content-addressed dedup).
3. Client uploads only those bytes.

v1 can ship the whole-ZIP PUT and add the manifest step later; the endpoint shape
below allows for it from the start. The manifest step is the difference between a
usable sync and one nobody leaves on.

## Server data model

Three concerns, no storyworld schema on the server:

- **User** — id, email, password hash (Symfony's `PasswordHasher`), created-at.
  Registration + login. Keep it boring.
- **World snapshot** — `(userId, worldId)` unique, holding: the world JSON blob,
  a monotonically increasing `version` integer (the ETag source), `updatedAt`,
  a title cached for the listing, and a soft-delete flag. `worldId` is the
  client's own world id (already a stable uuid), so the same world from two
  devices lands on one row.
- **Asset** — content-addressed: the file is stored at a path derived from its md5
  (e.g. `var/assets/<u2>/<md5>.<ext>`), and an `(userId, md5)` reference row keeps
  it. Assets are shared across a user's worlds by hash; a reference count (or a
  periodic sweep) trashes an md5 no snapshot's manifest names. **Filesystem, not a
  bucket** — that was the explicit constraint, and it is enough: these are small
  private files behind auth, not a CDN.

Metadata (users, snapshots, asset references) in a relational DB via Doctrine;
**blobs and asset bytes on the filesystem**, path stored in the row. Do not put
megabytes of MP3 in a DB column.

## API surface (REST, JSON, HTTPS)

Illustrative, not final:

- `POST /register`, `POST /login`, `POST /logout` — auth.
- `GET /worlds` — the user's snapshots: `{ worldId, title, version, updatedAt }[]`.
  Drives a "cloud worlds" list in the editor.
- `GET /worlds/{worldId}` — the world JSON blob + asset manifest. Sets an `ETag`
  from `version`.
- `PUT /worlds/{worldId}` — upload JSON + manifest. Carries `If-Match: <etag>`.
  - match → store, bump `version`, reply new ETag + the list of md5s the server
    still needs.
  - mismatch → **409**, body is the server's current snapshot so the client can
    show a "cloud copy is newer" choice (keep mine / take theirs). No silent
    overwrite.
  - no `If-Match` (first upload of this world) → create.
- `POST /worlds/{worldId}/assets/{md5}` — upload one asset's bytes; idempotent
  (already-present md5 is a 200 no-op).
- `GET /worlds/{worldId}/assets/{md5}` — fetch bytes on restore. (Or bundle all
  assets into a ZIP for a one-shot restore — reuse `worldZip` server-side is
  possible but a PHP ZIP build is simpler; decide at build time.)
- `DELETE /worlds/{worldId}` — soft-delete, so an accidental delete is recoverable.

## Auth and the cross-origin question

The editor is at `elm-story-ng-edit.ravetracer.de`; the API will be at its own host.
Two workable options:

- **Session cookie on a shared parent domain** (`.ravetracer.de`), `HttpOnly`,
  `Secure`, `SameSite=Lax` or `None`+`Secure`, with CORS `allow-credentials`.
  Simplest and safest if both live under `ravetracer.de`. Preferred.
- **JWT** (LexikJWTAuthenticationBundle) held in memory, sent as a bearer header.
  Works across any origins, but a token in JS is a slightly larger attack surface
  and needs a refresh story. Fall back to this only if the two cannot share a
  parent domain.

Either way: rate-limit login, hash with the platform default, and treat the
snapshot as private-by-default. Nothing here is public.

## Client integration seam

Keep it behind the same `IS_WEB_BUILD` flag storage durability uses — this is a
web-build feature; the desktop app has real persistent storage and does not need
it (though nothing stops a desktop sync later). New surface, roughly:

- a `src/lib/cloudSync.ts` (pure-ish: the manifest diff, the ETag handling, the
  409 reconciliation choice) with the fetch I/O thin around it, mirroring how
  `worldPWA` (pure) sits under `electronBrowser` (I/O);
- an auth state in `AppContext` (logged-in user, or none);
- UI: a login control in the title bar or dashboard, a "cloud" column/section in
  the dashboard listing server worlds, and a sync affordance next to the existing
  backup nag in `StorageBanner`/`ExportWorldMenu`. The stale-backup reminder
  becomes "your last cloud sync was N days ago" once signed in.

Sync trigger: **not on every keystroke.** Debounced background sync of the JSON
(assets only when their manifest changes), plus a manual "Sync now." The JSON is
small; the asset dedup keeps the rest cheap.

## Multi-user — kept on the table, explicitly out of scope here

The original authors were headed toward collaboration, and it is not being buried.
When it is revisited, two findings from the earlier analysis (`browser-build.md`)
still hold and should anchor the design:

- **Scene-level check-out is the natural lock.** A `Path` never crosses a scene
  boundary and only a `Jump` does, so two authors in two different scenes cannot
  collide on events, choices, inputs or paths. A per-scene lease is the obvious
  unit.
- **But characters, variables and assets are world-scoped**, which a scene lock
  does not protect — and a variable rename silently breaks every template
  expression written against the old title (expressions resolve by title, not id,
  and nothing reports the break; the prose renders an ERROR span). World-scoped
  edits need a coarser guard (a world-level lock, or serialised through the
  server) that scene leases cannot give.

And the hard constraint that killed *real-time* collaboration remains true:
**shared PHP hosting cannot hold a WebSocket** (mod_php dies per request), so live
co-editing needs either a long-running process (Symfony Messenger + Mercure, a
persistent worker) or a different host entirely. The snapshot store planned here is
a **prerequisite** for any of that — you cannot share what you cannot first store —
so building it does not foreclose collaboration; it is step one of it. The
realistic collaboration MVP on top of this backend is **turn-based, not live**:
check out a scene (or the world), edit, check in, with the 409 machinery already
built here doing the conflict rejection. That is buildable on shared hosting;
real-time is the thing that is not, and it is the only thing being deferred.

## Ops reality — the part that is not code

This adds a second deployable with obligations the local-first app never had:

- **It holds users' personal data and creative work.** Real emails, saved stories,
  EU authors → GDPR: a privacy note, a data-export (the snapshot *is* the export),
  and account+data deletion that actually removes the files.
- **Backups of the backup.** A safety net that is not itself backed up is a single
  point of failure dressed as reliability. Filesystem snapshots / off-box copy of
  `var/assets` and the DB.
- **Quotas.** Per-user storage cap, or the disk is a public sink. Assets dominate;
  the content-addressed dedup helps but does not replace a cap.
- **Auth hardening** — rate limiting, no user enumeration on register/login,
  password reset if it is more than the maintainer's own account.

Worth it once people actually ask for it. Premature if they do not — the existing
export ZIP is still a real backup for the disciplined author, and this feature's
whole value is removing the discipline requirement.

## First slice, if/when this starts

1. Symfony skeleton, User entity, register/login, session auth, CORS for the editor
   origin. Prove a logged-in `GET /worlds` returns `[]`.
2. `PUT`/`GET /worlds/{worldId}` for the JSON blob only (no assets yet), with
   ETag/`If-Match` and the 409 body. Prove one browser can push a world and a
   second, freshly-evicted browser can pull it back — JSON only, images broken.
3. Asset manifest + content-addressed upload/download; images/audio survive the
   round trip.
4. `cloudSync.ts` + `AppContext` auth + dashboard "cloud worlds" + the sync UI,
   folding into the existing `StorageBanner` backup messaging.
5. Ops: quotas, deletion, backups, privacy note.

Stop after 2 to validate the whole idea cheaply — a JSON-only round trip already
proves the safety net works end to end.
