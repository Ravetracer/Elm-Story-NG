# dev-doc — architecture & behaviour notes

Incremental knowledge base for Elm Story - NG. Read the relevant file here
**before touching code**; extend it after every task so the next task starts
warm instead of re-deriving everything.

## Relationship to `CLAUDE.md`

`CLAUDE.md` (repo root) is authoritative and organised as **gotchas** — the
things that are easy to get wrong. These docs are complementary and organised as
**flows** — how a thing actually works end to end (click → data → render), plus
measured performance findings. When the two disagree, `CLAUDE.md` wins; fix this
folder.

## Index

| file | covers |
| --- | --- |
| [scene-loading.md](scene-loading.md) | Click-to-render path for opening a scene; data hooks; the SceneMap elements effect |
| [performance.md](performance.md) | Measured load/render costs, profiling method, findings, and open items |
| [browser-build.md](browser-build.md) | The editor in a browser (§10): the `electron` seam, the adapter, import/export, PWA export, remaining work |
| [docs-site.md](docs-site.md) | The public landing + documentation + tutorial site (§8): build, structure, and how it stays in sync with the in-app help |
| [DESIGN.md](DESIGN.md) | The settled rationale behind the 0.8.0 persisted shape — why each field/table is what it is (the retired roadmap's design pass, kept for the "why") |
| [0.7.1-archive.md](0.7.1-archive.md) | Forensic record of what the 0.7.1 upstream archive did and did not contain, plus the dead-code cleanup notes it surfaced |
| [scene-triggers.md](scene-triggers.md) | **Design (not built):** scene-scoped reactive triggers — fire a one-shot sound on the rising edge of a variable condition; the seams, the edge-detection insight, and the audio one-shot |
| [keyboard.md](keyboard.md) | How key events are handled, and the layout trap — matching a physical keyCode when the intent is a character (why a German keyboard could not type `?`), plus the AltGr/accelerator collision |
| [preview-window.md](preview-window.md) | **Design (not built):** a standalone full-window preview window so authors can see alignment/theme/skin without exporting — why the composer preview can't show them (the `isComposer` coupling), the bake-a-snapshot-and-run-the-real-player approach, the localStorage data channel, and the build/font risks |
| [theming-and-skins.md](theming-and-skins.md) | **Design (not built):** five-phase presentation plan — configurable reading-lane alignment, an author-locked bundled theme selector, a framed inventory grid, curated 9-slice skin art, and wearable objects + a character panel (equipping sets a variable, so path-gating is free); the schema costs, the layout coupling, and the licensing gate |

## Conventions

- Anchor claims to `file:line` so they stay checkable.
- Record **measured** numbers with how they were measured, not guesses.
- Mark fixed vs. open clearly. Date open items.
