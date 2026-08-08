import { describe, expect, it } from 'vitest'

import { getChoiceIdsFromEventContent } from '../../engine/src/lib'

import { ELEMENT_FORMATS } from '../../engine/src/types/eventContentTypes'

/**
 * An inline choice is a void node in `Event.content` carrying a `choice_id`, and the
 * choice itself stays a row in the `choices` table. That is what makes the feature
 * cost no schema — and it is also what makes this one function load-bearing:
 * `EventChoices` asks it which choices the prose already offers, so that the list
 * beneath the prose does not offer them a second time.
 *
 * **The thing worth testing is that it reads two formats.** `Event.content` is the
 * Slate document in the composer and the HTML `eventContentToHTML` baked at export
 * time in a shipped world. A character reference is resolved to its name by that
 * bake; a choice cannot be, because whether its path is open depends on the state
 * the player arrives with, so it survives as a placeholder span. Miss the second
 * format and every exported storyworld offers every inlined choice twice — once in
 * the sentence and once in the list — which is a bug no test of the composer alone
 * would catch.
 */

const paragraph = (children: unknown[]) => ({
  type: ELEMENT_FORMATS.P,
  children
})

const content = (nodes: unknown[]) => JSON.stringify(nodes)

describe('the choices an event prose already offers', () => {
  it('finds nothing in prose that offers nothing', () => {
    expect(
      getChoiceIdsFromEventContent(
        content([paragraph([{ text: 'You follow the butler.' }])])
      )
    ).toEqual([])
  })

  it('finds a choice inside a paragraph', () => {
    expect(
      getChoiceIdsFromEventContent(
        content([
          paragraph([
            { text: 'You follow the butler into the ' },
            {
              type: ELEMENT_FORMATS.CHOICE,
              choice_id: 'choice-1',
              children: [{ text: '' }]
            },
            { text: '.' }
          ])
        ])
      )
    ).toEqual(['choice-1'])
  })

  it('finds choices nested in a list, not only at the top level', () => {
    expect(
      getChoiceIdsFromEventContent(
        content([
          {
            type: ELEMENT_FORMATS.UL,
            children: [
              {
                type: ELEMENT_FORMATS.LI,
                children: [
                  {
                    type: ELEMENT_FORMATS.CHOICE,
                    choice_id: 'choice-1',
                    children: [{ text: '' }]
                  }
                ]
              },
              {
                type: ELEMENT_FORMATS.LI,
                children: [
                  {
                    type: ELEMENT_FORMATS.CHOICE,
                    choice_id: 'choice-2',
                    children: [{ text: '' }]
                  }
                ]
              }
            ]
          }
        ])
      )
    ).toEqual(['choice-1', 'choice-2'])
  })

  it('ignores a node the author has not assigned yet', () => {
    // inserting from the / menu creates the choice, so this is only reachable in a
    // document written by an older build or edited by hand — it must not put
    // `undefined` in the list of ids to filter by
    expect(
      getChoiceIdsFromEventContent(
        content([
          paragraph([
            { type: ELEMENT_FORMATS.CHOICE, children: [{ text: '' }] },
            { text: 'still prose' }
          ])
        ])
      )
    ).toEqual([])
  })

  it('counts one choice once, however often the prose mentions it', () => {
    const twice = content([
      paragraph([
        {
          type: ELEMENT_FORMATS.CHOICE,
          choice_id: 'choice-1',
          children: [{ text: '' }]
        }
      ]),
      paragraph([
        {
          type: ELEMENT_FORMATS.CHOICE,
          choice_id: 'choice-1',
          children: [{ text: '' }]
        }
      ])
    ])

    expect(getChoiceIdsFromEventContent(twice)).toEqual(['choice-1'])
  })

  it('reads the baked HTML an exported world ships', () => {
    // what `eventContentToHTML` writes: everything else resolved, the choice left as
    // a placeholder for the runtime to make clickable
    const exported =
      '<p>You follow the butler into the ' +
      '<span data-type="choice" data-choice-id="choice-1"></span>.</p>'

    expect(getChoiceIdsFromEventContent(exported)).toEqual(['choice-1'])
  })

  it('reads several from baked HTML, and only the choices', () => {
    const exported =
      '<p><span data-type="choice" data-choice-id="choice-1"></span> or ' +
      '<span data-type="choice" data-choice-id="choice-2"></span></p>' +
      '<div className="event-content-image" style="backgroundImage:url(assets/content/asset-1.webp)"></div>'

    expect(getChoiceIdsFromEventContent(exported)).toEqual([
      'choice-1',
      'choice-2'
    ])
  })

  it('ignores an unassigned placeholder in baked HTML', () => {
    expect(
      getChoiceIdsFromEventContent(
        '<p><span data-type="choice" data-choice-id="undefined"></span></p>'
      )
    ).toEqual([])
  })

  it('says nothing for content that is absent or empty', () => {
    // an event with no content at all, which the engine renders as a blank event
    expect(getChoiceIdsFromEventContent(undefined)).toEqual([])
    expect(getChoiceIdsFromEventContent('')).toEqual([])
  })
})

/**
 * The consequence of the model, stated as a test because DESIGN.md §12 and the original roadmap
 * §7 both predicted the opposite and the reasoning is worth keeping.
 *
 * Both said `lib/contentEditor` would have to diff inline choice nodes against
 * `Event.choices` the way it diffs image nodes against `Event.images`, "or a deleted
 * node leaves an orphaned choice". It does not, because deleting the node was
 * decided to *un-inline* the choice rather than delete it: the row stays in
 * `choices` and its id stays in `Event.choices`, so the list beneath the prose
 * offers it again and its paths still lead somewhere. An orphan is a choice nothing
 * points at, and nothing here stops pointing at it.
 */
describe('removing an inline choice node returns the choice to the list', () => {
  const withChoice = content([
    paragraph([
      { text: 'You follow the butler into the ' },
      {
        type: ELEMENT_FORMATS.CHOICE,
        choice_id: 'choice-1',
        children: [{ text: '' }]
      }
    ])
  ])

  const withoutChoice = content([
    paragraph([{ text: 'You follow the butler into the ' }])
  ])

  it('stops reporting it as inlined, which is the whole of the change', () => {
    expect(getChoiceIdsFromEventContent(withChoice)).toEqual(['choice-1'])
    expect(getChoiceIdsFromEventContent(withoutChoice)).toEqual([])
  })
})
