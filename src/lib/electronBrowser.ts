/**
 * Browser adapter for the `electron` import, the web build's counterpart to
 * `electronRenderer.ts`. `vite.web.config.mts` aliases `electron` to this module
 * instead of the desktop shim, so the 25 renderer modules that
 * `import { ipcRenderer } from 'electron'` keep working unchanged in a plain
 * browser tab — there is no Electron main process behind them.
 *
 * What it implements (see TODO.md §10 for the surface):
 *
 * - **PLATFORM** — `App` renders nothing until `app.platform` arrives over IPC,
 *   so the adapter delivers it to every `PLATFORM` listener as soon as one is
 *   registered, and again on an explicit `send(PLATFORM)`.
 * - **Assets** — `SAVE/GET/LIST/REMOVE/REMOVE_ASSETS/RESTORE_ASSET` are backed by
 *   IndexedDB Blobs handed out as `URL.createObjectURL`, replacing the desktop's
 *   `esg-asset://` file protocol. Blob URLs are seekable, so the MP3 range/seek
 *   handling the desktop needs is simply absent here.
 * - **Window chrome** — quit/minimize/fullscreen have no browser equivalent and
 *   are no-ops; `OPEN_EXTERNAL_LINK`/`shell.openExternal` open a new tab; UI scale
 *   goes through CSS `zoom` on the document root (`webFrame.setZoomFactor`).
 * - **Export/import** — JSON export is a Blob download; PWA export and world
 *   import are not wired up yet and report so rather than hanging (§10 phase 2).
 */
import Dexie from 'dexie'

import { WINDOW_EVENT_TYPE } from './events'

type AnyRecord = Record<string, unknown>

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

// Matches the os.platform() values the desktop build sends, which is what
// PLATFORM_TYPE in data/types is compared against.
const browserPlatform = (): 'darwin' | 'win32' | 'linux' => {
  const platform = navigator.platform || ''

  if (/Mac/i.test(platform)) return 'darwin'
  if (/Win/i.test(platform)) return 'win32'

  return 'linux'
}

// ---------------------------------------------------------------------------
// Asset store (IndexedDB via Dexie)
// ---------------------------------------------------------------------------

interface StoredAsset {
  key: string
  studioId: string
  worldId: string
  id: string
  ext: string
  blob: Blob
  bytes: number
  modified: number
}

class AssetStore extends Dexie {
  assets!: Dexie.Table<StoredAsset, string>
  trash!: Dexie.Table<StoredAsset, string>

  constructor() {
    super('esg-browser-assets')

    this.version(1).stores({
      assets: 'key, [studioId+worldId]',
      trash: 'key, [studioId+worldId]'
    })
  }
}

const assetStore = new AssetStore()

const assetKey = (studioId: string, worldId: string, id: string, ext: string) =>
  `${studioId}/${worldId}/${id}.${ext}`

const mimeForExt = (ext: string): string => {
  switch (ext.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'mp3':
      return 'audio/mpeg'
    default:
      return 'application/octet-stream'
  }
}

// One object URL per asset, reused across GET_ASSET calls and revoked when the
// asset is removed, so repeated reads do not leak URLs.
const objectUrlCache = new Map<string, string>()

const objectUrlFor = (asset: StoredAsset): string => {
  const cached = objectUrlCache.get(asset.key)

  if (cached) return cached

  const url = URL.createObjectURL(asset.blob)

  objectUrlCache.set(asset.key, url)

  return url
}

const revokeObjectUrl = (key: string) => {
  const url = objectUrlCache.get(key)

  if (url) {
    URL.revokeObjectURL(url)
    objectUrlCache.delete(key)
  }
}

// ---------------------------------------------------------------------------
// IPC handlers (invoke)
// ---------------------------------------------------------------------------

type InvokeHandler = (payload: AnyRecord) => Promise<unknown>

// Opens the browser's file picker and resolves with the chosen File, or null if
// the author cancels. Called synchronously from within the import click handler
// so the click() stays inside the user gesture that a file dialog requires.
const pickFile = (accept: string): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')

    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'

    let settled = false
    const done = (file: File | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(file)
    }

    input.onchange = () => done(input.files?.[0] ?? null)
    // Chromium fires 'cancel' when the dialog is dismissed.
    input.oncancel = () => done(null)

    document.body.appendChild(input)
    input.click()
  })

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // give the download a tick to start before releasing the URL
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const invokeHandlers: Partial<Record<WINDOW_EVENT_TYPE, InvokeHandler>> = {
  [WINDOW_EVENT_TYPE.SAVE_ASSET]: async ({ studioId, worldId, id, data, ext }) => {
    const key = assetKey(
      studioId as string,
      worldId as string,
      id as string,
      ext as string
    )
    const blob = new Blob([data as ArrayBuffer], { type: mimeForExt(ext as string) })

    await assetStore.assets.put({
      key,
      studioId: studioId as string,
      worldId: worldId as string,
      id: id as string,
      ext: ext as string,
      blob,
      bytes: blob.size,
      modified: Date.now()
    })

    revokeObjectUrl(key)

    return key
  },

  [WINDOW_EVENT_TYPE.GET_ASSET]: async ({ studioId, worldId, id, ext }) => {
    const key = assetKey(
      studioId as string,
      worldId as string,
      id as string,
      ext as string
    )
    const asset = await assetStore.assets.get(key)

    // Same shape as the desktop handler: [urlOrEmpty, exists]. The URL is quoted
    // because callers interpolate it straight into CSS url(); a blob URL never
    // contains a quote, so the quoting is harmless and keeps the contract.
    if (!asset) return ['""', false]

    return [`"${objectUrlFor(asset)}"`, true]
  },

  [WINDOW_EVENT_TYPE.LIST_ASSETS]: async ({ studioId, worldId }) => {
    const stored = await assetStore.assets
      .where('[studioId+worldId]')
      .equals([studioId as string, worldId as string])
      .toArray()

    return stored.map(({ id, ext, bytes, modified }) => ({
      id,
      ext: ext.toLowerCase(),
      bytes,
      modified
    }))
  },

  [WINDOW_EVENT_TYPE.REMOVE_ASSET]: async ({ studioId, worldId, id, ext, trash }) => {
    const key = assetKey(
      studioId as string,
      worldId as string,
      id as string,
      ext as string
    )
    const asset = await assetStore.assets.get(key)

    if (!asset) return

    if (trash) {
      // move to the trash table so RESTORE_ASSET can bring it back
      await assetStore.transaction('rw', assetStore.assets, assetStore.trash, async () => {
        await assetStore.trash.put(asset)
        await assetStore.assets.delete(key)
      })
    } else {
      await assetStore.assets.delete(key)
    }

    revokeObjectUrl(key)
  },

  [WINDOW_EVENT_TYPE.RESTORE_ASSET]: async ({ studioId, worldId, id, ext }) => {
    const key = assetKey(
      studioId as string,
      worldId as string,
      id as string,
      ext as string
    )
    const asset = await assetStore.trash.get(key)

    if (!asset) return

    await assetStore.transaction('rw', assetStore.assets, assetStore.trash, async () => {
      await assetStore.assets.put(asset)
      await assetStore.trash.delete(key)
    })
  },

  [WINDOW_EVENT_TYPE.REMOVE_ASSETS]: async ({ studioId, worldId, type }) => {
    const removeMatching = async (table: Dexie.Table<StoredAsset, string>) => {
      const matches =
        type === 'GAME'
          ? await table
              .where('[studioId+worldId]')
              .equals([studioId as string, worldId as string])
              .toArray()
          : await table.where('studioId').equals(studioId as string).toArray()

      for (const asset of matches) {
        revokeObjectUrl(asset.key)
        await table.delete(asset.key)
      }
    }

    await removeMatching(assetStore.assets)
    await removeMatching(assetStore.trash)
  },

  [WINDOW_EVENT_TYPE.EXPORT_WORLD_START]: async ({ type, data }) => {
    if (type === 'JSON') {
      const blob = new Blob([data as string], { type: 'application/json' })

      downloadBlob(blob, 'storyworld.json')
    } else {
      // PWA export needs the engine-dist assets fetched and zipped in the
      // browser — TODO.md §10 phase 2.
      window.alert(
        'Exporting a playable PWA from the browser build is not available yet. ' +
          'Use the desktop app for a PWA export, or export JSON here.'
      )
    }

    // let ExportWorldMenu close its progress modal
    ipcRenderer.emit(WINDOW_EVENT_TYPE.EXPORT_WORLD_COMPLETE)
  },

  [WINDOW_EVENT_TYPE.IMPORT_WORLD_GET_JSON]: async () => {
    const file = await pickFile('.json,application/json')

    // Cancelled — the caller treats an absent worldData as "nothing imported".
    if (!file) return { worldData: undefined, jsonPath: undefined }

    // A browser file input hands over one file with no sibling assets directory,
    // so this imports the storyworld data only; its images and audio are not
    // carried and read as missing until the ZIP interchange lands (§10 phase 2).
    // jsonPath is undefined, so IMPORT_WORLD_ASSETS below is a no-op. A JSON.parse
    // failure surfaces as the caller's "corrupt or empty" error, which is right.
    const text = await file.text()

    return { worldData: JSON.parse(text), jsonPath: undefined }
  },

  [WINDOW_EVENT_TYPE.IMPORT_WORLD_ASSETS]: async () => {
    // No filesystem to copy an assets directory from; browser imports carry no
    // assets yet (see IMPORT_WORLD_GET_JSON). The ZIP interchange (§10 phase 2)
    // will write the unpacked blobs to the asset store here.
    return
  }
}

// ---------------------------------------------------------------------------
// ipcRenderer surface
// ---------------------------------------------------------------------------

type Listener = (event: unknown, ...args: unknown[]) => void

const listeners = new Map<string, Set<Listener>>()

const emit = (channel: string, ...args: unknown[]) => {
  listeners.get(channel)?.forEach((listener) => listener({}, ...args))
}

const ipcRenderer = {
  invoke: async (channel: WINDOW_EVENT_TYPE, payload: AnyRecord = {}) => {
    const handler = invokeHandlers[channel]

    if (!handler) {
      // eslint-disable-next-line no-console
      console.warn(`[web] unhandled ipcRenderer.invoke: ${channel}`)

      return undefined
    }

    return handler(payload)
  },

  send: (channel: WINDOW_EVENT_TYPE, args?: unknown) => {
    switch (channel) {
      case WINDOW_EVENT_TYPE.PLATFORM:
        emit(WINDOW_EVENT_TYPE.PLATFORM, [browserPlatform()])
        break
      case WINDOW_EVENT_TYPE.OPEN_EXTERNAL_LINK: {
        const url = Array.isArray(args) ? args[0] : args

        if (typeof url === 'string') window.open(url, '_blank', 'noopener')

        break
      }
      // quit / minimize / fullscreen / float / zoom-ui / open-help have no
      // browser equivalent or no menu to originate from — no-ops.
      default:
        break
    }
  },

  on: (channel: WINDOW_EVENT_TYPE, listener: Listener) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set())

    listeners.get(channel)!.add(listener)

    // App attaches its PLATFORM listener on mount and renders nothing until it
    // fires, so deliver the platform to a fresh listener on the next tick.
    if (channel === WINDOW_EVENT_TYPE.PLATFORM)
      setTimeout(() => listener({}, [browserPlatform()]), 0)

    return ipcRenderer
  },

  once: (channel: WINDOW_EVENT_TYPE, listener: Listener) => {
    const wrapped: Listener = (event, ...args) => {
      ipcRenderer.removeListener(channel, wrapped)
      listener(event, ...args)
    }

    return ipcRenderer.on(channel, wrapped)
  },

  removeListener: (channel: WINDOW_EVENT_TYPE, listener: Listener) => {
    listeners.get(channel)?.delete(listener)

    return ipcRenderer
  },

  removeAllListeners: (channel: WINDOW_EVENT_TYPE) => {
    listeners.delete(channel)

    return ipcRenderer
  },

  // exposed so invoke handlers can push progress/complete events to the renderer
  emit
}

// ---------------------------------------------------------------------------
// shell / webFrame / clipboard
// ---------------------------------------------------------------------------

const shell = {
  openExternal: async (url: string) => {
    window.open(url, '_blank', 'noopener')
  },
  openPath: async () => ''
}

const webFrame = {
  // CSS zoom on the document root scales antd's compiled pixels, which a custom
  // property could not — the browser gets what the desktop build could not have.
  setZoomFactor: (factor: number) => {
    ;(document.documentElement.style as CSSStyleDeclaration & {
      zoom?: string
    }).zoom = String(factor)
  },
  getZoomFactor: () => {
    const zoom = (document.documentElement.style as CSSStyleDeclaration & {
      zoom?: string
    }).zoom

    return zoom ? Number(zoom) : 1
  }
}

const clipboard = {
  // Electron's readText is synchronous; the browser Clipboard API is not, so a
  // paste-detect-URL feature that read it inline degrades to empty here.
  readText: () => '',
  writeText: (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined)
  }
}

const webUtils = {}
const contextBridge = {}

const electron = {
  ipcRenderer,
  clipboard,
  shell,
  webFrame,
  webUtils,
  contextBridge
}

export { ipcRenderer, clipboard, shell, webFrame, webUtils, contextBridge }

export default electron
