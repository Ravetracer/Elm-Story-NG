// TODO: move to own package
import * as acorn from 'acorn'

import { VARIABLE_TYPE } from '../types'

interface AcornNode extends acorn.Node {
  body?: AcornNode[]
  expression?: AcornNode
  // Identifier
  name?: string
  // CallExpression
  callee?: AcornNode
  object?: AcornNode
  property?: AcornNode
  // ConditionalExpression
  test?: AcornNode
  // Widened from an identifier-only shape so that unary minus on a literal, as
  // in `{ -1 * count }`, can be folded; the conditional code below still reads
  // `argument.name` and `argument.type`, which remain available.
  argument?: AcornNode
  left?: AcornNode
  right?: AcornNode
  operator?: string
  consequent?: AcornNode
  alternate?: AcornNode
  value?: boolean | string | number
  raw?: string
}

enum NODE_TYPES {
  EXPRESSION_ERROR = 'ExpressionError',
  EXPRESSION_STATEMENT = 'ExpressionStatement',
  IDENTIFIER = 'Identifier',
  LITERAL = 'Literal',
  CALL_EXPRESSION = 'CallExpression',
  CONDITIONAL_EXPRESSION = 'ConditionalExpression',
  BINARY_EXPRESSION = 'BinaryExpression',
  MEMBER_EXPRESSION = 'MemberExpression',
  UNARY_EXPRESSION = 'UnaryExpression'
}

interface GameVariables {
  [variableName: string]: {
    value: string | undefined
    type: VARIABLE_TYPE
  }
}

interface GameMethods {
  [methodName: string]: any
}

interface ExpressionBase {}

interface IdentifierExpression extends ExpressionBase {
  type: NODE_TYPES.IDENTIFIER
  variableName: string
}

interface CallExpression extends ExpressionBase {
  type: NODE_TYPES.CALL_EXPRESSION
  variableName: string
  methodName: string
}

interface ConditionalExpression extends ExpressionBase {
  type: NODE_TYPES.CONDITIONAL_EXPRESSION
  identifier?: {
    type: NODE_TYPES.IDENTIFIER
    variableName: string
  }
  argument?: {
    type: NODE_TYPES.IDENTIFIER
    name: string
  }
  left?: {
    type: NODE_TYPES.IDENTIFIER | NODE_TYPES.LITERAL
    variableName?: string // Identifier
    value?: boolean | string | number // Literal
  }
  right?: {
    type: NODE_TYPES.IDENTIFIER | NODE_TYPES.LITERAL
    variableName?: string
    value?: boolean | string | number
  }
  operator?: string
  consequent: {
    type: NODE_TYPES.IDENTIFIER | NODE_TYPES.LITERAL
    variableName?: string
    value?: boolean | string | number
  }
  alternate: {
    type: NODE_TYPES.IDENTIFIER | NODE_TYPES.LITERAL
    variableName?: string
    value?: boolean | string | number
  }
}

/**
 * An operand of an arithmetic expression. Recursive, so `{ (a + b) * 2 }` and
 * `{ a + b + c }` both parse: acorn nests BinaryExpressions on the left, and
 * parentheses simply change where the nesting falls.
 */
type BinaryOperand =
  | { type: NODE_TYPES.IDENTIFIER; variableName: string }
  | { type: NODE_TYPES.LITERAL; value: boolean | string | number }
  | BinaryExpression

interface BinaryExpression extends ExpressionBase {
  type: NODE_TYPES.BINARY_EXPRESSION
  operator: string
  left: BinaryOperand
  right: BinaryOperand
}

export const SUPPORTED_BINARY_OPERATORS = ['+', '-', '*', '/', '%']

interface ExpressionError extends ExpressionBase {
  type: NODE_TYPES.EXPRESSION_ERROR
  message: string
}

export function getTemplateExpressionRanges(
  template: string
): { start: number; end: number }[] {
  const templateExpressionsWithIndex = [...template.matchAll(/{([^}]+)}/g)]

  return templateExpressionsWithIndex.map((expression) => {
    return {
      start: expression.index || 0,
      end: (expression.index || 0) + expression[0].length
    }
  })
}

export function getTemplateExpressions(template: string): string[] {
  const templateExpressions: string[] | null = template.match(/{([^}]+)}/g)

  return templateExpressions
    ? templateExpressions.map(
        (templateExpression: string) => templateExpression.replace(/{|}/g, '') // remove curly braces
      )
    : []
}

function processIdentifierExpression(
  expression: AcornNode,
  variables: GameVariables
): IdentifierExpression | ExpressionError {
  if (expression.type === NODE_TYPES.IDENTIFIER && expression.name) {
    return variables[expression?.name]
      ? { type: NODE_TYPES.IDENTIFIER, variableName: expression.name }
      : {
          type: NODE_TYPES.EXPRESSION_ERROR,
          message: `Unable to process identifier expression. '${expression.name}' is an unknown variable.`
        }
  } else {
    return {
      type: NODE_TYPES.EXPRESSION_ERROR,
      message: 'Unable to process identifier expression.'
    }
  }
}

function processCallExpression(
  expression: AcornNode,
  gameVariables: GameVariables,
  gameMethods: GameMethods
): CallExpression | ExpressionError {
  const callee = expression.callee

  if (
    callee &&
    callee.type === NODE_TYPES.MEMBER_EXPRESSION &&
    callee.object &&
    callee.object.type === NODE_TYPES.IDENTIFIER &&
    callee.object.name &&
    callee.property &&
    callee.property.type === NODE_TYPES.IDENTIFIER &&
    callee.property.name
  ) {
    if (
      gameVariables[callee.object.name] &&
      gameMethods[callee.property.name]
    ) {
      return {
        type: NODE_TYPES.CALL_EXPRESSION,
        variableName: callee.object.name,
        methodName: callee.property.name
      }
    } else {
      return {
        type: NODE_TYPES.EXPRESSION_ERROR,
        message: `Unable to process call expression. ${
          !gameVariables[callee.object.name]
            ? `Missing world variable: '${callee.object.name}' `
            : ''
        }${
          !gameMethods[callee.property.name]
            ? `Missing world method: '${callee.property.name}`
            : ''
        }`
      }
    }
  } else {
    return {
      type: NODE_TYPES.EXPRESSION_ERROR,
      message: `Unable to process call expression. Example format: '{ variableName.upper() }`
    }
  }
}

/**
 * Folds a unary plus or minus applied to a numeric literal into that literal, so
 * `-1` reaches the evaluator as a value rather than as a node it would have to
 * understand. Anything else is left alone for the caller to reject.
 */
function foldNumericUnary(node: AcornNode): AcornNode {
  if (
    node.type === NODE_TYPES.UNARY_EXPRESSION &&
    (node.operator === '-' || node.operator === '+') &&
    node.argument?.type === NODE_TYPES.LITERAL &&
    typeof node.argument.value === 'number'
  ) {
    return {
      ...node.argument,
      type: NODE_TYPES.LITERAL,
      value: node.operator === '-' ? -node.argument.value : node.argument.value
    } as AcornNode
  }

  return node
}

function processBinaryOperand(
  node: AcornNode,
  variables: GameVariables
): BinaryOperand | ExpressionError {
  const operand = foldNumericUnary(node)

  if (operand.type === NODE_TYPES.IDENTIFIER && operand.name) {
    return variables[operand.name]
      ? { type: NODE_TYPES.IDENTIFIER, variableName: operand.name }
      : {
          type: NODE_TYPES.EXPRESSION_ERROR,
          message: `Unable to process arithmetic expression. '${operand.name}' is an unknown variable.`
        }
  }

  if (operand.type === NODE_TYPES.LITERAL && operand.value !== undefined) {
    return { type: NODE_TYPES.LITERAL, value: operand.value }
  }

  if (operand.type === NODE_TYPES.BINARY_EXPRESSION) {
    return processBinaryExpression(operand, variables)
  }

  return {
    type: NODE_TYPES.EXPRESSION_ERROR,
    message: `Unable to process arithmetic expression. Example format: '{ variableName + 1 }'`
  }
}

function processBinaryExpression(
  expression: AcornNode,
  variables: GameVariables
): BinaryExpression | ExpressionError {
  const { left, right, operator } = expression

  if (!left || !right || !operator)
    return {
      type: NODE_TYPES.EXPRESSION_ERROR,
      message: `Unable to process arithmetic expression. Example format: '{ variableName + 1 }'`
    }

  if (!SUPPORTED_BINARY_OPERATORS.includes(operator))
    return {
      type: NODE_TYPES.EXPRESSION_ERROR,
      message: `Unable to process arithmetic expression. Operator '${operator}' is not supported. Supported operators: ${SUPPORTED_BINARY_OPERATORS.join(
        ' '
      )}`
    }

  const processedLeft = processBinaryOperand(left, variables),
    processedRight = processBinaryOperand(right, variables)

  // Report the offending side rather than a generic failure.
  if (processedLeft.type === NODE_TYPES.EXPRESSION_ERROR) return processedLeft
  if (processedRight.type === NODE_TYPES.EXPRESSION_ERROR) return processedRight

  return {
    type: NODE_TYPES.BINARY_EXPRESSION,
    operator,
    left: processedLeft,
    right: processedRight
  }
}

function processConditionalExpression(
  expression: AcornNode
): ConditionalExpression | ExpressionError {
  const test = expression.test,
    consequent = expression.consequent,
    alternate = expression.alternate

  if (
    test &&
    consequent &&
    (consequent.type === NODE_TYPES.IDENTIFIER ||
      consequent.type === NODE_TYPES.LITERAL) &&
    (consequent.name !== undefined || consequent.value !== undefined) &&
    alternate &&
    (alternate.type === NODE_TYPES.IDENTIFIER ||
      alternate.type === NODE_TYPES.LITERAL) &&
    (alternate.name !== undefined || alternate.value !== undefined)
  ) {
    if (
      test.type === NODE_TYPES.UNARY_EXPRESSION &&
      test.argument?.type === NODE_TYPES.IDENTIFIER &&
      test.argument?.name &&
      test.operator === '!'
    ) {
      return {
        type: NODE_TYPES.CONDITIONAL_EXPRESSION,
        argument: {
          name: test.argument.name,
          type: test.argument.type
        },
        consequent: {
          type: consequent.type,
          variableName:
            consequent.type === NODE_TYPES.IDENTIFIER
              ? consequent.name
              : undefined,
          value:
            consequent.type === NODE_TYPES.LITERAL
              ? consequent.value
              : undefined
        },
        alternate: {
          type: alternate.type,
          variableName:
            alternate.type === NODE_TYPES.IDENTIFIER
              ? alternate.name
              : undefined,
          value:
            alternate.type === NODE_TYPES.LITERAL ? alternate.value : undefined
        }
      }
    }

    if (test.type === NODE_TYPES.IDENTIFIER && test.name) {
      return {
        type: NODE_TYPES.CONDITIONAL_EXPRESSION,
        identifier: {
          type: NODE_TYPES.IDENTIFIER,
          variableName: test.name
        },
        consequent: {
          type: consequent.type,
          variableName:
            consequent.type === NODE_TYPES.IDENTIFIER
              ? consequent.name
              : undefined,
          value:
            consequent.type === NODE_TYPES.LITERAL
              ? consequent.value
              : undefined
        },
        alternate: {
          type: alternate.type,
          variableName:
            alternate.type === NODE_TYPES.IDENTIFIER
              ? alternate.name
              : undefined,
          value:
            alternate.type === NODE_TYPES.LITERAL ? alternate.value : undefined
        }
      }
    }

    if (
      test.type === NODE_TYPES.BINARY_EXPRESSION &&
      test.left &&
      (test.left.type === NODE_TYPES.IDENTIFIER ||
        test.left.type === NODE_TYPES.LITERAL) &&
      test.operator && // Check supported operator
      test.right &&
      (test.right.type === NODE_TYPES.IDENTIFIER ||
        test.right.type === NODE_TYPES.LITERAL)
    ) {
      return {
        type: NODE_TYPES.CONDITIONAL_EXPRESSION,
        left: {
          type: test.left.type,
          variableName:
            test.left.type === NODE_TYPES.IDENTIFIER
              ? test.left.name
              : undefined,
          value:
            test.left.type === NODE_TYPES.LITERAL ? test.left.value : undefined
        },
        right: {
          type: test.right.type,
          variableName:
            test.right.type === NODE_TYPES.IDENTIFIER
              ? test.right.name
              : undefined,
          value:
            test.right.type === NODE_TYPES.LITERAL
              ? test.right.value
              : undefined
        },
        operator: test.operator,
        consequent: {
          type: consequent.type,
          variableName:
            consequent.type === NODE_TYPES.IDENTIFIER
              ? consequent.name
              : undefined,
          value:
            consequent.type === NODE_TYPES.LITERAL
              ? consequent.value
              : undefined
        },
        alternate: {
          type: alternate.type,
          variableName:
            alternate.type === NODE_TYPES.IDENTIFIER
              ? alternate.name
              : undefined,
          value:
            alternate.type === NODE_TYPES.LITERAL ? alternate.value : undefined
        }
      }
    }

    return {
      type: NODE_TYPES.EXPRESSION_ERROR,
      message: `Unable to process conditional expression. Example format: '{ variableName > 0 ? "Greater than 0." : "Not greater than zero." }`
    }
  } else {
    return {
      type: NODE_TYPES.EXPRESSION_ERROR,
      message: `Unable to process conditional expression. Example format: '{ variableName > 0 ? "Greater than 0." : "Not greater than zero." }`
    }
  }
}

/**
 * Resolves an arithmetic operand to a plain value.
 *
 * Variable values are stored as strings regardless of declared type, so a NUMBER
 * variable arrives as "10". Returns undefined for anything unusable — an unknown
 * variable, an unset value, or a nested expression that itself failed — which the
 * caller turns into the 'esg-error' sentinel.
 */
function resolveBinaryOperand(
  operand: BinaryOperand,
  variables: GameVariables
): number | string | undefined {
  if (operand.type === NODE_TYPES.BINARY_EXPRESSION)
    return evaluateBinaryExpression(operand, variables)

  if (operand.type === NODE_TYPES.LITERAL) {
    if (typeof operand.value === 'boolean') return undefined

    return operand.value
  }

  const variable = variables[operand.variableName]

  if (!variable || variable.value === undefined) return undefined

  if (variable.type === VARIABLE_TYPE.NUMBER) {
    // A blank number is not treated as zero: silently reading it as 0 would hide
    // an authoring mistake. Changing a variable's type resets a NUMBER's initial
    // value to '0', so this is only reachable for values written another way.
    if (variable.value === '') return undefined

    const asNumber = Number(variable.value)

    return Number.isFinite(asNumber) ? asNumber : undefined
  }

  // An empty string, unlike a blank number, is a legitimate value: changing a
  // variable's type resets a STRING's initial value to exactly that.
  if (variable.type === VARIABLE_TYPE.STRING) return variable.value

  // Booleans, images and urls have no meaningful arithmetic.
  return undefined
}

/**
 * Evaluates a parsed arithmetic expression, or returns undefined if it cannot be
 * evaluated.
 *
 * `+` concatenates when either side resolves to a string, matching what an author
 * writing `{ "Level " + level }` expects; the other operators require numbers on
 * both sides. Division and modulo by zero, and any non-finite result, are refused
 * rather than rendered as Infinity or NaN.
 */
function evaluateBinaryExpression(
  expression: BinaryExpression,
  variables: GameVariables
): number | string | undefined {
  const left = resolveBinaryOperand(expression.left, variables),
    right = resolveBinaryOperand(expression.right, variables)

  if (left === undefined || right === undefined) return undefined

  if (expression.operator === '+') {
    if (typeof left === 'string' || typeof right === 'string')
      return `${left}${right}`

    return left + right
  }

  // Every remaining operator is numeric.
  if (typeof left !== 'number' || typeof right !== 'number') return undefined

  let result: number

  switch (expression.operator) {
    case '-':
      result = left - right
      break
    case '*':
      result = left * right
      break
    case '/':
      if (right === 0) return undefined

      result = left / right
      break
    case '%':
      if (right === 0) return undefined

      result = left % right
      break
    default:
      return undefined
  }

  return Number.isFinite(result) ? result : undefined
}

export function parseTemplateExpressions(
  templateExpressions: string[],
  variables: GameVariables,
  methods: GameMethods
): (
  | IdentifierExpression
  | CallExpression
  | BinaryExpression
  | ConditionalExpression
  | ExpressionError
)[] {
  const parsedExpressions: (
    | IdentifierExpression
    | CallExpression
    | BinaryExpression
    | ConditionalExpression
    | ExpressionError
  )[] = []

  templateExpressions.map((templateExpression) => {
    try {
      // AcornNode is a deliberately loose local view of acorn's AST, so the
      // precise Program type it returns is widened to it here.
      const parsedExpression = acorn.parse(templateExpression, {
          ecmaVersion: 2020
        }) as unknown as AcornNode,
        statement = parsedExpression.body && parsedExpression.body[0],
        expression = statement?.expression

      if (
        statement &&
        statement.type === NODE_TYPES.EXPRESSION_STATEMENT &&
        expression
      ) {
        switch (expression.type) {
          case NODE_TYPES.IDENTIFIER:
            parsedExpressions.push(
              processIdentifierExpression(expression, variables)
            )
            break
          case NODE_TYPES.CALL_EXPRESSION:
            parsedExpressions.push(
              processCallExpression(expression, variables, methods)
            )
            break
          case NODE_TYPES.CONDITIONAL_EXPRESSION:
            parsedExpressions.push(processConditionalExpression(expression))
            break
          case NODE_TYPES.BINARY_EXPRESSION:
            parsedExpressions.push(
              processBinaryExpression(expression, variables)
            )
            break
          default:
            parsedExpressions.push({
              type: NODE_TYPES.EXPRESSION_ERROR,
              message: `Unable to parse template expression. '${templateExpression}' is not supported.`
            })
            break
        }
      } else {
        parsedExpressions.push({
          type: NODE_TYPES.EXPRESSION_ERROR,
          message: `Unable to parse template expression. '${templateExpression}' is not supported.`
        })
      }
    } catch (error) {
      parsedExpressions.push({
        type: NODE_TYPES.EXPRESSION_ERROR,
        message: `Unable to parse template expression. '${templateExpression}' is not supported.`
      })
    }
  })

  return parsedExpressions
}

export function getProcessedTemplate(
  template: string,
  expressions: string[],
  parsedExpressions: (
    | IdentifierExpression
    | CallExpression
    | BinaryExpression
    | ConditionalExpression
    | ExpressionError
  )[],
  variables: GameVariables,
  methods: GameMethods
) {
  let processedTemplate = `${template}`

  expressions.map((expression, index) => {
    const parsedExpression = parsedExpressions[index]

    let value

    switch (parsedExpression.type) {
      case NODE_TYPES.IDENTIFIER:
        value = variables[parsedExpression.variableName].value || 'undefined'
        break
      case NODE_TYPES.CALL_EXPRESSION:
        value = methods[parsedExpression.methodName]?.(
          variables[parsedExpression.variableName].value
        )
        break
      case NODE_TYPES.BINARY_EXPRESSION:
        const arithmetic = evaluateBinaryExpression(parsedExpression, variables)

        // Stringified deliberately: the substitution below drops any falsy
        // value, so a numeric result of 0 would disappear from the rendered text
        // rather than appear. "0" is truthy. A concatenation that yields an empty
        // string still renders as nothing, which matches what an identifier
        // holding an empty value already does.
        value = arithmetic === undefined ? 'esg-error' : `${arithmetic}`
        break
      case NODE_TYPES.CONDITIONAL_EXPRESSION:
        const leftVariable = parsedExpression.left,
          rightVariable = parsedExpression.right

        const operator = parsedExpression.operator

        const consequent = parsedExpression.consequent,
          alternate = parsedExpression.alternate

        const consequentValue =
            consequent &&
            consequent.variableName &&
            consequent.type === NODE_TYPES.IDENTIFIER
              ? variables[consequent.variableName]
                ? variables[consequent.variableName].value || 'undefined'
                : 'esg-error'
              : consequent.value,
          alternateValue =
            alternate &&
            alternate.variableName &&
            alternate.type === NODE_TYPES.IDENTIFIER
              ? variables[alternate.variableName]
                ? variables[alternate.variableName].value || 'undefined'
                : 'esg-error'
              : alternate.value

        const foundLeftVariable = leftVariable?.variableName
            ? variables[leftVariable.variableName]
            : undefined,
          foundRightVariable = rightVariable?.variableName
            ? variables[rightVariable.variableName]
            : undefined

        switch (operator) {
          // NUMBERS
          case '>':
          case '>=':
          case '<':
          case '<=':
            // variables on both sides
            if (leftVariable?.variableName && rightVariable?.variableName) {
              if (
                foundLeftVariable &&
                foundLeftVariable.type === VARIABLE_TYPE.NUMBER &&
                foundLeftVariable.value &&
                foundRightVariable &&
                foundRightVariable.type === VARIABLE_TYPE.NUMBER &&
                foundRightVariable.value
              ) {
                switch (operator) {
                  case '>':
                    value =
                      Number(foundLeftVariable.value) >
                      Number(foundRightVariable.value)
                        ? consequentValue
                        : alternateValue
                    break
                  case '>=':
                    value =
                      Number(foundLeftVariable.value) >=
                      Number(foundRightVariable.value)
                        ? consequentValue
                        : alternateValue
                    break
                  case '<':
                    value =
                      Number(foundLeftVariable.value) <
                      Number(foundRightVariable.value)
                        ? consequentValue
                        : alternateValue
                    break
                  case '<=':
                    value =
                      Number(foundLeftVariable.value) <=
                      Number(foundRightVariable.value)
                        ? consequentValue
                        : alternateValue
                    break
                  default:
                    value = 'esg-error'
                }
              } else {
                value = 'esg-error'
              }
            }

            // variable on left or right
            if (
              (leftVariable?.variableName &&
                rightVariable &&
                !rightVariable.variableName) ||
              (rightVariable?.variableName &&
                leftVariable &&
                !leftVariable.variableName)
            ) {
              if (
                (foundLeftVariable &&
                  foundLeftVariable.type === VARIABLE_TYPE.NUMBER &&
                  foundLeftVariable.value &&
                  (rightVariable.value || rightVariable.value === 0) &&
                  typeof rightVariable.value === 'number') ||
                (foundRightVariable &&
                  foundRightVariable.type === VARIABLE_TYPE.NUMBER &&
                  foundRightVariable.value &&
                  (leftVariable.value || leftVariable.value === 0) &&
                  typeof leftVariable.value === 'number')
              ) {
                switch (operator) {
                  case '>':
                    value =
                      Number(foundLeftVariable?.value || leftVariable.value) >
                      Number(foundRightVariable?.value || rightVariable.value)
                        ? consequentValue
                        : alternateValue
                    break
                  case '>=':
                    value =
                      Number(foundLeftVariable?.value || leftVariable.value) >=
                      Number(foundRightVariable?.value || rightVariable.value)
                        ? consequentValue
                        : alternateValue
                    break
                  case '<':
                    value =
                      Number(foundLeftVariable?.value || leftVariable.value) <
                      Number(foundRightVariable?.value || rightVariable.value)
                        ? consequentValue
                        : alternateValue
                    break
                  case '<=':
                    value =
                      Number(foundLeftVariable?.value || leftVariable.value) <=
                      Number(foundRightVariable?.value || rightVariable.value)
                        ? consequentValue
                        : alternateValue
                    break
                  default:
                    value = 'esg-error'
                }
              } else {
                value = 'esg-error'
              }
            }

            if (!value) value = 'esg-error'

            break
          // (IN)EQUALITY
          case '==':
          case '!=':
            if (foundLeftVariable && foundRightVariable) {
              // booleans
              if (
                foundLeftVariable.type === VARIABLE_TYPE.BOOLEAN &&
                foundRightVariable.type === VARIABLE_TYPE.BOOLEAN
              ) {
                value =
                  operator === '=='
                    ? (foundLeftVariable.value === 'true' &&
                        foundRightVariable.value === 'true') ||
                      (foundLeftVariable.value === 'false' &&
                        foundRightVariable.value === 'false')
                      ? consequentValue
                      : alternateValue
                    : // !=
                    (foundLeftVariable.value === 'true' &&
                        foundRightVariable.value === 'false') ||
                      (foundLeftVariable.value === 'false' &&
                        foundRightVariable.value === 'true')
                    ? consequentValue
                    : alternateValue
              }

              // strings and numbers
              if (
                !value &&
                foundLeftVariable.value &&
                foundRightVariable.value
              ) {
                value =
                  operator === '=='
                    ? foundLeftVariable.value === foundRightVariable.value
                      ? consequentValue
                      : alternateValue
                    : // !=
                    foundLeftVariable.value !== foundRightVariable.value
                    ? consequentValue
                    : alternateValue
              }
            }

            if (foundLeftVariable && !foundRightVariable) {
              // booleans
              if (
                foundLeftVariable.type === VARIABLE_TYPE.BOOLEAN &&
                typeof rightVariable?.value === 'boolean'
              ) {
                value =
                  operator === '=='
                    ? (foundLeftVariable.value === 'true' &&
                        rightVariable.value) ||
                      (foundLeftVariable.value === 'false' &&
                        !rightVariable.value)
                      ? consequentValue
                      : alternateValue
                    : // !=
                    (foundLeftVariable.value === 'false' &&
                        rightVariable.value) ||
                      (foundLeftVariable.value === 'true' &&
                        !rightVariable.value)
                    ? consequentValue
                    : alternateValue
              }

              // numbers
              if (
                foundLeftVariable.type === VARIABLE_TYPE.NUMBER &&
                typeof rightVariable?.value === 'number'
              ) {
                value =
                  operator === '=='
                    ? Number(foundLeftVariable.value) === rightVariable.value
                      ? consequentValue
                      : alternateValue
                    : // !=
                    Number(foundLeftVariable.value) !== rightVariable.value
                    ? consequentValue
                    : alternateValue
              }

              // strings
              if (!value && foundLeftVariable.value && rightVariable?.value) {
                value =
                  operator === '=='
                    ? foundLeftVariable.value === rightVariable?.value
                      ? consequentValue
                      : alternateValue
                    : // !=
                    foundLeftVariable.value !== rightVariable?.value
                    ? consequentValue
                    : alternateValue
              }
            }

            if (!foundLeftVariable && foundRightVariable) {
              // booleans
              if (
                foundRightVariable.type === VARIABLE_TYPE.BOOLEAN &&
                typeof leftVariable?.value === 'boolean'
              ) {
                value =
                  operator === '=='
                    ? (foundRightVariable.value === 'true' &&
                        leftVariable.value) ||
                      (foundRightVariable.value === 'false' &&
                        !leftVariable.value)
                      ? consequentValue
                      : alternateValue
                    : // !=
                    (foundRightVariable.value === 'false' &&
                        leftVariable.value) ||
                      (foundRightVariable.value === 'true' &&
                        !leftVariable.value)
                    ? consequentValue
                    : alternateValue
              }

              // numbers
              if (
                foundRightVariable.type === VARIABLE_TYPE.NUMBER &&
                typeof leftVariable?.value === 'number'
              ) {
                value =
                  operator === '=='
                    ? Number(foundRightVariable.value) === leftVariable.value
                      ? consequentValue
                      : alternateValue
                    : // !=
                    Number(foundRightVariable.value) !== leftVariable.value
                    ? consequentValue
                    : alternateValue
              }

              // strings
              if (!value && foundRightVariable.value && leftVariable?.value) {
                value =
                  operator === '=='
                    ? foundRightVariable.value === leftVariable?.value
                      ? consequentValue
                      : alternateValue
                    : // !=
                    foundRightVariable.value !== leftVariable?.value
                    ? consequentValue
                    : alternateValue
              }
            }

            if (!value) value = 'esg-error'

            break
          default:
            value = 'esg-error'
            break
        }

        // IDENTIFIER
        if (parsedExpression.identifier?.variableName) {
          const foundVariable =
            variables[parsedExpression.identifier.variableName]

          if (foundVariable) {
            if (foundVariable.type === VARIABLE_TYPE.BOOLEAN) {
              value =
                foundVariable.value === 'true'
                  ? consequentValue
                  : alternateValue
            }

            if (foundVariable.type !== VARIABLE_TYPE.BOOLEAN) {
              value =
                foundVariable && foundVariable.value
                  ? consequentValue
                  : alternateValue
            }
          }

          if (!foundVariable) value = 'esg-error'
        }

        // UNARY
        if (
          parsedExpression.argument &&
          parsedExpression.argument.name &&
          parsedExpression.argument.type
        ) {
          const foundVariable = variables[parsedExpression.argument.name]

          if (foundVariable) {
            value =
              // boolean
              foundVariable.type === VARIABLE_TYPE.BOOLEAN
                ? foundVariable.value === 'false'
                  ? consequentValue
                  : alternateValue
                : // not boolean
                  alternateValue
          }

          if (!foundVariable) value = 'esg-error'
        }
        break
      case NODE_TYPES.EXPRESSION_ERROR:
        value = 'esg-error'
        break
      default:
        break
    }

    value = value ? `{${value}}` : ''

    processedTemplate = processedTemplate
      .split('{' + expression + '}')
      .join(value || '')
  })

  return processedTemplate.replace(/\s+/g, ' ').trim()
}

export const gameMethods = {
  lower: (value: string): string => value.toLowerCase(),
  upper: (value: string): string => value.toUpperCase()
}
