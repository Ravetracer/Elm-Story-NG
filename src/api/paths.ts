import { getLibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'

import { ElementId, WorldId, Path, StudioId } from '../data/types'

export async function getPath(studioId: StudioId, pathId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getPath(pathId)
  } catch (error) {
    throw error
  }
}

export async function getPathsByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Path[]> {
  try {
    return await getLibraryDatabase(studioId).getPathsByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function getPassthroughPathsByEventRef(
  studioId: StudioId,
  eventId: ElementId
) {
  try {
    const foundPaths = await getLibraryDatabase(studioId).paths
      .where({ originId: eventId })
      .toArray()

    return foundPaths.filter((foundPath) => foundPath.choiceId === undefined)
  } catch (error) {
    throw error
  }
}

export async function getPathsByDestinationRef(
  studioId: StudioId,
  destinationId: ElementId
) {
  try {
    return await getLibraryDatabase(studioId).paths
      .where({ destinationId })
      .toArray()
  } catch (error) {
    throw error
  }
}

export async function savePath(
  studioId: StudioId,
  path: Path
): Promise<ElementId> {
  if (!path.id) path.id = uuid()

  try {
    return await getLibraryDatabase(studioId).savePath(path)
  } catch (error) {
    throw error
  }
}

export async function savePathNotification(
  studioId: StudioId,
  pathId: ElementId,
  notification: string | undefined
) {
  try {
    return await getLibraryDatabase(studioId).savePathNotification(
      pathId,
      notification
    )
  } catch (error) {
    throw error
  }
}

export async function removePath(studioId: StudioId, pathId: ElementId) {
  try {
    await getLibraryDatabase(studioId).removePath(pathId)
  } catch (error) {
    throw error
  }
}

export async function removePathsByEventRef(
  studioId: StudioId,
  eventId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).removePathsByEventRef(eventId)
  } catch (error) {
    throw error
  }
}

export async function removePathsByJumpRef(
  studioId: StudioId,
  eventId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).removePathsByJumpRef(eventId)
  } catch (error) {
    throw error
  }
}

export async function removePathsByChoiceRef(
  studioId: StudioId,
  choiceId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).removePathsByChoiceRef(choiceId)
  } catch (error) {
    throw error
  }
}
