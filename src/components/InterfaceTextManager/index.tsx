import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { StudioId, World, WorldId } from '../../data/types'

import { Button, Input } from 'antd'

import {
  INTERFACE_TEXT_DEFAULTS,
  INTERFACE_TEXT_GROUPS,
  INTERFACE_TEXT_KEY,
  pruneInterfaceText,
  type InterfaceTextOverrides
} from '../../../engine/src/lib/interfaceText'

import { useWorld } from '../../hooks'
import api from '../../api'

import styles from './styles.module.less'

/**
 * Every word the storyteller says that the author did not write, and the
 * author's replacement for it.
 *
 * The table of keys, their English and their grouping all live in
 * `engine/src/lib/interfaceText.ts`, which this imports directly — the same thing
 * `lib/serialization.ts` and `SceneMap/EventSnippet` already do. It has to be
 * there rather than here, because the engine is what renders these words and the
 * grouping is a fact about where the player meets each one. **This component is
 * generated from that table**: adding a key there puts a row here with no edit.
 *
 * The overrides are per storyworld and there is no language picker — see the note
 * in that file for why. An author writing in two languages writes two
 * storyworlds.
 */
const InterfaceTextManager: React.FC<{
  studioId: StudioId
  worldId: WorldId
}> = ({ studioId, worldId }) => {
  const world = useWorld(studioId, worldId, [studioId, worldId])

  /*
   * Edited as a whole map and saved on demand rather than per keystroke.
   *
   * A debounced per-field save would write the world record 42 ways and, more to
   * the point, every write bumps `World.updated`, which the dashboard sorts on.
   * Translating a storyworld would keep shuffling it to the top of the library.
   */
  const [draft, setDraft] = useState<InterfaceTextOverrides>({}),
    [saving, setSaving] = useState(false)

  // seeded once the world arrives, and again if it is replaced underneath us
  useEffect(() => setDraft(world?.interfaceText ?? {}), [world?.interfaceText])

  const dirty = useMemo(() => {
    const saved = pruneInterfaceText(world?.interfaceText),
      edited = pruneInterfaceText(draft)

    return JSON.stringify(saved ?? {}) !== JSON.stringify(edited ?? {})
  }, [world?.interfaceText, draft])

  const translatedCount = useMemo(
    () => Object.keys(pruneInterfaceText(draft) ?? {}).length,
    [draft]
  )

  const onSave = useCallback(async () => {
    if (!world) return

    setSaving(true)

    try {
      await api().worlds.saveWorld(studioId, {
        ...(world as World),
        // pruned rather than stored verbatim: a blank field and a field holding
        // the English both mean "the engine's word", and neither belongs in an
        // exported storyworld
        interfaceText: pruneInterfaceText(draft)
      })
    } finally {
      setSaving(false)
    }
  }, [studioId, world, draft])

  const onRevertAll = useCallback(() => setDraft({}), [])

  return (
    <div className={styles.InterfaceTextManager}>
      <div className={styles.intro}>
        <p>
          The words the storyteller says that you did not write. Leave a field
          empty to use the English shown beside it.
        </p>

        <p className={styles.note}>
          These belong to this storyworld, not to the player — there is no
          language menu, because the prose cannot be switched at runtime. Write a
          second language as a second storyworld.
        </p>
      </div>

      <div className={styles.groups}>
        {INTERFACE_TEXT_GROUPS.map((group) => (
          <section className={styles.group} key={group.title}>
            <h2 className={styles.groupTitle}>{group.title}</h2>

            {group.note && <p className={styles.groupNote}>{group.note}</p>}

            {group.keys.map((key) => (
              <TextRow
                key={key}
                textKey={key}
                value={draft[key] ?? ''}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, [key]: value }))
                }
              />
            ))}
          </section>
        ))}
      </div>

      <div className={styles.actions}>
        <span className={styles.count}>
          {translatedCount === 0
            ? 'Nothing translated yet.'
            : `${translatedCount} of ${
                Object.keys(INTERFACE_TEXT_DEFAULTS).length
              } translated.`}
        </span>

        <Button onClick={onRevertAll} disabled={translatedCount === 0}>
          Clear All
        </Button>

        <Button type="primary" onClick={onSave} disabled={!dirty || saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

/**
 * One word, with the English it replaces.
 *
 * The English is a `placeholder` rather than a label beside the field, so an
 * empty field *shows* what the player will see instead of describing it.
 */
const TextRow: React.FC<{
  textKey: INTERFACE_TEXT_KEY
  value: string
  onChange: (value: string) => void
}> = ({ textKey, value, onChange }) => (
  <div className={styles.row}>
    <span className={styles.default} title={INTERFACE_TEXT_DEFAULTS[textKey]}>
      {INTERFACE_TEXT_DEFAULTS[textKey]}
    </span>

    <Input
      value={value}
      placeholder={INTERFACE_TEXT_DEFAULTS[textKey]}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
)

InterfaceTextManager.displayName = 'InterfaceTextManager'

export default InterfaceTextManager
