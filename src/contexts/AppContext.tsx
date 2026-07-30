import React, { useMemo, createContext, useReducer } from 'react'
// the app's release version, which is not the storyworld schema version below
import { version as release } from '../../package.json'
import { StudioId, WorldId, PLATFORM_TYPE } from '../data/types'
import { ZOOM_UI_TYPE } from '../lib/events'
import { DEFAULT_UI_SCALE, loadUIScale, steppedUIScale } from '../lib/uiScale'

interface AppState {
  /** The app's own release version, read from package.json. */
  release: string
  /**
   * The storyworld schema version, not the app's release version: it is passed
   * to getWorldDataJSON as `schemaVersion` and written into an exported world's
   * `_.engine`, which lib/transport/validate looks up in a static schema map.
   *
   * Bumping it without adding the matching entry to that map makes this app
   * refuse to import its own exports, reported as an unsupported schema. It also
   * costs compatibility in one direction only: an older build rejects a file
   * stamped with a version it has never heard of, so a bump should come with a
   * reason. The release version lives in package.json.
   */
  version: string
  build: string
  /** Chromium zoom factor. See lib/uiScale.ts. */
  uiScale: number
  platform?: PLATFORM_TYPE
  fullscreen: boolean
  location: APP_LOCATION
  menuOpen: boolean
  modalOpen: boolean
  selectedStudioId?: StudioId
  selectedWorldId?: WorldId
  visible: boolean
}

export enum APP_ACTION_TYPE {
  PLATFORM = 'PLATFORM',
  FULLSCREEN = 'FULLSCREEN',
  FLOATING = 'FLOATING',
  SET_LOCATION = 'SET_LOCATION',
  MENU_OPEN = 'MENU_OPEN',
  MENU_CLOSE = 'MENU_CLOSE',
  MODAL_OPEN = 'MODAL_OPEN',
  MODAL_CLOSE = 'MODAL_CLOSE',
  STUDIO_SELECT = 'STUDIO_SELECT',
  GAME_SELECT = 'GAME_SELECT',
  SET_VISIBLE = 'SET_VISIBLE',
  SET_UI_SCALE = 'SET_UI_SCALE',
  STEP_UI_SCALE = 'STEP_UI_SCALE'
}

export enum APP_LOCATION {
  DASHBOARD = '/',
  COMPOSER = '/editor'
}

type AppActionType =
  | { type: APP_ACTION_TYPE.PLATFORM; platform: PLATFORM_TYPE }
  | { type: APP_ACTION_TYPE.FULLSCREEN }
  | { type: APP_ACTION_TYPE.FLOATING }
  | { type: APP_ACTION_TYPE.SET_LOCATION; location: APP_LOCATION }
  | { type: APP_ACTION_TYPE.MENU_OPEN }
  | { type: APP_ACTION_TYPE.MENU_CLOSE }
  | { type: APP_ACTION_TYPE.MODAL_OPEN }
  | { type: APP_ACTION_TYPE.MODAL_CLOSE }
  | { type: APP_ACTION_TYPE.STUDIO_SELECT; selectedStudioId?: StudioId }
  | { type: APP_ACTION_TYPE.GAME_SELECT; selectedGameId?: WorldId }
  | { type: APP_ACTION_TYPE.SET_VISIBLE; visible: boolean }
  | { type: APP_ACTION_TYPE.SET_UI_SCALE; uiScale: number }
  | { type: APP_ACTION_TYPE.STEP_UI_SCALE; zoomType: ZOOM_UI_TYPE }

const appReducer = (state: AppState, action: AppActionType): AppState => {
  switch (action.type) {
    case APP_ACTION_TYPE.PLATFORM:
      return {
        ...state,
        platform: action.platform
      }
    case APP_ACTION_TYPE.FULLSCREEN:
      return { ...state, fullscreen: true }
    case APP_ACTION_TYPE.FLOATING:
      return { ...state, fullscreen: false }
    case APP_ACTION_TYPE.SET_LOCATION:
      return { ...state, location: action.location }
    case APP_ACTION_TYPE.MENU_OPEN:
      return { ...state, menuOpen: true }
    case APP_ACTION_TYPE.MENU_CLOSE:
      return { ...state, menuOpen: false }
    case APP_ACTION_TYPE.MODAL_OPEN:
      return { ...state, modalOpen: true }
    case APP_ACTION_TYPE.MODAL_CLOSE:
      return { ...state, modalOpen: false }
    case APP_ACTION_TYPE.STUDIO_SELECT:
      return { ...state, selectedStudioId: action.selectedStudioId }
    case APP_ACTION_TYPE.GAME_SELECT:
      return { ...state, selectedWorldId: action.selectedGameId }
    case APP_ACTION_TYPE.SET_VISIBLE:
      return { ...state, visible: action.visible }
    case APP_ACTION_TYPE.SET_UI_SCALE:
      return { ...state, uiScale: action.uiScale }
    case APP_ACTION_TYPE.STEP_UI_SCALE:
      return {
        ...state,
        uiScale: steppedUIScale(state.uiScale, action.zoomType)
      }
    default:
      return state
  }
}

interface AppContextType {
  app: AppState
  appDispatch: React.Dispatch<AppActionType>
}

// exported for src/__tests__/validateWorldData.test.ts, which holds `version` to
// being a schema this app can actually import
export const defaultAppState: AppState = {
  release,
  version: '0.8.0',
  build: 'd6f6b568',
  uiScale: DEFAULT_UI_SCALE,
  platform: undefined,
  fullscreen: false,
  location: APP_LOCATION.DASHBOARD,
  menuOpen: false,
  modalOpen: false,
  selectedStudioId: undefined,
  selectedWorldId: undefined,
  visible: false
}

export const AppContext = createContext<AppContextType>({
  app: defaultAppState,
  appDispatch: () => {}
})

const AppProvider: React.FC = ({ children }) => {
  // the stored UI scale is read here rather than at module scope so importing
  // this file stays free of side effects
  const [app, appDispatch] = useReducer(appReducer, {
    ...defaultAppState,
    uiScale: loadUIScale()
  })

  return (
    <AppContext.Provider
      value={useMemo(() => ({ app, appDispatch }), [app, appDispatch])}
    >
      {children}
    </AppContext.Provider>
  )
}

export default AppProvider
