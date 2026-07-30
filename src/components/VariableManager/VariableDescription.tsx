import React, { useMemo } from 'react'

import { debounce } from 'lodash-es'

import { ElementId, StudioId } from '../../data/types'

import { Input } from 'antd'

import styles from './styles.module.less'

import api from '../../api'

/**
 * The author's note on what a variable is for.
 *
 * Uncontrolled on purpose. Every save re-runs the live query behind the manager,
 * so a controlled input would be re-rendered from the database mid-typing and
 * fight the caret — the problem VariableRow's title field works around with a
 * form and a focus check (#166, #307). An uncontrolled input ignores the prop
 * entirely, and remounts with the right text because the row is keyed on the
 * variable id.
 */
const VariableDescription: React.FC<{
  studioId: StudioId
  variableId: ElementId
  description?: string
}> = ({ studioId, variableId, description }) => {
  const save = useMemo(
    () =>
      debounce(
        (value: string) =>
          api().variables.saveVariableDescription(studioId, variableId, value),
        400
      ),
    [studioId, variableId]
  )

  return (
    <Input
      className={styles.description}
      size="small"
      bordered={false}
      placeholder="What is this variable for?"
      defaultValue={description}
      spellCheck={false}
      onChange={(event) => save(event.target.value)}
      // leaving the field should not cost the last few characters
      onBlur={() => save.flush()}
      onPressEnter={() => save.flush()}
    />
  )
}

VariableDescription.displayName = 'VariableDescription'

export default VariableDescription
