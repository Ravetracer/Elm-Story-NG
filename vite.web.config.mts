import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join, relative, resolve } from 'path'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const ENGINE_DIST = resolve(__dirname, 'assets/engine-dist')

// Every file under assets/engine-dist, as forward-slashed paths relative to it.
const engineDistFiles = (dir = ENGINE_DIST): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)

    return statSync(full).isDirectory()
      ? engineDistFiles(full)
      : [relative(ENGINE_DIST, full).split('\\').join('/')]
  })

/**
 * The browser build's PWA export (electronBrowser.ts) fetches the built
 * Storyteller engine and rewrites it into a playable app in the tab, the same
 * job main.ts does from disk on the desktop. So the engine has to be reachable
 * over HTTP: this ships assets/engine-dist into the build under /engine-dist and
 * writes a files.json index the exporter reads to know what to fetch and pack.
 * In dev the same paths are served straight from disk.
 */
const shipEngineDist = (): Plugin => {
  const filesJson = () => JSON.stringify(engineDistFiles())

  return {
    name: 'ship-engine-dist',
    apply: () => true,
    configureServer(server) {
      server.middlewares.use('/engine-dist', (req, res, next) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0])

        if (rel === '/files.json') {
          res.setHeader('Content-Type', 'application/json')
          res.end(filesJson())
          return
        }

        try {
          const full = join(ENGINE_DIST, rel)

          if (!full.startsWith(ENGINE_DIST) || statSync(full).isDirectory()) {
            next()
            return
          }

          res.end(readFileSync(full))
        } catch {
          next()
        }
      })
    },
    closeBundle() {
      const out = resolve(__dirname, 'dist-web/engine-dist')

      cpSync(ENGINE_DIST, out, { recursive: true })
      writeFileSync(join(out, 'files.json'), filesJson())
    }
  }
}

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

  plugins: [react(), shipEngineDist()]
}))
