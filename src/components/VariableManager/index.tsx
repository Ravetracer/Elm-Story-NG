import React, { useMemo, useState } from 'react'

import { StudioId, VARIABLE_TYPE, WorldId } from '../../data/types'

import {
  filterVariables,
  getDuplicateVariableTitles
} from '../../lib/variableUsage'

import { useVariables, useVariableUsage } from '../../hooks'

import { Button, Input, Select, Switch, Tooltip } from 'antd'
import {
  PlusOutlined,
  QuestionCircleFilled,
  SearchOutlined,
  WarningOutlined
} from '@ant-design/icons'

import { VariableRow } from '../WorldVariables'
import addVariable from './addVariable'
import confirmRemoveVariable from './confirmRemoveVariable'
import VariableDescription from './VariableDescription'
import VariableHelp from './VariableHelp'
import VariableUsageSummary from './VariableUsageSummary'

import variableStyles from '../WorldVariables/styles.module.less'
import styles from './styles.module.less'

const { Option } = Select

const ALL_TYPES = 'ALL_TYPES'

const VariableManager: React.FC<{
  studioId: StudioId
  worldId: WorldId
  // opened straight onto the reference, for the ? on the Variables panel
  helpOpen?: boolean
}> = ({ studioId, worldId, helpOpen }) => {
  const variables = useVariables(studioId, worldId, [studioId, worldId]),
    usage = useVariableUsage(studioId, worldId)

  const [search, setSearch] = useState(''),
    [type, setType] = useState<VARIABLE_TYPE | typeof ALL_TYPES>(ALL_TYPES),
    [unusedOnly, setUnusedOnly] = useState(false),
    [helpVisible, setHelpVisible] = useState(helpOpen === true)

  const duplicateTitles = useMemo(
    () => getDuplicateVariableTitles(variables || []),
    [variables]
  )

  const visibleVariables = useMemo(
    () =>
      variables
        ? filterVariables(variables, usage || new Map(), {
            search,
            type: type === ALL_TYPES ? undefined : type,
            // without usage there is nothing to filter on, so the toggle waits
            // rather than reporting everything as unused
            unusedOnly: usage ? unusedOnly : false
          })
        : undefined,
    [variables, usage, search, type, unusedOnly]
  )

  const unusedCount = useMemo(
    () =>
      usage && variables
        ? variables.filter(
            (variable) => (usage.get(variable.id || '')?.length ?? 0) === 0
          ).length
        : undefined,
    [usage, variables]
  )

  return (
    <div className={styles.VariableManager}>
      <div className={styles.toolbar}>
        <Input
          className={styles.search}
          size="small"
          prefix={<SearchOutlined />}
          placeholder="Search title or initial value"
          value={search}
          allowClear
          spellCheck={false}
          onChange={(event) => setSearch(event.target.value)}
        />

        <Select
          size="small"
          className={styles.typeFilter}
          value={type}
          onChange={setType}
        >
          <Option value={ALL_TYPES}>All types</Option>
          <Option value={VARIABLE_TYPE.BOOLEAN}>Boolean</Option>
          <Option value={VARIABLE_TYPE.STRING}>String</Option>
          <Option value={VARIABLE_TYPE.NUMBER}>Number</Option>
        </Select>

        <label className={styles.unusedToggle}>
          <Switch
            size="small"
            checked={unusedOnly}
            disabled={!usage}
            onChange={setUnusedOnly}
          />
          Unused only
        </label>

        <Button
          size="small"
          onClick={async () => {
            // a new variable would otherwise land outside the current filters,
            // which reads as the button having done nothing
            setSearch('')
            setType(ALL_TYPES)
            setUnusedOnly(false)
            setHelpVisible(false)

            await addVariable(studioId, worldId)
          }}
        >
          <PlusOutlined /> Add Variable
        </Button>

        <Tooltip
          title={helpVisible ? 'Close help' : 'How variables are used'}
          mouseEnterDelay={0.5}
        >
          <span
            className={`${styles.helpButton} ${
              helpVisible ? styles.helpButtonActive : ''
            }`}
            onClick={() => setHelpVisible(!helpVisible)}
          >
            <QuestionCircleFilled />
          </span>
        </Tooltip>
      </div>

      {helpVisible && <VariableHelp onClose={() => setHelpVisible(false)} />}

      <div className={styles.body} hidden={helpVisible}>
        <div className={styles.headerRow}>
          <span className={variableStyles.titleCol}>Title</span>
          <span className={variableStyles.typeCol}>Type</span>
          <span className={variableStyles.initialValueCol}>Initial</span>
          <span className={variableStyles.deleteVariableCol} />
        </div>

        <div className={styles.rows}>
        {visibleVariables?.map(
          (variable) =>
            variable.id && (
              <div className={styles.variableBlock} key={variable.id}>
                <div className={variableStyles.variableRows}>
                  <VariableRow
                    studioId={studioId}
                    variableId={variable.id}
                    onDelete={(variableId) =>
                      confirmRemoveVariable(
                        studioId,
                        variableId,
                        variable.title,
                        usage?.get(variableId)
                      )
                    }
                  />
                </div>

                <VariableDescription
                  studioId={studioId}
                  variableId={variable.id}
                  description={variable.description}
                />

                <div className={styles.usageLine}>
                  {duplicateTitles.has(variable.title) && (
                    <Tooltip
                      title="Another variable has this title. Template expressions resolve by title, so any expression naming it is ambiguous."
                      mouseEnterDelay={0.5}
                    >
                      <span className={`${styles.chip} ${styles.duplicate}`}>
                        <WarningOutlined /> duplicate title
                      </span>
                    </Tooltip>
                  )}

                  <VariableUsageSummary usage={usage?.get(variable.id)} />
                </div>
              </div>
            )
        )}

          {visibleVariables?.length === 0 && (
            <div className={styles.empty}>
              {variables?.length === 0
                ? 'This storyworld has no variables yet.'
                : 'No variables match this search.'}
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        {variables && (
          <>
            <span>
              {variables.length}{' '}
              {variables.length === 1 ? 'variable' : 'variables'}
            </span>

            {unusedCount !== undefined && <span>{unusedCount} unused</span>}

            {duplicateTitles.size > 0 && (
              <span className={styles.duplicate}>
                <WarningOutlined /> {duplicateTitles.size} duplicate{' '}
                {duplicateTitles.size === 1 ? 'title' : 'titles'}
              </span>
            )}

            {visibleVariables &&
              visibleVariables.length !== variables.length && (
                <span className={styles.showing}>
                  showing {visibleVariables.length}
                </span>
              )}
          </>
        )}
      </div>
    </div>
  )
}

VariableManager.displayName = 'VariableManager'

export default VariableManager
