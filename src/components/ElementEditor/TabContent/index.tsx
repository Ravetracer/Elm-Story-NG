import logger from '../../../lib/logger'

import React, { useContext, useEffect } from 'react'

import {
  ElementId,
  ELEMENT_TYPE,
  World,
  Scene,
  StudioId
} from '../../../data/types'

import { useDebouncedResizeObserver, useWorld, useScene } from '../../../hooks'

import { ComposerContext } from '../../../contexts/ComposerContext'
import ElementEditorTabProvider from '../../../contexts/ElementEditorTabContext'

import TabContentToolbar from './TabContentToolbar'

import styles from './styles.module.less'

const TabContent: React.FC<{
  studioId: StudioId
  id: ElementId
  type: ELEMENT_TYPE
  view: JSX.Element
  tools: JSX.Element
}> = ({ studioId, id, type, tools, view }) => {
  let component: { type: ELEMENT_TYPE; data: World | Scene | undefined }

  const { composer } = useContext(ComposerContext)

  const {
    ref: tabContentViewRef,
    width: tabContentViewWidth,
    height: tabContentViewHeight
  } = useDebouncedResizeObserver(1000)

  // Both run on every render and only one is given an id, because selecting
  // between them inside the switch below made hook order depend on `type`.
  const world = useWorld(
      studioId,
      type === ELEMENT_TYPE.WORLD ? id : undefined,
      [studioId, id, type]
    ),
    scene = useScene(
      studioId,
      type === ELEMENT_TYPE.SCENE ? id : undefined,
      [studioId, id, type]
    )

  switch (type) {
    case ELEMENT_TYPE.WORLD:
      component = { type: ELEMENT_TYPE.WORLD, data: world }
      break
    case ELEMENT_TYPE.SCENE:
      component = { type: ELEMENT_TYPE.SCENE, data: scene }
      break
    default:
      throw 'Unable to render TabContent. Unknown component type.'
  }

  useEffect(() => {
    logger.info(
      `TabContent->type,tabContentViewWidth,tabContentViewHeight->useEffect->
       type: ${type} width: ${tabContentViewWidth} height: ${tabContentViewHeight}`
    )
  }, [type, tabContentViewWidth, tabContentViewHeight])

  return (
    <ElementEditorTabProvider>
      {/*
       * The per-tab toolbar goes with the rest of the chrome in
       * distraction-free mode. It has to be done from here rather than from the
       * Composer route's stylesheet, because these are CSS module class names
       * and the hash is not addressable from another module.
       */}
      <div
        className={`${styles.TabContent} ${
          composer.distractionFreeMode.active ? styles.distractionFree : ''
        }`}
      >
        {/* #356 */}
        <TabContentToolbar component={component}>{tools}</TabContentToolbar>
        <div
          ref={tabContentViewRef}
          className={styles.TabContentView}
          style={{
            overflow: type === ELEMENT_TYPE.WORLD ? 'hidden' : 'initial'
          }}
        >
          {view}
        </div>
      </div>
    </ElementEditorTabProvider>
  )
}

export default TabContent
