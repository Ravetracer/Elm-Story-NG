import React from 'react'

import { ELEMENT_TYPE } from '../../data/types'

import { HelpButton } from '../ElementHelp'

import styles from './styles.module.less'

/**
 * The `?` beside an element's properties. It used to open
 * docs.elmstory.com/guides/production/composer/elements, which no longer
 * resolves; it now opens the in-app help modal in `ElementHelp`, keeping its own
 * icon styling. A type with no help entry renders nothing.
 */
const ElementHelpButton: React.FC<{ type: ELEMENT_TYPE }> = ({ type }) => (
  <HelpButton topic={type} className={styles.ElementHelpButton} />
)

ElementHelpButton.displayName = 'ElementHelpButton'

export default ElementHelpButton
