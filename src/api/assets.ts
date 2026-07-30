import { ipcRenderer } from 'electron'

import { ElementId, StudioId, WorldId } from '../data/types'

import { collectAssetReferences, REFERENCED_EXTENSION } from '../lib/assets'
import { WINDOW_EVENT_TYPE } from '../lib/events'

import api from '.'

/**
 * Trash an asset, but only once nothing in the storyworld still names it.
 *
 * An asset id is not owned by the element that happens to be showing it. Two
 * character masks may carry the same id, two events may share an mp3, and
 * assigning an existing asset from the asset manager makes both of those the
 * normal case rather than an accident. Removing the file because one reference
 * went away takes it out from under every other.
 *
 * The count is taken through `collectAssetReferences`, so it covers all four
 * places a storyworld names an asset rather than just the one the caller happens
 * to know about — a mask and an event image cannot collide today, but the count
 * is only correct if it is complete.
 *
 * **Clear the reference before calling this.** The count is read from the
 * database, so an element still holding the id counts as a reference and nothing
 * is ever trashed. `filterOutEventIds` is the exception, for `removeEvent`,
 * which cannot save an event it is in the middle of deleting.
 *
 * Trashed rather than deleted, so `RESTORE_ASSET` still applies.
 *
 * @returns whether the file was trashed
 */
export async function removeAssetIfUnreferenced(
  studioId: StudioId,
  worldId: WorldId,
  assetId: string,
  ext: REFERENCED_EXTENSION,
  filterOutEventIds?: ElementId[]
): Promise<boolean> {
  try {
    const [characters, events, scenes] = await Promise.all([
      api().characters.getCharactersByWorldRef(studioId, worldId),
      api().events.getEventsByWorldRef(studioId, worldId),
      api().scenes.getScenesByWorldRef(studioId, worldId)
    ])

    const references =
      collectAssetReferences({
        characters,
        events: events.filter(
          (event) => event.id && !filterOutEventIds?.includes(event.id)
        ),
        scenes
      }).get(assetId) ?? []

    if (references.length > 0) return false

    await ipcRenderer.invoke(WINDOW_EVENT_TYPE.REMOVE_ASSET, {
      studioId,
      worldId,
      id: assetId,
      ext,
      trash: true
    })

    return true
  } catch (error) {
    throw error
  }
}
