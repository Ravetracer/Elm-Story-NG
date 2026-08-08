export enum WINDOW_EVENT_TYPE {
  FLOAT = 'FLOAT',
  FULLSCREEN = 'FULLSCREEN',
  CLOSE_TAB_OR_WINDOW = 'CLOSE_TAB_OR_WINDOW',
  MINIMIZE = 'MINIMIZE',
  OPEN_EXTERNAL_LINK = 'OPEN_EXTERNAL_LINK',
  PLATFORM = 'PLATFORM',
  QUIT = 'QUIT',
  EXPORT_WORLD_START = 'EXPORT_WORLD_START',
  EXPORT_WORLD_ERROR = 'EXPORT_WORLD_ERROR',
  EXPORT_WORLD_PROCESSING = 'EXPORT_WORLD_PROCESSING',
  EXPORT_WORLD_COMPLETE = 'EXPORT_WORLD_COMPLETE',
  IMPORT_WORLD_GET_JSON = 'IMPORT_WORLD_GET_JSON',
  IMPORT_WORLD_ASSETS = 'IMPORT_WORLD_ASSETS',
  TOGGLE_FULLSCREEN = 'TOGGLE_FULLSCREEN',
  SAVE_ASSET = 'SAVE_ASSET',
  RESTORE_ASSET = 'RESTORE_ASSET',
  REMOVE_ASSET = 'REMOVE_ASSET',
  REMOVE_ASSETS = 'REMOVE_ASSETS',
  GET_ASSET = 'GET_ASSET',
  LIST_ASSETS = 'LIST_ASSETS',
  ZOOM_UI = 'ZOOM_UI',
  OPEN_HELP = 'OPEN_HELP'
}

/**
 * Declared here rather than in menu.ts because both sides of ZOOM_UI compare
 * against it: the View menu sends it and the renderer steps its UI scale by it.
 * Two separately declared string enums are not assignable to one another in
 * TypeScript even with identical members.
 */
export enum ZOOM_UI_TYPE {
  IN = 'IN',
  OUT = 'OUT',
  RESET = 'RESET'
}
