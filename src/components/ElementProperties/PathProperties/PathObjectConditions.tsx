import React, { useMemo } from 'react'
import { v4 as uuid } from 'uuid'

import {
  COMPARE_OPERATOR_TYPE,
  ElementId,
  ObjectCondition,
  OBJECT_LOCATION_TYPE,
  StudioId,
  WorldId
} from '../../../data/types'

import {
  useObjectConditionsByPathRef,
  useObjects,
  useScenes
} from '../../../hooks'

import { Button, InputNumber, Select } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

import api from '../../../api'

import styles from './styles.module.less'

/**
 * Gates a path on what the player is carrying, or on what a scene contains.
 *
 * A block of its own beside Conditions and Effects, because an object condition is
 * a row in `objectConditions` rather than in `conditions` — see `DESIGN.md` for why
 * they are not one table. The path's existing **Match All / Any** toggle governs
 * both kinds together: `isPathOpen` puts them in one aggregate, so ALL means every
 * variable *and* object condition.
 *
 * The count comparison is what makes "has at least five coins" expressible;
 * `>= 1` is the ordinary "is carrying it" and `= 0` is its absence.
 */

const OPERATORS = [
  { value: COMPARE_OPERATOR_TYPE.GTE, label: '>=' },
  { value: COMPARE_OPERATOR_TYPE.GT, label: '>' },
  { value: COMPARE_OPERATOR_TYPE.EQ, label: '=' },
  { value: COMPARE_OPERATOR_TYPE.NE, label: '!=' },
  { value: COMPARE_OPERATOR_TYPE.LTE, label: '<=' },
  { value: COMPARE_OPERATOR_TYPE.LT, label: '<' }
]

const LOCATIONS = [
  { value: OBJECT_LOCATION_TYPE.INVENTORY, label: 'player holds' },
  {
    value: OBJECT_LOCATION_TYPE.CURRENT_SCENE,
    label: 'current scene contains'
  },
  { value: OBJECT_LOCATION_TYPE.SCENE, label: 'scene contains' }
]

const PathObjectConditions: React.FC<{
  studioId: StudioId
  worldId: WorldId
  pathId: ElementId
}> = ({ studioId, worldId, pathId }) => {
  const objects = useObjects(studioId, worldId, [worldId]),
    scenes = useScenes(studioId, worldId, [worldId]),
    conditions = useObjectConditionsByPathRef(studioId, pathId, [
      studioId,
      pathId
    ])

  const objectOptions = useMemo(
    () =>
      (objects ?? []).map((object) => ({
        value: object.id as ElementId,
        label: object.title
      })),
    [objects]
  )

  const sceneOptions = useMemo(
    () =>
      (scenes ?? []).map((scene) => ({
        value: scene.id as ElementId,
        label: scene.title
      })),
    [scenes]
  )

  const save = async (condition: ObjectCondition) =>
    await api().objectConditions.saveObjectCondition(studioId, condition)

  const add = async () => {
    const objectId = objectOptions[0]?.value

    if (!objectId) return

    await save({
      id: uuid(),
      title: '',
      tags: [],
      pathId,
      worldId,
      objectId,
      location: OBJECT_LOCATION_TYPE.INVENTORY,
      compare: [COMPARE_OPERATOR_TYPE.GTE, 1]
    })
  }

  return (
    <div className={styles.routeFeature}>
      <div className={styles.featureHeader}>Object Conditions</div>

      <div className={styles.featureList}>
        {objectOptions.length === 0 && (
          <div className={styles.noVariables}>
            To gate a path on an object, create at least 1 object.
          </div>
        )}

        {/*
          A button rather than the "Define New ..." Select the variable conditions
          above use. That Select exists there because it picks *which* variable;
          there is nothing to pick here, and a single-option Select is both a
          confusing affordance and one that did not commit — rc-select fires no
          change when the only option is chosen from a controlled placeholder value.
        */}
        {objectOptions.length > 0 && (
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={add}
          >
            Add Object Condition
          </Button>
        )}

        {conditions?.map((condition) => {
          const update = (changes: Partial<ObjectCondition>) =>
            save({ ...condition, ...changes })

          return (
            <div key={condition.id} className={styles.objectConditionRow}>
              <Select
                size="small"
                value={condition.location}
                options={LOCATIONS}
                onChange={(location) =>
                  update({
                    location,
                    sceneId:
                      location === OBJECT_LOCATION_TYPE.SCENE
                        ? condition.sceneId ?? sceneOptions[0]?.value
                        : undefined
                  })
                }
              />

              {condition.location === OBJECT_LOCATION_TYPE.SCENE && (
                <Select
                  size="small"
                  value={condition.sceneId}
                  options={sceneOptions}
                  onChange={(sceneId) => update({ sceneId })}
                />
              )}

              <Select
                size="small"
                value={condition.objectId}
                options={objectOptions}
                onChange={(objectId) => update({ objectId })}
              />

              <Select
                size="small"
                value={condition.compare[0]}
                options={OPERATORS}
                onChange={(operator) =>
                  update({ compare: [operator, condition.compare[1]] })
                }
              />

              <InputNumber
                size="small"
                min={0}
                value={condition.compare[1]}
                onChange={(count) =>
                  update({
                    compare: [condition.compare[0], Number(count) || 0]
                  })
                }
              />

              <Button
                type="link"
                size="small"
                icon={<DeleteOutlined />}
                onClick={() =>
                  api().objectConditions.removeObjectCondition(
                    studioId,
                    condition.id as ElementId
                  )
                }
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

PathObjectConditions.displayName = 'PathObjectConditions'

export default PathObjectConditions
