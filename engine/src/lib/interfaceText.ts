/**
 * Every word the storyteller says that an author did not write.
 *
 * The prose of a storyworld is authored, so it is already in whatever language it
 * is written in. The engine's own words were not: a German world came with an
 * English "Take", "Inventory" and "Restart" around German prose. This is the table
 * of those words and the one place they are declared.
 *
 * **The overrides are per storyworld, not per player.** There is deliberately no
 * language picker: the prose cannot be switched at runtime, so a picker would put
 * German chrome around English prose. The language is a property of the world, and
 * an author writing in two languages writes two storyworlds.
 *
 * Storage is `World.interfaceText`, a sparse map — only the keys an author has
 * actually changed. An absent or blank key falls back to the English below, so a
 * world that ignores the feature is unchanged and a half-finished translation is
 * still readable.
 *
 * Adding a key means adding it to `INTERFACE_TEXT_DEFAULTS` and to a group in
 * `INTERFACE_TEXT_GROUPS`; the editor's manager is generated from those two and
 * needs no edit of its own. **A key removed from the enum leaves its override in
 * every world that set it** — harmless, since nothing reads it, and cheaper than
 * migrating a map of strings.
 */

/**
 * Keys are grouped by where the player meets the word, and are stable strings
 * rather than numbers: they are written into exported storyworlds, so renaming one
 * silently discards whatever an author had translated.
 */
export enum INTERFACE_TEXT_KEY {
  // the object rail, and the verb menu on a tile
  OBJECT_HERE = 'OBJECT_HERE',
  OBJECT_INVENTORY = 'OBJECT_INVENTORY',
  OBJECT_EMPTY = 'OBJECT_EMPTY',
  OBJECT_LOOK_AT = 'OBJECT_LOOK_AT',
  OBJECT_TAKE = 'OBJECT_TAKE',
  OBJECT_USE = 'OBJECT_USE',
  OBJECT_COMBINE_START = 'OBJECT_COMBINE_START',
  OBJECT_COMBINE_WITH = 'OBJECT_COMBINE_WITH',
  OBJECT_COMBINING = 'OBJECT_COMBINING',
  OBJECT_CLEAR = 'OBJECT_CLEAR',

  // the event stream
  STREAM_RESTART = 'STREAM_RESTART',
  STREAM_TITLE_SCREEN = 'STREAM_TITLE_SCREEN',
  STREAM_INPUT_PLACEHOLDER = 'STREAM_INPUT_PLACEHOLDER',
  STREAM_INPUT_YES = 'STREAM_INPUT_YES',
  STREAM_INPUT_NO = 'STREAM_INPUT_NO',
  STREAM_MISSING_PATH = 'STREAM_MISSING_PATH',
  STREAM_NO_OPEN_PATH = 'STREAM_NO_OPEN_PATH',
  STREAM_CHOICES_OPEN = 'STREAM_CHOICES_OPEN',
  STREAM_CHOICES_CLOSE = 'STREAM_CHOICES_CLOSE',

  // the title card
  TITLE_CARD_START = 'TITLE_CARD_START',
  TITLE_CARD_CONTINUE = 'TITLE_CARD_CONTINUE',
  TITLE_CARD_SETTINGS = 'TITLE_CARD_SETTINGS',

  // the settings panel
  SETTINGS_PRESENTATION = 'SETTINGS_PRESENTATION',
  SETTINGS_THEME = 'SETTINGS_THEME',
  SETTINGS_THEME_DARK = 'SETTINGS_THEME_DARK',
  SETTINGS_THEME_LIGHT = 'SETTINGS_THEME_LIGHT',
  SETTINGS_FONT = 'SETTINGS_FONT',
  SETTINGS_FONT_SERIF = 'SETTINGS_FONT_SERIF',
  SETTINGS_FONT_SANS = 'SETTINGS_FONT_SANS',
  SETTINGS_SIZE = 'SETTINGS_SIZE',
  SETTINGS_SIZE_DEFAULT = 'SETTINGS_SIZE_DEFAULT',
  SETTINGS_SIZE_LARGE = 'SETTINGS_SIZE_LARGE',
  SETTINGS_MOTION = 'SETTINGS_MOTION',
  SETTINGS_MOTION_FULL = 'SETTINGS_MOTION_FULL',
  SETTINGS_MOTION_REDUCED = 'SETTINGS_MOTION_REDUCED',
  SETTINGS_WORLD = 'SETTINGS_WORLD',
  SETTINGS_WORLD_TITLE = 'SETTINGS_WORLD_TITLE',
  SETTINGS_WORLD_DESCRIPTION = 'SETTINGS_WORLD_DESCRIPTION',
  SETTINGS_WORLD_STUDIO = 'SETTINGS_WORLD_STUDIO',
  SETTINGS_WORLD_DESIGNER = 'SETTINGS_WORLD_DESIGNER',
  SETTINGS_WORLD_VERSION = 'SETTINGS_WORLD_VERSION',
  SETTINGS_WORLD_COPYRIGHT = 'SETTINGS_WORLD_COPYRIGHT',
  SETTINGS_WORLD_WEBSITE = 'SETTINGS_WORLD_WEBSITE',
  SETTINGS_TOOLS = 'SETTINGS_TOOLS',
  SETTINGS_RESET_WORLD = 'SETTINGS_RESET_WORLD',

  // notifications
  NOTIFICATION_UNKNOWN_ERROR = 'NOTIFICATION_UNKNOWN_ERROR',
  NOTIFICATION_UPDATE_AVAILABLE = 'NOTIFICATION_UPDATE_AVAILABLE',
  NOTIFICATION_UPDATING = 'NOTIFICATION_UPDATING'
}

/** A sparse map of the keys an author has actually translated. */
export type InterfaceTextOverrides = {
  [key in INTERFACE_TEXT_KEY]?: string
}

/**
 * The English the engine has always said, and the fallback for every key.
 *
 * `Record` rather than `Partial<Record>` on purpose: adding a member to the enum
 * without a default here is a compile error rather than a blank button.
 */
export const INTERFACE_TEXT_DEFAULTS: Record<INTERFACE_TEXT_KEY, string> = {
  [INTERFACE_TEXT_KEY.OBJECT_HERE]: 'Here',
  [INTERFACE_TEXT_KEY.OBJECT_INVENTORY]: 'Inventory',
  [INTERFACE_TEXT_KEY.OBJECT_EMPTY]: 'Nothing yet.',
  [INTERFACE_TEXT_KEY.OBJECT_LOOK_AT]: 'Look at',
  [INTERFACE_TEXT_KEY.OBJECT_TAKE]: 'Take',
  [INTERFACE_TEXT_KEY.OBJECT_USE]: 'Use',
  [INTERFACE_TEXT_KEY.OBJECT_COMBINE_START]: 'Combine\u2026',
  [INTERFACE_TEXT_KEY.OBJECT_COMBINE_WITH]: 'Combine with',
  [INTERFACE_TEXT_KEY.OBJECT_COMBINING]: 'Combining',
  [INTERFACE_TEXT_KEY.OBJECT_CLEAR]: 'Cancel',

  [INTERFACE_TEXT_KEY.STREAM_RESTART]: 'Restart',
  [INTERFACE_TEXT_KEY.STREAM_TITLE_SCREEN]: 'Title Screen',
  [INTERFACE_TEXT_KEY.STREAM_INPUT_PLACEHOLDER]: 'Response...',
  [INTERFACE_TEXT_KEY.STREAM_INPUT_YES]: 'Yes',
  [INTERFACE_TEXT_KEY.STREAM_INPUT_NO]: 'No',
  [INTERFACE_TEXT_KEY.STREAM_MISSING_PATH]: 'Missing path.',
  [INTERFACE_TEXT_KEY.STREAM_NO_OPEN_PATH]: 'Open path not found...',
  [INTERFACE_TEXT_KEY.STREAM_CHOICES_OPEN]: 'Choose',
  [INTERFACE_TEXT_KEY.STREAM_CHOICES_CLOSE]: 'Close',

  [INTERFACE_TEXT_KEY.TITLE_CARD_START]: 'Start',
  [INTERFACE_TEXT_KEY.TITLE_CARD_CONTINUE]: 'Continue',
  [INTERFACE_TEXT_KEY.TITLE_CARD_SETTINGS]: 'Settings',

  [INTERFACE_TEXT_KEY.SETTINGS_PRESENTATION]: 'Presentation',
  [INTERFACE_TEXT_KEY.SETTINGS_THEME]: 'Theme',
  [INTERFACE_TEXT_KEY.SETTINGS_THEME_DARK]: 'Dark',
  [INTERFACE_TEXT_KEY.SETTINGS_THEME_LIGHT]: 'Light',
  [INTERFACE_TEXT_KEY.SETTINGS_FONT]: 'Font',
  [INTERFACE_TEXT_KEY.SETTINGS_FONT_SERIF]: 'Serif',
  [INTERFACE_TEXT_KEY.SETTINGS_FONT_SANS]: 'Sans',
  [INTERFACE_TEXT_KEY.SETTINGS_SIZE]: 'Size',
  [INTERFACE_TEXT_KEY.SETTINGS_SIZE_DEFAULT]: 'Default',
  [INTERFACE_TEXT_KEY.SETTINGS_SIZE_LARGE]: 'Large',
  [INTERFACE_TEXT_KEY.SETTINGS_MOTION]: 'Motion',
  [INTERFACE_TEXT_KEY.SETTINGS_MOTION_FULL]: 'Full',
  [INTERFACE_TEXT_KEY.SETTINGS_MOTION_REDUCED]: 'Reduced',
  [INTERFACE_TEXT_KEY.SETTINGS_WORLD]: 'Storyworld',
  [INTERFACE_TEXT_KEY.SETTINGS_WORLD_TITLE]: 'Title',
  [INTERFACE_TEXT_KEY.SETTINGS_WORLD_DESCRIPTION]: 'Description',
  [INTERFACE_TEXT_KEY.SETTINGS_WORLD_STUDIO]: 'Studio',
  [INTERFACE_TEXT_KEY.SETTINGS_WORLD_DESIGNER]: 'Designer',
  [INTERFACE_TEXT_KEY.SETTINGS_WORLD_VERSION]: 'Version',
  [INTERFACE_TEXT_KEY.SETTINGS_WORLD_COPYRIGHT]: 'Copyright',
  [INTERFACE_TEXT_KEY.SETTINGS_WORLD_WEBSITE]: 'Website',
  [INTERFACE_TEXT_KEY.SETTINGS_TOOLS]: 'Tools',
  [INTERFACE_TEXT_KEY.SETTINGS_RESET_WORLD]: 'Reset World',

  [INTERFACE_TEXT_KEY.NOTIFICATION_UNKNOWN_ERROR]: 'Unknown error.',
  [INTERFACE_TEXT_KEY.NOTIFICATION_UPDATE_AVAILABLE]: 'Update available.',
  [INTERFACE_TEXT_KEY.NOTIFICATION_UPDATING]: 'Updating...'
}

/**
 * How the editor's manager lays the keys out.
 *
 * Here rather than in the editor because the grouping is a fact about where the
 * player meets each word, which is knowledge the engine has and the editor does
 * not. `note` is shown under the group and exists for the two groups whose words
 * are not self-evident from their English.
 */
export const INTERFACE_TEXT_GROUPS: {
  title: string
  note?: string
  keys: INTERFACE_TEXT_KEY[]
}[] = [
  {
    title: 'Objects',
    note:
      'The rail beside the story, and the verb menu that opens when a tile is ' +
      'clicked. "Combine with" and "Combining" are each followed by an object\'s ' +
      'name, as in "Combine with Antenna".',
    keys: [
      INTERFACE_TEXT_KEY.OBJECT_HERE,
      INTERFACE_TEXT_KEY.OBJECT_INVENTORY,
      INTERFACE_TEXT_KEY.OBJECT_EMPTY,
      INTERFACE_TEXT_KEY.OBJECT_LOOK_AT,
      INTERFACE_TEXT_KEY.OBJECT_TAKE,
      INTERFACE_TEXT_KEY.OBJECT_USE,
      INTERFACE_TEXT_KEY.OBJECT_COMBINE_START,
      INTERFACE_TEXT_KEY.OBJECT_COMBINE_WITH,
      INTERFACE_TEXT_KEY.OBJECT_COMBINING,
      INTERFACE_TEXT_KEY.OBJECT_CLEAR
    ]
  },
  {
    title: 'Story',
    note:
      'Shown in the event stream. Yes and No are also written into the save as ' +
      'the answer the player gave, so changing them changes what new saves record.',
    keys: [
      INTERFACE_TEXT_KEY.STREAM_RESTART,
      INTERFACE_TEXT_KEY.STREAM_TITLE_SCREEN,
      INTERFACE_TEXT_KEY.STREAM_INPUT_PLACEHOLDER,
      INTERFACE_TEXT_KEY.STREAM_INPUT_YES,
      INTERFACE_TEXT_KEY.STREAM_INPUT_NO,
      INTERFACE_TEXT_KEY.STREAM_MISSING_PATH,
      INTERFACE_TEXT_KEY.STREAM_NO_OPEN_PATH,
      INTERFACE_TEXT_KEY.STREAM_CHOICES_OPEN,
      INTERFACE_TEXT_KEY.STREAM_CHOICES_CLOSE
    ]
  },
  {
    title: 'Title card',
    keys: [
      INTERFACE_TEXT_KEY.TITLE_CARD_START,
      INTERFACE_TEXT_KEY.TITLE_CARD_CONTINUE,
      INTERFACE_TEXT_KEY.TITLE_CARD_SETTINGS
    ]
  },
  {
    title: 'Settings',
    keys: [
      INTERFACE_TEXT_KEY.SETTINGS_PRESENTATION,
      INTERFACE_TEXT_KEY.SETTINGS_THEME,
      INTERFACE_TEXT_KEY.SETTINGS_THEME_DARK,
      INTERFACE_TEXT_KEY.SETTINGS_THEME_LIGHT,
      INTERFACE_TEXT_KEY.SETTINGS_FONT,
      INTERFACE_TEXT_KEY.SETTINGS_FONT_SERIF,
      INTERFACE_TEXT_KEY.SETTINGS_FONT_SANS,
      INTERFACE_TEXT_KEY.SETTINGS_SIZE,
      INTERFACE_TEXT_KEY.SETTINGS_SIZE_DEFAULT,
      INTERFACE_TEXT_KEY.SETTINGS_SIZE_LARGE,
      INTERFACE_TEXT_KEY.SETTINGS_MOTION,
      INTERFACE_TEXT_KEY.SETTINGS_MOTION_FULL,
      INTERFACE_TEXT_KEY.SETTINGS_MOTION_REDUCED,
      INTERFACE_TEXT_KEY.SETTINGS_WORLD,
      INTERFACE_TEXT_KEY.SETTINGS_WORLD_TITLE,
      INTERFACE_TEXT_KEY.SETTINGS_WORLD_DESCRIPTION,
      INTERFACE_TEXT_KEY.SETTINGS_WORLD_STUDIO,
      INTERFACE_TEXT_KEY.SETTINGS_WORLD_DESIGNER,
      INTERFACE_TEXT_KEY.SETTINGS_WORLD_VERSION,
      INTERFACE_TEXT_KEY.SETTINGS_WORLD_COPYRIGHT,
      INTERFACE_TEXT_KEY.SETTINGS_WORLD_WEBSITE,
      INTERFACE_TEXT_KEY.SETTINGS_TOOLS,
      INTERFACE_TEXT_KEY.SETTINGS_RESET_WORLD
    ]
  },
  {
    title: 'Notifications',
    keys: [
      INTERFACE_TEXT_KEY.NOTIFICATION_UNKNOWN_ERROR,
      INTERFACE_TEXT_KEY.NOTIFICATION_UPDATE_AVAILABLE,
      INTERFACE_TEXT_KEY.NOTIFICATION_UPDATING
    ]
  }
]

/**
 * The word to show for a key: the author's, or the English.
 *
 * A **blank** override falls back rather than rendering an empty button, which is
 * what makes clearing a field in the manager mean "use the English" instead of
 * "say nothing". Whitespace counts as blank for the same reason.
 */
export const interfaceText = (
  overrides: InterfaceTextOverrides | undefined,
  key: INTERFACE_TEXT_KEY
): string => overrides?.[key]?.trim() || INTERFACE_TEXT_DEFAULTS[key]

/**
 * Drops the keys that say nothing, so a world stores only what was translated.
 *
 * Called on save rather than on edit, so clearing a field in the manager reverts
 * it to the English *and* stops it being exported. Returns `undefined` for a map
 * with nothing left in it, which keeps the property off the record entirely and
 * out of the exported JSON.
 */
export const pruneInterfaceText = (
  overrides: InterfaceTextOverrides | undefined
): InterfaceTextOverrides | undefined => {
  if (!overrides) return undefined

  const pruned: InterfaceTextOverrides = {}

  ;(Object.keys(overrides) as INTERFACE_TEXT_KEY[]).forEach((key) => {
    const value = overrides[key]?.trim()

    // an override identical to the English is not a translation; storing it means
    // exporting a word the engine already knows, and pins it against a later
    // change to the default
    if (value && value !== INTERFACE_TEXT_DEFAULTS[key]) pruned[key] = value
  })

  return Object.keys(pruned).length > 0 ? pruned : undefined
}
