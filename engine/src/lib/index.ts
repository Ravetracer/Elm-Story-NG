import {
  AllowedCharacterDisplayFormatStyles,
  CharacterDisplayFormat,
  CharacterElement,
  CharacterElementStyleTypes,
  CharacterElementTransformType,
  ChoiceElement,
  Descendant,
  ELEMENT_FORMATS,
  EventContentElement,
  EventContentLeaf
} from '../types/eventContentTypes'

import { CHOICE_PRESENTATION, ElementId } from '../types'

export const AUTO_ENGINE_BOOKMARK_KEY = '___auto___'
export const INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY = '___initial___'
export const ENGINE_LIVE_EVENT_LOOPBACK_RESULT_VALUE = '___loopback___'
export const ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE = '___passthrough___'
export const ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE = '___storyover___'
export const DEFAULT_ENGINE_SETTINGS_KEY = '__default__'

export const scrollElementToTop = (element: HTMLElement, smooth?: boolean) =>
  element.scrollIntoView({
    block: 'start',
    behavior: smooth ? 'smooth' : 'auto'
  })

export const getSvgUrl = (svg: string) =>
  `data:image/svg+xml;base64,${btoa(svg)}`

export const capitalizeString = (text: string) =>
  text.replace(
    /(^\w|\s\w)(\S*)/g,
    (_, m1, m2) => m1.toUpperCase() + m2.toLowerCase()
  )

export const getCharacterRefDisplayFormat = (
  text: string,
  transform: CharacterElementTransformType,
  styles?: CharacterElementStyleTypes
): CharacterDisplayFormat => {
  let transText: string = `${text}`,
    _styles: AllowedCharacterDisplayFormatStyles | undefined = undefined

  switch (transform) {
    case 'lower':
      transText = transText.toLowerCase()
      break
    case 'upper':
      transText = transText.toUpperCase()
      break
    case 'cap':
    default:
      transText = capitalizeString(transText)
      break
  }

  if (styles) {
    styles.map((style) => {
      if (!_styles) _styles = {}

      switch (style) {
        case 'strong':
          _styles.fontWeight = 'bold'
          break
        case 'em':
          _styles.fontStyle = 'italic'
          break
        case 'u':
          if (!_styles.textDecoration) {
            _styles.textDecoration = 'underline'
            break
          }

          if (_styles.textDecoration === 'line-through') {
            _styles.textDecoration = 'underline line-through'
            break
          }

          break
        case 's':
          if (!_styles.textDecoration) {
            _styles.textDecoration = 'line-through'
          }

          if (_styles.textDecoration === 'underline') {
            _styles.textDecoration = 'underline line-through'
            break
          }

          break
        default:
          break
      }
    })
  }

  return { text: transText, styles: _styles }
}

export const flattenEventContent = (
  content: Descendant[]
): Array<EventContentLeaf | EventContentElement> => {
  const flatEventContent = content.flatMap((element) => {
    // @ts-ignore
    return element.children
      ? // @ts-ignore
        [element, ...flattenEventContent(element.children)]
      : element
  })

  return flatEventContent
}

export const getCharactersIdsFromEventContent = (children: Descendant[]) =>
  flattenEventContent(children)
    .filter(
      (element): element is CharacterElement =>
        // @ts-ignore
        element.type === ELEMENT_FORMATS.CHARACTER &&
        // @ts-ignore
        element.character_id !== undefined
    )
    .map(({ character_id }) => character_id as string)

/**
 * How this event's choices are offered: the event's own setting, else the
 * storyworld's, else a list.
 *
 * **LIST is the fallback rather than a stored default**, so a storyworld written
 * before either field existed presents exactly as it always did, and clearing both
 * settings returns it there. Neither field is ever written as LIST by the editor for
 * the same reason — "unset" and "list" mean the same thing to a reader and one of
 * them is smaller in every export.
 *
 * **`CHOICE_PRESENTATION.INLINE` is not the inline choices feature**, which is the
 * likeliest confusion in this area. That one is per *choice* and lives in the
 * prose, as a node the author placed inside a sentence. This is per *event* and
 * says how the whole set beneath the prose is laid out — a wrapping row rather than
 * a stack. An enum could not express the other thing: which words in which
 * sentence a choice attaches to is not derivable from a setting.
 */
export const resolveChoicePresentation = (
  eventPresentation?: CHOICE_PRESENTATION,
  worldPresentation?: CHOICE_PRESENTATION
): CHOICE_PRESENTATION =>
  eventPresentation ?? worldPresentation ?? CHOICE_PRESENTATION.LIST

export const getChoiceIdsFromEventContentNodes = (children: Descendant[]) =>
  flattenEventContent(children)
    .filter(
      (element): element is ChoiceElement =>
        // @ts-ignore
        element.type === ELEMENT_FORMATS.CHOICE &&
        // @ts-ignore
        element.choice_id !== undefined
    )
    .map(({ choice_id }) => choice_id as string)

/**
 * Which of an event's choices its prose offers, and so which the list beneath the
 * prose must not offer a second time.
 *
 * **`Event.content` is one field holding two formats, and this is the only thing
 * that has to read both.** In the composer it is the Slate document as written;
 * in an exported world it is the HTML `eventContentToHTML` baked at export time,
 * where a character reference has already become its name. A choice cannot be
 * baked — it has to still be clickable when the player gets there — so it survives
 * export as an empty placeholder span, and the id has to be read back out of
 * whichever of the two shapes arrived.
 *
 * Returns unique ids: the same choice mentioned twice in one event is one choice.
 */
export const getChoiceIdsFromEventContent = (content?: string): ElementId[] => {
  if (!content) return []

  let ids: ElementId[]

  try {
    ids = getChoiceIdsFromEventContentNodes(JSON.parse(content))
  } catch (error) {
    // not a Slate document, so it is the baked HTML an export ships
    ids = [...content.matchAll(/data-choice-id="([^"]*)"/g)]
      .map(([, id]) => id)
      .filter((id) => id && id !== 'undefined')
  }

  return [...new Set(ids)]
}

export const formatNumberFromString = (value: string) => {
  if (value === '-') return '-'

  const parsedAsFloat = parseFloat(value)

  if (Number.isNaN(parsedAsFloat)) return 'ERROR'

  return `${
    Number.isSafeInteger(parsedAsFloat)
      ? parsedAsFloat
      : parsedAsFloat.toFixed(2)
  }`
}
