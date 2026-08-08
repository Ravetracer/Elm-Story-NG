import { getLibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { StudioId, WorldId, ElementId, Folder } from '../data/types'

const useFolders = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): Folder[] | undefined => {
  const chapters = useLiveQuery(
    () => getLibraryDatabase(studioId).folders.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  // Sorted by title for the flat lists and pickers that read this (element
  // dropdowns, the managers). The storyworld outline does NOT use this order:
  // createWorldOutlineTreeData builds each node's children from the stored
  // `children` arrays — the author's manual arrangement — so this sort neither
  // sets nor fights outline order.
  if (chapters) chapters.sort((a, b) => (a.title > b.title ? 1 : -1))

  return chapters
}

const useFolder = (
  studioId: StudioId,
  folderId: ElementId,
  deps?: any[]
): Folder | undefined =>
  useLiveQuery(
    () => getLibraryDatabase(studioId).folders.where({ id: folderId }).first(),
    deps || [],
    undefined
  )

export { useFolder }

export default useFolders
