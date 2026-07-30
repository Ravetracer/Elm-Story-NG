import React, { useMemo } from 'react'

import {
  ElementId,
  SET_OPERATOR_TYPE,
  Variable,
  VariableSet,
  VARIABLE_TYPE
} from '../../data/types'

import { Button, Input, Select, Switch } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

import styles from './styles.module.less'

/**
 * Rows for a list of variable assignments, shared by a recipe's effects and an
 * object's take effects.
 *
 * The value control follows the variable's **type**, which is the thing that was
 * missing: a bare text field gave no hint that a BOOLEAN wants the literal `true`
 * rather than `1`, and a wrong value is silent — the assignment lands, the
 * comparison against it simply never matches. A BOOLEAN gets a switch, a NUMBER a
 * numeric field, and only a STRING keeps a free text box.
 *
 * Operators other than assignment are offered only for a NUMBER. `+` on a BOOLEAN
 * is arithmetic on the string "true", which yields `NaN` and then "ERROR" through
 * `formatNumberFromString`.
 */

const ALL_OPERATORS = [
  { value: SET_OPERATOR_TYPE.ASSIGN, label: 'set to' },
  { value: SET_OPERATOR_TYPE.ADD, label: '+' },
  { value: SET_OPERATOR_TYPE.SUBTRACT, label: '−' },
  { value: SET_OPERATOR_TYPE.MULTIPLY, label: '×' },
  { value: SET_OPERATOR_TYPE.DIVIDE, label: '÷' }
]

const operatorsFor = (type?: VARIABLE_TYPE) =>
  type === VARIABLE_TYPE.NUMBER
    ? ALL_OPERATORS
    : ALL_OPERATORS.filter(
        ({ value }) => value === SET_OPERATOR_TYPE.ASSIGN
      )

const VariableEffectRows: React.FC<{
  effects: VariableSet[]
  variables: Variable[]
  addLabel: string
  onChange: (effects: VariableSet[]) => void
}> = ({ effects, variables, addLabel, onChange }) => {
  const variableOptions = useMemo(
    () =>
      variables.map((variable) => ({
        value: variable.id as ElementId,
        label: `${variable.title} (${variable.type.toLowerCase()})`
      })),
    [variables]
  )

  const replace = (index: number, next: VariableSet) => {
    const all = [...effects]

    all[index] = next

    onChange(all)
  }

  return (
    <>
      {effects.map((effect, index) => {
        const type = variables.find(({ id }) => id === effect[0])?.type

        return (
          <div key={index} className={styles.conditionRow}>
            <Select
              size="small"
              value={effect[0]}
              options={variableOptions}
              className={styles.conditionWide}
              onChange={(variableId) => {
                const nextType =
                  variables.find(({ id }) => id === variableId)?.type ??
                  effect[3]

                // An operator the new type does not offer would be applied as
                // arithmetic on a non-number and store "ERROR", so it is reset
                // rather than carried across. So is a value that no longer fits.
                const operator = operatorsFor(nextType).some(
                  ({ value }) => value === effect[1]
                )
                  ? effect[1]
                  : SET_OPERATOR_TYPE.ASSIGN

                const value =
                  nextType === VARIABLE_TYPE.BOOLEAN &&
                  effect[2] !== 'true' &&
                  effect[2] !== 'false'
                    ? 'true'
                    : effect[2]

                replace(index, [variableId, operator, value, nextType])
              }}
            />

            <Select
              size="small"
              value={effect[1]}
              options={operatorsFor(type)}
              onChange={(operator) =>
                replace(index, [effect[0], operator, effect[2], effect[3]])
              }
            />

            {type === VARIABLE_TYPE.BOOLEAN ? (
              <>
                <Switch
                  size="small"
                  checked={effect[2] === 'true'}
                  onChange={(checked) =>
                    replace(index, [
                      effect[0],
                      effect[1],
                      checked ? 'true' : 'false',
                      effect[3]
                    ])
                  }
                />

                <span className={styles.conditionLabel}>{effect[2]}</span>
              </>
            ) : (
              <Input
                size="small"
                type={type === VARIABLE_TYPE.NUMBER ? 'number' : 'text'}
                value={effect[2]}
                className={styles.conditionWide}
                placeholder={
                  type === VARIABLE_TYPE.NUMBER ? '0' : 'a value'
                }
                onChange={(event) =>
                  replace(index, [
                    effect[0],
                    effect[1],
                    event.target.value,
                    effect[3]
                  ])
                }
              />
            )}

            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() =>
                onChange(effects.filter((_, other) => other !== index))
              }
            />
          </div>
        )
      })}

      <Button
        type="link"
        size="small"
        icon={<PlusOutlined />}
        disabled={variables.length === 0}
        onClick={() => {
          const variable = variables[0]

          if (!variable?.id) return

          onChange([
            ...effects,
            [
              variable.id,
              SET_OPERATOR_TYPE.ASSIGN,
              variable.type === VARIABLE_TYPE.BOOLEAN
                ? 'true'
                : variable.type === VARIABLE_TYPE.NUMBER
                ? '0'
                : '',
              variable.type
            ] as VariableSet
          ])
        }}
      >
        {addLabel}
      </Button>

      {variables.length === 0 && (
        <span className={styles.fieldHint}>
          No variables in this storyworld yet.
        </span>
      )}
    </>
  )
}

VariableEffectRows.displayName = 'VariableEffectRows'

export default VariableEffectRows
