import dagre from '@dagrejs/dagre'

import { ElementId } from '../data/types'

/**
 * Automatic placement for a scene map.
 *
 * Pure, like `sceneMapClipboard`: it is handed measured node sizes and the edges
 * between them and returns where each node should go. Nothing here reads the
 * database, the react-flow store or the DOM, which is what makes the geometry
 * testable — a layout that is subtly wrong looks plausible on screen and is only
 * obvious in numbers.
 *
 * react-flow-renderer 9 has no layout of its own, so this wraps dagre. dagre is a
 * plain graph library with no React peer dependency, which matters here because
 * everything in the renderer is pinned by React 17.
 */
export enum SCENE_MAP_LAYOUT_COMMAND {
  LAYOUT = 'LAYOUT',
  UNDO = 'UNDO'
}

export interface LayoutNode {
  id: ElementId
  width: number
  height: number
}

export interface LayoutEdge {
  source: ElementId
  target: ElementId
}

export interface SceneMapPosition {
  x: number
  y: number
}

/**
 * What a layout replaced, so it can be put back.
 *
 * Carries its own `sceneId` for the same reason the clipboard carries a
 * `worldId`: it lives in `ComposerContext`, which every open scene tab shares,
 * and rc-dock keeps them all mounted. Without it, undoing in one scene would
 * offer to restore positions belonging to another.
 */
export interface SceneMapLayoutUndo {
  sceneId: ElementId
  positions: [ElementId, SceneMapPosition][]
}

/** Between nodes sharing a rank — a column, since the layout runs left to right. */
export const NODE_SEPARATION = 40

/** Between one rank and the next. */
export const RANK_SEPARATION = 120

/**
 * Left to right, because that is the direction the map already reads in: an event
 * node's choice handles are on its right edge and its target handle on its left,
 * so a path drawn against the rank direction doubles back on itself.
 */
const RANK_DIRECTION = 'LR'

/**
 * Where each node should sit, keyed by element id.
 *
 * Two conversions are the whole of the fiddly part:
 *
 * - **dagre reports centres, react-flow wants top-left corners.** Subtracting
 *   half the node's own measured size is why the sizes have to be measured rather
 *   than assumed — an event node's height varies with its choices, its character
 *   references and whether it is an input.
 * - **The result is anchored to `origin`.** dagre lays out from (0, 0), so
 *   without this a scene the author had worked at some far corner of the canvas
 *   would jump to the top-left of the world and leave the viewport looking at
 *   nothing.
 *
 * Nodes are sorted before they are added and edges are deduplicated, so the same
 * scene lays out identically every time. dagre iterates its own insertion order,
 * so an unsorted call would otherwise let two runs over the same scene disagree.
 */
export const layoutSceneMap = (
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  origin: SceneMapPosition = { x: 0, y: 0 }
): Map<ElementId, SceneMapPosition> => {
  const positions = new Map<ElementId, SceneMapPosition>()

  if (nodes.length === 0) return positions

  const graph = new dagre.graphlib.Graph()

  graph.setGraph({
    rankdir: RANK_DIRECTION,
    nodesep: NODE_SEPARATION,
    ranksep: RANK_SEPARATION
  })

  // dagre asks for a default label for any edge it is given
  graph.setDefaultEdgeLabel(() => ({}))

  const sortedNodes = [...nodes].sort((a, b) => (a.id > b.id ? 1 : -1))

  sortedNodes.forEach(({ id, width, height }) =>
    graph.setNode(id, { width, height })
  )

  const known = new Set(sortedNodes.map(({ id }) => id))

  const seenEdges = new Set<string>()

  ;[...edges]
    .sort((a, b) =>
      `${a.source}${a.target}` > `${b.source}${b.target}` ? 1 : -1
    )
    .forEach(({ source, target }) => {
      // a choice looping back to its own event is legal and constrains nothing
      if (source === target) return

      // several choices may lead from one event to the same next event; dagre
      // would need a multigraph to hold them and the extra copies would not
      // change where anything goes
      const key = `${source}->${target}`

      if (seenEdges.has(key)) return

      // a path is only copied with both of its ends, but a scene read mid-write
      // could still name one that is not here
      if (!known.has(source) || !known.has(target)) return

      seenEdges.add(key)

      graph.setEdge(source, target)
    })

  dagre.layout(graph)

  let minX = Infinity,
    minY = Infinity

  const topLeft = new Map<ElementId, SceneMapPosition>()

  sortedNodes.forEach(({ id, width, height }) => {
    const laidOut = graph.node(id)

    if (!laidOut) return

    const x = laidOut.x - width / 2,
      y = laidOut.y - height / 2

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)

    topLeft.set(id, { x, y })
  })

  topLeft.forEach(({ x, y }, id) =>
    positions.set(id, {
      // rounded, because these are persisted and a scene map position with
      // sixteen decimal places is noise in every diff and every export
      x: Math.round(x - minX + origin.x),
      y: Math.round(y - minY + origin.y)
    })
  )

  return positions
}

/**
 * The top-left corner of what a set of nodes currently occupies, which is where
 * the laid-out graph is anchored so the result appears where the author was
 * already looking.
 */
export const sceneMapLayoutOrigin = (
  positions: SceneMapPosition[]
): SceneMapPosition =>
  positions.length === 0
    ? { x: 0, y: 0 }
    : {
        x: Math.min(...positions.map(({ x }) => x)),
        y: Math.min(...positions.map(({ y }) => y))
      }
