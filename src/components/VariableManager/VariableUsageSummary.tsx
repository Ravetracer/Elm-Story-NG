import React from 'react'

import {
  summarizeVariableUsage,
  VARIABLE_USAGE_TYPE,
  VariableUsage
} from '../../lib/variableUsage'

import { Tooltip } from 'antd'
import { WarningOutlined } from '@ant-design/icons'

import styles from './styles.module.less'

const label = (count: number, singular: string) =>
  `${count} ${count === 1 ? singular : `${singular}s`}`

/**
 * What a variable is used by, as a line of chips under its editable row.
 *
 * Content expressions are listed with the expression text in a tooltip, because
 * they are the ones a rename breaks: they resolve by variable title, so the
 * author needs to know which events to go and fix.
 */
const VariableUsageSummary: React.FC<{
  usage: VariableUsage[] | undefined
}> = ({ usage }) => {
  if (!usage) return <span className={styles.usageLoading}>…</span>

  if (usage.length === 0)
    return <span className={styles.unused}>not used anywhere</span>

  const { conditions, effects, inputs, contentExpressions, contentEvents } =
    summarizeVariableUsage(usage)

  const contentUsage = usage.filter(
    ({ type }) => type === VARIABLE_USAGE_TYPE.CONTENT
  )

  const elementTitles = (type: VARIABLE_USAGE_TYPE) => [
    ...new Set(
      usage.filter((entry) => entry.type === type).map((e) => e.elementTitle)
    )
  ]

  return (
    <>
      {conditions > 0 && (
        <Tooltip
          title={`Paths: ${elementTitles(VARIABLE_USAGE_TYPE.CONDITION).join(
            ', '
          )}`}
          mouseEnterDelay={0.5}
        >
          <span className={styles.chip}>
            {label(conditions, 'path condition')}
          </span>
        </Tooltip>
      )}

      {effects > 0 && (
        <Tooltip
          title={`Paths: ${elementTitles(VARIABLE_USAGE_TYPE.EFFECT).join(
            ', '
          )}`}
          mouseEnterDelay={0.5}
        >
          <span className={styles.chip}>{label(effects, 'path effect')}</span>
        </Tooltip>
      )}

      {inputs > 0 && (
        <Tooltip
          title={`Events: ${elementTitles(VARIABLE_USAGE_TYPE.INPUT).join(
            ', '
          )}`}
          mouseEnterDelay={0.5}
        >
          <span className={styles.chip}>{label(inputs, 'input')}</span>
        </Tooltip>
      )}

      {contentExpressions > 0 && (
        <Tooltip
          title={
            <>
              {contentUsage.map((entry, index) => (
                <div key={`${entry.elementId}-${index}`}>
                  {entry.elementTitle}: <code>{entry.detail}</code>
                </div>
              ))}
            </>
          }
          mouseEnterDelay={0.5}
        >
          <span className={`${styles.chip} ${styles.contentChip}`}>
            <WarningOutlined /> {label(contentExpressions, 'expression')} in{' '}
            {label(contentEvents, 'event')}
          </span>
        </Tooltip>
      )}
    </>
  )
}

VariableUsageSummary.displayName = 'VariableUsageSummary'

export default VariableUsageSummary
