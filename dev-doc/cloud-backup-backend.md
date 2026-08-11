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

## Milestones

Phased so each one is shippable and provable on its own, and so the cheapest
possible slice validates the whole idea before the expensive parts are built. The
server side (M0–M3) is a separate repository/deployable; the client side (M4)
lands in this repo behind `IS_WEB_BUILD`. **M2 is the go/no-go gate** — a JSON-only
round trip already proves the safety net end to end, so stop and evaluate there
before committing to assets and UI. Each phase names its own exit criterion; do not
advance until it is met.

### M0 — Backend skeleton + auth
- **Goal:** a deployed Symfony app that knows who a user is.
- **Deliverables:** Symfony skeleton, `User` entity + Doctrine migration,
  `POST /register` / `POST /login` / `POST /logout`, session auth (cookie on the
  shared parent domain), CORS configured for the editor origin, login rate limit.
- **Exit:** a logged-in `GET /worlds` returns `[]` with 200; an anonymous call
  returns 401; CORS preflight from the editor origin passes.

### M1 — World JSON store
- **Goal:** the server holds and returns a world's structure blob. No assets yet.
- **Deliverables:** `WorldSnapshot` entity `(userId, worldId)` unique, blob on the
  filesystem with the path in the row, `version` integer; `PUT /worlds/{worldId}`
  (create + update) and `GET /worlds/{worldId}` with an `ETag` from `version`;
  `GET /worlds` listing; `DELETE /worlds/{worldId}` soft-delete.
- **Exit:** curl can PUT a world JSON, GET it back byte-identical, and see it in the
  listing with a version and title.

### M2 — Optimistic concurrency (GO/NO-GO GATE)
- **Goal:** two of one author's devices cannot silently clobber each other.
- **Deliverables:** `If-Match` on `PUT`; match → bump `version`, new `ETag`;
  mismatch → **409** with the current server snapshot in the body; missing
  `If-Match` on an existing world → 428 (not a blind overwrite).
- **Exit:** scripted proof — device A pushes v1, device B (stale) pushes and gets
  409 + A's copy; a browser that has had its IndexedDB wiped pulls the world back
  intact (JSON only — images will be broken until M3). **Evaluate here before
  building further.**

### M3 — Content-addressed assets
- **Goal:** images and audio survive the round trip, cheaply.
- **Deliverables:** `Asset` reference model `(userId, md5)`, bytes at
  `var/assets/<u2>/<md5>.<ext>`; manifest exchange on `PUT` (server replies with the
  md5s it lacks); `POST`/`GET /worlds/{worldId}/assets/{md5}` (upload idempotent);
  reference counting or a sweep to trash an md5 no snapshot names.
- **Exit:** a world with masks, event images and audio round-trips through the
  server with media intact; re-uploading an unchanged world transfers zero asset
  bytes (dedup proven).

### M4 — Client integration
- **Goal:** an author uses it without touching curl.
- **Deliverables:** `src/lib/cloudSync.ts` (pure core: manifest diff, ETag/409
  reconciliation) with thin fetch I/O; auth state in `AppContext`; a login control;
  a "cloud worlds" section in the dashboard; debounced background sync + a manual
  "Sync now"; the `StorageBanner`/`ExportWorldMenu` backup nag reworded to "last
  cloud sync N days ago" when signed in. All behind `IS_WEB_BUILD`. Unit tests on
  the pure core, live verification of the sync UI (maintainer's check).
- **Exit:** log in, edit a world, watch it sync; wipe IndexedDB, reload, log in,
  and the world restores — assets and all — with no manual export/import.

### M5 — Production hardening
- **Goal:** safe to hand to real people.
- **Deliverables:** per-user storage quota; account + data deletion that actually
  removes the files; off-box backups of `var/assets` and the DB; privacy note and a
  data-export path (the snapshot *is* the export); no user enumeration on
  register/login; password reset if it serves more than the maintainer.
- **Exit:** a deletion request leaves nothing on disk; a restored backup brings a
  user's worlds back; quota rejection is graceful, not a 500.

### Later — collaboration (separate track, not scheduled)
Built **on top of** M0–M5, not instead of them. Turn-based first: scene/world
check-out leases, check-in through the M2 409 machinery. Real-time co-editing needs
a long-running process (Messenger + Mercure or a persistent worker) and is the one
piece shared PHP hosting cannot serve — see the multi-user section above. No
milestone numbers until it is actually on the roadmap.
