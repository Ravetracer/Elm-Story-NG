import { BaseEditor, Descendant, Range } from 'slate'
import { ReactEditor } from 'slate-react'
import { ElementId } from './types'

declare module 'slate' {
  interface CustomTypes {
    Editor: EditorType
    Element: EventContentElement
    Text: EventContentLeaf
  }
}

export interface CustomRange extends Range {
  expression?: boolean
  expressionStart?: boolean
  expressionEnd?: boolean
  expressionError?: boolean
}

export type EditorType = BaseEditor & ReactEditor

export type EmptyText = {
  text: ''
}

export type ParagraphElement = {
  type: ELEMENT_FORMATS.P
  align?: ALIGN_TYPE
  children: Descendant[]
}

export type HeadingOneElement = {
  type: ELEMENT_FORMATS.H1
  align?: ALIGN_TYPE
  children: Descendant[]
}

export type HeadingTwoElement = {
  type: ELEMENT_FORMATS.H2
  align?: ALIGN_TYPE
  children: Descendant[]
}

export type HeadingThreeElement = {
  type: ELEMENT_FORMATS.H3
  align?: ALIGN_TYPE
  children: Descendant[]
}

export type HeadingFourElement = {
  type: ELEMENT_FORMATS.H4
  align?: ALIGN_TYPE
  children: Descendant[]
}

export type BlockquoteElement = {
  type: ELEMENT_FORMATS.BLOCKQUOTE
  children: Descendant[]
}

export type OrderedListElement = {
  type: ELEMENT_FORMATS.OL
  children: Descendant[]
}

export type UnorderedListElement = {
  type: ELEMENT_FORMATS.UL
  children: Descendant[]
}

export type ListItemElement = {
  type: ELEMENT_FORMATS.LI
  children: Descendant[]
}

export type CharacterElementTransformType = 'cap' | 'lower' | 'upper'
export type CharacterElementStyleType = 'strong' | 'em' | 'u' | 's'
export type CharacterElementStyleTypes = CharacterElementStyleType[]

export interface CharacterElementDetails {
  character_id?: ElementId // character id
  alias_id?: string // ref id
  transform?: CharacterElementTransformType
  styles?: CharacterElementStyleTypes
}

export type AllowedCharacterDisplayFormatStyles = {
  fontWeight?: 'bold' | 'unset'
  fontStyle?: 'italic' | 'unset'
  textDecoration?:
    | 'underline'
    | 'line-through'
    | 'underline line-through'
    | 'unset'
}

export type CharacterDisplayFormat = {
  text: string
  styles?: AllowedCharacterDisplayFormatStyles
}

export type CharacterElement = {
  type: ELEMENT_FORMATS.CHARACTER
  character_id?: ElementId
  alias_id?: string
  transform?: CharacterElementTransformType
  styles?: CharacterElementStyleTypes
  children: EmptyText[]
}

export type ImageElement = {
  type: ELEMENT_FORMATS.IMG
  asset_id?: string
  children: EmptyText[]
}

/**
 * A choice offered inside the prose rather than in the list beneath it.
 *
 * An inline void carrying nothing but a reference, exactly as `CharacterElement`
 * carries a `character_id`: the choice itself stays a row in the `choices` table
 * where the paths already point at it, so this costs no schema and no migration.
 * The text the player clicks is the choice's own `title`, which is what keeps the
 * sentence, the choice list and the scene map from ever disagreeing about what a
 * choice says.
 */
export type ChoiceElement = {
  type: ELEMENT_FORMATS.CHOICE
  choice_id?: ElementId
  children: EmptyText[]
}

export type EmbedElement = {
  type: ELEMENT_FORMATS.EMBED
  url?: string
  children: EmptyText[]
}

export type LinkElement = {
  type: ELEMENT_FORMATS.LINK
  url?: string
  text?: string
  children: [{ text: string }]
}

export type EventContentElement =
  | ParagraphElement
  | HeadingOneElement
  | HeadingTwoElement
  | HeadingThreeElement
  | HeadingFourElement
  | BlockquoteElement
  | OrderedListElement
  | UnorderedListElement
  | ListItemElement
  | CharacterElement
  | ImageElement
  | ChoiceElement
  | EmbedElement
  | LinkElement

export type EventContentLeaf = {
  text: string
  strong?: boolean
  em?: boolean
  u?: boolean
  s?: boolean
  // Reachable: HOTKEYS binds mod+` to LEAF_FORMATS.CODE, so toggleLeaf can write
  // this mark. EventContentLeaf.tsx does not render it, which makes the mark
  // invisible rather than absent. Declared here because the editor can store it;
  // wiring up the rendering is a separate, unfinished piece of work.
  code?: boolean
  expression?: boolean
  expressionStart?: boolean
  expressionEnd?: boolean
  expressionError?: boolean
}

export enum LEAF_FORMATS {
  STRONG = 'strong',
  CODE = 'code',
  EM = 'em',
  S = 's',
  U = 'u',
  EXPRESSION = 'expression'
}

export enum ELEMENT_FORMATS {
  BLOCKQUOTE = 'blockquote',
  H1 = 'h1',
  H2 = 'h2',
  H3 = 'h3',
  H4 = 'h4',
  IMG = 'img',
  OL = 'ol',
  UL = 'ul',
  LI = 'li',
  P = 'p',
  EMBED = 'embed',
  CHARACTER = 'character',
  CHOICE = 'choice',
  LINK = 'link'
}

export type EventContentNode = EventContentElement & EventContentLeaf

export const SUPPORTED_TEXT_BLOCK_NODE = [
  ELEMENT_FORMATS.P,
  ELEMENT_FORMATS.H1,
  ELEMENT_FORMATS.H2,
  ELEMENT_FORMATS.H3,
  ELEMENT_FORMATS.H4,
  ELEMENT_FORMATS.BLOCKQUOTE,
  ELEMENT_FORMATS.OL,
  ELEMENT_FORMATS.UL
]

export const SUPPORTED_TEXT_NODE = [
  ...SUPPORTED_TEXT_BLOCK_NODE,
  ELEMENT_FORMATS.CHARACTER
]

export const SUPPORTED_ELEMENT_TYPES = [
  ...SUPPORTED_TEXT_BLOCK_NODE,
  ELEMENT_FORMATS.IMG,
  ELEMENT_FORMATS.EMBED,
  ELEMENT_FORMATS.CHARACTER,
  ELEMENT_FORMATS.CHOICE,
  ELEMENT_FORMATS.LINK
]

export enum ALIGN_TYPE {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right'
}

export const SUPPORTED_ALIGN_TYPES = [
  ELEMENT_FORMATS.H1,
  ELEMENT_FORMATS.H1,
  ELEMENT_FORMATS.H3,
  ELEMENT_FORMATS.H4,
  ELEMENT_FORMATS.P
]

export enum HOTKEY_BASIC {
  BACKSPACE = 'BACKSPACE',
  DELETE = 'DELETE',
  ENTER = 'ENTER',
  TAB = 'TAB'
}

export enum HOTKEY_EXPRESSION {
  OPEN_BRACKET = 'OPEN_BRACKET',
  CLOSE_BRACKET = 'CLOSE_BRACKET',
  // Ctrl+Space, the IDE-style "help me here" shortcut: it opens the variable
  // picker at an operand position and the type-aware continuation helper just
  // after an operand. Not bound in HOTKEYS: it is matched on `event.ctrlKey &&
  // event.code === 'Space'` in EventContent's onKeyDown, so it is
  // layout-independent and reliably preventDefault-able.
  OPEN_EXPRESSION_MENU = 'OPEN_EXPRESSION_MENU',
  EXIT = 'EXIT'
}

export enum HOTKEY_SELECTION {
  ALL = 'SELECT_ALL',
  MENU_UP = 'MENU_UP',
  MENU_DOWN = 'MENU_DOWN'
}

export const LIST_TYPES = [ELEMENT_FORMATS.OL, ELEMENT_FORMATS.UL]

export const HOTKEYS: { [hotkey: string]: string } = {
  'mod+b': LEAF_FORMATS.STRONG,
  'mod+i': LEAF_FORMATS.EM,
  'mod+u': LEAF_FORMATS.U,
  'mod+s': LEAF_FORMATS.S,
  'mod+`': LEAF_FORMATS.CODE,
  'mod+a': HOTKEY_SELECTION.ALL,
  enter: HOTKEY_BASIC.ENTER,
  tab: HOTKEY_BASIC.TAB,
  arrowup: HOTKEY_SELECTION.MENU_UP,
  arrowdown: HOTKEY_SELECTION.MENU_DOWN,
  backspace: HOTKEY_BASIC.BACKSPACE,
  delete: HOTKEY_BASIC.DELETE,
  // The `{` expression trigger is NOT bound here. is-hotkey matches by physical
  // keyCode, and a 'shift+[' binding fires on any keyboard whose `[` keyCode is
  // produced by a different character — notably a German layout, where the `?`
  // key (Shift+ß) shares US `[`'s keyCode 219, so `?` was swallowed and replaced
  // with `{  }` (and `shift+]` likewise stole the ` key). `{` is detected by the
  // produced character in EventContent's onKeyDown instead, which is
  // layout-independent. See dev-doc/keyboard.md.
  esc: HOTKEY_EXPRESSION.EXIT
}

export const DEFAULT_EVENT_CONTENT: Descendant[] = [
  {
    type: ELEMENT_FORMATS.P,
    children: [{ text: '' }]
  }
]
