import React, { useCallback, useMemo, useState } from 'react'
import { debounce } from 'lodash-es'
import { v4 as uuid } from 'uuid'

import {
  CharacterRelationship,
  ElementId,
  StudioId,
  WorldId
} from '../../data/types'

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Select,
  Tooltip
} from 'antd'
import {
  ArrowRightOutlined,
  DeleteOutlined,
  PlusOutlined,
  SwapOutlined
} from '@ant-design/icons'

import {
  useCharacterRelationships,
  useCharacters,
  useVariables
} from '../../hooks'

import api from '../../api'

import styles from './styles.module.less'

/**
 * The graph between characters — "sister of", "distrusts", "owes money to".
 *
 * Same shape as the recipe editor and deliberately so: a list of edges on the left,
 * the selected one's detail on the right. A relationship relates two characters and
 * belongs to neither, which is why it is a table rather than a field on a character,
 * and why it is edited here rather than inside one of them.
 *
 * **Editor-only.** `DESIGN.md` §10: this is authoring metadata, so it is not
 * compiled into the engine collection and the storyteller never sees it. Anything
 * that has to matter at runtime goes through the optional variable — the
 * relationship is the note, the variable is the number the engine already
 * understands. That is why the variable field carries an explanation rather than
 * just a label; without one, an author would reasonably expect setting a
 * relationship to do something in play.
 */
const RelationshipManager: React.FC<{
  studioId: StudioId
  worldId: WorldId
}> = ({ studioId, worldId }) => {
  const relationships = useCharacterRelationships(studioId, worldId, [
      studioId,
      worldId
    ]),
    characters = useCharacters(studioId, worldId, [studioId, worldId]),
    variables = useVariables(studioId, worldId, [studioId, worldId])

  const [selectedId, setSelectedId] = useState<ElementId | undefined>(undefined)

  const selected = useMemo(
    () => (relationships ?? []).find(({ id }) => id === selectedId),
    [relationships, selectedId]
  )

  const characterOptions = useMemo(
    () =>
      (characters ?? []).map((character) => ({
        label: character.title,
        value: character.id as ElementId
      })),
    [characters]
  )

  const nameOf = useCallback(
    (characterId?: ElementId) =>
      (characters ?? []).find(({ id }) => id === characterId)?.title ??
      'someone removed',
    [characters]
  )

  const patch = useCallback(
    async (changes: Partial<CharacterRelationship>) => {
      if (!selected) return

      await api().characterRelationships.saveCharacterRelationship(studioId, {
        ...selected,
        ...changes
      })
    },
    [studioId, selected]
  )

  /*
   * The two text fields save as they are typed, debounced, rather than on blur.
   * Blur loses the edit when the modal is dismissed with escape, which changes
   * focus not at all — the same class of lost write as a debounced save that is
   * never flushed on unmount. `VariableDescription` settled this pattern; the
   * inputs are uncontrolled and keyed on the id for the same reason it gives, so a
   * live query refreshing mid-edit cannot fight the caret.
   */
  const patchText = useMemo(
    () => debounce((changes: Partial<CharacterRelationship>) => patch(changes), 400),
    [patch]
  )

  const addRelationship = useCallback(async () => {
    const first = characters?.[0]?.id as ElementId | undefined

    if (!first) return

    const id = uuid()

    await api().characterRelationships.saveCharacterRelationship(studioId, {
      id,
      worldId,
      // both ends default to the first character rather than to nothing: the
      // record has to be valid the moment it exists, and a self-relationship is
      // visibly wrong in a way an empty select is not
      from: first,
      to: (characters?.[1]?.id as ElementId) ?? first,
      directed: true,
      title: 'Untitled Relationship',
      tags: [],
      updated: Date.now()
    })

    setSelectedId(id)
  }, [studioId, worldId, characters])

  const confirmRemove = useCallback(() => {
    if (!selected) return

    Modal.confirm({
      title: `Remove "${selected.title}"?`,
      content:
        'The relationship is removed. Neither character changes, and a variable it names is left alone.',
      okText: 'Remove',
      okButtonProps: { danger: true },
      onOk: async () => {
        await api().characterRelationships.removeCharacterRelationship(
          studioId,
          selected.id as ElementId
        )

        setSelectedId(undefined)
      }
    })
  }, [studioId, selected])

  const relationshipList = relationships ?? []

  return (
    <div className={styles.RelationshipManager}>
      <div className={styles.list}>
        <div className={styles.listHeader}>
          <span>Relationships ({relationshipList.length})</span>

          <Tooltip title="New Relationship" mouseEnterDelay={1}>
            <Button
              type="link"
              disabled={(characters ?? []).length === 0}
              onClick={addRelationship}
            >
              <PlusOutlined />
            </Button>
          </Tooltip>
        </div>

        {(characters ?? []).length === 0 && (
          <Empty
            description="Create a character first."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {(characters ?? []).length > 0 && relationshipList.length === 0 && (
          <Empty
            description="No relationships yet."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {relationshipList.map((relationship) => (
          <div
            key={relationship.id}
            className={`${styles.listRow} ${
              relationship.id === selectedId ? styles.selected : ''
            }`}
            onClick={() => setSelectedId(relationship.id as ElementId)}
          >
            <span className={styles.listRowTitle}>{relationship.title}</span>

            <span className={styles.listRowMeta}>
              {nameOf(relationship.from)}{' '}
              {relationship.directed ? <ArrowRightOutlined /> : <SwapOutlined />}{' '}
              {nameOf(relationship.to)}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.detail}>
        {!selected && (
          <Empty
            description="Select a relationship, or create one."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {selected && (
          <>
            <span className={styles.fieldLabel}>Label</span>

            <Input
              // keyed on the id so switching rows remounts with the right text
              // rather than fighting a live query mid-edit, as VariableDescription
              // documents
              key={`${selected.id}-title`}
              defaultValue={selected.title}
              placeholder="sister of, distrusts, owes money to..."
              onChange={(event) =>
                patchText({
                  title: event.target.value || 'Untitled Relationship'
                })
              }
            />

            <div className={styles.ends}>
              <div className={styles.end}>
                <span className={styles.fieldLabel}>From</span>

                <Select
                  value={selected.from}
                  options={characterOptions}
                  onChange={(from) => patch({ from })}
                />
              </div>

              <Tooltip
                title={
                  selected.directed
                    ? 'One way: the label reads from left to right.'
                    : 'Mutual: the label reads both ways.'
                }
              >
                <Button
                  type="link"
                  className={styles.direction}
                  onClick={() => patch({ directed: !selected.directed })}
                >
                  {selected.directed ? <ArrowRightOutlined /> : <SwapOutlined />}
                </Button>
              </Tooltip>

              <div className={styles.end}>
                <span className={styles.fieldLabel}>To</span>

                <Select
                  value={selected.to}
                  options={characterOptions}
                  onChange={(to) => patch({ to })}
                />
              </div>
            </div>

            <Checkbox
              checked={!selected.directed}
              onChange={(event) => patch({ directed: !event.target.checked })}
            >
              Mutual
            </Checkbox>

            {selected.from === selected.to && (
              <Alert
                type="warning"
                showIcon
                className={styles.alert}
                message="Both ends are the same character."
              />
            )}

            <span className={styles.fieldLabel}>Note</span>

            <Input.TextArea
              key={`${selected.id}-description`}
              autoSize={{ minRows: 2 }}
              defaultValue={selected.description}
              placeholder="For your reference while writing."
              onChange={(event) =>
                patchText({ description: event.target.value })
              }
            />

            <span className={styles.fieldLabel}>Variable</span>

            <Select
              value={selected.variableId}
              placeholder="None"
              allowClear
              options={(variables ?? []).map((variable) => ({
                label: variable.title,
                value: variable.id as ElementId
              }))}
              onChange={(variableId) => patch({ variableId })}
            />

            <Alert
              type="info"
              showIcon
              className={styles.alert}
              message="Relationships are for you, not the storyteller."
              description="They are never compiled into an exported storyworld, so nothing in play changes when one is added. Name a variable here if the relationship should also be something conditions and expressions can read — the relationship is the note, the variable is the number."
            />

            <Button danger onClick={confirmRemove} className={styles.remove}>
              <DeleteOutlined /> Remove Relationship
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

RelationshipManager.displayName = 'RelationshipManager'

export default RelationshipManager
