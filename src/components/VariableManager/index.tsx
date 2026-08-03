import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ElementId, StudioId, VARIABLE_TYPE, WorldId } from '../../data/types'

import {
  filterVariables,
  getDuplicateVariableTitles
} from '../../lib/variableUsage'

import { useVariables, useVariableUsage } from '../../hooks'

import { Button, Input, Select, Switch, Tooltip } from 'antd'
import {
  CaretRightOutlined,
  PlusOutlined,
  QuestionCircleFilled,
  SearchOutlined,
  WarningOutlined
} from '@ant-design/icons'

import { VariableRow } from '../WorldVariables'
import addVariable from './addVariable'
import AddVariableModal from './AddVariableModal'
import confirmRemoveVariable from './confirmRemoveVariable'
import VariableDescription from './VariableDescription'
import VariableScope from './VariableScope'
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
  // opened straight onto the add prompt, for the + on the Variables panel
  addOpen?: boolean
}> = ({ studioId, worldId, helpOpen, addOpen }) => {
  const variables = useVariables(studioId, worldId, [studioId, worldId]),
    usage = useVariableUsage(studioId, worldId)

  const [search, setSearch] = useState(''),
    [type, setType] = useState<VARIABLE_TYPE | typeof ALL_TYPES>(ALL_TYPES),
    [unusedOnly, setUnusedOnly] = useState(false),
    [helpVisible, setHelpVisible] = useState(helpOpen === true),
    [addVisible, setAddVisible] = useState(addOpen === true),
    // bumped on every open, so the prompt remounts with a fresh generated
    // title rather than resetting itself from an effect
    [addPromptKey, setAddPromptKey] = useState(0),
    // the variable just added: scrolled to, focused and briefly marked, since
    // finding one row among fifty is the whole difficulty
    [addedVariableId, setAddedVariableId] = useState<ElementId | undefined>(),
    // Collapsed by default. The title, type and initial value are the row —
    // the description, the scope and the usage are what an author opens a
    // variable to read, and shown for every row at once they bury the list.
    // Not persisted: the manager remounts on every open of the modal.
    [expandedVariableIds, setExpandedVariableIds] = useState<Set<ElementId>>(
      new Set()
    )

  const variableBlocks = useRef(new Map<ElementId, HTMLDivElement>()),
    // the scroll and the focus happen once per added variable; the list is
    // rebuilt by the live query on every keystroke of the rename that follows
    revealedVariableId = useRef<ElementId | undefined>()

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

  const existingTitles = useMemo(
    () => new Set((variables || []).map((variable) => variable.title)),
    [variables]
  )

  // The row arrives in two steps and neither of them re-renders this
  // component: the manager's live query hands back the new variable, and then
  // `VariableRow`'s own live query resolves and renders the fields — until it
  // does, the block's only input is the description, which is what a plain
  // `querySelector('input')` focused instead of the title. Hence a few
  // attempts rather than a dependency, and the title field addressed by name.
  useEffect(() => {
    if (!addedVariableId || revealedVariableId.current === addedVariableId)
      return

    const attempts = [0, 100, 250, 500, 900].map((delay) =>
      setTimeout(() => {
        if (revealedVariableId.current === addedVariableId) return

        const variableBlock = variableBlocks.current.get(addedVariableId),
          titleInput = variableBlock?.querySelector<HTMLInputElement>(
            `.${variableStyles.titleCol} input`
          )

        if (!variableBlock || !titleInput) return

        revealedVariableId.current = addedVariableId

        variableBlock.scrollIntoView({ block: 'nearest' })
        // named up front, but renaming is the one thing an author is most
        // likely to want next, and the caret says which row is the new one
        titleInput.focus()
      }, delay)
    )

    return () => attempts.forEach(clearTimeout)
  }, [addedVariableId])

  useEffect(() => {
    if (!addedVariableId) return

    const timeout = setTimeout(() => setAddedVariableId(undefined), 2500)

    return () => clearTimeout(timeout)
  }, [addedVariableId])

  const toggleVariableExpanded = (variableId: ElementId) =>
    setExpandedVariableIds((currentlyExpanded) => {
      const nextExpanded = new Set(currentlyExpanded)

      nextExpanded.has(variableId)
        ? nextExpanded.delete(variableId)
        : nextExpanded.add(variableId)

      return nextExpanded
    })

  const openAddVariable = () => {
    // a new variable would otherwise land outside the current filters, which
    // reads as the button having done nothing
    setSearch('')
    setType(ALL_TYPES)
    setUnusedOnly(false)
    setHelpVisible(false)
    setAddPromptKey(addPromptKey + 1)
    setAddVisible(true)
  }

  return (
    <>
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

          <Button size="small" onClick={openAddVariable}>
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
            {/* the expander column, so the labels stay over their fields */}
            <span className={styles.expanderCol} />
            <span className={variableStyles.titleCol}>Title</span>
            <span className={variableStyles.typeCol}>Type</span>
            <span className={variableStyles.initialValueCol}>Initial</span>
            <span className={variableStyles.deleteVariableCol} />
          </div>

          <div className={styles.rows}>
            {visibleVariables?.map((variable) => {
              const variableId = variable.id

              if (!variableId) return null

              const expanded = expandedVariableIds.has(variableId),
                duplicateTitle = duplicateTitles.has(variable.title)

              return (
                <div
                  className={`${styles.variableBlock} ${
                    addedVariableId === variableId ? styles.justAdded : ''
                  }`}
                  key={variableId}
                  ref={(variableBlock) => {
                    variableBlock
                      ? variableBlocks.current.set(variableId, variableBlock)
                      : variableBlocks.current.delete(variableId)
                  }}
                >
                  <div className={styles.blockHeader}>
                    <Tooltip
                      title={expanded ? 'Hide details' : 'Show details'}
                      mouseEnterDelay={0.5}
                    >
                      {/* a span rather than a button: the row is 25px and the
                          theme's button rules do not fit inside it */}
                      <span
                        className={styles.expanderCol}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Hide' : 'Show'} details for ${
                          variable.title
                        }`}
                        onClick={() => toggleVariableExpanded(variableId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            toggleVariableExpanded(variableId)
                          }
                        }}
                      >
                        <CaretRightOutlined rotate={expanded ? 90 : 0} />
                      </span>
                    </Tooltip>

                    <div className={variableStyles.variableRows}>
                      <VariableRow
                        studioId={studioId}
                        variableId={variableId}
                        onDelete={(idToRemove) =>
                          confirmRemoveVariable(
                            studioId,
                            idToRemove,
                            variable.title,
                            usage?.get(idToRemove)
                          )
                        }
                      />
                    </div>
                  </div>

                  {expanded && (
                    <div className={styles.blockDetails}>
                      <VariableDescription
                        studioId={studioId}
                        variableId={variableId}
                        description={variable.description}
                      />

                      <VariableScope
                        studioId={studioId}
                        worldId={worldId}
                        variableId={variableId}
                        scope={variable.scope}
                        scopeId={variable.scopeId}
                      />
                    </div>
                  )}

                  {/* a warning is not detail: a duplicate title is silently
                      ambiguous to every expression naming it, so it is said
                      whether or not the row is open */}
                  {(expanded || duplicateTitle) && (
                    <div className={styles.usageLine}>
                      {duplicateTitle && (
                        <Tooltip
                          title="Another variable has this title. Template expressions resolve by title, so any expression naming it is ambiguous."
                          mouseEnterDelay={0.5}
                        >
                          <span className={`${styles.chip} ${styles.duplicate}`}>
                            <WarningOutlined /> duplicate title
                          </span>
                        </Tooltip>
                      )}

                      {expanded && (
                        <VariableUsageSummary usage={usage?.get(variableId)} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}

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

      <AddVariableModal
        key={addPromptKey}
        visible={addVisible}
        existingTitles={existingTitles}
        onAdd={async (title) => {
          setAddVisible(false)

          setAddedVariableId(await addVariable(studioId, worldId, title))
        }}
        onCancel={() => setAddVisible(false)}
      />
    </>
  )
}

VariableManager.displayName = 'VariableManager'

export default VariableManager
