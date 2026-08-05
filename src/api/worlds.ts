import { getLibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'

import {
  StudioId,
  World,
  WorldId,
  ElementId,
  WorldChildRefs
} from '../data/types'

import api from '.'

export async function getWorld(
  studioId: StudioId,
  worldId: WorldId
): Promise<World> {
  try {
    return await getLibraryDatabase(studioId).getWorld(worldId)
  } catch (error) {
    throw error
  }
}

export async function getWorlds(
  studioId: StudioId,
  worldRefs: WorldId[]
): Promise<(World | undefined)[]> {
  return await getLibraryDatabase(studioId).worlds.bulkGet(worldRefs)
}

export async function saveWorld(
  studioId: StudioId,
  world: World
): Promise<World> {
  if (!world.id) world.id = uuid()

  try {
    await api().studios.saveWorldRef(studioId, world.id)

    return await getLibraryDatabase(studioId).saveWorld(world)
  } catch (error) {
    throw error
  }
}

export async function saveChildRefsToWorld(
  studioId: StudioId,
  worldId: WorldId,
  children: WorldChildRefs
) {
  try {
    await getLibraryDatabase(studioId).saveChildRefsToWorld(worldId, children)
  } catch (error) {
    throw error
  }
}

export async function saveJumpRefToWorld(
  studioId: StudioId,
  worldId: WorldId,
  jumpId: ElementId | null
) {
  try {
    await getLibraryDatabase(studioId).saveJumpRefToWorld(worldId, jumpId)
  } catch (error) {
    throw error
  }
}

export async function removeWorld(studioId: StudioId, worldId: WorldId) {
  try {
    // The studio's `worlds` array in the app database is the one place a world is
    // named outside its own library database. Cleared first, so a failure in the
    // larger delete below leaves the world still listed and re-deletable rather
    // than orphaned and hidden.
    await api().studios.removeWorldRef(studioId, worldId)

    await getLibraryDatabase(studioId).removeWorld(studioId, worldId)

    // The composer preview installs through the embedded engine, which writes a
    // `worldId -> { worldId, studioId }` meta entry into the renderer's
    // localStorage (engine `saveWorldMeta`). Nothing else clears it, so a world
    // previewed and then deleted would leave the entry behind. A no-op if the
    // world was never previewed.
    window.localStorage.removeItem(worldId)
  } catch (error) {
    throw error
  }
}
