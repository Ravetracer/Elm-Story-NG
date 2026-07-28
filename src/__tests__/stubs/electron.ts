/**
 * Test stub for the `electron` module.
 *
 * Renderer modules import 'electron' directly because the window runs with
 * nodeIntegration enabled. In production that import is aliased to
 * src/lib/electronRenderer.ts, which reads Electron's CommonJS module off the
 * global. Under Vitest there is no Electron runtime, so vitest.config.ts points
 * the same alias here.
 *
 * ipcRenderer.invoke resolves to undefined by default. Tests that depend on a
 * particular reply should mock it per case, for example:
 *
 *   import { ipcRenderer } from 'electron'
 *   vi.mocked(ipcRenderer.invoke).mockResolvedValue(['"an-asset-url"', true])
 */
import { vi } from 'vitest'

export const ipcRenderer = {
  invoke: vi.fn(async () => undefined),
  send: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn()
}

export const clipboard = {
  readText: vi.fn(() => ''),
  writeText: vi.fn()
}

export const shell = {
  openExternal: vi.fn(async () => undefined),
  openPath: vi.fn(async () => '')
}

export const webFrame = {
  setZoomFactor: vi.fn(),
  getZoomFactor: vi.fn(() => 1)
}

export default { ipcRenderer, clipboard, shell, webFrame }
