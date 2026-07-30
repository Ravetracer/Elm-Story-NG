import logger from '../../lib/logger'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { debounce } from 'lodash-es'

import {
  COMPARE_OPERATOR_TYPE,
  ElementId,
  WorldId,
  SET_OPERATOR_TYPE,
  StudioId,
  VARIABLE_TYPE
} from '../../data/types'

import { useVariable, useVariables } from '../../hooks'

import { Col, Form, Input, InputNumber, Row, Select } from 'antd'
import type { InputRef } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'

import styles from './styles.module.less'

import api from '../../api'

export enum VARIABLE_ROW_TYPE {
  VARIABLE = 'VARIABLE',
  CONDITION = 'CONDITION',
  EFFECT = 'EFFECT'
}

const { Option } = Select

export const VariableRow: React.FC<{
  studioId: StudioId
  variableId: ElementId
  rowType?: VARIABLE_ROW_TYPE
  allowRename?: boolean
  allowTypeChange?: boolean
  allowSetOperator?: boolean
  value?: string
  compareOperatorType?: COMPARE_OPERATOR_TYPE
  setOperatorType?: SET_OPERATOR_TYPE
  onChangeValue?: (
    newValue: string,
    variableType: VARIABLE_TYPE,
    reset?: () => void
  ) => void
  onCompareOperatorTypeChange?: (
    newCompareOperatorType: COMPARE_OPERATOR_TYPE
  ) => void
  onSetOperatorTypeChange?: (newSetOperatorType: SET_OPERATOR_TYPE) => void
  onDelete?: (variableId: ElementId) => void
}> = ({
  studioId,
  variableId,
  rowType = VARIABLE_ROW_TYPE.VARIABLE,
  allowRename = true,
  allowTypeChange = true,
  allowSetOperator = false,
  value,
  compareOperatorType,
  setOperatorType,
  onCompareOperatorTypeChange,
  onSetOperatorTypeChange,
  onChangeValue,
  onDelete
}) => {
  const variable = useVariable(studioId, variableId, [studioId, variableId]),
    [editVariableTitleForm] = Form.useForm(),
    [editVariableInitialValueForm] = Form.useForm()

  // antd's Input is a forwardRef component, so the ref receives an InputRef
  // rather than a class instance. It was a class component when this was
  // written, which is why the annotation used the component itself as a type.
  const variableTitleInputRef = useRef<InputRef | null>(null),
    // A string variable renders an Input and a number variable an InputNumber,
    // and the two take different ref types: InputRef versus the underlying
    // HTMLInputElement. Only one is mounted at a time, so the helpers below
    // address whichever is currently present.
    variableInitialValueInputRef = useRef<InputRef | null>(null),
    variableInitialValueNumberRef = useRef<HTMLInputElement | null>(null)

  const focusInitialValue = () => {
    variableInitialValueInputRef.current?.focus()
    variableInitialValueNumberRef.current?.focus()
  }

  const blurInitialValue = () => {
    variableInitialValueInputRef.current?.blur()
    variableInitialValueNumberRef.current?.blur()
  }

  const [variableTitle, setVariableTitle] = useState<string | undefined>(
      variable?.type
    ),
    [variableType, setVariableType] = useState<VARIABLE_TYPE | undefined>(
      variable?.type
    ),
    [variableInitialValue, setVariableInitialValue] = useState<
      string | undefined
    >(variable?.initialValue)

  async function onVariableTitleChange(values: { title: string }) {
    logger.info(`VariableRow->onVariableTitleChange->${values.title}`)

    // #307
    // values.title.length === 0 && editVariableTitleForm.resetFields()

    variable?.id &&
      values.title.length > 0 &&
      values.title !== variableTitle &&
      (await api().variables.saveVariableTitle(
        studioId,
        variable.id,
        // remove all numbers and special characters
        values.title.replace(/\d+/g, '').replace(/[\W_]/g, '')
      ))
  }

  async function onVariableTypeChange(selectedVariableType: VARIABLE_TYPE) {
    logger.info(`VariableRow->onVariableTypeChange->${selectedVariableType}`)

    if (variable?.id && selectedVariableType !== variableType) {
      const relatedConditions = await api().conditions.getConditionsByVariableRef(
          studioId,
          variable.id
        ),
        relatedEffects = await api().effects.getEffectsByVariableRef(
          studioId,
          variable.id
        )

      await Promise.all([
        // #314: set values first
        relatedConditions.map(
          async (relatedCondition) =>
            relatedCondition.id &&
            (await api().conditions.saveConditionValue(
              studioId,
              relatedCondition.id,
              selectedVariableType === VARIABLE_TYPE.BOOLEAN
                ? 'false'
                : selectedVariableType === VARIABLE_TYPE.NUMBER
                ? '0'
                : ''
            ))
        ),
        relatedEffects.map(async (relatedEffect) => {
          if (relatedEffect.id) {
            // #355
            await api().effects.saveEffectSetOperatorType(
              studioId,
              relatedEffect.id,
              SET_OPERATOR_TYPE.ASSIGN
            )

            await api().effects.saveEffectValue(
              studioId,
              relatedEffect.id,
              selectedVariableType === VARIABLE_TYPE.BOOLEAN
                ? 'false'
                : selectedVariableType === VARIABLE_TYPE.NUMBER
                ? '0'
                : ''
            )
          }
        })
      ])

      // #314: set type second
      // TODO: consider preserving the operator in certain cases
      await Promise.all(
        relatedConditions.map(
          async (relatedCondition) =>
            relatedCondition.id &&
            (await api().conditions.saveConditionCompareOperatorType(
              studioId,
              relatedCondition.id,
              COMPARE_OPERATOR_TYPE.EQ
            ))
        )
      )

      await api().variables.saveVariableType(
        studioId,
        variable.id,
        selectedVariableType
      )
    }
  }

  async function onInitialValueChangeFromSelect(
    newVariableInitialValue: string
  ) {
    logger.info(
      `VariableRow->onInitialValueChangeFromSelect->${newVariableInitialValue}`
    )

    variable?.id &&
      newVariableInitialValue !== variableInitialValue &&
      (await api().variables.saveVariableInitialValue(
        studioId,
        variable.id,
        newVariableInitialValue
      ))
  }

  async function onVariableInitialValueChangeFromInput(changedValues: {
    initialValue: string
  }) {
    logger.info(
      `VariableRow->onVariableInitialValueChangeFromInput->${changedValues.initialValue}`
    )

    if (variable?.id && changedValues.initialValue !== variableInitialValue) {
      variableType === VARIABLE_TYPE.STRING &&
        (await api().variables.saveVariableInitialValue(
          studioId,
          variable.id,
          changedValues.initialValue
        ))

      if (variableType === VARIABLE_TYPE.NUMBER) {
        if (
          !isNaN(changedValues.initialValue as any) ||
          changedValues.initialValue === '' ||
          changedValues.initialValue === '-' ||
          !changedValues.initialValue
        ) {
          await api().variables.saveVariableInitialValue(
            studioId,
            variable.id,
            `${
              changedValues.initialValue
                ? changedValues.initialValue === '-'
                  ? '0'
                  : changedValues.initialValue
                : '0'
              // changedValues.initialValue
              //   ? Number.isSafeInteger(changedValues.initialValue)
              //     ? changedValues.initialValue
              //     : parseFloat(changedValues.initialValue).toFixed(2)
              //   : '0'
            }`
          )

          // #298: detect user pressing return or clicking outside
          if (changedValues.initialValue === null) {
            editVariableInitialValueForm.resetFields()
          }
        } else {
          editVariableInitialValueForm.resetFields()
          focusInitialValue()
        }
      }
    }
  }

  async function onRemoveVariable() {
    variable?.id &&
      (await api().variables.removeVariable(studioId, variable.id))
  }

  const getVariableInitialValue = useCallback(():
    | number
    | string
    | undefined => {
    if (rowType === VARIABLE_ROW_TYPE.VARIABLE) {
      if (variable?.type === VARIABLE_TYPE.NUMBER) {
        return variable.initialValue || '0'
      } else {
        return variable?.initialValue || undefined
      }
    } else {
      switch (variable?.type) {
        case VARIABLE_TYPE.BOOLEAN:
          return value || 'false'
        case VARIABLE_TYPE.NUMBER:
          return value || '0'
        case VARIABLE_TYPE.STRING:
          return value || undefined
        default:
          return undefined
      }
    }
  }, [rowType, variable, value])

  useEffect(() => {
    logger.info(`VariableRow->variable.title->${variable?.title}`)

    variable?.title && setVariableTitle(variable.title)

    // #166, #307: leave the field alone while it has focus, so a rename in
    // progress is not discarded.
    //
    // This read `variableTitleInputRef.current?.state.focused` when antd's Input
    // was a class component holding that flag in its own state. It is now a
    // forwardRef component whose ref exposes focus(), blur(), select() and the
    // underlying input element, and no state at all, so `.state` was undefined
    // and dereferencing `.focused` threw inside this effect. The throw unmounted
    // VariableRow and with it the whole panel, which is why the Variables tab
    // rendered blank.
    const titleInput = variableTitleInputRef.current?.input

    if (!titleInput || document.activeElement !== titleInput) {
      editVariableTitleForm.resetFields()
    }
  }, [variable?.title])

  useEffect(() => {
    logger.info(`VariableRow->variable.type->useEffect->${variable?.type}`)

    variable?.type && setVariableType(variable.type)

    setTimeout(() => editVariableInitialValueForm.resetFields(), 1)
  }, [variable?.type])

  useEffect(() => {
    logger.info(`VariableRow->variable.initialValue->${variable?.initialValue}`)

    variable?.initialValue && setVariableInitialValue(variable.initialValue)
  }, [variable?.initialValue])

  useEffect(() => {
    logger.info(`VariableRow->value->useEffect->${value}`)

    // if (value) {
    // editVariableInitialValueForm.resetFields()
    // variableInitialValueInputRef.current?.focus()
    // }
  }, [value])

  return (
    <>
      {variable && (
        <>
          <Row className={styles.variableRow}>
            <Col
              className={styles.titleCol}
              style={{
                width:
                  rowType !== VARIABLE_ROW_TYPE.VARIABLE &&
                  rowType === VARIABLE_ROW_TYPE.EFFECT &&
                  (variableType === VARIABLE_TYPE.BOOLEAN ||
                    variableType === VARIABLE_TYPE.STRING)
                    ? '65%'
                    : ''
              }}
            >
              {allowRename && (
                <Form
                  form={editVariableTitleForm}
                  initialValues={{ title: variable.title }}
                  onFinish={() => variableTitleInputRef.current?.blur()}
                  onValuesChange={debounce(onVariableTitleChange, 100)}
                  onBlur={() => {
                    // safety check for #166
                    setTimeout(editVariableTitleForm.resetFields, 200)
                  }}
                >
                  <Form.Item name="title">
                    <Input ref={variableTitleInputRef} spellCheck={false} />
                  </Form.Item>
                </Form>
              )}

              {!allowRename && (
                <span className={styles.variableTitle}>{variableTitle}</span>
              )}
            </Col>

            {allowTypeChange && (
              <Col className={styles.typeCol}>
                <Select value={variableType} onChange={onVariableTypeChange}>
                  <Option value={VARIABLE_TYPE.BOOLEAN}>Boolean</Option>
                  <Option value={VARIABLE_TYPE.STRING}>String</Option>
                  <Option value={VARIABLE_TYPE.NUMBER}>Number</Option>
                </Select>
              </Col>
            )}

            {rowType === VARIABLE_ROW_TYPE.CONDITION && (
              <Col className={styles.typeCol}>
                <Select
                  value={compareOperatorType}
                  onChange={onCompareOperatorTypeChange}
                >
                  <Option value={COMPARE_OPERATOR_TYPE.EQ}>
                    {COMPARE_OPERATOR_TYPE.EQ}
                  </Option>
                  <Option value={COMPARE_OPERATOR_TYPE.NE}>
                    {COMPARE_OPERATOR_TYPE.NE}
                  </Option>
                  {variableType === VARIABLE_TYPE.NUMBER && (
                    <>
                      <Option value={COMPARE_OPERATOR_TYPE.GTE}>
                        {COMPARE_OPERATOR_TYPE.GTE}
                      </Option>
                      <Option value={COMPARE_OPERATOR_TYPE.GT}>
                        {COMPARE_OPERATOR_TYPE.GT}
                      </Option>
                      <Option value={COMPARE_OPERATOR_TYPE.LTE}>
                        {COMPARE_OPERATOR_TYPE.LTE}
                      </Option>
                      <Option value={COMPARE_OPERATOR_TYPE.LT}>
                        {COMPARE_OPERATOR_TYPE.LT}
                      </Option>
                    </>
                  )}
                </Select>
              </Col>
            )}

            {allowSetOperator && (
              <Col className={styles.typeCol}>
                <Select
                  value={setOperatorType}
                  onChange={onSetOperatorTypeChange}
                >
                  <Option value={SET_OPERATOR_TYPE.ASSIGN}>
                    {SET_OPERATOR_TYPE.ASSIGN}
                  </Option>
                  <Option value={SET_OPERATOR_TYPE.ADD}>
                    {SET_OPERATOR_TYPE.ADD}
                  </Option>
                  <Option value={SET_OPERATOR_TYPE.SUBTRACT}>
                    {SET_OPERATOR_TYPE.SUBTRACT}
                  </Option>
                  <Option value={SET_OPERATOR_TYPE.MULTIPLY}>
                    {SET_OPERATOR_TYPE.MULTIPLY}
                  </Option>
                  <Option value={SET_OPERATOR_TYPE.DIVIDE}>
                    {SET_OPERATOR_TYPE.DIVIDE}
                  </Option>
                </Select>
              </Col>
            )}

            <Col className={styles.initialValueCol}>
              {variable.type === VARIABLE_TYPE.BOOLEAN && (
                <Select
                  value={value || variableInitialValue}
                  onChange={(value) =>
                    onChangeValue
                      ? onChangeValue(value, variable.type)
                      : onInitialValueChangeFromSelect(value)
                  }
                >
                  <Option value={'true'}>true</Option>
                  <Option value={'false'}>false</Option>
                </Select>
              )}

              {(variable.type === VARIABLE_TYPE.STRING ||
                variable.type === VARIABLE_TYPE.NUMBER) && (
                <Form
                  form={editVariableInitialValueForm}
                  initialValues={{
                    initialValue: getVariableInitialValue()
                  }}
                  onValuesChange={debounce(
                    onChangeValue
                      ? (changedValues: { initialValue: string }) => {
                          onChangeValue(
                            changedValues.initialValue,
                            variable.type,
                            () => {
                              editVariableInitialValueForm.resetFields()
                              focusInitialValue()
                            }
                          )
                        }
                      : onVariableInitialValueChangeFromInput,
                    100
                  )}
                  onFinish={() => blurInitialValue()}
                >
                  {variable.type === VARIABLE_TYPE.STRING && (
                    <Form.Item name="initialValue">
                      <Input
                        placeholder="undefined"
                        ref={variableInitialValueInputRef}
                      />
                    </Form.Item>
                  )}

                  {variable.type === VARIABLE_TYPE.NUMBER && (
                    <Form.Item name="initialValue">
                      <InputNumber
                        ref={variableInitialValueNumberRef}
                        // formatter={(value) => {
                        //   const valueAsFloat = value
                        //     ? parseFloat(value as string)
                        //     : 0

                        //   return `${
                        //     Number.isSafeInteger(valueAsFloat)
                        //       ? value || ''
                        //       : valueAsFloat.toFixed(2)
                        //   }`
                        // }}
                      />
                    </Form.Item>
                  )}
                </Form>
              )}
            </Col>

            <Col
              className={`${styles.deleteVariableCol} ${styles.deleteCell}`}
              onClick={
                onDelete
                  ? () => variable.id && onDelete(variable.id)
                  : onRemoveVariable
              }
            >
              <DeleteOutlined style={{ fontSize: 12 }} />
            </Col>
          </Row>
        </>
      )}
    </>
  )
}

const VARIABLE_TYPE_LABELS: { [type in VARIABLE_TYPE]: string } = {
  [VARIABLE_TYPE.BOOLEAN]: 'Boolean',
  [VARIABLE_TYPE.STRING]: 'String',
  [VARIABLE_TYPE.NUMBER]: 'Number',
  [VARIABLE_TYPE.IMAGE]: 'Image',
  [VARIABLE_TYPE.URL]: 'URL'
}

/**
 * An index of the storyworld's variables, mirroring how WorldCharacters lists
 * characters: a row per variable that opens the manager rather than editing in
 * place.
 *
 * This panel used to be a second editable table — the same title, type and
 * initial-value fields the manager shows — with a delete that removed a variable
 * and every condition and effect naming it on one unconfirmed click. Editing now
 * happens in one place.
 */
const WorldVariables: React.FC<{
  studioId: StudioId
  worldId: WorldId
  onOpenManager: () => void
}> = ({ studioId, worldId, onOpenManager }) => {
  const variables = useVariables(studioId, worldId, [studioId, worldId])

  return (
    <div className={styles.WorldVariables}>
      {variables?.length === 0 && (
        <div className={styles.empty}>
          No variables yet. Use + above to add one.
        </div>
      )}

      {variables?.map((variable) => (
        <div
          className={styles.VariableIndexRow}
          key={variable.id}
          onClick={onOpenManager}
          title={variable.description || undefined}
        >
          <div className={styles.heading}>
            <span className={styles.title}>{variable.title}</span>
            <span className={styles.type}>
              {VARIABLE_TYPE_LABELS[variable.type]}
            </span>
          </div>

          {variable.description && (
            <div className={styles.description}>{variable.description}</div>
          )}
        </div>
      ))}
    </div>
  )
}

WorldVariables.displayName = 'WorldVariables'

export default WorldVariables
