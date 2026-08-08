import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Standalone browser build of the editor — the same renderer as the Electron
 * app, with the `electron` import aliased to the browser adapter
 * (`src/lib/electronBrowser.ts`) instead of the desktop shim. There is no main
 * process: assets live in IndexedDB and the window chrome is inert.
 *
 * `npm run build:web` emits a static, relative-pathed `dist-web/` that can be
 * dropped on any webserver. `npm run dev:web` serves it with HMR. Both run
 * `engine:sync` first, exactly as the desktop `dev`/`build` do, because the
 * renderer imports the generated engine styles and embedded Storyteller.
 */
export default defineConfig(({ mode }) => ({
  // The renderer sources were never moved into src/renderer; point Vite at the
  // existing layout, matching electron.vite.config.ts.
  root: resolve(__dirname, 'src'),

  // Relative asset URLs so the build works served from any path, not just the
  // domain root.
  base: './',

  resolve: {
    alias: [
      {
        find: /^electron$/,
        replacement: resolve(__dirname, 'src/lib/electronBrowser.ts')
      }
    ]
  },

  define: {
    // A few dependencies expect Node's globals; the app itself only reads
    // process.env.NODE_ENV (in logger.ts).
    'process.env.NODE_ENV': JSON.stringify(mode),
    global: 'globalThis'
  },

  css: {
    preprocessorOptions: {
      less: {
        // antd 4's dark theme uses Less JavaScript expressions.
        javascriptEnabled: true
      }
    }
  },

  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html')
    }
  },

  plugins: [react()]
}))
