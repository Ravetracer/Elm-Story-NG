import { webFrame } from 'electron'

import { ZOOM_UI_TYPE } from './events'

/**
 * The editor's UI scale.
 *
 * Scaling is delegated to Chromium's zoom factor rather than to a font-size
 * variable, because most of the type in this UI is sized by antd's compiled
 * stylesheet: `antd/dist/antd.dark.less` is resolved at build time and its
 * dimensions are absolute pixels, so nothing the app declares at runtime
 * reaches them. A zoom factor scales that CSS along with the app's own.
 *
 * elmstorygames/feedback#284 added the View menu's zoom accelerators, which
 * this replaces from the renderer side: the menu now sends ZOOM_UI and the
 * chosen scale is the one persisted here, so the keyboard and the title bar
 * picker cannot disagree and the choice survives a restart.
 */
export interface UIScale {
  label: string
  scale: number
}

/**
 * Discrete steps on purpose. This is a size picker rather than a continuous
 * zoom, so each entry has to be visibly larger than the one above it — the
 * menu's old 1.2^0.2 level increment moved the type by under 4% per press.
 */
export const UI_SCALES: UIScale[] = [
  { label: 'Small', scale: 0.9 },
  { label: 'Default', scale: 1 },
  { label: 'Large', scale: 1.15 },
  { label: 'Larger', scale: 1.3 },
  { label: 'Largest', scale: 1.5 },
  { label: 'Huge', scale: 1.75 }
]

export const DEFAULT_UI_SCALE = 1

const UI_SCALE_STORAGE_KEY = 'esg-ui-scale'

/**
 * Snaps to a listed scale so exactly one entry in the picker is ever checked,
 * whatever a hand-edited or legacy value says.
 */
export const closestUIScale = (scale: number): number =>
  UI_SCALES.reduce(
    (closest, option) =>
      Math.abs(option.scale - scale) < Math.abs(closest - scale)
        ? option.scale
        : closest,
    DEFAULT_UI_SCALE
  )

export const uiScaleLabel = (scale: number): string =>
  UI_SCALES.find(({ scale: candidate }) => candidate === closestUIScale(scale))
    ?.label ?? 'Default'

export const uiScalePercentage = (scale: number): string =>
  `${Math.round(scale * 100)}%`

export const steppedUIScale = (
  current: number,
  zoomType: ZOOM_UI_TYPE
): number => {
  if (zoomType === ZOOM_UI_TYPE.RESET) return DEFAULT_UI_SCALE

  const currentIndex = UI_SCALES.findIndex(
      ({ scale }) => scale === closestUIScale(current)
    ),
    nextIndex =
      zoomType === ZOOM_UI_TYPE.IN ? currentIndex + 1 : currentIndex - 1

  return UI_SCALES[Math.min(Math.max(nextIndex, 0), UI_SCALES.length - 1)].scale
}

/**
 * localStorage is read defensively because a renderer without it at all is
 * preferable to a renderer that fails to boot over a display preference.
 */
export const loadUIScale = (): number => {
  try {
    const stored = window.localStorage.getItem(UI_SCALE_STORAGE_KEY)

    if (stored === null) return DEFAULT_UI_SCALE

    const parsed = Number.parseFloat(stored)

    return Number.isFinite(parsed) && parsed > 0
      ? closestUIScale(parsed)
      : DEFAULT_UI_SCALE
  } catch {
    return DEFAULT_UI_SCALE
  }
}

export const saveUIScale = (scale: number): void => {
  try {
    window.localStorage.setItem(UI_SCALE_STORAGE_KEY, `${scale}`)
  } catch {
    // a preference that cannot be stored is still applied for this session
  }
}

export const applyUIScale = (scale: number): void =>
  webFrame.setZoomFactor(scale)
