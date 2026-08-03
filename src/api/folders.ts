import { LIBRARY_TABLE, getLibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'

import {
  Folder,
  ElementId,
  WorldId,
  StudioId,
  FolderChildRefs,
  FolderParentRef
} from '../data/types'

export async function getFolder(studioId: StudioId, folderId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getFolder(folderId)
  } catch (error) {
    throw error
  }
}

export async function saveFolder(
  studioId: StudioId,
  folder: Folder
): Promise<ElementId> {
  if (!folder.id) folder.id = uuid()

  try {
    return await getLibraryDatabase(studioId).saveFolder(folder)
  } catch (error) {
    throw error
  }
}

export async function removeFolder(studioId: StudioId, folderId: ElementId) {
  try {
    await getLibraryDatabase(studioId).removeFolder(folderId)
  } catch (error) {
    throw error
  }
}

export async function getFoldersByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Folder[]> {
  try {
    return await getLibraryDatabase(studioId).getFoldersByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function getChildRefsByFolderRef(
  studioId: StudioId,
  folderId: ElementId
): Promise<FolderChildRefs> {
  try {
    return await getLibraryDatabase(studioId).getChildRefsByFolderRef(folderId)
  } catch (error) {
    throw error
  }
}

export async function saveFolderTitle(
  studioId: StudioId,
  folderId: ElementId,
  title: string
) {
  try {
    await getLibraryDatabase(studioId).saveElementTitle(
      folderId,
      LIBRARY_TABLE.FOLDERS,
      title
    )
  } catch (error) {
    throw error
  }
}

export async function saveParentRefToFolder(
  studioId: StudioId,
  parent: FolderParentRef,
  folderId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).saveParentRefToFolder(parent, folderId)
  } catch (error) {
    throw error
  }
}

export async function saveChildRefsToFolder(
  studioId: StudioId,
  folderId: ElementId,
  children: FolderChildRefs
) {
  try {
    await getLibraryDatabase(studioId).saveChildRefsToFolder(
      folderId,
      children
    )
  } catch (error) {
    throw error
  }
}
