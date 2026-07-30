import React, { useCallback, useMemo } from 'react'
import { v4 as uuid } from 'uuid'

import {
  ElementId,
  Recipe,
  RecipeInput,
  RECIPE_OUTPUT_DESTINATION,
  SET_OPERATOR_TYPE,
  StudioId,
  VariableSet,
  WorldId,
  WorldObject
} from '../../data/types'

import { useObjects, useRecipes, useVariables } from '../../hooks'

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Modal,
  Select
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

import api from '../../api'

import styles from './styles.module.less'

/**
 * Recipes: what combining objects produces.
 *
 * A surface of its own rather than a panel inside an object's form, because a
 * recipe **relates two or more objects and belongs to none of them**. The objects
 * pane lists the recipes naming a given object from either side and opens them
 * here, which is what `TODO.md` means by showing a recipe "from either side of the
 * relationship".
 *
 * Everything about how a recipe *behaves* is in `engine/src/lib/objects.ts` and
 * tested there. This decides only what is editable and what is warned about.
 */

const DESTINATIONS = [
  {
    value: RECIPE_OUTPUT_DESTINATION.INVENTORY,
    label: 'to the inventory'
  },
  {
    value: RECIPE_OUTPUT_DESTINATION.CURRENT_SCENE,
    label: 'to the current scene'
  }
]

const SET_OPERATORS = [
  { value: SET_OPERATOR_TYPE.ASSIGN, label: '=' },
  { value: SET_OPERATOR_TYPE.ADD, label: '+' },
  { value: SET_OPERATOR_TYPE.SUBTRACT, label: '−' },
  { value: SET_OPERATOR_TYPE.MULTIPLY, label: '×' },
  { value: SET_OPERATOR_TYPE.DIVIDE, label: '÷' }
]

/** The key the engine matches on: the input object ids, order-independent. */
export const inputSetKey = (inputs: RecipeInput[]): string =>
  [...inputs.map(({ objectId }) => objectId)].sort().join(' ')

export const describeRecipe = (
  recipe: Recipe,
  objects: WorldObject[]
): string => {
  const name = (id: ElementId) =>
    objects.find((object) => object.id === id)?.title ?? 'unknown'

  const left = recipe.inputs
    .map(
      ({ objectId, quantity, consumed }) =>
        `${name(objectId)}${quantity > 1 ? ` ×${quantity}` : ''}${
          consumed ? '' : ' (kept)'
        }`
    )
    .join(' + ')

  const right =
    recipe.outputs.length === 0
      ? 'nothing'
      : recipe.outputs
          .map(
            ({ objectId, quantity }) =>
              `${name(objectId)}${quantity > 1 ? ` ×${quantity}` : ''}`
          )
          .join(' + ')

  return `${left || 'nothing'} → ${right}`
}

const Recipes: React.FC<{
  studioId: StudioId
  worldId: WorldId
  selectedRecipeId?: ElementId
  onSelectRecipe: (recipeId: ElementId | undefined) => void
}> = ({ studioId, worldId, selectedRecipeId, onSelectRecipe }) => {
  const objects = useObjects(studioId, worldId, [worldId]),
    recipes = useRecipes(studioId, worldId, [worldId]),
    variables = useVariables(studioId, worldId, [worldId])

  const objectList = objects ?? [],
    recipeList = recipes ?? []

  const selected = useMemo(
    () => recipeList.find(({ id }) => id === selectedRecipeId),
    [recipeList, selectedRecipeId]
  )

  const objectOptions = useMemo(
    () =>
      objectList.map((object) => ({
        value: object.id as ElementId,
        label: object.title
      })),
    [objectList]
  )

  const variableOptions = useMemo(
    () =>
      (variables ?? []).map((variable) => ({
        value: variable.id as ElementId,
        label: variable.title
      })),
    [variables]
  )

  /**
   * Another recipe matching the same input set.
   *
   * The engine matches on the exact set and resolves a tie by lowest id, so a
   * duplicate is not a crash — it is a recipe that can never fire, which is far
   * harder to notice. Warned about here rather than prevented, because the
   * half-built state while an author adds the second input of a pair is legitimate.
   */
  const duplicate = useMemo(() => {
    if (!selected || selected.inputs.length === 0) return undefined

    const key = inputSetKey(selected.inputs)

    return recipeList.find(
      (other) => other.id !== selected.id && inputSetKey(other.inputs) === key
    )
  }, [selected, recipeList])

  const save = useCallback(
    async (recipe: Recipe) => {
      await api().recipes.saveRecipe(studioId, recipe)
    },
    [studioId]
  )

  const patch = useCallback(
    async (changes: Partial<Recipe>) => {
      if (!selected) return

      await save({ ...selected, ...changes })
    },
    [selected, save]
  )

  const addRecipe = useCallback(async () => {
    const id = uuid()

    await save({
      id,
      title: 'Untitled Recipe',
      tags: [],
      inputs: [],
      outputs: [],
      worldId
    })

    onSelectRecipe(id)
  }, [save, worldId, onSelectRecipe])

  const removeRecipe = useCallback(() => {
    if (!selected) return

    Modal.confirm({
      title: `Delete '${selected.title}'?`,
      content:
        'The objects it names are not affected. Nothing else references a recipe.',
      okText: 'Delete Recipe',
      okType: 'danger',
      onOk: async () => {
        await api().recipes.removeRecipe(studioId, selected.id as ElementId)

        onSelectRecipe(undefined)
      }
    })
  }, [selected, studioId, onSelectRecipe])

  const firstUnusedObject = (used: ElementId[]) =>
    objectOptions.find(({ value }) => !used.includes(value))?.value

  return (
    <div className={styles.ObjectManager}>
      <div className={styles.list}>
        <div className={styles.listHeader}>
          <span>Recipes ({recipeList.length})</span>

          <Button
            type="link"
            icon={<PlusOutlined />}
            disabled={objectList.length === 0}
            onClick={addRecipe}
          />
        </div>

        {objectList.length === 0 && (
          <Empty
            description="Create an object first."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {objectList.length > 0 && recipeList.length === 0 && (
          <Empty
            description="No recipes yet."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {recipeList.map((recipe) => (
          <div
            key={recipe.id}
            className={`${styles.listRow} ${
              recipe.id === selectedRecipeId ? styles.selected : ''
            }`}
            onClick={() => onSelectRecipe(recipe.id)}
          >
            <span className={styles.listRowTitle}>{recipe.title}</span>

            <span className={styles.listRowMeta}>
              {describeRecipe(recipe, objectList)}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.detail}>
        {!selected && (
          <Empty
            description="Select a recipe, or create one."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {selected && (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Name, for your reference</span>

              <Input
                value={selected.title}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </label>

            {duplicate && (
              <Alert
                type="warning"
                showIcon
                className={styles.alert}
                message={`'${duplicate.title}' already uses these inputs.`}
                description="Two recipes with the same inputs mean one of them can never fire — the storyteller matches on the exact set of objects and takes the first by id."
              />
            )}

            {selected.inputs.length === 0 && (
              <Alert
                type="info"
                showIcon
                className={styles.alert}
                message="A recipe with no inputs can never fire."
              />
            )}

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.fieldLabel}>Inputs</span>

                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  disabled={selected.inputs.length >= objectOptions.length}
                  onClick={() => {
                    const objectId = firstUnusedObject(
                      selected.inputs.map((input) => input.objectId)
                    )

                    if (!objectId) return

                    patch({
                      inputs: [
                        ...selected.inputs,
                        { objectId, quantity: 1, consumed: true }
                      ]
                    })
                  }}
                />
              </div>

              {selected.inputs.map((input, index) => (
                <div key={input.objectId} className={styles.placement}>
                  <Select
                    value={input.objectId}
                    className={styles.placementLocation}
                    onChange={(objectId) => {
                      const inputs = [...selected.inputs]

                      inputs[index] = { ...input, objectId }

                      patch({ inputs })
                    }}
                    options={objectOptions.filter(
                      ({ value }) =>
                        value === input.objectId ||
                        !selected.inputs.some(
                          (other) => other.objectId === value
                        )
                    )}
                  />

                  <InputNumber
                    min={1}
                    value={input.quantity}
                    onChange={(quantity) => {
                      const inputs = [...selected.inputs]

                      inputs[index] = {
                        ...input,
                        quantity: Number(quantity) || 1
                      }

                      patch({ inputs })
                    }}
                  />

                  <Checkbox
                    checked={!input.consumed}
                    onChange={(event) => {
                      const inputs = [...selected.inputs]

                      inputs[index] = {
                        ...input,
                        consumed: !event.target.checked
                      }

                      patch({ inputs })
                    }}
                  >
                    keep
                  </Checkbox>

                  <Button
                    type="link"
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      patch({
                        inputs: selected.inputs.filter(
                          (other) => other.objectId !== input.objectId
                        )
                      })
                    }
                  />
                </div>
              ))}

              <span className={styles.fieldHint}>
                “keep” leaves the input in place instead of consuming it, which is
                how one key opens several drawers. A recipe with a single input is
                offered to the player as <em>Use</em> rather than{' '}
                <em>Combine</em>, so decomposition is just a recipe pointing the
                other way.
              </span>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.fieldLabel}>Outputs</span>

                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  disabled={objectOptions.length === 0}
                  onClick={() => {
                    const objectId = firstUnusedObject(
                      selected.outputs.map((output) => output.objectId)
                    )

                    if (!objectId) return

                    patch({
                      outputs: [
                        ...selected.outputs,
                        {
                          objectId,
                          quantity: 1,
                          destination: RECIPE_OUTPUT_DESTINATION.INVENTORY
                        }
                      ]
                    })
                  }}
                />
              </div>

              {selected.outputs.map((output, index) => (
                <div key={output.objectId} className={styles.placement}>
                  <Select
                    value={output.objectId}
                    className={styles.placementLocation}
                    onChange={(objectId) => {
                      const outputs = [...selected.outputs]

                      outputs[index] = { ...output, objectId }

                      patch({ outputs })
                    }}
                    options={objectOptions.filter(
                      ({ value }) =>
                        value === output.objectId ||
                        !selected.outputs.some(
                          (other) => other.objectId === value
                        )
                    )}
                  />

                  <InputNumber
                    min={1}
                    value={output.quantity}
                    onChange={(quantity) => {
                      const outputs = [...selected.outputs]

                      outputs[index] = {
                        ...output,
                        quantity: Number(quantity) || 1
                      }

                      patch({ outputs })
                    }}
                  />

                  <Select
                    value={output.destination}
                    options={DESTINATIONS}
                    className={styles.placementLocation}
                    onChange={(destination) => {
                      const outputs = [...selected.outputs]

                      outputs[index] = { ...output, destination }

                      patch({ outputs })
                    }}
                  />

                  <Button
                    type="link"
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      patch({
                        outputs: selected.outputs.filter(
                          (other) => other.objectId !== output.objectId
                        )
                      })
                    }
                  />
                </div>
              ))}

              {selected.outputs.some(
                ({ objectId, destination }) =>
                  destination === RECIPE_OUTPUT_DESTINATION.INVENTORY &&
                  objectList.find((object) => object.id === objectId)
                    ?.takeable === false
              ) && (
                <Alert
                  type="warning"
                  showIcon
                  className={styles.alert}
                  message="A static object cannot go to the inventory."
                  description="Send it to the current scene instead, or make it takeable."
                />
              )}
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                What the storyteller says when this fires
              </span>

              <Input
                value={selected.message ?? ''}
                placeholder="You snap the battery into the flashlight."
                onChange={(event) =>
                  patch({ message: event.target.value || undefined })
                }
              />

              <span className={styles.fieldHint}>
                Optional — the inventory visibly changes either way.
              </span>
            </label>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.fieldLabel}>
                  Variables set when this fires
                </span>

                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  disabled={variableOptions.length === 0}
                  onClick={() => {
                    const variable = variables?.[0]

                    if (!variable?.id) return

                    const effect: VariableSet = [
                      variable.id,
                      SET_OPERATOR_TYPE.ASSIGN,
                      '',
                      variable.type
                    ]

                    patch({ effects: [...(selected.effects ?? []), effect] })
                  }}
                />
              </div>

              {(selected.effects ?? []).map((effect, index) => (
                <div key={index} className={styles.placement}>
                  <Select
                    value={effect[0]}
                    className={styles.placementLocation}
                    options={variableOptions}
                    onChange={(variableId) => {
                      const effects = [...(selected.effects ?? [])]

                      const type =
                        variables?.find(({ id }) => id === variableId)?.type ??
                        effect[3]

                      effects[index] = [variableId, effect[1], effect[2], type]

                      patch({ effects })
                    }}
                  />

                  <Select
                    value={effect[1]}
                    options={SET_OPERATORS}
                    onChange={(operator) => {
                      const effects = [...(selected.effects ?? [])]

                      effects[index] = [
                        effect[0],
                        operator,
                        effect[2],
                        effect[3]
                      ]

                      patch({ effects })
                    }}
                  />

                  <Input
                    value={effect[2]}
                    className={styles.placementLocation}
                    onChange={(event) => {
                      const effects = [...(selected.effects ?? [])]

                      effects[index] = [
                        effect[0],
                        effect[1],
                        event.target.value,
                        effect[3]
                      ]

                      patch({ effects })
                    }}
                  />

                  <Button
                    type="link"
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      patch({
                        effects: (selected.effects ?? []).filter(
                          (_, other) => other !== index
                        )
                      })
                    }
                  />
                </div>
              ))}

              {variableOptions.length === 0 && (
                <span className={styles.fieldHint}>
                  No variables in this storyworld yet.
                </span>
              )}
            </div>

            <div className={styles.section}>
              <Button danger icon={<DeleteOutlined />} onClick={removeRecipe}>
                Delete Recipe
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

Recipes.displayName = 'Recipes'

export default Recipes
