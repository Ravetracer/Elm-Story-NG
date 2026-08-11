# Design plan: themes, skins, and the reading-lane layout

> **Status: plan, not shipped.** No code follows from this file yet. It is the
> settled design for a five-phase presentation feature and the reasoning behind
> each decision, written in the same spirit as `DESIGN.md`: the "why is this not
> X" a reader will ask, including the alternatives that were rejected.
>
> `CLAUDE.md` is the authority on how the engine's presentation already works
> (the *Presentation* section, the *object rail*, the *storyworld map* colour
> notes). This file only adds what is new and states where it touches those
> mechanisms.

## What was asked for

A storyworld should be able to *look like a game*, not only read like a book:

1. a **skin** — ornate framed panels, decorated buttons, framed inventory slots,
   the kind of thing the asset kits under `!dev/GUI` provide (Wenrexa-style
   9-slice art);
2. the reading stream **off-centre and configurable** left/centre/right, so
   there is room for chrome beside it on a wide screen;
3. an **inventory that reads as an inventory** — a 6–8 wide grid of framed
   slots with a decorative border, not a narrow icon strip;
4. a **theme selector of curated, bundled themes**. The author picks one; the
   author does *not* build custom themes, and — decided with the maintainer —
   the author's choice **locks** the theme: a player cannot change it.

These are four features with very different costs, not one. They are staged
cheapest-and-lowest-risk first, so the expensive art work is de-risked by the
cheap layout work that precedes it.

## What the engine already gives us

Verified against the running layout, because the plan leans on all of it:

- **`#renderer`** (`Renderer.tsx`) stacks three things: `#world-background`
  (the author's background image, first in paint order), `#live-event-stream`
  (the reading column), and `#object-panel` (the inventory rail), the last two
  laid out in `engine/assets/engine.less`.
- **The stream is centred by auto margins and yields the right edge to the
  rail.** `#live-event-stream` is `position: absolute; left: 0; right:
  var(--object-panel-width); margin: 0 auto`. `#object-panel` is `position:
  absolute; right: 0; width: var(--object-panel-width)`.
- **`--object-panel-width`** defaults to `0rem` on `#runtime` and is set to
  `OBJECT_RAIL_WIDTH` (`'12rem'`, `ObjectPanel.tsx:146`) while the rail is
  mounted. This is the one number the stream and the rail agree on, and it is
  why a storyworld with no objects lays out exactly as it did before 0.8.0.
- **Theme is a player setting today.** `ENGINE_THEME` is `BOOK | CONSOLE`
  (`engine/src/types/index.ts:408`); `Presentation.tsx:75` writes
  `document.documentElement`'s `data-theme` from `settings.theme`; the palette
  lives in `html[data-theme='BOOK'|'CONSOLE']` blocks in
  `engine/assets/variables.less`, mirrored token-for-token in
  `engine-editor.less` (the composer-preview set — the hard rule from the
  *object rail* section: a token added to one must be added to the other).
- **`World.themeColors`** already layers author colour overrides on `#runtime`
  via `engine/src/lib/themeColors.ts` (`ThemeColors.tsx`), *on top of* the
  chosen `data-theme`. This is the precedent the new fields follow, and it must
  keep working: a skin sets the palette, `themeColors` still overrides
  individual tokens on top of it.

None of the four features fights this. The rail already lives on the right; the
stream already reads `--object-panel-width`; theme is already a `data-theme`
swap. The work is extending these, not replacing them.

## What each field costs

The three-tier model from `DESIGN.md` still holds. Every field this plan adds is
**tier one or two** — an optional unindexed property on the existing `worlds`
table — so **no Dexie migration in either project**, exactly like `themeColors`,
`transition` and `choicePresentation` before it.

| field | tier | reaches engine via |
| --- | --- | --- |
| `World.theme` | 2 (engine reads it) | `format.ts` pick list **and** `Installer`'s `WORLD_INFO_FIELDS` |
| `World.streamAlignment` | 2 | same two places |
| `World.skin` (phase 4) | 2 | same two places |

**The tier-two trap is named twice on purpose.** `compiler/format.ts` `pick`s an
explicit property list per collection, and `Installer`'s `WORLD_INFO_FIELDS` is a
*second* independent pick built from `worldInfo`. A field declared correctly in
both `src/data/types.ts` and `engine/src/types/index.ts` still never reaches a
component until it is named in **both** lists — this is the exact failure the
*interface text* and *choicePresentation* sections in `CLAUDE.md` warn about
(`choicePresentation` "appeared to do nothing" until it was added to
`WORLD_INFO_FIELDS`). Every new field below pays this cost.

The transport cost is the other half: each field must be added to
`getWorldDataJSON` (export), `importWorldData` (import) and
`transport/schema/0.8.0.json`, whose `_` block is `additionalProperties: false`
— the one that fails loudly, by making the app refuse to import its own export.
`validateWorldData.test.ts` holds this.

---

## Phase 1 — the configurable reading lane

> **Shipped (0.60.0).** `World.streamAlignment` (`STREAM_ALIGNMENT` =
> `LEFT | CENTER | RIGHT`, unset = CENTER). Two things about the real layout that
> the plan below got slightly wrong and the implementation corrected:
>
> - **The reading measure is not on the stream.** It is `--runtime-width: 68rem`
>   applied to the whole `#runtime`, which `base.less` centres in the window on a
>   wide screen (`left: 50%; transform`). The `margin: 0 auto` on
>   `#live-event-stream` is effectively a no-op — the stream fills `#runtime`. So
>   alignment is implemented by **repositioning the centred `#runtime`**, not the
>   stream: `StreamAlignment.tsx` stamps `data-stream-alignment` on `#runtime`
>   (mirroring `ThemeColors`, mounted in both `Runtime` branches, off the editor
>   root), and two `base.less` rules override `left`/`transform` for LEFT and
>   RIGHT. CENTER is the unset default the existing blocks already produce.
> - **It manifests in the exported/full-window player, not the composer preview.**
>   `base.less` is loaded only by the standalone engine (`engine/index.html`);
>   the composer preview uses `engine-editor.less`, which does not centre
>   `#runtime` at a fixed measure — so there is no slack to shift and alignment is
>   a no-op there, honestly reflected in the panel hint. Verify it in an export or
>   the full-window browser build, not the dock-panel preview. Making it visible
>   in the preview means giving that preview a centred measure, which is phase-3
>   work (room beside the stream), not phase 1.
>
> Resolver `resolveStreamAlignment` in `engine/src/lib/streamAlignment.ts`, held
> by `src/__tests__/streamAlignment.test.ts`. UI: `StreamAlignmentSelect` in the
> storyworld's **Layout** panel. All seams below were wired as described.

**The cheapest change and the highest impact.** Turn the auto-centred stream
into a lane that can sit left, centre or right, leaving room beside it.

- **Field:** `World.streamAlignment: STREAM_ALIGNMENT` (`LEFT | CENTER | RIGHT`),
  optional, `CENTER` as the unset default — a storyworld written before the
  field lays out exactly as it does now.
- **Layout:** replace the `margin: 0 auto` centring on `#live-event-stream`
  with an alignment that respects the reading measure. The stream keeps its
  `max-width` (the reading measure is a legibility constraint, not a layout
  one); alignment decides which side the *slack* falls on. `CENTER` is today's
  behaviour; `LEFT`/`RIGHT` push the column to one edge and open a gutter on the
  other.
- **The rail and the gutter must not collide.** The rail is pinned `right: 0`
  and the stream yields `--object-panel-width` on the right. Under `RIGHT`
  alignment the stream would sit against the rail with the gutter on the left;
  under `LEFT` the gutter is on the right, *outside* the rail. The rule: the
  opened gutter is the space the phase-3 inventory and phase-4 chrome fill, so
  its side is chosen relative to the rail, not independently. Left the simple
  way (a `justify-self` on a grid track) this is a few lines; the interaction
  with the rail is the part to get right, and it is why the inventory re-layout
  (phase 3) is sequenced after this rather than before.
- **The 68rem cap on wide screens.** `dev-doc`/`CLAUDE.md` note the stream caps
  at ~68rem. Alignment is only visible when the viewport is wider than the
  column, so on a laptop it does nothing. Decide whether the cap rises with
  alignment or stays; recommendation is to keep the reading measure fixed and
  let alignment + chrome consume the extra width, because a 100rem line of prose
  is unreadable — the width is for chrome, not for longer lines.
- **Schema:** tier two, no migration. `format.ts` + `WORLD_INFO_FIELDS` +
  transport, per the table above.
- **UI:** a `StreamAlignmentSelect` in the storyworld's properties, beside the
  existing `TransitionSelect` — world-only, no per-event override, because
  alignment is the feel of the storyworld, the same argument `transition` made.
- **Test:** a pure resolver (`resolveStreamAlignment`) with the unset-default
  case, mirroring `transition.test.ts` / `choicePresentation.test.ts`.

**Rejected:** a per-event alignment. Alignment that changes page to page reads
as a layout bug, not a design; and it would fight the transition animation,
which slides the whole column.

---

## Phase 2 — the bundled theme selector, author-locked

> **Shipped (0.61.0).** `World.theme` (`ENGINE_THEME` = `BOOK | CONSOLE`, unset =
> the player chooses). Wired through the same seams as `streamAlignment`
> (`ENGINE_THEME` added to `src/data/types.ts`; the field on the World in both
> projects, `EngineContext.worldInfo`, `format.ts`, `WORLD_INFO_FIELDS`,
> export/import, schema — tier-two, no migration). `resolveTheme` /
> `isThemeLocked` in `engine/src/lib/theme.ts`, held by
> `src/__tests__/theme.test.ts`.
>
> - **Precedence is one rule in one place.** `Presentation` sets `data-theme` from
>   `resolveTheme(world.theme, settings.theme)` — the author's lock wins,
>   otherwise the player's choice — and `Settings` hides its theme toggle when
>   `worldInfo.theme` is set, so the stored player preference can never fight the
>   lock.
> - **The editor-root leak I worried about in the plan does not bite.** The plan
>   feared applying `data-theme` on the composer's `documentElement` would
>   re-theme the editor, and prescribed applying it on `#runtime` in the preview.
>   In fact `Presentation` is export-only, so the only place this code sets
>   `data-theme` is the exported/full-window player, where `documentElement` *is*
>   the engine's own root. The composer preview never has it set — and its palette
>   is pinned by `engine-editor.less`'s `#runtime` block regardless — so, like
>   alignment, **the lock is visible in the export, not the dock preview.**
> - **UI:** `ThemeSelect` in the storyworld's **Theme** panel (above Colors),
>   offering "Let the player choose" (unset) / Dark / Light. The colour overrides
>   still layer on top of whichever theme resolves.
> - **Only two themes ship for now** (the existing BOOK/CONSOLE). The mechanism is
>   the feature; adding more curated palettes is the additive CSS below, and is
>   the natural next increment — a colour-taste decision for the maintainer.

**Curated themes the author picks from; no custom theming; the choice locks.**

- **Field:** `World.theme: ENGINE_THEME`, optional. Unset means "the player's
  choice still applies" — i.e. today's behaviour — so old worlds are unchanged.
  Set means **the theme is locked to the author's pick and the player's Settings
  theme control is suppressed**.
- **Precedence, stated once:** author-set `World.theme` wins over
  `settings.theme`. `themeColors` still layers on top of whichever palette wins
  — the skin/theme sets the base, the colour overrides refine it. This is the
  one ordering rule and it must be written where `data-theme` is applied.
- **Where the lock is enforced:** `Presentation.tsx:75` currently writes
  `data-theme` from `settings.theme`. It changes to
  `world.theme ?? settings.theme`. **In the composer preview the attribute must
  not reach the editor's own `documentElement`** — the same reason
  `themeColors` is applied on `#runtime` and not on the document root
  (`themeColors.ts` note). Applying an author-locked `data-theme` to the
  document root in the composer would re-theme the *editor*. The preview path
  must set it on `#runtime`; the export path may keep the document root. This is
  the one real subtlety in the phase and it is invisible until someone opens the
  preview with a locked non-default theme.
- **Suppressing the player control:** when `world.theme` is set, the theme
  toggle in `Settings.tsx` is hidden (not disabled — a control that cannot
  change anything is worse than an absent one, the `choicePresentation`
  argument). Font, motion, size and mute stay: those are accessibility and
  comfort, not the storyworld's designed look, so they are never locked.
- **Adding themes is additive CSS.** Each new theme is a new
  `html[data-theme='NAME']` block in `variables.less` **and** a mirrored block
  in `engine-editor.less`, plus a member on `ENGINE_THEME`. N themes = 2× the
  token maintenance, forever — this is the standing cost of the feature and the
  reason the set is *curated and small*, not open.
- **UI:** a `ThemeSelect` in the storyworld's properties (author picks the
  locked theme, or "Let the player choose" for unset). This is where the
  "no custom themes" decision lives: the control offers a fixed list, never a
  colour picker. `themeColors` remains the author's fine-grained override and is
  unchanged.
- **Schema:** tier two, no migration.

**Rejected:** letting the author build a theme from scratch. Stated by the
maintainer as out of scope — too much surface, and `themeColors` already covers
the "I want my own colours" case by layering over a curated base. The bundled
set plus per-token overrides is the whole theming story.

**Rejected:** keeping theme player-only and just growing the list. This was
offered and declined: the storyworld's look should be *authored*, which a
player-only setting cannot express.

---

## Phase 3 — the inventory as a framed grid

> **Shipped (0.62.0).** The object rail is now a framed grid, and the crucial
> decision was the *width model*, not the grid itself:
>
> - **`#runtime` grows by the inventory's width instead of the rail eating into
>   the reading column.** Before, `#runtime` was a fixed `--runtime-width` and the
>   rail took `--object-panel-width` out of it (a 68rem runtime gave the prose
>   56rem beside a 12rem rail). Now `#runtime` is
>   `calc(var(--runtime-width) + var(--object-panel-width))` (`base.less`), so the
>   reading column keeps its full measure and the inventory sits in its own lane —
>   which is the "story in its own lane, inventory beside it" the maintainer
>   asked for, and what makes phase 1's alignment meaningful (there is now a lane
>   to push). `max-width: 100%` caps it so a wide inventory on a narrow window
>   shrinks rather than overflows. A world with no objects has
>   `--object-panel-width: 0`, so it is byte-for-byte unchanged.
> - **The width is derived from a column count, not hardcoded.**
>   `--object-panel-columns` (default 4) drives both the grid
>   (`grid-template-columns: repeat(var(--object-panel-columns), 4.4rem)`) and the
>   panel width (a `calc` from it), so widening the inventory toward the 6–8 the
>   maintainer wanted is a one-value change with no arithmetic to keep in step. 4
>   is a sane default; a big-screen world can go wider.
> - **`ObjectPanel` sets `--object-panel-active: 1` while mounted** (was: wrote a
>   hardcoded `12rem`), and the stylesheet's `calc` collapses to `0` when it is
>   absent — the same "unchanged without objects" guarantee, with the derivation
>   living in one place.
> - **`#object-panel` is now `box-sizing: border-box`**, so its padding and left
>   border are inside `--object-panel-width` — the value the stream reserves —
>   rather than the ~1.7rem overlap the old content-box rail hid under its opaque
>   background.
> - **The frame is flat tokens** (border, radius, faint fill on
>   `.object-panel-tiles`); skin art dresses it in phase 4. Visible in the
>   composer preview *and* the export; only the runtime-grows part is export-only
>   (`base.less`), so in the dock preview the wider grid still eats into the
>   narrow pane — expected, verify roominess in an export.
> - **No model change**, as planned — quantity stays derived; the grid is pure
>   presentation, overflow scrolls.

**Re-lay the object rail from a vertical icon strip into a 6–8 wide grid of
framed slots with a decorative border.** No data change — objects already exist;
this is presentation only.

- **No model change.** The object model has *no slot count and no grid*
  (`CLAUDE.md`, *the 0.8.0 shape*: quantity is derived, never stored as a
  census). A fixed 6–8 column grid is therefore pure presentation. Overflow is a
  presentation decision too — recommendation is scroll within the panel, since
  the groups already scroll (`#object-panel` keeps `overflow: visible` for the
  tooltip and scrolls the groups inside).
- **The width number stays the single source of truth.** The grid replaces
  `OBJECT_RAIL_WIDTH` with a wider value (6–8 columns of slot art), still set on
  `--object-panel-width` on `#runtime`, so the stream and the panel cannot
  disagree about the room given up. Widening it is the whole coupling; nothing
  else reads the rail's size.
- **This is why phase 1 comes first.** A wide inventory panel needs the stream
  off-centre to have somewhere to be. Under `CENTER` a 6–8 wide panel squeezes
  the reading column; under `LEFT`/`RIGHT` it fills the opened gutter. The two
  features are one layout, staged.
- **Slot frames are skin art (phase 4), but the grid is not.** The grid re-lay
  is drawable with the current flat tokens (borders, `--renderer-border-color`),
  so phase 3 ships a *functional* wide inventory before any art exists, and
  phase 4 dresses it. Keep them separable.
- **Watch the reference-image guard.** `useImageLoader` listens on `window` and
  every image hears every reply; `isAssetReplyFor` checks both `eventId` and
  `assetId` (`CLAUDE.md`, *the 0.8.0 shape*). A grid renders many object images
  at once — more than the current strip — so this guard is load-bearing here and
  must not be weakened.

**Rejected:** a stored slot layout / drag-to-arrange inventory. That is a real
model change (positions per object) and a game mechanic, not presentation. The
derived-quantity model is deliberate; a census-with-positions would fight it.

---

## Phase 4 — the skin (ornate art), last and most expensive

> **Update (0.78.0): reduced to one skin, on/off.** SCIFI was removed — it shipped
> no paperdoll body art (it kept the generic silhouette inside a frame) and doubled
> the packed art for little gain. `ENGINE_SKIN` now has the single member MEDIEVAL,
> so `World.skin` is effectively an on/off toggle and `SkinSelect` is a `Switch`
> (on → MEDIEVAL, off → `undefined`); the enum is kept rather than a boolean so a
> second skin can return without a schema change. Removed: the `scifi/` art folder,
> its `[data-skin='SCIFI']` block in `skins.less`, its `SkinSelect` option, its
> schema enum value (`["MEDIEVAL"]`) and its `CREDITS.md` row. A stale `skin:
> "SCIFI"` on a local world reads as off and clears on first toggle; an imported
> file carrying it now fails schema validation, which is acceptable at this stage.
> Everything value-agnostic (export prune, `Installer` pick, `Presentation`) needed
> no change. The first-cut record below is left as written.

> **Shipped (0.66.0–0.69.0), first cut.** Two bundled skins — **MEDIEVAL** (Wenrexa
> GUI Game #6) and **SCIFI** (GUI Game #16), both **CC BY-SA 4.0**, attributed in
> `CREDITS.md` and `engine/public/skins/CREDITS.md`; the licence was confirmed off
> the store page (no `NC`/`ND`, modification and commercial use permitted, resale
> forbidden — which bundling to style output is not). Built in four slices:
>
> - **Field + selector (4a, 0.66.0).** `ENGINE_SKIN` + `World.skin`, wired through
>   the same seams as the locked theme (both projects' types, `format.ts`'s world
>   pick, `Installer`'s `WORLD_INFO_FIELDS`, the engine context, export/import, the
>   0.8.0 schema — tier-two, no migration). A **Skin** panel in the storyworld's
>   properties. `Presentation` sets `data-skin` on the document root **in the export
>   only**.
> - **Art + 9-slice (4b, 0.67.0).** The needed kit elements re-encoded to WebP
>   (alpha kept, ~48 KB total) under `engine/public/skins/<skin>/`, copied verbatim
>   into an export's `/skins/` like the fonts and referenced by stable relative
>   `url()`. `engine/assets/skins.less` applies `border-image` to the inventory
>   frame, tiles/slots, paperdoll frame, choice modal, settings panel and title
>   buttons, keyed on `data-skin`. **It is `@import`ed by `base.less`, which the
>   editor never syncs** — so the skin is export-only *by construction*, the editor
>   build never resolves the skin `url()`s, and the composer preview keeps the flat
>   chrome (like the locked theme and alignment).
> - **Paperdoll body art (4c, 0.68.0).** Under MEDIEVAL the figure becomes the kit's
>   equipment body art (its own aspect ratio, generic silhouette + labels hidden),
>   with the seven equip anchors moved onto the art's drawn boxes. To keep this
>   without the component knowing the (export-only) skin, the **anchor coordinates
>   moved from `ObjectPanel` into CSS classes** (`.paperdoll-slot--HEAD` …):
>   `engine.less` holds the generic positions, `skins.less` overrides per skin. SCIFI
>   ships no body art, so it keeps the generic silhouette inside its panel frame.
> - **Export pruning (4d, 0.69.0).** The engine build bundles every skin; the desktop
>   PWA export removes the folders a world does not use (and the whole `skins` dir
>   when it has none) — the "only the needed assets" rule. The kept skin is served at
>   runtime, **not precached**, so its frames need a connection on first paint; a
>   follow-up can precache it the way content assets are. The demo world selects
>   MEDIEVAL so an export shows the skin and the paperdoll with the mask worn.
>
> - **Install-drop fix (0.69.1).** The first export showed no skin: `data-skin` was
>   never set even though the art shipped, the CSS loaded and the world's skin was
>   MEDIEVAL (the export prune proved it — it removed sci-fi). Root cause was **not**
>   in the skin code: `saveEngineCollectionData` (the engine's install-into-IndexedDB
>   step) destructures an explicit field list from `engineData._` and writes it with
>   `saveWorldData`, and that list **omitted `streamAlignment`, `theme` and `skin`**.
>   `getWorldInfo` reads the installed row, so `worldInfo.skin` was always undefined
>   in an export. `theme` limped along only because `Presentation` also applies it via
>   `getPresentationSettings`; `skin` and `streamAlignment` had no such backup, so both
>   were silently dead in every export. Added the three fields to the destructure and
>   the write. This is the exact "add a field, four places fail silently" trap — the
>   install pick was the fifth place. **Re-export after this to see the skin.**
>
> - **Live-pass refinements (0.69.2).** From the first real export: (1) skinned
>   tiles/slots read "a bit off" because `.object-tile` is `content-box`, so the 8px
>   skin border grew each tile past its 4.4rem grid track and the icon filled out to
>   the frame — fixed by `box-sizing: border-box` in the `.nineslice` mixin (skinned
>   frames only). (2) A worn, *slotted* item is now hidden from the inventory grid,
>   since it already shows on the paperdoll; a slotless worn item has no anchor and
>   stays in the grid. (3) Taking a worn item off the paperdoll is a **two-step
>   confirm** (click the item → a "Remove" button → click to remove), because
>   removing applies the item's remove effects and a stray click stripping a mask in
>   a hostile scene should not be a single tap. Dismisses on outside-click/Escape
>   like the rail menu.
>
> **First-cut caveats, for the live pass:** the 9-slice insets and the medieval
> anchor coordinates are measured off the source art and want tuning against a real
> export; only the surfaces above are dressed (prose column untouched); the browser
> build's PWA export does not yet prune skins; and offline skin precache is a
> follow-up.

**The 9-slice framed look. Cosmetic only — no engine logic — so low risk but
real, per-asset labour.** Sequenced last because phases 1–3 give ~70% of the
"feels like a game" payoff for ~20% of the work and de-risk this one.

- **A skin is more than colours.** Model it as a named bundle: a set of art
  assets (panel frames, slot cell, button faces, border), the `border-image`
  slice metrics per asset, and the colour tokens that go with the art. `World.skin`
  is the field; the *definitions* are bundled in the engine, not authored — same
  "curated, not custom" rule as themes.
- **9-slice is `border-image`.** The `!dev/GUI` kits are raster PNGs designed to
  slice. This works in CSS but each asset needs its `border-image-slice` /
  `-width` / `-outset` tuned by hand; a skin is that tuning table plus the art.
  It is labour per skin, not a token swap — budget accordingly.
- **The preview must stay honest.** The engine renders in a **dock panel** in
  the composer and **full-window** in an export. Art designed for 1920px looks
  broken at dock-panel size, so a skin must be responsive (or degrade to the
  flat tokens below a width) or the composer preview lies to the author — the
  same "measure the running app, don't trust the stylesheet" rule the repo lives
  by. This is the acceptance criterion for the phase.
- **Licensing is a gate, not a detail.** The `!dev/GUI` kits (Wenrexa and
  similar) carry redistribution terms, and a skin ships **inside every exported
  PWA**. No kit becomes a built-in skin until its licence is confirmed to permit
  redistribution in an exported app — this is the same class of attribution care
  `CLAUDE.md` records for the fonts and the `CREDITS`/`LICENSE` files. Resolve it
  before any asset is committed.
- **Token duplication compounds.** Every colour token a skin introduces lands in
  both `variables.less` and `engine-editor.less`. Combined with the per-theme
  cost from phase 2, the maintenance surface is real; keep the built-in set
  small (2–3 skins to start) for this reason alone.
- **Assets, not the asset manager.** Skin art is engine-bundled and shipped with
  the export, *not* a `userData` asset served through `esg-asset://`. It does not
  go through `collectAssetReferences`, the asset manager or the export
  unused-asset check — it is part of the engine build, like the fonts. Keeping it
  out of the author's asset space is what keeps the "curated, not custom" line
  clean.

**Rejected:** author-uploaded skin art. Same reasoning as custom themes, plus it
would drag the whole thing into the asset pipeline (kinds, crop metrics,
reference counting) for a feature whose entire point is a *curated* look.

---

## Phase 5 — wearable objects and the character panel

> **Slice 5a shipped (0.63.0) — the mechanic.** Wearable objects with wear/remove
> effects; the paperdoll panel (5b) is still to come.
>
> - **Model (both projects):** `WorldObject.wearable`, `wearEffects` /
>   `removeEffects` (`VariableSet[]`, mirroring `takeEffects`), `wearMessage` /
>   `removeMessage`. `EngineObjectData` mirrors them; the engine reads them, so
>   they are in `format.ts`'s object pick. Worn runtime state is
>   `EngineLiveEventData.worn?: ElementId[]` — unindexed, absent = nothing worn, no
>   migration, exactly like `objects`/`messages`.
> - **Engine:** pure `wear` / `unwear` in `lib/objects.ts` (no delta moves — the
>   object stays carried; they toggle the worn set and apply the effects), driven
>   by `wearObject` / `removeObject` in `useObjectActions` (which now also persists
>   `worn` through `saveLiveEventObjectOutcome`). The object menu grows **Wear**
>   (carried, wearable, not worn) and **Remove** (worn); `OBJECT_WEAR` /
>   `OBJECT_REMOVE` interface-text keys.
> - **The gate is free, as designed.** Wearing sets a variable; the existing
>   `Condition.variableId` path gate does the rest. No new condition type, no
>   numeric stats — both explicitly rejected below.
> - **Authoring:** a *Wearable* checkbox in `ObjectManager/Objects.tsx` plus a
>   wear/remove effects + messages section (reusing `VariableEffectRows`).
> - **Covered** by `objectModel.test.ts` (wear/unwear: toggles worn, applies
>   effects, refuses when not carried / not wearable / already-worn / not-worn).
> - **Deferred to 5b:** the `EQUIP_SLOT` field, the paperdoll/character panel, and
>   one-item-per-slot replacement. 5a offers Wear/Remove from the ordinary
>   inventory rail; the worn set is bookkeeping the panel will visualise.
>
> **Slice 5b shipped (0.65.0) — equip slots and the character paperdoll.**
>
> - **Model (both projects, transport, schema):** `EQUIP_SLOT` (`HEAD | FACE |
>   NECK | BODY | HANDS | FEET | HELD`, a closed curated set) and an optional
>   `WorldObject.slot` / `EngineObjectData.slot`. Tier-two field on the existing
>   `objects` table — **no migration** — named in `format.ts`'s object pick, the
>   0.8.0 transport type, the schema's `objects` block (`additionalProperties:
>   false`, so it had to be), and both export/import destructures.
> - **One item per slot, in the pure `wear`.** Wearing an object whose slot is
>   occupied displaces the incumbent: it drops from `worn` and its `removeEffects`
>   apply *before* the newcomer's `wearEffects`, so a shared gate variable ends up
>   with the newcomer's value and the displaced item's own gate reverts. A wearable
>   with **no** slot claims nothing and never displaces (many can be worn). Only the
>   newcomer's `wearMessage` narrates — the displaced item's `removeMessage` does
>   not, because the player did not choose to take it off; its *effects* still fire.
>   Covered by `objectModel.test.ts`. The hook is unchanged — `wear` already returns
>   the whole worn set.
> - **The panel is a body silhouette with one anchor per slot the world uses**
>   (`Paperdoll` / `PaperdollSlot` in `ObjectPanel.tsx`, `SLOT_LAYOUT` the anchor
>   coordinates). A filled anchor is a button that takes the item off — the design's
>   "click a filled slot to Remove"; equipping stays on the tile's Wear verb. **No
>   drag-and-drop:** the engine ships no DnD library and adding one would bloat every
>   exported PWA, so empty anchors are inert markers, not drop targets. Present only
>   when the world has slotted wearables — same opt-in as the rail. Styled in
>   `engine.less` in flat tokens (so it shows in the composer preview *and* the
>   export, unlike phases 1–2), silhouette in `currentColor`; **phase 4 skin art
>   dresses the figure and keeps the same anchors**, which is the whole reason the
>   slot set is closed.
> - **Slot names are interface text** (`OBJECT_WORN` + `OBJECT_SLOT_*`, in the
>   Objects group), so the paperdoll is translatable like the rest of the rail.
> - **Authoring:** an *Equip slot* dropdown in `ObjectManager/Objects.tsx`'s
>   wearable section (`SLOT_OPTIONS`, "No slot" default). The demo's Ceremonial Jade
>   Mask is a `FACE` item, so the demo now shows the figure with a single anchor.



**Equip slots that set a variable, so the gate is free.** The paperdoll-style
CHARACTER panel from the `!dev/GUI` kits (Game #6) — a body with equipment slots
and a stat readout — but built as *wearable objects*, not as an RPG stat engine.

**This is the important reframing, and it changes the cost by an order of
magnitude.** An earlier draft of this feature feared a *numeric stat* system:
`strength = base + Σ(equipped bonuses)`, recomputed on every equip/unequip. That
would be a genuinely new evaluation model — variables are authored and effected,
never *derived* — and it is **rejected**, below. What is designed instead is the
IF-classic *wearable* concept (Inform 7's "wearable"/"worn"): equipping an object
sets a **boolean variable**, and the existing condition system does the gating.
"Wear the hat to enter the spider cave"; "the disguise lets you speak to the
guard" — both are a path condition on a variable that is already expressible.

**The precedent is already in the model.** `WorldObject.takeEffects`
(`src/data/types.ts`) is "variable assignments applied when the player picks this
up", and its own comment states the reason: inventory presence is not queryable,
so an object mirrors its state into a variable a condition can read
(`{ bookTaken ? ... }`). Equipping is the same move with a different trigger and
one addition — it reverses. So the mechanic is `takeEffects` with an on/off pair,
not a new subsystem.

What is actually new:

- **A wearable flag and a slot.** Beside `takeable` / `combineable`, add
  `wearable: boolean` and a `slot: EQUIP_SLOT` (`HEAD | FACE | BODY | HANDS |
  FEET | ...` — a curated enum, so the paperdoll has fixed anchor points to draw).
  Tier-one/two fields on the existing `objects` table: **no Dexie migration**.
- **`wearEffects` / `removeEffects`.** The mirror of `takeEffects`, applied on
  equip and un-equip. For a boolean this is trivially reversible — set `true` on
  wear, `false` on remove. The `takeEffects` guidance ("usually assignment, not
  increment") applies verbatim and is what keeps it reversible; an author who
  increments instead owns the result. This is the whole of the "reversibility
  problem" that the numeric version made frightening — for a toggle it is two
  assignments.
- **A worn runtime state.** Which object occupies which slot is *runtime* state,
  exactly like the object deltas: `EngineLiveEventData.objects` is already an
  optional unindexed property on `live_events` and "an old save simply lacks it …
  reads as a pristine world" (`CLAUDE.md`, *the 0.8.0 shape*). Worn state is a
  second such property — **no migration**, and an old playthrough just has nothing
  equipped.
- **An equip / remove verb.** `useObjectActions` already exposes
  `takeObject` / `combineObjects` / `inspectObject`, surfaced as verbs in
  `ObjectMenu`. Add `wearObject` / `removeObject`, offered only for a `wearable`
  object, only when it is carried — the same "only the verbs that apply" rule the
  menu already follows (Take is absent once carried).
- **The gate is free.** Once equipping sets a variable, *nothing else is needed*
  to open a path — the existing `Condition.variableId` path gate does it. This is
  the entire payoff of routing through a variable rather than inventing an
  "is-worn" condition type: every reader of variable conditions already handles
  it, and none can wave it through the way `isPathOpen` fails open on an unknown
  condition (`CLAUDE.md`, *the 0.8.0 shape*).

**The panel:**

- **The character panel is the phase-3 inventory in "character" mode** — the same
  object grid, plus a paperdoll region whose slots are drop targets keyed on
  `EQUIP_SLOT`. It is skin art (phase 4) when dressed, flat tokens before that.
- **A stats *readout* is a separate, cheaper sub-feature and does not need
  equipment at all.** Today a variable only shows if the author types
  `{ strength }` into prose; a panel that *pins chosen variables* as a persistent
  readout ("STRENGTH 88") is new UI plus a "which variables to show" list, and no
  new mechanic. It pairs naturally with the paperdoll but ships independently, and
  it is the honest way to get the panel's right-hand column without (B) below.
- **Configurable and off by default, non-negotiable.** Like the object rail, the
  character panel appears only when the author opts in (a world has wearable
  objects, or pins stats). A pure narrative world sees none of it.

**Rejected — numeric stat accumulation (`base + Σ bonuses`).** This is the line
between a narrative engine and an RPG engine, and it stays on the narrative side.
It would require variables to be *derived* — recomputed from equipment on every
change — which the engine deliberately does not do (objects derive quantity;
variables never derive). The wearable-boolean model delivers the authored intent
("this item unlocks this content") without it. If a numeric system is ever
wanted, it is its own design track with its own `dev-doc`, not a widening of this
one.

**Rejected — an "is-worn" path condition type.** A new condition kind that asks
the inventory directly would be a reader every existing condition-evaluator would
have to learn, and `isPathOpen` *fails open* on conditions it does not recognise —
in the direction that unlocks content. Routing through a variable reuses a gate
that already exists and already fails safe.

---

## Sequencing and the one open question

**Order: 1 → 2 → 3 → 4, with 5 riding on 3.** Each phase ships and is usable on
its own; nothing later is required for something earlier to be worth having.

- Phase 1 (alignment) and phase 2 (theme lock) are independent and could ship in
  either order or together; alignment is the recommended first because it is the
  most visible for the least code and has no palette-maintenance tail.
- Phase 3 (inventory grid) depends on phase 1 for somewhere to put a wide panel.
- Phase 4 (skin art) depends on nothing structurally but should be last: it is
  the only phase with a licensing gate and open-ended art labour, and the flat
  tokens carry every phase before it.
- Phase 5 (wearables + character panel) rides on phase 3 — the paperdoll is the
  inventory grid in "character" mode — but is otherwise self-contained and needs
  no schema migration. Its stats-readout sub-feature is independent of everything
  and can land whenever. Phase 5 is a *mechanic* riding presentation, so it is
  the one phase that changes what a storyworld can *do*, not just how it looks.

**Open question deferred to phase 4:** which specific kits become the built-in
skins, pending licence confirmation. Until then phases 1–3 use the existing flat
tokens and are fully functional without a single new image.

## Housekeeping this feature will touch

- **Version:** minor bump per shipped phase (each is a feature), per the repo's
  release rule — `package.json` `version`, not `AppContext.version` (the schema
  version stays `0.8.0`; none of these needs a schema bump).
- **Interface text:** phase 2 removes nothing from `interfaceText.ts` (the theme
  toggle strings stay; the control is only hidden), so no key changes. Phases 3
  and 4 add no player-facing words unless a skin introduces a label, which it
  should not.
- **`format.ts` + `WORLD_INFO_FIELDS`:** every field here passes through both.
  This is written twice above because it is the single most repeated silent
  failure in the codebase's history.
