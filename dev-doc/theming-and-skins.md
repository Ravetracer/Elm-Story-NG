# Design plan: themes, skins, and the reading-lane layout

> **Status: plan, not shipped.** No code follows from this file yet. It is the
> settled design for a four-phase presentation feature and the reasoning behind
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

## Sequencing and the one open question

**Order: 1 → 2 → 3 → 4.** Each phase ships and is usable on its own; nothing
later is required for something earlier to be worth having.

- Phase 1 (alignment) and phase 2 (theme lock) are independent and could ship in
  either order or together; alignment is the recommended first because it is the
  most visible for the least code and has no palette-maintenance tail.
- Phase 3 (inventory grid) depends on phase 1 for somewhere to put a wide panel.
- Phase 4 (skin art) depends on nothing structurally but should be last: it is
  the only phase with a licensing gate and open-ended art labour, and the flat
  tokens carry every phase before it.

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
