# Currency (the money readout)

A persistent money line below the inventory in the engine's object rail — a coin,
a value, and an optional label ("Credits", "Gold"). The demo shows it: *The Jade
Idol of K'aal* designates its `funds` variable as currency, so the grant adds to
it and buying supplies spends it, live.

## Money is a variable, not a new kind of state

The one decision worth recording: **currency is a designated NUMBER variable, not
a dedicated hardcoded value.** A storyworld's money is already a variable in every
way that matters — effects spend and earn it, conditions gate on it (`funds >=
100`), template expressions print it (`{ funds }`). A parallel hardcoded money
field would have to reimplement all of that (its own effect type, condition type,
transport field, migration, editor UI) for zero gain, and an author could not
change it during play without a new effect system. So the feature adds no state:
it *points at* an existing variable and draws its live value.

This is the same principle the rest of 0.8.0 follows — "what must reach the engine
goes through a variable" (character relationships reach it through their optional
`variableId`).

## Two world fields, riding the existing seams

`World.currencyVariableId` (the designated variable's id) and
`World.currencyLabel` (the word beside the value) are optional fields, so like
`coverAssetId`/`backgroundAssetId`/`choicePresentation` they need **no Dexie
migration** — Dexie only indexes, and neither is indexed. They thread through the
same **nine** seams every world field does, each a known silent-failure trap:

| seam | file |
| --- | --- |
| editor type | `src/data/types.ts` `World` |
| compile (what the engine can see) | `src/lib/compiler/format.ts` world `pick` |
| export | `src/lib/getWorldDataJSON.ts` |
| import | `src/lib/importWorldData.ts` |
| transport schema (**the loud one** — `additionalProperties: false`) | `src/lib/transport/schema/0.8.0.json` |
| transport type | `src/lib/transport/types/0.8.0.ts` `RootData` |
| engine data type | `engine/src/types/index.ts` `EngineWorldData` |
| runtime `worldInfo` pick + its type | `engine/src/components/Installer.tsx` `WORLD_INFO_FIELDS` **and** `engine/src/contexts/EngineContext.tsx`'s `worldInfo` shape |
| **engine install re-assembly** (**export-only, silent**) | `engine/src/lib/api.ts` `saveWorldData` — the destructure of `engineData._` **and** the object it re-assembles for the write |

Two of those rows are the ones that actually bite:

- **The `worldInfo` row is a double trap:** the field has to be **both** in
  `WORLD_INFO_FIELDS` (or it arrives `undefined` and the readout never appears)
  **and** in the hand-written `worldInfo` type (or TypeScript can't see it). Same
  failure mode `interfaceText` and `choicePresentation` document there.
- **The `api.ts` install row is invisible in the composer and only bites in an
  export**, which is what makes it the worst one. `saveWorldData` copies world
  fields through **two hand-written lists** (a destructure of `engineData._`, then
  the object it re-assembles) — and *both* must name the field. The composer
  preview reads the world record directly through a live query, so it looks fine
  there; only an installed PWA runs this path, so the field silently vanishes on
  export alone. This is the exact class as the 0.69.1 `theme`/`skin` install-drop,
  and it is what kept the money readout dark in the first export (found by driving
  the export in a browser and reading the installed world row's keys — the packed
  data had the field, the installed row did not). If a new world field shows in
  the preview but not in an export, check here first.

## The readout — `engine/src/components/ObjectPanel.tsx`

- **Value comes from the live event's state, not the variable's initial value.**
  `liveEvent.state` is keyed by variable **id** (`EngineLiveEventStateData` =
  `{ title, type, value, worldId }`), so `state[currencyVariableId]?.value` is the
  current amount. Every transition writes a new live event with post-effect state,
  so the readout tracks spending and earning with no extra wiring.
- **Shows only when designated and present** (`currencyVariableId` set and the
  variable is in state). A world that names no currency draws nothing, exactly as
  before.
- **A currency-only world still gets the rail.** The panel's "render nothing
  without objects" guard and its `--object-panel-active` width flag both now also
  fire for a currency readout, so a world with money and no objects still shows the
  money line (and reserves the rail's width so it doesn't overlap the prose).
- **The coin is a shipped default, skin-overridable.** `.object-panel-currency-coin`
  in `engine/assets/engine.less` carries Wenrexa's "GUI Game #6" money icon
  (`PanelInventory_IconMoney.png`, the same kit the medieval skin is cut from),
  re-encoded to a 19×19 lossless WebP and embedded as a base64 data URI — so it
  resolves in both the editor build and an export with no file path, the paperdoll
  silhouette's reasoning. It is **CC BY-SA 4.0** and credited in
  `engine/public/skins/CREDITS.md`, which is always packed on export
  (`main.ts` keeps `CREDITS.md` even when it strips the unused skins). A skin
  dresses the rest of the rail; it can replace the coin by overriding `background`
  in `skins.less`. The label is drawn small-caps and dimmed, the value in tabular
  figures.
- **The readout sits on a money plate.** `PanelSettings_Slider.png` from the same
  kit — an ornate frame around a dark inset track — is the `.object-panel-currency`
  background (lossy WebP data URI, `aspect-ratio: 219 / 53`), centred in the rail
  with the coin, value and label centred on it. Because the track is dark in either
  theme, the text is a **fixed warm off-white** (`#f0e8d0`) rather than the reading
  colour — the one place the money readout does not follow the theme. Also CC BY-SA
  4.0, credited alongside the coin.
  - **Embed the base64 programmatically, never by hand.** The first cut pasted the
    plate's base64 with stray trailing padding (1419 chars for a 1062-byte payload
    that needs none); ImageMagick tolerated it but Chromium's image decoder
    rejected it, so the plate box sized correctly (219×53) and simply never
    painted. Regenerate the data URI with a script that reads the file and writes
    the exact `base64` output into the stylesheet, and verify it round-trips
    (`b64decode(embedded) == bytes`).

## The editor — `WorldProperties/WorldCurrency.tsx`

A **Currency** panel in the world's properties: a select of the world's NUMBER
variables (only NUMBER — money is a number) and a free-text label. Writes
immediately (the select) and debounced (the label), re-reading the row inside the
save because the metadata form beside it writes the same record — the cover/colour
panel pattern. Clearing the variable stores `undefined` and hides the readout;
blanking the label shows just the value.

## Tests and verification

`src/__tests__/validateWorldData.test.ts` carries `currencyVariableId` +
`currencyLabel` through the 0.8.0 optional-fields round-trip, which is the
`additionalProperties: false` guard — the app must be able to import its own
export. The rest is presentation, verified in the running engine (the composer
preview reinstalls on open, so the readout shows there): load/update the demo and
watch `funds` below the inventory move as the grant is taken and supplies bought.
