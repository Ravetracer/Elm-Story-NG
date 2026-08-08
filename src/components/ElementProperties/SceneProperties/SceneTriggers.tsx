import { v4 as uuid } from 'uuid'

import React, { useCallback, useState } from 'react'

import {
  COMPARE_OPERATOR_TYPE,
  ElementId,
  Scene,
  StudioId,
  TriggerData,
  Variable,
  VariableCompare,
  VARIABLE_TYPE,
  WorldId
} from '../../../data/types'
import { ASSET_KIND } from '../../../lib/assets'

import { useVariables } from '../../../hooks'

import { Button, Checkbox, Select } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

import { VariableRow, VARIABLE_ROW_TYPE } from '../../WorldVariables'
import { AssetsModal } from '../../Modal'
import { HelpButton } from '../../ElementHelp'

import api from '../../../api'

import parentStyles from '../styles.module.less'
import variableStyles from '../../WorldVariables/styles.module.less'
import styles from './styles.module.less'

/**
 * Normalizes an edited condition value the same way path conditions do
 * (`PathProperties`' `RouteConditionRow`): a NUMBER that is not a number is
 * rejected (the field resets), an empty NUMBER stores `'0'`, a STRING stores its
 * text. Kept in step with that copy so a trigger condition and a path condition
 * behave identically in the same `VariableRow`.
 */
const normalizeConditionValue = (
  newValue: string,
  variableType: VARIABLE_TYPE,
  reset?: () => void
): string | undefined => {
  switch (variableType) {
    case VARIABLE_TYPE.NUMBER:
      if (newValue !== '-' && isNaN(newValue as any)) {
        reset?.()
        return undefined
      }

      return `${newValue ? (newValue === '-' ? 0 : newValue) : '0'}`
    case VARIABLE_TYPE.STRING:
      return newValue ? `${newValue}` : ''
    default:
      return newValue
  }
}

const TriggerConditionRow: React.FC<{
  studioId: StudioId
  compare: VariableCompare
  onChangeOperator: (operator: COMPARE_OPERATOR_TYPE) => void
  onChangeValue: (value: string) => void
  onDelete: () => void
}> = ({ studioId, compare, onChangeOperator, onChangeValue, onDelete }) => (
  <VariableRow
    studioId={studioId}
    variableId={compare[0]}
    rowType={VARIABLE_ROW_TYPE.CONDITION}
    allowRename={false}
    allowTypeChange={false}
    compareOperatorType={compare[1]}
    value={compare[2] || undefined}
    onCompareOperatorTypeChange={onChangeOperator}
    onChangeValue={(newValue, variableType, reset) => {
      const valueToSet = normalizeConditionValue(newValue, variableType, reset)

      if (valueToSet !== undefined) onChangeValue(valueToSet)
    }}
    onDelete={onDelete}
  />
)

const TriggerCard: React.FC<{
  studioId: StudioId
  worldId: WorldId
  subject: string
  variables: Variable[]
  trigger: TriggerData
  // Applies a change to *this* trigger, re-read fresh from the database inside
  // the save, so a debounced value edit cannot clobber a concurrent operator or
  // fire-on-entry change on the same trigger (the savePathNotification guard).
  mutate: (next: (trigger: TriggerData) => TriggerData) => void
  onDelete: () => void
}> = ({ studioId, worldId, subject, variables, trigger, mutate, onDelete }) => {
  const [pickerVisible, setPickerVisible] = useState(false)

  const usedVariableIds = trigger.compare.map((compare) => compare[0])

  const availableVariables = variables.filter(
    (variable) => variable.id && !usedVariableIds.includes(variable.id)
  )

  const addCondition = (variableId: ElementId) => {
    const variable = variables.find((candidate) => candidate.id === variableId)

    if (!variable?.id) return

    const compare: VariableCompare = [
      variable.id,
      COMPARE_OPERATOR_TYPE.EQ,
      variable.initialValue,
      variable.type
    ]

    mutate((current) => ({
      ...current,
      compare: [...current.compare, compare]
    }))
  }

  const updateCondition = (
    variableId: ElementId,
    next: (compare: VariableCompare) => VariableCompare
  ) =>
    mutate((current) => ({
      ...current,
      compare: current.compare.map((compare) =>
        compare[0] === variableId ? next(compare) : compare
      )
    }))

  const removeCondition = (variableId: ElementId) =>
    mutate((current) => ({
      ...current,
      compare: current.compare.filter((compare) => compare[0] !== variableId)
    }))

  return (
    <div className={styles.triggerCard}>
      {pickerVisible && (
        <AssetsModal
          studioId={studioId}
          worldId={worldId}
          subject={subject}
          visible
          selectKind={ASSET_KIND.AUDIO}
          selectedAssetId={trigger.sound || undefined}
          onSelect={(assetId) => {
            mutate((current) => ({ ...current, sound: assetId }))
            setPickerVisible(false)
          }}
          onCancel={() => setPickerVisible(false)}
        />
      )}

      <div className={styles.triggerConditions}>
        <div className={styles.triggerSubHeader}>When (all must match)</div>

        {trigger.compare.length > 0 && (
          <div className={variableStyles.variableRows}>
            {trigger.compare.map((compare) => (
              <TriggerConditionRow
                key={compare[0]}
                studioId={studioId}
                compare={compare}
                onChangeOperator={(operator) =>
                  updateCondition(compare[0], (current) => [
                    current[0],
                    operator,
                    current[2],
                    current[3]
                  ])
                }
                onChangeValue={(value) =>
                  updateCondition(compare[0], (current) => [
                    current[0],
                    current[1],
                    value,
                    current[3]
                  ])
                }
                onDelete={() => removeCondition(compare[0])}
              />
            ))}
          </div>
        )}

        {availableVariables.length > 0 ? (
          <Select
            className={styles.addConditionSelect}
            value="Add condition..."
            onChange={addCondition}
          >
            {availableVariables.map((variable) => (
              <Select.Option value={variable.id} key={variable.id}>
                {variable.title}
              </Select.Option>
            ))}
          </Select>
        ) : (
          variables.length === 0 && (
            <div className={styles.triggerHint}>
              Define at least one variable to build a trigger.
            </div>
          )
        )}
      </div>

      <div className={styles.triggerSound}>
        <div className={styles.triggerSubHeader}>Play</div>

        <div className={styles.triggerSoundActions}>
          <Button type="link" onClick={() => setPickerVisible(true)}>
            {trigger.sound ? 'Change sound...' : 'Choose sound...'}
          </Button>

          {trigger.sound && (
            <Button
              type="link"
              danger
              onClick={() => mutate((current) => ({ ...current, sound: '' }))}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Checkbox
        className={styles.triggerFireOnEntry}
        checked={Boolean(trigger.fireOnEntry)}
        onChange={(event) =>
          mutate((current) => ({
            ...current,
            fireOnEntry: event.target.checked || undefined
          }))
        }
      >
        Also fire when entering the scene with this already true
      </Checkbox>

      <Button
        className={styles.removeTrigger}
        type="link"
        danger
        icon={<DeleteOutlined />}
        onClick={onDelete}
      >
        Remove trigger
      </Button>
    </div>
  )
}

/**
 * Authoring for a scene's triggers (`dev-doc/scene-triggers.md`): each fires a
 * one-shot sound on the rising edge of one or more variable conditions (combined
 * with AND), optionally also on scene entry.
 *
 * The whole `Scene.triggers` array is read-modified-written through
 * `api().scenes.saveScene` on every edit, re-reading the scene inside the save so
 * a debounced value change cannot clobber a concurrent edit — the same
 * lost-update guard `savePathNotification` uses. Conditions reuse the
 * presentational `VariableRow`; the sound reuses the audio `AssetsModal`.
 */
const SceneTriggers: React.FC<{ studioId: StudioId; scene: Scene }> = ({
  studioId,
  scene
}) => {
  const variables = useVariables(studioId, scene.worldId, [scene.worldId]) ?? []

  const triggers = scene.triggers ?? []

  const saveTriggers = useCallback(
    async (mutator: (triggers: TriggerData[]) => TriggerData[]) => {
      if (!scene.id) return

      const fresh = await api().scenes.getScene(studioId, scene.id)

      await api().scenes.saveScene(studioId, {
        ...fresh,
        triggers: mutator(fresh.triggers ?? [])
      })
    },
    [studioId, scene.id]
  )

  const addTrigger = () =>
    saveTriggers((current) => [
      ...current,
      { id: uuid(), compare: [], sound: '' }
    ])

  const mutateTrigger = (
    id: ElementId,
    next: (trigger: TriggerData) => TriggerData
  ) =>
    saveTriggers((current) =>
      current.map((trigger) => (trigger.id === id ? next(trigger) : trigger))
    )

  const removeTrigger = (id: ElementId) =>
    saveTriggers((current) => current.filter((trigger) => trigger.id !== id))

  return (
    <div className={styles.triggersWrapper}>
      <div className={styles.header}>
        Triggers <HelpButton topic="SCENE_TRIGGERS" />
      </div>

      {triggers.map((trigger) => (
        <TriggerCard
          key={trigger.id}
          studioId={studioId}
          worldId={scene.worldId}
          subject={scene.title}
          variables={variables}
          trigger={trigger}
          mutate={(next) => mutateTrigger(trigger.id, next)}
          onDelete={() => removeTrigger(trigger.id)}
        />
      ))}

      <Button
        className={styles.addTrigger}
        type="link"
        icon={<PlusOutlined />}
        onClick={addTrigger}
      >
        Add trigger
      </Button>

      {triggers.length === 0 && (
        <div className={parentStyles.componentId}>
          No triggers. A trigger plays a sound when its conditions become true.
        </div>
      )}
    </div>
  )
}

SceneTriggers.displayName = 'SceneTriggers'

export default SceneTriggers
