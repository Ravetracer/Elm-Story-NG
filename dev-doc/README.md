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

## Conventions

- Anchor claims to `file:line` so they stay checkable.
- Record **measured** numbers with how they were measured, not guesses.
- Mark fixed vs. open clearly. Date open items.
