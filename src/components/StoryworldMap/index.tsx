import React, { useMemo } from 'react'

import ReactFlow, {
  Background,
  Controls,
  Edge,
  Elements,
  MiniMap,
  Node
} from 'react-flow-renderer'

import { ElementId, StudioId, WorldId } from '../../data/types'

import { useFolders, useJumps, useScenes, useWorld } from '../../hooks'

import {
  buildStoryworldMap,
  StoryworldMapNode
} from '../../lib/storyworldMap'
import { layoutSceneMap } from '../../lib/sceneMapLayout'

import SceneNode from './SceneNode'

import styles from './styles.module.less'

/**
 * Scene nodes are a fixed size, unlike event nodes, so the layout is handed the
 * same numbers the stylesheet uses rather than measuring the DOM. Keep the two
 * in step: dagre spaces ranks by these, so a node that renders taller than this
 * says overlaps its neighbour.
 */
export const SCENE_NODE_WIDTH = 220
export const SCENE_NODE_HEIGHT = 96

const StoryworldMap: React.FC<{
  studioId: StudioId
  worldId: WorldId
  onSelectScene: (sceneId: ElementId) => void
}> = ({ studioId, worldId, onSelectScene }) => {
  const world = useWorld(studioId, worldId, [worldId]),
    scenes = useScenes(studioId, worldId, [worldId]),
    jumps = useJumps(studioId, worldId, [worldId]),
    folders = useFolders(studioId, worldId, [worldId])

  const map = useMemo(
    () =>
      scenes && jumps && folders
        ? buildStoryworldMap({
            scenes,
            jumps,
            folders,
            openingJumpId: world?.jump
          })
        : undefined,
    [scenes, jumps, folders, world?.jump]
  )

  /**
   * Laid out on every open rather than stored.
   *
   * The map is derived: nothing here is authored, so there is no position to
   * remember and nothing to drift out of date. `layoutSceneMap` is deterministic,
   * so the same storyworld draws the same way every time — which is what makes an
   * unremembered layout tolerable to work with.
   */
  const elements: Elements<StoryworldMapNode> | undefined = useMemo(() => {
    if (!map) return undefined

    const positions = layoutSceneMap(
      map.nodes.map(({ id }) => ({
        id,
        width: SCENE_NODE_WIDTH,
        height: SCENE_NODE_HEIGHT
      })),
      map.edges
    )

    const nodes: Node<StoryworldMapNode>[] = map.nodes.map((node) => ({
      id: node.id,
      type: 'sceneNode',
      data: node,
      position: positions.get(node.id) || { x: 0, y: 0 },
      // the map reports, it does not author
      draggable: false,
      connectable: false
    }))

    const edges: Edge[] = map.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: false,
      // several jumps leading the same way are one edge, so the count is the
      // only place that plurality is visible
      label: edge.jumpIds.length > 1 ? `${edge.jumpIds.length}` : undefined,
      labelBgPadding: [6, 2],
      labelBgBorderRadius: 8,
      labelStyle: { fill: 'hsl(0, 0%, 70%)', fontSize: 11 },
      labelBgStyle: { fill: 'hsl(0, 0%, 12%)' },
      arrowHeadType: 'arrowclosed' as Edge['arrowHeadType'],
      style: { stroke: 'hsl(0, 0%, 30%)' }
    }))

    return [...nodes, ...edges]
  }, [map])

  const sceneCount = map?.nodes.length ?? 0,
    jumpCount =
      map?.edges.reduce((total, { jumpIds }) => total + jumpIds.length, 0) ?? 0,
    unreachableCount = map?.nodes.filter(({ hasNoWayIn }) => hasNoWayIn).length ?? 0

  return (
    <div className={styles.StoryworldMap}>
      <div className={styles.canvas}>
        {elements && elements.length > 0 && (
          <ReactFlow
            key={`${sceneCount}-${jumpCount}`}
            elements={elements}
            nodeTypes={{ sceneNode: SceneNode }}
            // in react-flow-renderer 9 this permanently drops nodes that have
            // never rendered, which is a correctness bug rather than a saving —
            // see CLAUDE.md
            onlyRenderVisibleElements={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.1}
            // react-flow-renderer 9 has no `fitView` prop; the whole point of
            // the map is seeing the storyworld at once, so it fits on load
            onLoad={(instance) => instance.fitView({ padding: 0.15 })}
            onElementClick={(_, element) =>
              // an edge has no scene of its own to open
              map?.nodes.some(({ id }) => id === element.id) &&
              onSelectScene(element.id)
            }
          >
            <Background size={1} color="hsl(0, 0%, 10%)" />
            <Controls showInteractive={false} className={styles.controls} />
            <MiniMap
              className={styles.miniMap}
              maskColor="hsla(0, 0%, 0%, 0.6)"
              nodeColor={(node) =>
                node.data?.hasNoWayIn
                  ? 'var(--warning-color)'
                  : node.data?.isStart
                  ? 'var(--highlight-color)'
                  : 'hsl(0, 0%, 35%)'
              }
            />
          </ReactFlow>
        )}

        {elements && elements.length === 0 && (
          <div className={styles.empty}>
            This storyworld has no scenes yet. Add one in the outline and it
            appears here.
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span>
          {sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'}
        </span>
        <span>
          {jumpCount} {jumpCount === 1 ? 'jump' : 'jumps'} between scenes
        </span>
        {unreachableCount > 0 && (
          <span className={styles.unreachable}>
            {unreachableCount} with no way in
          </span>
        )}
        <span className={styles.hint}>Click a scene to open it</span>
      </div>
    </div>
  )
}

StoryworldMap.displayName = 'StoryworldMap'

export default StoryworldMap
