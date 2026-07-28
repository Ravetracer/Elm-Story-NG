/**
 * Element vocabulary as it appeared in exported storyworld JSON before 0.6.0.
 *
 * 0.6.0 renamed GAME to WORLD, PASSAGE to EVENT and ROUTE to PATH. The schemas
 * for 0.1.3 through 0.4.0 originally imported ELEMENT_TYPE and the reference
 * tuples from `data/types`, which describes the *current* model, so after that
 * rename they claimed those files contain "WORLD" and "EVENT". They do not: a
 * 0.2.0 export really does contain "GAME" and "PASSAGE", and `upgrade/0.6.0.ts`
 * relies on exactly that when it maps `folder.parent[0] === 'GAME'` across the
 * boundary.
 *
 * 0.5.0 and 0.5.1 already carried a correct local copy of this enum. Declaring
 * it once here lets the schemas either side of the 0.4.0 to 0.5.0 upgrade share
 * a single enum, which is what makes that upgrade's conversions legal — two
 * separately declared string enums are not assignable to one another in
 * TypeScript even when their members have identical values.
 *
 * These are frozen descriptions of data already on disk. Nothing here should
 * change unless it was wrong about a file some user still has.
 */
import { ElementId } from '../../../data/types'

export enum COMPONENT_TYPE {
  STUDIO = 'STUDIO',
  GAME = 'GAME',
  JUMP = 'JUMP',
  FOLDER = 'FOLDER',
  SCENE = 'SCENE',
  ROUTE = 'ROUTE',
  PASSAGE = 'PASSAGE',
  CHOICE = 'CHOICE',
  INPUT = 'INPUT',
  CONDITION = 'CONDITION',
  EFFECT = 'EFFECT',
  VARIABLE = 'VARIABLE'
}

/**
 * JUMP was only added to this enum after 0.5.1, so a passage in a file of this
 * vintage is only ever a CHOICE or an INPUT.
 */
export enum EVENT_TYPE {
  CHOICE = 'CHOICE',
  INPUT = 'INPUT'
}

export type GameChildRefs = Array<
  [COMPONENT_TYPE.FOLDER | COMPONENT_TYPE.SCENE, ElementId]
>

export type FolderParentRef = [
  COMPONENT_TYPE.GAME | COMPONENT_TYPE.FOLDER,
  ElementId | null
]

export type FolderChildRefs = Array<
  [COMPONENT_TYPE.FOLDER | COMPONENT_TYPE.SCENE, ElementId]
>

export type SceneParentRef = [
  COMPONENT_TYPE.GAME | COMPONENT_TYPE.FOLDER,
  ElementId | null
]

export type SceneChildRefs = Array<[COMPONENT_TYPE.PASSAGE, ElementId]>
