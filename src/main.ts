/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * `npm run build` compiles this file to `./out/main/index.js` via
 * electron-vite. Paths resolved against __dirname are therefore relative to
 * `out/main`, not to `src`.
 */
import logger from './lib/logger'

import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  protocol,
  net
} from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import MenuBuilder from './menu'
import contextMenu from 'electron-context-menu'
import electronDebug from 'electron-debug'
import fs, { outputFile } from 'fs-extra'
import format from './lib/compiler/format'
import md5 from 'md5'
import { addPrecacheEntries, setPrecacheRevision } from './lib/precache'

import { WINDOW_EVENT_TYPE } from './lib/events'

import {
  WorldId,
  StudioId,
  WORLD_EXPORT_TYPE,
  PLATFORM_TYPE
} from './data/types'
import { WorldDataJSON } from './lib/transport/types/0.7.0'

// A named rather than default export: the main entry otherwise mixes named and
// default exports, which Rollup warns about.
export class AppUpdater {
  constructor() {
    log.transports.file.level = 'info'
    autoUpdater.logger = log
    autoUpdater.checkForUpdatesAndNotify()
  }
}

contextMenu({
  showLookUpSelection: false,
  showCopyImage: false,
  showCopyImageAddress: false,
  showSaveImageAs: false,
  showSaveLinkAs: false,
  showInspectElement: false,
  showServices: false,
  showSearchWithGoogle: false,
  // electron-context-menu adds Select All on every platform except macOS
  // unless this is false. The option postdates the version this configuration
  // was written against, so the entry began appearing on Linux and Windows
  // after the upgrade.
  showSelectAll: false
})

let mainWindow: BrowserWindow | null = null

const userDataPath = app.getPath('userData'),
  userCachePath = `${userDataPath}/.cache`,
  userTrashPath = `${userDataPath}/.trash`

/**
 * User assets live outside the application bundle, under userData, and are
 * referenced by the renderer in url(), img src and audio src.
 *
 * GET_ASSET used to hand back a bare filesystem path. That worked while the
 * renderer was loaded from a file:// URL, because an absolute path resolves
 * against the file:// origin. The development renderer is now served over http
 * by Vite, where the same path resolves against localhost and 404s, leaving
 * images blank. Prefixing with file:// does not help either: a file://
 * subresource is not permitted from an http:// document.
 *
 * A custom scheme sidesteps both problems and behaves identically in
 * development and in a packaged build, without relaxing webSecurity.
 */
const ASSET_SCHEME = 'esg-asset'

// The roots this scheme is allowed to serve, keyed by URL host.
const ASSET_ROOTS: Record<string, string> = {
  asset: path.join(userDataPath, 'assets'),
  cache: userCachePath
}

// Registration has to happen before the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      // The renderer's origin is http://localhost during development, so
      // requests to this scheme are cross-origin. Images and audio elements do
      // not care, but anything going through fetch or XHR does, and Howler
      // loads audio that way.
      corsEnabled: true
    }
  }
])

const assetUrl = (root: keyof typeof ASSET_ROOTS, ...segments: string[]) =>
  `${ASSET_SCHEME}://${root}/${segments.map(encodeURIComponent).join('/')}`

const registerAssetProtocol = () => {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const { host, pathname } = new URL(request.url),
      root = ASSET_ROOTS[host]

    if (!root) return new Response('Unknown asset root', { status: 404 })

    const requested = path.resolve(
      root,
      decodeURIComponent(pathname).replace(/^\/+/, '')
    )

    // Refuse anything that resolves outside its root.
    if (requested !== root && !requested.startsWith(root + path.sep)) {
      logger.error(`Refused asset outside of ${host}: ${request.url}`)

      return new Response('Forbidden', { status: 403 })
    }

    if (!(await fs.pathExists(requested))) {
      return new Response('Not found', { status: 404 })
    }

    const response = await net.fetch(pathToFileURL(requested).toString())

    // Pass the file through with a permissive CORS header. Only paths under the
    // roots above are reachable, and the scheme is not exposed outside the app.
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'access-control-allow-origin': '*'
      }
    })
  })
}

logger.info(`ENV: ${process.env.NODE_ENV}`)

// electron-vite emits sourcemaps for the main process and Electron consumes
// them natively, so the previous source-map-support hook is no longer needed.

const isDebugBuild =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'

if (isDebugBuild) {
  // electron-debug opens the developer tools on window creation by default.
  // The keyboard shortcuts it installs are the useful part, so the panel is
  // left closed and opened on demand with F12 or Ctrl/Cmd+Shift+I. Set
  // OPEN_DEVTOOLS=true to restore the previous behaviour.
  electronDebug({ showDevTools: process.env.OPEN_DEVTOOLS === 'true' })
}

const installExtensions = async () => {
  logger.info(`Installing dev tools...`)

  try {
    // Imported lazily so a failed or offline extension download cannot delay
    // startup of a production build, and so the dependency stays out of the
    // packaged bundle's hot path.
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import(
      'electron-devtools-installer'
    )

    await installExtension(REACT_DEVELOPER_TOOLS, {
      forceDownload: !!process.env.UPGRADE_EXTENSIONS,
      loadExtensionOptions: { allowFileAccess: true }
    })
  } catch (error) {
    logger.info(`Unable to install dev tools: ${error}`)
  }
}

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions()
  }

  // __dirname is out/main in an unpackaged build, so the repository's assets
  // directory is two levels up rather than one.
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets')

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths)
  }

  const { width, height } =
    process.env.NODE_ENV === 'development'
      ? {
          width: 1920,
          height: 1080
        }
      : { width: 1366, height: 728 }

  mainWindow = new BrowserWindow({
    show: false,
    width,
    height,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // used for react dev tools
    },
    frame: false,
    backgroundColor: '#0a0a0a'
  })

  // electron-vite exports the dev server's address as ELECTRON_RENDERER_URL so
  // the renderer can be served with HMR. Packaged and preview builds load the
  // emitted HTML from out/renderer instead.
  if (isDebugBuild && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  let eventsReady = false

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined')
    }

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }

    mainWindow.webContents.send(
      mainWindow.fullScreen
        ? WINDOW_EVENT_TYPE.FULLSCREEN
        : WINDOW_EVENT_TYPE.FLOAT
    )

    // elmstorygames/feedback#284
    mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor())

    mainWindow.webContents.send(WINDOW_EVENT_TYPE.PLATFORM, [os.platform()])

    if (!eventsReady) {
      eventsReady = true

      mainWindow.on('enter-full-screen', () =>
        mainWindow?.webContents.send(WINDOW_EVENT_TYPE.FULLSCREEN)
      )
      mainWindow.on('leave-full-screen', () =>
        mainWindow?.webContents.send(WINDOW_EVENT_TYPE.FLOAT)
      )

      ipcMain.on(WINDOW_EVENT_TYPE.QUIT, () => app.quit())
      ipcMain.on(WINDOW_EVENT_TYPE.MINIMIZE, () => mainWindow?.minimize())
      ipcMain.on(WINDOW_EVENT_TYPE.TOGGLE_FULLSCREEN, (_, isFullscreen) => {
        if (mainWindow) {
          if (isFullscreen && !mainWindow.fullScreen)
            mainWindow.setFullScreen(true)
          if (!isFullscreen && mainWindow.fullScreen)
            mainWindow.setFullScreen(false)
        }
      })

      ipcMain.on(WINDOW_EVENT_TYPE.OPEN_EXTERNAL_LINK, (_, [address]) =>
        shell.openExternal(address)
      )

      ipcMain.handle(
        WINDOW_EVENT_TYPE.SAVE_ASSET,
        async (
          _,
          {
            studioId,
            worldId,
            id,
            data,
            ext
          }: {
            studioId: StudioId
            worldId: WorldId
            id: string
            data: ArrayBuffer
            ext: 'jpeg' | 'webp' | 'mp3'
          }
        ): Promise<string | null> => {
          const path = `${userDataPath}/assets/${studioId}/${worldId}/${id}.${ext}`

          try {
            await outputFile(path, Buffer.from(data))

            return path
          } catch (error) {
            // TODO: return error to app
            throw error
          }
        }
      )

      ipcMain.handle(
        WINDOW_EVENT_TYPE.RESTORE_ASSET,
        async (
          _,
          {
            studioId,
            worldId,
            id,
            ext
          }: {
            studioId: StudioId
            worldId: WorldId
            id: string
            data: ArrayBuffer
            ext: 'jpeg' | 'webp'
          }
        ) => {
          const assetsPath = `${userDataPath}/assets/${studioId}/${worldId}`,
            assetInTrashPath = `${userTrashPath}/${id}.${ext}`

          try {
            if (!(await fs.pathExists(assetInTrashPath))) return

            await fs.move(assetInTrashPath, `${assetsPath}/${id}.${ext}`)
          } catch (error) {
            // TODO: return error to app
            throw error
          }
        }
      )

      ipcMain.handle(
        WINDOW_EVENT_TYPE.REMOVE_ASSET,
        async (
          _,
          {
            studioId,
            worldId,
            id,
            ext,
            trash
          }: {
            studioId: StudioId
            worldId: WorldId
            id: string
            data: ArrayBuffer
            ext: 'jpeg' | 'webp'
            trash?: boolean
          }
        ) => {
          const assetsPath = `${userDataPath}/assets/${studioId}/${worldId}`,
            assetPath = `${assetsPath}/${id}.${ext}`

          try {
            if (!(await fs.pathExists(assetPath))) return

            if (trash) {
              // elmstorygames/feedback#239
              await fs.move(assetPath, `${userTrashPath}/${id}.${ext}`, {
                overwrite: true
              })
            }

            if (!trash) {
              await fs.remove(assetPath)
            }
          } catch (error) {
            // TODO: return error to app
            // see api().events.removeDeadImageAssets
          }
        }
      )

      // removes studio or world assets
      ipcMain.handle(
        WINDOW_EVENT_TYPE.REMOVE_ASSETS,
        async (
          _,
          {
            studioId,
            worldId,
            type
          }: { studioId: StudioId; worldId?: WorldId; type: 'STUDIO' | 'GAME' }
        ) => {
          if (type === 'GAME' && !worldId)
            throw 'Unable to remove storyworld assets. Missing ID.'

          const root = `${userDataPath}/assets`

          let path: string | undefined

          switch (type) {
            case 'STUDIO':
              path = `${root}/${studioId}/`
              break
            case 'GAME':
              path = `${root}/${studioId}/${worldId}`
              break
            default:
              break
          }

          path && (await fs.remove(path))
        }
      )

      // TODO: also return binary data
      ipcMain.handle(
        WINDOW_EVENT_TYPE.GET_ASSET,
        async (
          _,
          {
            studioId,
            worldId,
            id,
            ext
          }: {
            studioId: StudioId
            worldId: WorldId
            id: string
            ext: 'jpeg' | 'webp' | 'mp3'
          }
        ) => {
          let platformAssetPath: string

          switch (os.platform()) {
            case PLATFORM_TYPE.WINDOWS:
              platformAssetPath = `${userDataPath}/assets/${studioId}/${worldId}/${id}.${ext}`.replace(
                /\\/g,
                '/'
              )
              break
            case PLATFORM_TYPE.MACOS:
            case PLATFORM_TYPE.LINUX:
            default:
              platformAssetPath = `${userDataPath}/assets/${studioId}/${worldId}/${id}.${ext}`

              break
          }

          const exists = await fs.pathExists(platformAssetPath)

          // Callers embed this value in url(), img src and audio src, so it is
          // an esg-asset:// URL rather than a filesystem path. See ASSET_SCHEME.
          // The surrounding quotes are kept because consumers interpolate the
          // result directly into CSS url(), where they matter for any path
          // containing spaces.
          const assetFile = `${id}.${ext}`

          if (!exists)
            return [`"${assetUrl('asset', studioId, worldId, assetFile)}"`, false]

          // elmstorygames/feedback#238
          // copy asset to cache if asset is mp3 and return url
          if (ext === 'mp3') {
            const platformAssetCopyPath = `${userCachePath}/${assetFile}`

            try {
              // elmstorygames/feedback#243
              const assetCacheExists = await fs.pathExists(
                platformAssetCopyPath
              )

              if (!assetCacheExists) {
                await fs.copy(platformAssetPath, platformAssetCopyPath)
              }

              return [`"${assetUrl('cache', assetFile)}"`, true]
            } catch (error) {
              throw error
            }
          }

          return [
            `"${assetUrl('asset', studioId, worldId, assetFile)}"`,
            exists
          ]
        }
      )

      ipcMain.handle(
        WINDOW_EVENT_TYPE.IMPORT_WORLD_GET_JSON,
        async (
          _
        ): Promise<{ worldData?: WorldDataJSON; jsonPath?: string }> => {
          if (mainWindow) {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: `Select storyworld JSON to import`,
              properties: ['openFile']
            })

            if (!result.canceled) {
              try {
                return {
                  worldData: JSON.parse(
                    await fs.readFile(result.filePaths[0], 'utf8')
                  ),
                  jsonPath: result.filePaths[0]
                }
              } catch (error) {
                throw error
              }
            }

            return { worldData: undefined, jsonPath: undefined }
          }

          return { worldData: undefined, jsonPath: undefined }
        }
      )

      ipcMain.handle(
        WINDOW_EVENT_TYPE.IMPORT_WORLD_ASSETS,
        async (
          _,
          {
            studioId,
            worldId,
            jsonPath
          }: { studioId: StudioId; worldId: WorldId; jsonPath: string }
        ) => {
          try {
            const worldDirectory = path.dirname(jsonPath)

            await fs.copy(
              `${worldDirectory}/assets`,
              `${userDataPath}/assets/${studioId}/${worldId}/`.replace(
                /\\/g,
                '/'
              )
            )
          } catch (error) {
            // directory doesn't exist; skip
          }
        }
      )

      ipcMain.handle(
        WINDOW_EVENT_TYPE.EXPORT_WORLD_START,
        async (
          _,
          {
            type: worldType,
            data: worldDataAsString
          }: { type: WORLD_EXPORT_TYPE; data: string }
        ) => {
          if (mainWindow) {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: `Select folder to export storyworld as ${worldType}`,
              properties: ['openDirectory']
            })

            if (!result.canceled) {
              mainWindow.webContents.send(
                WINDOW_EVENT_TYPE.EXPORT_WORLD_PROCESSING
              )

              const parsedWorldData: WorldDataJSON = JSON.parse(
                worldDataAsString
              )

              const baseWorldFolderName = `${parsedWorldData._.title
                  .replace(/[^A-Z0-9]+/gi, '-')
                  .toLocaleLowerCase()}_${parsedWorldData._.version}`,
                fullWorldFolderName = `${baseWorldFolderName}_${Date.now()}`

              const savePathBase = result.filePaths[0],
                savePathFull = `${savePathBase}/${fullWorldFolderName}`

              if (worldType === WORLD_EXPORT_TYPE.JSON) {
                try {
                  await fs.outputFile(
                    `${savePathFull}/${baseWorldFolderName}.json`,
                    worldDataAsString
                  )

                  try {
                    await fs.copy(
                      `${userDataPath}/assets/${parsedWorldData._.studioId}/${parsedWorldData._.id}`.replace(
                        /\\/g,
                        '/'
                      ),
                      `${savePathFull}/assets`
                    )
                  } catch (error) {
                    logger.info(`Assets don't exist. Skipping...`)
                  }
                } catch (error) {
                  throw error
                }
              }

              if (worldType === WORLD_EXPORT_TYPE.PWA) {
                const enginePath = app.isPackaged
                  ? path.join(process.resourcesPath, 'assets/engine-dist')
                  : path.join(__dirname, '../../assets/engine-dist')

                try {
                  await fs.copy(enginePath, savePathFull)

                  try {
                    await fs.copy(
                      `${userDataPath}/assets/${parsedWorldData._.studioId}/${parsedWorldData._.id}/`.replace(
                        /\\/g,
                        '/'
                      ),
                      `${savePathFull}/assets/content`
                    )
                  } catch (error) {
                    logger.info(`Assets don't exist. Skipping...`)
                  }

                  const manifest: {
                    'index.html': { file: string }
                  } = JSON.parse(
                    await fs.readFile(`${savePathFull}/manifest.json`, 'utf8')
                  )

                  let [html, js, webmanifest, sw] = await Promise.all([
                    fs.readFile(`${savePathFull}/index.html`, 'utf8'),
                    fs.readFile(
                      `${savePathFull}/${manifest['index.html'].file}`,
                      'utf8'
                    ),
                    fs.readFile(`${savePathFull}/manifest.webmanifest`, 'utf8'),
                    fs.readFile(`${savePathFull}/sw.js`, 'utf8')
                  ])

                  const worldDescription =
                    parsedWorldData._.description ||
                    `${parsedWorldData._.title} is a storyworld made with Elm Story.`

                  html = html
                    .replace(/___worldTitle___/g, parsedWorldData._.title)
                    .replace(/___worldDescription___/g, worldDescription)
                  js = js
                    .replace('___worldId___', parsedWorldData._.id)
                    .replace(
                      '"___storytellerData___"',
                      JSON.stringify(format(parsedWorldData))
                    )
                  webmanifest = webmanifest
                    .replace(/___worldTitle___/g, parsedWorldData._.title)
                    .replace('___worldDescription___', worldDescription)

                  // #379, #373
                  //
                  // index.html and the entry chunk were both rewritten above,
                  // so their precache revisions no longer describe their
                  // contents. Failures here are reported and skipped rather
                  // than thrown: a stale cache for returning visitors is a far
                  // smaller problem than a damaged service worker or an export
                  // that never completes.
                  try {
                    sw = setPrecacheRevision(sw, 'index.html', md5(html))
                    sw = setPrecacheRevision(
                      sw,
                      manifest['index.html'].file,
                      md5(js)
                    )
                  } catch (error) {
                    logger.error(
                      `Unable to update service worker precache revisions. The ` +
                        `exported storyworld may be served from a stale cache ` +
                        `on update. ${error}`
                    )
                  }

                  // Content assets are copied in after the engine was built, so
                  // they are absent from the generated precache manifest.
                  try {
                    const contentAssetsList = await fs.readdir(
                      `${savePathFull}/assets/content`
                    )

                    if (contentAssetsList.length > 0) {
                      const assets = await Promise.all(
                        contentAssetsList.map(async (assetFilename) => ({
                          url: `assets/content/${assetFilename}`,
                          revision: md5(
                            await fs.readFile(
                              `${savePathFull}/assets/content/${assetFilename}`
                            )
                          )
                        }))
                      )

                      sw = addPrecacheEntries(sw, 'manifest.webmanifest', assets)
                    }
                  } catch (error) {
                    logger.info(
                      `Skipping content asset precaching. Asset content does ` +
                        `not exist or could not be added. ${error}`
                    )
                  }

                  await Promise.all([
                    fs.writeFile(`${savePathFull}/index.html`, html),
                    fs.writeFile(
                      `${savePathFull}/${manifest['index.html'].file}`,
                      js
                    ),
                    fs.writeFile(
                      `${savePathFull}/manifest.webmanifest`,
                      webmanifest
                    ),
                    fs.writeFile(`${savePathFull}/sw.js`, sw),
                    fs.remove(`${savePathFull}/manifest.json`)
                  ])
                } catch (error) {
                  throw error
                }
              }

              setTimeout(() => {
                shell.openPath(savePathFull)

                mainWindow?.webContents.send(
                  WINDOW_EVENT_TYPE.EXPORT_WORLD_COMPLETE
                )
              }, 5000)
            }
          }
        }
      )
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const menuBuilder = new MenuBuilder(mainWindow)
  menuBuilder.buildMenu()

  // Open urls in the user's browser
  // Open external links in the user's browser rather than a new Electron
  // window. Replaces the 'new-window' event, which was removed in Electron 22.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)

    return { action: 'deny' }
  })

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  // new AppUpdater()
}

// elmstorygames/feedback#110
fs.emptyDir(`${userTrashPath}`)

// elmstorygames/feedback#238
fs.emptyDir(`${userCachePath}`)

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app
  .whenReady()
  .then(registerAssetProtocol)
  .then(createWindow)
  .catch(logger.info)

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow()
})
