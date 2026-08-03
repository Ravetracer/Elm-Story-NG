import { LIBRARY_TABLE, getLibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'

import {
  Scene,
  ElementId,
  StudioId,
  WorldId,
  SceneParentRef,
  SceneChildRefs
} from '../data/types'

export async function getScene(studioId: StudioId, sceneId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getScene(sceneId)
  } catch (error) {
    throw error
  }
}

export async function saveScene(
  studioId: StudioId,
  scene: Scene
): Promise<ElementId> {
  if (!scene.id) scene.id = uuid()

  try {
    return await getLibraryDatabase(studioId).saveScene(scene)
  } catch (error) {
    throw error
  }
}

export async function removeScene(studioId: StudioId, sceneId: ElementId) {
  try {
    await getLibraryDatabase(studioId).removeScene(sceneId)
  } catch (error) {
    throw error
  }
}

export async function getScenesByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Scene[]> {
  try {
    return await getLibraryDatabase(studioId).getScenesByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function getChildRefsBySceneRef(
  studioId: StudioId,
  sceneId: ElementId
): Promise<SceneChildRefs> {
  try {
    return await getLibraryDatabase(studioId).getChildRefsBySceneRef(sceneId)
  } catch (error) {
    throw error
  }
}

export async function saveSceneTitle(
  studioId: StudioId,
  sceneId: ElementId,
  title: string
) {
  try {
    await getLibraryDatabase(studioId).saveElementTitle(
      sceneId,
      LIBRARY_TABLE.SCENES,
      title
    )
  } catch (error) {
    throw error
  }
}

export async function saveSceneViewTransform(
  studioId: StudioId,
  sceneId: ElementId,
  transform: { x: number; y: number; zoom: number }
) {
  try {
    await getLibraryDatabase(studioId).saveSceneViewTransform(
      sceneId,
      transform
    )
  } catch (error) {
    throw error
  }
}

export async function saveParentRefToScene(
  studioId: StudioId,
  parent: SceneParentRef,
  sceneId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).saveParentRefToScene(parent, sceneId)
  } catch (error) {
    throw error
  }
}

export async function saveChildRefsToScene(
  studioId: StudioId,
  sceneId: ElementId,
  children: SceneChildRefs
) {
  try {
    await getLibraryDatabase(studioId).saveChildRefsToScene(sceneId, children)
  } catch (error) {
    throw error
  }
}
