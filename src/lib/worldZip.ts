/**
 * The portable storyworld bundle — one `.zip` carrying the world's JSON plus its
 * assets — and the single definition of that format, shared by every producer
 * and consumer so they cannot disagree:
 *
 * - the web build (`electronBrowser.ts`) builds it from IndexedDB blobs and reads
 *   it back into IndexedDB;
 * - the desktop build (`main.ts`) builds it from the `userData` asset directory
 *   and extracts it there.
 *
 * A bundle exported from either build imports into the other with its media
 * intact. This is the interchange TODO.md §10 chose over a directory picker.
 *
 * Environment-agnostic on purpose: JSZip runs in both the browser and Node, and
 * the bundle is produced and consumed as a `Uint8Array` so neither a DOM `Blob`
 * nor a Node `Buffer` leaks into this module. Callers wrap it for their side
 * (a `Blob` for a download, a file write in the main process).
 */
import JSZip from 'jszip'

/** The world JSON at the archive root. */
export const WORLD_ZIP_JSON = 'storyworld.json'

/** Assets live under this folder, one file per asset named `<id>.<ext>`. */
export const WORLD_ZIP_ASSETS_DIR = 'assets'

export interface ZipAssetFile {
  id: string
  ext: string
  // ArrayBuffer from a browser file, Uint8Array/Buffer from a Node read — JSZip
  // and Blob accept both.
  data: ArrayBuffer | Uint8Array
}

/**
 * Pack the world JSON and its assets into a bundle. `worldDataJSON` is the exact
 * string the JSON export already produces, so the bundle's JSON is byte-identical
 * to a plain JSON export and imports through the same pipeline.
 */
export const buildWorldZip = async (
  worldDataJSON: string,
  assets: ZipAssetFile[]
): Promise<Uint8Array> => {
  const zip = new JSZip()

  zip.file(WORLD_ZIP_JSON, worldDataJSON)

  const assetsFolder = zip.folder(WORLD_ZIP_ASSETS_DIR)

  for (const asset of assets)
    assetsFolder?.file(`${asset.id}.${asset.ext}`, asset.data)

  return zip.generateAsync({ type: 'uint8array' })
}

/**
 * Read a bundle back. Accepts anything JSZip can load (an `ArrayBuffer` from a
 * browser file, a Node buffer from disk). The JSON is `storyworld.json` if
 * present, else the first `.json` at the archive root, so a hand-renamed export
 * still imports. `worldData` is left `unknown` — validating and upgrading it is
 * `importWorldData`'s job, exactly as for a plain JSON.
 */
export const parseWorldZip = async (
  data: ArrayBuffer | Uint8Array
): Promise<{ worldData: unknown; assets: ZipAssetFile[] }> => {
  const zip = await JSZip.loadAsync(data)

  const jsonEntry =
    zip.file(WORLD_ZIP_JSON) ?? zip.file(/^[^/]+\.json$/)[0]

  if (!jsonEntry)
    throw new Error('Archive contains no storyworld JSON at its root.')

  const worldData = JSON.parse(await jsonEntry.async('string'))

  const assets: ZipAssetFile[] = []
  const prefix = `${WORLD_ZIP_ASSETS_DIR}/`

  const assetEntries = zip.file(
    new RegExp(`^${WORLD_ZIP_ASSETS_DIR}/[^/]+\\.[^/.]+$`)
  )

  for (const entry of assetEntries) {
    const filename = entry.name.slice(prefix.length)
    const dot = filename.lastIndexOf('.')

    if (dot <= 0) continue

    assets.push({
      id: filename.slice(0, dot),
      ext: filename.slice(dot + 1),
      data: await entry.async('arraybuffer')
    })
  }

  return { worldData, assets }
}
