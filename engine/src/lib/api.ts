import Dexie from 'dexie'
import { v4 as uuid } from 'uuid'
import { cloneDeep, pick } from 'lodash'
import semver from 'semver'
// @ts-ignore
import lzwCompress from 'lzwcompress'

import { DB_NAME, getLibraryDatabase } from './db'

import {
  ElementId,
  ELEMENT_TYPE,
  WorldId,
  ESGEngineCollectionData,
  ENGINE_THEME,
  EngineLiveEventStateCollection,
  EngineConditionData,
  EngineVariableData,
  EngineLiveEventData,
  EnginePathData,
  ENGINE_LIVE_EVENT_TYPE,
  EngineChoiceData,
  EngineInputData,
  StudioId,
  EngineVariableCollection,
  EngineWorldData,
  EngineEventData,
  EngineLiveEventResult,
  CHARACTER_MASK_TYPE,
  CharacterMask,
  PATH_CONDITIONS_TYPE,
  ENGINE_FONT,
  ENGINE_MOTION,
  ENGINE_SIZE,
  EngineObjectConditionData,
  EngineObjectDeltaCollection,
  EngineLiveEventMessageData,
  ENGINE_LIVE_EVENT_MESSAGE_TYPE
} from '../types'
import {
  AUTO_ENGINE_BOOKMARK_KEY,
  DEFAULT_ENGINE_SETTINGS_KEY,
  INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY
} from '../lib'
import {
  applyVariableSets,
  processTemplateToText,
  resetSceneScopedVariables,
  variableCompareHolds
} from './state'
import {
  objectCompareHolds,
  pruneDeltas,
  type ObjectWorldSnapshot
} from './objects'

export const getWorldInfo = async (
  studioId: StudioId,
  worldId: WorldId
): Promise<EngineWorldData | null> => {
  try {
    const foundWorld = await getLibraryDatabase(studioId).worlds.get(worldId)

    if (foundWorld) {
      return foundWorld
    }
  } catch (error) {
    throw error
  }

  return null
}

export const saveWorldMeta = (studioId: StudioId, worldId: WorldId) => {
  const worldMeta = localStorage.getItem(worldId)

  // feedback#96
  if (!worldMeta || (worldMeta && JSON.parse(worldMeta).gameId)) {
    localStorage.setItem(worldId, JSON.stringify({ worldId, studioId }))
  }
}

export const saveEngineCollectionData = async (
  engineData: ESGEngineCollectionData,
  update: boolean // #373: when the world requires update, update engine defaults
): Promise<boolean> => {
  const {
    children,
    choicePresentation,
    transition,
    streamAlignment,
    theme,
    themeColors,
    skin,
    copyright,
    coverAssetId,
    backgroundAssetId,
    currencyVariableId,
    currencyLabel,
    description,
    designer,
    engine,
    id: worldId,
    jump,
    objectNoRecipeMessage,
    schema,
    studioId,
    studioTitle,
    tags,
    title,
    updated,
    version,
    website
  } = engineData._

  const databaseExists = await Dexie.exists(`${DB_NAME}-${studioId}`)
  let installedWorld: EngineWorldData | undefined

  if (databaseExists) {
    installedWorld = await getLibraryDatabase(studioId).worlds.get(worldId)
  }

  if (databaseExists && installedWorld && !update) {
    if (semver.gt(version, installedWorld.version)) {
      return true
    }

    if (semver.lt(version, installedWorld.version)) {
      console.error(
        `[STORYTELLER] unable to save world data to database.\n[STORYTELLER] incoming: ${version}, installed: ${installedWorld.version}\n[STORYTELLER] more info: https://docs.elmstory.com/guides/data/pwa`
      )
    }
  }

  if (!databaseExists || (databaseExists && !installedWorld)) {
    saveWorldMeta(studioId, worldId)

    const libraryDatabase = getLibraryDatabase(studioId)

    try {
      await Promise.all([
        libraryDatabase.saveCharacterCollectionData(
          worldId,
          engineData.characters
        ),
        libraryDatabase.saveChoiceCollectionData(worldId, engineData.choices),
        libraryDatabase.saveConditionCollectionData(
          worldId,
          engineData.conditions
        ),
        libraryDatabase.saveEffectCollectionData(worldId, engineData.effects),
        libraryDatabase.saveInputCollectionData(worldId, engineData.inputs),
        libraryDatabase.saveJumpCollectionData(worldId, engineData.jumps),
        libraryDatabase.saveEventCollectionData(worldId, engineData.events),
        libraryDatabase.savePathCollectionData(worldId, engineData.paths),
        libraryDatabase.saveSceneCollectionData(worldId, engineData.scenes),
        libraryDatabase.saveVariableCollectionData(
          worldId,
          engineData.variables
        ),
        // 0.8.0. Defaulted rather than assumed present: an exported PWA built
        // before 0.8.0 has no such key, and the engine embedded in the composer
        // reads whatever the editor packed.
        libraryDatabase.saveObjectCollectionData(
          worldId,
          engineData.objects ?? {}
        ),
        libraryDatabase.saveRecipeCollectionData(
          worldId,
          engineData.recipes ?? {}
        ),
        libraryDatabase.saveObjectConditionCollectionData(
          worldId,
          engineData.objectConditions ?? {}
        ),
        libraryDatabase.saveWorldData({
          children,
          choicePresentation,
          transition,
          streamAlignment,
          theme,
          themeColors,
          skin,
          copyright,
          coverAssetId,
          backgroundAssetId,
          currencyVariableId,
          currencyLabel,
          description,
          designer,
          engine,
          id: worldId,
          jump,
          objectNoRecipeMessage,
          schema,
          studioId,
          studioTitle,
          tags,
          title,
          updated,
          version,
          website
        })
      ])

      update &&
        (await updateEngineDefaultWorldCollectionData(studioId, worldId))

      !update &&
        (await saveEngineDefaultWorldCollectionData(studioId, worldId, version))
    } catch (error) {
      throw error
    }
  }

  return false
}

export const saveEngineDefaultWorldCollectionData = async (
  studioId: StudioId,
  worldId: WorldId,
  worldVersion: string
) => {
  const libraryDatabase = getLibraryDatabase(studioId)

  try {
    const [
      existingAutoBookmark,
      existingDefaultSettings,
      existingInitialLiveEvent
    ] = await Promise.all([
      libraryDatabase.bookmarks.get(`${AUTO_ENGINE_BOOKMARK_KEY}${worldId}`),
      libraryDatabase.settings.get(`${DEFAULT_ENGINE_SETTINGS_KEY}${worldId}`),
      libraryDatabase.live_events.get(
        `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${worldId}`
      )
    ])

    const promises: Promise<void>[] = []

    if (!existingAutoBookmark) {
      promises.push(
        libraryDatabase.saveBookmarkCollectionData({
          AUTO_ENGINE_BOOKMARK_KEY: {
            worldId,
            id: `${AUTO_ENGINE_BOOKMARK_KEY}${worldId}`,
            title: AUTO_ENGINE_BOOKMARK_KEY,
            liveEventId: undefined,
            updated: Date.now(),
            version: worldVersion
          }
        })
      )
    }

    if (!existingDefaultSettings) {
      promises.push(
        libraryDatabase.saveSettingCollectionData({
          DEFAULT_ENGINE_SETTINGS: {
            worldId,
            id: `${DEFAULT_ENGINE_SETTINGS_KEY}${worldId}`,
            theme: ENGINE_THEME.CONSOLE,
            font: ENGINE_FONT.SERIF,
            motion: ENGINE_MOTION.FULL,
            muted: false,
            size: ENGINE_SIZE.DEFAULT
          }
        })
      )
    }

    await Promise.all(promises)

    if (!existingInitialLiveEvent) {
      const variablesArr = await libraryDatabase.variables
        .where({ worldId })
        .toArray()

      const variables: EngineVariableCollection = {}

      variablesArr.map(
        (variable) => (variables[variable.id] = cloneDeep(variable))
      )

      // event is used when player first starts world
      const initialWorldState: EngineLiveEventStateCollection = {}

      Object.keys(variables).map((key) => {
        const { title, type, initialValue } = pick(variables[key], [
          'title',
          'type',
          'initialValue'
        ])

        initialWorldState[key] = { worldId, title, type, value: initialValue }
      })

      const startingDestination = await findStartingDestinationLiveEvent(
        studioId,
        worldId
      )

      if (startingDestination) {
        await libraryDatabase.saveLiveEventCollectionData(worldId, {
          INITIAL_ENGINE_EVENT: {
            worldId,
            id: `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${worldId}`,
            destination: startingDestination,
            state: initialWorldState,
            type: ENGINE_LIVE_EVENT_TYPE.INITIAL,
            updated: Date.now(),
            version: worldVersion
          }
        })
      }
    }
  } catch (error) {
    throw error
  }
}

// #373: recursive
const findLiveEventFromBookmarkWithExistingDestination = async (
  studioId: StudioId,
  liveEventId: ElementId
): Promise<EngineLiveEventData | undefined> => {
  const libraryDatabase = getLibraryDatabase(studioId)

  try {
    const foundLiveEvent = await libraryDatabase.live_events.get(liveEventId)

    if (foundLiveEvent) {
      // feedback#94
      const foundDestination = await libraryDatabase.events.get(
        foundLiveEvent.destination
      )

      if (foundDestination) {
        return foundLiveEvent
      } else {
        if (foundLiveEvent.prev) {
          return findLiveEventFromBookmarkWithExistingDestination(
            studioId,
            foundLiveEvent.prev
          )
        } else {
          return undefined
        }
      }
    } else {
      return undefined
    }
  } catch (error) {
    throw error
  }
}

// #373
export const updateEngineDefaultWorldCollectionData = async (
  studioId: StudioId,
  worldId: WorldId
) => {
  const libraryDatabase = getLibraryDatabase(studioId)

  try {
    const foundBookmark = await libraryDatabase.bookmarks.get(
      `${AUTO_ENGINE_BOOKMARK_KEY}${worldId}`
    )

    const [foundWorld, foundLiveEvent] = await Promise.all([
      libraryDatabase.worlds.get(worldId),
      foundBookmark?.liveEventId
        ? findLiveEventFromBookmarkWithExistingDestination(
            studioId,
            foundBookmark.liveEventId
          )
        : undefined
    ])

    if (foundWorld) {
      if (foundLiveEvent) {
        // create new event with patched world state and version
        // update bookmark version and event
        const newLiveEventId = uuid()

        const variables = await libraryDatabase.variables.toArray()

        const newLiveEventState: EngineLiveEventStateCollection = {}

        variables.map(({ id, title, type, initialValue }) => {
          // for each variable, add to new event state
          newLiveEventState[id] = {
            worldId,
            title,
            type,
            value: initialValue
          }

          // if the variable exists in the found world state, use original event state value
          if (foundLiveEvent.state[id]) {
            newLiveEventState[id] = {
              ...newLiveEventState[id],
              value: foundLiveEvent.state[id].value
            }
          }
        })

        /*
         * 0.8.0: the object counterpart of the variable reconciliation above.
         *
         * This is the one place a save is brought forward onto a newer world, so it
         * is the only place a delta naming a deleted object can be dropped. Left in,
         * a save keeps counts for objects the world no longer has, and "the player
         * has X" answers about a ghost — including gating a path on one.
         *
         * Deltas for objects that still exist are carried across untouched, the same
         * way a surviving variable keeps its value.
         */
        const objectIds = (
          await libraryDatabase.objects.where({ worldId }).toArray()
        ).map(({ id }) => id)

        const newLiveEventObjects = pruneDeltas(
          foundLiveEvent.objects ?? {},
          objectIds
        )

        await Promise.all([
          libraryDatabase.live_events.add(
            {
              ...foundLiveEvent,
              id: newLiveEventId,
              state: newLiveEventState,
              objects: newLiveEventObjects,
              updated: Date.now(),
              version: foundWorld.version
            },
            newLiveEventId
          ),
          libraryDatabase.bookmarks.update(
            `${AUTO_ENGINE_BOOKMARK_KEY}${worldId}`,
            {
              ...foundBookmark,
              liveEventId: newLiveEventId,
              updated: Date.now(),
              version: foundWorld.version
            }
          )
        ])
      }

      if (!foundLiveEvent) {
        // dump default bookmark and event and recreate
        await Promise.all([
          libraryDatabase.bookmarks.delete(
            `${AUTO_ENGINE_BOOKMARK_KEY}${worldId}`
          ),
          libraryDatabase.live_events.delete(
            `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${worldId}`
          )
        ])

        await saveEngineDefaultWorldCollectionData(
          studioId,
          worldId,
          foundWorld.version
        )
      }

      console.info(
        `[STORYTELLER] successfully updated world to ${foundWorld.version}`
      )
    } else {
      throw '[STORYTELLER] unable to update world.\n[STORYTELLER] missing world data.'
    }
  } catch (error) {
    throw error
  }
}

export const unpackEngineData = (
  packedEngineData: string
): ESGEngineCollectionData => lzwCompress.unpack(packedEngineData)

export const removeWorldData = async (studioId: StudioId, worldId: WorldId) => {
  const libraryDatabase = getLibraryDatabase(studioId)

  try {
    await Promise.all([
      libraryDatabase.characters.where({ worldId }).delete(),
      libraryDatabase.choices.where({ worldId }).delete(),
      libraryDatabase.conditions.where({ worldId }).delete(),
      libraryDatabase.effects.where({ worldId }).delete(),
      libraryDatabase.events.where({ worldId }).delete(),
      libraryDatabase.inputs.where({ worldId }).delete(),
      libraryDatabase.jumps.where({ worldId }).delete(),
      libraryDatabase.paths.where({ worldId }).delete(),
      libraryDatabase.scenes.where({ worldId }).delete(),
      libraryDatabase.variables.where({ worldId }).delete(),
      libraryDatabase.worlds.where({ id: worldId }).delete()
    ])
  } catch (error) {
    throw error
  }
}

// #30
export const resetWorld = async (
  studioId: StudioId,
  worldId: WorldId,
  skipInstall?: boolean,
  isEditor?: boolean
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId)

    try {
      await Promise.all([
        libraryDatabase.bookmarks.where({ worldId }).delete(),
        libraryDatabase.live_events.where({ worldId }).delete(),
        libraryDatabase.settings.where({ worldId }).delete()
      ])

      // #412
      if (!isEditor) {
        await removeWorldData(studioId, worldId)

        !skipInstall && localStorage.removeItem(worldId)
      }
    } catch (error) {
      throw error
    }
  } catch (error) {
    throw error
  }
}

export const findStartingDestinationLiveEvent = async (
  studioId: StudioId,
  worldId: WorldId
): Promise<ElementId | undefined> => {
  const libraryDatabase = getLibraryDatabase(studioId),
    world = await libraryDatabase.worlds.get(worldId)

  // elmstorygames/feedback#280
  let firstEvent: string | undefined = undefined

  if (world) {
    try {
      if (world.jump) {
        const foundJump = await libraryDatabase.jumps.get(world.jump)

        if (foundJump) {
          if (foundJump.path[1]) {
            return foundJump.path[1]
          }

          if (!foundJump.path[1] && foundJump.path[0]) {
            const foundScene = await libraryDatabase.scenes.get(
              foundJump.path[0]
            )

            if (!foundScene) return undefined

            if (foundScene.children.length > 0) {
              // elmstorygames/feedback#280
              let firstEvent: string | undefined = undefined

              for (let i = 0; i < foundScene.children.length; i++) {
                if (foundScene.children[i][0] === ELEMENT_TYPE.EVENT) {
                  firstEvent = foundScene.children[i][1]
                  break
                }
              }

              return firstEvent

              // return foundScene.children[0][1]
            }
          }
        }
      }

      if (!world.jump) {
        const libraryDatabase = getLibraryDatabase(studioId),
          foundScene =
            world.children[0] && world.children[0][0] !== ELEMENT_TYPE.FOLDER
              ? await libraryDatabase.scenes.get(world.children[0][1])
              : await libraryDatabase.scenes.where({ worldId }).first()

        if (!foundScene) return undefined

        if (foundScene.children.length > 0) {
          for (let i = 0; i < foundScene.children.length; i++) {
            if (foundScene.children[i][0] === ELEMENT_TYPE.EVENT) {
              firstEvent = foundScene.children[i][1]
              break
            }
          }

          if (firstEvent) return firstEvent
        }
      }

      if (!firstEvent) {
        const foundEvent = await libraryDatabase.events
          .where({ worldId })
          .first()

        if (foundEvent?.id) {
          firstEvent = foundEvent.id
        }
      }

      return firstEvent
    } catch (error) {
      throw error
    }
  } else {
    throw 'Unable to find starting location. Missing world info.'
  }
}

export const findDestinationEvent = async (
  studioId: StudioId,
  destinationId: ElementId,
  destinationType: ELEMENT_TYPE
) => {
  let foundLocation: ElementId | undefined

  switch (destinationType) {
    case ELEMENT_TYPE.EVENT:
      const foundEvent = await getEvent(studioId, destinationId)

      if (foundEvent) {
        foundLocation = foundEvent.id
      }

      break
    case ELEMENT_TYPE.JUMP:
      const foundJump = await getJump(studioId, destinationId)

      if (foundJump && foundJump.path[0]) {
        if (foundJump.path[1]) {
          foundLocation = foundJump.path[1]
        }

        if (!foundJump.path[1]) {
          const foundScene = await getScene(studioId, foundJump.path[0])

          // elmstorygames/feedback#20
          if (foundScene?.children[0]?.[1]) {
            foundLocation = foundScene.children[0][1]
          }
        }
      }

      break
    default:
      break
  }

  if (foundLocation) {
    return foundLocation
  } else {
    return null
  }
}

export const getBookmarkAuto = async (studioId: StudioId, worldId: WorldId) => {
  try {
    return await getLibraryDatabase(studioId).bookmarks.get(
      `${AUTO_ENGINE_BOOKMARK_KEY}${worldId}`
    )
  } catch (error) {
    throw error
  }
}

export const getBookmark = async (
  studioId: StudioId,
  bookmarkId: ElementId
) => {
  try {
    return await getLibraryDatabase(studioId).bookmarks.get(bookmarkId)
  } catch (error) {
    throw error
  }
}

export const getBookmarks = async (studioId: StudioId, worldId: WorldId) => {
  try {
    return await getLibraryDatabase(studioId).bookmarks
      .where({ worldId })
      .toArray()
  } catch (error) {
    throw error
  }
}

export const saveBookmarkLiveEvent = async (
  studioId: StudioId,
  bookmarkId: ElementId,
  liveEventId: ElementId
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundBookmark = await libraryDatabase.bookmarks.get(bookmarkId)

    let updatedBookmark

    if (foundBookmark) {
      updatedBookmark = {
        ...foundBookmark,
        liveEventId,
        updated: Date.now()
      }

      await libraryDatabase.bookmarks.update(bookmarkId, updatedBookmark)

      return updatedBookmark
    }

    return undefined
  } catch (error) {
    throw error
  }
}

export const getChoice = async (studioId: StudioId, choiceId: ElementId) => {
  try {
    return await getLibraryDatabase(studioId).choices.get(choiceId)
  } catch (error) {
    throw error
  }
}

export const getConditionsByPaths = async (
  studioId: StudioId,
  pathIds: ElementId[]
) => {
  try {
    return await getLibraryDatabase(studioId).conditions
      .where('pathId')
      .anyOf(pathIds)
      .toArray()
  } catch (error) {
    throw error
  }
}

export const getEffectsByPathRef = async (
  studioId: StudioId,
  pathId: ElementId
) => {
  try {
    return await getLibraryDatabase(studioId).effects
      .where({ pathId })
      .toArray()
  } catch (error) {
    throw error
  }
}

/**
 * Applies a path's effects to the live event state.
 *
 * The arithmetic itself moved to `lib/state.ts` as `applyVariableSets`, so that a
 * path effect and a recipe effect cannot drift apart — they are the same operation
 * on the same shape, and 0.8.0 added the second caller. The formatting behaviour is
 * unchanged, including the `formatNumberFromString` pass for feedback#276.
 *
 * One behavioural fix came with the move: the old body read
 * `newState[effect.variableId].value` outside the guard that checked the entry
 * existed, so an effect naming a variable absent from this save's state threw
 * rather than being skipped.
 */
export const processEffectsByRoute = async (
  studioId: StudioId,
  pathId: ElementId,
  state: EngineLiveEventStateCollection
) => {
  const effects = await getEffectsByPathRef(studioId, pathId)

  if (effects.length === 0) return state

  return applyVariableSets(
    state,
    effects.map((effect) => effect.set)
  )
}

/**
 * The message a path says as it is crossed, or `undefined` for the silent case.
 *
 * `Path.notification` is the author's one line about a *transition* — the thing an
 * event's prose cannot say, because several paths can lead into one event and each
 * wants to say something different. It is the narrative twin of an effect: an
 * effect changes state silently, this tells the player something changed.
 *
 * **Resolved here rather than at render, and that is the load-bearing part.** The
 * text is stored already processed, against the state the path *arrived* with, so
 * `{ health }` in a notification is the value at the moment it was said. Deferring
 * to render would make a line in the player's history silently restate itself with
 * whatever the variable holds now, which for a log of what happened is simply
 * wrong. It is also why `state` is a parameter: the caller has already applied the
 * path's effects and the scene-scope reset, and a notification announcing an effect
 * has to see it.
 *
 * `NARRATION` rather than a message type of its own, because the type is a
 * *reading* distinction and not a record of where the text came from — and a
 * notification is read as exactly what `NARRATION` describes, a beat of the story.
 */
export const getPathNotification = async (
  studioId: StudioId,
  pathId: ElementId,
  state: EngineLiveEventStateCollection
): Promise<EngineLiveEventMessageData | undefined> => {
  try {
    const path = await getLibraryDatabase(studioId).paths.get(pathId)

    if (!path?.notification) return undefined

    const text = processTemplateToText(path.notification, state)

    // a template that resolves to nothing is not a message; an empty paragraph in
    // the reading column is worse than silence
    if (!text.trim()) return undefined

    return { text, type: ENGINE_LIVE_EVENT_MESSAGE_TYPE.TRANSITION }
  } catch (error) {
    throw error
  }
}

/**
 * Resets the scene-scoped variables of the scene being entered, if one is.
 *
 * "Entering a scene" is **the destination event sitting in a different scene from
 * the one just left**, which is not the same as a `JUMP` live event and that
 * mattered. `DESIGN.md` §11 said to reset on a JUMP, but a live event's type comes
 * from the *destination event's* type — `ENGINE_LIVE_EVENT_TYPE[eventType]` — so a
 * transition into another scene is typed CHOICE or INPUT like any other, and JUMP
 * only appears when the destination is itself a jump element. Keying off the type
 * reset nothing, ever. Found by playing it, not by reading it.
 *
 * Comparing scenes is also the more honest test: it says what the author means
 * regardless of how the player got there, and a loopback inside one scene is
 * correctly not an entry.
 *
 * The decision of *what* resets is `resetSceneScopedVariables`, which is pure and
 * tested; this resolves the two events and fetches the variables.
 */
export const processSceneScopeOnEntry = async (
  studioId: StudioId,
  worldId: WorldId,
  fromEventId: ElementId | undefined,
  toEventId: ElementId,
  state: EngineLiveEventStateCollection
) => {
  const libraryDatabase = getLibraryDatabase(studioId)

  const [fromEvent, toEvent] = await Promise.all([
    fromEventId ? libraryDatabase.events.get(fromEventId) : undefined,
    libraryDatabase.events.get(toEventId)
  ])

  if (!toEvent?.sceneId || toEvent.sceneId === fromEvent?.sceneId) return state

  const variables = await libraryDatabase.variables
    .where({ worldId })
    .toArray()

  return resetSceneScopedVariables(state, variables, toEvent.sceneId)
}

export const getEvent = async (studioId: StudioId, eventId: ElementId) => {
  try {
    return await getLibraryDatabase(studioId).events.get(eventId)
  } catch (error) {
    throw error
  }
}

export const getCharacterMask = async (
  studioId: StudioId,
  characterId: ElementId,
  maskType: CHARACTER_MASK_TYPE
): Promise<CharacterMask | undefined> => {
  try {
    const foundCharacter = await getLibraryDatabase(studioId).characters.get(
      characterId
    )

    if (foundCharacter) {
      return foundCharacter.masks.find((mask) => mask.type === maskType)
    }

    return undefined
  } catch (error) {
    throw error
  }
}

export const getCharacterReference = async (
  studioId: StudioId,
  characterId: ElementId,
  refId?: string
): Promise<string | undefined> => {
  try {
    const foundCharacter = await getLibraryDatabase(studioId).characters.get(
      characterId
    )

    if (foundCharacter) {
      if (!refId) {
        return foundCharacter.title
      }

      const foundRef = foundCharacter.refs.find((ref) => ref[0] === refId)

      if (foundRef) {
        return foundRef[1]
      } else {
        return foundCharacter.title
      }
    }

    return undefined
  } catch (error) {
    throw error
  }
}

export const getJump = async (studioId: StudioId, jumpId: ElementId) => {
  try {
    return await getLibraryDatabase(studioId).jumps.get(jumpId)
  } catch (error) {
    throw error
  }
}

export const getChoicesFromEvent = async (
  studioId: StudioId,
  eventId: ElementId
): Promise<EngineChoiceData[]> => {
  try {
    return await getLibraryDatabase(studioId).choices
      .where({ eventId })
      .toArray()
  } catch (error) {
    throw error
  }
}

export const getChoicesFromEventWithOpenPath = async (
  studioId: StudioId,
  choices: EngineChoiceData[],
  state: EngineLiveEventStateCollection,
  includeAll?: boolean, // editor can show choices with closed routes
  objectContext?: PathObjectContext
): Promise<{
  filteredChoices: EngineChoiceData[]
  openPaths: { [choiceId: ElementId]: EnginePathData }
}> => {
  const choicesFromEvent = choices,
    openPaths: { [choiceId: ElementId]: EnginePathData } = {}

  const _choices = await Promise.all(
    choicesFromEvent.map(async (choice) => {
      const pathsFromChoice = await getPathsFromChoice(studioId, choice.id)

      if (pathsFromChoice) {
        const openPath = await findOpenPath(
          studioId,
          pathsFromChoice,
          state,
          objectContext
        )

        if (openPath) {
          openPaths[choice.id] = cloneDeep(openPath)

          return choice
        }
      }

      return includeAll ? choice : undefined
    })
  )

  const filteredChoices = _choices.filter(
    (choice): choice is EngineChoiceData => choice !== undefined
  )

  return {
    filteredChoices,
    openPaths
  }
}

export const getInputByEvent = async (
  studioId: StudioId,
  pathId: ElementId
): Promise<EngineInputData | undefined> => {
  try {
    return await getLibraryDatabase(studioId).inputs.where({ pathId }).first()
  } catch (error) {
    throw error
  }
}

export const saveLiveEvent = async (
  studioId: StudioId,
  liveEventData: EngineLiveEventData
) => {
  try {
    await getLibraryDatabase(studioId).live_events.add(liveEventData)
  } catch (error) {
    throw error
  }
}

export const saveLiveEventDestination = async (
  studioId: StudioId,
  liveEventId: ElementId,
  destination: ElementId
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundLiveEvent = await libraryDatabase.live_events.get(liveEventId)

    if (foundLiveEvent) {
      await libraryDatabase.live_events.update(liveEventId, {
        ...foundLiveEvent,
        destination
      })
    }
  } catch (error) {
    throw error
  }
}

export const saveLiveEventNext = async (
  studioId: StudioId,
  liveEventId: ElementId,
  nextLiveEventId: ElementId
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundLiveEvent = await libraryDatabase.live_events.get(liveEventId)

    if (foundLiveEvent) {
      await libraryDatabase.live_events.update(liveEventId, {
        ...foundLiveEvent,
        next: nextLiveEventId
      })
    }
  } catch (error) {
    throw error
  }
}

export const saveLiveEventResult = async (
  studioId: StudioId,
  liveEventId: ElementId,
  result: EngineLiveEventResult
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundLiveEvent = await libraryDatabase.live_events.get(liveEventId)

    if (foundLiveEvent) {
      await libraryDatabase.live_events.update(liveEventId, {
        ...foundLiveEvent,
        result,
        updated: Date.now()
      })
    }
  } catch (error) {
    throw error
  }
}

export const saveLiveEventState = async (
  studioId: StudioId,
  liveEventId: ElementId,
  state: EngineLiveEventStateCollection
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundLiveEvent = await libraryDatabase.live_events.get(liveEventId)

    if (foundLiveEvent) {
      await libraryDatabase.live_events.update(liveEventId, {
        ...foundLiveEvent,
        state,
        updated: Date.now()
      })
    }
  } catch (error) {
    throw error
  }
}

/**
 * Writes the outcome of an object action onto the live event it happened on.
 *
 * One update rather than three, because the three belong together: an inventory
 * change, the variables its effects set and the sentence the storyteller says
 * about it are one beat, and a partial write is a save that has the object but
 * not the flag that says so.
 *
 * Every field is optional so a refusal — which changes nothing but still has
 * something to say — is the same call with only `messages`.
 */
export const saveLiveEventObjectOutcome = async (
  studioId: StudioId,
  liveEventId: ElementId,
  {
    objects,
    state,
    messages,
    worn
  }: {
    objects?: EngineObjectDeltaCollection
    state?: EngineLiveEventStateCollection
    messages?: EngineLiveEventMessageData[]
    worn?: ElementId[]
  }
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundLiveEvent = await libraryDatabase.live_events.get(liveEventId)

    if (foundLiveEvent) {
      await libraryDatabase.live_events.update(liveEventId, {
        ...foundLiveEvent,
        objects: objects ?? foundLiveEvent.objects,
        state: state ?? foundLiveEvent.state,
        messages: messages ?? foundLiveEvent.messages,
        worn: worn ?? foundLiveEvent.worn,
        updated: Date.now()
      })
    }
  } catch (error) {
    throw error
  }
}

export const saveLiveEventType = async (
  studioId: StudioId,
  liveEventId: ElementId,
  type: ENGINE_LIVE_EVENT_TYPE
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundEvent = await libraryDatabase.live_events.get(liveEventId)

    if (foundEvent) {
      await libraryDatabase.live_events.update(liveEventId, {
        ...foundEvent,
        type,
        updated: Date.now()
      })
    }
  } catch (error) {
    throw error
  }
}
export const saveLiveEventDate = async (
  studioId: StudioId,
  liveEventId: ElementId,
  date?: number
) => {
  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundEvent = await libraryDatabase.live_events.get(liveEventId)

    if (foundEvent) {
      await libraryDatabase.live_events.update(liveEventId, {
        ...foundEvent,
        updated: date || Date.now()
      })
    }
  } catch (error) {
    throw error
  }
}

export const getRecentLiveEvents = async (
  studioId: StudioId,
  worldId: WorldId,
  fromLiveEventId: ElementId,
  worldVersion: string,
  history?: number
): Promise<EngineLiveEventData[]> => {
  const libraryDatabase = getLibraryDatabase(studioId)

  try {
    let recentEvents: EngineLiveEventData[] = []

    // https://github.com/dfahlander/Dexie.js/issues/867#issuecomment-507865559
    const orderedLiveEvents = await libraryDatabase.live_events
        .where('[worldId+updated]')
        .between([worldId, Dexie.minKey], [worldId, Dexie.maxKey])
        .filter((liveEvent) => liveEvent.version === worldVersion)
        .limit(history || 10)
        .reverse()
        .toArray(),
      mostRecentEventIndex = orderedLiveEvents.findIndex(
        (liveEvent) => liveEvent.id === fromLiveEventId
      )

    // if restartIndex, trim recent live events to restart
    const restartIndex = orderedLiveEvents.findIndex(
      (liveEvent) => liveEvent.type === ENGINE_LIVE_EVENT_TYPE.RESTART
    )

    if (mostRecentEventIndex !== -1) {
      recentEvents =
        restartIndex !== -1
          ? orderedLiveEvents.slice(mostRecentEventIndex, restartIndex + 1)
          : orderedLiveEvents
    }

    return recentEvents
  } catch (error) {
    throw error
  }
}

export const checkLiveEventDestinations = async (
  studioId: StudioId,
  worldId: WorldId,
  events: EngineEventData[]
) => {
  const eventIds = events.map((event) => event.id),
    liveEventDestinationIds = await (
      await getLibraryDatabase(studioId).live_events
        .where({ worldId })
        .toArray()
    ).map((liveEvent) => liveEvent.destination)

  let destinationsValid = true

  liveEventDestinationIds.map((eventDestinationId) => {
    if (eventIds.indexOf(eventDestinationId) === -1) {
      destinationsValid = false
      return
    }
  })

  return destinationsValid
}

export const getLiveEventInitial = async (
  studioId: StudioId,
  worldId: WorldId
) => {
  try {
    return await getLibraryDatabase(studioId).live_events.get(
      `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${worldId}`
    )
  } catch (error) {
    throw error
  }
}

export const getLiveEvent = async (studioId: StudioId, eventId: ElementId) => {
  try {
    return await getLibraryDatabase(studioId).live_events.get(eventId)
  } catch (error) {
    throw error
  }
}

export const getPathsFromChoice = async (
  studioId: StudioId,
  choiceId: ElementId
): Promise<EnginePathData[]> => {
  try {
    return await getLibraryDatabase(studioId).paths
      .where({ choiceId })
      .toArray()
  } catch (error) {
    throw error
  }
}

export const getPathsFromChoices = async (
  studioId: StudioId,
  choiceIds: ElementId[]
) => {
  try {
    return await getLibraryDatabase(studioId).paths
      .where('choiceId')
      .anyOf(choiceIds)
      .toArray()
  } catch (error) {
    throw error
  }
}

export const getPathsFromInput = async (
  studioId: StudioId,
  inputId: ElementId
) => {
  try {
    return await getLibraryDatabase(studioId).paths
      .where({ inputId })
      .toArray()
  } catch (error) {
    throw error
  }
}

export const getPathFromDestination = async (
  studioId: StudioId,
  destinationId: ElementId
) => {
  try {
    return getLibraryDatabase(studioId).paths.where({ destinationId }).first()
  } catch (error) {
    throw error
  }
}

export const getObjects = async (studioId: StudioId, worldId: WorldId) => {
  try {
    return await getLibraryDatabase(studioId).objects
      .where({ worldId })
      .toArray()
  } catch (error) {
    throw error
  }
}

/**
 * Every recipe in the world.
 *
 * Read whole and matched in memory rather than queried by input, because a
 * recipe's inputs are an array of objects and a Dexie multi-entry index cannot
 * reach inside them. Recipe counts are in the tens; if that stops being true, an
 * index costs one Dexie version and no change of shape.
 */
export const getRecipes = async (studioId: StudioId, worldId: WorldId) => {
  try {
    return await getLibraryDatabase(studioId).recipes
      .where({ worldId })
      .toArray()
  } catch (error) {
    throw error
  }
}

export const getObjectConditionsByPaths = async (
  studioId: StudioId,
  pathIds: ElementId[]
) => {
  try {
    return await getLibraryDatabase(studioId).objectConditions
      .where('pathId')
      .anyOf(pathIds)
      .toArray()
  } catch (error) {
    throw error
  }
}

/**
 * What the object model needs in order to judge an object condition on a path.
 *
 * Deliberately does **not** carry the variable state: `findOpenPath` passes the
 * state it was asked to evaluate against, which is not always the live event's own.
 * `EventInput` evaluates against the state *plus the value just typed*, and a
 * placement gate reading the pre-input value instead would disagree with the path
 * condition beside it about the same variable.
 *
 * Optional so a caller with no live event in reach still compiles, but a path
 * carrying object conditions and given no context is treated as **closed** — see
 * `isPathOpen`.
 */
export interface PathObjectContext {
  worldId: WorldId
  liveEvent: {
    /** the event the player is on; its scene resolves CURRENT_SCENE */
    destination?: ElementId
    objects?: EngineObjectDeltaCollection
  }
}

/**
 * Builds the snapshot the object model needs.
 *
 * The current scene is derived here, from the destination event's `sceneId`, rather
 * than being asked of every caller — the engine has no notion of a "current scene"
 * anywhere else either, and `AudioMixer` already reaches it the same way. Deriving
 * it in one place is what keeps a caller from passing the wrong one or forgetting.
 *
 * Kept out of `objects.ts` so that module stays pure and synchronous.
 */
export const getObjectWorldSnapshot = async (
  studioId: StudioId,
  worldId: WorldId,
  state: EngineLiveEventStateCollection,
  liveEvent: {
    destination?: ElementId
    objects?: EngineObjectDeltaCollection
  }
): Promise<ObjectWorldSnapshot> => {
  const libraryDatabase = getLibraryDatabase(studioId)

  const [objects, world, destinationEvent] = await Promise.all([
    libraryDatabase.objects.where({ worldId }).toArray(),
    libraryDatabase.worlds.get(worldId),
    liveEvent.destination
      ? libraryDatabase.events.get(liveEvent.destination)
      : undefined
  ])

  return {
    objects,
    deltas: liveEvent.objects ?? {},
    state,
    currentSceneId: destinationEvent?.sceneId,
    noRecipeMessage: world?.objectNoRecipeMessage
  }
}

export const findOpenPath = async (
  studioId: StudioId,
  paths: EnginePathData[],
  liveEventState: EngineLiveEventStateCollection,
  objectContext?: PathObjectContext
) => {
  const pathIds = paths.map((path) => path.id),
    openPaths: [EnginePathData, number][] = []

  const [conditionsByPaths, objectConditionsByPaths] = await Promise.all([
    getConditionsByPaths(studioId, pathIds),
    getObjectConditionsByPaths(studioId, pathIds)
  ])

  // Only built when something actually needs it, so a world with no object
  // conditions costs no extra reads beyond the indexed lookup above.
  const objectSnapshot =
    objectConditionsByPaths.length > 0 && objectContext
      ? await getObjectWorldSnapshot(
          studioId,
          objectContext.worldId,
          liveEventState,
          objectContext.liveEvent
        )
      : undefined

  if (conditionsByPaths) {
    await Promise.all(
      paths.map(async (path) => {
        const pathOpen = await isPathOpen(
          studioId,
          cloneDeep(liveEventState),
          path.conditionsType,
          conditionsByPaths.filter((condition) => condition.pathId === path.id),
          objectConditionsByPaths.filter(
            (condition) => condition.pathId === path.id
          ),
          objectSnapshot
        )

        pathOpen[0] && openPaths.push([cloneDeep(path), pathOpen[1]])
      })
    )
  }

  if (openPaths.length > 0) {
    const pathsWithConditions = openPaths.filter((path) => path[1] > 0)

    return pathsWithConditions.length > 0
      ? pathsWithConditions[(pathsWithConditions.length * Math.random()) | 0][0]
      : openPaths[(openPaths.length * Math.random()) | 0][0]
  } else {
    return undefined
  }
}

/**
 * Whether a path's conditions are satisfied, and **how many** it had.
 *
 * The count is not decoration: `findOpenPath` prefers a path that had conditions
 * over one that had none (feedback#105), so it must include object conditions or a
 * path gated only on objects silently loses that preference.
 *
 * The two kinds aggregate into the same array, so `PATH_CONDITIONS_TYPE` still
 * composes across both — ALL means every variable *and* object condition, ANY means
 * one of either.
 *
 * **They fail in opposite directions, deliberately.** A variable condition whose
 * variable cannot be resolved is dropped, so under ALL it leaves the path open;
 * that is behaviour worlds have been authored against since 0.6 and is not being
 * changed here. An object condition that cannot be evaluated is pushed as `false`,
 * closing the path — new code will not unlock content on the strength of a
 * comparison nobody could make. This asymmetry is why object conditions are a
 * separate collection with a separate evaluator rather than another row shape in
 * `conditions`, where every reader that missed them would have failed open.
 *
 * The comparison rules themselves live in `lib/state.ts`, shared with placement
 * gates, so a path and a gate cannot disagree about the same authored comparison.
 */
export const isPathOpen = async (
  studioId: StudioId,
  liveEventState: EngineLiveEventStateCollection,
  pathConditionsType: PATH_CONDITIONS_TYPE,
  conditions: EngineConditionData[],
  objectConditions: EngineObjectConditionData[] = [],
  objectSnapshot?: ObjectWorldSnapshot
  // feedback#105
): Promise<[boolean, number]> => {
  const totalConditions = conditions.length + objectConditions.length

  if (totalConditions === 0) return [true, 0]

  const isOpenAgg: boolean[] = []

  if (conditions.length) {
    const variableIdsFromConditions = conditions.map(
      (condition) => condition.variableId
    )

    let variablesFromConditions: EngineVariableData[]

    try {
      variablesFromConditions = await getLibraryDatabase(studioId).variables
        .where('id')
        .anyOf(variableIdsFromConditions)
        .toArray()
    } catch (error) {
      throw error
    }

    conditions.map((condition) => {
      // #400
      const foundVariable = variablesFromConditions.find(
        (variable) => variable.id === condition.compare[0]
      )

      if (!foundVariable) return

      /*
       * Guarded, where it was not before. The old body read
       * `liveEventState[condition.compare[0]].value` before checking the entry
       * existed, so a condition naming a variable missing from this save's state
       * threw rather than being skipped — reachable with a save taken before the
       * variable was added and not yet reconciled. Skipping matches what an
       * unresolvable variable already did.
       */
      const entry = liveEventState[condition.compare[0]]

      if (!entry) return

      const holds = variableCompareHolds(
        condition.compare,
        foundVariable.type,
        entry.value
      )

      // undefined is "no opinion" — an ordering operator on a string. Dropped, as
      // it always has been.
      if (holds !== undefined) isOpenAgg.push(holds)
    })
  }

  objectConditions.forEach((condition) => {
    if (!objectSnapshot) {
      console.error(
        '[STORYTELLER] unable to evaluate an object condition without a world snapshot; treating the path as closed.'
      )

      isOpenAgg.push(false)

      return
    }

    isOpenAgg.push(objectCompareHolds(objectSnapshot, condition))
  })

  return pathConditionsType === PATH_CONDITIONS_TYPE.ALL
    ? [isOpenAgg.every((value) => value === true), totalConditions]
    : [isOpenAgg.some((value) => value === true), totalConditions]
}

export const getScene = async (studioId: StudioId, sceneId: ElementId) => {
  try {
    return await getLibraryDatabase(studioId).scenes.get(sceneId)
  } catch (error) {
    throw error
  }
}

export const getVariable = async (
  studioId: StudioId,
  variableId: ElementId
) => {
  try {
    return await getLibraryDatabase(studioId).variables.get(variableId)
  } catch (error) {
    throw error
  }
}

export const getSettingsDefault = async (
  studioId: StudioId,
  worldId: WorldId
) => {
  try {
    return await getLibraryDatabase(studioId).settings.get(
      `${DEFAULT_ENGINE_SETTINGS_KEY}${worldId}`
    )
  } catch (error) {
    throw error
  }
}

export const savePresentationSettings = async (
  studioId: StudioId,
  worldId: WorldId,
  settings: {
    theme?: ENGINE_THEME
    font?: ENGINE_FONT
    size?: ENGINE_SIZE
    motion?: ENGINE_MOTION
    muted: boolean
  }
) => {
  const { theme, font, motion, muted, size } = settings

  try {
    const libraryDatabase = getLibraryDatabase(studioId),
      foundSettings = await libraryDatabase.settings.get(
        `${DEFAULT_ENGINE_SETTINGS_KEY}${worldId}`
      )

    if (foundSettings) {
      await libraryDatabase.settings.update(
        `${DEFAULT_ENGINE_SETTINGS_KEY}${worldId}`,
        {
          ...foundSettings,
          theme: theme || ENGINE_THEME.BOOK,
          font: font || ENGINE_FONT.SANS,
          motion: motion || ENGINE_MOTION.FULL,
          muted,
          size: size || ENGINE_SIZE.DEFAULT
        }
      )
    } else {
      throw 'Unable to save theme setting. Missing settings.'
    }
  } catch (error) {
    throw error
  }
}

export const getPresentationSettings = async (
  studioId: StudioId,
  worldId: WorldId
) => {
  try {
    const settings = await getLibraryDatabase(studioId).settings.get(
      `${DEFAULT_ENGINE_SETTINGS_KEY}${worldId}`
    )

    return {
      theme: settings?.theme,
      font: settings?.font,
      motion: settings?.motion,
      muted: settings?.muted,
      size: settings?.size
    }
  } catch (error) {
    throw error
  }
}
