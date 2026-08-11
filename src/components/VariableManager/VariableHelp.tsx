import React from 'react'

import { Button } from 'antd'
import { CloseOutlined } from '@ant-design/icons'

import styles from './styles.module.less'

/**
 * The variable and expression reference, in the app rather than behind a link.
 *
 * `ElementHelpButton` opens docs.elmstory.com, which no longer exists, and the
 * archived copy is not a usable substitute: its expressions page documents a
 * `=/=` operator that has never parsed and omits the method calls and arithmetic
 * that do work. So this is written against `lib/templates.ts` and is the only
 * accurate description of the expression language.
 *
 * Keep it in step with that file. Anything claimed here that the parser does not
 * support renders as an ERROR span for the author instead of failing here.
 */
const Example: React.FC<{ code: string; note: string }> = ({ code, note }) => (
  <div className={styles.example}>
    <code>{code}</code>
    <span>{note}</span>
  </div>
)

/**
 * The variable and expression reference itself, without the panel header. Shared
 * by the inline sheet below and the Help hub (`ElementHelp`), so the expression
 * documentation lives in exactly one place — see the module note above.
 */
export const VariableHelpContent: React.FC = () => (
  <div className={styles.helpBody}>
      <p>
        A variable belongs to the storyworld and holds one value while it is being
        played. Every value is stored as text, whatever the declared type, so a
        Number holds <code>{'"10"'}</code>. Changing a variable&apos;s type resets
        its initial value — to <code>false</code>, <code>0</code> or empty.
      </p>

      <h4>Where variables can be used</h4>

      <ul>
        <li>
          <strong>Event content</strong> — a template expression in{' '}
          <code>{'{ }'}</code> prints or decides text. See below.
        </li>
        <li>
          <strong>Path conditions</strong> — gate a path on a comparison, so a
          choice only leads somewhere when the variable says so.
        </li>
        <li>
          <strong>Path effects</strong> — assign, add, subtract, multiply or
          divide when a path is taken.
        </li>
        <li>
          <strong>Input events</strong> — store what the player types into a
          variable.
        </li>
      </ul>

      <h4>Template expressions</h4>

      <p>
        Type <code>{'{'}</code> in event content to start one. A variable is
        named by its <strong>title</strong>, and four forms are supported.
      </p>

      <p className={styles.note}>
        The editor helps you write these. Typing <code>{'{'}</code> — or pressing{' '}
        <code>Ctrl+Space</code> — opens a picker of the world&rsquo;s variables;
        once one is in place, <code>Ctrl+Space</code> again suggests the operators,
        methods and condition that fit its type. An expression that will not
        resolve is underlined in the editor, with the reason on hover.
      </p>

      <h5>1. The value itself</h5>

      <Example
        code="{ playerName }"
        note="Prints the value. An unset value prints the word undefined."
      />

      <h5>2. A method call</h5>

      <Example code="{ playerName.upper() }" note="Uppercased." />
      <Example code="{ playerName.lower() }" note="Lowercased." />

      <p className={styles.note}>
        Those two are the only methods. Any other name is an error.
      </p>

      <h5>3. A condition</h5>

      <Example
        code={'{ health > 50 ? "Steady." : "Hurt." }'}
        note="Picks one of two texts."
      />
      <Example
        code={'{ alive ? "Breathing." : "Not any more." }'}
        note="A Boolean on its own tests for true. Any other type tests whether it has a value at all."
      />
      <Example
        code={'{ !alive ? "Not any more." : "Breathing." }'}
        note="Negation works on Booleans only; on anything else it always takes the second branch."
      />
      <Example
        code="{ health > threshold ? name : epitaph }"
        note="Both sides and both outcomes may be variables."
      />

      <p className={styles.note}>
        Comparison operators: <code>{'>'}</code> <code>{'>='}</code>{' '}
        <code>{'<'}</code> <code>{'<='}</code> <code>==</code> <code>!=</code>.
        The ordering four need Numbers on both sides. Write{' '}
        <code>!=</code> for {'"not equal"'} — <code>=/=</code> is not an operator
        here, whatever older documentation claimed. Note that a{' '}
        <em>path condition</em> spells equality <code>=</code> in its dropdown,
        while an expression needs <code>==</code>.
      </p>

      <h5>4. Arithmetic</h5>

      <Example code="{ health - 10 }" note="Operators + - * / % are supported." />
      <Example
        code="{ (base + bonus) * 2 }"
        note="Parentheses and nesting work."
      />
      <Example
        code={'{ "Level " + level }'}
        note="A + with text on either side joins instead of adding."
      />

      <p className={styles.note}>
        Dividing by zero, a blank Number, and anything that is not a finite
        result are refused rather than printed. An empty String is a legitimate
        value and stays one.
      </p>

      <h4>What breaks an expression</h4>

      <ul>
        <li>
          Anything unsupported renders as a red <strong>ERROR</strong> in the
          event preview and in the storyteller, rather than as text.
        </li>
        <li>
          <strong>Renaming a variable does not update expressions.</strong> They
          resolve by title, so the old name stops matching. This manager lists
          which events name each variable — check that before you rename.
        </li>
        <li>
          <strong>Two variables with the same title are ambiguous</strong>, and
          the manager flags them. An expression naming that title resolves to
          whichever the engine loaded last.
        </li>
      </ul>
    </div>
)

VariableHelpContent.displayName = 'VariableHelpContent'

/**
 * The inline sheet shown in the Variable Manager: the reference above, under a
 * header with a close button.
 */
const VariableHelp: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className={styles.VariableHelp}>
    <div className={styles.helpHeader}>
      <h3>Using variables</h3>

      <Button size="small" type="text" onClick={onClose}>
        <CloseOutlined />
      </Button>
    </div>

    <VariableHelpContent />
  </div>
)

VariableHelp.displayName = 'VariableHelp'

export default VariableHelp
