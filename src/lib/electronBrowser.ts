/**
 * Browser adapter for the `electron` import, the web build's counterpart to
 * `electronRenderer.ts`. `vite.web.config.mts` aliases `electron` to this module
 * instead of the desktop shim, so the 25 renderer modules that
 * `import { ipcRenderer } from 'electron'` keep working unchanged in a plain
 * browser tab — there is no Electron main process behind them.
 *
 * What it implements (see the original roadmap §10 for the surface):
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
 * - **Export/import** — JSON, ZIP and PWA export are all Blob downloads; import
 *   accepts a `.json` or a `.zip`. A PWA export fetches the Storyteller engine
 *   shipped under `/engine-dist`, runs the shared `lib/worldPWA` rewrite (the
 *   same one `main.ts` runs from disk) and packs the playable app as a `.zip`.
 */
import Dexie from 'dexie'
import JSZip from 'jszip'
import md5 from 'md5'

import { WINDOW_EVENT_TYPE } from './events'
import {
  buildWorldZip,
  parseWorldZip,
  WORLD_ZIP_JSON,
  ZipAssetFile
} from './worldZip'
import { PWAContentAsset, rewritePWAFiles } from './worldPWA'
import { WorldDataJSON } from './transport/types/0.8.0'

type AnyRecord = Record<string, unknown>

// Assets unpacked from a .zip import, held between IMPORT_WORLD_GET_JSON (which
// reads the archive) and IMPORT_WORLD_ASSETS (which writes them once the world's
// studioId/worldId are known). Null for a plain .json import, which has none.
let pendingImportAssets: ZipAssetFile[] | null = null

// A filesystem-safe filename from a storyworld title, for a download.
const safeFilename = (title: string): string =>
  (title || 'storyworld').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') ||
  'storyworld'

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

// The base URL the Storyteller engine is served under, resolved against the
// document rather than the current route so a HashRouter path (/#/composer) or a
// subpath deployment does not send the fetch to the wrong place.
const engineDistBase = (): string =>
  new URL('engine-dist/', window.location.href.split('#')[0]).href

// Build a playable PWA the same way main.ts does on the desktop, but fetching the
// engine over HTTP instead of copying it off disk and packing the result as a
// .zip instead of writing a folder. The rewrite itself is the shared, tested
// lib/worldPWA — this function is only the browser's I/O around it.
const buildWorldPWA = async (json: string): Promise<Uint8Array> => {
  const worldData = JSON.parse(json) as WorldDataJSON
  const base = engineDistBase()

  const fetchText = async (path: string): Promise<string> => {
    const response = await fetch(`${base}${path}`)

    if (!response.ok) {
      throw new Error(`Could not fetch engine file "${path}" (${response.status})`)
    }

    return response.text()
  }

  const files: string[] = JSON.parse(await fetchText('files.json'))

  const manifest: { 'index.html': { file: string } } = JSON.parse(
    await fetchText('manifest.json')
  )
  const entryFile = manifest['index.html'].file

  const [html, js, webmanifest, sw] = await Promise.all([
    fetchText('index.html'),
    fetchText(entryFile),
    fetchText('manifest.webmanifest'),
    fetchText('sw.js')
  ])

  // The world's own assets, which are absent from the built engine and precache.
  const stored = await assetStore.assets
    .where('[studioId+worldId]')
    .equals([worldData._.studioId, worldData._.id])
    .toArray()

  const contentAssets: (PWAContentAsset & { bytes: ArrayBuffer })[] =
    await Promise.all(
      stored.map(async (asset) => {
        const bytes = await asset.blob.arrayBuffer()

        return {
          id: asset.id,
          ext: asset.ext,
          revision: md5(new Uint8Array(bytes) as unknown as number[]),
          bytes
        }
      })
    )

  const rewritten = rewritePWAFiles({
    worldData,
    entryFile,
    html,
    js,
    webmanifest,
    sw,
    contentAssets,
    md5,
    onPrecacheError: (error) =>
      console.error(
        `[web] Unable to update the service worker precache manifest. The ` +
          `exported storyworld may be served from a stale cache on update.`,
        error
      )
  })

  const rewrittenByPath: Record<string, string> = {
    'index.html': rewritten.html,
    [entryFile]: rewritten.js,
    'manifest.webmanifest': rewritten.webmanifest,
    'sw.js': rewritten.sw
  }

  const zip = new JSZip()

  await Promise.all(
    files
      // manifest.json is a build artifact the desktop export removes too.
      .filter((path) => path !== 'manifest.json' && path !== 'files.json')
      .map(async (path) => {
        if (path in rewrittenByPath) {
          zip.file(path, rewrittenByPath[path])
          return
        }

        const response = await fetch(`${base}${path}`)
        zip.file(path, await response.arrayBuffer())
      })
  )

  const contentFolder = zip.folder('assets')?.folder('content')

  contentAssets.forEach((asset) =>
    contentFolder?.file(`${asset.id}.${asset.ext}`, asset.bytes)
  )

  return zip.generateAsync({ type: 'uint8array' })
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
    const json = data as string
    const meta = (() => {
      try {
        return (JSON.parse(json) as { _?: AnyRecord })._ ?? {}
      } catch {
        return {}
      }
    })()
    const title = safeFilename(meta.title as string)

    if (type === 'JSON') {
      // Structure only — a lone JSON, matching the desktop's .json output. Use
      // the ZIP export to carry the assets.
      downloadBlob(
        new Blob([json], { type: 'application/json' }),
        `${title}.json`
      )
    } else if (type === 'ZIP') {
      const stored = await assetStore.assets
        .where('[studioId+worldId]')
        .equals([meta.studioId as string, meta.id as string])
        .toArray()

      const assets = await Promise.all(
        stored.map(async (asset) => ({
          id: asset.id,
          ext: asset.ext,
          data: await asset.blob.arrayBuffer()
        }))
      )

      const bundle = await buildWorldZip(json, assets)

      downloadBlob(
        new Blob([bundle as BlobPart], { type: 'application/zip' }),
        `${title}.zip`
      )
    } else {
      // A playable PWA, packed as a .zip the author unzips and serves. Built by
      // fetching the shipped engine and running the same rewrite the desktop
      // runs from disk (lib/worldPWA).
      try {
        const bundle = await buildWorldPWA(json)

        downloadBlob(
          new Blob([bundle as BlobPart], { type: 'application/zip' }),
          `${title}_pwa.zip`
        )
      } catch (error) {
        console.error('[web] PWA export failed', error)
        window.alert(
          'The PWA export could not be built. See the console for details.'
        )
      }
    }

    // let ExportWorldMenu close its progress modal
    ipcRenderer.emit(WINDOW_EVENT_TYPE.EXPORT_WORLD_COMPLETE)
  },

  [WINDOW_EVENT_TYPE.IMPORT_WORLD_GET_JSON]: async () => {
    const file = await pickFile('.json,.zip,application/json,application/zip')

    // Cancelled — the caller treats an absent worldData as "nothing imported".
    if (!file) {
      pendingImportAssets = null

      return { worldData: undefined, jsonPath: undefined }
    }

    // A .zip is the portable bundle (world JSON + assets); a bare .json carries
    // the structure only, its media reading as missing. Either way worldData is
    // validated and upgraded by importWorldData downstream; a bad file surfaces
    // as the caller's "corrupt or empty" error.
    if (file.name.toLowerCase().endsWith('.zip')) {
      const { worldData, assets } = await parseWorldZip(await file.arrayBuffer())

      // held for IMPORT_WORLD_ASSETS, which runs once the world exists
      pendingImportAssets = assets

      return { worldData, jsonPath: WORLD_ZIP_JSON }
    }

    pendingImportAssets = null

    return { worldData: JSON.parse(await file.text()), jsonPath: undefined }
  },

  [WINDOW_EVENT_TYPE.IMPORT_WORLD_ASSETS]: async ({ studioId, worldId }) => {
    // Only a .zip import stashes assets; a .json import leaves this a no-op.
    if (!pendingImportAssets?.length) {
      pendingImportAssets = null

      return
    }

    const assets = pendingImportAssets
    pendingImportAssets = null

    for (const asset of assets) {
      const key = assetKey(
        studioId as string,
        worldId as string,
        asset.id,
        asset.ext
      )
      const blob = new Blob([asset.data as BlobPart], {
        type: mimeForExt(asset.ext)
      })

      await assetStore.assets.put({
        key,
        studioId: studioId as string,
        worldId: worldId as string,
        id: asset.id,
        ext: asset.ext,
        blob,
        bytes: blob.size,
        modified: Date.now()
      })

      revokeObjectUrl(key)
    }
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

// The browser stand-in for webFrame.setZoomFactor (the desktop's native page
// zoom). It scales the whole app with `transform: scale()` on #root rather than
// CSS `zoom`, and the difference is load-bearing: antd positions every popup
// (dropdowns, selects, tooltips) with dom-align, which understands a *transformed*
// ancestor but has no handling for `zoom` — under `zoom` it writes layout-space
// left/top against zoom-scaled rects and lands the menu off-screen, so at a
// non-default UI size no dropdown could be opened. Popups portal to <body>,
// outside the scaled #root, so dom-align positions them correctly at 1:1; they
// render unscaled, which is the accepted trade for having them work at all.
//
// #root is sized to the inverse of the factor so that, once scaled, it fills the
// viewport exactly; html/body overflow is clipped while scaled because the
// unscaled box can momentarily exceed the viewport.
let webZoomFactor = 1

// antd popups (dropdowns, selects, tooltips, popovers, menus) portal to <body>,
// which is outside the scaled #root, so they are positioned correctly by
// dom-align but render at 1:1. Scaling them in place from their positioned
// top-left corner — the corner dom-align pinned — keeps them aligned to their
// trigger while matching the app's size. `!important` beats antd's inline
// animation transform, which would otherwise fight it. Injected once, driven by
// the --esg-ui-scale custom property set below. Modals are intentionally excluded
// (they are centred, and scaling from a corner would shift them off-centre).
const POPUP_SELECTORS = [
  '.ant-dropdown',
  '.ant-select-dropdown',
  '.ant-picker-dropdown',
  '.ant-cascader-dropdown',
  '.ant-mentions-dropdown',
  '.ant-tooltip',
  '.ant-popover',
  '.ant-menu-submenu-popup'
]

const ensurePopupScaleStyle = () => {
  if (!document.head || document.getElementById('esg-popup-scale')) return

  const style = document.createElement('style')

  style.id = 'esg-popup-scale'
  style.textContent = [
    // Positioned popups: dom-align pinned their top-left, so scale from there.
    `${POPUP_SELECTORS.join(
      ','
    )}{transform:scale(var(--esg-ui-scale,1)) !important;transform-origin:top left !important;}`,
    // Modals are centred, not dom-aligned, so scale from their own centre to stay
    // centred: `top center` for the default top-anchored modal (keeps its top edge
    // and horizontal centre), `center` when antd's vertical-centre mode is on.
    `.ant-modal{transform:scale(var(--esg-ui-scale,1)) !important;transform-origin:top center !important;}`,
    `.ant-modal-centered .ant-modal{transform-origin:center center !important;}`
  ].join('')

  document.head.appendChild(style)
}

const webFrame = {
  setZoomFactor: (factor: number) => {
    webZoomFactor = factor

    ensurePopupScaleStyle()
    // read by the popup-scaling stylesheet; on document root, which is *not*
    // transformed, so body-portalled popups can see it
    document.documentElement.style.setProperty('--esg-ui-scale', String(factor))

    const root = document.getElementById('root')

    if (!root) return

    const scaled = factor !== 1

    // Pin #root to the viewport origin while scaled. The global `div { position:
    // relative }` rule otherwise leaves it in flow, where it picks up a small top
    // offset — and because #root is the containing block for the fixed title bar
    // and durability banner, that offset pushes both off their edges. Fixed at
    // (0,0), sized to the inverse of the factor, it scales to fill the viewport.
    root.style.position = scaled ? 'fixed' : ''
    root.style.top = scaled ? '0' : ''
    root.style.left = scaled ? '0' : ''
    root.style.transformOrigin = 'top left'
    root.style.transform = scaled ? `scale(${factor})` : ''
    root.style.width = scaled ? `calc(100vw / ${factor})` : ''
    root.style.height = scaled ? `calc(100vh / ${factor})` : ''

    const overflow = scaled ? 'hidden' : ''

    document.documentElement.style.overflow = overflow
    if (document.body) document.body.style.overflow = overflow
  },
  getZoomFactor: () => webZoomFactor
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
