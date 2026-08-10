import { STREAM_ALIGNMENT } from '../types'

/**
 * The author's reading-column alignment, defaulting to CENTER — the layout every
 * pre-feature storyworld already had, so a world that never sets it reads exactly
 * as it did. Alignment is only visible on a screen wider than the reading column;
 * on a narrow window `#runtime` fills the width and there is no slack to shift.
 */
export const resolveStreamAlignment = (
  alignment?: STREAM_ALIGNMENT
): STREAM_ALIGNMENT => alignment ?? STREAM_ALIGNMENT.CENTER
