import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        // Mirrors electron.vite.config.ts. Renderer modules import 'electron'
        // directly, and under test there is no Electron runtime at all, so the
        // import resolves to a stub instead of the shim that reads the real
        // module off the global. Anchored so it does not also capture
        // electron-log, electron-updater and friends.
        find: /^electron$/,
        replacement: resolve(__dirname, 'src/__tests__/stubs/electron.ts')
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Generated from engine/src by `npm run engine:embed`; it is covered in the
    // engine workspace instead.
    exclude: ['**/node_modules/**', 'src/components/Storyteller/embedded/**'],
    // The renderer pulls in antd and the whole editor tree, so a generous
    // ceiling avoids flaky first-run timeouts while Vite warms its cache.
    testTimeout: 20000
  }
})
