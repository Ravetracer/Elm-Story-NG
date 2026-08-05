import { describe, expect, it } from 'vitest'

import {
  resolveTransition,
  isTransitionImmediate
} from '../../engine/src/lib/transition'

import { ENGINE_MOTION, ENGINE_TRANSITION } from '../../engine/src/types'

const { NONE, FADE, SLIDE } = ENGINE_TRANSITION
const { FULL, REDUCED } = ENGINE_MOTION

/**
 * How a live event enters the stream. The case that matters most is the unset
 * one — every storyworld written before the field existed, which has to keep
 * fading in exactly as it always did.
 */
describe('resolveTransition', () => {
  it('defaults an unset transition to FADE', () => {
    expect(resolveTransition(undefined)).toBe(FADE)
  })

  it('returns an author-chosen transition unchanged', () => {
    expect(resolveTransition(FADE)).toBe(FADE)
    expect(resolveTransition(SLIDE)).toBe(SLIDE)
    expect(resolveTransition(NONE)).toBe(NONE)
  })
})

describe('isTransitionImmediate', () => {
  it('animates FADE and SLIDE for a full-motion player', () => {
    expect(isTransitionImmediate(FADE, FULL)).toBe(false)
    expect(isTransitionImmediate(SLIDE, FULL)).toBe(false)
    expect(isTransitionImmediate(undefined, FULL)).toBe(false)
  })

  it('is immediate when the author chose NONE', () => {
    expect(isTransitionImmediate(NONE, FULL)).toBe(true)
  })

  it('is immediate for a reduced-motion player whatever the author chose', () => {
    expect(isTransitionImmediate(FADE, REDUCED)).toBe(true)
    expect(isTransitionImmediate(SLIDE, REDUCED)).toBe(true)
    expect(isTransitionImmediate(NONE, REDUCED)).toBe(true)
    expect(isTransitionImmediate(undefined, REDUCED)).toBe(true)
  })
})
