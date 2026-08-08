import { describe, expect, it } from 'vitest'

import {
  ASSET_MEDIA,
  ASSET_REFERENCE_TYPE,
  assetMedia,
  AssetFile,
  collateAssets,
  collectAssetReferences,
  formatAssetBytes,
  isReferenceClearable
} from '../lib/assets'

import {
  Character,
  CHARACTER_MASK_TYPE,
  Event,
  EVENT_TYPE,
  Scene,
  ELEMENT_TYPE
} from '../data/types'

/**
 * Orphan detection for the asset manager.
 *
 * The join is between a flat directory of `<id>.<ext>` files and the only four
 * places a storyworld names an asset: Character.masks[].assetId, Event.images[],
 * Event.audio[0] and Scene.audio[0]. Miss one and the manager offers to delete
 * an asset that is in use.
 */
const character = (
  id: string,
  title: string,
  masks: Array<[CHARACTER_MASK_TYPE, string | undefined]>
): Character => ({
  id,
  title,
  worldId: 'world',
  masks: masks.map(([type, assetId]) => ({ type, assetId, active: true })),
  refs: [],
  tags: []
})

const event = (
  id: string,
  title: string,
  { images = [], audio }: { images?: string[]; audio?: string } = {}
): Event => ({
  id,
  title,
  worldId: 'world',
  sceneId: 'scene',
  characters: [],
  choices: [],
  content: '[]',
  ending: false,
  images,
  audio: audio ? [audio, false] : undefined,
  type: EVENT_TYPE.CHOICE,
  tags: []
})

const scene = (id: string, title: string, audio?: string): Scene => ({
  id,
  title,
  worldId: 'world',
  children: [],
  parent: [ELEMENT_TYPE.WORLD, null],
  audio: audio ? [audio, false] : undefined,
  tags: []
})

const file = (
  id: string,
  ext: string,
  bytes = 1024,
  modified = 1_000
): AssetFile => ({ id, ext, bytes, modified })

describe('collectAssetReferences', () => {
  it('finds all four reference kinds', () => {
    const references = collectAssetReferences({
      characters: [
        character('character-1', 'Mira', [
          [CHARACTER_MASK_TYPE.NEUTRAL, 'mask-asset']
        ])
      ],
      events: [event('event-1', 'Ankunft', { images: ['image-asset'] })],
      scenes: [scene('scene-1', 'Keller', 'scene-audio-asset')]
    })

    expect(references.get('mask-asset')).toEqual([
      {
        type: ASSET_REFERENCE_TYPE.CHARACTER_MASK,
        elementId: 'character-1',
        elementTitle: 'Mira',
        detail: CHARACTER_MASK_TYPE.NEUTRAL
      }
    ])
    expect(references.get('image-asset')?.[0].type).toBe(
      ASSET_REFERENCE_TYPE.EVENT_IMAGE
    )
    expect(references.get('scene-audio-asset')?.[0].elementTitle).toBe('Keller')
  })

  it('separates event audio from event images on the same event', () => {
    const references = collectAssetReferences({
      events: [
        event('event-1', 'Ankunft', {
          images: ['image-asset'],
          audio: 'audio-asset'
        })
      ]
    })

    expect(references.get('image-asset')?.[0].type).toBe(
      ASSET_REFERENCE_TYPE.EVENT_IMAGE
    )
    expect(references.get('audio-asset')?.[0].type).toBe(
      ASSET_REFERENCE_TYPE.EVENT_AUDIO
    )
  })

  it('collects every reference to a shared asset', () => {
    // the same image id can legitimately appear on more than one event, so the
    // asset manager must count every reference before it offers to trash a file
    const references = collectAssetReferences({
      events: [
        event('event-1', 'Ankunft', { images: ['shared'] }),
        event('event-2', 'Abfahrt', { images: ['shared'] })
      ]
    })

    expect(references.get('shared')).toHaveLength(2)
  })

  it('ignores masks and elements with no asset', () => {
    const references = collectAssetReferences({
      characters: [
        character('character-1', 'Mira', [
          [CHARACTER_MASK_TYPE.NEUTRAL, undefined]
        ])
      ],
      events: [event('event-1', 'Ankunft')],
      scenes: [scene('scene-1', 'Keller')]
    })

    expect(references.size).toBe(0)
  })

  it('tolerates absent sources', () => {
    expect(collectAssetReferences({}).size).toBe(0)
  })
})

describe('collateAssets', () => {
  it('marks an unreferenced file unused', () => {
    const [asset] = collateAssets([file('orphan', 'webp')], {
      events: [event('event-1', 'Ankunft')]
    })

    expect(asset.references).toEqual([])
    expect(asset.missing).toBe(false)
  })

  it('does not call a referenced file unused', () => {
    const [asset] = collateAssets([file('image-asset', 'webp')], {
      events: [event('event-1', 'Ankunft', { images: ['image-asset'] })]
    })

    expect(asset.references).toHaveLength(1)
  })

  it('includes a referenced asset that is absent from disk', () => {
    const assets = collateAssets([], {
      characters: [
        character('character-1', 'Mira', [
          [CHARACTER_MASK_TYPE.NEUTRAL, 'gone']
        ])
      ]
    })

    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({
      id: 'gone',
      // inferred from the reference, since there is no file to read it from
      ext: 'jpeg',
      bytes: 0,
      missing: true
    })
  })

  it('infers mp3 for a missing audio reference', () => {
    const [asset] = collateAssets([], {
      scenes: [scene('scene-1', 'Keller', 'gone')]
    })

    expect(asset.ext).toBe('mp3')
  })

  it('orders missing, then unused, then in use, largest first', () => {
    const assets = collateAssets(
      [
        file('used-small', 'webp', 100),
        file('unused-small', 'webp', 200),
        file('unused-big', 'webp', 4000),
        file('used-big', 'mp3', 8000)
      ],
      {
        events: [
          event('event-1', 'Ankunft', {
            images: ['used-small', 'missing-image'],
            audio: 'used-big'
          })
        ]
      }
    )

    expect(assets.map(({ id }) => id)).toEqual([
      'missing-image',
      'unused-big',
      'unused-small',
      'used-big',
      'used-small'
    ])
  })

  it('treats a file the app never writes as an unused asset', () => {
    // nothing can reference a .png, so it is an orphan by construction
    const [asset] = collateAssets(
      [file('haus_wittgenstein', 'png', 241514), file('used', 'webp', 100)],
      { events: [event('event-1', 'Ankunft', { images: ['used'] })] }
    )

    expect(asset).toMatchObject({
      id: 'haus_wittgenstein',
      ext: 'png',
      references: [],
      missing: false
    })
  })

  it('breaks size ties on id so the grid does not reshuffle', () => {
    const assets = collateAssets(
      [file('b', 'webp', 500), file('a', 'webp', 500)],
      {}
    )

    expect(assets.map(({ id }) => id)).toEqual(['a', 'b'])
  })
})

describe('assetMedia', () => {
  it('classifies what the app writes', () => {
    expect(assetMedia({ ext: 'jpeg' })).toBe(ASSET_MEDIA.IMAGE)
    expect(assetMedia({ ext: 'webp' })).toBe(ASSET_MEDIA.IMAGE)
    expect(assetMedia({ ext: 'mp3' })).toBe(ASSET_MEDIA.AUDIO)
  })

  it('classifies what an import can leave behind', () => {
    // a real imported world here carries a .png beside the app's own assets,
    // copied in from the export's assets directory by IMPORT_WORLD_ASSETS
    expect(assetMedia({ ext: 'png' })).toBe(ASSET_MEDIA.IMAGE)
    expect(assetMedia({ ext: 'wav' })).toBe(ASSET_MEDIA.AUDIO)
    expect(assetMedia({ ext: 'txt' })).toBe(ASSET_MEDIA.OTHER)
    expect(assetMedia({ ext: '' })).toBe(ASSET_MEDIA.OTHER)
  })
})

describe('isReferenceClearable', () => {
  // an event content image is also a Slate node in Event.content, which the
  // manager will not rewrite underneath an open content editor
  it('refuses event content images and allows the single-value references', () => {
    expect(isReferenceClearable(ASSET_REFERENCE_TYPE.EVENT_IMAGE)).toBe(false)
    expect(isReferenceClearable(ASSET_REFERENCE_TYPE.CHARACTER_MASK)).toBe(true)
    expect(isReferenceClearable(ASSET_REFERENCE_TYPE.EVENT_AUDIO)).toBe(true)
    expect(isReferenceClearable(ASSET_REFERENCE_TYPE.SCENE_AUDIO)).toBe(true)
  })
})

describe('formatAssetBytes', () => {
  it('scales the unit', () => {
    expect(formatAssetBytes(0)).toBe('0 B')
    expect(formatAssetBytes(512)).toBe('512 B')
    expect(formatAssetBytes(2048)).toBe('2 KB')
    expect(formatAssetBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})
