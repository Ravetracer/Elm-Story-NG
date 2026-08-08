/**
 * The PWA rewrite, shared by the desktop main process (`main.ts`) and the
 * browser adapter (`electronBrowser.ts`) exactly as `worldZip.ts` shares the ZIP
 * format. Both start from the same built Storyteller engine (`assets/engine-dist`,
 * which the desktop copies from disk and the web build ships and fetches) and have
 * to make the same edits to turn it into a specific storyworld's playable app:
 *
 * - inject the title/description into `index.html` and the web manifest,
 * - inject the world id and the compiled storyteller data into the entry chunk,
 * - and rewrite the Workbox precache so a returning visitor is not served the
 *   pre-injection build from cache (#379, #373).
 *
 * The file I/O differs per environment (Node `fs` vs `fetch` + JSZip), so this
 * module is the pure part between them: given the engine's text files and the
 * world's data it returns the rewritten text files. `md5` is injected rather than
 * imported so the module stays environment-agnostic like `worldZip`; the content
 * assets' revisions are md5s of their bytes, which each caller already has.
 */
import format from './compiler/format'
import { addPrecacheEntries, setPrecacheRevision } from './precache'
import { WorldDataJSON } from './transport/types/0.8.0'

// A content asset destined for `assets/content/<id>.<ext>`, with the md5 of its
// bytes precomputed by the caller for the precache manifest.
export interface PWAContentAsset {
  id: string
  ext: string
  revision: string
}

export interface PWARewriteInput {
  worldData: WorldDataJSON
  // manifest['index.html'].file — the content-hashed entry chunk's filename.
  entryFile: string
  html: string
  js: string
  webmanifest: string
  sw: string
  contentAssets: PWAContentAsset[]
  md5: (input: string) => string
  // Called instead of throwing when the precache manifest cannot be patched: a
  // stale cache for returning visitors is a smaller problem than an export that
  // never completes or a damaged service worker (#379, #373).
  onPrecacheError?: (error: unknown) => void
}

export interface PWARewriteOutput {
  html: string
  js: string
  webmanifest: string
  sw: string
}

// The description shown when the author left the storyworld's own blank.
export const worldDescriptionFor = (worldData: WorldDataJSON): string =>
  worldData._.description ||
  `${worldData._.title} is a storyworld made with Elm Story - NG.`

export const rewritePWAFiles = ({
  worldData,
  entryFile,
  html,
  js,
  webmanifest,
  sw,
  contentAssets,
  md5,
  onPrecacheError
}: PWARewriteInput): PWARewriteOutput => {
  const description = worldDescriptionFor(worldData)

  const rewrittenHtml = html
    .replace(/___worldTitle___/g, worldData._.title)
    .replace(/___worldDescription___/g, description)

  const rewrittenJs = js
    .replace('___worldId___', worldData._.id)
    .replace('"___storytellerData___"', JSON.stringify(format(worldData)))

  const rewrittenWebmanifest = webmanifest
    .replace(/___worldTitle___/g, worldData._.title)
    .replace('___worldDescription___', description)

  let rewrittenSw = sw

  // index.html and the entry chunk keep their names but no longer match their
  // precache revisions; the content assets were added after the engine was
  // built, so they are absent from the manifest entirely.
  try {
    rewrittenSw = setPrecacheRevision(
      rewrittenSw,
      'index.html',
      md5(rewrittenHtml)
    )
    rewrittenSw = setPrecacheRevision(rewrittenSw, entryFile, md5(rewrittenJs))

    if (contentAssets.length > 0) {
      rewrittenSw = addPrecacheEntries(
        rewrittenSw,
        'manifest.webmanifest',
        contentAssets.map(({ id, ext, revision }) => ({
          url: `assets/content/${id}.${ext}`,
          revision
        }))
      )
    }
  } catch (error) {
    if (onPrecacheError) onPrecacheError(error)
    else throw error
  }

  return {
    html: rewrittenHtml,
    js: rewrittenJs,
    webmanifest: rewrittenWebmanifest,
    sw: rewrittenSw
  }
}
