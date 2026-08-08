import logger from '../../../lib/logger'
import {
  deleteAll,
  getCharactersIdsFromEventContent,
  getElement,
  getImageIdsFromEventContent,
  isElementActive,
  isElementEmpty,
  isLeafActive,
  showCommandMenu,
  syncCharactersFromEventContentToEventData,
  syncImagesFromEventContentToEventData,
  toggleElement,
  toggleLeaf
} from '../../../lib/contentEditor'

import { ipcRenderer } from 'electron'
import { v4 as uuid } from 'uuid'

import { debounce, isEqual } from 'lodash'
import useEventListener from '@use-it/event-listener'
import isHotkey from 'is-hotkey'

import { getTemplateExpressionRanges } from '../../../lib/templates'

import React, { useState, useEffect, useCallback, useContext } from 'react'

import { WINDOW_EVENT_TYPE } from '../../../lib/events'
import {
  ElementId,
  ELEMENT_TYPE,
  PLATFORM_TYPE,
  Scene,
  StudioId
} from '../../../data/types'
import {
  CustomRange,
  HOTKEY_EXPRESSION,
  HOTKEYS,
  LEAF_FORMATS,
  HOTKEY_SELECTION,
  HOTKEY_BASIC,
  ELEMENT_FORMATS,
  SUPPORTED_ELEMENT_TYPES,
  CharacterElement,
  ChoiceElement,
  ImageElement,
  DEFAULT_EVENT_CONTENT
} from '../../../data/eventContentTypes'

import { DragStart, DropResult } from 'react-beautiful-dnd'

import { CompressOutlined, ExpandOutlined } from '@ant-design/icons'

import { useEvent } from '../../../hooks'

import { AppContext } from '../../../contexts/AppContext'
import {
  ComposerContext,
  COMPOSER_ACTION_TYPE
} from '../../../contexts/ComposerContext'

import {
  createEditor,
  Editor,
  Transforms,
  Text,
  BaseSelection,
  BaseRange
} from 'slate'
import {
  Slate as SlateContext,
  Editable,
  withReact,
  ReactEditor,
  RenderElementProps,
  RenderLeafProps
} from 'slate-react'
import { withHistory } from 'slate-history'

import {
  withCorrectVoidBehavior,
  withImages,
  withAlignReset,
  withElementReset,
  withCharacters,
  withChoices,
  withLinks
} from '../../../lib/contentEditor/plugins'

import DragDropWrapper from '../../DragDropWrapper'
import EventContentElement from './EventContentElement'
import EventContentLeaf from './EventContentLeaf'
import CommandMenu from './Tools/CommandMenu'
import EventContentToolbar from './EventContentToolbar'

import api from '../../../api'

import styles from './styles.module.less'

const saveContent = debounce(
  async (studioId: StudioId, eventId: ElementId, content) => {
    await api().events.saveEventContent(studioId, eventId, content)
  },
  1000
)

const defaultCommandMenuProps = {
  show: false,
  filter: undefined,
  target: undefined,
  index: 0
}

/**
 * Free of the content editor's own bindings (`mod+b/i/u/s/\``, `mod+a`, the
 * bracket keys) and of the app menu's (`mod+alt+=/-/0`, `mod+r/w/o`). Declared
 * once so the binding and the label in the header cannot drift apart.
 */
const DISTRACTION_FREE_HOTKEY = 'mod+shift+f'

const EventContent: React.FC<{
  studioId: StudioId
  scene: Scene
  eventId: ElementId
  onClose: () => void
}> = ({ studioId, scene, eventId, onClose }) => {
  const event = useEvent(studioId, eventId, [studioId, eventId])

  // https://github.com/ianstormtaylor/slate/commit/1b0e7c6b928865cb4fd656b6f922e30fbe72d77a
  const [editor] = useState<ReactEditor>(() =>
    withCharacters(
      withChoices(
        withImages(
          // withEmbeds(
          withLinks(
            withElementReset(
              withAlignReset(
                withCorrectVoidBehavior(withReact(withHistory(createEditor())))
              )
            )
          )
          // )
        )
      )
    )
  )

  const { app } = useContext(AppContext),
    { composer, composerDispatch } = useContext(ComposerContext)

  const [selectedExpression, setSelectedExpression] = useState({
      isInside: false,
      outsideOffset: 0
    }),
    // https://github.com/ianstormtaylor/slate/issues/2500
    [isAllSelected, setIsAllSelected] = useState(false),
    [commandMenuProps, setCommandMenuProps] = useState<{
      show: boolean
      filter: string | undefined
      target: BaseRange | undefined
      index: number
    }>(defaultCommandMenuProps),
    [totalCommandMenuItems, setTotalCommandMenuItems] = useState(0),
    [selectedCommandMenuItem, setSelectedCommandMenuItem] = useState<
      string | undefined
    >(undefined),
    [ready, setReady] = useState(false),
    // so we know what images and characters have been removed
    [characterCache, setCharacterCache] = useState<string[]>([]),
    [imageCache, setImageCache] = useState<string[]>([])

  const debounceSaveContent = useCallback(
    (content) => saveContent(studioId, eventId, content),
    [studioId, eventId]
  )

  const renderElement = useCallback(
    (props: RenderElementProps) => {
      return (
        <EventContentElement
          studioId={studioId}
          worldId={scene.worldId}
          eventId={eventId}
          /*
           * Pointing an inline choice node at a choice — an existing one, or one
           * created on the spot.
           *
           * The writes live here rather than in the picker for the reason the
           * character and image handlers do: the component in `Tools` reports what
           * the author chose and this owns the document and the database. Creating
           * makes the pair `EventNode`'s add-choice button makes — the ref on the
           * event, then the row — and sets the node only after both, because an id
           * in the document naming a row that failed to save is the one state with
           * no way back.
           */
          onChoiceSelect={
            props.element.type === ELEMENT_FORMATS.CHOICE
              ? async (selection) => {
                  const choiceElementPath = ReactEditor.findPath(
                    editor,
                    props.element
                  )

                  if (selection.type === 'REMOVE') {
                    // the choice itself survives: removing the node un-inlines it,
                    // and the list beneath the prose offers it again
                    Transforms.removeNodes(editor, { at: choiceElementPath })

                    logger.info(`remove inline choice from event '${eventId}'`)

                    ReactEditor.focus(editor)

                    return
                  }

                  let choiceId: ElementId | undefined

                  if (selection.type === 'EXISTING') {
                    choiceId = selection.choiceId
                  }

                  if (selection.type === 'NEW') {
                    if (!event?.id || !event.choices) return

                    const newChoiceId = uuid()

                    try {
                      await api().events.saveChoiceRefsToEvent(
                        studioId,
                        event.id,
                        [...event.choices, newChoiceId]
                      )

                      await api().choices.saveChoice(studioId, {
                        id: newChoiceId,
                        worldId: event.worldId,
                        eventId: event.id,
                        title: `Choice ${event.choices.length + 1}`,
                        tags: []
                      })

                      choiceId = newChoiceId
                    } catch (error) {
                      throw error
                    }
                  }

                  if (!choiceId) return

                  Transforms.setNodes<ChoiceElement>(
                    editor,
                    { choice_id: choiceId },
                    { at: choiceElementPath }
                  )

                  logger.info(
                    `point inline choice at '${choiceId}' in event '${eventId}'`
                  )

                  ReactEditor.focus(editor)
                }
              : undefined
          }
          onCharacterSelect={
            props.element.type === ELEMENT_FORMATS.CHARACTER
              ? (character, remove) => {
                  const characterElementPath = ReactEditor.findPath(
                    editor,
                    props.element
                  )

                  if (!remove && character) {
                    const {
                      character_id,
                      alias_id,
                      transform,
                      styles
                    } = character

                    Transforms.setNodes<CharacterElement>(
                      editor,
                      {
                        character_id,
                        alias_id,
                        transform,
                        styles
                      },
                      { at: characterElementPath }
                    )

                    character &&
                      logger.info(
                        `add character '${character_id}' alias '${alias_id}' to event '${eventId}'`
                      )

                    !character &&
                      logger.info(`reset character from event '${eventId}`)

                    Transforms.select(
                      editor,
                      Editor.end(editor, characterElementPath)
                    )
                  }

                  if (remove) {
                    Transforms.removeNodes(editor, { at: characterElementPath })

                    logger.info(`remove character from event '${eventId}`)
                  }

                  ReactEditor.focus(editor)
                  Transforms.move(editor)
                }
              : undefined
          }
          onImageSelect={
            props.element.type === ELEMENT_FORMATS.IMG
              ? async (image) => {
                  if (event?.id && image?.data) {
                    const imageElementPath = ReactEditor.findPath(
                      editor,
                      props.element
                    )

                    const assetId: string = uuid()

                    try {
                      const promises: Promise<any>[] = []

                      promises.push(
                        ipcRenderer.invoke(WINDOW_EVENT_TYPE.SAVE_ASSET, {
                          studioId,
                          worldId: event.worldId,
                          id: assetId,
                          data: await image.data.arrayBuffer(),
                          ext: 'webp'
                        })
                      )

                      if (!event.images.includes(assetId)) {
                        promises.push(
                          api().events.saveEvent(studioId, {
                            ...event,
                            images: [...event.images, assetId]
                          })
                        )
                      }

                      await Promise.all(promises)

                      Transforms.setNodes<ImageElement>(
                        editor,
                        {
                          asset_id: assetId
                        },
                        { at: imageElementPath }
                      )

                      // Transforms.select(
                      //   editor,
                      //   Editor.start(editor, imageElementPath)
                      // )

                      ReactEditor.focus(editor)
                      Transforms.move(editor)
                    } catch (error) {
                      throw error
                    }
                  }
                }
              : undefined
          }
          /*
           * Assigning an image the storyworld already has. The same two writes as
           * above minus the file: the id goes into Event.images and onto the IMG
           * node, because the content editor's debounced save reconciles the two
           * and would drop an id the document does not carry.
           *
           * The image this node was showing is not removed here. That is
           * syncImagesFromEventContentToEventData's job on the next content save,
           * which counts every event before trashing anything.
           */
          onImageAssetSelect={
            props.element.type === ELEMENT_FORMATS.IMG
              ? async (assetId) => {
                  if (!event?.id) return

                  const imageElementPath = ReactEditor.findPath(
                    editor,
                    props.element
                  )

                  try {
                    if (!event.images.includes(assetId)) {
                      await api().events.saveEvent(studioId, {
                        ...event,
                        images: [...event.images, assetId]
                      })
                    }

                    Transforms.setNodes<ImageElement>(
                      editor,
                      { asset_id: assetId },
                      { at: imageElementPath }
                    )

                    ReactEditor.focus(editor)
                    Transforms.move(editor)
                  } catch (error) {
                    throw error
                  }
                }
              : undefined
          }
          {...props}
        />
      )
    },
    [editor, eventId, event]
  )

  const renderLeaf = useCallback(
    (props: RenderLeafProps) => <EventContentLeaf {...props} />,
    []
  )

  const decorate = useCallback(([node, path]) => {
    const ranges: CustomRange[] = []

    if (!Text.isText(node)) return ranges

    const expressionRanges = getTemplateExpressionRanges(node.text)

    expressionRanges.map((range) => {
      ranges.push({
        expressionStart: true,
        anchor: { path, offset: range.start },
        focus: { path, offset: range.start + 1 }
      })

      ranges.push({
        expression: true,
        anchor: { path, offset: range.start },
        focus: { path, offset: range.end }
      })

      ranges.push({
        expressionEnd: true,
        anchor: { path, offset: range.end - 1 },
        focus: { path, offset: range.end }
      })
    })

    return ranges
  }, [])

  const moveElement = useCallback((result: DropResult) => {
    composerDispatch({
      type: COMPOSER_ACTION_TYPE.SET_DRAGGABLE_EVENT_CONTENT_ELEMENT,
      id: null
    })

    if (result.destination?.index !== undefined) {
      Transforms.moveNodes(editor, {
        at: [result.source.index],
        to: [result.destination.index]
      })
    }
  }, [])

  const setDraggableId = useCallback((initial: DragStart) => {
    composerDispatch({
      type: COMPOSER_ACTION_TYPE.SET_DRAGGABLE_EVENT_CONTENT_ELEMENT,
      id: initial.draggableId
    })
  }, [])

  /**
   * The Composer route hides its panels while distraction-free mode is active,
   * and it has no other way to know a content editor is open — this component is
   * mounted by the SceneMap, two levels below it. Reporting the close is what
   * brings the chrome back rather than leaving the author with no panels and
   * nothing to write in.
   */
  useEffect(() => {
    composerDispatch({ type: COMPOSER_ACTION_TYPE.CONTENT_EDITOR_OPENED })

    return () => {
      /*
       * The last second of typing is otherwise lost. `saveContent` is debounced
       * at 1000ms, so closing an event — or switching to another one, which
       * remounts this component — discarded anything typed since the last time
       * the timer fired. Flushing invokes it with the arguments it was last
       * called with, which name the event being left rather than the one being
       * opened.
       */
      saveContent.flush()

      composerDispatch({ type: COMPOSER_ACTION_TYPE.CONTENT_EDITOR_CLOSED })
    }
  }, [])

  const toggleDistractionFreeMode = () =>
    composerDispatch({
      type: COMPOSER_ACTION_TYPE.TOGGLE_DISTRACTION_FREE_MODE
    })

  const close = () => {
    if (composer.selectedWorldOutlineElement.id === scene.id || !scene.id)
      onClose()
  }

  const processCommandMenuOperation = useCallback(
    (item: string) => {
      commandMenuProps.target &&
        Transforms.delete(editor, { at: commandMenuProps.target })

      setCommandMenuProps(defaultCommandMenuProps)

      if (SUPPORTED_ELEMENT_TYPES.includes(item as ELEMENT_FORMATS)) {
        if (item === ELEMENT_FORMATS.CHARACTER) {
          Transforms.insertNodes(editor, {
            type: ELEMENT_FORMATS.CHARACTER,
            children: [{ text: '' }],
            transform: 'cap'
          })

          Transforms.deselect(editor)

          return
        }

        if (item === ELEMENT_FORMATS.CHOICE) {
          /*
           * Inserted **unassigned**, and nothing is written until the author picks
           * from the chip's menu — which is the same shape the character reference
           * has, and here it is what makes the common case possible at all: an
           * inline choice is most often an *existing* choice being moved out of the
           * list and into the sentence for the reading flow. Creating one on insert
           * would mean every such move left a stray choice behind.
           */
          Transforms.insertNodes(editor, {
            type: ELEMENT_FORMATS.CHOICE,
            children: [{ text: '' }]
          })

          Transforms.deselect(editor)

          return
        }

        if (item === ELEMENT_FORMATS.IMG) {
          const {
            element: previousElement,
            path: previousElementPath
          } = getElement(editor)

          if (
            previousElement &&
            previousElementPath &&
            isElementEmpty(previousElement)
          ) {
            Transforms.setNodes(
              editor,
              {
                type: ELEMENT_FORMATS.IMG,
                children: [{ text: '' }]
              },
              { at: previousElementPath }
            )

            return
          }

          Transforms.insertNodes(editor, {
            type: ELEMENT_FORMATS.IMG,
            children: [{ text: '' }]
          })

          return
        }

        toggleElement(
          editor,
          item as ELEMENT_FORMATS,
          isElementActive(editor, item as ELEMENT_FORMATS)
        )
      }
    },
    // `event` is here for the inline choice branch, which reads `event.choices` to
    // append to it: a stale copy would drop every ref added since this callback was
    // built, and `Event.choices` is replaced wholesale by the write
    [editor, commandMenuProps.target, studioId, event]
  )

  const processHotkey = useCallback(
    (hotkey: string) => {
      let selection: BaseSelection | undefined = undefined

      switch (hotkey) {
        case 'strong':
        case 'em':
        case 'u':
        case 's':
          toggleLeaf(
            editor,
            hotkey as LEAF_FORMATS,
            isLeafActive(editor, hotkey as LEAF_FORMATS)
          )
          return
        case 'mod+`':
          return
        case HOTKEY_BASIC.BACKSPACE:
        case HOTKEY_BASIC.DELETE:
          deleteAll(editor)
          setIsAllSelected(false)
          return
        case HOTKEY_EXPRESSION.OPEN_BRACKET:
          if (selectedExpression.isInside) return

          selection = editor.selection

          if (selection) {
            Transforms.insertText(editor, '{  }')

            // TODO: stack hack
            setTimeout(
              () =>
                Transforms.move(editor, {
                  distance: 2,
                  unit: 'offset',
                  reverse: true
                }),
              1
            )
          }

          return
        case HOTKEY_SELECTION.MENU_UP:
          if (
            commandMenuProps.show &&
            totalCommandMenuItems > 0 &&
            commandMenuProps.index > 0 &&
            commandMenuProps.index + 1 <= totalCommandMenuItems
          ) {
            setCommandMenuProps({
              ...commandMenuProps,
              index: commandMenuProps.index - 1
            })
          }

          return
        case HOTKEY_SELECTION.MENU_DOWN:
          if (
            commandMenuProps.show &&
            totalCommandMenuItems > 0 &&
            commandMenuProps.index >= 0 &&
            commandMenuProps.index + 1 < totalCommandMenuItems
          ) {
            setCommandMenuProps({
              ...commandMenuProps,
              index: commandMenuProps.index + 1
            })
          }

          return
        case HOTKEY_BASIC.TAB:
        case HOTKEY_BASIC.ENTER:
          if (commandMenuProps.show && selectedCommandMenuItem) {
            processCommandMenuOperation(selectedCommandMenuItem)
          }

          return
        case HOTKEY_EXPRESSION.EXIT:
          if (selectedExpression.isInside) {
            Transforms.move(editor, {
              distance: selectedExpression.outsideOffset,
              unit: 'offset'
            })
          }

          return
        case 'esc':
          if (commandMenuProps.show) {
            setCommandMenuProps(defaultCommandMenuProps)

            return
          }

          // one layer at a time: the command menu above, then the mode, then the
          // editor itself, so a single press never discards more than one thing.
          // This exits without clearing the preference, so escaping out and
          // opening the next event writes distraction-free again.
          if (composer.distractionFreeMode.active) {
            composerDispatch({
              type: COMPOSER_ACTION_TYPE.EXIT_DISTRACTION_FREE_MODE
            })

            return
          }

          close()
          return
        default:
          break
      }
    },
    [
      editor,
      isAllSelected,
      commandMenuProps,
      totalCommandMenuItems,
      selectedCommandMenuItem,
      // without this the escape branch reads the mode as it was on mount and
      // closes the editor instead of stepping out of distraction-free
      composer.distractionFreeMode.active
    ]
  )

  useEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event) {
        // handled here rather than in HOTKEYS, which Editable only consults
        // while the caret is in the text: the toggle has to work after a click
        // on the empty field beside the writing column too
        if (isHotkey(DISTRACTION_FREE_HOTKEY, event)) {
          event.preventDefault()

          toggleDistractionFreeMode()

          return
        }

        switch (event.key) {
          case 'Escape':
            // processHotkey('esc') steps out one layer at a time — the command
            // menu first, then distraction-free mode, then the editor — so the
            // command menu is dismissed before anything else, which is what the
            // original note here asked for.
            processHotkey('esc')
            break
          default:
            break
        }
      }
    },
    document
  )

  useEffect(() => {
    const { selection } = editor

    if (selection) {
      const node = getElement(editor)

      let foundInsideExpression = false

      if (node.element?.children[0] && Text.isText(node.element.children[0])) {
        const expressionRanges = getTemplateExpressionRanges(
          node.element?.children[0].text
        )

        expressionRanges.map((range) => {
          if (
            selection.anchor.offset > range.start &&
            selection.anchor.offset < range.end
          ) {
            setSelectedExpression({
              isInside: true,
              outsideOffset: range.end - selection.anchor.offset
            })

            foundInsideExpression = true

            return
          }
        })
      }

      !foundInsideExpression &&
        setSelectedExpression({ isInside: false, outsideOffset: 0 })
    }
  }, [editor.selection])

  useEffect(() => {
    logger.info(`EventContent->isAllSelected->${isAllSelected}`)
  }, [isAllSelected])

  useEffect(() => {
    if (ready && event && event.id !== eventId) setReady(false)

    if (!ready && editor && event && event.id === eventId) {
      ReactEditor.deselect(editor)

      // TODO: stack hack
      setTimeout(() => {
        Transforms.select(editor, Editor.end(editor, []))
        ReactEditor.focus(editor)
      }, 1)
    }
  }, [ready, editor, event, eventId])

  useEffect(() => {
    !commandMenuProps.show && setSelectedCommandMenuItem(undefined)
  }, [commandMenuProps.show])

  useEffect(() => {
    if (event?.id !== composer.selectedSceneMapEvent) {
      setCommandMenuProps(defaultCommandMenuProps)
    }
  }, [composer.selectedSceneMapEvent])

  // if a character is deleted, the event content will be updated manually
  // another way to do this is like removing components; composer action
  // which is probably faster than constantly parsing and comparing
  useEffect(() => {
    if (composer.removedElement.type === ELEMENT_TYPE.CHARACTER) {
      logger.info(
        `EventContent->useEffect->composer.removedElement->character->${composer.removedElement.id}`
      )

      composerDispatch({
        type: COMPOSER_ACTION_TYPE.ELEMENT_REMOVE,
        removedElement: { id: undefined, type: undefined }
      })
    }
  }, [composer.removedElement])

  // syncs event content and event characters array
  // from adding and removing characters via content editor
  // elmstorygames/feedback#217
  useEffect(() => {
    async function syncData() {
      if (!event?.id) return

      // TODO: combine
      const charactersToRemainById = getCharactersIdsFromEventContent(editor),
        imagesToRemainById = getImageIdsFromEventContent(editor)

      let content: string | undefined = undefined

      if (!isEqual(characterCache, charactersToRemainById)) {
        logger.info(
          `EventContent->useEffect->event.characters,editor.children->syncCharacters`
        )

        content = JSON.stringify(editor.children)

        await syncCharactersFromEventContentToEventData(
          studioId,
          event.id,
          content,
          charactersToRemainById
        )

        setCharacterCache(charactersToRemainById)
      }

      if (!isEqual(imageCache, imagesToRemainById)) {
        const imagesToRemoveById =
          imagesToRemainById.length === 0
            ? imageCache
            : imageCache.filter((id) => !imagesToRemainById.includes(id))

        await syncImagesFromEventContentToEventData(
          studioId,
          event.id,
          content || JSON.stringify(editor.children),
          imagesToRemainById,
          imagesToRemoveById
        )

        setImageCache(imagesToRemainById)
      }
    }

    syncData()
  }, [event?.id, editor.children, characterCache, imageCache])

  return (
    <>
      {event && (
        <div
          className={`${styles.EventContent} ${
            composer.distractionFreeMode.active ? styles.distractionFree : ''
          }`}
          onClick={() =>
            composer.selectedWorldOutlineElement.id !== scene.id &&
            composerDispatch({
              type: COMPOSER_ACTION_TYPE.WORLD_OUTLINE_SELECT,
              selectedWorldOutlineElement: {
                expanded: true,
                id: scene.id,
                title: scene.title,
                type: ELEMENT_TYPE.SCENE
              }
            })
          }
        >
          <div className={`${styles.contentContainer}`}>
            {/*
             * The authors left this header commented out. It is restored because
             * distraction-free mode needs a visible way in and out — the View
             * menu carrying the shortcut is never rendered on a frameless
             * window — and because it answers which event is being edited, which
             * the overlay otherwise hides.
             */}
            <div className={styles.eventTitle}>
              <span className={styles.titleText}>
                {scene.title} | {event.title}
              </span>

              <div
                className={styles.distractionFreeButton}
                title={`${
                  composer.distractionFreeMode.active ? 'Exit' : 'Enter'
                } distraction-free mode (${
                  app.platform === PLATFORM_TYPE.MACOS ? 'Cmd' : 'Ctrl'
                }+Shift+F)`}
                onClick={toggleDistractionFreeMode}
              >
                {composer.distractionFreeMode.active ? (
                  <CompressOutlined />
                ) : (
                  <ExpandOutlined />
                )}
              </div>
            </div>

            <SlateContext
              editor={editor}
              // https://github.com/ianstormtaylor/slate/pull/4540
              value={JSON.parse(event.content)}
              onChange={(newContent) => {
                if (!ready) setReady(true)

                if (ready) {
                  const [show, filter, target] = showCommandMenu(editor)

                  setCommandMenuProps({ show, filter, target, index: 0 })

                  saveContent.cancel()

                  // elmstorygames/feedback#216
                  if (newContent.length === 0) {
                    editor.children = [...DEFAULT_EVENT_CONTENT]

                    Transforms.select(editor, Editor.start(editor, []))

                    ReactEditor.focus(editor)
                    Transforms.move(editor)

                    return
                  }

                  debounceSaveContent(newContent)
                }
              }}
            >
              <CommandMenu
                {...commandMenuProps}
                onItemTotal={(total) => setTotalCommandMenuItems(total)}
                onItemSelect={(item) => setSelectedCommandMenuItem(item)}
                onItemClick={(item) => processCommandMenuOperation(item)}
              />
              <EventContentToolbar />

              <DragDropWrapper
                onBeforeDragStart={setDraggableId}
                onDragEnd={moveElement}
              >
                <Editable
                  className={styles.editable}
                  // The two trigger characters have no other visible cue; the
                  // empty-event placeholder is where a new author sees them.
                  placeholder="Type / for commands, or { to insert a variable…"
                  renderElement={renderElement}
                  renderLeaf={renderLeaf}
                  decorate={decorate}
                  onKeyDown={(_event) => {
                    /*
                     * The `{` expression trigger is matched on the produced
                     * character, not through the is-hotkey/keyCode loop below.
                     * is-hotkey matches by physical keyCode, so the old
                     * 'shift+[' binding fired for the German `?` key (Shift+ß,
                     * same keyCode as US `[`) — swallowing `?` and inserting
                     * `{  }`, and stealing `` ` `` via 'shift+]'. `event.key` is
                     * the resolved character on every layout, so `{` auto-pairs
                     * and `?`/`` ` `` type normally. dev-doc/keyboard.md.
                     */
                    if (_event.key === '{') {
                      _event.preventDefault()
                      processHotkey(HOTKEY_EXPRESSION.OPEN_BRACKET)
                      setIsAllSelected(false)

                      return
                    }

                    for (const hotkey in HOTKEYS) {
                      if (isHotkey(hotkey, _event)) {
                        if (
                          (!commandMenuProps.show ||
                            totalCommandMenuItems === 0) &&
                          (HOTKEYS[hotkey] === HOTKEY_BASIC.ENTER ||
                            HOTKEYS[hotkey] === HOTKEY_BASIC.TAB ||
                            HOTKEYS[hotkey] === HOTKEY_SELECTION.MENU_UP ||
                            HOTKEYS[hotkey] === HOTKEY_SELECTION.MENU_DOWN)
                        ) {
                          if (HOTKEYS[hotkey] === HOTKEY_BASIC.TAB) {
                            _event.preventDefault()

                            selectedExpression.isInside &&
                              Transforms.move(editor, {
                                distance: selectedExpression.outsideOffset,
                                unit: 'offset'
                              })
                          }

                          return
                        }

                        if (HOTKEYS[hotkey] === HOTKEY_SELECTION.ALL) {
                          setIsAllSelected(!isAllSelected)
                          return
                        }

                        if (
                          (HOTKEYS[hotkey] === HOTKEY_BASIC.BACKSPACE ||
                            HOTKEYS[hotkey] === HOTKEY_BASIC.DELETE) &&
                          !isAllSelected
                        ) {
                          return
                        }

                        _event.preventDefault()

                        processHotkey(HOTKEYS[hotkey])
                      }

                      setIsAllSelected(false)
                    }
                  }}
                />

                {/* <code
                  style={{
                    userSelect: 'all',
                    position: 'absolute',
                    bottom: -400
                    // display: 'none'
                  }}
                >
                  {parse(eventContentToPreview(event.content).text || '')}
                </code> */}
              </DragDropWrapper>
            </SlateContext>
          </div>
        </div>
      )}
    </>
  )
}

EventContent.displayName = 'EventContent'

export default EventContent
