# Rejected: a standalone in-editor preview window

**Not built, and not planned.** The idea was a full-window "play this world"
window opened from the editor, so an author could see presentation choices
(alignment, theme, and later skins) without exporting a PWA. It was dropped once
implementation showed it cannot be done safely in this app. The decision:
**presentation is verified by exporting the world and viewing the export.**

This note exists so the unsafe version is not reattempted. Both hazards come from
the preview window sharing the editor's origin — its IndexedDB **and** its
`userData`:

1. **A player-mode window destroys live data.** `Runtime`'s `!isComposer` branch
   installs baked data through `Installer` → `getLibraryDatabase(studioId)` →
   `saveEngineCollectionData` (+ `removeWorldData` on a version match). That
   database is `esg-library-<studioId>` — the editor's own — so a preview install
   would delete and rewrite the author's live world on every open.
2. **Assets are scoped by studio *and* world**
   (`userData/assets/<studioId>/<worldId>/<id>.<ext>`, `src/main.ts`), and the
   player builds `esg-asset://` URLs from those ids. So the install cannot be
   isolated to a throwaway id to dodge hazard 1 — that breaks every image and
   sound. Real ids → destructive; fake ids → no assets. No safe form.

A non-destructive live-read preview *mode* (read like the composer, render like
the player, behind an additive flag) would be safe but is engine-core surgery on
the render path, judged not worth it against "just export and view." If it is
ever revisited, that is the only safe shape — never a baked-snapshot install.
