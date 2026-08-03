import React, { useMemo } from 'react'

import { debounce } from 'lodash-es'

import { ElementId, StudioId } from '../../../data/types'

import { Input } from 'antd'

import styles from './styles.module.less'

import api from '../../../api'

/**
 * The line the storyteller says when this path is taken.
 *
 * Uncontrolled on purpose, for the reason `VariableDescription` is: every save
 * re-runs the live query behind the panel, so a controlled input would be
 * re-rendered from the database mid-typing and fight the caret. It remounts with
 * the right text because the panel is keyed on the path.
 */
const PathNotification: React.FC<{
  studioId: StudioId
  pathId: ElementId
  notification?: string
}> = ({ studioId, pathId, notification }) => {
  const save = useMemo(
    () =>
      debounce(
        (value: string) =>
          api().paths.savePathNotification(studioId, pathId, value),
        400
      ),
    [studioId, pathId]
  )

  return (
    <Input
      className={styles.notification}
      size="small"
      bordered={false}
      placeholder="You hear a door slam behind you."
      defaultValue={notification}
      spellCheck={false}
      onChange={(event) => save(event.target.value)}
      // leaving the field should not cost the last few characters
      onBlur={() => save.flush()}
      onPressEnter={() => save.flush()}
    />
  )
}

PathNotification.displayName = 'PathNotification'

export default PathNotification
