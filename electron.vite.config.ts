import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-debug and electron-context-menu are ESM-only from v4 onward. The
// main process is emitted as CommonJS, so they are excluded from
// externalization and bundled instead of being left as bare requires.
const ESM_ONLY_MAIN_DEPS = ['electron-debug', 'electron-context-menu']

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, 'src/main.ts')
      }
    },
    plugins: [externalizeDepsPlugin({ exclude: ESM_ONLY_MAIN_DEPS })]
  },

  renderer: {
    // The renderer sources were never moved into a src/renderer directory, so
    // the existing layout is kept and Vite is pointed at it instead.
    root: resolve(__dirname, 'src'),
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      sourcemap: true,
      rollupOptions: {
        input: resolve(__dirname, 'src/index.html')
      }
    },
    resolve: {
      alias: [
        {
          // The renderer runs with nodeIntegration enabled and
          // contextIsolation disabled, and 24 modules import `electron`
          // directly. Vite emits ES modules and cannot rewrite a bare import
          // into a require call, so those imports are routed through a shim
          // that reads Electron's CommonJS module off the global at runtime.
          // Anchored so it cannot also capture electron-log, electron-updater
          // and friends.
          find: /^electron$/,
          replacement: resolve(__dirname, 'src/lib/electronRenderer.ts')
        }
      ]
    },
    css: {
      preprocessorOptions: {
        less: {
          // antd 4's dark theme uses Less JavaScript expressions.
          javascriptEnabled: true
        }
      }
    },
    plugins: [react()]
  }
})
