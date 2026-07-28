import { describe, expect, it } from 'vitest'

import {
  addPrecacheEntries,
  PrecachePatchError,
  setPrecacheRevision
} from '../lib/precache'

/**
 * Regression tests for the PWA export's service worker patching.
 *
 * The bug these exist for: Workbox emits `revision:null` for content-hashed
 * filenames, and the original implementation searched for a quoted revision.
 * indexOf returned -1, the search string's length was added to it, and the
 * resulting small positive offset spliced an md5 into unrelated bytes of sw.js.
 *
 * The fixture mirrors the real generated precacheAndRoute call, including the
 * trailing options argument and the mix of quoted and null revisions.
 */
const ENTRY_CHUNK = 'assets/index-C4CH93Cf.js'

const serviceWorker = () =>
  'self.define("x");precacheAndRoute([' +
  '{url:"index.html",revision:"44adbabfd9a8beedd0b716a69104321e"},' +
  `{url:"${ENTRY_CHUNK}",revision:null},` +
  '{url:"assets/index-ddw7ligd.css",revision:null},' +
  '{url:"manifest.webmanifest",revision:"23280722208ecc58431b77aeca8ee4d2"}' +
  '],{});more()'

const precacheEntries = (sw: string) => {
  const open = sw.indexOf('precacheAndRoute([') + 'precacheAndRoute('.length

  let depth = 0
  let cursor = open

  for (; cursor < sw.length; cursor++) {
    if (sw[cursor] === '[') depth++
    else if (sw[cursor] === ']') {
      depth--
      if (depth === 0) {
        cursor++
        break
      }
    }
  }

  return JSON.parse(
    sw.slice(open, cursor).replace(/([{,])(url|revision):/g, '$1"$2":')
  ) as { url: string; revision: string | null }[]
}

const revisionOf = (sw: string, url: string) =>
  precacheEntries(sw).find((entry) => entry.url === url)?.revision

describe('setPrecacheRevision', () => {
  const HASH = 'a'.repeat(32)

  it('replaces a quoted revision', () => {
    expect(revisionOf(setPrecacheRevision(serviceWorker(), 'index.html', HASH), 'index.html')).toBe(HASH)
  })

  it('replaces a null revision, which is what content-hashed chunks get', () => {
    expect(revisionOf(serviceWorker(), ENTRY_CHUNK)).toBeNull()

    expect(
      revisionOf(setPrecacheRevision(serviceWorker(), ENTRY_CHUNK, HASH), ENTRY_CHUNK)
    ).toBe(HASH)
  })

  it('leaves every other entry untouched', () => {
    const patched = setPrecacheRevision(serviceWorker(), ENTRY_CHUNK, HASH)

    expect(revisionOf(patched, 'index.html')).toBe('44adbabfd9a8beedd0b716a69104321e')
    expect(revisionOf(patched, 'assets/index-ddw7ligd.css')).toBeNull()
    expect(precacheEntries(patched)).toHaveLength(4)
  })

  it('keeps the code around the precache manifest intact', () => {
    const patched = setPrecacheRevision(serviceWorker(), 'index.html', HASH)

    expect(patched.startsWith('self.define("x");')).toBe(true)
    expect(patched.endsWith('],{});more()')).toBe(true)
  })

  it('throws rather than splicing when the url is absent', () => {
    expect(() =>
      setPrecacheRevision(serviceWorker(), 'assets/not-in-the-manifest.js', HASH)
    ).toThrow(PrecachePatchError)
  })

  it('does not corrupt the service worker when it throws', () => {
    const sw = serviceWorker()

    try {
      setPrecacheRevision(sw, 'missing.js', HASH)
    } catch {
      // expected
    }

    expect(sw).toBe(serviceWorker())
  })
})

describe('addPrecacheEntries', () => {
  const assets = [
    { url: 'assets/content/a.mp3', revision: 'aaaa' },
    { url: 'assets/content/b.png', revision: 'bbbb' }
  ]

  it('inserts after the anchor entry', () => {
    const entries = precacheEntries(
      addPrecacheEntries(serviceWorker(), 'manifest.webmanifest', assets)
    )

    expect(entries).toHaveLength(6)
    expect(entries.slice(-2)).toEqual(assets)
    expect(entries[3].url).toBe('manifest.webmanifest')
  })

  it('is a no-op for an empty list', () => {
    expect(addPrecacheEntries(serviceWorker(), 'manifest.webmanifest', [])).toBe(
      serviceWorker()
    )
  })

  it('throws when the anchor is absent', () => {
    expect(() =>
      addPrecacheEntries(serviceWorker(), 'nope.webmanifest', assets)
    ).toThrow(PrecachePatchError)
  })
})

describe('url escaping', () => {
  it('treats regex metacharacters in a url literally', () => {
    const sw =
      'precacheAndRoute([{url:"assets/a+b(c).js",revision:null},{url:"assets/axbxcxjs",revision:"zzz"}],{})'

    const patched = setPrecacheRevision(sw, 'assets/a+b(c).js', 'c'.repeat(32))

    expect(revisionOf(patched, 'assets/a+b(c).js')).toBe('c'.repeat(32))
    expect(revisionOf(patched, 'assets/axbxcxjs')).toBe('zzz')
  })
})
