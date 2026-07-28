/**
 * Bridge between the renderer's `import { ipcRenderer } from 'electron'` calls
 * and Electron's CommonJS runtime module.
 *
 * The window is created with `nodeIntegration: true` and
 * `contextIsolation: false`, so Electron injects `require` into the renderer's
 * global scope. Vite emits ES modules and will not rewrite a bare `electron`
 * import into a require call, so the renderer build aliases `electron` to this
 * module (see electron.vite.config.ts).
 *
 * The lookup goes through `globalThis` deliberately: a literal
 * `require('electron')` would be treated as a resolvable dependency by Vite
 * and fail at build time.
 *
 * Application code keeps importing from 'electron' and therefore keeps
 * Electron's own type declarations, because the alias exists only in the Vite
 * config and not in tsconfig.json.
 */
import type * as Electron from 'electron'

const nodeRequire = (globalThis as typeof globalThis & { require?: NodeRequire })
  .require

if (!nodeRequire) {
  throw new Error(
    'Electron runtime module unavailable: the renderer global `require` is ' +
      'missing. This build expects nodeIntegration to be enabled and ' +
      'contextIsolation to be disabled.'
  )
}

const electron: typeof Electron = nodeRequire('electron')

export const {
  ipcRenderer,
  clipboard,
  shell,
  webFrame,
  webUtils,
  contextBridge
} = electron

export default electron
