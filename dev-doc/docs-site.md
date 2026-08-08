# The documentation + landing site (TODO §8)

The public site at `docs/`, built and published exactly like the browser editor.
A small standalone React app — landing page, documentation, tutorial — with **no
CDN**: one hand-authored stylesheet, inline SVG icons, and the wordmark as a
bundled SVG asset.

## Build & run

- `npm run build:docs` → static, relative-pathed `dist-docs/` (gitignored),
  deployable on any webserver — the same shape as `dist-web/`.
- `npm run dev:docs` / `npm run preview:docs` to run it.
- Config: `vite.docs.config.mts` (`root: docs/`, `base: './'`, output `dist-docs`).
  No `engine:sync` needed — the site imports none of the generated engine output.

## Structure

- `docs/index.html`, `docs/main.tsx` — entry; `HashRouter` so static hosting needs
  no server rewrites (routes are `/#/`, `/#/docs`, `/#/docs/:topic`, `/#/tutorial`).
- `docs/App.tsx` — routes + shared `Header`/`Footer` + scroll-to-top.
- `docs/pages/Landing.tsx` — adapted from the maintainer's `!dev/drive-g.html`
  template (dark neon-purple; the app's `--highlight-color` accent). The template's
  Tailwind CDN, Bootstrap-Icons CDN and Pexels demo images were all removed.
- `docs/pages/Docs.tsx` — sidebar (`HELP_GROUPS`) + content pane.
- `docs/pages/Tutorial.tsx` — step-by-step core mechanics, hand-written.
- `docs/pages/Expressions.tsx` — the variables & expressions reference.
- `docs/styles.css` — the whole design system. `docs/icons.tsx` — inline SVGs.
- `docs/config.ts` — `REPO_URL`, `EDITOR_URL`, `LICENSE`.

## Keeping it in sync — the important bit

- **Element & tool docs are NOT duplicated.** `Docs.tsx` imports `HELP_CONTENT`,
  `HELP_GROUPS` and `helpTopicTitle` from `src/components/ElementHelp/content.tsx`
  and renders them. That file is pure React (React + a type-only enum, no antd), so
  it renders here unchanged and stays the single source of truth. Edit the in-app
  help and the site follows automatically on the next build.
- **The expressions page IS duplicated.** `VariableManager/VariableHelp.tsx`'s
  `VariableHelpContent` pulls antd, which the site does not carry, so
  `docs/pages/Expressions.tsx` is a plain-React copy. The maintainer accepted the
  duplication. **When the expression language changes, update both** — the source of
  truth for what parses is `src/lib/templates.ts`, held by
  `src/__tests__/variableHelpExamples.test.ts`.
- **`EDITOR_URL`** in `docs/config.ts` defaults to the repo so the CTA is never
  dead; point it at the deployed browser editor once that has a URL.

## Publishing

Publish `dist-docs/` the same way as `dist-web/` — any static host. The two are
independent deployments; the landing's "Open the Editor" button crosses from one to
the other via `EDITOR_URL`.
