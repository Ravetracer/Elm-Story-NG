/**
 * Helpers for rewriting the Workbox precache manifest inside a generated
 * service worker.
 *
 * The PWA export copies the built Storyteller engine, then rewrites the entry
 * chunk to inject storyworld data and the HTML to inject the title and
 * description. Because those files keep their original names, the service
 * worker's precache revisions have to be updated or a returning visitor is
 * served the previous build from cache.
 *
 * This replaced hand-computed string offsets. That approach assumed every
 * entry's revision was a quoted md5, but Workbox emits `revision:null` for
 * content-hashed filenames such as the entry chunk. `indexOf` returned -1 for
 * those, and the negative index was then added to the search string's length,
 * producing a small positive offset that spliced the hash into unrelated bytes
 * of the service worker.
 *
 * A precache entry looks like:
 *
 *   {url:"index.html",revision:"44adbabfd9a8beedd0b716a69104321e"}
 *   {url:"assets/index-C4CH93Cf.js",revision:null}
 */

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Matches the single precache entry object for `url`. Key order is not assumed
 * and the revision may be a quoted string or the literal null.
 */
const entryPattern = (url: string): RegExp =>
  new RegExp(`\\{[^{}]*url:"${escapeRegExp(url)}"[^{}]*\\}`)

const locate = (
  serviceWorker: string,
  url: string
): { text: string; start: number; end: number } | null => {
  const match = serviceWorker.match(entryPattern(url))

  if (!match || match.index === undefined) return null

  return {
    text: match[0],
    start: match.index,
    end: match.index + match[0].length
  }
}

export class PrecachePatchError extends Error {}

/**
 * Returns `serviceWorker` with the precache revision for `url` set to
 * `revision`.
 *
 * @throws PrecachePatchError when the entry cannot be found or rewritten, so a
 * changed Workbox output format surfaces instead of silently damaging the file.
 */
export const setPrecacheRevision = (
  serviceWorker: string,
  url: string,
  revision: string
): string => {
  const found = locate(serviceWorker, url)

  if (!found) {
    throw new PrecachePatchError(
      `No precache entry for "${url}" was found in the service worker.`
    )
  }

  const updated = found.text.replace(
    /revision:(?:null|"[^"]*")/,
    `revision:"${revision}"`
  )

  if (updated === found.text) {
    throw new PrecachePatchError(
      `The precache entry for "${url}" has no recognizable revision field: ${found.text}`
    )
  }

  // Spliced by index rather than via String.replace so that '$' sequences in
  // the replacement are not interpreted.
  return (
    serviceWorker.slice(0, found.start) +
    updated +
    serviceWorker.slice(found.end)
  )
}

/**
 * Returns `serviceWorker` with `entries` added to the precache manifest,
 * inserted after the entry for `afterUrl`.
 *
 * @throws PrecachePatchError when the anchor entry cannot be found.
 */
export const addPrecacheEntries = (
  serviceWorker: string,
  afterUrl: string,
  entries: { url: string; revision: string }[]
): string => {
  if (entries.length === 0) return serviceWorker

  const found = locate(serviceWorker, afterUrl)

  if (!found) {
    throw new PrecachePatchError(
      `No precache entry for "${afterUrl}" was found to insert after.`
    )
  }

  const serialized = entries
    .map(({ url, revision }) => `,{url:"${url}",revision:"${revision}"}`)
    .join('')

  return (
    serviceWorker.slice(0, found.end) +
    serialized +
    serviceWorker.slice(found.end)
  )
}
