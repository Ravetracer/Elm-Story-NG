import { ENGINE_MOTION, ENGINE_TRANSITION } from '../types'

/**
 * The author's transition, defaulting to FADE — the behaviour every pre-0.8.0
 * storyworld already had, so a world that never sets it reads exactly as it did.
 */
export const resolveTransition = (
  transition?: ENGINE_TRANSITION
): ENGINE_TRANSITION => transition ?? ENGINE_TRANSITION.FADE

/**
 * Whether a live event's entry plays no animation. A reduced-motion player never
 * animates whatever the author chose; NONE is the author's own opt-out. Both the
 * entry fade/slide in `LiveEventStream` and the height unfold in `Event` read
 * this, so the two cannot disagree about when to animate.
 */
export const isTransitionImmediate = (
  transition: ENGINE_TRANSITION | undefined,
  motion: ENGINE_MOTION | undefined
): boolean =>
  motion === ENGINE_MOTION.REDUCED ||
  resolveTransition(transition) === ENGINE_TRANSITION.NONE
