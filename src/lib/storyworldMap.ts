import {
  ElementId,
  ELEMENT_TYPE,
  Folder,
  Jump,
  Scene
} from '../data/types'

/**
 * The storyworld above the scene: which scenes exist, and which jumps lead from
 * one to another.
 *
 * Pure, like `sceneMapClipboard` and `sceneMapLayout`. What makes it worth
 * separating is that the graph is not written down anywhere — it is inferred
 * from where each jump happens to sit and where it points, and getting that
 * inference wrong produces a map that looks authoritative and is quietly
 * missing connections.
 *
 * **A scene is only ever reached by a jump.** A `Path` connects two events
 * inside one scene, so nothing crosses a scene boundary except a `Jump`. That is
 * what makes "no incoming jump" a fact worth showing rather than a guess.
 */

/** A scene, as the map draws it. */
export interface StoryworldMapNode {
  id: ElementId
  title: string
  /** ancestor folder titles, outermost first; empty when the scene sits at the world root */
  folderPath: string[]
  /** how many events and jumps the scene holds */
  childCount: number
  /** the storyworld's opening jump lands here */
  isStart: boolean
  /** jumps in this scene that lead back into it, which are not drawn as edges */
  selfJumps: number
  /** nothing jumps here and it is not where the storyworld opens */
  hasNoWayIn: boolean
}

/** One or more jumps leading from one scene to another. */
export interface StoryworldMapEdge {
  id: string
  source: ElementId
  target: ElementId
  /** every jump that makes this connection; several may lead the same way */
  jumpIds: ElementId[]
}

export interface StoryworldMap {
  nodes: StoryworldMapNode[]
  edges: StoryworldMapEdge[]
}

export interface StoryworldMapSources {
  scenes: Scene[]
  jumps: Jump[]
  folders: Folder[]
  /** `World.jump` — the jump the storyworld opens on, if it has one */
  openingJumpId?: ElementId | null
}

/**
 * The folder titles above a scene, outermost first.
 *
 * Walks `parent` rather than reading `children`, because a scene knows its
 * parent directly while finding it from above means searching every folder. The
 * walk is bounded by the number of folders, so a parent cycle — which the
 * outline should never produce, but which a hand-edited import could — stops
 * rather than hanging the renderer.
 */
export const folderPathForScene = (
  scene: Scene,
  folders: Folder[]
): string[] => {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))

  const path: string[] = []

  let [parentType, parentId] = scene.parent

  for (let depth = 0; depth <= folders.length; depth++) {
    if (parentType !== ELEMENT_TYPE.FOLDER || !parentId) break

    const folder = byId.get(parentId)

    if (!folder) break

    path.unshift(folder.title)
    ;[parentType, parentId] = folder.parent
  }

  return path
}

/**
 * Builds the map.
 *
 * A jump contributes an edge only when both ends are scenes that exist: its
 * origin is the scene it sits in (`Jump.sceneId`) and its destination the first
 * element of its `path`. Three cases are deliberately not edges:
 *
 * - **A jump with no `sceneId`** does not sit in a scene, so it has no origin to
 *   draw from. The storyworld's opening jump is the ordinary example.
 * - **A jump whose destination is unset or gone** is a dangling jump. It is left
 *   off rather than drawn to nowhere; the scene it sits in still appears.
 * - **A jump leading back into its own scene** would be a self-loop, which
 *   react-flow 9 draws as a zero-length line. It is counted on the node instead,
 *   so it is visible rather than silently dropped.
 *
 * Jumps that lead the same way are collapsed into one edge carrying all of their
 * ids, because two arrows between the same pair of scenes say nothing the count
 * does not.
 */
export const buildStoryworldMap = ({
  scenes,
  jumps,
  folders,
  openingJumpId
}: StoryworldMapSources): StoryworldMap => {
  const sceneIds = new Set(
    scenes.map(({ id }) => id).filter((id): id is ElementId => Boolean(id))
  )

  const openingJump = openingJumpId
    ? jumps.find(({ id }) => id === openingJumpId)
    : undefined

  const startSceneId = openingJump?.path[0]

  const selfJumps = new Map<ElementId, number>()

  const edgesByPair = new Map<string, StoryworldMapEdge>()

  const withIncoming = new Set<ElementId>()

  // sorted, so the map is the same on every open and a diff of two runs is empty
  ;[...jumps]
    .sort((a, b) => ((a.id || '') > (b.id || '') ? 1 : -1))
    .forEach((jump) => {
      const source = jump.sceneId,
        target = jump.path[0]

      if (!jump.id || !target || !sceneIds.has(target)) return

      if (!source || !sceneIds.has(source)) {
        // no origin to draw from, but it still reaches the target
        withIncoming.add(target)

        return
      }

      if (source === target) {
        selfJumps.set(source, (selfJumps.get(source) || 0) + 1)

        return
      }

      withIncoming.add(target)

      const key = `${source}->${target}`,
        existing = edgesByPair.get(key)

      existing
        ? existing.jumpIds.push(jump.id)
        : edgesByPair.set(key, {
            id: key,
            source,
            target,
            jumpIds: [jump.id]
          })
    })

  const nodes: StoryworldMapNode[] = scenes
    .filter((scene): scene is Scene => Boolean(scene.id))
    .map((scene) => {
      const id = scene.id as ElementId

      return {
        id,
        title: scene.title,
        folderPath: folderPathForScene(scene, folders),
        childCount: scene.children.length,
        isStart: id === startSceneId,
        selfJumps: selfJumps.get(id) || 0,
        hasNoWayIn: !withIncoming.has(id) && id !== startSceneId
      }
    })
    .sort((a, b) => (a.id > b.id ? 1 : -1))

  return { nodes, edges: [...edgesByPair.values()] }
}
