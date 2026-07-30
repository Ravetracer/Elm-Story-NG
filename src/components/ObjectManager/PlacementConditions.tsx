import React, { useMemo } from 'react'

import {
  COMPARE_OPERATOR_TYPE,
  ElementId,
  ObjectCompare,
  ObjectPlacement,
  OBJECT_LOCATION_TYPE,
  PATH_CONDITIONS_TYPE,
  Scene,
  VariableCompare,
  VARIABLE_TYPE,
  Variable,
  WorldObject
} from '../../data/types'

import { Alert, Button, InputNumber, Input, Select } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

import styles from './styles.module.less'

/**
 * What has to be true for a placement to be there at all.
 *
 * This is the editor for the mechanism that **replaces recursive containers**: the
 * battery in the locked drawer is not inside anything, it is a placement gated on
 * the current scene containing an unlocked drawer. Until then it is not in the
 * world, rather than visible and refused.
 *
 * Two things about gates that this UI has to keep the author on the right side of,
 * both of which are silent failures otherwise:
 *
 * - **A gate should be monotonic.** One that turns true, then false, then true
 *   again hands the player a second copy of something they already took, because
 *   the count is derived from the placement plus a signed delta. Nothing enforces
 *   it; the hint says so.
 * - **An unevaluable comparison fails closed**, unlike a path condition, which
 *   fails open. So an operator the engine has no opinion about does not merely do
 *   nothing here — it hides the object permanently. That is why the operator list
 *   is restricted by variable type rather than offering all six and letting the
 *   engine ignore four of them.
 */

const ALL_OPERATORS = [
  { value: COMPARE_OPERATOR_TYPE.EQ, label: '=' },
  { value: COMPARE_OPERATOR_TYPE.NE, label: '!=' },
  { value: COMPARE_OPERATOR_TYPE.GT, label: '>' },
  { value: COMPARE_OPERATOR_TYPE.GTE, label: '>=' },
  { value: COMPARE_OPERATOR_TYPE.LT, label: '<' },
  { value: COMPARE_OPERATOR_TYPE.LTE, label: '<=' }
]

/**
 * Only equality is meaningful for anything but a NUMBER — `variableCompareHolds`
 * returns "no opinion" for an ordering operator on a string, and a placement gate
 * reads that as false. Offering `>` on a BOOLEAN would be offering a way to make an
 * object disappear for good.
 */
const operatorsFor = (type?: VARIABLE_TYPE) =>
  type === VARIABLE_TYPE.NUMBER
    ? ALL_OPERATORS
    : ALL_OPERATORS.filter(
        ({ value }) =>
          value === COMPARE_OPERATOR_TYPE.EQ ||
          value === COMPARE_OPERATOR_TYPE.NE
      )

const LOCATIONS = [
  {
    value: OBJECT_LOCATION_TYPE.CURRENT_SCENE,
    label: 'the current scene contains'
  },
  { value: OBJECT_LOCATION_TYPE.INVENTORY, label: 'the player holds' },
  { value: OBJECT_LOCATION_TYPE.SCENE, label: 'a named scene contains' }
]

const PlacementConditions: React.FC<{
  placement: ObjectPlacement
  objects: WorldObject[]
  /** the object being edited, so it is not offered as a gate on itself */
  ownerId?: ElementId
  scenes: Scene[]
  variables: Variable[]
  onChange: (placement: ObjectPlacement) => void
}> = ({ placement, objects, ownerId, scenes, variables, onChange }) => {
  const variableConditions = placement.variableConditions ?? [],
    objectConditions = placement.objectConditions ?? []

  const total = variableConditions.length + objectConditions.length

  const variableOptions = useMemo(
    () =>
      variables.map((variable) => ({
        value: variable.id as ElementId,
        label: variable.title
      })),
    [variables]
  )

  /*
   * An object gating its own placement is always a cycle, and a cycle resolves to
   * absent — so the object would simply never appear. Excluded rather than
   * explained.
   */
  const objectOptions = useMemo(
    () =>
      objects
        .filter((object) => object.id !== ownerId)
        .map((object) => ({
          value: object.id as ElementId,
          label: object.title
        })),
    [objects, ownerId]
  )

  const sceneOptions = useMemo(
    () =>
      scenes.map((scene) => ({
        value: scene.id as ElementId,
        label: scene.title
      })),
    [scenes]
  )

  const setVariableConditions = (next: VariableCompare[]) =>
    onChange({
      ...placement,
      variableConditions: next.length > 0 ? next : undefined
    })

  const setObjectConditions = (next: ObjectCompare[]) =>
    onChange({
      ...placement,
      objectConditions: next.length > 0 ? next : undefined
    })

  return (
    <div className={styles.conditions}>
      <div className={styles.conditionsHeader}>
        <span className={styles.fieldHint}>
          {total === 0
            ? 'Always here.'
            : `Here only when ${
                (placement.conditionsType ?? PATH_CONDITIONS_TYPE.ALL) ===
                PATH_CONDITIONS_TYPE.ALL
                  ? 'all'
                  : 'any'
              } of these hold:`}
        </span>

        {total > 1 && (
          <Select
            size="small"
            value={placement.conditionsType ?? PATH_CONDITIONS_TYPE.ALL}
            options={[
              { value: PATH_CONDITIONS_TYPE.ALL, label: 'all' },
              { value: PATH_CONDITIONS_TYPE.ANY, label: 'any' }
            ]}
            onChange={(conditionsType) =>
              onChange({ ...placement, conditionsType })
            }
          />
        )}
      </div>

      {objectConditions.map((condition, index) => {
        const update = (changes: Partial<ObjectCompare>) => {
          const next = [...objectConditions]

          next[index] = { ...condition, ...changes }

          setObjectConditions(next)
        }

        return (
          <div key={index} className={styles.conditionRow}>
            <Select
              size="small"
              value={condition.location}
              options={LOCATIONS}
              className={styles.conditionWide}
              onChange={(location) =>
                update({
                  location,
                  // a named scene needs one named; dropped again when it is not
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
                className={styles.conditionWide}
                onChange={(sceneId) => update({ sceneId })}
              />
            )}

            <Select
              size="small"
              value={condition.objectId}
              options={objectOptions}
              className={styles.conditionWide}
              onChange={(objectId) => update({ objectId })}
            />

            <Select
              size="small"
              value={condition.compare[0]}
              options={ALL_OPERATORS}
              onChange={(operator) =>
                update({ compare: [operator, condition.compare[1]] })
              }
            />

            <InputNumber
              size="small"
              min={0}
              value={condition.compare[1]}
              onChange={(count) =>
                update({ compare: [condition.compare[0], Number(count) || 0] })
              }
            />

            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() =>
                setObjectConditions(
                  objectConditions.filter((_, other) => other !== index)
                )
              }
            />
          </div>
        )
      })}

      {variableConditions.map((condition, index) => {
        const type = variables.find(({ id }) => id === condition[0])?.type

        const update = (next: VariableCompare) => {
          const all = [...variableConditions]

          all[index] = next

          setVariableConditions(all)
        }

        return (
          <div key={index} className={styles.conditionRow}>
            <span className={styles.conditionLabel}>the variable</span>

            <Select
              size="small"
              value={condition[0]}
              options={variableOptions}
              className={styles.conditionWide}
              onChange={(variableId) => {
                const nextType =
                  variables.find(({ id }) => id === variableId)?.type ??
                  condition[3]

                // an operator that is not offered for the new type would fail
                // closed, so it is reset rather than carried across
                const operator = operatorsFor(nextType).some(
                  ({ value }) => value === condition[1]
                )
                  ? condition[1]
                  : COMPARE_OPERATOR_TYPE.EQ

                update([variableId, operator, condition[2], nextType])
              }}
            />

            <Select
              size="small"
              value={condition[1]}
              options={operatorsFor(type)}
              onChange={(operator) =>
                update([condition[0], operator, condition[2], condition[3]])
              }
            />

            <Input
              size="small"
              value={condition[2]}
              className={styles.conditionWide}
              onChange={(event) =>
                update([
                  condition[0],
                  condition[1],
                  event.target.value,
                  condition[3]
                ])
              }
            />

            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() =>
                setVariableConditions(
                  variableConditions.filter((_, other) => other !== index)
                )
              }
            />
          </div>
        )
      })}

      <div className={styles.conditionRow}>
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          disabled={objectOptions.length === 0}
          onClick={() =>
            setObjectConditions([
              ...objectConditions,
              {
                objectId: objectOptions[0].value,
                location: OBJECT_LOCATION_TYPE.CURRENT_SCENE,
                compare: [COMPARE_OPERATOR_TYPE.GTE, 1]
              }
            ])
          }
        >
          Object condition
        </Button>

        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          disabled={variableOptions.length === 0}
          onClick={() => {
            const variable = variables[0]

            if (!variable?.id) return

            setVariableConditions([
              ...variableConditions,
              [
                variable.id,
                COMPARE_OPERATOR_TYPE.EQ,
                '',
                variable.type
              ] as VariableCompare
            ])
          }}
        >
          Variable condition
        </Button>
      </div>

      {total > 0 && (
        <Alert
          type="info"
          showIcon
          className={styles.alert}
          message="Gates should only ever become true."
          description="A count is the placement plus what the player has taken, so a gate that becomes true, then false, then true again puts the object back after they picked it up."
        />
      )}
    </div>
  )
}

PlacementConditions.displayName = 'PlacementConditions'

export default PlacementConditions
