import React from 'react'
import { EventContentLeaf as EventContentLeafType } from '../../../data/eventContentTypes'

import styles from './styles.module.less'

const EventContentLeaf: React.FC<{
  leaf: EventContentLeafType
  attributes?: {}
}> = ({ leaf, attributes, children }) => {
  let classNames = ''

  if (leaf.expression) {
    classNames = `${styles.expression}`
  }

  if (leaf.expressionStart || leaf.expressionEnd) {
    classNames = `${classNames} ${styles.expressionCap}`
  }

  // An expression that does not resolve — an unknown variable (usually a typo or
  // a rename) or a malformed form. Flagged only once the caret leaves it, so a
  // half-typed expression is not scolded mid-keystroke. See
  // lib/contentEditor/expressionValidation.ts.
  if (leaf.expressionError) {
    classNames = `${classNames} ${styles.expressionError}`
  }

  if (leaf.strong) {
    children = <strong {...attributes}>{children}</strong>
  }

  if (leaf.em) {
    children = <em {...attributes}>{children}</em>
  }

  if (leaf.s) {
    children = <s {...attributes}>{children}</s>
  }

  if (leaf.u) {
    children = <u {...attributes}>{children}</u>
  }

  return (
    <span
      {...attributes}
      className={classNames}
      // The reason a flagged expression will not resolve, shown on hover — a
      // native title for the same reason EventSnippet uses one.
      title={
        leaf.expressionError ? leaf.expressionErrorMessage : undefined
      }
      // elmstorygames/feedback#223
      spellCheck={leaf.expression ? false : true}
    >
      {children}
    </span>
  )
}

EventContentLeaf.displayName = 'EventContentLeaf'

export default EventContentLeaf
