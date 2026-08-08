import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The public documentation + landing site (TODO.md §8). A small standalone React
 * app, built and published exactly like the browser editor (`vite.web.config.mts`)
 * — `npm run build:docs` emits a static, relative-pathed `dist-docs/` deployable on
 * any webserver, `dev:docs` / `preview:docs` run it.
 *
 * It reuses the editor's in-app help verbatim: `src/components/ElementHelp/content`
 * is pure React (React + a type-only enum, no antd), so rendering it here keeps the
 * element/tool reference in one place. The expressions reference is the one part
 * duplicated (its in-app original pulls antd) — kept in step by hand.
 *
 * No CDN anywhere: styles are a single local stylesheet, icons are inline SVG, and
 * the wordmark is an imported SVG asset Vite bundles locally.
 */
export default defineConfig(({ mode }) => ({
  root: resolve(__dirname, 'docs'),

  // relative URLs so it works served from any path, not just the domain root
  base: './',

  define: {
    'process.env.NODE_ENV': JSON.stringify(mode)
  },

  build: {
    outDir: resolve(__dirname, 'dist-docs'),
    emptyOutDir: true,
    sourcemap: false
  },

  plugins: [react()]
}))
