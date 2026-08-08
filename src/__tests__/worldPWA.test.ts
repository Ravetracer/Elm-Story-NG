import { describe, expect, it, vi } from 'vitest'

import md5 from 'md5'

import { rewritePWAFiles, worldDescriptionFor } from '../lib/worldPWA'
import { WorldDataJSON } from '../lib/transport/types/0.8.0'

/**
 * The PWA rewrite (lib/worldPWA) is shared verbatim by the desktop main process
 * and the browser adapter, so what one produces the other must produce too. The
 * file I/O differs per environment; this exercises the pure part between them.
 *
 * The precache patching itself is covered in depth by precache.test.ts; here the
 * concern is that the placeholders are all filled and the sw revisions are the
 * md5s of the *rewritten* files, since that is the coupling that broke on #379.
 */

// A complete-enough world for format() to compile: every collection present (so
// its Object.keys walk does not throw) and _.children an array.
const worldData = (): WorldDataJSON =>
  ({
    _: {
      id: 'world-1',
      studioId: 'studio-1',
      title: 'The Test World',
      description: '',
      engine: '0.8.0',
      version: '0.8.0',
      children: []
    },
    characters: {},
    choices: {},
    conditions: {},
    effects: {},
    events: {},
    inputs: {},
    jumps: {},
    objectConditions: {},
    objects: {},
    paths: {},
    recipes: {},
    scenes: {},
    variables: {}
  } as unknown as WorldDataJSON)

const ENTRY = 'assets/index-C4CH93Cf.js'

const serviceWorker = () =>
  'self.define("x");precacheAndRoute([' +
  '{url:"index.html",revision:"old-index-revision"},' +
  `{url:"${ENTRY}",revision:null},` +
  '{url:"manifest.webmanifest",revision:"web-revision"}' +
  '],{});more()'

const input = (overrides = {}) => ({
  worldData: worldData(),
  entryFile: ENTRY,
  html: '<title>___worldTitle___</title><meta content="___worldDescription___">',
  js: 'const id="___worldId___";const data="___storytellerData___";',
  webmanifest: '{"name":"___worldTitle___","description":"___worldDescription___"}',
  sw: serviceWorker(),
  contentAssets: [],
  md5,
  ...overrides
})

describe('PWA rewrite', () => {
  it('fills every placeholder in the html, entry chunk and web manifest', () => {
    const out = rewritePWAFiles(input())

    for (const text of [out.html, out.js, out.webmanifest]) {
      expect(text).not.toContain('___')
    }

    expect(out.html).toContain('The Test World')
    expect(out.js).toContain('const id="world-1"')
    // format() lzw-packs the world to a number array, and JSON.stringify of that
    // replaces the *quoted* placeholder — so the engine JSON.parses an array.
    expect(out.js).toMatch(/const data=\[[\d,]+\];/)
    expect(out.js).not.toContain('___storytellerData___')
  })

  it('sets the sw precache revisions to the md5s of the rewritten files', () => {
    const out = rewritePWAFiles(input())

    expect(out.sw).toContain(`{url:"index.html",revision:"${md5(out.html)}"}`)
    expect(out.sw).toContain(`{url:"${ENTRY}",revision:"${md5(out.js)}"}`)
  })

  it('adds content assets to the precache after the web manifest', () => {
    const out = rewritePWAFiles(
      input({
        contentAssets: [
          { id: 'a1', ext: 'webp', revision: 'rev-a1' },
          { id: 'a2', ext: 'mp3', revision: 'rev-a2' }
        ]
      })
    )

    expect(out.sw).toContain(
      '{url:"assets/content/a1.webp",revision:"rev-a1"}'
    )
    expect(out.sw).toContain('{url:"assets/content/a2.mp3",revision:"rev-a2"}')
    // inserted after the manifest entry, not before it
    expect(out.sw.indexOf('manifest.webmanifest')).toBeLessThan(
      out.sw.indexOf('assets/content/a1.webp')
    )
  })

  it('reports a precache patch failure instead of throwing', () => {
    const onPrecacheError = vi.fn()

    const out = rewritePWAFiles(
      input({ sw: 'precacheAndRoute([]);', onPrecacheError })
    )

    // the content is still rewritten even when the sw cannot be patched
    expect(out.html).toContain('The Test World')
    expect(onPrecacheError).toHaveBeenCalledOnce()
  })

  it('falls back to a generated description when the world has none', () => {
    expect(worldDescriptionFor(worldData())).toBe(
      'The Test World is a storyworld made with Elm Story - NG.'
    )
  })
})
