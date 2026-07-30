import { describe, expect, it } from 'vitest'

import {
  LayoutEdge,
  LayoutNode,
  layoutSceneMap,
  NODE_SEPARATION,
  RANK_SEPARATION,
  sceneMapLayoutOrigin
} from '../lib/sceneMapLayout'

/**
 * The scene map's automatic placement.
 *
 * Geometry is what these cover, because a layout that is subtly wrong still
 * draws plausibly: nodes that overlap by ten pixels, a graph anchored a thousand
 * pixels from where the author was looking, or a second run that shuffles a
 * scene it should have left alone all look like "the layout" rather than like
 * bugs. The numbers are the only place they show.
 */

const node = (id: string, width = 200, height = 69): LayoutNode => ({
  id,
  width,
  height
})

const edge = (source: string, target: string): LayoutEdge => ({
  source,
  target
})

describe('layoutSceneMap', () => {
  it('places nothing when there is nothing to place', () => {
    expect(layoutSceneMap([], []).size).toBe(0)
  })

  it('gives every node a position', () => {
    const positions = layoutSceneMap(
      [node('a'), node('b'), node('c')],
      [edge('a', 'b'), edge('b', 'c')]
    )

    expect([...positions.keys()].sort()).toEqual(['a', 'b', 'c'])
  })

  it('ranks a chain left to right, in path order', () => {
    const positions = layoutSceneMap(
      [node('a'), node('b'), node('c')],
      [edge('a', 'b'), edge('b', 'c')]
    )

    const x = (id: string) => positions.get(id)!.x

    expect(x('a')).toBeLessThan(x('b'))
    expect(x('b')).toBeLessThan(x('c'))
  })

  it('separates ranks by at least the rank separation', () => {
    const positions = layoutSceneMap(
      [node('a'), node('b')],
      [edge('a', 'b')]
    )

    // 'a' is 200 wide, so its right edge is at x + 200
    expect(positions.get('b')!.x - (positions.get('a')!.x + 200)).toBe(
      RANK_SEPARATION
    )
  })

  it('puts siblings in one column without overlapping them', () => {
    const positions = layoutSceneMap(
      [node('a'), node('b'), node('c')],
      [edge('a', 'b'), edge('a', 'c')]
    )

    // both targets share a rank, so they share an x and differ in y
    expect(positions.get('b')!.x).toBe(positions.get('c')!.x)

    const [upper, lower] = [positions.get('b')!, positions.get('c')!].sort(
      (first, second) => first.y - second.y
    )

    expect(lower.y - (upper.y + 69)).toBeGreaterThanOrEqual(NODE_SEPARATION)
  })

  it('measures each node rather than assuming one size', () => {
    // an event node's height grows with its choices; a jump is taller again
    const positions = layoutSceneMap(
      [node('a', 200, 400), node('b', 200, 69)],
      [edge('a', 'b')]
    )

    // dagre centres a rank's nodes on each other, so the short node sits
    // opposite the middle of the tall one rather than level with its top.
    // Rounded, since half of an odd height lands on a half pixel.
    expect(positions.get('b')!.y).toBe(
      Math.round(positions.get('a')!.y + 400 / 2 - 69 / 2)
    )
  })

  it('anchors the result at the origin it is given', () => {
    const origin = { x: 1200, y: -800 }

    const positions = layoutSceneMap(
      [node('a'), node('b')],
      [edge('a', 'b')],
      origin
    )

    const all = [...positions.values()]

    expect(Math.min(...all.map(({ x }) => x))).toBe(origin.x)
    expect(Math.min(...all.map(({ y }) => y))).toBe(origin.y)
  })

  it('lays a scene out identically however the input is ordered', () => {
    const nodes = [node('c'), node('a'), node('b')],
      edges = [edge('b', 'c'), edge('a', 'b')]

    const first = layoutSceneMap(nodes, edges),
      second = layoutSceneMap([...nodes].reverse(), [...edges].reverse())

    expect([...second.entries()].sort()).toEqual([...first.entries()].sort())
  })

  it('ignores a choice that loops back to its own event', () => {
    const withLoop = layoutSceneMap(
        [node('a'), node('b')],
        [edge('a', 'b'), edge('a', 'a')]
      ),
      withoutLoop = layoutSceneMap([node('a'), node('b')], [edge('a', 'b')])

    expect([...withLoop.entries()]).toEqual([...withoutLoop.entries()])
  })

  it('collapses several choices leading to the same event', () => {
    const twice = layoutSceneMap(
        [node('a'), node('b')],
        [edge('a', 'b'), edge('a', 'b')]
      ),
      once = layoutSceneMap([node('a'), node('b')], [edge('a', 'b')])

    expect([...twice.entries()]).toEqual([...once.entries()])
  })

  it('ignores an edge naming a node it was not given', () => {
    const positions = layoutSceneMap(
      [node('a'), node('b')],
      [edge('a', 'b'), edge('b', 'elsewhere')]
    )

    expect([...positions.keys()].sort()).toEqual(['a', 'b'])
  })

  it('still places a node nothing connects to', () => {
    const positions = layoutSceneMap(
      [node('a'), node('b'), node('orphan')],
      [edge('a', 'b')]
    )

    expect(positions.get('orphan')).toBeDefined()
  })

  it('rounds, because these positions are persisted and exported', () => {
    const positions = layoutSceneMap(
      [node('a', 201, 69), node('b', 200, 70)],
      [edge('a', 'b')]
    )

    positions.forEach(({ x, y }) => {
      expect(Number.isInteger(x)).toBe(true)
      expect(Number.isInteger(y)).toBe(true)
    })
  })

  it('never overlaps two nodes', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
        node(id, 200, id === 'c' ? 300 : 69)
      ),
      edges = [
        edge('a', 'b'),
        edge('a', 'c'),
        edge('b', 'd'),
        edge('c', 'd'),
        edge('d', 'e'),
        edge('a', 'f')
      ]

    const positions = layoutSceneMap(nodes, edges)

    const boxes = nodes.map(({ id, width, height }) => {
      const { x, y } = positions.get(id)!

      return { id, left: x, right: x + width, top: y, bottom: y + height }
    })

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j]

        const overlaps =
          a.left < b.right &&
          b.left < a.right &&
          a.top < b.bottom &&
          b.top < a.bottom

        expect(
          overlaps,
          `${a.id} overlaps ${b.id}: ${JSON.stringify([a, b])}`
        ).toBe(false)
      }
    }
  })
})

describe('sceneMapLayoutOrigin', () => {
  it('is the top-left corner of what is already on the map', () => {
    expect(
      sceneMapLayoutOrigin([
        { x: 400, y: 120 },
        { x: 100, y: 900 },
        { x: 250, y: 40 }
      ])
    ).toEqual({ x: 100, y: 40 })
  })

  it('falls back to the world origin when the scene is empty', () => {
    expect(sceneMapLayoutOrigin([])).toEqual({ x: 0, y: 0 })
  })
})
