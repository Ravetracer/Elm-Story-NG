import { describe, expect, it } from 'vitest'

import { isAssetReplyFor } from '../../engine/src/lib/hooks/useImageLoader'

import {
  EngineDevToolsLiveEvent,
  ENGINE_DEVTOOLS_LIVE_EVENT_TYPE
} from '../../engine/src/types'

/**
 * Which `RETURN_ASSET_URL` reply a mounted image should act on.
 *
 * The listener is on `window`, so every image hears every other image's reply. The
 * rule under test is that "not mine" and "there is no asset" are different answers:
 * conflating them cleared an already-loaded image every time another one finished,
 * which showed up as an object rail with two objects and one picture. Worth pinning
 * because the failure only appears with two images on screen at once, and the code
 * reads plausibly either way.
 */

const reply = (): EngineDevToolsLiveEvent =>
  ({
    eventType: ENGINE_DEVTOOLS_LIVE_EVENT_TYPE.RETURN_ASSET_URL,
    eventId: 'tile-book',
    asset: { id: 'asset-book', ext: 'webp', url: 'esg-asset://asset-book.webp' }
  } as EngineDevToolsLiveEvent)

describe('routing an asset reply to the image that asked for it', () => {
  it('accepts the reply addressed to this hook', () => {
    expect(isAssetReplyFor(reply(), 'tile-book', 'asset-book')).toBe(true)
  })

  it('ignores a reply addressed to another image', () => {
    // the bug: this used to fall through and blank an image that had already loaded
    expect(isAssetReplyFor(reply(), 'tile-magazine', 'asset-magazine')).toBe(
      false
    )
  })

  it('ignores a reply for an asset this hook has moved on from', () => {
    // a stack growing past one switches to the stacked image, so the reply for the
    // single-item image is stale by the time it arrives
    expect(isAssetReplyFor(reply(), 'tile-book', 'asset-book-stacked')).toBe(
      false
    )
  })

  it('ignores an event that is not an asset reply at all', () => {
    expect(
      isAssetReplyFor(
        {
          ...reply(),
          eventType: ENGINE_DEVTOOLS_LIVE_EVENT_TYPE.GET_ASSET_URL
        } as EngineDevToolsLiveEvent,
        'tile-book',
        'asset-book'
      )
    ).toBe(false)
  })

  it('does not match an image that asked for nothing', () => {
    // no assetId means the effect set the placeholder and never dispatched, so no
    // reply can belong to it
    expect(isAssetReplyFor(reply(), 'tile-book', undefined)).toBe(false)
  })
})
