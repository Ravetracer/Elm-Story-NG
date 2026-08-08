import { describe, expect, it } from 'vitest'

import {
  buildWorldZip,
  parseWorldZip,
  WORLD_ZIP_JSON,
  WORLD_ZIP_ASSETS_DIR
} from '../lib/worldZip'

/**
 * The portable bundle (lib/worldZip) is the single interchange between the
 * desktop and web builds, so what one packs the other must read back exactly —
 * the JSON byte-for-byte and every asset's bytes intact. JSZip runs in Node, so
 * the round trip is exercised directly here.
 */
describe('world zip interchange', () => {
  const worldJSON = JSON.stringify({
    _: { id: 'world-1', studioId: 'studio-1', title: 'Test', engine: '0.8.0' },
    events: []
  })

  const asset = {
    id: 'abc-123',
    ext: 'webp',
    data: new Uint8Array([1, 2, 3, 4, 250, 251, 252, 253])
  }

  it('round-trips the world JSON and its assets', async () => {
    const bundle = await buildWorldZip(worldJSON, [asset])
    const { worldData, assets } = await parseWorldZip(bundle)

    // JSON survives verbatim
    expect(JSON.stringify(worldData)).toBe(worldJSON)

    // the asset survives, id/ext parsed from its filename and bytes intact
    expect(assets).toHaveLength(1)
    expect(assets[0].id).toBe('abc-123')
    expect(assets[0].ext).toBe('webp')
    expect([...new Uint8Array(assets[0].data as ArrayBuffer)]).toEqual([
      ...asset.data
    ])
  })

  it('places the JSON at the root and assets under the assets folder', async () => {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await buildWorldZip(worldJSON, [asset]))

    expect(zip.file(WORLD_ZIP_JSON)).not.toBeNull()
    expect(zip.file(`${WORLD_ZIP_ASSETS_DIR}/${asset.id}.${asset.ext}`)).not.toBeNull()
  })

  it('reads a bundle with no assets', async () => {
    const { worldData, assets } = await parseWorldZip(
      await buildWorldZip(worldJSON, [])
    )

    expect(JSON.stringify(worldData)).toBe(worldJSON)
    expect(assets).toEqual([])
  })

  it('rejects an archive with no storyworld JSON', async () => {
    const JSZip = (await import('jszip')).default
    const empty = await new JSZip().generateAsync({ type: 'uint8array' })

    await expect(parseWorldZip(empty)).rejects.toThrow(/no storyworld JSON/i)
  })
})
