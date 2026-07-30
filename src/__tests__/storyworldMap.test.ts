import { describe, expect, it } from 'vitest'

import {
  ElementId,
  ELEMENT_TYPE,
  Folder,
  Jump,
  Scene
} from '../data/types'

import {
  buildStoryworldMap,
  folderPathForScene
} from '../lib/storyworldMap'

/**
 * The storyworld graph is inferred rather than stored: a jump's origin is
 * wherever it happens to sit and its destination is the first element of its
 * path. These cover the inference, because a map that is missing a connection
 * looks exactly as authoritative as one that is not.
 */

const WORLD_ID = 'world-1'

const scene = (
  id: ElementId,
  title: string,
  parent: Scene['parent'] = [ELEMENT_TYPE.WORLD, null],
  children: Scene['children'] = []
): Scene => ({
  id,
  title,
  tags: [],
  worldId: WORLD_ID,
  parent,
  children
})

const folder = (
  id: ElementId,
  title: string,
  parent: Folder['parent'] = [ELEMENT_TYPE.WORLD, null]
): Folder => ({
  id,
  title,
  tags: [],
  worldId: WORLD_ID,
  parent,
  children: []
})

const jump = (
  id: ElementId,
  sceneId: ElementId | undefined,
  target: ElementId | undefined
): Jump => ({
  id,
  title: `jump ${id}`,
  tags: [],
  worldId: WORLD_ID,
  sceneId,
  path: [target]
})

const base = {
  scenes: [scene('a', 'A'), scene('b', 'B')],
  jumps: [],
  folders: []
}

describe('buildStoryworldMap', () => {
  it('is empty for a storyworld with no scenes', () => {
    expect(buildStoryworldMap({ scenes: [], jumps: [], folders: [] })).toEqual({
      nodes: [],
      edges: []
    })
  })

  it('gives every scene a node, jumps or no jumps', () => {
    const { nodes } = buildStoryworldMap(base)

    expect(nodes.map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('draws an edge from the scene a jump sits in to the scene it points at', () => {
    const { edges } = buildStoryworldMap({
      ...base,
      jumps: [jump('j1', 'a', 'b')]
    })

    expect(edges).toEqual([
      { id: 'a->b', source: 'a', target: 'b', jumpIds: ['j1'] }
    ])
  })

  it('collapses several jumps leading the same way into one edge', () => {
    const { edges } = buildStoryworldMap({
      ...base,
      jumps: [jump('j1', 'a', 'b'), jump('j2', 'a', 'b')]
    })

    expect(edges).toHaveLength(1)
    expect(edges[0].jumpIds).toEqual(['j1', 'j2'])
  })

  it('keeps the two directions between a pair of scenes apart', () => {
    const { edges } = buildStoryworldMap({
      ...base,
      jumps: [jump('j1', 'a', 'b'), jump('j2', 'b', 'a')]
    })

    expect(edges.map(({ id }) => id).sort()).toEqual(['a->b', 'b->a'])
  })

  it('counts a jump leading back into its own scene rather than drawing it', () => {
    const { nodes, edges } = buildStoryworldMap({
      ...base,
      jumps: [jump('j1', 'a', 'a')]
    })

    expect(edges).toEqual([])
    expect(nodes.find(({ id }) => id === 'a')!.selfJumps).toBe(1)
  })

  it('leaves out a jump pointing at a scene that is gone', () => {
    const { edges } = buildStoryworldMap({
      ...base,
      jumps: [jump('j1', 'a', 'deleted-scene')]
    })

    expect(edges).toEqual([])
  })

  it('leaves out a jump with no destination set', () => {
    const { edges } = buildStoryworldMap({
      ...base,
      jumps: [jump('j1', 'a', undefined)]
    })

    expect(edges).toEqual([])
  })

  it('marks the scene the storyworld opens on', () => {
    const { nodes } = buildStoryworldMap({
      ...base,
      jumps: [jump('opening', undefined, 'b')],
      openingJumpId: 'opening'
    })

    expect(nodes.find(({ id }) => id === 'b')!.isStart).toBe(true)
    expect(nodes.find(({ id }) => id === 'a')!.isStart).toBe(false)
  })

  it('draws no edge for the opening jump, which sits in no scene', () => {
    const { edges } = buildStoryworldMap({
      ...base,
      jumps: [jump('opening', undefined, 'b')],
      openingJumpId: 'opening'
    })

    expect(edges).toEqual([])
  })

  it('reports a scene nothing jumps to', () => {
    const { nodes } = buildStoryworldMap({
      ...base,
      jumps: [jump('j1', 'a', 'b')]
    })

    const byId = new Map(nodes.map((node) => [node.id, node]))

    expect(byId.get('b')!.hasNoWayIn).toBe(false)
    // nothing leads to 'a' and the storyworld does not open there
    expect(byId.get('a')!.hasNoWayIn).toBe(true)
  })

  it('does not call the opening scene unreachable', () => {
    const { nodes } = buildStoryworldMap({
      ...base,
      jumps: [jump('opening', undefined, 'a')],
      openingJumpId: 'opening'
    })

    expect(nodes.find(({ id }) => id === 'a')!.hasNoWayIn).toBe(false)
  })

  it('counts a scene reached only by a jump that sits outside any scene', () => {
    const { nodes } = buildStoryworldMap({
      ...base,
      jumps: [jump('loose', undefined, 'b')]
    })

    expect(nodes.find(({ id }) => id === 'b')!.hasNoWayIn).toBe(false)
  })

  it('reports how much each scene holds', () => {
    const { nodes } = buildStoryworldMap({
      ...base,
      scenes: [
        scene('a', 'A', [ELEMENT_TYPE.WORLD, null], [
          [ELEMENT_TYPE.EVENT, 'e1'],
          [ELEMENT_TYPE.JUMP, 'j1']
        ])
      ]
    })

    expect(nodes[0].childCount).toBe(2)
  })

  it('builds the same map however the jumps arrive', () => {
    const jumps = [jump('j2', 'b', 'a'), jump('j1', 'a', 'b')]

    const first = buildStoryworldMap({ ...base, jumps }),
      second = buildStoryworldMap({ ...base, jumps: [...jumps].reverse() })

    expect(second).toEqual(first)
  })
})

describe('folderPathForScene', () => {
  it('is empty for a scene at the world root', () => {
    expect(folderPathForScene(scene('a', 'A'), [])).toEqual([])
  })

  it('names the folders above a scene, outermost first', () => {
    const outer = folder('f1', 'Act One'),
      inner = folder('f2', 'Morning', [ELEMENT_TYPE.FOLDER, 'f1'])

    expect(
      folderPathForScene(
        scene('a', 'A', [ELEMENT_TYPE.FOLDER, 'f2']),
        [inner, outer]
      )
    ).toEqual(['Act One', 'Morning'])
  })

  it('stops rather than hanging when folders point at each other', () => {
    const first = folder('f1', 'One', [ELEMENT_TYPE.FOLDER, 'f2']),
      second = folder('f2', 'Two', [ELEMENT_TYPE.FOLDER, 'f1'])

    const path = folderPathForScene(
      scene('a', 'A', [ELEMENT_TYPE.FOLDER, 'f1']),
      [first, second]
    )

    expect(path.length).toBeLessThanOrEqual(3)
  })

  it('stops at a folder that is gone', () => {
    expect(
      folderPathForScene(scene('a', 'A', [ELEMENT_TYPE.FOLDER, 'missing']), [])
    ).toEqual([])
  })
})
