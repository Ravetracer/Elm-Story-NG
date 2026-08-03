import { v4 as uuid } from 'uuid'

import { isElementEmptyAndSelected } from '../../../lib/contentEditor'

import React, { useContext, useState } from 'react'

import { StudioId, WorldId } from '../../../data/types'

import { ComposerContext } from '../../../contexts/ComposerContext'

import Icon, { BranchesOutlined } from '@ant-design/icons'
import { Typography } from 'antd'

import { useChoice } from '../../../hooks'

import api from '../../../api'

import { Draggable } from 'react-beautiful-dnd'
import { Transforms, Editor } from 'slate'
import { ReactEditor, useSelected, useSlate } from 'slate-react'

import {
  ALIGN_TYPE,
  CharacterElement as CharacterElementType,
  ChoiceElement as ChoiceElementType,
  ELEMENT_FORMATS,
  EmbedElement as EmbedElementType,
  EventContentElement,
  ImageElement as ImageElementType,
  LinkElement as LinkElementType
} from '../../../data/eventContentTypes'

import CharacterElementSelect, {
  OnCharacterSelect
} from './Tools/CharacterElementSelect'
import ImageElementSelect, {
  OnImageAssetSelect,
  OnImageSelect
} from './Tools/ImageElementSelect'

import styles from './styles.module.less'
import LinkElementEditor from './Tools/LinkElementEditor'

const CharacterElement: React.FC<{
  studioId: StudioId
  worldId: WorldId
  onCharacterSelect: OnCharacterSelect
  element: CharacterElementType
  attributes: {}
}> = ({
  studioId,
  worldId,
  onCharacterSelect,
  element,
  attributes,
  children
}) => {
  const selected = useSelected()

  const { character_id, alias_id, transform, styles: _styles } = element

  return (
    <span
      {...attributes}
      style={{
        display: 'inline-block'
      }}
      className={`${styles.character} ${selected ? styles.selected : ''}`}
      data-slate-editor
    >
      <CharacterElementSelect
        studioId={studioId}
        worldId={worldId}
        element={element}
        selectedCharacter={
          character_id
            ? { character_id, alias_id, transform, styles: _styles }
            : undefined
        }
        onCharacterSelect={onCharacterSelect}
      />

      {children}
    </span>
  )
}

/**
 * An inline choice, as the author sees it.
 *
 * The chip shows the choice's title and renames it in place, because the title *is*
 * the words the player reads — sending the author to the scene map to name what
 * they are in the middle of writing would make the sentence unwriteable in one
 * pass. It is the same `Typography.Text editable` the scene map's own choice row
 * uses, saving through the same `saveChoice`, so the two cannot disagree.
 *
 * The node is a void: Slate owns none of this text, and every character of it
 * belongs to the `choices` table.
 */
const ChoiceElement: React.FC<{
  studioId: StudioId
  element: ChoiceElementType
  attributes: {}
}> = ({ studioId, element, attributes, children }) => {
  const selected = useSelected()

  const choice = useChoice(studioId, element.choice_id, [element.choice_id])

  const [renaming, setRenaming] = useState(false)

  return (
    <span
      {...attributes}
      className={`${styles.choice} ${selected ? styles.selected : ''}`}
      // a choice that has been deleted from the scene map leaves this node behind;
      // it says so rather than rendering an empty chip, and the engine offers
      // nothing to click. See lib/serialization.ts for why it is not repaired here.
      title={
        choice
          ? 'Inline choice — click the title to rename it. Draw its path on the scene map.'
          : 'This choice no longer exists. Delete this to tidy the sentence.'
      }
      data-slate-editor
    >
      <BranchesOutlined className={styles.choiceIcon} />

      {choice ? (
        <Typography.Text
          className={styles.choiceTitle}
          editable={{
            editing: renaming,
            onStart: () => setRenaming(true),
            onChange: async (newTitle) => {
              setRenaming(false)

              if (!newTitle || newTitle === choice.title) return

              await api().choices.saveChoice(studioId, {
                ...choice,
                title: newTitle
              })
            }
          }}
        >
          {choice.title}
        </Typography.Text>
      ) : (
        <span className={styles.choiceMissing}>Choice not found</span>
      )}

      {children}
    </span>
  )
}

const ImageElement: React.FC<{
  studioId: StudioId
  worldId: WorldId
  element: ImageElementType
  attributes: {}
  onImageSelect: OnImageSelect
  onImageAssetSelect?: OnImageAssetSelect
}> = ({
  studioId,
  worldId,
  element,
  attributes,
  onImageSelect,
  onImageAssetSelect,
  children
}) => {
  return (
    <div {...attributes} className={`${styles.img}`}>
      {children}

      <ImageElementSelect
        studioId={studioId}
        worldId={worldId}
        element={element}
        onImageSelect={onImageSelect}
        onImageAssetSelect={onImageAssetSelect}
      />
    </div>
  )
}

const EmbedElement: React.FC<{ element: EmbedElementType; attributes: {} }> = ({
  element,
  attributes,
  children
}) => {
  return element.url ? (
    <div {...attributes}>
      <div contentEditable={false}>
        <div
          style={{
            padding: '62.5% 0 0 0',
            position: 'relative'
          }}
        >
          <iframe
            src={`${element.url}?title=0&byline=0&portrait=0`}
            frameBorder="0"
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '100%'
            }}
          />
        </div>
      </div>
      {children}
    </div>
  ) : (
    <div>missing embed</div>
  )
}

const LinkElement: React.FC<{ element: LinkElementType; attributes: {} }> = ({
  element,
  attributes,
  children
}) => {
  return (
    <LinkElementEditor element={element}>
      <span
        {...attributes}
        className={`${styles.link} ${!element.url ? styles.error : ''}`}
      >
        {/* <InlineChromiumBugfix /> */}
        {children}
        {/* <InlineChromiumBugfix /> */}
      </span>
    </LinkElementEditor>
  )
}

const DraggableWrapper: React.FC<{ element: EventContentElement }> = ({
  element,
  children
}) => {
  const editor = useSlate()

  const [draggableId] = useState(uuid())

  const { composer } = useContext(ComposerContext)

  const selectElement = () => {
    const elementPosition = ReactEditor.findPath(editor, element)[0]

    Transforms.select(editor, {
      anchor: Editor.start(editor, [elementPosition]),
      focus: Editor.end(editor, [elementPosition])
    })
  }

  return (
    <Draggable
      draggableId={draggableId}
      index={ReactEditor.findPath(editor, element)[0]}
    >
      {(provided) => (
        <div
          {...provided.draggableProps}
          ref={provided.innerRef}
          className={styles.DraggableWrapper}
        >
          <div
            contentEditable={false}
            className={styles.dragHandle}
            style={
              composer.draggableEventContentElement
                ? {
                    opacity: 0
                  }
                : {}
            }
            onClick={selectElement}
            {...provided.dragHandleProps}
          >
            <Icon
              component={() => (
                <svg
                  width="14"
                  height="18"
                  viewBox="0 0 14 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="14" height="18" rx="2" fill="#8E4CFF" />
                  <circle cx="5" cy="5" r="1" fill="white" />
                  <circle cx="9" cy="5" r="1" fill="white" />
                  <circle cx="5" cy="9" r="1" fill="white" />
                  <circle cx="9" cy="9" r="1" fill="white" />
                  <circle cx="5" cy="13" r="1" fill="white" />
                  <circle cx="9" cy="13" r="1" fill="white" />
                </svg>
              )}
            />
          </div>

          {children}
        </div>
      )}
    </Draggable>
  )
}

export const Element: React.FC<{
  studioId?: StudioId
  worldId?: WorldId
  onCharacterSelect?: OnCharacterSelect
  onImageSelect?: OnImageSelect
  onImageAssetSelect?: OnImageAssetSelect
  element: EventContentElement
  attributes: {}
}> = ({
  studioId,
  worldId,
  onCharacterSelect,
  onImageSelect,
  onImageAssetSelect,
  element,
  attributes,
  children
}) => {
  const editor = useSlate(),
    selected = useSelected()

  let content: JSX.Element | undefined = undefined

  const _isElementEmptyAndSelected = isElementEmptyAndSelected(
    editor,
    element,
    selected
  )

  switch (element.type) {
    case ELEMENT_FORMATS.BLOCKQUOTE:
      content = (
        <div className={styles.blockquoteWrapper}>
          <blockquote
            className={_isElementEmptyAndSelected ? styles.empty : ''}
            {...attributes}
          >
            {children}
          </blockquote>
        </div>
      )
      break
    case ELEMENT_FORMATS.UL:
      content = <ul {...attributes}>{children}</ul>
      break
    case ELEMENT_FORMATS.H1:
      content = (
        <h1
          style={{ textAlign: element.align || ALIGN_TYPE.LEFT }}
          className={_isElementEmptyAndSelected ? styles.empty : ''}
          {...attributes}
        >
          {children}
        </h1>
      )
      break
    case ELEMENT_FORMATS.H2:
      content = (
        <h2
          style={{ textAlign: element.align || ALIGN_TYPE.LEFT }}
          className={_isElementEmptyAndSelected ? styles.empty : ''}
          {...attributes}
        >
          {children}
        </h2>
      )
      break
    case ELEMENT_FORMATS.H3:
      content = (
        <h3
          style={{ textAlign: element.align || ALIGN_TYPE.LEFT }}
          className={_isElementEmptyAndSelected ? styles.empty : ''}
          {...attributes}
        >
          {children}
        </h3>
      )
      break
    case ELEMENT_FORMATS.H4:
      content = (
        <h4
          style={{ textAlign: element.align || ALIGN_TYPE.LEFT }}
          className={_isElementEmptyAndSelected ? styles.empty : ''}
          {...attributes}
        >
          {children}
        </h4>
      )
      break
    case ELEMENT_FORMATS.LI:
      content = (
        <li
          className={_isElementEmptyAndSelected ? styles.empty : ''}
          {...attributes}
        >
          {children}
        </li>
      )
      break
    case ELEMENT_FORMATS.OL:
      content = <ol {...attributes}>{children}</ol>
      break
    case ELEMENT_FORMATS.IMG:
      if (!studioId || !worldId || !onImageSelect)
        throw 'Unable to render image element.'

      content = (
        <ImageElement
          studioId={studioId}
          worldId={worldId}
          element={element}
          attributes={attributes}
          onImageSelect={onImageSelect}
          onImageAssetSelect={onImageAssetSelect}
        >
          {children}
        </ImageElement>
      )
      break
    case ELEMENT_FORMATS.CHARACTER:
      if (!studioId || !worldId || !onCharacterSelect)
        throw 'Unable to render character element.'

      content = (
        <CharacterElement
          studioId={studioId}
          worldId={worldId}
          onCharacterSelect={onCharacterSelect}
          element={element}
          attributes={attributes}
        >
          {children}
        </CharacterElement>
      )
      break
    case ELEMENT_FORMATS.CHOICE:
      if (!studioId) throw 'Unable to render inline choice element.'

      content = (
        <ChoiceElement
          studioId={studioId}
          element={element}
          attributes={attributes}
        >
          {children}
        </ChoiceElement>
      )
      break
    case ELEMENT_FORMATS.EMBED:
      content = (
        <EmbedElement element={element} attributes={attributes}>
          {children}
        </EmbedElement>
      )
      break
    case ELEMENT_FORMATS.LINK:
      content = (
        <LinkElement element={element} attributes={attributes}>
          {children}
        </LinkElement>
      )
      break
    default:
      content = (
        <p
          draggable="false"
          style={{ textAlign: element.align || ALIGN_TYPE.LEFT }}
          className={_isElementEmptyAndSelected ? styles.empty : ''}
          {...attributes}
        >
          {children}
        </p>
      )
      break
  }

  return element.type === ELEMENT_FORMATS.LI ||
    element.type === ELEMENT_FORMATS.CHARACTER ||
    // an inline void has no block of its own to drag, the same as the two above it
    element.type === ELEMENT_FORMATS.CHOICE ||
    element.type === ELEMENT_FORMATS.LINK ? (
    content
  ) : (
    <DraggableWrapper element={element}>{content}</DraggableWrapper>
  )
}

export default Element
