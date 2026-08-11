import React, { useMemo, useState } from 'react'

import { debounce } from 'lodash'

import { StudioId, World, VARIABLE_TYPE } from '../../../data/types'

import { Input, Select } from 'antd'

import { useVariables } from '../../../hooks'

import api from '../../../api'

import styles from './styles.module.less'

/**
 * Designates a NUMBER variable as the world's currency and names it. Money is a
 * plain variable — effects spend and earn it, conditions gate on it, expressions
 * print it — so this panel only *points at* one and adds a label; it creates no
 * new state. The engine draws the chosen variable's live value below the
 * inventory, with a coin in front.
 *
 * Writes immediately (the select) and debounced (the label), re-reading the row
 * inside the save because the metadata form beside it writes the same record —
 * the same pattern as the cover and colour panels.
 */
const WorldCurrency: React.FC<{ studioId: StudioId; world: World }> = ({
  studioId,
  world
}) => {
  const variables =
    useVariables(studioId, world.id ?? '', [studioId, world.id]) ?? []

  const numberVariables = variables.filter(
    (variable) => variable.type === VARIABLE_TYPE.NUMBER
  )

  const [label, setLabel] = useState(world.currencyLabel ?? '')

  const saveWorld = async (changes: Partial<World>) => {
    if (!world.id) return

    await api().worlds.saveWorld(studioId, {
      ...(await api().worlds.getWorld(studioId, world.id)),
      ...changes
    })
  }

  const persistLabel = useMemo(
    () =>
      debounce(
        (next: string) =>
          saveWorld({ currencyLabel: next.trim() || undefined }),
        400
      ),
    [studioId, world.id]
  )

  return (
    <div className={styles.currency}>
      <div className={styles.currencyRow}>
        <span className={styles.currencyFieldLabel}>Variable</span>

        <Select
          size="small"
          allowClear
          className={styles.currencySelect}
          placeholder="None"
          value={world.currencyVariableId}
          onChange={(value) =>
            saveWorld({ currencyVariableId: value ?? undefined })
          }
          options={numberVariables.map((variable) => ({
            label: variable.title,
            value: variable.id
          }))}
          notFoundContent="No number variables yet"
        />
      </div>

      <div className={styles.currencyRow}>
        <span className={styles.currencyFieldLabel}>Label</span>

        <Input
          size="small"
          className={styles.currencyLabelInput}
          placeholder="e.g. Credits, Gold"
          value={label}
          onChange={(event) => {
            setLabel(event.target.value)
            persistLabel(event.target.value)
          }}
        />
      </div>

      <div className={styles.currencyHint}>
        Pick a NUMBER variable to show as money below the inventory, with a coin
        in front. Whatever changes the variable changes the money. Leave the
        variable unset to hide the readout; leave the label blank to show just the
        value.
      </div>
    </div>
  )
}

WorldCurrency.displayName = 'WorldCurrency'

export default WorldCurrency
