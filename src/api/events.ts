import { LIBRARY_TABLE, getLibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'
import { getRandomElementName } from '../lib'

import { Descendant } from 'slate'
import {
  Event,
  ElementId,
  StudioId,
  WorldId,
  EVENT_TYPE,
  CharacterRefs,
  CharacterMask,
  CHARACTER_MASK_TYPE,
  ELEMENT_TYPE
} from '../data/types'

import api from '.'

export async function getEvent(studioId: StudioId, eventId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getEvent(eventId)
  } catch (error) {
    throw error
  }
}

export async function saveEvent(
  studioId: StudioId,
  event: Event
): Promise<Event> {
  if (!event.id) event.id = uuid()

  try {
    return await getLibraryDatabase(studioId).saveEvent(event)
  } catch (error) {
    throw error
  }
}

export async function removeEvent(
  studioId: StudioId,
  eventId: ElementId,
  skipOriginPaths: boolean = false,
  skipDestinationPaths: boolean = false
) {
  try {
    await getLibraryDatabase(studioId).removeEvent(
      eventId,
      skipOriginPaths,
      skipDestinationPaths
    )
  } catch (error) {
    throw error
  }
}

export async function getEventsByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Event[]> {
  try {
    return await getLibraryDatabase(studioId).getEventsByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function saveEventTitle(
  studioId: StudioId,
  eventId: ElementId,
  title: string
) {
  try {
    await getLibraryDatabase(studioId).saveElementTitle(
      eventId,
      LIBRARY_TABLE.EVENTS,
      title
    )
  } catch (error) {
    throw error
  }
}

export async function saveEventType(
  studioId: StudioId,
  eventId: ElementId,
  type: EVENT_TYPE
) {
  try {
    await getLibraryDatabase(studioId).saveEventType(eventId, type)
  } catch (error) {
    throw error
  }
}

export async function saveEventInput(
  studioId: StudioId,
  eventId: ElementId,
  inputId?: ElementId
) {
  try {
    await getLibraryDatabase(studioId).saveEventInput(eventId, inputId)
  } catch (error) {
    throw error
  }
}

export async function saveEventContent(
  studioId: StudioId,
  eventId: ElementId,
  contentObject: Descendant[]
) {
  try {
    await getLibraryDatabase(studioId).saveEventContent(
      eventId,
      JSON.stringify(contentObject)
    )
  } catch (error) {
    throw error
  }
}

export async function saveSceneRefToEvent(
  studioId: StudioId,
  sceneId: ElementId,
  eventId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).saveSceneRefToEvent(sceneId, eventId)
  } catch (error) {
    throw error
  }
}

export async function saveChoiceRefsToEvent(
  studioId: StudioId,
  eventId: ElementId,
  choices: ElementId[]
) {
  try {
    await getLibraryDatabase(studioId).saveChoiceRefsToEvent(eventId, choices)
  } catch (error) {
    throw error
  }
}

export async function switchEventFromChoiceToInputType(
  studioId: StudioId,
  event: Event
) {
  if (event && event.id) {
    try {
      const foundPassthroughPaths = await api().paths.getPassthroughPathsByEventRef(
        studioId,
        event.id
      )

      // Flat array of promises, spread so `Promise.all` actually awaits the path
      // and choice removals — nesting the `.map` arrays resolved without awaiting
      // any of them (#70). `removeChoice` does not touch `event.choices`, so the
      // wholesale `saveChoiceRefsToEvent([])` is the only writer of it and the
      // parallel run is safe.
      await Promise.all([
        ...foundPassthroughPaths.map(
          async (foundPath) =>
            foundPath.id &&
            foundPath.choiceId === undefined &&
            (await api().paths.removePath(studioId, foundPath.id))
        ),
        ...event.choices.map(
          async (choiceId) =>
            await api().choices.removeChoice(studioId, choiceId)
        ),
        api().events.saveChoiceRefsToEvent(studioId, event.id, []),
        api().events.saveEventType(studioId, event.id, EVENT_TYPE.INPUT)
      ])

      const input = await api().inputs.saveInput(studioId, {
        worldId: event.worldId,
        eventId: event.id,
        tags: [],
        title: getRandomElementName(2),
        variableId: undefined
      })

      input.id &&
        (await api().events.saveEventInput(studioId, event.id, input.id))
    } catch (error) {
      throw error
    }
  } else {
    throw new Error(
      'Unable to switch event type from choice to input. Missing event or event ID.'
    )
  }
}

export async function switchEventFromChoiceOrInputToJumpType(
  studioId: StudioId,
  event: Event
): Promise<ElementId | undefined> {
  if (event?.id) {
    try {
      const [jump, updatedSceneChildRefs, pathsToPatch] = await Promise.all([
        api().jumps.saveJump(studioId, {
          composer: event.composer,
          path: [event.sceneId],
          sceneId: event.sceneId,
          tags: [],
          title: getRandomElementName(2),
          worldId: event.worldId
        }),
        api().scenes.getChildRefsBySceneRef(studioId, event.sceneId),
        api().paths.getPathsByDestinationRef(studioId, event.id),
        api().events.removeEvent(studioId, event.id, false, true)
      ])

      if (jump?.id) {
        const foundEventPosition = updatedSceneChildRefs.findIndex(
          (child) => child[1] === event.id
        )

        if (foundEventPosition !== -1) {
          updatedSceneChildRefs[foundEventPosition] = [
            ELEMENT_TYPE.JUMP,
            jump.id
          ]

          // Flat array of promises, spread so the path re-pointing is actually
          // awaited rather than fired and forgotten (#70). Distinct path rows and
          // the scene's child refs, so parallel is correct.
          await Promise.all([
            ...pathsToPatch.map(
              async (path) =>
                jump?.id &&
                (await api().paths.savePath(studioId, {
                  ...path,
                  destinationId: jump.id,
                  destinationType: ELEMENT_TYPE.JUMP
                }))
            ),
            api().scenes.saveChildRefsToScene(
              studioId,
              event.sceneId,
              updatedSceneChildRefs
            )
          ])
        }
      }

      return jump?.id
    } catch (error) {
      throw error
    }
  } else {
    throw 'Unable to switch event type from choice to jump. Missing event or event ID.'
  }
}

export async function switchEventFromInputToChoiceType(
  studioId: StudioId,
  event: Event
) {
  if (event && event.id && event.input) {
    try {
      await Promise.all([
        api().inputs.removeInput(studioId, event.input),
        api().events.saveEventInput(studioId, event.id, undefined),
        api().events.saveEventType(studioId, event.id, EVENT_TYPE.CHOICE)
      ])
    } catch (error) {
      throw error
    }
  } else {
    throw new Error(
      'Unable to switch event type from input to choice or input. Missing event, event ID or input ID.'
    )
  }
}

export async function setEventEnding(
  studioId: StudioId,
  eventId: ElementId,
  ending: boolean
) {
  try {
    await getLibraryDatabase(studioId).setEventEnding(eventId, ending)
  } catch (error) {
    throw error
  }
}

// receive new references and remove dead
export async function removeDeadPersonaRefsFromEvent(
  studioId: StudioId,
  characterId: ElementId,
  newRefs: CharacterRefs
) {
  const db = getLibraryDatabase(studioId)

  try {
    const events = await db.events
      .where('persona')
      .equals(characterId)
      .toArray()

    await Promise.all(
      events.map(async (event) => {
        if (!event.persona) return

        let clearRef = true

        newRefs.map((newRef) => {
          if (newRef[0] === event.persona?.[2]) {
            clearRef = false
            return
          }
        })

        if (clearRef && event.id) {
          try {
            await db.events.update(event.id, {
              ...event,
              persona: [event.persona[0], event.persona[1], undefined],
              updated: Date.now()
            })
          } catch (error) {
            throw error
          }
        }
      })
    )
  } catch (error) {
    throw error
  }
}

// Removing a character's dead personas and character references used to live
// here in two functions — `removeDeadPersonas` (wired into character deletion)
// and `removeDeadCharacterRefs` (wired into nothing). Both did full-event writes
// that could clobber an open editor's content, and both had the #70
// array-of-arrays bug. The cascade now lives in `LibraryDatabase.removeCharacter`
// as targeted field updates, mirroring `removeVariable`, so both are gone.

// when mask is disabled, reset to NEUTRAL
export async function resetPersonaMaskFromEvent(
  studioId: StudioId,
  characterId: ElementId,
  newMasks: CharacterMask[]
) {
  const db = getLibraryDatabase(studioId)

  try {
    const events = await db.events
      .where('persona')
      .equals(characterId)
      .toArray()

    await Promise.all(
      events.map(async (event) => {
        if (!event.persona) return

        let resetMask = true

        newMasks.map((newMask) => {
          if (newMask.type === event.persona?.[1] && newMask.active) {
            resetMask = false
            return
          }
        })

        if (resetMask && event.id) {
          try {
            await db.events.update(event.id, {
              ...event,
              persona: [
                event.persona[0],
                CHARACTER_MASK_TYPE.NEUTRAL,
                event.persona[2]
              ],
              updated: Date.now()
            })
          } catch (error) {
            throw error
          }
        }
      })
    )
  } catch (error) {
    throw error
  }
}
