# Working on Elm Story - NG

A visual editor for branching narrative storyworlds. Abandoned by its authors at
0.7.0 (April 2022); the build toolchain has been modernized, the application
code has not. Read `README.md` first for setup and scripts — this file covers
what is easy to get wrong.

This revival started from 0.7.0. A **0.7.1** archive also survives, and what it
does and does not contain is recorded under
[The import upgrade chain](#the-import-upgrade-chain) and in `TODO.md`. The short
version: it is a version-string release whose only new feature is an `ErrorModal`
that nothing dispatches and that would not compile here, its `db/v11.ts` clobbers
v10's migration, and its `.gitattributes` corrupted the repository's `.ttf` and
`.mp3`. Its schema version is accepted on import and stamped on export; nothing
else from it was taken.

## Two applications, one repository

**The editor** is the Electron app at the repository root. `src/main.ts` is the
main process, `src/index.html` plus `src/index.tsx` the renderer, built by
`electron.vite.config.ts` into `out/main` and `out/renderer`.

**The Storyteller engine** in `engine/` is the runtime that plays a storyworld.
It has its own `package.json` and `node_modules`, and is consumed three ways via
`npm run engine:sync`:

| output | consumer |
| --- | --- |
| `assets/engine-dist/` | copied verbatim when a user exports a storyworld as a PWA |
| `src/styles/engine.less`, `engine-editor.less` | imported by `src/App.global.less` |
| `src/components/Storyteller/embedded/` | imported by the renderer for in-editor preview |

**All three are generated and git-ignored. `engine/assets` and `engine/src` are
the source of truth.** Editing `src/styles/engine-editor.less` looks like it
works and is silently overwritten on the next build.

Two editor modules also import from `engine/src` directly
(`ElementEditor/SceneMap/EventSnippet.tsx`, `lib/serialization.ts`), which is
inconsistent with the embedded copy but works.

## The rename to Elm Story - NG

The product is **Elm Story - NG**. The rename exists so nobody mistakes this for
work by the original authors, which means the distinction it draws is the whole
point of it:

- **The product name changed; the authors' name did not.** "Elm Story - NG"
  replaces "Elm Story" wherever it names the application. "Elm Story Games" and
  "Elm Story Games LLC" stay exactly as they are in the copyright line,
  `CREDITS`, `README.md` and both `package.json` `author` fields, because there
  they are attribution rather than branding. Renaming attribution would
  misattribute it.
- **On-disk identifiers keep their `esg-` prefix.** `esg-asset://`, the
  `esg-library-<studioId>` databases, the `esg-ui-scale` preference key and
  `package.json`'s `"name": "esg-app"` are all storage keys. Renaming one does not
  clarify anything and silently orphans whatever it named.
- **`app.setPath('userData', ...)` at the top of `src/main.ts` is load-bearing.**
  Electron derives `userData` from the product name, so the rename moved it from
  `Elm Story` to `Elm Story - NG` — and the failure mode is not an error, it is an
  app that opens on an empty dashboard with every storyworld, asset, cache and
  trash entry still sitting in the old directory. The name is pinned to `Elm
  Story` and has to run before the constants below it read the path. Moving it
  later is a migration, not an edit.
- **`engine/data/0-7-test/0-7-test.json` still says "Elm Story"** and must keep
  saying it. It is a frozen export written by the original authors, in the same
  category as `lib/transport/types/*` — a description of JSON already on disk,
  which is the one place a rename must not be applied.

### The two marks are files now, not components

`TitleBar/ESGIcon` and `ESGModal/ESGBanner` were inline React SVG components,
which made a design change a code change. Both are `.svg` files imported as URLs
and drawn by an `<img>`: `src/components/TitleBar/mark.svg` and
`src/components/Modal/ESGModal/banner.svg`. Each carries its own notes.

- **A font on this machine is not a font in the repository.** `assets/es_logo_NG.svg`
  and `assets/es_logo_NG_favicon.svg` set "NG" as live `<text>` in **Pengenalan**,
  which is installed locally and is not committed. Anything *shipped* has to be
  outlined or it renders in a fallback face for everyone else — which is why
  `engine/public/favicon.svg` is generated from the source rather than copied from
  it, with the command recorded in its own header. The editable sources under
  `assets/` keep live text on purpose; they are Inkscape documents.
- **The "Elm Story" wordmark has no font anywhere.** `banner.svg`'s serif glyphs
  are outlines carried over from the 0.7.0 banner, which was itself outlines.
  There is no way to re-set that text, so the hyphen is a drawn `<rect>` and the
  glyphs must not be retyped. The banner is the original wordmark minus "Games",
  plus "NG" scaled to a 36px cap height against the wordmark's 42px.
- **`<img>` means CSS cannot reach the paths.** The title bar mark's hover used to
  repaint the white fill to `--highlight-color`; it is an opacity transition now.
  A blanket fill would also have flattened the purple "NG" into one colour.
- **`TITLE_BAR_ICON_WIDTH` has to match the mark's real width.** It is derived
  from `TITLE_BAR_MARK_WIDTH` rather than hardcoded, because the drag region is
  absolutely positioned and starts where the mark ends — the old `34` was
  `19 + 15` for the old mark. Get it wrong and the drag region covers the mark, so
  the info box stops opening. Measured live: the region starts at x=37 for a 22px
  mark at a 15px offset.
- **"NG" is illegible below about 18px** and is a purple accent at title bar size,
  not a readable suffix. That is why the title bar spells the name out beside it.

### The info box has no links, deliberately

`ESGModal` used to carry six social icons, the site and the licence. Every one
pointed at the original authors: `elmstory.com` and `docs.elmstory.com` no longer
resolve, the Patreon redirects to Patreon's own front page and the Twitter account
is gone, while the itch.io, Reddit, Twitch and YouTube pages that *do* still answer
are the original project's. A link that sends someone asking for help with this app
to a page the people behind it do not run is worse than no link, so the box states
what it is and stops there. `LICENSE` and `CREDITS` are named as files rather than
linked.

The same reasoning applies to `lib/saveStarterContent.ts`, whose generated
storyworld shipped six dead `elmstory.com` links to every new author, and to the
engine's `TitleCard` footer and console banner, which go out inside exported PWAs.

**The dead links elsewhere are known and still there**: `ElementHelpButton`,
`TitleBar`'s own Help button, `ExportWorldMenu`, `ImportJSONModal` and `menu.ts`'s
Help submenu all still point at `docs.elmstory.com`. `VariableManager/VariableHelp.tsx`
is the pattern for replacing one — an in-app sheet held to the real parser by
`src/__tests__/variableHelpExamples.test.ts` — and it is the only accurate
documentation in the product.

## Authoring affordances that are easy to miss

The event content editor has two trigger characters and no visible affordance for
either. The archived docs mark both sections "WIP", so this is the only record.

- **`/`** opens a command menu (`Tools/CommandMenu.tsx`, triggered by the
  `/\/(\s?\w*)$/` match in `lib/contentEditor/index.ts`): Text, Heading 1–4,
  Quote, Numbered List, Bulleted List, Character Reference and **Image**. An
  `EMBED` entry for video is present but commented out.
- **`{`** starts a template expression. See below.

**Images per event already work and are not a missing feature.** Picking Image
inserts a void `ELEMENT_FORMATS.IMG` node, which renders `ImportAndCropImage`: a
file import accepting `image/*`, cropped to a fixed 16:9 at 1310×736 and quality
0.7, saved as `.webp` through the `SAVE_ASSET` IPC. The asset id is written both
to the Slate node and to `Event.images`.

`Event.images` is **not** an author-facing image list; it is the bookkeeping array
used to clean assets up. `lib/contentEditor/index.ts` diffs it against the
document to drop orphans, and `db/index.ts` uses it when removing an event. Keep
it in step with the document when touching image elements.

Toolbar buttons are a separate, smaller surface: the selection toolbar
(`EventContentToolbar.tsx`) is a portal that only appears for a non-collapsed text
selection and offers leaf marks and links, not blocks.

## The asset manager

`components/AssetManager`, reached from the picture button in the storyworld
outline's title bar. It joins the `LIST_ASSETS` IPC handler's directory listing to
`lib/assets.ts`'s reference index and trashes what nothing points at.

Three things carry more meaning than they look like they do:

- **There are exactly four places a storyworld names an asset**:
  `Character.masks[].assetId` (jpeg), `Event.images[]` (webp), `Event.audio[0]`
  and `Scene.audio[0]` (both mp3). `collectAssetReferences` has to cover all four
  or the manager offers to delete something in use. Add a fifth writer and it
  belongs there too.
- **`LIST_ASSETS` lists every extension, not just those three.**
  `IMPORT_WORLD_ASSETS` copies whatever sits beside an imported JSON, so real
  directories contain files the app never wrote — filtering to the app's own
  extensions hid a 241 KB `.png` orphan in the test world. Nothing can reference
  such a file, which makes it an orphan by construction.
- **An asset used by event content cannot be deleted from the manager**, and the
  button is disabled rather than the reference being cleared. The id lives both in
  `Event.images` and as an IMG node in `Event.content`; rewriting the document
  from outside the editor would be overwritten by an open content editor's next
  debounced save. Character masks and both audio profiles are a single field, so
  those are cleared before the file is trashed. `isReferenceClearable` is the
  distinction.

Deletion goes through `REMOVE_ASSET` with `trash: true`, so `RESTORE_ASSET` still
applies and files land in `userData/.trash`.

### Importing and assigning

The manager also imports, and doubles as the picker behind every "Choose" in the
composer — the character mask context menu, the event content image slot, and the
audio profile on scenes and events. `AssetManager` takes `selectKind`, `onSelect`
and `selectedAssetId`; `AssetsModal` passes them through and takes a `worldId`
rather than a `World`, because a picker is opened from an element rather than
from the storyworld.

- **An asset's *kind* is not its reference type.** `ASSET_REFERENCE_TYPE` answers
  "who points at this file", which an unassigned asset has no answer to.
  `ASSET_KIND` answers "what was this processed as", which is fixed when the file
  is written. Event audio and scene audio are two reference types and one kind.
- **`ASSET_KINDS` in `lib/assets.ts` is the one description of each kind** — its
  label, its extension, its accept filter and, for images, the crop pipeline. The
  in-place importers read the same table, which is what makes an asset imported
  from the manager interchangeable with one imported from the slot: a character
  mask is 4:5 at 200×250 JPEG, an event image 16:9 at 1310×736 WebP quality 0.7.
  An asset that is *nearly* right is worse than none, because nothing downstream
  can tell.
- **The picker filters on the kind's extension, not on media type.** Every read
  site asks for the extension it expects rather than reading disk, so a `.png`
  assigned to a mask is fetched as `.jpeg`, comes back missing, and
  `CharacterMask`'s self-healing effect then silently clears the assignment. The
  extension filter is what keeps every offered asset assignable.
- **The import menu asks which kind rather than inferring one.** Nothing on disk
  distinguishes a JPEG meant as a mask from one meant as an event image.
- **Choosing writes only the reference.** The asset previously in the slot stays
  on disk — see below — and event images need both writes, the `Event.images`
  entry and the IMG node's `asset_id`, which is why that picker lives inside the
  Slate editor rather than being opened from anywhere else.

### Replacing an asset never deletes the old one

Three paths used to remove the previous file outright — no reference count, no
trash — on the assumption that the element holding the id was its only owner.
Two masks may share an id, two events may share an mp3, and the picker makes
sharing ordinary rather than accidental, so replacing now leaves the file alone
and lets the manager decide whether it has died.

Removing *deliberately* — clearing a mask, removing an audio profile, deleting a
character — still removes the file, through
`api().assets.removeAssetIfUnreferenced`. **Clear the reference before calling
it**: the count is read back out of the database, so an element still holding the
id counts as a reference. `removeEvent` is the exception and passes
`filterOutEventIds`, because it cannot save an event it is deleting.

## Template expressions

`{ ... }` inside event content is parsed with acorn and evaluated by
`lib/templates.ts`. Four expression forms are supported: an identifier
(`{ name }`), a method call (`{ name.upper() }`, from `gameMethods`), a
conditional (`{ health > 50 ? "ok" : "hurt" }`) and arithmetic
(`{ health + bonus * 2 }`, operators `+ - * / %`, nesting and parentheses
included). Anything else resolves to the string `esg-error`, which
`EventSnippet` and the engine's `decorate()` render as an ERROR span.

Two things to know before changing it:

- **`templates.ts` exists twice**, at `src/lib/` and `engine/src/lib/`, as separate
  files rather than one generated from the other. They differ only in `logger`
  calls, the `VARIABLE_TYPE` import path and "game" versus "world" wording. A fix
  applied to one and not the other means node previews and the storyteller
  disagree about the same text.
- **`getProcessedTemplate` drops any falsy substitution**
  (`value = value ? `{${value}}` : ''`). A value that is legitimately `0` has to
  reach it already stringified or it vanishes from the rendered prose instead of
  appearing. This is why the arithmetic branch stringifies its result.

Variable values are always stored as strings whatever the declared type, so a
NUMBER arrives as `"10"`. Changing a variable's type resets its initial value in
`db/index.ts` — `'false'`, `'0'` or `''` — which is why a blank NUMBER is treated as
an authoring error while an empty STRING is treated as ordinary data.

`src/__tests__/templates.test.ts` covers the arithmetic evaluator, including the
zero-result case above.

**A template expression names a variable by its title, not its id.** Both
`EventSnippet` and the engine build their variable map keyed on `variable.title`,
so renaming a variable breaks every expression that used the old name, and the
breakage is silent: the expression renders as an ERROR span rather than failing
anywhere a build would notice. Two variables sharing a title are likewise
ambiguous, with whichever the map saw last winning. `lib/variableUsage.ts` finds
those references for the variable manager, and it reads identifiers off acorn's
AST rather than by regex — `{ health > 50 ? "ok" : "hurt" }` would otherwise
credit variables titled `ok` or `hurt`, and `{ name.upper() }` one titled `upper`.

## The variable manager

`components/VariableManager`, the single place variables are edited. It opens from
the Variables tab title in the world inspector, from the `+` beside it, or by
clicking any row in the tab's list. Search, type and unused filters, per-variable
usage counts, a description field, and a deletion that states its consequences.

- **`WorldVariables` is an index, not an editor.** It was a second editable table
  with the same title, type and initial-value fields, which is why it was reduced
  to a row per variable that opens the manager — the same relationship
  `WorldCharacters` has with `CharacterModal`. It still exports `VariableRow`,
  which the manager and `ElementProperties/PathProperties` both render.
- **`LibraryDatabase.removeVariable` cascades.** It deletes every condition and
  effect naming the variable — which changes whether the paths carrying them are
  taken — and clears the variable from any input. That used to happen on one
  unconfirmed click, so `confirmRemoveVariable` states what a deletion takes with
  it. The panel no longer deletes at all.
- **The `?` opens an in-app reference, not a link.** `ElementHelpButton` sends
  authors to `docs.elmstory.com`, which no longer resolves, and the archived copy
  is not a substitute: its expressions page documents a `=/=` operator that has
  never parsed and omits the method calls and arithmetic that work. So
  `VariableHelp.tsx` is written against `lib/templates.ts` and is the only
  accurate description of the expression language in the product.
  `src/__tests__/variableHelpExamples.test.ts` runs every expression it shows
  through the real pipeline, so the sheet cannot drift into claiming something the
  parser rejects. Keep the two in step. **The help buttons for every other element
  type still point at the dead domain.**
- **`=/=` is deliberately not supported, and is not a missing feature.** `!=`
  already means "not equal", is what the parser accepts and is what
  `COMPARE_OPERATOR_TYPE.NE` uses for conditions, so adding `=/=` would give the
  language two spellings of one operator — and it cannot be done in the parser
  at all, since acorn reads `a =/= b` as an unterminated regular expression, so
  it would mean pre-translating every expression before parsing. The only thing
  that ever promised it was a docs site that no longer resolves.
  `variableHelpExamples.test.ts` holds `{ health =/= 10 }` to rendering as an
  error, which is the intended behaviour rather than a known gap.
- **`Variable.description` needed no migration**, which is worth knowing before
  assuming the next field will. Dexie only declares indexes, so an unindexed
  property is stored without a version bump, and the engine has no use for it at
  runtime. What it *did* need was the transport contract: `variables` in
  `schema/0.7.0.json` sets `additionalProperties: false`, so exporting a property
  the schema does not name produces a file this app then refuses to import,
  reported as an unsupported schema. It is optional in both the schema and
  `transport/types/0.7.0.ts`, which keeps files written by the original 0.7.0
  valid. `src/__tests__/validateWorldData.test.ts` holds that in place, including
  that an unnamed property is still rejected.
- **There are four kinds of usage**: `Condition.variableId`, `Effect.variableId`,
  `Input.variableId` and content template expressions. The first three reference
  by id and survive a rename; the fourth does not, and no cascade can repair it.
- **`VariableRow` is reused verbatim** from `WorldVariables`, which is where the
  rename, retype and initial-value logic lives along with its focus workarounds
  (#166, #307). The manager adds a usage line under each row rather than another
  column, because the row's column widths are shared with the condition and
  effect rows in `ElementProperties/PathProperties`.

**An antd `Modal` must not be a child of an rc-dock `DividerBox`.** DividerBox
divides its space between its React children and counts the modal as one, even
though it portals to `document.body` and renders nothing in place — which
collapsed the world outline to zero height. Render it as a sibling, inside a
fragment, as `WorldInspector` and `WorldOutline/TitleBar` both now do.

## The scene map clipboard

Cut, copy, paste and duplicate for events, jumps and the paths between them.
`Ctrl/Cmd+X/C/V/D`, or the entries in the scene map's toolbar, which carry the
shortcuts because the View menu that would list them is never rendered.

`lib/sceneMapClipboard.ts` is the rewrite and is **pure**: a paste is not a copy
but a re-pointing, since an event owns its choices and its input, a path owns its
conditions and effects, and all of them reference each other by id.
`src/__tests__/sceneMapClipboard.test.ts` covers it, and the assertion that earns
its keep is the one that serialises a remapped payload and fails if **any** copied
id survives anywhere in it — a missed reference draws correctly on the map and is
wrong underneath. It caught jump positions not being offset.

What travels:

- **Nodes drive it, paths ride along.** A path cannot exist without both ends, so
  selecting one alone copies nothing, and only paths with **both** ends inside the
  selection are copied. The rest are counted, and the count is logged, so a paste
  is never quietly lossy.
- **World-scoped references are kept, not remapped**: characters, variables,
  assets, and a jump aimed elsewhere in the world. A jump aimed *into* the
  selection follows the copy. This is why a clipboard records its `worldId` and a
  paste refuses another storyworld — it is in-memory `ComposerContext` state, not
  the system clipboard, precisely because those ids mean nothing elsewhere.
- **Titles are not suffixed.** A duplicate of "Green Additional" is another
  "Green Additional"; event titles carry no semantics, unlike variable titles,
  which template expressions resolve by name.

**`Scene.children` is replaced wholesale by every write, which makes it a
lost-update trap.** Two bugs came out of this, both found by reading the database
after the operation rather than by watching the map:

- **A multi-element cut must remove sequentially.** `removeEvent` reads, splices
  and saves the whole array, so a `Promise.all` over the selection has each
  removal splice its own copy and the last write win — leaving the other ids
  behind as child refs pointing at events that no longer exist.
- **A paste must re-read the child refs** rather than appending to the `scene`
  its component rendered with. That copy can be stale, and saving it puts back
  whatever was removed meanwhile.

Either one produces a **dangling child ref, which is fatal on next open**:
`createWorldOutlineTreeData` gives a scene item one child per ref and
@atlaskit/tree dereferences every child while flattening, so the outline throws
and takes the renderer with it — a blank window, with the real cause a storyworld
away from the symptom.

**Anything that adds several elements to a scene must announce all of them.**
`COMPOSER_ACTION_TYPE.ELEMENTS_SAVE` exists for that: the outline resets a scene
item's children from the database when it hears about a save (#414), so announcing
one of five pasted events leaves four child ids with no item behind them — the
same crash. Repeated single-element dispatches do not work, because React batches
them into one. The bulk effect in `WorldOutline` patches the tree rather than
rebuilding it, since a rebuild collapses every folder and scene the author had
open.

Two more things worth knowing:

- **A cut keeps the event's assets** (`removeEvent`'s `keepAssets`). The clipboard
  still names the images and audio, and trashing them would paste an event whose
  files are in `userData/.trash`. An unpasted cut therefore leaves assets behind,
  which is what the asset manager is for.
- **`Event.audio` needed reference counting before two events could share an
  mp3.** `removeDeadImageAssets` already did this for images; `removeDeadAudioAsset`
  now mirrors it, through `collectAssetReferences` so a scene audio profile counts
  too. `Event.audio` has no Dexie index (`v10.ts` indexes `images` but not
  `audio`), so the count is taken in memory. Before this, deleting either of two
  events sharing a track took the file from under the other.
- **The commands are performed by the scene map, not where they are asked for.**
  Cutting needs its element-removal path and pasting its viewport centre, so the
  toolbar sets `composer.sceneMapClipboardCommand` and the map runs and clears it —
  the same shape as `centeredSceneMapSelection`. Only the scene the outline has
  selected acts on a command, because rc-dock keeps every opened scene tab mounted
  in its pane cache and an unguarded listener would have all of them paste. The
  keyboard also stands down inside a text field and while a text selection exists,
  so copying words out of an event preview still works.

## What section 6 added, and the one trap in it

Three features whose fields section 3 had already migrated, so all three were
interface work with no schema cost.

- **The storyworld cover** is `World.coverAssetId`, set from the Cover panel in the
  storyworld's properties and shown on the dashboard card and above the title in the
  engine. `AssetThumbnail` is the shared component behind every image preview; it
  takes the **kind** and reads the extension from it, which is what keeps a
  thumbnail fetchable — asking for the wrong extension returns a file that comes
  back missing.
- **`VARIABLE_SCOPE.SCENE` resets a variable to its initial value on entry to its
  scene**, and **"entering a scene" is not a `JUMP` live event** whatever
  `DESIGN.md` §11 originally said. A live event's type comes from the *destination
  event's* type, so crossing a scene boundary is typed CHOICE or INPUT like anything
  else and JUMP appears only when the destination is a jump element; keyed off the
  type, the reset never fired. The test is that the destination event's `sceneId`
  differs from the one just left, which is also right for a loopback — same scene,
  no reset. The reset runs *after* the path's effects, since an effect on the way in
  is the author saying "this is true as we arrive".
- **Character relationships are editor-only.** No engine table, no `format.ts`
  entry, nothing at runtime — the manager says so on screen, because an author would
  otherwise reasonably expect adding one to change play. What must reach the engine
  goes through the optional `variableId`. They do ride the transport, so an
  export/import round trip keeps them.

## Path notifications

`Path.notification` — the author's one line about a **transition**, set from the
Notification panel at the bottom of a path's properties and said in the story
stream as the path is crossed. The first item of section 7, and interface work
only: the field, its `format.ts` entry and its whole transport shipped unused in
section 3.

- **A notification hangs off a path because an event's prose cannot say it.**
  Several paths can lead into one event and each wants to say something different,
  which is the capability; typing it into the destination event would say it on
  every way in. It is the narrative twin of an effect — an effect changes state
  silently, a notification tells the player something changed — which is why the
  panel sits *below* Effects.
- **It is a line in the stream, not a toast, and that was a decision.**
  `DESIGN.md` §12 said "a transient line" and left the presentation open;
  `ROADMAP.md` proposed generalising the engine's `ErrorNotification`. That was
  rejected on evidence: `ErrorNotification` is gated behind `engine.isComposer` in
  `Renderer` and styled only in `engine-editor.less`, so a player in an exported
  PWA has never seen it, and the player-facing half would have been built from
  nothing. Reusing `EngineLiveEventData.messages` instead cost no engine state, no
  theme token and no dismissal rule.
- **`TRANSITION` is a message type of its own, and the reason is position, not
  provenance.** It first shipped as `NARRATION` on the argument that
  `ENGINE_LIVE_EVENT_MESSAGE_TYPE` draws a *reading* distinction rather than
  recording where a line came from — which was right, and then decided the
  question the other way once the reading was tried on a real storyworld. A
  transition is read **above** the arriving event's prose, where every other
  message is read below it, and `Event` cannot tell one from the other by
  position in `messages` alone once an object beat has been appended.
  - **Below the prose reported the journey from the far end of it.** The line is
    stored on the *destination* live event, so rendered after that event's prose
    an author who wanted "the butler says follow me" and then "the door closes
    behind you" had to hang the line on the path **arriving at** the butler's
    event — one path earlier than the transition it describes, which is where it
    reads wrong to write and wrong to find again later. Above the prose, the line
    belongs to the path *leaving* the event it follows, which is the same path the
    author is thinking about.
  - **It is styled exactly like a narration** — same italic, same opacity,
    `event-content-transition` only so the DOM says which it is. Its distinction
    is where it sits, which is a matter for the markup and not for a look of its
    own, so it costs no theme token and nothing in `engine-editor.less`.
  - **A live event saved before the member existed stores its notification as
    `NARRATION`** and goes on reading below the prose. Nothing migrates it: it is
    runtime state, not authored data, so this is visible only inside a
    playthrough already in progress and only for lines already in its history.
- **The text is resolved when the path is crossed and stored resolved.** Template
  expressions work, against the state the crossing *arrived* with — after the
  path's effects and the scene-scope reset, which is why `getPathNotification`
  takes the state as a parameter and why `LiveEvent` hoists it out of the
  `saveLiveEvent` call. Resolving at render instead would make a line already in
  the player's history restate itself with whatever the variable holds now, which
  for a log of what happened is simply wrong.
- **`processTemplateToText` exists because there is no DOM to put spans into.**
  `getProcessedTemplate` re-wraps every substitution in braces so `decorate` can
  find them, so `{ health }` over 40 comes back as `{40}`; the helper finishes what
  `decorate` does and stops before the markup, rendering an unresolvable expression
  as the same **ERROR** the prose shows rather than leaking the internal
  `esg-error`. `processTemplateBlock` moved from `EventContent` to
  `engine/src/lib/state.ts` to be shared — **not** into `templates.ts`, which
  exists twice, once per project, so anything added there has to be added twice.
- **An uncontrolled field in this panel needs a key *and* a freshness test.** This
  was wrong twice, both times caught by selecting a second edge and reading the
  field back rather than by reasoning about it. The field must be uncontrolled or
  each save re-renders it from the live query mid-typing and fights the caret — so
  it takes its text at mount and ignores the prop forever after. `PathProperties`
  is not remounted when the author selects another path, so unkeyed it showed path
  A's line while the debounced save wrote to path B. Keying on the path id was
  still not enough: `usePath` is a live query and hands back the *previous* path
  for a render or two, so the remount captured stale text that nothing then
  corrected. `path.id === pathId` is the test, and the field appears a beat after
  the rest of the panel rather than lying for a beat. `VariableDescription` escapes
  all of this only because the row that renders it is keyed on the variable and its
  data arrives with it.
- **`savePathNotification` is a targeted update, not `savePath` with a spread.**
  A debounced text field means the `Path` a component rendered with can be several
  keystrokes old, so the row is re-read inside the transaction — the same reason
  `saveVariableDescription` is written that way. An emptied field is stored as
  `undefined` rather than `''`, so clearing it reverts the path to silent *and*
  stops it being exported; Dexie's `update` does delete the property, which was
  verified against the database rather than assumed.
- **Nothing about it needed a migration or a transport change**, which is worth
  knowing before assuming the next presentation field will: section 3 already put
  `notification` in `data/types.ts`, `format.ts`, `getWorldDataJSON`,
  `importWorldData`, `transport/types/0.8.0.ts` and `schema/0.8.0.json`. The last
  is the one that fails loudly — `additionalProperties: false` there turns an
  unnamed exported field into a file the app refuses to import.

- **The scene map says which paths speak.** A path's edge label grew a third cell
  — green, with a dot — that exists *only* when the path carries a notification,
  and the whole label carries the line as an SVG `<title>` so hovering it reads
  the text without opening the path. Three things about it:
  - **A marker present on every edge marks nothing**, which is why this cell is
    absent rather than reading `-` like the two counts beside it. It is an
    overview marker, not a count, and there is only ever one notification per
    path — hence a dot, and a *shape* rather than a fourth colour to tell apart.
  - **`notification` rides on `PathEdgeData`** instead of a per-edge live query
    like `usePathConditionsCountByPathRef`. The elements effect already depends
    on `paths`, so a saved notification rebuilds the edges either way; a third
    live query per edge would only add to what that rebuild costs.
  - **Each label's `clipPath` now has an id derived from the path id**, and that
    was a latent bug rather than tidiness: an SVG id is document-global, all 28
    labels declared `id="round-corner"`, and every one of them was clipped by
    whichever def the document resolved first. Invisible while the labels were
    all the same width, and *not* invisible the moment one is 11px wider — the
    new cell would have been clipped off on some maps and not others.
  Whitespace-only text does not mark the edge, because
  `getPathNotification` drops a notification whose resolved text is blank. Read
  live on the imported world's 27-node scene: 28 unique clip ids, one dot, one
  title, `30.97` against `19.97` label widths, and the dot appearing and
  disappearing as the field was typed into and cleared.

`src/__tests__/pathNotification.test.ts` covers the resolution, including that a
NUMBER holding `0` survives (the falsy-substitution trap) and that `esg-error`
never reaches the reader. It also records, rather than fixes, that an empty STRING
resolves to the literal word "undefined": that is `getProcessedTemplate`'s
identifier branch (`value || 'undefined'`), it has been true of event prose since
0.7.0, and changing it means changing `templates.ts` in both projects and every
storyworld's prose along with it.

## How a set of choices is offered

`World.choicePresentation` is the storyworld's default and `Event.choicePresentation`
overrides it per event, both set from a **Choices** panel — the storyworld's
properties for the default, a CHOICE event's properties for the override.
`resolveChoicePresentation` is the rule and `src/__tests__/choicePresentation.test.ts`
holds it. The last of section 7's three cheap items; both fields shipped unused in
section 3, so this was interface work with no schema cost.

- **`CHOICE_PRESENTATION.INLINE` is not the inline choices feature**, and this is the
  likeliest confusion in the whole area — they share a word and mean different
  things. INLINE is per *event* and lays the whole set out as a wrapping row instead
  of a stack. An inline *choice* is per choice and lives inside a sentence, placed by
  the author as a node in the prose. An enum could never express the second: which
  words in which sentence a choice attaches to is not derivable from a setting. The
  editor labels this one **Row** for that reason, and the panel hint says outright
  what it is not.
- **LIST is the fallback rather than a stored default.** Neither field is written as
  LIST unless an author picks it, so a storyworld written before either existed
  presents exactly as it always did, and "Storyworld default" on an event stores
  `undefined`. LIST is still a real member because an author with a MODAL storyworld
  needs a way to say "not this event".
- **`choicePresentation` had to be added to `Installer`'s `WORLD_INFO_FIELDS`.**
  `format.ts` already compiled it, which is exactly the trap that section warns
  about: the field arrives in the engine's data and still never reaches a component,
  because `worldInfo` is built from its own `pick` list. Without it every world
  silently falls back to LIST and the storyworld setting appears to do nothing.
- **"The player is on this event" is `!liveEvent.result`, not
  `engine.currentLiveEvent === liveEvent.id`.** Both are true in ordinary play, since
  every event behind the newest carries the result that led out of it — but the
  engine's pointer lags a reinstall, and the composer reinstalls on every open. Read
  off the running app: with the preview already sitting on an event, setting that
  event to MODAL left the choices in the column and they only became a modal after
  playing away and back. An author changing a setting has to see it change.
- **An ending is never a modal.** Its choices are Restart and Title Screen — the way
  out of the story rather than a decision inside it, and a modal over the last page
  is a door in front of the exit.
- **The modal is portalled to `#renderer`, and that was measured.** Left where it is
  declared, `position: absolute` resolves against `.event-content` — every ancestor
  up to the stream is `position: relative` — so it covered only the current event's
  own block, 229px of a 1046px column, and grew and shrank with the prose.
  `#renderer` is the reading area and sits *outside* `#live-event-stream`, the scroll
  container, so the overlay also stays put rather than scrolling away with the story
  behind it. It is not `position: fixed` because this engine renders inside a dock
  panel in the composer as well as full-window in an export, and a fixed overlay
  would sit over the storyworld outline.
- **It is an overlay rather than a `<dialog>`**, which would have brought the focus
  trap and Escape for free. `showModal()` on a nested dialog puts it in the top
  layer, above the object rail and outside the engine's box, and it is one more
  thing to get wrong across the browsers an exported PWA meets. Escape and
  backdrop-dismissal are written out instead.
- **Dismissable, so it needed two words of its own.**
  `STREAM_CHOICES_OPEN` ("Choose") and `STREAM_CHOICES_CLOSE` ("Close") are the only
  new interface text: a modal the player cannot dismiss cannot be read around, and
  one that dismisses with no way back is a dead end. Adding a key costs
  `interfaceText.ts` alone — the manager is generated from it — and
  `interfaceText.test.ts` fails if a key has no English or no group.
- **INLINE's stylesheet undoes the stack's rules, each of which is load-bearing
  above it**: the full-width button, the rule across the top of every choice, and the
  grid that puts one per row. A row separated by per-choice rules would draw a line
  through the middle of a line of text, so the row carries one rule above the whole
  of it instead.
- **The override is offered on CHOICE events only.** An INPUT event has a field
  rather than a set and a JUMP has neither, so the setting would be stored and never
  read. Nothing stops it being set — it is a plain optional field — but a control
  that does nothing is worse than an absent one.

## Inline choices

A choice offered inside the prose instead of in the list beneath it — `/` →
**Inline Choice** in the event content editor. The second item of section 7, and
`DESIGN.md` §12 was right that it costs no schema: the node is a void
`ELEMENT_FORMATS.CHOICE` carrying a `choice_id`, exactly as the image node carries
an `asset_id`, and the choice stays a row in `choices` where the paths already
point at it.

- **The prose owns nothing, which is why the bookkeeping §12 called for was not
  needed.** Both `DESIGN.md` §12 and `TODO.md` §7 said `lib/contentEditor` would
  have to diff choice nodes against `Event.choices` the way it diffs images
  against `Event.images`, "or a deleted node leaves an orphaned choice". Deleting
  the node **un-inlines** instead: the row stays in `choices`, its id stays in
  `Event.choices`, the list beneath the prose offers it again and its paths still
  lead somewhere. An orphan is a choice nothing points at, and nothing here stops
  pointing at it. `src/__tests__/inlineChoices.test.ts` records that reasoning.
- **The clickable text is the choice's own `title`.** One source of truth, so the
  sentence, the choice list and the scene map cannot disagree; the chip in the
  editor renames it in place through the same `saveChoice` the scene map's choice
  row uses, because sending an author to the map to name what they are in the
  middle of writing makes the sentence unwriteable in one pass.
- **Inserting writes nothing; the picker does.** `/` → Inline Choice drops an
  *unassigned* node, exactly as a character reference is inserted, and
  `Tools/ChoiceElementSelect` then points it at a choice. That ordering is what the
  common case needs: an inline choice is most often an **existing** choice being
  moved out of the list and into the sentence for the reading flow, and creating one
  on insert would leave a stray behind every time. Creating is the menu's last
  entry, and it makes the same two writes `EventNode`'s add-choice button does — the
  ref on the event, then the row — setting the node only after both, since an id in
  the document naming a row that failed to save is the one state with no way back.
- **The picker offers only choices not already in the prose**, excluding the one the
  node itself holds. A choice mentioned twice would give the player two ways to take
  one path and the author no way to tell the mentions apart.
  `getInlinedChoiceIdsFromEventContent` reads the **live document** rather than the
  saved `Event.content`, which is up to a debounce behind while the author types.
- **Re-pointing is how a choice moves back to the list.** Pointing the node at
  another choice un-inlines the previous one, which then reappears beneath the prose
  with its paths intact — verified by reading the database and the preview after the
  swap, not by reasoning about it. "Remove from the text" does the same and leaves
  the node's choice alone.
- **The picker's overlay is a `Menu`**, because an antd `Dropdown` whose overlay is
  not one does not dismiss when an entry is clicked (bug class 3), and
  `.choiceSelectMenu` is declared at the **top level** of the stylesheet because the
  overlay portals to `document.body`.
- **`getChoiceIdsFromEventContent` reads two formats, and that is the whole trap.**
  `Event.content` is the Slate document in the composer and the HTML
  `eventContentToHTML` baked at export time in a shipped world. A character
  reference is resolved to its name by that bake; **a choice must not be**, because
  whether its path is open depends on the state the player arrives with — so it
  survives as the same placeholder span and `EventContent` makes it clickable at
  runtime. Miss the second format and every export offers an inlined choice twice,
  once in the sentence and once in the list.
- **The engine's player branch of `EventContent` had no `replace` map at all** until
  this, because nothing before needed one: the baked HTML was already final. It has
  one now, and it is the half of the feature that fails only when someone actually
  exports.
- **Filtering the list needed a guard against looking like a dead end.**
  `EventChoices` renders a **Return** button when an event has no choices and no
  passthrough, and an event whose choices have all moved into its sentences looks
  exactly like that from the list's side. `openInlineChoiceCount` is why it does
  not — and it counts only *open* ones, because a shut inline choice renders as
  plain prose and the event really is a dead end.
- **Three states, one of them clickable**, and all three are inline text. Closed
  and already-taken read as the prose around them, since a dead link asks the
  player to try something that cannot happen. The underline on the open state is
  not decoration — WCAG 1.4.1, and this text sits mid-paragraph with no second
  example to compare against.
- **It is a `<span role="button">` and not a `<button>`, which was measured rather
  than preferred.** Chromium refuses `display: inline` on a button and blockifies
  it to `inline-block`, so a title of more than a word or two cannot break across a
  line and overflows the reading column; and the engine's base `button` rule sets
  `min-height: 44px`, which inflates every 28px line box a choice sits in. Both
  were read off the running app. `tabIndex` and an `onKeyDown` answering Enter and
  Space give back the two things the button was providing.
- **`EventContent` holds its parsed content in state, so `liveEvent` and
  `onSubmitPath` are dependencies of the effect that builds it.** The
  `EventInlineChoice` elements capture whatever those were when it last ran, and a
  captured live event is a stale one: its `result` decides whether the choice is
  still clickable and its `state` whether the path is open. Same staleness that
  made the passthrough arrow fire a pre-take closure.
- **A node can outlive its choice, and is not repaired.** Deleting a choice from
  the scene map does not reach into the document that mentions it: rewriting
  content from outside would be overwritten by an open content editor's next
  debounced save, which is the same reason the asset manager refuses to clear an
  event image reference. The chip says the choice is gone, the engine offers
  nothing to click, and the author deletes the node.
- **Known and not fixed: the scene map node preview keeps the old title until the
  content changes.** `EventSnippet` serializes the choice's title into the snippet,
  and a rename writes to `choices` rather than to `Event.content`, so nothing
  invalidates it. The chip and the node's own choice row both update immediately.

## Interface text

Every word the storyteller says that an author did not write — 43 of them, from the
object rail's "Take" to the settings panel's "Motion". `engine/src/lib/interfaceText.ts`
is **the** declaration of the keys, their English and their grouping; the editor's
`components/InterfaceTextManager` is generated from it and needs no edit when a key
is added. It opens from **Interface Text** in the storyworld outline's title bar.

- **It is per storyworld and there is no language picker.** The prose cannot be
  switched at runtime — it *is* the storyworld — so a picker would put German chrome
  around English prose. An author writing in two languages writes two storyworlds.
- **A new field has to be named in five places, and four of them fail silently.**
  `compiler/format.ts` (what the engine can see), `Installer`'s
  `WORLD_INFO_FIELDS` (what the runtime receives), `getWorldDataJSON` (export),
  `importWorldData` (import), and `transport/schema/0.8.0.json`, whose `_` block is
  `additionalProperties: false`. Only the last one produces an error, and it produces
  it at the worst moment: the app refuses to import its own export.
- **`worldInfo` has two writers and one field list, and the list is why.** They were
  two hand-written `pick`s, and the install path did not even use one — it dispatched
  the **raw world record**. A world row in the editor's database carries no
  `studioId` of its own, since the id is in the database name, so a re-install over a
  *playing* preview replaced a good `worldInfo` with one whose `studioId` was
  `undefined`. Nothing threw: `LiveEventStream` destructures `studioId` off
  `worldInfo` and guards on it before refilling the stream, so the stream was simply
  never refilled and the preview went on rendering live events whose records
  `resetWorld` had just deleted. That is the blank storyteller behind **RESET, and
  the "On world start jump has changed." notice, appearing to do nothing** — and it
  could not recover, because `lastDispatched` then compared an unchanged world and
  declined to send the repaired copy. Restarting the app was the only way out. The
  branch runs only when `engine.playing`, which is why first open was always fine.
- **`Installer` reads the world through a live query now, and that was a fix.** It
  ran once on `[engine.installed]`, which is right for a PWA and wrong in the
  composer, where the author is editing the record it read. Translating a word and
  watching the preview go on saying "Take" was the visible half; the storyworld
  title, description and copyright in the settings panel had been equally stale
  since before this. It dispatches only when the serialized info actually differs,
  because Dexie re-runs a live query on any write to the table — including to a
  different world — and does not compare what it hands back.
- **Blank means "use the English", which is why `pruneInterfaceText` exists.** It is
  called on save rather than on edit, and drops both blanks and overrides that merely
  repeat the English, so clearing a field reverts the word *and* stops it being
  exported. An empty map is stored as `undefined` rather than `{}`.
- **`Yes` and `No` are also written into the save** as the answer the player gave,
  which is what they have always been. Translating them translates what new saves
  record; an older save keeps the word it was played with.
- **Only the object rail and the stream are reachable from the composer preview.**
  The title card, the settings panel and the update notifications render in an
  exported PWA only, so those 29 strings are covered by the key-coverage test rather
  than by eye.

## The storyworld map

`components/StoryworldMap`, opened from the node button in the storyworld
outline's title bar. Scenes as nodes, jumps between them as edges, folder path
and element count on each node, and clicking one opens that scene.

- **The graph is inferred, not stored**, which is why `lib/storyworldMap.ts` is a
  pure module with tests: a jump's origin is the scene it happens to sit in
  (`Jump.sceneId`) and its destination the first element of its `path`. Getting
  that inference wrong produces a map that looks authoritative and is quietly
  missing connections.
- **A scene is only ever reached by a jump.** A `Path` joins two events inside
  one scene, so nothing crosses a scene boundary except a `Jump`. That is what
  makes "no way in" a fact the map can state rather than a guess.
- **Three kinds of jump are deliberately not edges**: one with no `sceneId` has
  no origin to draw from (the storyworld's opening jump is the ordinary
  example, and it marks its destination as the start instead); one whose
  destination is unset or deleted is dangling; and one leading back into its own
  scene would be a zero-length self-loop in react-flow 9, so it is counted on the
  node. Jumps leading the same way collapse into one edge carrying the count.
- **It is laid out on every open and never stored.** The map is derived, so there
  is no authored position to remember and nothing to drift. It reuses
  `layoutSceneMap`, which is deterministic, so the same storyworld draws the same
  way every time — that is what makes an unremembered layout tolerable. It also
  keeps the feature clear of a schema change: `Element.composer` has
  `sceneMapPosX/Y`, but those mean "position in the SceneMap" and reusing them
  here would be a lie.
- **Scene nodes are a fixed size**, so the layout is handed the same numbers the
  stylesheet uses rather than measuring the DOM as the scene map has to. Keep
  `SCENE_NODE_WIDTH`/`SCENE_NODE_HEIGHT` and the stylesheet in step, or nodes
  overlap.
- `.SceneNode` is declared at the top level of the stylesheet, not nested inside
  `.StoryworldMap`: react-flow renders nodes into its own container, and CSS
  modules hash the class name without rewriting the selector's structure.

## Scene map auto layout

**Auto Layout** in the scene map's toolbar arranges the whole scene, and **Undo
Auto Layout (n)** beside it puts it back. `lib/sceneMapLayout.ts` is the model
and is **pure**, like `sceneMapClipboard`, with `src/__tests__/sceneMapLayout.test.ts`
covering the geometry — a layout that is subtly wrong draws plausibly and shows
up only in numbers.

- **react-flow-renderer 9 has no layout**, so this wraps `@dagrejs/dagre`. It is
  a plain graph library with no React peer dependency, which is what makes it
  safe against the React 17 pin, and it ships its own types.
- **dagre reports centres, react-flow wants top-left corners**, and each node's
  own *measured* size is what converts between them. Measured, not assumed: an
  event node's height varies with its choices, its character references and
  whether it is an input, so laying out against `DEFAULT_NODE_SIZE` overlaps the
  tall ones. The sizes come from the react-flow store's `__rf`, which is why the
  command is performed by the map rather than by the toolbar that asks for it —
  the same split as the clipboard.
- **The result is anchored to where the scene already was**, not to (0, 0).
  `sceneMapLayoutOrigin` takes the top-left of the current positions and the
  layout is translated onto it, so the author is not left looking at empty canvas
  with their scene somewhere off screen.
- **Nodes are sorted and edges deduplicated before dagre sees them.** dagre
  iterates its own insertion order, so without this two runs over one scene
  disagree. Self-edges are dropped — a choice looping back to its own event
  constrains nothing. With this, a second run over an already-laid-out scene
  moves nothing and leaves the existing undo intact.
- **The undo payload names its scene**, for the same reason the clipboard names
  its world: `ComposerContext` is shared by every open scene tab and rc-dock
  keeps them all mounted. The toolbar only offers the undo when the payload
  belongs to the scene the outline has selected.
- **`Promise.all` over the position writes is safe here**, unlike a multi-element
  cut: these are writes to distinct event and jump records, not repeated
  read-modify-write cycles over the single `Scene.children` array.

## The scene map's viewport, and how it used to stall

The per-gesture stall is fixed; `TODO.md`'s "Why the scene map stalled while you
moved it" holds the measurements. Four things there are load-bearing and easy to
undo by accident.

- **A live query dependency must name the field, not the record.** `useScene` is a
  Dexie live query, so *any* write to the scene hands back a new object.
  `saveSceneViewTransform` writes on every pan and zoom, so listing `scene` in the
  elements effect's dependencies rebuilt all 27 nodes and 27 edges per wheel tick —
  write → invalidate → rebuild. It depends on `scene?.id`, which is the only field
  it reads. The same trap is available anywhere a `use*` hook's whole result lands
  in a dependency array.
- **Two viewport values are debounced, and one of them must still be flushed.**
  The transform write (500ms) is flushed from the unmount cleanup, because losing
  it means a scene reopens somewhere the author did not leave it. The
  `SCENE_MAP_SELECT_CENTER` dispatch (250ms) is *dropped* on unmount instead —
  dispatching into a context from an unmounting component would land on a scene
  that is no longer open. Both compute their value when the timer fires rather
  than when it is scheduled, so a deferred value reflects where the viewport came
  to rest.
- **`selectedSceneMapCenter` is context state that nothing renders from.** All
  four readers take it inside an event handler, to place a new element at the
  middle of the view. That is what makes debouncing it safe, and it is why
  dispatching it per tick was expensive: `ComposerContext` has 29 consumers, so
  each dispatch re-rendered the storyworld outline and the inspector. **Its cost
  scales with how much of the outline is expanded** — ~300ms of long tasks per
  zoom with five rows open, ~2600ms with seventy — so any measurement here has to
  state the outline state or it is not reproducible.
- **`onlyRenderVisibleElements` must stay `false`.** In react-flow-renderer 9 it
  permanently drops nodes: this scene went from 27 nodes to 16, and the missing
  ones did not return on zoom-out or fit-view, because a node that has never
  rendered has no measured dimensions and so never passes the visibility test. It
  looks like a free win and is a correctness bug.

`highlightElements` copies an element only when that element's own `className` or
`data.selectedChoice` changes. It used to `cloneDeep` the whole array, which gave
every node a new identity and defeated `memo()` on `EventNode`. If you touch it,
note that its two `map`s over the selection are order-dependent by design — for an
edge between two selected nodes, the last match wins.

Two unrelated things that surface while working here and are **not** regressions:
`react-flow` logs `couldn't create edge for source handle id: null` and renders 26
of 27 edges on this scene, which is the authors' own
`BUG: Unable to create edges on initial node render because choices aren't ready`;
and `npm run dev` keeps warning `Could not Fast Refresh ("DEFAULT_NODE_SIZE" export
is incompatible)` because the module exports both a component and an enum, so
editing it forces a full reload rather than a hot update.

## Distraction-free mode

`Ctrl/Cmd+Shift+F`, or the button in the content editor's header, leaves the
writing column alone on an empty field: the storyworld outline, the element
inspector, the dock tab bar and the per-tab toolbar all go. The title bar stays,
because on a frameless window it is the only quit and minimize and it carries the
UI size picker.

- **The state lives in `ComposerContext`, not in the content editor**, because
  the chrome it hides belongs to the Composer route two levels above
  `EventContent`, which the SceneMap mounts.
- **It is two booleans, and the difference matters.** `active` is what the layout
  reads and is true only while a content editor is open; `preferred` outlives the
  editor. `EventContent` reports `CONTENT_EDITOR_OPENED` and
  `CONTENT_EDITOR_CLOSED` on mount and unmount, so closing an event brings the
  chrome back rather than leaving an author with no panels and nothing to write
  in, while the next event opens straight back into the mode. Neither is
  persisted; a restart starts with the full chrome.
- **The two exits are deliberately not the same.**
  `TOGGLE_DISTRACTION_FREE_MODE` (the button and the shortcut) sets both, so
  switching the mode off means the next event keeps its chrome.
  `EXIT_DISTRACTION_FREE_MODE` (escape) clears only `active`, so escaping out and
  opening the next event writes distraction-free again. Escape steps out one
  layer at a time — command menu, then the mode, then the editor — so one press
  never discards two things. Getting these backwards makes the mode either
  impossible to stay in or impossible to leave, which is what
  `src/__tests__/distractionFreeMode.test.ts` is for; `composerReducer` and
  `defaultComposerState` are exported for it.
- **Hidden with CSS, not by unmounting.** Dropping the panels from the
  `DividerBox` would discard the outline's tree and the properties form and
  rebuild the inspector's own `DockLayout` on every toggle. Both side panels are
  pinned to 300px, so `display: none` is enough for the editor between them to
  take the space. rc-dock also renders a divider between each pair of children,
  which is why `.distractionFree > .dock-divider` is scoped to direct children —
  the dividers inside the editor's own docks must stay.
- **Three stylesheets, because CSS module class names are not addressable across
  modules.** The route hides the side panels, the dividers and `.dock-bar`;
  `TabContent` hides its own toolbar *and* moves `.TabContentView` to `top: 0`,
  since the view is positioned against the toolbar's 32px rather than laid out
  after it; `EventContent` drops its `hsla(0, 0%, 1%, 0.9)` overlay to fully
  opaque. That last one is not cosmetic — at 0.9 alpha the scene map, its zoom
  controls and its minimap stay legible behind the writing column, which is
  exactly what the mode is meant to remove. The DOM measurements all looked
  correct while this was still visible; only a screenshot showed it.
- **`TabContent` now reads `ComposerContext`**, which it did not before.

## The content editor follows the outline's selection

Selecting another event in the storyworld outline while a content editor is open
moves the editor to it, not just the element inspector. The SceneMap effect that
watches `editorTab.eventForEditing` re-dispatches `EDIT_EVENT` with
`composer.selectedSceneMapEvent`.

- **`EventContent` is keyed on the event id.** slate-react 0.72 takes `value` as
  the *initial* document and thereafter owns `editor.children`, so handing the
  same editor a new `eventId` changed the header and left the prose behind.
- **That was data loss, not just a confusing display.** The stale document stayed
  in the editor while `debounceSaveContent` closed over the *new* `eventId`, so
  the next change — a selection change counts — wrote the previous event's
  content over the newly selected one. Two events in the imported test world were
  overwritten this way before it was found. Remounting is what makes the write
  impossible, because the editor never holds a document belonging to another
  event.
- **Only a non-null selection is followed.** `WorldOutline`'s `onSelect`
  dispatches `null` and then the new id a tick apart (the `stack hack`, #132), so
  treating `null` as "nothing selected" closes the editor mid-gesture and never
  reopens it.
- **The debounced save is flushed on unmount.** It is 1000ms, so closing or
  switching used to discard anything typed since the timer last fired. `flush()`
  invokes it with the arguments it was last called with, which name the event
  being left.
- **The header bar in the content editor was restored, not invented.** The
  authors left `.eventTitle` commented out. It carries the scene and event title —
  which the overlay otherwise hides — and the mode's only visible way in and out,
  since the View menu holding the shortcut is never rendered.

## UI scale

The editor's type is small by default — 50 declarations at 12px and another 28
below that before the sub-12px ones in the authoring panels were lifted to 12 and
13. The **UI Size** picker in the title bar (the `Aa` button, beside Help) is the
answer to that, offering Small through Huge as Chromium zoom factors.

- **It is a zoom factor, not a font-size variable.** Most of the type in this UI
  is sized by `antd/dist/antd.dark.less`, which is resolved at build time into
  absolute pixels, so nothing declared at runtime reaches it. A `--ui-scale`
  custom property would scale the app's own 125 declarations and leave every antd
  control behind. `webFrame.setZoomFactor` scales both.
- **The renderer owns the preference.** `lib/uiScale.ts` holds the step list,
  snaps and clamps to it, and reads and writes the `esg-ui-scale` localStorage
  key. `AppContext` carries it as `uiScale` and `App.tsx` has the single effect
  that applies and stores it, whichever surface changed it. `index.tsx` applies
  the stored value before the first render, so the window does not paint at one
  size and jump to another.
- **The View menu's accelerators (`Ctrl+Alt+=`, `-`, `0`, from
  elmstorygames/feedback#284) no longer set the zoom themselves.** `menu.ts` sends
  `WINDOW_EVENT_TYPE.ZOOM_UI` with a `ZOOM_UI_TYPE`, and the renderer steps its
  own scale, so the keyboard and the picker cannot report different sizes and a
  step is persisted like any other. The window is frameless, so that menu is
  never rendered — the picker's footer is the only place those accelerators are
  written down.
- **`TitleBarButton` is a `forwardRef` component for the picker's sake.** antd's
  Dropdown clones its child to attach a ref and its own handlers, and a plain
  function component would take neither. The overlay also portals to
  `document.body`, so `.uiScaleMenu` is declared at the top level of
  `TitleBar/styles.module.less` rather than nested inside `.titleBar`: CSS modules
  hash the class name but do not rewrite the selector's structure.
- **The drag region's width is derived from the button count.** Both it and the
  button container are absolutely positioned, so `TITLE_BAR_BUTTON_WIDTH` and
  `TITLE_BAR_BUTTONS_OFFSET` in `TitleBar/index.tsx` mirror the stylesheet. The
  hardcoded `103px` was for four buttons; a fifth would have sat under the drag
  region and stopped responding to clicks. Adding a sixth needs nothing beyond
  the array. The same rewrite replaced the index comparisons that hid Minimize in
  fullscreen (`index !== 1` on macOS, `index !== 2` elsewhere, because the array
  is mirrored) with a check on the type, which no longer breaks when the order
  changes.
- **The storyworld outline's title bar had the same bug and was fixed the other
  way.** `WorldOutline/TitleBar` reserved room for its tools with the title's
  `right: 104px` and a comment reading "four 26px buttons wide", so adding the
  objects button put a long storyworld name underneath the icons. Rather than
  bumping the number again, the tools moved to **a row of their own beneath the
  title**: the title now takes the width it has and the action row wraps if it
  ever outgrows one line, so a sixth tool costs nothing and no arithmetic can
  drift. `@outline-row-height` in the stylesheet is shared by both rows and by
  `.tree`'s absolute `top`, which is the one number that still has to be derived
  rather than laid out. Verified live rather than from the stylesheet: with the
  imported world's 38-character name the title row measures 29–299px untruncated
  and every button sits on the row below it.
- **SceneMap's four 10px sizes were left alone**, along with the character mask
  caption, because those sit in fixed-width nodes and 76px tiles where larger
  type overflows rather than reflows. The zoom covers them.

## Do not upgrade React

The renderer is on **React 17** deliberately. `antd` 4, `rc-dock` 3,
`react-flow-renderer` 9, `react-beautiful-dnd` 13, `slate` 0.72, `react-query` 3
and `react-router-dom` 5 each need a breaking migration, and `antd` 4 to 5 alone
means replacing Less with CSS-in-JS across 68 stylesheets. Everything is pinned
to the newest release inside its current major, so those upgrades are
individually pickable. Packages whose next major needs React 18 are held at
their latest React-17-compatible release.

`dexie` stays on 3.x. The engine carries five versioned IndexedDB migrations
(`engine/src/lib/db/v6`–`v10`) and Dexie 4 changes transaction semantics;
upgrading risks existing user data.

`.npmrc` sets `legacy-peer-deps` because no `@atlaskit/tree` release targets
React 17 (v8 declares `^16.8.0`, v9 declares `^18.2.0`).

**Never run `npm audit fix --force`.** Every fix it proposes here is a
downgrade (`electron-builder` to 22, `react-query` to 3.10, `copyfiles` to 1.0).
The 19 reported vulnerabilities are 3 distinct advisories fanned out
transitively.

## Debug by reading the DOM, not by inferring

`npm run dev:debug` exposes the DevTools protocol on port 9222.

```bash
curl -s http://localhost:9222/json | grep webSocketDebuggerUrl
```

A WebSocket client can then use `Runtime.evaluate` for computed styles and
ancestor walks, `Input.dispatchMouseEvent` for clicks and hovers with real user
activation (`element.click()` does not provide it, and file inputs require it),
and `Page.captureScreenshot` to capture the window regardless of which desktop
window is in front.

**This is not optional advice.** Two styling bugs here were misdiagnosed by
sampling pixel luminance from screenshots, because a bright emoji or icon inside
the sampled region is indistinguishable from bright text. One query for a
computed `color` settled in seconds what two rounds of pixel measurement got
wrong. When a harness disagrees with the running app, believe the app.

### Reaching the interesting screens

The app opens on the dashboard with nothing selected. To get to the Composer:

1. **Select studio…** → **Ravetracer**
2. Click the storyworld (**Archiv der Erinnerungen**)
3. Click the first entry in the left-hand outline

**There are two studios and they are not interchangeable.** Ravetracer's world has
one scene and two events, which is fine for a quick look and useless for anything
about scale or performance. The imported December 2022 export lives under **Indie**
as **Das Archiv der Erinnerungen (Imported)** — 14 scenes, 74 events, 113 paths,
27 jumps — and its *Fr. Wittgenstein* scene is the largest at 27 nodes and 27
edges. Use that one, and note the outline's scene rows carry a `partition` icon
while event rows carry `align-left`, which is how to tell them apart when two share
a title.

Faster than clicking when you only need to know what is in there: read the
`esg-library-<studioId>` IndexedDB databases directly with `eval.mjs` and an
`indexedDB.databases()` walk. The studio id is in the database name.

That last click lands on a SceneMap with event nodes, which is where rc-dock,
react-flow-renderer and slate are all exercised at once. Characters open as a
modal from the bottom-left panel; character mask images are changed by
**right-clicking** a mask tile, not from a visible button.

`element.click()` from `Runtime.evaluate` is enough for most of this.
`Input.dispatchMouseEvent` is needed wherever user activation matters, which
includes anything that ends in a file picker.

## Bug classes that have already bitten

Most breakage since the revival is one of these five. Check them first.

**1. rc-dock's light-theme colour leaking in.** `rc-dock.css` sets
`.dock-panel { color: rgba(0, 0, 0, 0.85) }`. Anything inside a dock panel that
does not set its own colour inherits black against this dark UI. It has caused
this four times already:

| symptom | fixed in |
| --- | --- |
| invisible storyteller body copy | `#runtime` colour in `engine-editor.less` |
| invisible inactive dock tab labels | `routes/Composer/styles.module.less` |
| invisible SceneMap event node previews | `.EventSnippet` in `SceneMap/styles.module.less` |
| invisible event content while editing | `.EventContent` in `EventContent/styles.module.less` |

Headings often escape because antd's dark theme colours `h1`–`h6` explicitly,
which makes the symptom masquerade as a heading-versus-paragraph problem. It bites
hardest where the markup is generated without classes, as `lib/serialization.ts`
does for node previews. **A black-on-black report is probably this**: check the
computed `color` and walk the ancestor chain to find where it turns black.

**2. antd 4 class components that became forwardRef components.** `Input` was a
class holding `state.focused`; it is now built on `rc-input` and its ref exposes
`focus()`, `blur()`, `select()` and `input`, with no `state`. Reading
`ref.current?.state.focused` threw inside an effect and unmounted the whole
Variables panel, which presented as a blank screen. Note `Input` wants an
`InputRef` while `InputNumber` wants a `Ref<HTMLInputElement>`; a single ref
cannot serve both. `useRef<Input>` anywhere is a leftover from the class era; the
three that remained are now `useRef<InputRef>`. Mind that `InputRef.input` is
`HTMLInputElement | null`, so `ref.current?.input.value` needs the second `?.`.

**3. `electron-context-menu` preempting the app's own menus.** Four surfaces use
antd `Dropdown` with `trigger={['contextMenu']}`: `WorldOutline/ContextMenu.tsx`,
`CharacterManager/CharacterMask.tsx`, `ElementEditor/SceneMap/EventNode.tsx`,
`EventContent/Tools/CharacterElementSelect.tsx`. The native menu only appears
when it has applicable entries, so anything that adds a default entry makes it
appear everywhere and swallow those right-click menus. That is why
`showSelectAll: false` is set in `src/main.ts`; without it, adding a character
image silently does nothing.

**A `Dropdown` whose overlay is not a `Menu` does not close when an entry is
clicked**, and antd puts a dropdown at z-index 1050 against a modal's 1000 — so
a lingering menu covers anything the entry opened. Three of those four surfaces
pass a `Menu`, which antd dismisses for them. `CharacterMask` passes a custom
`div` (the mask preview and its buttons), so it is controlled through
`detailsVisible` and every entry dismisses it before acting. Anything else that
opens a modal from a non-`Menu` overlay needs the same.

**4. Asset URLs.** User assets live under `userData`, outside the bundle. The
renderer is served over **http** in development and loaded from **file://** when
packaged, so a filesystem path cannot be used as a URL. `GET_ASSET` returns an
`esg-asset://` URL served by `protocol.handle` in `src/main.ts`. If images go
blank, check the computed `background-image`: a `http://localhost:5173/home/...`
value means something reintroduced a raw path.

That handler also honours byte ranges, which is not decoration: **media served
without `Accept-Ranges`, `Content-Length` and a 206 for `Range` requests is not
seekable.** Chromium treats it as a stream of unknown length, `seekable` comes
back empty and assigning to an `<audio>` element's `currentTime` silently does
nothing, which is how imported MP3s came to play but refuse to scrub. `net.fetch`
does forward a `range` header to `file://`, so the slicing is delegated to it.
Verify with a `fetch(url, { headers: { Range: 'bytes=0-99' } })` from the
renderer and check for a 206 with 100 bytes, not by listening.

**5. The shared AudioContext going silent.** Chromium suspends it on its own,
under the autoplay policy and whenever the renderer is backgrounded or the
preview sits behind another dock tab. Howler tracks only its own `Howler.state`
and never observes the context, so the two desync; because
`Howler._autoResume()` resumes only when `Howler.state` itself reads
`'suspended'`, that desync is permanent. The tell is that `play()` succeeds and
`playing()` returns **true** while `seek()` stays at **0** — gain ramps scheduled
by `fade()` are pinned to a clock that never advances. `useAudioMixer.ts` mirrors
the context's state onto Howler, disables Howler's idle suspension and awaits a
resume before any play or fade. Diagnose it by reading
`Howler.state`, `Howler.ctx.state` and `_howls[0].seek()` together; either one
alone is misleading. Note also that the preview's mute defaults to **on**
(`devTools.muted`), which is a far more common reason for hearing nothing.

## Resuming a storyworld

A playthrough saves and resumes on its own, and there is deliberately no save/load
feature — `TODO.md` section 5 is obsolete rather than pending. One bookmark per
storyworld, `___auto___<worldId>`, is rewritten on **every** live event, and a live
event carries the full variable state, the object deltas and the object messages,
so resuming one resumes everything. The title card reads the bookmark and offers
Continue instead of Start. Verified in an exported PWA, which is the only place it
can be: the composer preview reinstalls on open.

Two repair paths make it survive an author still working on the world, and both are
easy to break by accident:

- `findLiveEventFromBookmarkWithExistingDestination` walks backwards when a bookmark
  points at an event that has since been deleted.
- `updateEngineDefaultWorldCollectionData` carries a save across a **version bump**,
  copying the bookmarked live event forward under the new version with variables
  reconciled and deltas for deleted objects pruned. `getRecentLiveEvents` filters on
  `version`, so without this every existing player's stream would vanish on update.

**The stream is not assembled by walking the chain.** `getRecentLiveEvents` queries
`[worldId+updated]` — the world's most recently updated live events — and slices
around the current one; nothing reads `next` at all. Anything that puts two
independent playthroughs in one world would see them interleave.

## The PWA export contract

`src/main.ts` post-processes the built engine when exporting a storyworld. It is
coupled to the engine's build output in ways that break quietly:

- It reads `manifest.json` from the output root, so `build.manifest` is pinned to
  that filename in `engine/vite.config.mts`. Vite would otherwise emit
  `.vite/manifest.json`.
- It string-replaces `___worldTitle___`, `___worldDescription___`,
  `___worldId___` and `"___storytellerData___"` in the HTML, the entry chunk and
  the web manifest. **`engine/index.html` must produce exactly one entry chunk**,
  which is why `main()` is invoked from `main.tsx` rather than from an inline
  script, and why the engine's HTML is not minified.
- It rewrites the service worker's precache revisions via `src/lib/precache.ts`.
  Workbox emits `revision:null` for content-hashed filenames; the original code
  assumed a quoted revision and spliced an md5 into arbitrary bytes of `sw.js`.

Changes here fail only when someone actually exports a storyworld, so exercise
that path.

## The 0.8.0 shape

`DESIGN.md` is the settled design and the reasoning behind every field; this
section is only what is easy to get wrong now that it exists. The schema version is
**0.8.0** and it adds four editor tables — `objects`, `recipes`,
`objectConditions`, `characterRelationships` — of which the engine gets three.
**No UI and no runtime behaviour yet**: section 3 shipped the fields, section 4
builds against them.

- **`compiler/format.ts` decides what the engine can ever see.** It `pick`s an
  explicit property list per collection, so a field declared correctly in *both*
  `src/data/types.ts` and `engine/src/types/index.ts` is still invisible at
  runtime until it is named there. This is the cheapest place in the repository to
  add a field and believe it works. `characterRelationships` is deliberately
  absent — authoring metadata, never compiled — and anything of it that must reach
  the engine goes through its optional `variableId`.
- **A new table needs a Dexie version; a new field almost never does.** Dexie
  declares indexes, not shapes, so `World.coverAssetId`, `Variable.scope`,
  `Path.notification`, `Event.choicePresentation` and
  `EngineLiveEventData.objects` all cost nothing in either migration chain. Both
  `v12.ts` files exist for their *tables*. In particular the engine's is **not**
  for the inventory state, which is an optional unindexed property on the existing
  `live_events` table — an old save simply lacks it, and absent means "no deltas",
  so it reads as a pristine world.
- **`useImageLoader` listens on `window`, so every image hears every other image's
  reply.** "Not addressed to me" and "there is no asset" are different answers, and
  the upstream hook conflated them: a reply that failed the id check fell through to
  `setImageData(null)`, so each image that finished loading blanked every image
  already on screen and only the last to answer kept its picture. `isAssetReplyFor`
  is the guard, and it checks **both** ids — `eventId` says which hook asked,
  `assetId` says what it asked for, and the second changes under a hook when a stack
  grows past one and switches to its stacked image. The hook had no consumers at all
  in 0.7.0, so the object rail is the first thing to exercise it; anything else that
  renders two images at once needs the same guard.
- **Objects are acted on from a verb menu on the tile, not from a button row.**
  Clicking a tile in the rail opens `ObjectMenu` — the object's name, a divider,
  then only the verbs that apply, so `Take` is absent rather than greyed out beside
  something already carried. `Look at` prints the description into the stream, which
  is the one thing inspecting writes. The menu is positioned from JavaScript for the
  same reason the tooltip is, and clamped after layout because its height varies
  with how many verbs apply.
- **A combination is a pair — `MAX_RECIPE_INPUTS`, declared in the model.** The
  rail can only ever offer two, so the recipe editor must not let an author write a
  third input; both read the same constant. A chain of three is two recipes through
  an intermediate object. An older world holding a longer recipe is not migrated: it
  simply never matches, which `objectModel.test.ts` holds in place so capping the UI
  cannot quietly change what an existing world does.
- **Taking and combining update the live event the player is on; they do not
  append one.** `ENGINE_LIVE_EVENT_TYPE.OBJECT_TAKE` and `OBJECT_COMBINE` are
  declared and never written, and `DESIGN.md` §5 still describes the appending
  design it superseded. The appended event carried the *same* `destination`, and
  `LiveEvent` renders `Event` for `destination` — so it drew the whole event a
  second time, and both copies kept enabled choices. Taking a path builds the next
  event from the copy it was clicked on, whose `objects` predate the take, so
  picking something up and then clicking the upper of two identical choices threw
  it away. What an action says now goes in `EngineLiveEventData.messages` and is
  rendered by `Event` between the prose and the choices. The object rail says
  nothing about outcomes at all.
- **The next live event's `state` and `objects` are read from the database, not
  from the component that renders the button.** `gotoNextLiveEvent` used
  `liveEvent?.objects ?? data.objects`, both render-time snapshots, and it is
  reached through a chain of memoized callbacks that can be older than the last
  write: `EventChoice` and `EventPassthroughChoice` each memoize their click
  handler on `[openPath]` and omitted `onSubmitPath`. A choice's `openPath` comes
  from a Dexie live query and is a new object on every `liveEvent` change, so the
  handler was rebuilt and the staleness never showed. A **passthrough's** comes
  from react-query, which hashes its key **by value** — the same paths looked up
  again return the cached object, the handler is never rebuilt, and the » arrow
  fires a pre-take closure. The symptom was an object taken and then gone from
  both the scene and the inventory, but only when the event was continued by the
  arrow rather than by a choice, which is what made it look like a fault in the
  object model. Deps are the cheap half of the fix; **the write reading the stored
  record is the load-bearing half**, and it is the pattern `useObjectActions.apply`
  already follows.
- **The object rail is icon-only, so three things it does not show have to go
  somewhere.** The name is a tooltip, positioned from JavaScript because the rail's
  groups scroll and a CSS `::after` is clipped by that scroll container. The
  description is printed into the stream as an `INSPECTION` message when a tile is
  selected — the one thing inspecting writes, against `DESIGN.md`'s "changes no
  state", which is still true of deltas and variables. And an object with no image
  falls back to its initials, because with no title beside it the tile would
  otherwise be an empty square.
- **The three kinds of paragraph in the reading column are told apart without
  colour.** Prose is upright, a narration is italic, an inspection is italic *and*
  set aside with a citation rule — WCAG 1.4.1, since a reader who cannot separate
  the grey still has the indent. `--event-object-inspection-text-color` is a theme
  token for the same reason `--event-past-text-color` is: the grey that is AAA on
  CONSOLE's near-black is below AA on BOOK's white. **A token added to
  `variables.less` must also be added to `engine-editor.less`**, which declares its
  own set rather than inheriting a `html[data-theme]` block — miss it and the text
  silently falls back to the prose colour in the composer preview only.
- **Object quantity is derived, never stored as a census.** What a location holds
  is the authored placement (with its gate re-evaluated *now*) plus a signed
  delta, clamped at zero. That is what makes a gate turning true mid-play reveal an
  object with no write at all. It also means **placement gates should be
  monotonic**: one that turns true, then false, then true again hands the player a
  second copy of what they already took. Nothing enforces it.
- **`isPathOpen` fails open, which is why object conditions are their own table.**
  It skips a condition whose variable it cannot find, and `[].every()` is `true`
  under `PATH_CONDITIONS_TYPE.ALL`, so an unrecognised condition *opens* the path.
  Object conditions are therefore a distinct concept with an evaluator that has to
  be called explicitly, rather than a variant row in `conditions` that every
  missed reader would wave through — in the direction that unlocks content. When
  that evaluator is written, `totalConditions` must count object conditions too,
  or a path gated only on objects loses the feedback#105 preference for
  conditional paths.
- **Most of the new references are invisible to a reader expecting indexed foreign
  keys.** A recipe's `effects`, a placement's two gate arrays and an object's
  `placements` are all inline, so nothing reports them as broken. `removeObject`,
  `removeVariable`, `removePath` and `removeCharacter` each cascade into them;
  anything that adds a fifth writer of an object or variable id belongs in the
  matching cascade.
- **`collectAssetReferences` now covers seven writers, not four**: character
  masks, event images, event audio, scene audio, an object's image, an object's
  *stacked* image, and the storyworld cover. Every field on
  `AssetReferenceSources` is optional, so a caller that omits one gets a silently
  incomplete count — and an incomplete count means the asset manager offering to
  delete a file that is in use. `removeDeadAudioAsset` omits the image sources on
  purpose and says so, because objects and covers cannot name an mp3.
- **An object has two image slots and therefore two `ASSET_REFERENCE_TYPE`s.**
  Clearing a reference means clearing a named field, and one type could not say
  whether that was `assetId` or `stackedAssetId`. `ASSET_KIND.WORLD_COVER`'s
  pipeline is deliberately identical to the event image's — a separate constant
  rather than an alias — since the kind exists to label the import menu, not to
  process differently.
- **`saveElementTitle` carries a cast that is load-bearing.** `this[table]` is a
  union over 19 row types and `update()` with a spread tipped over TS2590. It is
  narrowed to `Dexie.Table<Element, string>`, which is sound rather than a
  suppression: every row type extends `Element` and only `title` and `updated` are
  written. Adding more tables will make this worse, not better.
- **`AppContext`'s `version` is `'0.8.0'` and `main.ts` imports its transport
  types from `0.8.0`.** Those move together with the schema map entry and the
  upgrade step. `main.ts` typing the export path against a stale version is not a
  compile-time no-op — it silently packs a PWA whose newest collections are
  missing, which is why the import there now carries a note.

## The import upgrade chain

`src/lib/importWorldData.ts` walks an imported file from its own engine version up
to 0.7.1 through `lib/transport/upgrade/*`. The schemas in `lib/transport/types/*`
are **frozen descriptions of JSON already on disk**, which makes them the one
place in this repository where a rename must *not* be applied:

- 0.6.0 renamed GAME to WORLD, PASSAGE to EVENT and ROUTE to PATH, and added
  `JUMP` to `EVENT_TYPE`. Everything from 0.1.3 to 0.5.1 predates that. The
  pre-rename vocabulary lives in `types/pre-0.6.0.ts` and is shared by those
  schemas; **do not** reach for `data/types` from one of them, which is how they
  came to claim that a 0.2.0 export contains "WORLD". `upgrade/0.6.0.ts` is the
  file that crosses the boundary, comparing against the literal `'GAME'`.
- Sharing one enum declaration is load-bearing, not just tidiness. Two separately
  declared string enums are not assignable to one another in TypeScript even when
  their members have identical values, so a per-file copy forces casts at every
  upgrade seam.
- The same applies to `src/db/v*.ts`: a migration names tables as they were at
  *that* version. `v7.ts` and `v8.ts` both say `'games'` as a literal because
  `LIBRARY_TABLE` has no member for it after v8 copies it to `worlds` and v9 drops
  it. Resolving one of those to `LIBRARY_TABLE.WORLDS` reads the wrong table on a
  real upgrade and is invisible until a user with old data opens the app.

**0.7.1 changed no field of the exported shape**, which makes it the one version
worth describing before someone reads the code and assumes otherwise. Upstream's
`schema/0.7.1.json` and `types/0.7.1.ts` are byte-identical to the 0.7.0 pair and
its `upgrade/0.7.1.ts` returns its input field for field, so:

- `types/0.7.1.ts` **re-exports** `0.7.0` rather than forking 658 identical lines,
  which is also what keeps the one enum declaration shared per the point above.
  `validate/index.ts` maps `'0.7.1'` to the 0.7.0 schema object for the same
  reason, rather than carrying a duplicate 40 KB JSON that has to stay in step. A
  version that genuinely changes the shape gets its own file, copied and frozen.
- **The `< 0.7.0` gate on the 0.6.0-to-0.7.0 branch must stay `0.7.0`.** Upstream
  widened it to `< 0.7.1` and appended the new step inside it, which sends a 0.7.0
  file back through `v070Upgrade` — and that is **not idempotent**. It resets every
  event's `characters` and `images` to `[]`, appends the variable type onto each
  condition's `compare` and each effect's `set` a second time, and pushes the
  scene's jump child refs in again. Duplicated child refs are fatal on next open,
  per the scene map clipboard section. The 0.7.1 step is therefore applied *after*
  the chain, under its own `< 0.7.1` gate, where the data is 0.7.0-shaped whichever
  branch ran.
- **`db/v11.ts` says `version(11)`, and upstream's says `version(10)`.** Dexie 3's
  `version(n)` returns the *existing* Version instance for a number already
  declared and `.upgrade()` assigns `_cfg.contentUpgrade`, so upstream's call
  silently replaces v10's entire migration — anyone upgrading from v9 or earlier
  skips all of it. Both the editor's and the engine's copy are corrected here.
  Nothing reads `World.engine`; it is bookkeeping, which is why the migration only
  restamps it.

Validation loads its schema from a static map in `validate/index.ts`, keyed on the
file's `_.engine`. It used to be `require(`../schema/${version}.json`)`, which only
worked under webpack, where a template-string require pulls in the whole directory
as a context module. **Vite does not do that**, so the call threw at runtime and
the catch reported it as an unsupported schema — which made a perfectly good file
look too new for the app, for every version. Static imports also bundle the
schemas, which a packaged build needs: nothing resolves
`src/lib/transport/schema` at that point. Treat any surviving dynamic `require`
with an interpolated path as a migration bug.

Import is only exercised when someone actually imports a file, so it carries the
same "test it or it silently rots" property as the export path above. Two things
worth knowing when testing it: assets are copied from an `assets` directory
**beside the chosen JSON**, so the file has to be imported through the Dashboard's
picker for `jsonPath` to be set, and `IMPORT_WORLD_ASSETS` swallows any failure
silently. The imported world is also renamed to `<title> (Imported)`.

## Housekeeping

- **Two numbers in this repository read like a version and only one of them is
  the app's.** `package.json`'s `version` is the release, is read by nothing at
  runtime and is the one to bump — patch for fixes, minor for features, major for
  impactful changes. `AppContext`'s `defaultAppState.version` is the **storyworld
  schema version**, now `0.8.0`: `ExportWorldMenu` passes it to
  `getWorldDataJSON` as `schemaVersion`, it is written into an exported world's
  `_.engine`, and `transport/validate` looks that up in a static schema map — so
  bumping it without adding the map entry makes the app refuse to import its own
  exports, reported as an unsupported schema. It moves only alongside a
  `transport/schema` entry and an `upgrade/*` step, and it costs compatibility in
  one direction: an older build rejects a version it has never heard of, so a bump
  needs a reason. `validateWorldData.test.ts` holds it to being a schema this app
  can itself import. The About box shows both, the release from `package.json`
  (imported for its `version`, tree-shaken to that one field) and the schema
  version beside it.
- Type checking **is** in the build path, as of both projects reaching zero
  errors: the editor went 127 → 39 → 0, `engine/` was already clean. `npm run
  typecheck` covers both projects and `build` runs it after `engine:sync` and
  before `electron-vite build`. The order matters — the root `tsconfig` includes
  the generated `src/components/Storyteller/embedded`, so a typecheck without a
  preceding sync reports on a stale or absent copy. Vite still strips types
  without checking them, so `dev` is unaffected and stays fast; only `build` and
  `package` gate.
- **A type error in `src/components/Storyteller/embedded` must be fixed in
  `engine/src`.** That directory is generated by `engine:sync` and any edit to it
  is overwritten. Note the two projects are not equally strict: the editor's
  `tsconfig` reports `noImplicitReturns` violations that `engine/tsconfig.json`
  does not, so engine code can be clean on its own and still fail the editor's
  check once embedded.
- `npm run lint` exits 0 with ~727 catalogued warnings, counts recorded in
  `eslint.config.mjs`. Note `Docs/**` is in the ignore list: eslint walks the
  working tree rather than the index, so the git-ignored recovered docs and the
  third-party scripts saved with them reported 14352 errors and made the command
  exit 1. `react-hooks/rules-of-hooks` was 89 sites across 21
  files and is now **0 and set to `error`**, so it gates. The pattern it caught
  was an early `return null` above a component's hooks, which changes hook order
  between renders. If you need a guard, put it *below* every hook and let the
  hook bodies tolerate the absent value — the data hooks in `src/hooks` and the
  engine's `useLiveQuery` callbacks all take optional ids and return `undefined`
  for exactly this reason. `exhaustive-deps` (148) and `set-state-in-effect`
  (55) are still real risks, just too widespread to gate on.
- **Do not run `npm run format` over files you have only partly touched.** The
  pinned prettier is 3.x and the tree was formatted with 2.x, so it reformats
  nested ternaries, long assignments and type unions throughout — a two-line
  change came back as a forty-line diff. Format new files only, or reformat the
  whole tree deliberately in a commit of its own.
- `npm test` runs Vitest. `vitest.config.ts` mirrors the renderer's `electron`
  alias onto a stub in `src/__tests__/stubs/`, and `setup.ts` supplies the
  browser APIs jsdom lacks but antd, rc-dock and react-flow touch on mount. One
  of those is **`localStorage`, which jsdom does implement**: Node 22's own
  experimental global shadows it and resolves to `undefined` without
  `--localstorage-file`, warning once per worker. Real Chromium has it, so it is
  stubbed in `setup.ts` rather than worked around in the code under test.
- Never run `npm audit fix --force`; every remaining fix it offers is a
  downgrade. `GHSA-mh99-v99m-4gvg` (brace-expansion) is knowingly accepted and
  documented in both package.json files. Do **not** try to fix it with an
  `overrides` entry: 5.0.8's CommonJS build exports a named `expand` while
  minimatch 3 and 4 call the default export, which breaks ESLint outright. That
  was tried and reverted.
- No native modules, so no `electron-rebuild`.
- Electron 43 declares no install script, so `scripts/ensure-electron.mjs`
  fetches its binary from `postinstall`. npm 11 also gates dependency install
  scripts behind `allowScripts` in `package.json`.
- On Linux, unpackaged runs need `npm run dev:nosandbox` or a one-time
  `chown root` + `chmod 4755` on `node_modules/electron/dist/chrome-sandbox`.
- `.gitattributes` had a global `text eol=lf` with almost no binary
  declarations, which corrupted a `.mp3` and a `.ttf`. Declare new binary
  extensions there. **Fixing the declaration does not repair the files it already
  damaged**, and that is how both bundled fonts stayed broken until the first PWA
  was exported: `Inter.ttf` was 22 bytes short and `RobotoSerif.ttf` 674, so
  Chromium rejected them with `OTS parsing error: gvar: table overruns end of
  file` and every exported storyworld rendered in a system fallback with the
  Serif/Sans setting inert. CRLF collapsing is not reversible — the files had to be
  re-downloaded. Verify a font by walking its table directory and checking every
  `offset + length` against the file size; the editor never loads these, so nothing
  in the app tells you.
- **`roboto-serif-ofl.txt` carried Literata's copyright**, and `base.less`
  declared a third `@font-face` for `Literata.ttf`, a file that has never existed
  at any commit. Upstream appears to have set the storyteller in Literata and moved
  to Roboto Serif without finishing. The dead rule is gone and the licence is the
  right one; these ship inside every exported PWA, so it was an attribution bug
  rather than a tidiness one.
- **Two exports served on one origin will lie to you.** An exported PWA registers
  a service worker that precaches the CSS and the fonts, so serving a second export
  from the same `host:port` hands you the *first* one's assets — which presented
  here as a font fix that had not worked and a deleted `@font-face` that was still
  registered. Use a fresh port per export, or unregister the worker first.

## A shell gotcha that wasted real time

`pgrep -f electron/dist/electron` matches **its own shell's** command line, so it
always reports a match and `kill $(pgrep -f ...)` kills the calling shell —
which surfaces as a confusing exit code 144. Use a bracket to break the
self-match:

```bash
pgrep -f "dist/electro[n]"
```
