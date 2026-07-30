import { describe, expect, it, beforeEach, vi } from 'vitest'

import { webFrame } from 'electron'

import { ZOOM_UI_TYPE } from '../lib/events'
import {
  applyUIScale,
  closestUIScale,
  DEFAULT_UI_SCALE,
  loadUIScale,
  saveUIScale,
  steppedUIScale,
  uiScaleLabel,
  uiScalePercentage,
  UI_SCALES
} from '../lib/uiScale'

const SMALLEST = UI_SCALES[0].scale,
  LARGEST = UI_SCALES[UI_SCALES.length - 1].scale

describe('closestUIScale', () => {
  it('leaves a listed scale alone', () => {
    UI_SCALES.forEach(({ scale }) => expect(closestUIScale(scale)).toBe(scale))
  })

  it('snaps a value between steps to the nearer one', () => {
    expect(closestUIScale(1.44)).toBe(1.5)
    expect(closestUIScale(1.19)).toBe(1.15)
  })

  it('clamps beyond either end of the list', () => {
    expect(closestUIScale(0.1)).toBe(SMALLEST)
    expect(closestUIScale(4)).toBe(LARGEST)
  })
})

describe('steppedUIScale', () => {
  it('moves one listed step at a time', () => {
    expect(steppedUIScale(1, ZOOM_UI_TYPE.IN)).toBe(1.15)
    expect(steppedUIScale(1.15, ZOOM_UI_TYPE.OUT)).toBe(1)
  })

  it('stops at the ends rather than wrapping or leaving the list', () => {
    expect(steppedUIScale(LARGEST, ZOOM_UI_TYPE.IN)).toBe(LARGEST)
    expect(steppedUIScale(SMALLEST, ZOOM_UI_TYPE.OUT)).toBe(SMALLEST)
  })

  it('returns to the default on reset', () => {
    expect(steppedUIScale(LARGEST, ZOOM_UI_TYPE.RESET)).toBe(DEFAULT_UI_SCALE)
  })

  // a scale saved by an older build, or edited by hand, still has to step
  it('steps from an unlisted scale as though it were the nearest listed one', () => {
    expect(steppedUIScale(1.44, ZOOM_UI_TYPE.IN)).toBe(LARGEST)
    expect(steppedUIScale(1.44, ZOOM_UI_TYPE.OUT)).toBe(1.3)
  })
})

describe('the stored preference', () => {
  beforeEach(() => window.localStorage.clear())

  it('defaults when nothing has been stored', () => {
    expect(loadUIScale()).toBe(DEFAULT_UI_SCALE)
  })

  it('round trips a chosen scale', () => {
    saveUIScale(1.3)

    expect(loadUIScale()).toBe(1.3)
  })

  it('snaps a stored value that is not a listed scale', () => {
    window.localStorage.setItem('esg-ui-scale', '1.44')

    expect(loadUIScale()).toBe(1.5)
  })

  it('defaults rather than throwing on a value that is not a number', () => {
    window.localStorage.setItem('esg-ui-scale', 'huge')

    expect(loadUIScale()).toBe(DEFAULT_UI_SCALE)
  })

  // a zero or negative zoom factor is rejected by Chromium
  it('defaults on a value Chromium would refuse', () => {
    window.localStorage.setItem('esg-ui-scale', '0')

    expect(loadUIScale()).toBe(DEFAULT_UI_SCALE)
  })
})

describe('labelling', () => {
  it('names a listed scale', () => {
    expect(uiScaleLabel(1)).toBe('Default')
    expect(uiScaleLabel(LARGEST)).toBe(UI_SCALES[UI_SCALES.length - 1].label)
  })

  it('names the nearest listed scale for anything else', () => {
    expect(uiScaleLabel(1.44)).toBe(uiScaleLabel(1.5))
  })

  it('reads out as a percentage', () => {
    expect(uiScalePercentage(1)).toBe('100%')
    expect(uiScalePercentage(1.15)).toBe('115%')
  })
})

describe('applyUIScale', () => {
  it('sets the frame zoom factor', () => {
    vi.mocked(webFrame.setZoomFactor).mockClear()

    applyUIScale(1.3)

    expect(webFrame.setZoomFactor).toHaveBeenCalledWith(1.3)
  })
})
