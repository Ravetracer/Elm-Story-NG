import { describe, expect, it } from 'vitest'

import { ELEMENT_TYPE } from '../data/types'

import { HELP_CONTENT, HelpTopic } from '../components/ElementHelp/content'

/**
 * The in-app help modal (`ElementHelp`) replaced the dead docs.elmstory.com
 * links. `HelpButton`/`HelpModal` render nothing for a topic with no entry, so a
 * deleted or mistyped entry fails silently — the `?` opens an empty box. This
 * test is the safety net: every topic a button can actually request must have a
 * complete entry.
 *
 * The list is explicit rather than derived from `ELEMENT_TYPE`, because most of
 * that enum (OBJECT, RECIPE, STUDIO) surfaces no help button, and VARIABLE has
 * its own reference in `VariableManager/VariableHelp.tsx`. Adding a `HelpButton`
 * for a new topic means adding it here and to `HELP_CONTENT` together.
 */
const REQUIRED_TOPICS: HelpTopic[] = [
  // element `?` buttons (ElementHelpButton, via the property panels)
  ELEMENT_TYPE.WORLD,
  ELEMENT_TYPE.FOLDER,
  ELEMENT_TYPE.SCENE,
  ELEMENT_TYPE.EVENT,
  ELEMENT_TYPE.CHOICE,
  ELEMENT_TYPE.CONDITION,
  ELEMENT_TYPE.EFFECT,
  ELEMENT_TYPE.INPUT,
  ELEMENT_TYPE.JUMP,
  ELEMENT_TYPE.PATH,
  ELEMENT_TYPE.CHARACTER,
  // title-bar Help button and the native Help menu
  'OVERVIEW_DASHBOARD',
  'OVERVIEW_COMPOSER',
  // export menu and import modal
  'EXPORT_JSON',
  'EXPORT_PWA',
  'IMPORT'
]

describe('in-app help content', () => {
  it.each(REQUIRED_TOPICS)('has a complete entry for %s', (topic) => {
    const entry = HELP_CONTENT[topic]

    expect(entry, `no HELP_CONTENT entry for "${topic}"`).toBeDefined()
    expect(typeof entry?.title).toBe('string')
    expect(entry?.title.length).toBeGreaterThan(0)
    expect(entry?.body).toBeTruthy()
  })
})
