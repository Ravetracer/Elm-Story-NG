import React, { useCallback, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'

import {
  ElementId,
  EQUIP_SLOT,
  INVENTORY_LOCATION_KEY,
  ObjectPlacement,
  StudioId,
  WorldId,
  WorldObject
} from '../../data/types'

/**
 * The equip slots offered when an object is wearable, with the label shown in the
 * editor. A slot is optional — the empty option means "wearable, but claims no slot"
 * — and only slotted objects are exclusive and appear on the paperdoll.
 */
const SLOT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'No slot' },
  { value: EQUIP_SLOT.HEAD, label: 'Head' },
  { value: EQUIP_SLOT.FACE, label: 'Face' },
  { value: EQUIP_SLOT.NECK, label: 'Neck' },
  { value: EQUIP_SLOT.BODY, label: 'Body' },
  { value: EQUIP_SLOT.HANDS, label: 'Hands' },
  { value: EQUIP_SLOT.FEET, label: 'Feet' },
  { value: EQUIP_SLOT.HELD, label: 'Held' }
]

import { ASSET_KIND } from '../../lib/assets'

import {
  useObjects,
  useRecipesByObjectRef,
  useScenes,
  useVariables
} from '../../hooks'

import { Button, Checkbox, Empty, Input, InputNumber, Select, Tooltip } from 'antd'
import {
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined
} from '@ant-design/icons'

import { AssetsModal } from '../Modal'
import confirmRemoveObject from './confirmRemoveObject'
import AssetThumbnail from '../AssetThumbnail'
import PlacementConditions from './PlacementConditions'
import VariableEffectRows from './VariableEffectRows'
import { describeRecipe } from './Recipes'

import api from '../../api'

import styles from './styles.module.less'

/**
 * The one place world objects are authored.
 *
 * Shaped after `VariableManager`: a list on the left, the selected element's
 * fields on the right, and a deletion that states its consequences rather than
 * happening on one unconfirmed click.
 *
 * Placements are edited here rather than from the scene they name, because a
 * placement belongs to the object — it is an inline array on the object record,
 * with no id of its own — and an object may sit in several scenes at once. The
 * inventory is offered as a location beside the scenes, which is how a starting
 * inventory is authored: the model has one location space, with the inventory as a
 * sentinel key beside the scene ids.
 *
 * **Recipes are edited on their own tab**, because a recipe relates two or more
 * objects and belongs to none of them. What appears here is the *read* side of
 * that relationship: every recipe naming this object, whichever side it is on, with
 * a click through to it. That is what the original roadmap asks for by "show an object's
 * recipes from either side of the relationship".
 */
const Objects: React.FC<{
  studioId: StudioId
  worldId: WorldId
  selectedObjectId?: ElementId
  onSelectObject: (objectId: ElementId | undefined) => void
  onOpenRecipe: (recipeId: ElementId) => void
}> = ({
  studioId,
  worldId,
  selectedObjectId,
  onSelectObject,
  onOpenRecipe
}) => {
  const objects = useObjects(studioId, worldId, [worldId]),
    scenes = useScenes(studioId, worldId, [worldId]),
    variables = useVariables(studioId, worldId, [worldId])

  const objectRecipes = useRecipesByObjectRef(
    studioId,
    worldId,
    selectedObjectId,
    [worldId, selectedObjectId]
  )

  const [assetPickerFor, setAssetPickerFor] = useState<
    'assetId' | 'stackedAssetId' | undefined
  >(undefined)

  const selected = useMemo(
    () => objects?.find(({ id }) => id === selectedObjectId),
    [objects, selectedObjectId]
  )

  /** Every location an object may be placed in: the inventory, then every scene. */
  const locations = useMemo(
    () => [
      { value: INVENTORY_LOCATION_KEY, label: 'Inventory (starts held)' },
      ...(scenes ?? []).map((scene) => ({
        value: scene.id as ElementId,
        label: scene.title
      }))
    ],
    [scenes]
  )

  const save = useCallback(
    async (object: WorldObject) => {
      await api().objects.saveObject(studioId, object)
    },
    [studioId]
  )

  const patch = useCallback(
    async (changes: Partial<WorldObject>) => {
      if (!selected) return

      await save({ ...selected, ...changes })
    },
    [selected, save]
  )

  const addObject = useCallback(async () => {
    const id = uuid()

    await save({
      id,
      title: 'Untitled Object',
      description: '',
      tags: [],
      takeable: true,
      combineable: true,
      placements: [],
      worldId
    })

    onSelectObject(id)
  }, [save, worldId])

  const setPlacements = useCallback(
    async (placements: ObjectPlacement[]) => await patch({ placements }),
    [patch]
  )

  const addPlacement = useCallback(async () => {
    if (!selected) return

    // Only offer a location the object is not already placed in: the model reads
    // at most one placement per location, so a second would be silently ignored.
    const taken = new Set(selected.placements.map(({ location }) => location))

    const next = locations.find(({ value }) => !taken.has(value))

    if (!next) return

    await setPlacements([
      ...selected.placements,
      { location: next.value, quantity: 1 }
    ])
  }, [selected, locations, setPlacements])

  const objectList = objects ?? []

  return (
    <>
      {selected && assetPickerFor && (
        <AssetsModal
          studioId={studioId}
          worldId={worldId}
          subject={selected.title}
          visible
          selectKind={ASSET_KIND.OBJECT_IMAGE}
          selectedAssetId={selected[assetPickerFor]}
          onSelect={async (assetId) => {
            await patch({ [assetPickerFor]: assetId })

            setAssetPickerFor(undefined)
          }}
          onCancel={() => setAssetPickerFor(undefined)}
        />
      )}

      <div className={styles.ObjectManager}>
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <span>Objects ({objectList.length})</span>

            <Tooltip title="New Object" mouseEnterDelay={1}>
              <Button type="link" onClick={addObject}>
                <PlusOutlined />
              </Button>
            </Tooltip>
          </div>

          {objectList.length === 0 && (
            <Empty
              description="No objects yet."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}

          {objectList.map((object) => (
            <div
              key={object.id}
              className={`${styles.listRow} ${
                object.id === selectedObjectId ? styles.selected : ''
              }`}
              onClick={() => onSelectObject(object.id)}
            >
              <AssetThumbnail
                studioId={studioId}
                worldId={worldId}
                kind={ASSET_KIND.OBJECT_IMAGE}
                assetId={object.assetId}
              />

              <div className={styles.listRowText}>
                <span className={styles.listRowTitle}>{object.title}</span>

                <span className={styles.listRowMeta}>
                  {object.takeable ? 'takeable' : 'static'}
                  {object.placements.length > 0 &&
                    ` · ${object.placements.length} placement${
                      object.placements.length === 1 ? '' : 's'
                    }`}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.detail}>
          {!selected && (
            <Empty
              description="Select an object, or create one."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}

          {selected && (
            <>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Name</span>

                <Input
                  value={selected.title}
                  onChange={(event) => patch({ title: event.target.value })}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Description, shown when inspected
                </span>

                <Input.TextArea
                  value={selected.description}
                  rows={3}
                  onChange={(event) =>
                    patch({ description: event.target.value })
                  }
                />

                <span className={styles.fieldHint}>
                  Template expressions work here, the same as in event content —{' '}
                  {'{ variableName }'}.
                </span>
              </label>

              <div className={styles.fieldRow}>
                <Checkbox
                  checked={selected.takeable}
                  onChange={(event) =>
                    patch({ takeable: event.target.checked })
                  }
                >
                  Takeable
                </Checkbox>

                <Checkbox
                  checked={selected.combineable}
                  onChange={(event) =>
                    patch({ combineable: event.target.checked })
                  }
                >
                  Combineable
                </Checkbox>

                <Checkbox
                  checked={selected.wearable ?? false}
                  onChange={(event) =>
                    patch({ wearable: event.target.checked || undefined })
                  }
                >
                  Wearable
                </Checkbox>
              </div>

              <span className={styles.fieldHint}>
                A static object stays in its scene and can still be combined with —
                a drawer, a door. Combineable decides whether the storyteller offers
                it for a combination at all, so an object with no recipes can still
                be something the player tries and is refused.
              </span>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Stacked name, used when the player holds more than one
                </span>

                <Input
                  value={selected.stackedTitle ?? ''}
                  placeholder={`e.g. a pile of ${selected.title.toLowerCase()}s`}
                  onChange={(event) =>
                    patch({ stackedTitle: event.target.value || undefined })
                  }
                />
              </label>

              <div className={styles.fieldRow}>
                <Button
                  icon={<PictureOutlined />}
                  onClick={() => setAssetPickerFor('assetId')}
                >
                  {selected.assetId ? 'Change Image' : 'Choose Image'}
                </Button>

                {selected.assetId && (
                  <Button
                    type="link"
                    onClick={() => patch({ assetId: undefined })}
                  >
                    Clear
                  </Button>
                )}

                <Button
                  icon={<PictureOutlined />}
                  onClick={() => setAssetPickerFor('stackedAssetId')}
                >
                  {selected.stackedAssetId
                    ? 'Change Stacked Image'
                    : 'Choose Stacked Image'}
                </Button>

                {selected.stackedAssetId && (
                  <Button
                    type="link"
                    onClick={() => patch({ stackedAssetId: undefined })}
                  >
                    Clear
                  </Button>
                )}
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  What the storyteller says when this is combined with something
                  that has no recipe
                </span>

                <Input
                  value={selected.noRecipeMessage ?? ''}
                  placeholder="Nothing happens."
                  onChange={(event) =>
                    patch({ noRecipeMessage: event.target.value || undefined })
                  }
                />

                <span className={styles.fieldHint}>
                  Used when this is the <em>first</em> object selected, so “use the
                  key on the drawer” lets the key speak. Falls back to the
                  storyworld’s message, then to “Nothing happens.”
                </span>
              </label>

              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.fieldLabel}>Placements</span>

                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    disabled={selected.placements.length >= locations.length}
                    onClick={addPlacement}
                  />
                </div>

                {selected.placements.length === 0 && (
                  <span className={styles.fieldHint}>
                    Not placed anywhere, so it never appears unless a recipe
                    produces it.
                  </span>
                )}

                {selected.placements.map((placement, index) => {
                  const replace = (next: ObjectPlacement) => {
                    const placements = [...selected.placements]

                    placements[index] = next

                    setPlacements(placements)
                  }

                  return (
                    <div
                      key={placement.location}
                      className={styles.placementGroup}
                    >
                      <div className={styles.placement}>
                        <Select
                          value={placement.location}
                          className={styles.placementLocation}
                          onChange={(location) =>
                            replace({ ...placement, location })
                          }
                          options={locations.filter(
                            ({ value }) =>
                              value === placement.location ||
                              !selected.placements.some(
                                (other) => other.location === value
                              )
                          )}
                        />

                        <InputNumber
                          min={1}
                          value={placement.quantity}
                          onChange={(quantity) =>
                            replace({
                              ...placement,
                              quantity: Number(quantity) || 1
                            })
                          }
                        />

                        <Button
                          type="link"
                          icon={<DeleteOutlined />}
                          onClick={() =>
                            setPlacements(
                              selected.placements.filter(
                                (other) =>
                                  other.location !== placement.location
                              )
                            )
                          }
                        />
                      </div>

                      <PlacementConditions
                        placement={placement}
                        objects={objectList}
                        ownerId={selected.id}
                        scenes={scenes ?? []}
                        variables={variables ?? []}
                        onChange={replace}
                      />
                    </div>
                  )
                })}
              </div>

              {/*
                Taking an object runs nothing else — a recipe's effects fire on Use
                or Combine, which a take is not — so this is the only way "the
                player has the book" becomes a variable. It has to be a variable
                whenever prose needs it: a template expression can read variables
                and nothing else, while a *path* condition can ask about the
                inventory directly and needs no variable at all.
              */}
              {selected.takeable && (
                <div className={styles.section}>
                  <span className={styles.fieldLabel}>
                    When the player takes this
                  </span>

                  <Input
                    value={selected.takeMessage ?? ''}
                    placeholder="You slip the book into your bag."
                    onChange={(event) =>
                      patch({ takeMessage: event.target.value || undefined })
                    }
                  />

                  <span className={styles.fieldHint}>
                    Optional. The object visibly moves to Carrying either way.
                  </span>

                  <VariableEffectRows
                    effects={selected.takeEffects ?? []}
                    variables={variables ?? []}
                    addLabel="Set a variable on take"
                    onChange={(takeEffects) =>
                      patch({
                        takeEffects:
                          takeEffects.length > 0 ? takeEffects : undefined
                      })
                    }
                  />

                  <span className={styles.fieldHint}>
                    Applied every time a stack of this is picked up, so “set to” is
                    usually the right operator rather than an increment.
                  </span>
                </div>
              )}

              {/*
                Wearing sets variables the same way taking does, so a path can be
                gated on "is the player wearing this" — a disguise that lets them
                pass, a hat that lets them enter. Removing reverses it. This is not
                a stat system; it sets variables and the condition system does the
                rest.
              */}
              {selected.wearable && (
                <div className={styles.section}>
                  <span className={styles.fieldLabel}>Equip slot</span>

                  <Select
                    value={selected.slot ?? ''}
                    options={SLOT_OPTIONS}
                    onChange={(slot) =>
                      patch({ slot: (slot as EQUIP_SLOT) || undefined })
                    }
                  />

                  <span className={styles.fieldHint}>
                    A slot holds one thing at a time: wearing a second Head item
                    takes the first off. Slotted items show on the character
                    paperdoll. Leave it on "No slot" to make the object wearable
                    without claiming a body part.
                  </span>

                  <span className={styles.fieldLabel}>
                    When the player wears this
                  </span>

                  <Input
                    value={selected.wearMessage ?? ''}
                    placeholder="You pull the hood low over your face."
                    onChange={(event) =>
                      patch({ wearMessage: event.target.value || undefined })
                    }
                  />

                  <VariableEffectRows
                    effects={selected.wearEffects ?? []}
                    variables={variables ?? []}
                    addLabel="Set a variable on wear"
                    onChange={(wearEffects) =>
                      patch({
                        wearEffects:
                          wearEffects.length > 0 ? wearEffects : undefined
                      })
                    }
                  />

                  <span className={styles.fieldLabel}>
                    When the player removes this
                  </span>

                  <Input
                    value={selected.removeMessage ?? ''}
                    placeholder="You lower the hood."
                    onChange={(event) =>
                      patch({ removeMessage: event.target.value || undefined })
                    }
                  />

                  <VariableEffectRows
                    effects={selected.removeEffects ?? []}
                    variables={variables ?? []}
                    addLabel="Set a variable on remove"
                    onChange={(removeEffects) =>
                      patch({
                        removeEffects:
                          removeEffects.length > 0 ? removeEffects : undefined
                      })
                    }
                  />

                  <span className={styles.fieldHint}>
                    Wearing keeps the object in Carrying; it is not consumed. Gate a
                    path on the variable you set here to react to it.
                  </span>
                </div>
              )}

              {/*
                The read side of the recipe relationship. A recipe belongs to no
                single object, so it is edited on its own tab — but an author
                looking at the flashlight needs to see that charging it exists,
                whichever side of the arrow it sits on.
              */}
              <div className={styles.section}>
                <span className={styles.fieldLabel}>Recipes using this</span>

                {objectRecipes === undefined && (
                  <span className={styles.fieldHint}>Loading…</span>
                )}

                {objectRecipes?.length === 0 && (
                  <span className={styles.fieldHint}>
                    None. Without a recipe, combining this with something else
                    reports the message above.
                  </span>
                )}

                {objectRecipes?.map((recipe) => (
                  <div key={recipe.id} className={styles.recipeRef}>
                    <a onClick={() => onOpenRecipe(recipe.id as ElementId)}>
                      {recipe.title}
                    </a>

                    <span className={styles.listRowMeta}>
                      {describeRecipe(recipe, objectList)}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.section}>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    confirmRemoveObject(
                      studioId,
                      worldId,
                      selected.id as ElementId,
                      selected.title,
                      () => onSelectObject(undefined)
                    )
                  }
                >
                  Delete Object
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

Objects.displayName = 'Objects'

export default Objects
