import React, { useMemo, useState } from 'react'

import { debounce } from 'lodash'

import { StudioId, World, WorldThemeColors } from '../../../data/types'

import { Switch } from 'antd'

import api from '../../../api'

import styles from './styles.module.less'

/**
 * The author's overrides of the engine's base theme colours. Each layers on top
 * of the player's chosen theme (BOOK or CONSOLE) rather than replacing it, so an
 * unset colour keeps the theme's token — which is why every row can be switched
 * off, storing `undefined` for that field.
 *
 * The panel writes immediately (debounced), not through the metadata form's Save
 * beside it, for the same reason the cover picker does: the choice is made in the
 * control itself and a second Save reads as it not having worked. The whole map
 * is stored `undefined` when nothing is overridden, so a world reverts to plain
 * theme colours and stops exporting the field.
 *
 * Keyed on `world.id` where it is rendered, so switching storyworlds remounts it
 * with the new world's colours rather than carrying the previous one's.
 */
const ROWS: {
  key: keyof WorldThemeColors
  label: string
  /** A sensible starting colour when the row is first switched on. */
  fallback: string
}[] = [
  { key: 'background', label: 'Background', fallback: '#1a1a1a' },
  { key: 'text', label: 'Text', fallback: '#f2f2f2' },
  { key: 'accent', label: 'Accent', fallback: '#7c4dff' }
]

const WorldColors: React.FC<{ studioId: StudioId; world: World }> = ({
  studioId,
  world
}) => {
  const [colors, setColors] = useState<WorldThemeColors>(
    world.themeColors ?? {}
  )

  // Debounced so dragging the native picker does not write per pixel. Re-reads
  // the row inside the save, since the metadata form beside it writes the same
  // record; an empty map is stored `undefined`.
  const persist = useMemo(
    () =>
      debounce(async (next: WorldThemeColors) => {
        if (!world.id) return

        const themeColors = Object.keys(next).length ? next : undefined

        await api().worlds.saveWorld(studioId, {
          ...(await api().worlds.getWorld(studioId, world.id)),
          themeColors
        })
      }, 400),
    [studioId, world.id]
  )

  const update = (next: WorldThemeColors) => {
    setColors(next)
    persist(next)
  }

  return (
    <div className={styles.colors}>
      {ROWS.map(({ key, label, fallback }) => {
        const value = colors[key]
        const enabled = value !== undefined

        return (
          <div className={styles.colorRow} key={key}>
            <Switch
              size="small"
              checked={enabled}
              onChange={(on) => {
                const next = { ...colors }

                if (on) next[key] = fallback
                else delete next[key]

                update(next)
              }}
            />

            <span className={styles.colorLabel}>{label}</span>

            <input
              type="color"
              className={styles.colorSwatch}
              disabled={!enabled}
              value={value ?? fallback}
              onChange={(event) =>
                update({ ...colors, [key]: event.target.value })
              }
            />
          </div>
        )
      })}

      <div className={styles.colorsHint}>
        Layered over the player's theme, so a colour you leave off keeps the
        theme's own. Set the background and text together, or one may sit poorly
        against the other's theme.
      </div>
    </div>
  )
}

WorldColors.displayName = 'WorldColors'

export default WorldColors
